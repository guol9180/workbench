package com.imhgl.workbench.infrastructure.metrics;

import java.util.List;

/**
 * 中性流量记录：一个「来源 + 端点 + 方法 + 状态」在某一分钟内的聚合增量。
 * <p>count/totalMs/maxMs 描述该增量；latencySamples 为可选的延迟样本（毫秒），
 * 供分位数（p95）计算——自监测按请求逐条投递，外部上报通常只有聚合值而无样本。
 *
 * @param minute 分钟级 epoch（ts 毫秒 / 60000，存储与查询的最小时间粒度）
 */
public record TrafficRecord(long minute, String source, String endpoint, String method,
                            int status, int count, long totalMs, long maxMs,
                            List<Integer> latencySamples) {

    public TrafficRecord {
        // null 样本归一为空列表，消费方无需判空
        if (latencySamples == null) {
            latencySamples = List.of();
        }
    }
}
