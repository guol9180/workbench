package com.imhgl.workbench.devsetup.model;

import lombok.Getter;
import lombok.Setter;

/** 工具出参模型 */
@Getter
@Setter
public class SetupTool {

    private Long id;

    private String name;

    /** WINGET / ZIP / IDEA_PLUGIN */
    private String category;

    private String sourceRef;

    private String version;

    private Boolean enabled;

    private Integer sort;

    private String note;
}
