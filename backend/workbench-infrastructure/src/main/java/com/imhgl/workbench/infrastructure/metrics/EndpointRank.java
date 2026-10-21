package com.imhgl.workbench.infrastructure.metrics;

/** 端点排行项：区间内该端点的聚合与延迟分位。 */
public record EndpointRank(String endpoint, long count, long errCount, long avgMs, long p95Ms) {
}
