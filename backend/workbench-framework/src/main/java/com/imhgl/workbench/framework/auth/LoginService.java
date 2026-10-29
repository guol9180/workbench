package com.imhgl.workbench.framework.auth;

import com.imhgl.workbench.framework.config.AuthProperties;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 密码→会话认证服务：服务端只存密码哈希；登录成功签发随机会话令牌（内存态、可过期）。
 *
 * <p>安全取舍：
 * <ul>
 *   <li><b>常量时间比较</b>：哈希比对用 {@link MessageDigest#isEqual}，防时序侧信道。</li>
 *   <li><b>全局失败锁定</b>：连续 {@value #MAX_FAILURES} 次失败锁 {@value #LOCK_DURATION}——
 *       Caddy 反代后取不到真实 IP，单用户场景全局桶比按 IP 更可靠。</li>
 *   <li><b>会话存内存</b>：容器重启全部失效、重新输密码即可——个人工具不值得引入持久化会话表。</li>
 *   <li><b>会话校验不做常量时间处理</b>：令牌是 256 位随机数，HashMap 探测时序无从利用。</li>
 * </ul>
 */
@Service
public class LoginService {

    /** 登录结果：会话令牌 + 过期时间（epoch ms） */
    public record Session(String token, long expiresAt) {}

    /** 密码错误（HTTP 401 语义） */
    public static final class WrongPasswordException extends RuntimeException {
        public static final WrongPasswordException INSTANCE = new WrongPasswordException();
    }

    /** 触发失败锁定（HTTP 429 语义），携带解封秒数 */
    public static final class RateLimitedException extends RuntimeException {
        private final long retryAfterSeconds;

        public RateLimitedException(long retryAfterSeconds) {
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public long retryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    /** 密码登录未启用（只配了机器凭据，HTTP 404 语义——不暴露端点存在性） */
    public static final class LoginDisabledException extends RuntimeException {
        public static final LoginDisabledException INSTANCE = new LoginDisabledException();
    }

    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK_DURATION = Duration.ofSeconds(60);
    private static final String HEX = "0123456789abcdef";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AuthProperties properties;
    private final Map<String, Instant> sessions = new ConcurrentHashMap<>();
    private final Object loginGate = new Object();
    private int failures;
    private Instant lockUntil = Instant.MIN;

    public LoginService(AuthProperties properties) {
        this.properties = properties;
    }

    /** 密码换会话。失败锁定期间直接拒绝；成功清除失败计数并签发新会话。 */
    public Session login(String password) {
        synchronized (loginGate) {
            Instant now = Instant.now();
            if (now.isBefore(lockUntil)) {
                throw new RateLimitedException(Duration.between(now, lockUntil).toSeconds() + 1);
            }
            String hash = sha256Hex(password == null ? "" : password);
            if (!constantTimeEquals(hash, properties.passwordSha256().trim().toLowerCase())) {
                failures++;
                if (failures >= MAX_FAILURES) {
                    lockUntil = now.plus(LOCK_DURATION);
                    failures = 0;
                }
                throw WrongPasswordException.INSTANCE;
            }
            failures = 0;
            pruneExpired(now);
            String token = randomHex(32);
            Instant expiresAt = now.plus(Duration.ofHours(properties.sessionTtlHours()));
            sessions.put(token, expiresAt);
            return new Session(token, expiresAt.toEpochMilli());
        }
    }

    /** 会话令牌校验：存在且未过期（过期即惰性移除） */
    public boolean validateSession(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        Instant expiresAt = sessions.get(token);
        if (expiresAt == null) {
            return false;
        }
        if (Instant.now().isAfter(expiresAt)) {
            sessions.remove(token);
            return false;
        }
        return true;
    }

    /** 注销：移除会话，返回是否确实存在过 */
    public boolean logout(String token) {
        return token != null && sessions.remove(token) != null;
    }

    private void pruneExpired(Instant now) {
        sessions.entrySet().removeIf(e -> now.isAfter(e.getValue()));
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    /** 密码 → SHA-256 hex（小写）。公开给运维/测试：生成 AUTH_PASSWORD_SHA256 配置值 */
    public static String sha256Hex(String input) {
        try {
            return hex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e); // JRE 必带，理论不可达
        }
    }

    private static String randomHex(int byteCount) {
        byte[] raw = new byte[byteCount];
        RANDOM.nextBytes(raw);
        return hex(raw);
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(HEX.charAt((b & 0xF0) >> 4)).append(HEX.charAt(b & 0x0F));
        }
        return sb.toString();
    }
}
