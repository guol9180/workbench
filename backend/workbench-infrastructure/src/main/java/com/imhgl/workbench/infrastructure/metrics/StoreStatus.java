package com.imhgl.workbench.infrastructure.metrics;

/** 存储自检快照：内存桶数与数据文件数。 */
public record StoreStatus(int memoryBuckets, int dataFiles) {
}
