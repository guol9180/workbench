package com.imhgl.workbench.devsetup.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 开发环境工具清单 DO（仅模块内可见） */
@Getter
@Setter
@TableName("setup_tool")
public class SetupToolDO {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

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

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
