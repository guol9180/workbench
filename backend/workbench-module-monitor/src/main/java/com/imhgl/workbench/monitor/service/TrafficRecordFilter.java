package com.imhgl.workbench.monitor.service;

import com.imhgl.workbench.infrastructure.metrics.TrafficRecord;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.regex.Pattern;

/**
 * 自监测过滤器：统计本系统全部 {@code /api/**} 请求（source=workbench）。
 *
 * <p>取舍（为什么这么做）：
 * <ul>
 *   <li><b>@Order(-200)，先于 Token 过滤器（-100）</b>——被 401 拒绝的请求也是流量（扫描器探测正是
 *       想观测的信号），采集必须发生在认证之前。</li>
 *   <li><b>异步有界队列 + 单消费线程</b>——业务线程只做一次非阻塞 offer（纳秒级），
 *       任何存储侧抖动都被队列吸收；队列满则丢弃并计数（{@link MonitorService#reportDrop}），
 *       监测永远不能成为业务的性能或可用性风险。</li>
 *   <li><b>路径归一化</b>（数字段→{n}、UUID→{u}）——否则 /api/users/123 与 /api/users/456
 *       会撑爆端点维度，排行失去意义。</li>
 *   <li><b>finally 里记录</b>——异常请求（最终 500）也计入；请求耗时 = 过滤器内全程。</li>
 * </ul>
 */
@Component
@Order(-200)
public class TrafficRecordFilter extends OncePerRequestFilter {

    /** 队列容量：个人流量级别的洪峰缓冲（按每请求一条记录估算，足够吸收秒级突发） */
    static final int DEFAULT_CAPACITY = 1024;

    private static final Pattern NUMERIC = Pattern.compile("\\d+");
    private static final Pattern UUID = Pattern.compile(
            "(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    private final MonitorService service;
    private final BlockingQueue<TrafficRecord> queue;
    private final Thread worker;

    /** Spring 注入用构造器：多构造器并存时必须显式 @Autowired，否则容器找默认构造失败 */
    @org.springframework.beans.factory.annotation.Autowired
    public TrafficRecordFilter(MonitorService service) {
        this(service, DEFAULT_CAPACITY);
    }

    /** 测试入口：小容量验证背压丢弃 */
    TrafficRecordFilter(MonitorService service, int capacity) {
        this.service = service;
        this.queue = new ArrayBlockingQueue<>(capacity);
        this.worker = new Thread(this::drainLoop, "monitor-traffic-collector");
        worker.setDaemon(true);
        worker.start();
    }

    private void drainLoop() {
        try {
            while (true) {
                service.record(queue.take());
            }
        } catch (InterruptedException e) {
            // 停机：中断即退出，剩余排队数据由下一次启动的重放兜底（已落盘部分）
            Thread.currentThread().interrupt();
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // 非 API 路径与 CORS 预检不产生业务流量记录
        if (!request.getRequestURI().startsWith("/api/")
                || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        long start = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            long cost = System.currentTimeMillis() - start;
            int status = response.getStatus();
            TrafficRecord record = new TrafficRecord(
                    start / 60_000L, MonitorService.SELF_SOURCE,
                    normalize(request.getRequestURI()), request.getMethod(),
                    status, 1, cost, cost,
                    List.of((int) Math.min(cost, Integer.MAX_VALUE)));
            if (!queue.offer(record)) {
                service.reportDrop();
            }
        }
    }

    /** 路径归一化：把高基数的动态段折叠为占位符，保住端点聚合维度 */
    static String normalize(String path) {
        StringBuilder sb = new StringBuilder(path.length());
        for (String segment : path.split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            sb.append('/');
            if (NUMERIC.matcher(segment).matches()) {
                sb.append("{n}");
            } else if (UUID.matcher(segment).matches()) {
                sb.append("{u}");
            } else {
                sb.append(segment);
            }
        }
        return sb.length() == 0 ? "/" : sb.toString();
    }

    @PreDestroy
    void shutdown() {
        worker.interrupt();
    }
}
