package com.imhgl.workbench;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * 工作台启动应用。位于 com.imhgl.workbench 包根，自动扫描所有功能模块
 * （workbench-common、workbench-module-docs 及未来的新模块）。
 *
 * 新增功能模块：在 backend 下建 workbench-module-xxx 子工程，依赖
 * workbench-common，包名以 com.imhgl.workbench 开头，接口挂 /api/xxx/** 即可。
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class WorkbenchServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkbenchServerApplication.class, args);
    }
}
