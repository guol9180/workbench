package com.imhgl.workbench.infrastructure.storage.oss;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import com.aliyun.oss.model.ResponseHeaderOverrides;
import com.imhgl.workbench.common.exception.BusinessException;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * 阿里云 OSS 中性封装：put / delete / 预签名下载 URL。
 * 未配置（四项凭据不齐）时所有操作抛业务异常，由全局异常处理器转 400，前端可读。
 * 业务模块不得感知 bucket/endpoint 细节，key 经 {@link #key(String)} 统一加前缀。
 */
@Component
public class OssStorage {

    private final OssProperties properties;
    private volatile OSS client;

    public OssStorage(OssProperties properties) {
        this.properties = properties;
    }

    /** OSS 是否已配置可用 */
    public boolean enabled() {
        return properties.complete();
    }

    /** 模块内相对路径 → 带统一前缀的对象 key（如 devsetup/idea-settings → workbench/devsetup/idea-settings） */
    public String key(String modulePath) {
        String p = properties.getPrefix() == null ? "" : properties.getPrefix().trim();
        String path = modulePath.startsWith("/") ? modulePath.substring(1) : modulePath;
        return p.isEmpty() ? path : p + "/" + path;
    }

    /** 流式上传（size 已知，不缓冲全量内容） */
    public void put(String key, InputStream in, long size) {
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(size);
        oss().putObject(new PutObjectRequest(properties.getBucket(), key, in, metadata));
    }

    public void delete(String key) {
        oss().deleteObject(properties.getBucket(), key);
    }

    /** 生成预签名下载 URL（默认 10 分钟有效），带附件文件名（RFC 5987，中文文件名安全） */
    public String presignGet(String key, String filename) {
        GeneratePresignedUrlRequest request =
                new GeneratePresignedUrlRequest(properties.getBucket(), key, HttpMethod.GET);
        request.setExpiration(new Date(System.currentTimeMillis() + properties.getUrlTtlMinutes() * 60_000L));
        if (filename != null && !filename.isBlank()) {
            ResponseHeaderOverrides overrides = new ResponseHeaderOverrides();
            String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
            overrides.setContentDisposition("attachment; filename*=UTF-8''" + encoded);
            request.setResponseHeaders(overrides);
        }
        URL url = oss().generatePresignedUrl(request);
        // URL 已含签名查询串，原样返回（不可再拼接）
        return url.toString();
    }

    /** 便捷重载：key 即文件名语义时直接用 key 尾段作为下载文件名 */
    public URI presignGetUri(String key, String filename) {
        return URI.create(presignGet(key, filename));
    }

    private OSS oss() {
        if (!enabled()) {
            throw new BusinessException("OSS 未配置（workbench.oss.* 需 endpoint/bucket/access-key/secret 四项齐全），无法使用工件功能");
        }
        OSS local = client;
        if (local == null) {
            synchronized (this) {
                if (client == null) {
                    client = new OSSClientBuilder().build(
                            properties.getEndpoint(), properties.getAccessKey(), properties.getSecret());
                }
                local = client;
            }
        }
        return local;
    }

    @PreDestroy
    public void shutdown() {
        if (client != null) {
            client.shutdown();
        }
    }
}
