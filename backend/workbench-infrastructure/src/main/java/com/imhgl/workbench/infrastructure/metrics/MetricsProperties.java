package com.imhgl.workbench.infrastructure.metrics;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 时序存储配置（workbench.metrics.*，中性命名；data-dir 经环境变量 METRICS_DATA 覆盖）。
 */
@ConfigurationProperties(prefix = "workbench.metrics")
public record MetricsProperties(
        @DefaultValue("./data/metrics") String dataDir,
        /** 数据保留天数：按天文件粒度清理，同天内的过期分钟不做细粒度删除 */
        @DefaultValue("14") int retentionDays,
        /** 刷盘间隔秒：内存桶快照写 JSONL 的周期，也即宕机时最多丢失的窗口 */
        @DefaultValue("5") int flushIntervalSeconds) {
}
