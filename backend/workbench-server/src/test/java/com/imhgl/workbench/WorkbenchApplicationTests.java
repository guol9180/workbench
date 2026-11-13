package com.imhgl.workbench;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 启动模块冒烟：空壳上下文必须能起得来（骨架切换后的第一道闸）。
 */
@SpringBootTest
class WorkbenchApplicationTests {

    /** 启动冒烟也不许写仓库目录：指标与源配置都指向临时路径 */
    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) throws IOException {
        Path base = Files.createTempDirectory("workbench-context-test");
        registry.add("workbench.metrics.data-dir", () -> base.resolve("metrics").toString());
        registry.add("workbench.sources.file", () -> base.resolve("sources.json").toString());
    }

    @Test
    void contextLoads() {
    }
}
