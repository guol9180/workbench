package com.imhgl.workbench.common.exception;

/**
 * 通用业务异常：业务规则不满足时抛出（资源不存在、状态冲突等），
 * 由 framework 的全局异常处理器统一转 400 + ApiResult（携带错误码）。
 * 与 IllegalArgumentException（参数非法）区分：本异常表达领域规则冲突。
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(String message) {
        this(ErrorCode.BAD_REQUEST, message);
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
