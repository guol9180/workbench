package com.imhgl.workbench.framework.web;

import com.imhgl.workbench.framework.auth.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * API 安全策略：/api/** 默认全部需要认证，仅放行认证自身的 /api/auth/**。
 * 新增业务模块只需使用 /api/&lt;module&gt;/** 前缀即可自动纳入认证保护。
 */
@Configuration
public class ApiSecurityConfig implements WebMvcConfigurer {

    /** 无需登录即可访问的接口（认证自身；CORS 预检由拦截器内部放行） */
    private static final String[] PUBLIC_API_PATHS = { "/api/auth/**" };

    private final AuthInterceptor authInterceptor;

    public ApiSecurityConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(PUBLIC_API_PATHS);
    }
}
