package com.imhgl.model;

import java.util.ArrayList;
import java.util.List;

/** 文件树节点，path 为相对文档根目录的相对路径（使用 / 分隔） */
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public List<DocNode> getChildren() {
        return children;
    }

    public void setChildren(List<DocNode> children) {
        this.children = children;
    }
}
