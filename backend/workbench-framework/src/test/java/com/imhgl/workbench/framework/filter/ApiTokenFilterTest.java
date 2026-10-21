package com.imhgl.workbench.framework.filter;

import com.imhgl.workbench.framework.config.ApiTokenProperties;
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
 * Token 认证过滤器契约：token 空=关闭（旧行为）；仅拦 /api/**；无头/错值 401+40100；
 * 正确值放行；CORS 预检（OPTIONS）不拦——预检请求不携带自定义头，拦了会杀死跨域。
 */
class ApiTokenFilterTest {

    private MockMvc mvc(String token) {
        return MockMvcBuilders.standaloneSetup(new ProbeController())
                .addFilters(new ApiTokenFilter(new ApiTokenProperties(token)))
                .build();
    }

    @Test
    @DisplayName("token 为空 = 认证关闭，/api 请求直接放行（存量行为不变）")
    void blankTokenDisablesAuth() throws Exception {
        mvc("").perform(get("/api/probe/hi")).andExpect(status().isOk());
        mvc(null).perform(get("/api/probe/hi")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("非 /api 路径不受认证影响（Swagger 天然放行）")
    void nonApiPathsBypass() throws Exception {
        mvc("secret").perform(get("/probe/hi")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("无 X-API-Token 头 → 401 + code=40100 + data=null")
    void missingHeaderRejected() throws Exception {
        mvc("secret").perform(get("/api/probe/hi"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40100))
                .andExpect(jsonPath("$.message").value("未认证"))
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @DisplayName("错误 token → 401")
    void wrongTokenRejected() throws Exception {
        mvc("secret").perform(get("/api/probe/hi").header("X-API-Token", "wrong"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正确 token → 放行")
    void correctTokenPasses() throws Exception {
        mvc("secret").perform(get("/api/probe/hi").header("X-API-Token", "secret"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("OPTIONS 请求不拦（CORS 预检；standalone 无法模拟带预检头的场景，由集成测试覆盖）")
    void optionsBypassesAuth() throws Exception {
        mvc("secret").perform(options("/api/probe/hi"))
                .andExpect(status().isOk());
    }

    @RestController
    static class ProbeController {

        @GetMapping({"/probe/hi", "/api/probe/hi"})
        public String hi() {
            return "ok";
        }
    }
}
