/**
 * 技术设施（规范见 AGENTS.md §6.3）：中性 JSONL 时序存储。
 * 契约 {@link com.imhgl.workbench.infrastructure.metrics.TimeSeriesStore}，
 * 实现 {@link com.imhgl.workbench.infrastructure.metrics.JsonlTimeSeriesStore}：
 * 分钟聚合桶 + 按天刷盘 + 启动重放 + 保留清理。
 * 只产出中性模型（TrafficRecord 与查询模型）与中性配置（workbench.metrics.*），
 * 禁止业务色彩命名与业务规则。
 */
package com.imhgl.workbench.infrastructure;
