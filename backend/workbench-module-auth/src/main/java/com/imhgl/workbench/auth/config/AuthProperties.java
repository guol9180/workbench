package com.imhgl.workbench.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * 认证配置（workbench.auth.*）。
 * 密码与密钥通过环境变量 APP_PASSWORD / APP_TOKEN_SECRET 覆盖。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "workbench.auth")
public class AuthProperties {

    /** 登录密码 */
    private String password = "workbench123";

    /** Token 签名密钥；为空时启动会生成临时密钥（重启后所有登录失效），生产环境必须配置 */
    private String tokenSecret = "";

    /** Token 有效期 */
    private Duration tokenTtl = Duration.ofDays(30);
}
