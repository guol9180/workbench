package com.imhgl.workbench.infrastructure.storage;

import java.util.ArrayList;
import java.util.List;

/**
 * 中性文件树节点：技术设施只产出中性模型，业务语义由业务模块的 api 实现层适配。
 */
public record StorageNode(String name, String path, String type, List<StorageNode> children) {

    public StorageNode {
        if (children == null) {
            children = new ArrayList<>();
        }
    }

    public StorageNode(String name, String path, String type) {
        this(name, path, type, new ArrayList<>());
    }
}
