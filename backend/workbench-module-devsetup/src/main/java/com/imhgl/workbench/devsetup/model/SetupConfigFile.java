package com.imhgl.workbench.devsetup.model;

import lombok.Getter;
import lombok.Setter;

/** 配置文件元信息（列表用，不含 content） */
@Getter
@Setter
public class SetupConfigFile {

    private Long id;

    private String name;

    private String targetPath;

    private Boolean enabled;

    private String note;
}
