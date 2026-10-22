package com.imhgl.workbench.infrastructure.metrics;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * JsonlTimeSeriesStore 契约测试：分钟聚合、序列/排行/总览查询、蓄水池 p95、
 * 并发计数精确、刷盘落文件、重启重放不丢数、保留策略清理。
 */
class JsonlTimeSeriesStoreTest {

    /** 动态时间基（分钟 epoch）：一小时前并对齐到整点——避免 M0+1 撞上小时边界导致偶发翻转（须落在保留期内） */
    private static final long M0 = System.currentTimeMillis() / 60_000L / 60 * 60 - 60;

    private static MetricsProperties props(Path dir) {
        return new MetricsProperties(dir.toString(), 14, 5);
    }

    private static TrafficRecord rec(long minute, String source, String endpoint, String method,
                                     int status, int count, long totalMs, long maxMs, List<Integer> samples) {
        return new TrafficRecord(minute, source, endpoint, method, status, count, totalMs, maxMs, samples);
    }

    @Test
    @DisplayName("分钟聚合：count/errCount 精确，overview 汇总区间内全部桶")
    void minuteAggregationAndOverview(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "workbench", "/api/docs/tree", "GET", 200, 2, 100, 60, List.of(50, 60)));
            store.append(rec(M0, "workbench", "/api/docs/tree", "GET", 500, 1, 40, 40, List.of(40)));
            store.append(rec(M0 + 1, "workbench", "/api/docs/tree", "GET", 200, 3, 150, 70, List.of(40, 50, 60)));
            store.append(rec(M0, "nginx", "/up", "GET", 200, 5, 10, 2, null));

            Overview o = store.overview("workbench", M0, M0 + 1);
            assertEquals(6, o.count());
            assertEquals(1, o.errCount());
            // avg = (100+40+150)/6 = 48.33 → 取整数值 48
            assertEquals(48, o.avgMs());
            // rps = 6 / (2 分钟 × 60 秒) = 0.05
            assertTrue(Math.abs(o.rps() - 0.05) < 1e-9, "rps=" + o.rps());
        }
    }

    @Test
    @DisplayName("p95：有样本按样本分位；无样本回退 maxMs")
    void p95FromSamplesOrMaxFallback(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            // 样本 1..100 → p95 = 95（ceil(0.95*100)=95 位）
            store.append(rec(M0, "a", "/x", "GET", 200, 100, 0, 1,
                    java.util.stream.IntStream.rangeClosed(1, 100).boxed().toList()));
            assertEquals(95, store.overview("a", M0, M0).p95Ms());

            // 外部上报无样本 → 回退 maxMs
            store.append(rec(M0, "b", "/y", "GET", 200, 10, 500, 77, null));
            assertEquals(77, store.overview("b", M0, M0).p95Ms());
        }
    }

    @Test
    @DisplayName("series：分钟步长逐桶、小时步长归并、metric 三选一")
    void seriesMinuteAndHourly(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "s", "/x", "GET", 200, 2, 40, 20, null));
            store.append(rec(M0 + 1, "s", "/x", "GET", 500, 1, 30, 30, null));
            // M0+60 与 M0 同属一小时（UTC）：小时桶应归并 3 次调用
            store.append(rec(M0 + 60, "s", "/x", "GET", 200, 5, 100, 20, null));

            List<SeriesPoint> byMinute = store.series("s", "count", M0, M0 + 1, false);
            assertEquals(2, byMinute.size());
            assertEquals(2, byMinute.get(0).value());
            assertEquals(1, byMinute.get(1).value());

            List<SeriesPoint> hourly = store.series("s", "count", M0, M0 + 60, true);
            assertEquals(2, hourly.size(), "跨两个整点小时");
            assertEquals(3, hourly.get(0).value(), "第一小时归并 M0 与 M0+1");
            assertEquals(5, hourly.get(1).value());

            List<SeriesPoint> errMinute = store.series("s", "errCount", M0, M0 + 1, false);
            assertEquals(1, errMinute.get(1).value());

            List<SeriesPoint> avg = store.series("s", "avgMs", M0, M0, false);
            assertEquals(20, avg.get(0).value(), "avg=40/2=20");
        }
    }

    @Test
    @DisplayName("topEndpoints：按 count / err / avgMs 排序并受 limit 约束")
    void topEndpointsRanking(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "s", "/hot", "GET", 200, 50, 1000, 100, null));
            store.append(rec(M0, "s", "/err-heavy", "GET", 500, 10, 100, 10, null));
            store.append(rec(M0, "s", "/slow", "GET", 200, 5, 5000, 900, null));

            assertEquals("/hot", store.topEndpoints("s", M0, M0, 2, "count").get(0).endpoint());
            assertEquals("/err-heavy", store.topEndpoints("s", M0, M0, 1, "err").get(0).endpoint());
            assertEquals("/slow", store.topEndpoints("s", M0, M0, 1, "avgMs").get(0).endpoint());
            assertEquals(2, store.topEndpoints("s", M0, M0, 2, "count").size(), "limit 生效");
        }
    }

    @Test
    @DisplayName("sources：来源列表含 lastSeen（取最大分钟）")
    void sourcesWithLastSeen(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "workbench", "/x", "GET", 200, 1, 1, 1, null));
            store.append(rec(M0 + 5, "nginx", "/up", "POST", 200, 1, 1, 1, null));
            store.append(rec(M0 + 2, "nginx", "/up2", "GET", 200, 1, 1, 1, null));

            List<SourceStat> sources = store.sources();
            assertEquals(2, sources.size());
            assertEquals(M0 + 5, sources.stream().filter(s -> s.name().equals("nginx"))
                    .findFirst().orElseThrow().lastSeenMinute());
        }
    }

    @Test
    @DisplayName("并发 append：16 线程 × 200 条同桶计数精确为 3200")
    void concurrentAppendIsExact(@TempDir Path dir) throws Exception {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            int threads = 16, perThread = 200;
            ExecutorService pool = Executors.newFixedThreadPool(threads);
            CountDownLatch done = new CountDownLatch(threads);
            for (int t = 0; t < threads; t++) {
                pool.submit(() -> {
                    for (int i = 0; i < perThread; i++) {
                        store.append(rec(M0, "s", "/x", "GET", 200, 1, 5, 5, null));
                    }
                    done.countDown();
                });
            }
            assertTrue(done.await(30, TimeUnit.SECONDS));
            pool.shutdown();
            assertEquals(threads * perThread, store.overview("s", M0, M0).count());
        }
    }

    @Test
    @DisplayName("flush 落盘：生成按天 JSONL 文件且非空；重放后数据不丢")
    void flushPersistsAndReplayRestores(@TempDir Path dir) throws IOException {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "workbench", "/api/docs/tree", "GET", 200, 7, 210, 60, List.of(30, 60)));
            store.flush();

            Path dayFile = dir.resolve("metrics-" + dayOf(M0) + ".jsonl");
            assertTrue(Files.exists(dayFile), "应生成按天文件 " + dayFile);
            assertTrue(Files.size(dayFile) > 0);
        }
        // 重启重放：同目录新实例化后数据仍在
        try (JsonlTimeSeriesStore reborn = new JsonlTimeSeriesStore(props(dir))) {
            Overview o = reborn.overview("workbench", M0, M0);
            assertEquals(7, o.count());
            assertEquals(30, o.avgMs());
        }
    }

    @Test
    @DisplayName("保留策略：启动清理过期天文件与对应内存桶")
    void retentionSweepsExpiredData(@TempDir Path dir) throws IOException {
        // 伪造一份远古数据文件（2020-01-01，远超 14 天保留期）
        Path ancient = dir.resolve("metrics-20200101.jsonl");
        Files.writeString(ancient, "{\"m\":2614848,\"s\":\"old\",\"e\":\"/old\",\"h\":\"GET\",\"c\":9,\"ec\":0,\"t\":9,\"x\":1,\"l\":[]}");

        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "s", "/x", "GET", 200, 1, 1, 1, null));
            store.flush();

            assertFalse(Files.exists(ancient), "过期天文件应在启动时被清理");
            assertEquals(0, store.overview("old", 0, Long.MAX_VALUE / 60000).count(), "过期内存数据不应重放");
            assertEquals(1, store.overview("s", M0, M0).count(), "保留期内数据不受影响");
        }
    }

    @Test
    @DisplayName("status：暴露内存桶数与数据文件数（供 /api/monitor/status）")
    void statusExposesCounts(@TempDir Path dir) {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(props(dir))) {
            store.append(rec(M0, "s", "/x", "GET", 200, 1, 1, 1, null));
            store.append(rec(M0, "s2", "/x", "GET", 200, 1, 1, 1, null));
            store.flush();
            assertEquals(2, store.status().memoryBuckets(), "两个不同 source 的桶");
            assertTrue(store.status().dataFiles() >= 1);
        }
    }

    /** 分钟 epoch → UTC yyyyMMdd（文件名日期，与实现保持一致） */
    private static String dayOf(long minute) {
        return java.time.LocalDate.ofInstant(java.time.Instant.ofEpochMilli(minute * 60_000L),
                java.time.ZoneOffset.UTC).toString().replace("-", "");
    }
}
