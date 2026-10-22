package com.imhgl.workbench.monitor.model;

/**
 * 数据源配置出参（配置页列表/详情）。
 * <p>永不包含 token——GitHub PAT 只存在于服务端环境变量；lastOkAt/lastError/lastDay
 * 是采集运行状态，让用户在配置页直接看到「接入是否真的在工作」。
 */
public record SourceConfigView(
        String id,
        String type,
        String repo,
        boolean enabled,
        java.util.List<String> metrics,
        long createdAt,
        Long lastOkAt,
        String lastError,
        String lastDay) {
}
