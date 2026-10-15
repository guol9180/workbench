package com.imhgl.workbench.framework.handler;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.common.result.ApiResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 全局异常处理：业务异常返回 400 + 语义错误码与具体消息；参数校验类错误返回 400 + 请求参数错误；
 * 未知路径返回真实 404、方法不支持返回真实 405（不能被兜底吞成 500——调用方要能区分「找不到」与「服务坏了」，
 * 否则扫描器探测会把 ERROR 日志刷屏）；其余异常返回 500 固定消息（不泄漏堆栈与异常类名）并记录日志。
 * 各模块 controller 无需自行 try/catch。
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

    /** 非法输入（路径穿越、非法名、白名单外扩展名等），统一按参数错误处理 */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResult<Void>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body(ApiResult.error(ErrorCode.PARAM_INVALID, e.getMessage()));
    }

    /** 未知路径（Spring 6.1+ 由静态资源链路抛出），必须给真实 404 而非兜底 500 */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResult<Void>> notFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResult.error(ErrorCode.NOT_FOUND));
    }

    /** 路径存在但 HTTP 方法不符 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResult<Void>> methodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResult.error(ErrorCode.METHOD_NOT_ALLOWED));
    }

    /** 校验失败 / 缺参 / 类型不符 / 请求体不可读：调用方输入问题，不给具体内部细节 */
    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
    })
    public ResponseEntity<ApiResult<Void>> badRequest(Exception e) {
        return ResponseEntity.badRequest()
                .body(ApiResult.error(ErrorCode.PARAM_INVALID, "请求参数错误"));
    }

    /** 兜底：真正意外的问题才到 500；固定消息防止泄漏内部实现 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Void>> serverError(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResult.error(ErrorCode.INTERNAL_ERROR, "服务器内部错误"));
    }
}
