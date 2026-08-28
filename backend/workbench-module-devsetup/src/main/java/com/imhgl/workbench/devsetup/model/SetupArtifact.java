package com.imhgl.workbench.devsetup.model;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 二进制工件元信息（不含二进制内容） */
@Getter
@Setter
public class SetupArtifact {

    private Long id;

    private String name;

    private String filename;

    private Long size;

    private String note;

    private LocalDateTime updateTime;
}
