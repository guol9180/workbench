package com.imhgl.workbench.framework.filter;

import com.imhgl.workbench.framework.auth.LoginService;
import com.imhgl.workbench.framework.config.AuthProperties;
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
 * 认证过滤器（M9.5 双凭据模型）：`X-API-Token` 为<b>会话令牌</b>（登录签发，内存校验）
 * 或<b>机器令牌</b>（ingest 外部上报静态凭据）任一匹配即放行；否则 401 + 40100。
 * 两凭据皆空 = 认证关闭——本地开发与既有测试零回归的兼容开关（AGENTS.md 1.6）。
 *
 * <p>取舍：
 * <ul>
 *   <li><b>只拦 /api/**</b>：Swagger UI 等非 API 路径天然放行，无需维护放行清单。</li>
 *   <li><b>CORS 预检直通</b>：浏览器预检（OPTIONS）不携带自定义头，拦截会杀死全部跨域部署。</li>
 *   <li><b>机器令牌常量时间比较</b>：用 {@link MessageDigest#isEqual} 而非 equals，
 *       避免逐字节短路返回造成的时序侧信道；会话令牌走内存 Map（256 位随机数，探测时序无从利用）。</li>
 *   <li><b>响应体为静态字符串</b>：拒绝路径不经过消息转换器（过滤器先于 MVC），
 *       直接写定死的 ApiResult JSON 行；CORS 头由先行的 CorsFilter（-150）写入。</li>
 *   <li><b>@Order(-100)</b>：位于自监测过滤器（-200，未认证请求也要计入流量）之后、
 *       业务处理之前。</li>
 * </ul>
 */
@Component
@Order(-100)
public class AuthFilter extends OncePerRequestFilter {

    /** 与 ApiResult.error(UNAUTHORIZED) 的序列化形状逐字一致（message, code, data） */
    private static final String UNAUTHORIZED_BODY =
            "{\"message\":\"未认证\",\"code\":40100,\"data\":null}";
    private static final String HEADER = "X-API-Token";

    private final AuthProperties properties;
    private final LoginService loginService;

    public AuthFilter(AuthProperties properties, LoginService loginService) {
        this.properties = properties;
        this.loginService = loginService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // 无任何凭据配置 = 认证关闭（本地开发默认态）
        if (!properties.enabled()) {
            chain.doFilter(request, response);
            return;
        }
        // 非 API 路径与 CORS 预检直通
        if (!request.getRequestURI().startsWith("/api/")
                || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        // 登录端点直通：login 必须在无凭据时可达（否则拿会话令牌前就死锁）；
        // 其安全性由 LoginService 的失败锁定保障。logout 对未知令牌是无害空操作，一并直通。
        if (request.getRequestURI().startsWith("/api/auth/")) {
            chain.doFilter(request, response);
            return;
        }
        String provided = request.getHeader(HEADER);
        if (provided != null && !provided.isBlank()) {
            // 人类凭据：登录签发的会话令牌
            if (loginService.validateSession(provided)) {
                chain.doFilter(request, response);
                return;
            }
            // 机器凭据：ingest 静态令牌（常量时间比较）
            String machine = properties.machineToken();
            if (!machine.isBlank() && MessageDigest.isEqual(
                    machine.getBytes(StandardCharsets.UTF_8), provided.getBytes(StandardCharsets.UTF_8))) {
                chain.doFilter(request, response);
                return;
            }
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(UNAUTHORIZED_BODY);
    }
}
