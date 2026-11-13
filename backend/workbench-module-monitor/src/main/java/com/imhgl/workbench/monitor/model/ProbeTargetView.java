package com.imhgl.workbench.monitor.model;

/**
 * 拨测目标出参（设置页 / 服务与站点页共用）。
 * 运行状态不在此回写，由 series / recent 按 source=probe/{name} 实时派生。
 */
public record ProbeTargetView(String id, String name, String url, boolean enabled, long createdAt) {
}
