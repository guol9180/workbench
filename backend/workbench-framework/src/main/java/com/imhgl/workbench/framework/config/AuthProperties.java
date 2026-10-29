package com.imhgl.workbench.framework.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 认证配置（workbench.auth.*，M9.5 双凭据模型）：
 * <ul>
 *   <li><b>密码哈希</b>（env AUTH_PASSWORD_SHA256）：人类登录用。服务端只存 SHA-256 hex，
 *       配置文件泄露不泄露可用凭据；非空时 /api/auth/login 可用、可签发会话令牌。</li>
 *   <li><b>机器令牌</b>（env API_TOKEN）：外部系统 ingest 上报用（静态 API key 是机器凭据的业界常态，
 *       类比 GitHub PAT）。非空时外部系统可带 X-API-Token 直连。</li>
 * </ul>
 * 两者皆空 = 认证关闭（本地开发默认态）。会话存内存、容器重启即失效——个人工具可接受。
 */
@ConfigurationProperties(prefix = "workbench.auth")
public record AuthProperties(
        @DefaultValue("") String passwordSha256,
        @DefaultValue("") String machineToken,
        @DefaultValue("168") int sessionTtlHours) {

    /** 认证总开关：任一凭据配置即开启 */
    public boolean enabled() {
        return !passwordSha256.isBlank() || !machineToken.isBlank();
    }

    /** 密码登录是否可用（只配机器凭据时 /api/auth/login 不工作） */
    public boolean loginEnabled() {
        return !passwordSha256.isBlank();
    }
}
