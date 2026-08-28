package com.imhgl.workbench.devsetup.model;

import lombok.Getter;
import lombok.Setter;

/** 配置文件完整内容（详情接口与引导清单用） */
@Getter
@Setter
public class SetupConfigFileContent {

    private Long id;

    private String name;

    private String targetPath;

    private String content;

    private Boolean enabled;

    private String note;
}
