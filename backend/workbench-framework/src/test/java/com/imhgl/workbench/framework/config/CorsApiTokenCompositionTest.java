package com.imhgl.workbench.framework.config;

import com.imhgl.workbench.framework.filter.ApiTokenFilter;
import org.junit.jupiter.api.DisplayName;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CorsFilter + ApiTokenFilter 组合契约：这是 401 必须自带 CORS 头的回归测试。
 * CORS 若仍在 MVC 层，Filter 写出的 401 不带 Access-Control-Allow-Origin，
 * 跨域浏览器拦截响应后前端把 locked 误判为 offline（开启认证即死锁的根因）。
 */
class CorsApiTokenCompositionTest {

    private MockMvc mvc(String token) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://workbench.example"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(new CorsFilter(source), new ApiTokenFilter(new ApiTokenProperties(token)))
                .build();
    }

    @Test
    @DisplayName("无令牌 401 响应带 Access-Control-Allow-Origin（Filter 层 CORS 的存在意义）")
    void unauthorizedCarriesCorsHeaders() throws Exception {
        mvc("secret").perform(get("/api/probe/hi").header("Origin", "https://workbench.example"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://workbench.example"));
    }

    @Test
    @DisplayName("预检 OPTIONS 放行且带 CORS 头（自定义头 X-API-Token 预检时不携带）")
    void preflightAllowedWithCorsHeaders() throws Exception {
        mvc("secret").perform(options("/api/probe/hi")
                        .header("Origin", "https://workbench.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://workbench.example"));
    }

    @Test
    @DisplayName("来源不在白名单 → 预检拒绝（无 Access-Control-Allow-Origin）")
    void disallowedOriginRejected() throws Exception {
        mvc("secret").perform(options("/api/probe/hi")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @RestController
    static class ProbeController {
        @GetMapping("/api/probe/hi")
        public String hi() {
            return "hi";
        }
    }
}
