# 工作台 · Workbench

> 🚧 **后端重构进行中**（分支 `refactor/docs-only`，里程碑 M3：Java 25 + Spring Boot 4.1 + docs-only）。本文档将在重构完成后按最终代码现实重写；当前以 [AGENTS.md](./AGENTS.md)（架构与规范）和 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)（计划与验收）为准。

个人学习练手的工作台系统，按功能模块组织，用最小的业务面留住完整的架构分层。

- 当前唯一业务模块：**在线 Markdown 文档**（文件树 / 在线编辑 / 全文搜索）
- 后端：Java 25 · Spring Boot 4.1 · Maven 五模块单体 · 纯文件存储（无数据库）
- 前端：Vue 3 + Vite（本期待 UI 重做期再与 v2 API 对齐，暂不联调）
