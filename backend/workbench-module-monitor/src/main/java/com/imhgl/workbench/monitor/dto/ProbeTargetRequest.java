package com.imhgl.workbench.monitor.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 拨测目标入参（POST / PUT 共用）。
 * <p>enabled 缺省 true：新建目标默认参与调度；形状校验走注解，语义校验（URL 协议、名称字符）
 * 在 api 实现层完成。
 */
public record ProbeTargetRequest(
        @NotBlank @Size(max = 40) String name,
        @NotBlank @Size(max = 500) String url,
        Boolean enabled) {

    public ProbeTargetRequest {
        if (enabled == null) enabled = true;
    }
}
