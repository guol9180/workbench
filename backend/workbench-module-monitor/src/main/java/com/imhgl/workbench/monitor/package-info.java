/**
 * 观测域业务模块（规范见 AGENTS.md §6.4）：本系统自监测 + 外部上报枢纽 + 查询
 * + 主动拨测（M15 起）+ GitHub 采集与快照（M16 起）。
 * 对外唯一契约 {@link com.imhgl.workbench.monitor.api.MonitorApi}；查询区间以
 * {@link com.imhgl.workbench.monitor.model.TimeRange} 值对象流转；接口挂 /api/monitor/**。
 */
package com.imhgl.workbench.monitor;
