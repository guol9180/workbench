package com.imhgl.workbench.docs.model;

import lombok.Getter;
import lombok.Setter;

/** 文档内容 */
@Getter
@Setter
public class DocContent {

    private String path;
    private String name;
    private String content;

    public DocContent() {
    }

    public DocContent(String path, String name, String content) {
        this.path = path;
        this.name = name;
        this.content = content;
    }
}
