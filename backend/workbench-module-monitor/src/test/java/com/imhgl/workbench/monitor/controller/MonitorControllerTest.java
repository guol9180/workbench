package com.imhgl.workbench.monitor.controller;

import com.imhgl.workbench.framework.handler.GlobalExceptionHandler;
import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 六端点契约：参数绑定/默认值、@Valid 校验 400、ApiResult 包装形状、
 * 非法 range/step 由 api 层抛 IAE 经全局异常处理器映射 400。
 */
class MonitorControllerTest {

    private StubApi api;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        api = new StubApi();
        mvc = MockMvcBuilders.standaloneSetup(new MonitorController(api))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("ingest：合法 payload 200 且透传给 api；缺 source 400 请求参数错误")
    void ingestBindsAndValidates() throws Exception {
        mvc.perform(post("/api/monitor/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"nginx\",\"points\":[{\"endpoint\":\"/up\",\"method\":\"GET\",\"status\":200,\"count\":3,\"totalMs\":30,\"maxMs\":12,\"ts\":1700000000000}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
        assertEquals(1, api.ingestCalls.get());
        assertEquals("nginx", api.lastIngest.source());

        mvc.perform(post("/api/monitor/ingest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"\",\"points\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("请求参数错误"));
    }

    @Test
    @DisplayName("sources：返回来源列表形状")
    void sourcesShape() throws Exception {
        mvc.perform(get("/api/monitor/sources"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].name").value("workbench"))
                .andExpect(jsonPath("$.data[0].lastSeenMinute").value(12345));
    }

    @Test
    @DisplayName("overview：参数绑定（source/range）与出参形状")
    void overviewBindsParams() throws Exception {
        mvc.perform(get("/api/monitor/overview").param("source", "workbench").param("range", "1h"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.count").value(42))
                .andExpect(jsonPath("$.data.rps").value(0.7));
        assertEquals("1h", api.lastRange);
    }

    @Test
    @DisplayName("非法 range → 400 + 具体消息（api 抛 IAE 经全局处理器）")
    void illegalRangeRejected() throws Exception {
        api.throwOnRange = true;
        mvc.perform(get("/api/monitor/overview").param("source", "x").param("range", "3h"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));
    }

    @Test
    @DisplayName("series：metric/range/step 绑定，step 默认 m")
    void seriesBindsWithDefaults() throws Exception {
        mvc.perform(get("/api/monitor/series")
                        .param("source", "workbench").param("metric", "count").param("range", "24h"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].bucketEpoch").value(7))
                .andExpect(jsonPath("$.data[0].value").value(9));
        assertEquals("m", api.lastStep);
    }

    @Test
    @DisplayName("top-endpoints：limit/by 有默认值（10/count）")
    void topEndpointsDefaults() throws Exception {
        mvc.perform(get("/api/monitor/top-endpoints")
                        .param("source", "workbench").param("range", "1h"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].endpoint").value("/api/docs/tree"));
        assertEquals(10, api.lastLimit);
        assertEquals("count", api.lastBy);
    }

    @Test
    @DisplayName("status：自检形状（含认证开关与丢弃计数）")
    void statusShape() throws Exception {
        mvc.perform(get("/api/monitor/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memoryBuckets").value(3))
                .andExpect(jsonPath("$.data.authEnabled").value(false))
                .andExpect(jsonPath("$.data.droppedEvents").value(0));
    }

    /** 记录调用参数的桩 api：不引 Mockito，行为直观可读 */
    static class StubApi implements MonitorApi {
        final AtomicInteger ingestCalls = new AtomicInteger();
        IngestRequest lastIngest;
        String lastRange;
        String lastStep;
        int lastLimit = -1;
        String lastBy;
        boolean throwOnRange;

        @Override
        public void ingest(IngestRequest request) {
            ingestCalls.incrementAndGet();
            lastIngest = request;
        }

        @Override
        public List<SourceStat> sources() {
            return List.of(new SourceStat("workbench", 12345L));
        }

        @Override
        public Overview overview(String source, String range) {
            lastRange = range;
            if (throwOnRange) {
                throw new IllegalArgumentException("非法查询区间：3h（可选 5m/1h/6h/24h/7d）");
            }
            return new Overview(42, 2, 2 / 42.0, 10, 20, 0.7);
        }

        @Override
        public List<SeriesPoint> series(String source, String metric, String range, String step) {
            lastRange = range;
            lastStep = step;
            return List.of(new SeriesPoint(7, 9));
        }

        @Override
        public List<EndpointRank> topEndpoints(String source, String range, int limit, String by) {
            lastRange = range;
            lastLimit = limit;
            lastBy = by;
            return List.of(new EndpointRank("/api/docs/tree", 100, 1, 5, 9));
        }

        @Override
        public MonitorStatus status() {
            return new MonitorStatus(3, 1, false, 0, false, null);
        }

        /* ---------------- 数据源配置（M6）：契约测试见 MonitorSourceConfigApiTest ---------------- */

        @Override
        public List<com.imhgl.workbench.monitor.model.SourceConfigView> sourceConfigs() {
            return List.of();
        }

        @Override
        public String createSourceConfig(com.imhgl.workbench.monitor.dto.SourceConfigRequest request) {
            return "gh-x-y";
        }

        @Override
        public void updateSourceConfig(String id, com.imhgl.workbench.monitor.dto.SourceConfigRequest request) {
        }

        @Override
        public void deleteSourceConfig(String id) {
        }

        @Override
        public com.imhgl.workbench.monitor.model.SourceCollectResult collectSourceConfig(String id) {
            return new com.imhgl.workbench.monitor.model.SourceCollectResult(true, null);
        }

        @Override
        public void setGithubToken(String token) {
        }

        @Override
        public void clearGithubToken() {
        }
    }
}
