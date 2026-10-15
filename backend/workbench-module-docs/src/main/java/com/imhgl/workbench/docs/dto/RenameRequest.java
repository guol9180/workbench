package com.imhgl.workbench.docs.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 重命名/移动入参。
 */
public record RenameRequest(@NotBlank String from, @NotBlank String to) {
}
