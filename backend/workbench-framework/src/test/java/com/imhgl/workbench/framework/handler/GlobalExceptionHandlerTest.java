package com.imhgl.workbench.framework.handler;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 全局异常映射契约：业务异常/非法参数→400 语义码；校验/缺参/体不可读→400 请求参数错误；未知→500 不泄漏细节。
 */
class GlobalExceptionHandlerTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("BusinessException → 400 + 语义错误码 + 原始消息")
    void businessExceptionMapsToSemanticCode() throws Exception {
        mvc.perform(get("/probe/business"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40400))
                .andExpect(jsonPath("$.message").value("资源不存在x"));
    }

    @Test
    @DisplayName("IllegalArgumentException → 400 + PARAM_INVALID + 原始消息")
    void illegalArgumentMapsToParamInvalid() throws Exception {
        mvc.perform(get("/probe/illegal"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("非法路径"));
    }

    @Test
    @DisplayName("缺参 → 400 + 请求参数错误")
    void missingParamMapsToBadRequest() throws Exception {
        mvc.perform(get("/probe/param"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("请求参数错误"));
    }

    @Test
    @DisplayName("@Valid 校验失败 → 400 + 请求参数错误")
    void validationFailureMapsToBadRequest() throws Exception {
        mvc.perform(post("/probe/valid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(40000))
                .andExpect(jsonPath("$.message").value("请求参数错误"));
    }

    @Test
    @DisplayName("未知路径资源缺失（Spring 6.1+ NoResourceFoundException）→ 404 + NOT_FOUND")
    void missingResourceMapsTo404() throws Exception {
        mvc.perform(get("/probe/noresource"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(40400))
                .andExpect(jsonPath("$.message").value("资源不存在"));
    }

    @Test
    @DisplayName("方法不支持 → 405 + METHOD_NOT_ALLOWED")
    void methodNotSupportedMapsTo405() throws Exception {
        mvc.perform(post("/probe/param").param("q", "x"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value(40500))
                .andExpect(jsonPath("$.message").value("请求方法不支持"));
    }

    @Test
    @DisplayName("未知异常 → 500 + 固定消息，不泄漏原始异常信息")
    void unknownExceptionMapsTo500WithoutLeak() throws Exception {
        mvc.perform(get("/probe/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value(50000))
                .andExpect(jsonPath("$.message").value("服务器内部错误"))
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("boom"))));
    }

    @RestController
    static class ProbeController {

        @GetMapping("/probe/business")
        public String business() {
            throw new BusinessException(ErrorCode.NOT_FOUND, "资源不存在x");
        }

        @GetMapping("/probe/illegal")
        public String illegal() {
            throw new IllegalArgumentException("非法路径");
        }

        @GetMapping("/probe/param")
        public String param(@RequestParam("q") String q) {
            return q;
        }

        @PostMapping("/probe/valid")
        public String valid(@Valid @RequestBody ProbeBody body) {
            return body.name();
        }

        @GetMapping("/probe/boom")
        public String boom() {
            throw new RuntimeException("boom");
        }

        /** 模拟真实链路：未匹配路径由静态资源处理抛 NoResourceFoundException（Spring 6.1+） */
        @GetMapping("/probe/noresource")
        public String noResource() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "/probe/noresource", "");
        }
    }

    record ProbeBody(@NotBlank String name) {
    }
}
