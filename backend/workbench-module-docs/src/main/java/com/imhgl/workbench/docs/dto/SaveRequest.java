package com.imhgl.workbench.docs.dto;

import lombok.Getter;
import lombok.Setter;

/** 创建 / 保存文档请求体 */
@Getter
@Setter
public class SaveRequest {

    private String path;
    private String content;
}
