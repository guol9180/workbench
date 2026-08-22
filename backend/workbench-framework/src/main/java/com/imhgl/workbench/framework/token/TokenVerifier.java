package com.imhgl.workbench.framework.token;

/**
 * Token 校验契约：登录拦截器依赖本接口完成请求认证，
 * 具体的签发与校验实现由认证业务模块（workbench-module-auth 的 TokenService）提供。
 */
public interface TokenVerifier {

    /** 校验 token（格式、签名、有效期） */
    boolean verify(String token);
}
