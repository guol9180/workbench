package com.imhgl.workbench.docs.dto;

import lombok.Getter;
import lombok.Setter;

/** 重命名请求体 */
@Getter
@Setter
public class RenameRequest {

    private String from;
    private String to;
}
