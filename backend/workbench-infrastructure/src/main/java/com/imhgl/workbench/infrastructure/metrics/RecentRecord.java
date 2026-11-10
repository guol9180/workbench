package com.imhgl.workbench.infrastructure.metrics;

/**
 * 最近活动记录（分钟桶粒度的中性视图）：供管理台「运行日志」类界面渲染。
 * <p>与 TrafficRecord 的区别：这是聚合后的桶状态而非单次请求——count 是该分钟该端点的
 * 调用次数，avgMs/maxMs 是桶内近似值。无 msg 语义，消息文案由业务侧自行派生。
 */
public record RecentRecord(
        long minute,
        String source,
        String endpoint,
        String method,
        long count,
        long errCount,
        long avgMs,
        long maxMs) {
}
