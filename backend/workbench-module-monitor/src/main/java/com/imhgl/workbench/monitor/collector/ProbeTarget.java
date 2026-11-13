package com.imhgl.workbench.monitor.collector;

/**
 * 拨测目标（sources.json 的 probes 区持久化单元）。
 * <p>id 只用于配置操作；时序归属按 source=probe/{name}，改名等于换 source——
 * 历史数据留在旧 source、不迁移（个人量级下比维护重命名映射更简单）。
 * 名称与 URL 的唯一性由 {@link SourceConfigStore} 保证。
 */
public record ProbeTarget(String id, String name, String url, boolean enabled, long createdAt) {
}
