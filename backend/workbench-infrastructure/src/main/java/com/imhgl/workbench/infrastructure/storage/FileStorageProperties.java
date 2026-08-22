package com.imhgl.workbench.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Set;

/**
 * 文件存储配置（前缀沿用 workbench.docs.*，根目录经环境变量 DOCS_ROOT 覆盖）。
 */
@ConfigurationProperties(prefix = "workbench.docs")
public class FileStorageProperties {

    /** 存储根目录 */
    private String docsRoot = "./data/docs";

    /** 允许的文件扩展名白名单（小写，不含点） */
    private Set<String> allowedExtensions = Set.of("md", "markdown", "txt");

    public String getDocsRoot() {
        return docsRoot;
    }

    public void setDocsRoot(String docsRoot) {
        this.docsRoot = docsRoot;
    }

    public Set<String> getAllowedExtensions() {
        return allowedExtensions;
    }

    public void setAllowedExtensions(Set<String> allowedExtensions) {
        this.allowedExtensions = allowedExtensions;
    }
}
