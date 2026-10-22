package com.imhgl.workbench.monitor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * 数据源接入入参（POST / PUT source-configs 共用）。
 * <p>type 当前仅支持 github（后端做白名单校验，前端选择器也只展示已支持项）；
 * repo 收 owner/name 字面量，正则在 DTO 层拦截明显非法输入，正则放行的边界语义由 api 层兜底。
 */
public record SourceConfigRequest(
        @NotBlank String type,
        @NotBlank @Pattern(regexp = "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", message = "repo 须为 owner/name 形式") String repo,
        boolean enabled,
        @NotEmpty List<@Pattern(regexp = "pages|downloads", message = "指标仅支持 pages/downloads") String> metrics) {
}
