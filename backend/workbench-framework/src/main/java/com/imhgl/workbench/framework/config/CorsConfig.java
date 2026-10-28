package com.imhgl.workbench.framework.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * 全局 CORS（workbench.cors.*）：/api/** 按配置放行来源；接口无会话状态（无 Cookie），
 * allowCredentials 恒为 false。
 *
 * <p>取舍——为什么放 Filter 层而非 WebMvcConfigurer#addCorsMappings（MVC 层）：
 * {@code ApiTokenFilter} 在 Filter 层直接写出 401，不经过 MVC；MVC 层 CORS 管不到它，
 * 跨域部署下无 Access-Control-Allow-Origin 的 401 会被浏览器按 CORS 失败拦截，
 * 前端把「需要令牌」误判成「后端离线」。CorsFilter 注册在 ApiTokenFilter 之前，
 * 无论是放行的 200 还是拒绝的 401，响应都先带上 CORS 头。
 */
@Configuration
public class CorsConfig {

    /** 先于 ApiTokenFilter（@Order(-100)）：401 响应产生前 CORS 头已就位 */
    static final int CORS_FILTER_ORDER = -150;

    private final CorsProperties properties;

    public CorsConfig(CorsProperties properties) {
        this.properties = properties;
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(properties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        // X-API-Token 是自定义头：放行任意请求头，预检才能携带它
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        FilterRegistrationBean<CorsFilter> registration = new FilterRegistrationBean<>(new CorsFilter(source));
        registration.addUrlPatterns("/api/*");
        registration.setOrder(CORS_FILTER_ORDER);
        return registration;
    }
}
