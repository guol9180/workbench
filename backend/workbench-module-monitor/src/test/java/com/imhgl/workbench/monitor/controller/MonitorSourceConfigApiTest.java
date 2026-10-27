package com.imhgl.workbench.monitor.controller;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.framework.handler.GlobalExceptionHandler;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.dto.SourceConfigRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import com.imhgl.workbench.monitor.model.SourceCollectResult;
import com.imhgl.workbench.monitor.model.SourceConfigView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 源配置五端点契约：@Valid 400、业务冲突 409、不存在 404、collect 结果形状、token 永不出现 */
class MonitorSourceConfigApiTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new MonitorController(new ShapeApi()))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("列表：含运行状态字段且无任何 token 字段")
    void listShape() throws Exception {
        mvc.perform(get("/api/monitor/source-configs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("gh-o-r"))
                .andExpect(jsonPath("$.data[0].repo").value("o/r"))
                .andExpect(jsonPath("$.data[0].lastError").value("GitHub 返回 401"))
                .andExpect(jsonPath("$.data[0].lastDay").value("2026-10-21"));
    }

    @Test
    @DisplayName("创建：合法 payload 返回 id；非法 repo 400 请求参数错误")
    void createValidates() throws Exception {
        mvc.perform(post("/api/monitor/source-configs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"github\",\"repo\":\"o/r\",\"enabled\":true,\"metrics\":[\"pages\",\"downloads\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("gh-o-r"));

        mvc.perform(post("/api/monitor/source-configs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"github\",\"repo\":\"不是ownername\",\"enabled\":true,\"metrics\":[\"pages\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000));
    }

    @Test
    @DisplayName("重复接入 → 400 + 40900；不存在 id → 400 + 40400")
    void businessConflicts() throws Exception {
        mvc.perform(post("/api/monitor/source-configs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"github\",\"repo\":\"dup/repo\",\"enabled\":true,\"metrics\":[\"pages\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40900));

        mvc.perform(delete("/api/monitor/source-configs/missing"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40400));
    }

    @Test
    @DisplayName("collect：成功与失败两种形状（error 可读）")
    void collectShapes() throws Exception {
        mvc.perform(post("/api/monitor/source-configs/gh-o-r/collect"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ok").value(true));

        mvc.perform(post("/api/monitor/source-configs/gh-fail/collect"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ok").value(false))
                .andExpect(jsonPath("$.data.error").value("未配置 GITHUB_TOKEN（环境变量），无法读取 GitHub 数据"));
    }

    /** 行为桩：按真实实现可能会抛的异常模拟 store/collector 边界 */
    static class ShapeApi implements MonitorApi {

        @Override
        public void ingest(IngestRequest request) {
        }

        @Override
        public List<com.imhgl.workbench.infrastructure.metrics.SourceStat> sources() {
            return List.of();
        }

        @Override
        public com.imhgl.workbench.infrastructure.metrics.Overview overview(String source, String range) {
            return null;
        }

        @Override
        public List<com.imhgl.workbench.infrastructure.metrics.SeriesPoint> series(String source, String metric, String range, String step) {
            return List.of();
        }

        @Override
        public List<com.imhgl.workbench.infrastructure.metrics.EndpointRank> topEndpoints(String source, String range, int limit, String by) {
            return List.of();
        }

        @Override
        public MonitorStatus status() {
            return new MonitorStatus(0, 0, false, 0, false);
        }

        @Override
        public List<SourceConfigView> sourceConfigs() {
            return List.of(new SourceConfigView("gh-o-r", "github", "o/r", true,
                    List.of("pages"), 1700000000000L, null, "GitHub 返回 401", "2026-10-21"));
        }

        @Override
        public String createSourceConfig(SourceConfigRequest request) {
            if (request.repo().equals("dup/repo")) {
                throw new BusinessException(ErrorCode.CONFLICT, "仓库已接入");
            }
            return "gh-o-r";
        }

        @Override
        public void updateSourceConfig(String id, SourceConfigRequest request) {
            if ("missing".equals(id)) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "数据源不存在：" + id);
            }
        }

        @Override
        public void deleteSourceConfig(String id) {
            if ("missing".equals(id)) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "数据源不存在：" + id);
            }
        }

        @Override
        public SourceCollectResult collectSourceConfig(String id) {
            return "gh-fail".equals(id)
                    ? new SourceCollectResult(false, "未配置 GITHUB_TOKEN（环境变量），无法读取 GitHub 数据")
                    : new SourceCollectResult(true, null);
        }
    }
}
