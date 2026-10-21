package com.imhgl.workbench.infrastructure.metrics;

/**
 * 区间总览。avgMs 为整数截断（totalMs/count）；p95 来自延迟样本分位，
 * 无样本时回退 maxMs（外部聚合上报通常只有极值可用，宁可高估不可低估感知）。
 */
public record Overview(long count, long errCount, double errRate, long avgMs, long p95Ms, double rps) {
}
