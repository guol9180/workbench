package com.imhgl.workbench.monitor.model;

/**
 * 手动采集结果（POST source-configs/{id}/collect 出参）。
 * ok=false 时 error 给出可行动的中文原因（token 缺失 / GitHub 401 / 404 等），绝不静默失败。
 */
public record SourceCollectResult(boolean ok, String error) {
}
