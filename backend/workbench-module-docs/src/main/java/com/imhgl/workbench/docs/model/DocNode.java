package com.imhgl.workbench.docs.model;

import java.util.ArrayList;
import java.util.List;

/**
 * 文件树节点：type 为 "dir" | "file"，children 恒为数组（compact 构造器保证非 null）。
 */
public record DocNode(String name, String path, String type, List<DocNode> children) {

    public DocNode {
        if (children == null) {
            children = new ArrayList<>();
        }
    }

    public DocNode(String name, String path, String type) {
        this(name, path, type, new ArrayList<>());
    }
}
