package com.imhgl.workbench.docs.model;

/** 创建 / 保存文档请求体 */
public class SaveRequest {

    private String path;
    private String content;

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
