package com.imhgl.workbench;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 聚合启动类：只做启动与组件扫描（com.imhgl.workbench 根包下自动装配），禁止业务。
 */
@SpringBootApplication
public class WorkbenchApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkbenchApplication.class, args);
    }
}
