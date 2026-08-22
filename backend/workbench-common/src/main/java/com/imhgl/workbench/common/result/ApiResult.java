package com.imhgl.workbench.common.result;

import com.imhgl.workbench.common.exception.ErrorCode;
import lombok.Getter;
import lombok.Setter;

/**
 * 统一 API 响应包装：{message, code, data}。
 * code 为业务码：0 表示成功，非 0 为 ErrorCode 数字码（前端以 code === 0 判断成功）。
 */
@Getter
@Setter
public class ApiResult<T> {

    private String message;
    private int code;
    private T data;

    public static <T> ApiResult<T> ok(T data) {
        ApiResult<T> r = new ApiResult<>();
        r.code = 0;
        r.data = data;
        return r;
    }

    public static ApiResult<Void> ok() {
        return ok(null);
    }

    public static <T> ApiResult<T> error(String message) {
        return error(ErrorCode.BAD_REQUEST, message);
    }

    public static <T> ApiResult<T> error(ErrorCode errorCode) {
        return error(errorCode, errorCode.getDefaultMessage());
    }

    public static <T> ApiResult<T> error(ErrorCode errorCode, String message) {
        ApiResult<T> r = new ApiResult<>();
        r.code = errorCode.getCode();
        r.message = message;
        return r;
    }
}
