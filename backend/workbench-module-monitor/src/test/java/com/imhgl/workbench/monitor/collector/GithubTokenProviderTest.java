package com.imhgl.workbench.monitor.collector;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** token 解析优先级：页面设置 > 环境变量；页面清除后回落 env */
class GithubTokenProviderTest {

    @TempDir
    Path temp;

    private GithubTokenProvider provider(String envToken) {
        return new GithubTokenProvider(
                new SourceConfigStore(new SourceConfigProperties(temp.resolve("sources.json").toString(), envToken, "-")),
                new SourceConfigProperties(temp.resolve("sources.json").toString(), envToken, "-"));
    }

    @Test
    @DisplayName("无页面设置回落 env；页面设置优先；清除后回落 env；来源口径正确")
    void priorityAndSource() {
        GithubTokenProvider p = provider("env-token");
        assertEquals("env", p.source());
        assertEquals("env-token", p.token());

        p.setPageToken("page-token");
        assertEquals("page", p.source());
        assertEquals("page-token", p.token());

        p.clearPageToken();
        assertEquals("env", p.source());
        assertEquals("env-token", p.token());
    }

    @Test
    @DisplayName("两者皆无 → 未配置")
    void noneConfigured() {
        GithubTokenProvider p = provider("");
        assertEquals(null, p.source());
        assertEquals(false, p.hasToken());
    }
}
