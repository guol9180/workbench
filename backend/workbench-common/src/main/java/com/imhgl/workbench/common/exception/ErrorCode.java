package com.imhgl.workbench.common.exception;

/**
 * 通用错误码：5 位数字，前三位对应 HTTP 语义（400 参数、404 资源不存在、409 冲突、500 服务器内部错误）。
 * 仅作机器可读的细粒度标识；HTTP 状态由 framework 全局异常处理器统一映射。
 */
public enum ErrorCode {

    PARAM_INVALID(40000, "请求参数错误"),

    NOT_FOUND(40400, "资源不存在"),

    CONFLICT(40900, "资源冲突"),

    INTERNAL_ERROR(50000, "服务器内部错误");

    private final int code;
    private final String defaultMessage;

    ErrorCode(int code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    public int getCode() {
        return code;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
