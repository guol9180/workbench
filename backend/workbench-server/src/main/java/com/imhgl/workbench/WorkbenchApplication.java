package com.imhgl.workbench;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 聚合启动类：只做启动与配置属性扫描（com.imhgl.workbench 根包下自动装配），禁止业务。
 * EnableScheduling 供 monitor 源采集器的 cron 调度使用（cron 配 "-" 可整体关闭定时）。
 */
@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan("com.imhgl.workbench")
public class WorkbenchApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkbenchApplication.class, args);
    }
}
