package com.imhgl.workbench.common.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * CORS 基础设施：允许的来源由 workbench.cors.allowed-origins（CORS_ALLOWED_ORIGINS）配置。
 * 认证拦截等安全策略属于组装应用，见 workbench-server 的 ApiSecurityConfig。
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final CorsProperties corsProperties;

    public CorsConfig(CorsProperties corsProperties) {
        this.corsProperties = corsProperties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> origins = corsProperties.getAllowedOrigins();
        if (origins == null || origins.isEmpty()) {
            return;
        }
        String[] arr = origins.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        if (arr.length == 0) {
            return;
        }
        registry.addMapping("/api/**")
                .allowedOriginPatterns(arr)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
