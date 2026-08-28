package com.imhgl.workbench.devsetup.dto;

import lombok.Getter;
import lombok.Setter;

/** 工具新增/编辑请求体 */
@Getter
@Setter
public class SetupToolRequest {

    /** 显示名称 */
    private String name;

    /** 安装类型：WINGET / ZIP / IDEA_PLUGIN */
    private String category;

    /** winget 包 id / zip 直链 / 插件 id */
    private String sourceRef;

    /** 锁定版本（空=最新） */
    private String version;

    /** 是否启用 */
    private Boolean enabled;

    /** 排序（小在前） */
    private Integer sort;

    /** 备注 */
    private String note;
}
