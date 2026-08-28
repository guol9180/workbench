package com.imhgl.workbench.devsetup.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 引导清单：bootstrap.ps1 运行时拉取的全部数据 */
@Getter
@Setter
public class SetupManifest {

    /** 启用的工具（按 sort 升序） */
    private List<SetupTool> tools;

    /** 启用的配置文件（含内容，按 sort/orderId 升序） */
    private List<SetupConfigFileContent> configFiles;

    /** 二进制工件元信息（如 IDEA 配置快照，脚本按 name 下载） */
    private List<SetupArtifact> artifacts;
}
