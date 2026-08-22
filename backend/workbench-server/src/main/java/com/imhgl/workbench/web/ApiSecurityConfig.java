package com.imhgl.workbench.web;

import com.imhgl.workbench.common.auth.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * API 安全策略：哪些路径需要认证、哪些公开。
 * 机制（token 校验）在 workbench-common，策略随组装应用走——
 * 与本模块 AuthController 的公开端点同处一处，白名单不再散落两个模块。
 * 新增功能模块只需使用 /api/&lt;module&gt;/** 前缀即可自动纳入认证保护。
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
