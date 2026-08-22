package com.imhgl.workbench.auth.dto;

import lombok.Getter;
import lombok.Setter;

/** 登录请求体 */
@Getter
@Setter
public class LoginRequest {

    /** 登录密码 */
    private String password;
}
