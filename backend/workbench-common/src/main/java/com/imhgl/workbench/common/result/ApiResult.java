package com.imhgl.workbench.common.result;

import com.imhgl.workbench.common.exception.ErrorCode;

/**
 * 统一 API 响应包装：{message, code, data}。
 * code 为业务码：0 表示成功，非 0 为 {@link ErrorCode} 数字码（消费方以 code == 0 判断成功）。
 */
public record ApiResult<T>(String message, int code, T data) {

    public static <T> ApiResult<T> ok(T data) {
        return new ApiResult<>(null, 0, data);
    }

    public static ApiResult<Void> ok() {
        return ok(null);
    }

    public static <T> ApiResult<T> error(ErrorCode errorCode, String message) {
        return new ApiResult<>(message, errorCode.getCode(), null);
    }

    public static <T> ApiResult<T> error(ErrorCode errorCode) {
        return error(errorCode, errorCode.getDefaultMessage());
    }
}
