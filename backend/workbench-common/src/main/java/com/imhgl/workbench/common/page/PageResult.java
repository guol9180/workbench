package com.imhgl.workbench.common.page;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * 通用分页返回：{list, total, page, size, pages}。
 * 与 PageQuery 配对使用：of(当前页数据, 总条数, 查询参数)。
 */
@Getter
@Setter
public class PageResult<T> {

    private List<T> list;
    private long total;
    private int page;
    private int size;
    private long pages;

    public static <T> PageResult<T> of(List<T> list, long total, PageQuery query) {
        PageResult<T> r = new PageResult<>();
        r.list = list;
        r.total = total;
        r.page = query.getPage();
        r.size = query.getSize();
        r.pages = query.getSize() == 0 ? 0 : (total + query.getSize() - 1) / query.getSize();
        return r;
    }

    public static <T> PageResult<T> empty(PageQuery query) {
        return of(List.of(), 0, query);
    }
}
