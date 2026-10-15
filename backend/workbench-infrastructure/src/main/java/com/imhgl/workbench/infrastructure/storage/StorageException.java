package com.imhgl.workbench.infrastructure.storage;

/**
 * 受控存储的状态类异常（中性，不含业务语义）：资源不存在或状态冲突时由 {@link FileTreeStorage} 抛出，
 * 由业务模块的 api 实现层翻译为业务错误码（翻译约定见 AGENTS.md 第 8 节）。
 * <p>非法输入（路径穿越、非法名、白名单外扩展名）不属此类——那些以
 * {@link IllegalArgumentException} 表示，由全局异常处理器映射为 PARAM_INVALID。
 */
public class StorageException extends RuntimeException {

    /** 状态异常的原因分类（中性命名，不预设任何业务含义） */
    public enum Reason {
        /** 目标资源不存在 */
        NOT_FOUND,
        /** 目标已存在或状态不允许该操作 */
        CONFLICT
    }

    private final Reason reason;

    public StorageException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
