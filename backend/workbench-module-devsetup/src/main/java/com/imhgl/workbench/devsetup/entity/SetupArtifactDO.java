package com.imhgl.workbench.devsetup.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 开发环境二进制工件 DO（仅模块内可见；二进制内容存 OSS，本表只存元数据） */
@Getter
@Setter
@TableName("setup_artifact")
public class SetupArtifactDO {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 工件名（下载路径的一部分，同名片覆盖） */
    private String name;

    /** 上传时的原始文件名 */
    private String filename;

    /** OSS 对象 key（含统一前缀） */
    private String ossKey;

    /** 字节数 */
    private Long size;

    /** 备注 */
    private String note;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
