package com.imhgl.controller;

import com.imhgl.config.DocsProperties;
import com.imhgl.model.ApiResult;
import com.imhgl.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    private final DocsProperties properties;

    public LoginController(DocsProperties properties) {
        this.properties = properties;
    }

    @PostMapping("/login")
    public ApiResult<Void> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String password = body.get("password");
        if (password == null || !password.equals(properties.getPassword())) {
            return ApiResult.error("密码错误");
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(AuthInterceptor.SESSION_KEY, Boolean.TRUE);
        return ApiResult.ok();
    }

    @PostMapping("/logout")
    public ApiResult<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ApiResult.ok();
    }

    @GetMapping("/status")
    public ApiResult<Map<String, Object>> status(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        boolean authed = session != null && Boolean.TRUE.equals(session.getAttribute(AuthInterceptor.SESSION_KEY));
        return ApiResult.ok(Map.of("authed", authed));
    }
}
