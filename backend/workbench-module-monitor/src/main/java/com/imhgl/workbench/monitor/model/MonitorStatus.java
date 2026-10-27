package com.imhgl.workbench.monitor.model;

/**
 * 监测域自检快照（/api/monitor/status 出参）：存储规模 + 认证开关 + 背压丢弃计数 + GitHub token 配置状态。
 * 只暴露「是否已配置」布尔位，不回显任何 token 值。
 */
public record MonitorStatus(
        int memoryBuckets,
        int dataFiles,
        boolean authEnabled,
        long droppedEvents,
        boolean githubTokenConfigured) {
}
