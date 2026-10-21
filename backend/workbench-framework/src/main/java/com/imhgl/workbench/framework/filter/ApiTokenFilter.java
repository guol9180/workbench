package com.imhgl.workbench.framework.filter;

import com.imhgl.workbench.framework.config.ApiTokenProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 轻量 Token 认证过滤器：`workbench.auth.token` 非空时校验 {@code /api/**} 请求头
 * {@code X-API-Token}，失败 401 + 40100；空值 = 认证关闭。
 *
 * <p>取舍（为什么这么做）：
 * <ul>
 *   <li><b>只拦 /api/**</b>：Swagger UI 等非 API 路径天然放行，无需维护放行清单。</li>
 *   <li><b>CORS 预检直通</b>：浏览器预检（OPTIONS）不携带自定义头，拦截会杀死全部跨域部署。</li>
 *   <li><b>常量时间比较</b>：用 {@link MessageDigest#isEqual} 而非 equals，
 *       避免逐字节短路返回造成的时序侧信道。</li>
 *   <li><b>响应体为静态字符串</b>：拒绝路径不经过消息转换器（过滤器先于 MVC），
 *       直接写定死的 ApiResult JSON 行，顺带规避过滤器里序列化库的依赖问题。</li>
 *   <li><b>@Order(-100)</b>：位于自监测过滤器（-200，未认证请求也要计入流量）之后、
 *       业务处理之前。</li>
 * </ul>
 */
@Component
@Order(-100)
public class ApiTokenFilter extends OncePerRequestFilter {

    /** 与 ApiResult.error(UNAUTHORIZED) 的序列化形状逐字一致（message, code, data） */
    private static final String UNAUTHORIZED_BODY =
            "{\"message\":\"未认证\",\"code\":40100,\"data\":null}";
    private static final String HEADER = "X-API-Token";

    private final ApiTokenProperties properties;

    public ApiTokenFilter(ApiTokenProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String expected = properties.token();
        // 未配置 = 认证关闭（本地开发默认态）
        if (expected == null || expected.isBlank()) {
            chain.doFilter(request, response);
            return;
        }
        // 非 API 路径与 CORS 预检直通
        if (!request.getRequestURI().startsWith("/api/")
                || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        String provided = request.getHeader(HEADER);
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = provided == null ? new byte[0] : provided.getBytes(StandardCharsets.UTF_8);
        if (MessageDigest.isEqual(a, b)) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(UNAUTHORIZED_BODY);
    }
}
