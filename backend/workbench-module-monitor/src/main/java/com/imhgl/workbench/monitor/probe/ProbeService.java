package com.imhgl.workbench.monitor.probe;

import com.imhgl.workbench.infrastructure.metrics.TrafficRecord;
import com.imhgl.workbench.monitor.collector.ProbeTarget;
import com.imhgl.workbench.monitor.collector.SourceConfigStore;
import com.imhgl.workbench.monitor.service.MonitorService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * HTTP 拨测：对启用目标逐个发 GET，把结果写成合成流量记录。
 * <p>为什么复用 TrafficRecord：现有 overview / series / recent / top-endpoints 全部按
 * （分钟, source, endpoint, method）聚合，拨测结果只要符合这个形状就免费获得整套查询能力，
 * 不需要第二套存储或第二套查询接口。
 * <p>连接失败、超时、非法 URL 一律记 status=0（既有错误判定为 status ≥ 400，0 同样计错误）。
 */
@Service
public class ProbeService {

    /** 拨测来源前缀：与 workbench / github/owner/repo 同一命名空间，避免与上报源重名 */
    public static final String SOURCE_PREFIX = "probe/";

    private final SourceConfigStore targetStore;
    private final MonitorService monitorService;
    private final ProbeProperties properties;
    private final HttpClient httpClient;

    public ProbeService(SourceConfigStore targetStore, MonitorService monitorService, ProbeProperties properties) {
        this.targetStore = targetStore;
        this.monitorService = monitorService;
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.timeoutMs()))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** 探测全部启用目标；单目标失败不影响其余目标。返回本次探测的目标数 */
    public int probeAll() {
        List<ProbeTarget> targets = targetStore.probes();
        int probed = 0;
        for (ProbeTarget target : targets) {
            if (!target.enabled()) {
                continue;
            }
            probe(target);
            probed++;
        }
        return probed;
    }

    /** 探测单个目标并入库；status=0 表示连接失败、超时或 URL 非法 */
    public void probe(ProbeTarget target) {
        long startedAtNanos = System.nanoTime();
        int status = requestStatus(target.url());
        long elapsedMs = Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000);
        long minute = System.currentTimeMillis() / 60_000L;
        int latencySample = (int) Math.min(elapsedMs, Integer.MAX_VALUE);
        monitorService.record(new TrafficRecord(
                minute,
                SOURCE_PREFIX + target.name(),
                target.url(),
                "GET",
                status,
                1,
                elapsedMs,
                elapsedMs,
                List.of(latencySample)));
    }

    private int requestStatus(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofMillis(properties.timeoutMs()))
                    .GET()
                    .build();
            return httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (InterruptedException e) {
            // 恢复中断标记，交给上层调度线程处理
            Thread.currentThread().interrupt();
            return 0;
        } catch (IOException | IllegalArgumentException e) {
            // 连接失败 / 超时 / URL 非法：统一记 0，具体原因不落库（时序只表达状态）
            return 0;
        }
    }
}
