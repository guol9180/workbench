package com.imhgl.workbench.common.page;

import lombok.Getter;

/**
 * 通用分页请求参数：page 从 1 起，size 夹在 [1, 100]。
 * controller 用 of(...) 归一化前端入参，避免各业务模块重复校验。
 */
@Getter
public class PageQuery {

    /** 单页条数上限，防止一次拉取过多数据 */
    public static final int MAX_SIZE = 100;

    private static final int DEFAULT_SIZE = 10;

    private final int page;
    private final int size;

    private PageQuery(int page, int size) {
        this.page = page;
        this.size = size;
    }

    /** 归一化构造：null / 越界值回退默认（page=1，size=10） */
    public static PageQuery of(Integer page, Integer size) {
        int p = page == null ? 1 : Math.max(1, page);
        int s = size == null ? DEFAULT_SIZE : Math.min(Math.max(1, size), MAX_SIZE);
        return new PageQuery(p, s);
    }

    /** 跳过条数，供存储 / 查询层直接使用 */
    public long getOffset() {
        return (long) (page - 1) * size;
    }
}
