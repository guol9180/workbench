package com.imhgl.workbench.docs.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 新建文件夹入参。
 */
public record CreateDirRequest(@NotBlank String path) {
}
