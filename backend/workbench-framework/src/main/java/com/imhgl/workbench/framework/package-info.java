/**
 * 职责：存放应用框架层能力，即 Web 应用运行所需的通用框架能力。
 * 允许存放：
 *      全局异常处理、统一日志切面、操作日志切面、权限拦截器、登录拦截器、Token 校验契约（TokenVerifier）、接口文档配置、Web MVC 配置、Jackson 配置、CORS 配置、参数解析器、过滤器、请求上下文、当前登录用户解析
 * 禁止存放：
 *      HTTP 端点（Controller，一律放业务模块）、具体业务逻辑、业务 Mapper、业务 Entity、业务 DTO、业务 VO、第三方业务调用
 */
package com.imhgl.workbench.framework;