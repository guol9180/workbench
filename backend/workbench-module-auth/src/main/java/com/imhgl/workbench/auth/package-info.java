/**
 * 职责：认证授权业务（/api/auth/**：密码登录、登录状态查询）。
 * 内部结构：controller / service（TokenService 签发与校验，实现 framework 的 TokenVerifier 契约）/ config（AuthProperties）/ dto。
 * 当前无跨模块调用方，暂无 api 层；一旦被跨模块调用，必须先补 api 接口。
 */
package com.imhgl.workbench.auth;
