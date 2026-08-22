package com.imhgl.workbench.infrastructure.mybatis;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.imhgl.workbench.common.page.PageResult;

/**
 * MyBatis-Plus 分页结果适配：IPage → 通用 PageResult。
 * 业务模块用法：Pages.toResult(mapper.selectPage(new Page<>(q.getPage(), q.getSize()), wrapper))
 */
public final class Pages {

    private Pages() {
    }

    public static <T> PageResult<T> toResult(IPage<T> page) {
        PageResult<T> r = new PageResult<>();
        r.setList(page.getRecords());
        r.setTotal(page.getTotal());
        r.setPage((int) page.getCurrent());
        r.setSize((int) page.getSize());
        r.setPages(page.getPages());
        return r;
    }
}
