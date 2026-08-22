package com.imhgl.workbench.docs.model;

import lombok.Getter;
import lombok.Setter;

/** 搜索命中 */
@Getter
@Setter
public class SearchHit {

    private String path;
    private String snippet;

    public SearchHit() {
    }

    public SearchHit(String path, String snippet) {
        this.path = path;
        this.snippet = snippet;
    }
}
