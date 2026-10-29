package com.imhgl.workbench.framework.auth;

import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.common.result.ApiResult;
import com.imhgl.workbench.framework.config.AuthProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证端点（/api/auth/**）：密码换会话令牌 + 注销。
 * 属框架认证机制而非业务端点（AGENTS 3.2 修订放行）。
 * 错误映射：密码错误 → 401 + 40100；触发锁定 → 429 + Retry-After 头；未启用密码登录 → 404（不暴露端点存在性）。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank String password) {}

    public record LoginView(String token, long expiresAt) {}

    private final LoginService loginService;
    private final AuthProperties properties;

    public AuthController(LoginService loginService, AuthProperties properties) {
        this.loginService = loginService;
        this.properties = properties;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResult<LoginView>> login(@Valid @RequestBody LoginRequest request) {
        if (!properties.loginEnabled()) {
            return ResponseEntity.status(404).body(ApiResult.error(ErrorCode.NOT_FOUND, "登录未启用"));
        }
        try {
            LoginService.Session session = loginService.login(request.password());
            return ResponseEntity.ok(ApiResult.ok(new LoginView(session.token(), session.expiresAt())));
        } catch (LoginService.WrongPasswordException e) {
            return ResponseEntity.status(401).body(ApiResult.error(ErrorCode.UNAUTHORIZED, "密码不正确——请核对后重试"));
        } catch (LoginService.RateLimitedException e) {
            return ResponseEntity.status(429)
                    .header("Retry-After", String.valueOf(e.retryAfterSeconds()))
                    .body(ApiResult.error(ErrorCode.UNAUTHORIZED, "尝试次数过多，请 " + e.retryAfterSeconds() + " 秒后再试"));
        }
    }

    @PostMapping("/logout")
    public ApiResult<Void> logout(@RequestHeader(value = "X-API-Token", required = false) String token) {
        loginService.logout(token);
        return ApiResult.ok();
    }
}
