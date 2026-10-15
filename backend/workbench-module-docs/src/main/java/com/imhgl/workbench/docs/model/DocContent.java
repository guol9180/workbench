package com.imhgl.workbench.docs.model;

/**
 * 文档内容：path 为归一化相对路径，name 为文件名。
 */
public record DocContent(String path, String name, String content) {
}
