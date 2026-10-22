/**
 * 流量监测业务模块（规范见 AGENTS.md 3.5）：本系统自监测 + 外部上报枢纽 + 管理查询。
 * 对外唯一契约 {@link com.imhgl.workbench.monitor.api.MonitorApi}；查询区间以
 * {@link com.imhgl.workbench.monitor.model.TimeRange} 值对象流转；接口挂 /api/monitor/**。
 */
package com.imhgl.workbench.monitor;
