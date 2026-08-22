package com.imhgl.workbench.infrastructure.storage;

import java.util.ArrayList;
import java.util.List;

/**
 * 存储层中性树节点：仅描述文件系统结构（名称/相对路径/类型），
 * 不携带任何业务语义，由业务模块自行适配为领域模型。
 */
public class StorageNode {

    private String name;
    private String path;
    private String type;
    private List<StorageNode> children = new ArrayList<>();

    public StorageNode() {
    }

    public StorageNode(String name, String path, String type) {
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

    public List<StorageNode> getChildren() {
        return children;
    }

    public void setChildren(List<StorageNode> children) {
        this.children = children;
    }
}
