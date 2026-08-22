package com.imhgl.workbench.infrastructure.storage;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Set;

/**
 * 文件存储配置（workbench.storage.*，中性命名；根目录经环境变量 DOCS_ROOT 覆盖）。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "workbench.storage")
public class FileStorageProperties {

    /** 存储根目录 */
    private String root = "./data/docs";

    /** 允许的文件扩展名白名单（小写，不含点） */
    private Set<String> allowedExtensions = Set.of("md", "markdown", "txt");
}
