package com.imhgl.workbench.monitor.collector;

import org.springframework.stereotype.Component;

/**
 * GitHub token 解析器：页面设置（sources.json settings 区）优先，回落环境变量 GITHUB_TOKEN。
 * <p>不缓存、每次直读 store：token 变更是极低频事件，而「保存即生效」要求读到最新值；
 * 小 JSON 文件的读取代价远小于引入缓存一致性的复杂度。
 * <p>本类是 token 的唯一读取口——client、collector、status 都经它取值，保证优先级口径全站一致。
 */
@Component
public class GithubTokenProvider {

    private final SourceConfigStore store;
    private final SourceConfigProperties properties;

    public GithubTokenProvider(SourceConfigStore store, SourceConfigProperties properties) {
        this.store = store;
        this.properties = properties;
    }

    /** 生效 token：页面设置优先，回落环境变量；未配置返回空串 */
    public String token() {
        String page = store.githubToken();
        if (page != null && !page.isBlank()) return page.trim();
        return properties.githubToken() == null ? "" : properties.githubToken();
    }

    public boolean hasToken() {
        return !token().isBlank();
    }

    /** token 来源：page=配置页保存，env=环境变量，null=未配置（status 出参口径） */
    public String source() {
        String page = store.githubToken();
        if (page != null && !page.isBlank()) return "page";
        return hasToken() ? "env" : null;
    }

    /** 保存页面级 token（trim 后非空由调用方保证），立即持久化并生效 */
    public void setPageToken(String token) {
        store.setGithubToken(token.trim());
    }

    /** 清除页面级 token，回落环境变量 */
    public void clearPageToken() {
        store.setGithubToken(null);
    }
}
