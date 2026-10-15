package com.imhgl.workbench.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.Set;

/**
 * 文件存储配置（workbench.storage.*，中性命名；根目录经环境变量 DOCS_ROOT 覆盖）。
 */
@ConfigurationProperties(prefix = "workbench.storage")
public record FileStorageProperties(
        @DefaultValue("./data/docs") String root,
        @DefaultValue({"md", "markdown", "txt"}) Set<String> allowedExtensions) {
}
