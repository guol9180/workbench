package com.imhgl.workbench.monitor.collector;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 源采集配置（workbench.sources.*）。
 * <p>token 只从环境变量 GITHUB_TOKEN 注入，不落盘、不回显；cron 默认每天 08:05/20:05 各拉一次
 * （GitHub 流量数据本身是日粒度，更密无意义），配 "-" 可整体关闭定时、只保留配置页手动采集。
 */
@ConfigurationProperties(prefix = "workbench.sources")
public record SourceConfigProperties(
        String file,
        String githubToken,
        String cron) {

    public SourceConfigProperties {
        if (file == null || file.isBlank()) file = "data/sources.json";
        if (githubToken == null) githubToken = "";
        if (cron == null || cron.isBlank()) cron = "0 5 8,20 * * *";
    }

    /** compact 构造后的规范值访问器：避免调用方各自判空 */
    public boolean hasToken() {
        return githubToken != null && !githubToken.isBlank();
    }
}
