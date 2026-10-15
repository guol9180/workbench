package com.imhgl.workbench.common.result;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * ApiResult / ErrorCode / BusinessException 契约测试。
 */
class ApiResultTest {

    @Test
    @DisplayName("ok(data)：code=0 且数据透传")
    void okWithDataPassesThrough() {
        ApiResult<String> r = ApiResult.ok("hello");
        assertEquals(0, r.code());
        assertEquals("hello", r.data());
    }

    @Test
    @DisplayName("ok()：code=0 且 data 为 null")
    void okWithoutDataIsNull() {
        ApiResult<Void> r = ApiResult.ok();
        assertEquals(0, r.code());
        assertNull(r.data());
    }

    @Test
    @DisplayName("error(code, message)：语义码 + 自定义消息 + data=null")
    void errorCarriesCodeAndMessage() {
        ApiResult<Void> r = ApiResult.error(ErrorCode.NOT_FOUND, "x");
        assertEquals(40400, r.code());
        assertEquals("x", r.message());
        assertNull(r.data());
    }

    @Test
    @DisplayName("error(code)：缺省消息取枚举默认值")
    void errorUsesDefaultMessage() {
        ApiResult<Void> r = ApiResult.error(ErrorCode.CONFLICT);
        assertEquals(40900, r.code());
        assertEquals("资源冲突", r.message());
    }

    @Test
    @DisplayName("BusinessException：携带错误码与消息")
    void businessExceptionCarriesCode() {
        BusinessException e = new BusinessException(ErrorCode.NOT_FOUND, "y");
        assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
        assertEquals("y", e.getMessage());
    }
}
