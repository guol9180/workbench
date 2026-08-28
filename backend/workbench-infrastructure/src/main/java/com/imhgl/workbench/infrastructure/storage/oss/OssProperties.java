package com.imhgl.workbench.infrastructure.storage.oss;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 阿里云 OSS 配置（workbench.oss.*，中性命名；环境变量 OSS_* 覆盖）。
 * endpoint/bucket/access-key/secret 四项齐全才视为已启用，否则 OssStorage 抛业务异常。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "workbench.oss")
public class OssProperties {

    /** 服务地址，如 <a href="https://oss-cn-hangzhou.aliyuncs.com" /a> */
    private String endpoint = "";

    /** 存储桶名 */
    private String bucket = "";

    /** AccessKey ID（建议 RAM 子账号，仅授予该桶读写） */
    private String accessKey = "";

    /** AccessKey Secret */
    private String secret = "";

    /** 对象 key 统一前缀（隔离同桶其他数据），默认 workbench */
    private String prefix = "workbench";

    /** 预签名下载 URL 有效期（分钟） */
    private int urlTtlMinutes = 10;

    public boolean complete() {
        return endpoint != null && !endpoint.isBlank()
                && bucket != null && !bucket.isBlank()
                && accessKey != null && !accessKey.isBlank()
                && secret != null && !secret.isBlank();
    }
}
