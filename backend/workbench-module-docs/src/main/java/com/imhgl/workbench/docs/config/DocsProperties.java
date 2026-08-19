package com.imhgl.workbench.docs.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 在线文档模块配置（workbench.docs.*），文档库根目录通过环境变量 DOCS_ROOT 覆盖。
 */
@ConfigurationProperties(prefix = "workbench.docs")
public class DocsProperties {

    /** 文档库根目录 */
    private String docsRoot = "./data/docs";

    public String getDocsRoot() {
        return docsRoot;
    }

    public void setDocsRoot(String docsRoot) {
        this.docsRoot = docsRoot;
    }
}
