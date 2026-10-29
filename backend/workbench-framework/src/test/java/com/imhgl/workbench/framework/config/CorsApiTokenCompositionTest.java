package com.imhgl.workbench.framework.config;

import com.imhgl.workbench.framework.auth.AuthController;
import com.imhgl.workbench.framework.auth.LoginService;
import com.imhgl.workbench.framework.filter.AuthFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CorsFilter + AuthFilter 组合契约：这是 401 必须自带 CORS 头的回归测试。
 * CORS 若仍在 MVC 层，Filter 写出的 401 不带 Access-Control-Allow-Origin，
 * 跨域浏览器拦截响应后前端把 locked 误判为 offline（开启认证即死锁的根因）。
 */
class CorsApiTokenCompositionTest {

    private static final String PASSWORD = "secret-password";

    private LoginService loginService;
    private AuthProperties properties;

    private MockMvc mvc() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://workbench.example"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(new CorsFilter(source), new AuthFilter(properties, loginService))
                .build();
    }

    private MockMvc mvcWithAuthController() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://workbench.example"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return MockMvcBuilders.standaloneSetup(new ProbeController(), new AuthController(loginService, properties))
                .addFilters(new CorsFilter(source), new AuthFilter(properties, loginService))
                .build();
    }

    @BeforeEach
    void setUp() {
        properties = new AuthProperties(LoginService.sha256Hex(PASSWORD), "", 1);
        loginService = new LoginService(properties);
    }

    @Test
    @DisplayName("无令牌 401 响应带 Access-Control-Allow-Origin（Filter 层 CORS 的存在意义）")
    void unauthorizedCarriesCorsHeaders() throws Exception {
        mvc().perform(get("/api/probe/hi").header("Origin", "https://workbench.example"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://workbench.example"));
    }

    @Test
    @DisplayName("预检 OPTIONS 放行且带 CORS 头（自定义头 X-API-Token 预检时不携带）")
    void preflightAllowedWithCorsHeaders() throws Exception {
        mvc().perform(options("/api/probe/hi")
                        .header("Origin", "https://workbench.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://workbench.example"));
    }

    @Test
    @DisplayName("来源不在白名单 → 预检拒绝（无 Access-Control-Allow-Origin）")
    void disallowedOriginRejected() throws Exception {
        mvc().perform(options("/api/probe/hi")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("登录端点跨域可达：错误密码 401 带头；正确密码 200 返回会话令牌")
    void loginAcrossOrigins() throws Exception {
        mvcWithAuthController().perform(post("/api/auth/login")
                        .header("Origin", "https://workbench.example")
                        .contentType("application/json")
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://workbench.example"));

        mvcWithAuthController().perform(post("/api/auth/login")
                        .header("Origin", "https://workbench.example")
                        .contentType("application/json")
                        .content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty());
    }

    @RestController
    static class ProbeController {
        @GetMapping("/api/probe/hi")
        public String hi() {
            return "hi";
        }
    }
}
