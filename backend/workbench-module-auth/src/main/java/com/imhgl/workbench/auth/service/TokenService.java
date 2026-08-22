package com.imhgl.workbench.auth.service;

import com.imhgl.workbench.auth.config.AuthProperties;
import com.imhgl.workbench.framework.token.TokenVerifier;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;

/**
 * 无状态 Token：hex(过期时间) + "." + hex(HmacSHA256(密钥, 过期时间))。
 * 不占用任何服务端内存，重启不掉登录；签名为常数时间比较。
 * 实现 framework 的 TokenVerifier 契约，供登录拦截器调用。
 */
@Service
public class TokenService implements TokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);

    private final AuthProperties properties;
    private byte[] secret;

    public TokenService(AuthProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void init() {
        if (properties.getTokenSecret() == null || properties.getTokenSecret().isBlank()) {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            this.secret = random;
            log.warn("未配置 APP_TOKEN_SECRET，已生成临时密钥（重启后所有登录失效）。生产环境务必通过环境变量配置！");
        } else {
            this.secret = properties.getTokenSecret().getBytes(StandardCharsets.UTF_8);
        }
    }

    /** 签发新 token */
    public String issue() {
        long expiry = System.currentTimeMillis() + properties.getTokenTtl().toMillis();
        String payload = Long.toString(expiry);
        return payload + "." + sign(payload);
    }

    /** 校验 token（格式、签名、有效期） */
    @Override
    public boolean verify(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) {
            return false;
        }
        String payload = token.substring(0, dot);
        String signature = token.substring(dot + 1);
        long expiry;
        try {
            expiry = Long.parseLong(payload);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Instant.ofEpochMilli(expiry).isBefore(Instant.now())) {
            return false;
        }
        byte[] expected = sign(payload).getBytes(StandardCharsets.US_ASCII);
        byte[] actual = signature.getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual);
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.US_ASCII));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                        .append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Token 签名失败", e);
        }
    }
}
