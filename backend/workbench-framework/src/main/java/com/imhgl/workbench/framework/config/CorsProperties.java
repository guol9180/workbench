package com.imhgl.workbench.framework.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * CORS 配置（workbench.cors.*）：允许的前端来源，逗号分隔环境变量 CORS_ALLOWED_ORIGINS。
 */
@ConfigurationProperties(prefix = "workbench.cors")
public record CorsProperties(
        @DefaultValue("*") List<String> allowedOrigins) {
}
