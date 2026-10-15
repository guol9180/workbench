package com.imhgl.workbench.common.exception;

/**
 * 业务异常：领域规则冲突（资源不存在、状态冲突、非法输入等）由业务模块抛出，
 * 经 framework 全局异常处理器统一转为 400 + 语义错误码。
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
