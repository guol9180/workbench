package com.imhgl.workbench.framework.handler;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.common.result.ApiResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常处理：业务异常（BusinessException / IllegalArgumentException）返回 400 + 具体消息与错误码，
 * 其余异常返回 500 并记录日志。各模块 controller 无需自行 try/catch。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 领域规则冲突（资源不存在、状态冲突等），业务模块抛 BusinessException */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResult<Void>> businessError(BusinessException e) {
        return ResponseEntity.badRequest()
                .body(ApiResult.error(e.getErrorCode(), e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResult<Void>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body(ApiResult.error(ErrorCode.BAD_REQUEST, e.getMessage()));
    }

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
    })
    public ResponseEntity<ApiResult<Void>> badRequest(Exception e) {
        return ResponseEntity.badRequest()
                .body(ApiResult.error(ErrorCode.BAD_REQUEST, "请求参数错误"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Void>> serverError(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResult.error(ErrorCode.INTERNAL_ERROR, "服务器内部错误"));
    }
}
