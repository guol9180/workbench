package com.imhgl.workbench.monitor.service;

import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.MetricsProperties;
import com.imhgl.workbench.infrastructure.metrics.JsonlTimeSeriesStore;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.infrastructure.metrics.StoreStatus;
import com.imhgl.workbench.infrastructure.metrics.TimeSeriesStore;
import com.imhgl.workbench.infrastructure.metrics.TrafficRecord;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 自监测过滤器：路径归一化矩阵、异步投递不阻塞业务、有界队列背压丢弃计数。
 */
class TrafficRecordFilterTest {

    private static final long ANY_MIN = Long.MAX_VALUE / 60_000L;

    @Test
    @DisplayName("路径归一化：数字段 {n}、UUID 段 {u}、普通路径原样")
    void normalizesPathSegments() {
        assertEquals("/api/docs/file", TrafficRecordFilter.normalize("/api/docs/file"));
        assertEquals("/api/users/{n}", TrafficRecordFilter.normalize("/api/users/123"));
        assertEquals("/api/users/{n}/posts/{n}", TrafficRecordFilter.normalize("/api/users/42/posts/007"));
        assertEquals("/api/u/{u}", TrafficRecordFilter.normalize(
                "/api/u/3f2504e0-4f89-11d3-9a0c-0305e82c3301"));
        assertEquals("/api/mix/{n}/{u}", TrafficRecordFilter.normalize(
                "/api/mix/99/3F2504E0-4F89-11D3-9A0C-0305E82C3301"));
        assertEquals("/", TrafficRecordFilter.normalize("/"));
    }

    @Test
    @DisplayName("异步投递：请求完成后记录经后台线程进入存储，路径已归一化")
    void recordsAfterCompletion(@TempDir Path dir) throws Exception {
        try (JsonlTimeSeriesStore store = new JsonlTimeSeriesStore(
                new MetricsProperties(dir.toString(), 14, 5))) {
            MonitorService service = new MonitorService(store);
            MockMvc mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                    .addFilters(new TrafficRecordFilter(service))
                    .build();

            mvc.perform(get("/api/users/123")).andExpect(status().isOk());
            mvc.perform(get("/probe/hi")).andExpect(status().isOk()); // 非 /api 不记录

            long deadline = System.currentTimeMillis() + 5_000;
            while (store.overview(MonitorService.SELF_SOURCE, 0, ANY_MIN).count() < 1
                    && System.currentTimeMillis() < deadline) {
                Thread.sleep(20);
            }
            Overview o = store.overview(MonitorService.SELF_SOURCE, 0, ANY_MIN);
            assertEquals(1, o.count(), "只记录 /api 请求");
            assertTrue(store.topEndpoints(MonitorService.SELF_SOURCE, 0, ANY_MIN, 10, "count")
                    .get(0).endpoint().equals("/api/users/{n}"), "端点应为归一化路径");
        }
    }

    @Test
    @DisplayName("背压：worker 阻塞 + 队列打满后丢弃计数，请求响应不受影响")
    void dropsWhenQueueFull(@TempDir Path dir) throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        BlockingStore blockingStore = new BlockingStore(entered, release, dir);
        MonitorService service = new MonitorService(blockingStore);
        TrafficRecordFilter filter = new TrafficRecordFilter(service, 2); // 容量 2：1 条被 worker 取走 + 2 条排队
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(filter)
                .build();

        mvc.perform(get("/api/a")).andExpect(status().isOk());   // worker 取走后在 append 里阻塞
        assertTrue(entered.await(5, java.util.concurrent.TimeUnit.SECONDS), "worker 应已进入 append");
        mvc.perform(get("/api/b")).andExpect(status().isOk());   // 排队 1
        mvc.perform(get("/api/c")).andExpect(status().isOk());   // 排队 2（队列满）
        mvc.perform(get("/api/d")).andExpect(status().isOk());   // 丢弃 → dropped+1

        assertEquals(1, service.droppedEvents(), "恰好丢弃 1 条");
        release.countDown();
        filter.shutdown();
    }

    /** append 阻塞的探针存储：验证消费端卡住时过滤器仍不阻塞业务线程 */
    static class BlockingStore implements TimeSeriesStore {
        private final CountDownLatch entered;
        private final CountDownLatch release;
        private final JsonlTimeSeriesStore delegate;

        BlockingStore(CountDownLatch entered, CountDownLatch release, Path dir) {
            this.entered = entered;
            this.release = release;
            this.delegate = new JsonlTimeSeriesStore(new MetricsProperties(dir.toString(), 14, 5));
        }

        @Override
        public void append(TrafficRecord record) {
            entered.countDown();
            try {
                release.await();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        @Override
        public List<SourceStat> sources() {
            return delegate.sources();
        }

        @Override
        public Overview overview(String source, long fromMinute, long toMinute) {
            return delegate.overview(source, fromMinute, toMinute);
        }

        @Override
        public List<SeriesPoint> series(String source, String metric, long fromMinute, long toMinute,
                                        String endpointFilter, boolean hourly) {
            return delegate.series(source, metric, fromMinute, toMinute, null, hourly);
        }

        @Override
        public List<EndpointRank> topEndpoints(String source, long fromMinute, long toMinute, int limit, String by) {
            return delegate.topEndpoints(source, fromMinute, toMinute, limit, by);
        }

        @Override
        public void flush() {
            delegate.flush();
        }

        @Override
        public StoreStatus status() {
            return delegate.status();
        }

        @Override
        public void close() {
            delegate.close();
        }
    }

    @RestController
    static class ProbeController {

        @GetMapping({"/probe/hi", "/api/users/123", "/api/a", "/api/b", "/api/c", "/api/d"})
        public String hi() {
            return "ok";
        }
    }
}
