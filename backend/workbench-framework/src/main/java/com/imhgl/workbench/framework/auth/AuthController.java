package com.imhgl.workbench.framework.auth;

import com.imhgl.workbench.framework.web.ApiResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 认证端点（/api/auth/**）：密码登录签发无状态 token。认证整体属于框架能力，
 * 端点与拦截器、TokenService 同处本模块，自包含、不依赖任何业务模块。
 * 登出由前端删除本地 token 完成（无状态 token 无需服务端注销）。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthProperties properties;
    private final TokenService tokenService;

    public AuthController(AuthProperties properties, TokenService tokenService) {
        this.properties = properties;
        this.tokenService = tokenService;
    }

    @PostMapping("/login")
    public ApiResult<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String password = body.get("password");
        if (password == null || !password.equals(properties.getPassword())) {
            return ApiResult.error("密码错误");
        }
        return ApiResult.ok(Map.of(
                "token", tokenService.issue(),
                "expiresInSeconds", properties.getTokenTtl().toSeconds()
        ));
    }

    @GetMapping("/status")
    public ApiResult<Map<String, Object>> status(
            @RequestHeader(value = AuthInterceptor.TOKEN_HEADER, required = false) String authorization) {
        String token = null;
        if (authorization != null && authorization.startsWith("Bearer ")) {
            token = authorization.substring("Bearer ".length()).trim();
        }
        boolean authed = token != null && tokenService.verify(token);
        return ApiResult.ok(Map.of("authed", authed));
    }
}
