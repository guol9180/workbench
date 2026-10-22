package com.imhgl.workbench.monitor.controller;

import com.imhgl.workbench.common.result.ApiResult;
import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 流量监测模块接口（/api/monitor/**）：只依赖本模块 api 层（MonitorApi），
 * 薄到「接参 → 调 api → 包 ApiResult」；range/step/by 的合法性由 api 层的
 * 值对象校验（非法 → IAE → 全局异常处理器 400）。
 */
@RestController
@RequestMapping("/api/monitor")
public class MonitorController {

    private final MonitorApi monitorApi;

    public MonitorController(MonitorApi monitorApi) {
        this.monitorApi = monitorApi;
    }

    /** 外部系统流量上报（批量聚合点） */
    @PostMapping("/ingest")
    public ApiResult<Void> ingest(@Valid @RequestBody IngestRequest request) {
        monitorApi.ingest(request);
        return ApiResult.ok();
    }

    /** 已知来源列表 + 最近活跃分钟 */
    @GetMapping("/sources")
    public ApiResult<List<SourceStat>> sources() {
        return ApiResult.ok(monitorApi.sources());
    }

    /** 区间总览（range：5m|1h|6h|24h|7d） */
    @GetMapping("/overview")
    public ApiResult<Overview> overview(@RequestParam("source") String source,
                                        @RequestParam("range") String range) {
        return ApiResult.ok(monitorApi.overview(source, range));
    }

    /** 时间序列（metric：count|avgMs|errCount；step：m|h，默认 m） */
    @GetMapping("/series")
    public ApiResult<List<SeriesPoint>> series(@RequestParam("source") String source,
                                               @RequestParam("metric") String metric,
                                               @RequestParam("range") String range,
                                               @RequestParam(value = "step", defaultValue = "m") String step) {
        return ApiResult.ok(monitorApi.series(source, metric, range, step));
    }

    /** 端点排行（by：count|err|avgMs；limit 默认 10） */
    @GetMapping("/top-endpoints")
    public ApiResult<List<EndpointRank>> topEndpoints(@RequestParam("source") String source,
                                                      @RequestParam("range") String range,
                                                      @RequestParam(value = "limit", defaultValue = "10") int limit,
                                                      @RequestParam(value = "by", defaultValue = "count") String by) {
        return ApiResult.ok(monitorApi.topEndpoints(source, range, limit, by));
    }

    /** 监测域自检（桶数/文件数/认证开关/丢弃计数，不回显 token） */
    @GetMapping("/status")
    public ApiResult<MonitorStatus> status() {
        return ApiResult.ok(monitorApi.status());
    }
}
