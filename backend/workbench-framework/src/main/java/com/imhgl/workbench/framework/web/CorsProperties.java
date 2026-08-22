package com.imhgl.workbench.framework.web;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * CORS 配置（workbench.cors.*），环境变量 CORS_ALLOWED_ORIGINS（逗号分隔）。
 * 默认 * ：认证走 Bearer 头而非 cookie，允许任意来源不会带来 CSRF 风险。
 */
@ConfigurationProperties(prefix = "workbench.cors")
public class CorsProperties {

    private List<String> allowedOrigins = new ArrayList<>();

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }
}
