package com.imhgl.workbench.infrastructure.metrics;

/** 序列点：bucketEpoch 为分钟值（小时步长时已整小时对齐）。 */
public record SeriesPoint(long bucketEpoch, long value) {
}
