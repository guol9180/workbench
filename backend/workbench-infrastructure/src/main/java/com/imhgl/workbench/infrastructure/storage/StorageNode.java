package com.imhgl.workbench.infrastructure.storage;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * 存储层中性树节点：仅描述文件系统结构（名称/相对路径/类型），
 * 不携带任何业务语义，由业务模块自行适配为领域模型。
 */
@Getter
@Setter
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
}
