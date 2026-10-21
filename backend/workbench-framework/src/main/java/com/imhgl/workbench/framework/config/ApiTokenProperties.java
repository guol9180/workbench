package com.imhgl.workbench.framework.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 认证配置（workbench.auth.*）：单一共享 Token（env API_TOKEN）。
 * <p>token 为空 = 认证关闭——本地开发与既有测试零回归的兼容开关（AGENTS.md 1.6）。
 */
@ConfigurationProperties(prefix = "workbench.auth")
public record ApiTokenProperties(
        @DefaultValue("") String token) {
}
