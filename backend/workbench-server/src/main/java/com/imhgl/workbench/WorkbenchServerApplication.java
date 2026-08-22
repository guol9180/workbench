package com.imhgl.workbench;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * 工作台启动应用：只做聚合启动，禁止业务逻辑，禁止被其他模块依赖。
 * 位于 com.imhgl.workbench 包根，自动扫描全部模块（framework / infrastructure / 各业务模块）。
 *
 * 新增功能模块：在 backend 下建 workbench-module-xxx 子工程，依赖 framework 与
 * infrastructure，包名以 com.imhgl.workbench 开头，接口挂 /api/xxx/** 自动纳入认证。
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class WorkbenchServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkbenchServerApplication.class, args);
    }
}
