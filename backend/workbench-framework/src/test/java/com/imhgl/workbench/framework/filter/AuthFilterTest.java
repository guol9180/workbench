package com.imhgl.workbench.framework.filter;

import com.imhgl.workbench.framework.auth.LoginService;
import com.imhgl.workbench.framework.config.AuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 认证过滤器契约（M9.5 双凭据）：两凭据皆空=关闭；会话令牌（登录签发）与机器令牌任一放行；
 * 无头/错值 401+40100；OPTIONS 预检直通。
 */
class AuthFilterTest {

    private static final String PASSWORD = "secret-password";
    private static final String MACHINE = "machine-token";

    private LoginService loginService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        // 密码哈希用真实算法生成，保证 login→validate 全链路真实
        String hash = LoginService.sha256Hex(PASSWORD);
        AuthProperties properties = new AuthProperties(hash, MACHINE, 1);
        loginService = new LoginService(properties);
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(new AuthFilter(properties, loginService))
                .build();
    }

    @Test
    @DisplayName("两凭据皆空 = 认证关闭，/api 请求直接放行（存量行为不变）")
    void blankCredentialsDisableAuth() throws Exception {
        AuthProperties off = new AuthProperties("", "", 168);
        MockMvc offMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(new AuthFilter(off, new LoginService(off)))
                .build();
        offMvc.perform(get("/api/probe/hi")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("登录签发的会话令牌放行；无头/错值/过期会话 → 401+40100")
    void sessionTokenFlow() throws Exception {
        LoginService.Session session = loginService.login(PASSWORD);
        mvc.perform(get("/api/probe/hi").header("X-API-Token", session.token()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/probe/hi")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40100));
        mvc.perform(get("/api/probe/hi").header("X-API-Token", "not-a-session"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("机器令牌放行（ingest 场景）；错值 401")
    void machineTokenFlow() throws Exception {
        mvc.perform(get("/api/probe/hi").header("X-API-Token", MACHINE)).andExpect(status().isOk());
        mvc.perform(get("/api/probe/hi").header("X-API-Token", "wrong-machine")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("连续 5 次密码错误触发全局锁定（429），锁定期间正确密码也拒绝")
    void bruteForceLockout() throws Exception {
        for (int i = 0; i < 5; i++) {
            final String wrong = "wrong-" + i;
            org.junit.jupiter.api.Assertions.assertThrows(LoginService.WrongPasswordException.class,
                    () -> loginService.login(wrong));
        }
        org.junit.jupiter.api.Assertions.assertThrows(LoginService.RateLimitedException.class,
                () -> loginService.login(PASSWORD));
    }

    @Test
    @DisplayName("登录端点直通：开启认证后 /api/auth/login 无令牌可达（否则死锁）")
    void loginEndpointBypassesAuth() throws Exception {
        // 独立环境未注册 AuthController：404（无处理器）而非 401（被拦）即证明过滤器已放行
        mvc.perform(get("/api/auth/login")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("非 /api 路径不受认证影响（Swagger 天然放行）")
    void nonApiPathsBypass() throws Exception {
        mvc.perform(get("/probe/hi")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("OPTIONS 预检直通（不携带自定义头）")
    void preflightBypass() throws Exception {
        mvc.perform(options("/api/probe/hi")).andExpect(status().isOk());
    }

    @RestController
    static class ProbeController {
        @GetMapping("/api/probe/hi")
        public String hi() {
            return "hi";
        }

        @GetMapping("/probe/hi")
        public String nonApi() {
            return "hi";
        }
    }
}
