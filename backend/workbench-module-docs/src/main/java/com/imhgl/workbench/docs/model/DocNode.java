package com.imhgl.workbench.docs.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** 文件树节点 */
@Getter
@Setter
public class DocNode {

    private String name;
    private String path;
    private String type; // "dir" | "file"
    private List<DocNode> children = new ArrayList<>();

    public DocNode() {
    }

    public DocNode(String name, String path, String type) {
        this.name = name;
        this.path = path;
        this.type = type;
    }
}
