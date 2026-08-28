package com.imhgl.workbench.devsetup.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 开发环境配置文件 DO（仅模块内可见；content 明文，禁止存放密钥） */
@Getter
@Setter
@TableName("setup_config_file")
public class SetupConfigFileDO {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 显示名称 */
    private String name;

    /** 目标路径（支持 %USERPROFILE% 等环境变量） */
    private String targetPath;

    /** 文件内容（明文） */
    private String content;

    /** 是否启用 */
    private Boolean enabled;

    /** 备注 */
    private String note;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
