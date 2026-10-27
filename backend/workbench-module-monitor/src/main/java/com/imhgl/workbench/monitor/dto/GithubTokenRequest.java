package com.imhgl.workbench.monitor.dto;

import jakarta.validation.constraints.NotBlank;

/** GitHub token 保存入参（PUT settings/github-token）：trim 后非空，值只在服务端持久化，永不回显 */
public record GithubTokenRequest(
        @NotBlank String token) {
}
