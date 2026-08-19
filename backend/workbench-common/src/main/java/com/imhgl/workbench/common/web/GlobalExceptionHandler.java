package com.imhgl.workbench.common.web;

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
 * 全局异常处理：业务异常（IllegalArgumentException）返回 400 + 具体消息，
 * 其余异常返回 500 并记录日志。各模块 controller 无需自行 try/catch。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResult<Void>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(ApiResult.error(e.getMessage()));
    }

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
    })
    public ResponseEntity<ApiResult<Void>> badRequest(Exception e) {
        return ResponseEntity.badRequest().body(ApiResult.error("请求参数错误"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Void>> serverError(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResult.error("服务器内部错误"));
    }
}
