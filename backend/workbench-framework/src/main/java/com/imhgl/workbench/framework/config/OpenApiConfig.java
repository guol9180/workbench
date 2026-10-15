package com.imhgl.workbench.framework.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * SpringDoc/OpenAPI 元信息；文档开关由配置项 springdoc.api-docs.enabled（env SPRINGDOC_API_DOCS_ENABLED）控制。
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI workbenchOpenApi() {
        return new OpenAPI().info(new Info()
                .title("workbench")
                .description("个人学习练手工作台（模块化单体）")
                .version("v2"));
    }
}
