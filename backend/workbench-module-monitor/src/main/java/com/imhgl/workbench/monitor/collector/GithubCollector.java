package com.imhgl.workbench.monitor.collector;

import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.service.MonitorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GitHub 拉取采集器：定时 + 手动触发，把配置的仓库指标按 §3.5 映射写入时序存储。
 * <p>幂等设计（配合聚合桶的叠加语义）：
 * - pages：GitHub 给每日绝对值，绝对值重复入库会叠加虚高——用配置上的 lastDay 游标只采严格更新的日期（游标持久化，重启安全）；
 * - downloads：GitHub 只给累计值，增量相对上次采集在内存维护（重启重新起算基线，首采记 0——宁可少记不可虚记）。
 * token 缺失/接口失败都写回配置的 lastError，配置页可见，绝不静默。
 */
@Component
public class GithubCollector {

    private static final Logger log = LoggerFactory.getLogger(GithubCollector.class);

    private final SourceConfigStore store;
    private final GithubClient client;
    private final MonitorService service;
    private final GithubTokenProvider tokenProvider;

    /** downloads 累计值基线：key = 配置 id。内存即可——重启后重新起算，符合「宁缺勿假」 */
    private final Map<String, Long> lastTotals = new ConcurrentHashMap<>();

    public GithubCollector(SourceConfigStore store, GithubClient client, MonitorService service,
                           GithubTokenProvider tokenProvider) {
        this.store = store;
        this.client = client;
        this.service = service;
        this.tokenProvider = tokenProvider;
    }

    /** 采集结果（手动触发的 API 回显用） */
    public record CollectOutcome(boolean ok, String error) {
    }

    /** 定时采集：cron 由 workbench.sources.cron 配置，配 "-" 整体关闭（只留手动）。单仓失败不影响其他仓 */
    @Scheduled(cron = "${workbench.sources.cron:0 5 8,20 * * *}")
    public void scheduledCollect() {
        for (SourceConfig config : store.list()) {
            if (!config.enabled()) continue;
            CollectOutcome outcome = collectNow(config.id());
            if (!outcome.ok()) {
                log.warn("GitHub 源 {} 采集失败：{}", config.repo(), outcome.error());
            }
        }
    }

    /** 手动立即采集（配置页按钮）；返回结果同时回写进配置状态 */
    public CollectOutcome collectNow(String id) {
        SourceConfig config = store.require(id);
        if (!tokenProvider.hasToken()) {
            String error = "未配置 GITHUB_TOKEN——可在本页上方直接粘贴保存，或设环境变量后重启";
            store.markResult(id, false, error, null);
            return new CollectOutcome(false, error);
        }
        if (!"github".equals(config.type())) {
            String error = "暂不支持的源类型：" + config.type();
            store.markResult(id, false, error, null);
            return new CollectOutcome(false, error);
        }
        try {
            String lastDay = collectPoints(config);
            store.markResult(id, true, null, lastDay);
            return new CollectOutcome(true, null);
        } catch (Exception e) {
            String error = readable(e);
            store.markResult(id, false, error, null);
            return new CollectOutcome(false, error);
        }
    }

    /** 拉取并入库；返回新的 lastDay 游标（无更新返回 null 表示维持原值） */
    private String collectPoints(SourceConfig config) throws IOException, InterruptedException {
        List<IngestRequest.Point> points = new ArrayList<>();
        String newLastDay = null;

        if (config.metrics().contains("pages")) {
            for (GithubClient.DailyCount d : client.views(config.repo())) {
                String day = dayOf(d.ts());
                // 只采严格更新的日期：等号意味着当天重采，会被聚合桶二次叠加
                if (config.lastDay() != null && day.compareTo(config.lastDay()) <= 0) continue;
                points.add(point(config, "views", d.count(), d.ts()));
                if (newLastDay == null || day.compareTo(newLastDay) > 0) newLastDay = day;
            }
        }
        if (config.metrics().contains("downloads")) {
            long total = client.downloadsTotal(config.repo());
            long increment = delta(lastTotals.get(config.id()), total);
            lastTotals.put(config.id(), total);
            points.add(point(config, "downloads", increment, alignedNow()));
        }
        if (!points.isEmpty()) {
            service.ingest("github/" + config.repo(), points);
        }
        return newLastDay;
    }

    /** §3.5 映射：endpoint = 指标名，status = 200，totalMs/maxMs = 0 */
    private static IngestRequest.Point point(SourceConfig config, String metric, long count, long ts) {
        return new IngestRequest.Point(metric, "GET", 200, (int) Math.min(count, Integer.MAX_VALUE), 0, 0, ts);
    }

    /** 累计 → 增量：无基线（首采/重启）记 0；累计变小（GitHub 偶发重算）按 0 处理不回吐负数 */
    static long delta(Long lastTotal, long currentTotal) {
        if (lastTotal == null || currentTotal < lastTotal) return 0;
        return currentTotal - lastTotal;
    }

    private static String dayOf(long tsMs) {
        return Instant.ofEpochMilli(tsMs).toString().substring(0, 10);
    }

    private static long alignedNow() {
        return (System.currentTimeMillis() / 60_000L) * 60_000L;
    }

    private static String readable(Exception e) {
        if (e instanceof IOException io && io.getMessage() != null && io.getMessage().contains("401")) {
            return "GitHub 返回 401——检查 GITHUB_TOKEN 是否有效且具有该仓库读取权限";
        }
        if (e instanceof IOException io && io.getMessage() != null && io.getMessage().contains("403")) {
            // traffic 流量接口对 Fine-grained token 存在已知权限限制（文档称 metadata 读即可，实际常 403）
            return "GitHub 返回 403——traffic 接口对 Fine-grained token 常见权限限制：换 classic token（勾 repo scope）可解，或只采 Release 下载量";
        }
        if (e instanceof IOException io && io.getMessage() != null && io.getMessage().contains("404")) {
            return "GitHub 返回 404——仓库不存在或 token 无权访问";
        }
        return "采集失败：" + (e instanceof IOException io && io.getMessage() != null ? io.getMessage() : e.getClass().getSimpleName());
    }
}
