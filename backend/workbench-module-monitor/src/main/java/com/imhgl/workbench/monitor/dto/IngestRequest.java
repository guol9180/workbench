package com.imhgl.workbench.monitor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * 外部系统流量上报入参：source 为上报方自定义标识（如 nginx、server-a），
 * points 为该来源的一批聚合点。
 */
public record IngestRequest(
        @NotBlank String source,
        @NotEmpty @Valid List<Point> points) {

    /** 单个聚合点：ts 为事件毫秒时间戳（按分钟归桶）；count 与存储侧 TrafficRecord 一致取 int */
    public record Point(
            @NotBlank String endpoint,
            @NotBlank String method,
            int status,
            int count,
            long totalMs,
            long maxMs,
            @NotNull Long ts) {
    }
}
