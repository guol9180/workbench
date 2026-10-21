package com.imhgl.workbench.infrastructure.metrics;

/** 来源统计：名称 + 最近一次出现的分钟（心跳语义）。 */
public record SourceStat(String name, long lastSeenMinute) {
}
