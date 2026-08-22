/**
 * 职责：启动模块、聚合模块、部署模块。
 * 允许存放：
 *      Spring Boot 启动类、应用级配置、数据源配置、MyBatis 配置、Redis 配置、Security 配置、线程池配置、多环境配置文件、日志配置、数据库脚本
 *      配置统一放在 backend/workbench-server/src/main/resources 下
 * 禁止存放：
 *      业务 Controller、业务 Service、业务 Mapper、业务 DO、业务 DTO、业务 VO、具体业务逻辑
 * 禁止被任何模块依赖。
 */
package com.imhgl.workbench;
