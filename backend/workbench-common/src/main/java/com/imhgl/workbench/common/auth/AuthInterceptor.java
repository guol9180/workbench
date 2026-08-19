package com.imhgl.workbench.common.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.imhgl.workbench.common.web.ApiResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;

/**
 * 校验 Authorization: Bearer &lt;token&gt;。前后端分离 + 跨域部署，
 * 不依赖 cookie；token 由前端保存在 localStorage。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String TOKEN_HEADER = "Authorization";

    private final TokenService tokenService;
    private final ObjectMapper objectMapper;

    public AuthInterceptor(TokenService tokenService, ObjectMapper objectMapper) {
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        String header = request.getHeader(TOKEN_HEADER);
        String token = null;
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring("Bearer ".length()).trim();
        }
        if (token != null && tokenService.verify(token)) {
            return true;
        }
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(ApiResult.error("未登录")));
        return false;
    }
}
