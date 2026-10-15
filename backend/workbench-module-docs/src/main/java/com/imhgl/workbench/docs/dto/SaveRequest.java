package com.imhgl.workbench.docs.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 新建/保存文档入参。
 */
public record SaveRequest(@NotBlank String path, String content) {
}
