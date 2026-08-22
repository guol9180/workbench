/**
 * 职责：存放基础设施层能力，即外部技术组件、第三方服务、中间件封装。
 * 允许存放：
 *      Redis、缓存、文件存储、本地存储、OSS、短信、邮件、消息队列、支付网关、微信、支付宝、第三方 HTTP 客户端、定时任务基础组件
 * 禁止存放：
 *      用户业务规则、业务 Controller、业务 Service、业务 Mapper、业务 DO
 * 附加规则：
 *      只产出中性模型与中性配置（如 StorageNode、workbench.storage.*），禁止业务色彩命名
 */
package com.imhgl.workbench.infrastructure;