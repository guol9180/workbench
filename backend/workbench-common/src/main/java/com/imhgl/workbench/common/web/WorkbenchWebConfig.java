package com.imhgl.workbench.common.web;

import com.imhgl.workbench.common.auth.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Web 基础配置：API 认证拦截 + CORS。
 * 新增功能模块只需使用 /api/&lt;module&gt;/** 前缀即可自动纳入认证保护。
 */
@Configuration
public class WorkbenchWebConfig implements WebMvcConfigurer {

    /** 无需登录即可访问的接口（认证自身 + CORS 预检） */
    private static final List<String> PUBLIC_API_PATHS = List.of(
            "/api/auth/login",
            "/api/auth/status"
    );

    private final AuthInterceptor authInterceptor;
    private final CorsProperties corsProperties;

    public WorkbenchWebConfig(AuthInterceptor authInterceptor, CorsProperties corsProperties) {
        this.authInterceptor = authInterceptor;
        this.corsProperties = corsProperties;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(PUBLIC_API_PATHS);
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
