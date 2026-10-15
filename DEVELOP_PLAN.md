# 开发计划与验收

> 项目背景与技术栈见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」，不重复技术细节。任务完成即勾选，交付前以「验收清单」为统一出口。

## 任务清单

### 已完成

- [x] P0: 模块化单体骨架——common / framework / infrastructure / 业务模块 / server 五层就位，业务模块带 api 层（验收：依赖方向由各模块 pom 强制保证，后端可打包）
- [x] P0: 认证授权模块 auth——密码登录 + 无状态 Token（30 天）+ 登录拦截器（验收：未登录访问 `/api/**` 返回 401，登录后放行）
- [x] P0: 在线文档模块 docs——文档/文件夹 CRUD、全文搜索、Vditor 编辑（`Ctrl+S` 保存）、今日工作、本地 `.md` 预览导入、移动端适配（验收：见「验收清单」前端条目）
- [x] P1: 部署链路——Docker Compose（app + MySQL + Redis + Caddy HTTPS 反代）、后端 GHCR 镜像 CI、前端 GitHub Pages CI（验收：单机 `docker compose up -d` 可起）
- [x] P1: 开发环境管家模块 devsetup——工具清单（winget / ZIP / IDEA 插件）、配置下发、IDEA 设置免 JetBrains 账号快照恢复；工件存 OSS、MySQL 只存元数据（验收：OSS 四项环境变量齐备时，下载走预签名 URL 302 跳转）
- [x] P1: 登录页重设计——深夜蓝极光玻璃 + 零依赖 3D 视差，尊重 `prefers-reduced-motion`（验收：三档分辨率截图目检通过，登录流程不受影响）
- [x] P1: 编辑器体验收尾——Vditor 4.0.0 本地副本升级、停止输入 2s 自动保存、文档打开竞态修复（验收：README 冒烟清单回归通过）

### 待办

- [ ] P2: Redis 接入真实消费场景（当前仅依赖与连接配置；出现场景后按 [AGENTS.md · 技术选型](./AGENTS.md#7-技术选型) 规则 6 评估，封装放 infrastructure）（验收标准：有明确消费方，封装为中性模型）
- [ ] P2: 新业务模块立项 `workbench-module-xxx`——需求未定，TODO；确认后按 [AGENTS.md · 业务模块内部结构](./AGENTS.md#5-业务模块内部结构) 流程新增（验收标准：父 POM `<module>`、server 依赖、api 层齐备，接口挂 `/api/xxx/**`）
- [ ] TODO: 待规划项在此追加；未确认的需求不预填

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1 | 骨架 + 认证 + 在线文档可用（本地可跑通自用） | ✅ 完成 |
| M2 | 部署链路 + 开发环境管家（公网可访问、新机可恢复） | ✅ 完成 |
| M3 | 模块扩展期：Redis 真实场景接入、新业务模块立项 | ⏸ 待启动（需求确认后拆解任务） |

## 验收清单

每次交付前逐条核对；终端要求见 [AGENTS.md · 通用规范（必建三条）](./AGENTS.md#通用规范必建三条)。

后端：

- [ ] `backend/` 下 `mvn -DskipTests package` 构建成功
- [ ] 未登录访问 `/api/docs/**` 返回 401；密码错误返回统一错误结构（`ApiResult.code != 0`）
- [ ] `SPRINGDOC_API_DOCS_ENABLED=true` 时 Swagger UI 可打开

前端：

- [ ] `frontend/` 下 `npm run build` 成功，产物无 CDN 依赖（Vditor 为本地副本）
- [ ] 未登录访问任意路由落在登录页，登录成功跳 `/docs`
- [ ] 文档新建 / 编辑 / `Ctrl+S` 与自动保存 / 全文搜索 / 今日工作可用
- [ ] devsetup 工具清单、配置下发、引导脚本生成可用
- [ ] 移动端（≤768px）侧边栏收为抽屉、触屏可用

部署：

- [ ] `docker compose up -d` 四容器健康，后端端口仅绑定 `127.0.0.1`
- [ ] GitHub Actions：前端 Pages 发布与后端镜像构建均通过

文档：

- [ ] README.md / AGENTS.md / DEVELOP_PLAN.md 已与本次改动同步（不同步视为任务未完成）
