package com.imhgl.workbench.monitor.model;

/**
 * 监测域自检快照（/api/monitor/status 出参）：存储规模 + 认证开关 + 背压丢弃计数。
 * 不回显 token 值本身。
 */
public record MonitorStatus(int memoryBuckets, int dataFiles, boolean authEnabled, long droppedEvents) {
}
