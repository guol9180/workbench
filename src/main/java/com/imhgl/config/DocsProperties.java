package com.imhgl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class DocsProperties {

    /** 文档库根目录，服务器部署时通过 DOCS_ROOT 环境变量覆盖 */
    private String docsRoot;

    /** 登录密码，服务器部署时通过 APP_PASSWORD 环境变量覆盖 */
    private String password;

    public String getDocsRoot() {
        return docsRoot;
    }

    public void setDocsRoot(String docsRoot) {
        this.docsRoot = docsRoot;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
