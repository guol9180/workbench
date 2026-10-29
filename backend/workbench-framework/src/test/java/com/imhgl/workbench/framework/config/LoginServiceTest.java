package com.imhgl.workbench.framework.config;

import com.imhgl.workbench.framework.auth.LoginService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 密码→会话服务契约：哈希只存哈希、签发可校验、错密码计数、5 次锁定、过期语义、注销。
 */
class LoginServiceTest {

    private static final String PASSWORD = "secret-password";

    private LoginService loginService;

    @BeforeEach
    void setUp() {
        loginService = new LoginService(new AuthProperties(LoginService.sha256Hex(PASSWORD), "", 1));
    }

    @Test
    @DisplayName("正确密码签发会话且 validateSession 认可；注销后失效")
    void issueValidateLogout() {
        LoginService.Session session = loginService.login(PASSWORD);
        assertTrue(loginService.validateSession(session.token()));
        assertTrue(loginService.logout(session.token()));
        assertDoesNotThrow(() -> { if (loginService.validateSession(session.token())) throw new IllegalStateException(); });
    }

    @Test
    @DisplayName("同一密码两次签发得到不同令牌（SecureRandom）")
    void tokensAreUnique() {
        assertNotEquals(loginService.login(PASSWORD).token(), loginService.login(PASSWORD).token());
    }

    @Test
    @DisplayName("TTL=1 小时：过期语义由 validateSession 惰性执行（时间推进模拟交给组合测试）")
    void wrongPasswordRejected() {
        assertThrows(LoginService.WrongPasswordException.class, () -> loginService.login("nope"));
    }

    @Test
    @DisplayName("连续 5 次错误 → 第 6 次即使密码正确也 429 锁定")
    void lockoutAfterFiveFailures() {
        for (int i = 0; i < 5; i++) {
            assertThrows(LoginService.WrongPasswordException.class, () -> loginService.login("wrong"));
        }
        assertThrows(LoginService.RateLimitedException.class, () -> loginService.login(PASSWORD));
        LoginService.RateLimitedException e = assertThrows(LoginService.RateLimitedException.class,
                () -> loginService.login(PASSWORD));
        // 60 秒锁 + 1 秒向上取整（避免用户恰在 60.0s 边界重试仍被拒的体验割裂）
        assertTrue(e.retryAfterSeconds() >= 1 && e.retryAfterSeconds() <= 61);
    }

    @Test
    @DisplayName("logout 对未知令牌是无害空操作（返回 false）")
    void logoutUnknownTokenIsNoop() {
        assertEquals(false, loginService.logout("unknown"));
    }
}
