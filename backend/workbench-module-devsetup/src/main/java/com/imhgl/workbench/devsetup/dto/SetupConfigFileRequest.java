package com.imhgl.workbench.devsetup.dto;

import lombok.Getter;
import lombok.Setter;

/** 配置文件新增/编辑请求体 */
@Getter
@Setter
public class SetupConfigFileRequest {

    /** 显示名称 */
    private String name;

    /** 目标路径（支持 %USERPROFILE% 等环境变量） */
    private String targetPath;

    /** 文件内容（明文，禁止存放密钥/凭据） */
    private String content;

    /** 是否启用 */
    private Boolean enabled;

    /** 备注 */
    private String note;
}
