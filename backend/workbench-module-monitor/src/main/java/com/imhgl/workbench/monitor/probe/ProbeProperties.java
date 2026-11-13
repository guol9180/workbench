package com.imhgl.workbench.monitor.probe;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 拨测配置（workbench.probe.*）。
 *
 * @param enabled         是否启用定时调度；false 时只能手工触发（测试 / 排障）
 * @param intervalSeconds 调度间隔（秒），默认 60
 * @param timeoutMs       单目标连接与响应超时（毫秒），默认 5000
 */
@ConfigurationProperties(prefix = "workbench.probe")
public record ProbeProperties(boolean enabled, long intervalSeconds, int timeoutMs) {

    public ProbeProperties {
        if (intervalSeconds <= 0) intervalSeconds = 60;
        if (timeoutMs <= 0) timeoutMs = 5000;
    }
}
