# 开发计划与验收

> 项目背景与技术栈见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」。任务完成即勾选，交付前以「验收清单」为统一出口。

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1（已归档） | 模块化单体骨架 + 认证 + 在线文档 v1 | ✅ 已完成，随重构移除（auth 模块删除） |
| M2（已归档） | 部署链（Docker/Caddy/CI）+ 开发环境管家 devsetup | ✅ 已完成，随重构移除（devsetup 模块与部署链暂缓；历史见 git 主干） |
| M3 | **后端重构：Java 25 + Spring Boot 4.1 + docs-only** | 🚩 进行中 |

## 当前任务（M3 · 后端重构）

实施计划（唯一权威）：[docs/superpowers/plans/2026-10-15-backend-refactor-docs-only.md](./docs/superpowers/plans/2026-10-15-backend-refactor-docs-only.md)——契约细节、测试矩阵、Review Focus 以计划文件为准，此处只跟踪状态。

- [x] Task 0: 前置环境——JDK 25（Temurin 25.0.4.1+1）安装至 `D:\dev\environment\jdk-25.0.4.1+1`，系统环境零侵入；分支 `refactor/docs-only`
- [ ] Task 1: 规范先行——AGENTS / DEVELOP_PLAN 全新撰写，README 横幅化
- [ ] Task 2: 骨架切换——Boot 4.1.1 + Java 25，删 auth/devsetup/db-init，五模块空壳可启动
- [ ] Task 3: common 重写——`ApiResult` / `ErrorCode`（语义错误码）/ `BusinessException`
- [ ] Task 4: infrastructure 重写——`FileTreeStorage` / `StorageNode` / `FileStorageProperties`（防穿越 + 白名单 + rename 守卫）
- [ ] Task 5: framework 重写——全局异常（四分支映射）/ CORS / SpringDoc
- [ ] Task 6: module-docs 重写——`DocPath` 值对象 / record 契约 / 结构化搜索 + 懒遍历短路
- [ ] Task 7: server 配置定型——瘦身 `application.yml` + 集成冒烟（JSON 形状 / 防穿越 / 校验 / CORS / Swagger）
- [ ] Task 8: 全量验证——`mvn clean package` 全绿，README 按最终现实重写，start.bat 局部 `JAVA_HOME`

## 验收清单（M3 · 每次交付前逐条核对）

后端（本期验收只看后端，前端联调留待 UI 重做期）：

- [ ] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令以 pwsh 7 + 局部 `JAVA_HOME=JDK25` 执行）
- [ ] 五模块骨架完整：common 零 Spring 依赖；framework 零端点；infrastructure 中性模型；docs 带 api 层；server 零业务
- [ ] 全仓无 MySQL / Redis / OSS / MyBatis 依赖；Lombok / Hutool 仅按需出现在父 POM
- [ ] `GET /api/docs/tree` 无需认证返回 `{"code":0,...}`；`?path=../secret.md` 返回 400 + `code=40000`
- [ ] `SPRINGDOC_API_DOCS_ENABLED=true` 时 Swagger UI 可打开
- [ ] 搜索语义符合 AGENTS.md 第 8 节（大小写不敏感、100 上限、懒遍历短路、结构化命中）

文档：

- [ ] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
