# 开发计划与验收

> 项目背景与技术栈见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」。任务完成即勾选，交付前以「验收清单」为统一出口。

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1（已归档） | 模块化单体骨架 + 认证 + 在线文档 v1 | ✅ 已完成，随重构移除（auth 模块删除） |
| M2（已归档） | 部署链（Docker/Caddy/CI）+ 开发环境管家 devsetup | ✅ 已完成，随重构移除（devsetup 模块与部署链暂缓；历史见 git 主干） |
| M3（已归档） | 后端重构：Java 25 + Spring Boot 4.1 + docs-only | ✅ 已完成并合入 main（54 测试，审查 Important 全修） |
| M4（已归档） | **后台管理系统一期：流量监测域 + 轻量 Token 认证（仅后端）** | ✅ 已完成并推送 main（00447e6，94/94，审查 Important 3 项全修） |
| M5 | **前端重做：React「观测站」设计语言 + v2 API 全面对齐** | 🚩 进行中 |
| M6 | **GitHub 数据源接入：Pages 流量 / Release 下载量 + 数据源配置页** | 🚩 进行中 |

## 当前任务（M6 · GitHub 数据源 + 配置页）

需求已与用户确认：可配置多仓库列表；`GITHUB_TOKEN` 环境变量提供 PAT（repo 读权限）；指标 = Pages 流量（views/uniques）+ Release 下载量；**配置页**让用户自行控制接入哪些数据（运行期 CRUD，非 yml）。后端采集器入库映射与源配置约定见 [AGENTS.md §3.5 / §8](./AGENTS.md)。

- [x] Task 1: 源配置存储与 API——`SourceConfigStore`（JSON 文件原子读写）+ source-configs 五端点 + 校验（TDD：store 往返 / 重复 repo 冲突 / 非法 repo / 不存在 id）
- [x] Task 2: GitHub 采集器——`GithubClient`（HttpClient + Jackson 窄解析，fixture 单测）+ `GithubCollector`（cron + 手动触发，lastDay 游标保幂等 / 下载量增量入库，token 缺失诚实报错）
- [x] Task 3: server 集成——`@EnableScheduling` + `workbench.sources.*` 配置 + `mvn package` 全绿（105 用例：存量 94 零回归 + 新增 11）
- [x] Task 4: 前端数据源页——`/sources` 路由 + 图标轨第三项：接入表单（repo + 指标勾选）、源列表（状态灯/最后成功/立即采集/启停/删除）
- [x] Task 5: 联调验证（CRUD + 重复 409 + 无 token 采集诚实报错 + 状态回写）+ 文档同步 + 提交推送

## 验收清单（M6 · 每次交付前逐条核对）

后端：

- [x] `mvn clean package` 全绿，存量 94 用例零回归；新增 store/解析/API 用例（105/105）
- [x] source-configs CRUD + 校验：非法 repo/metrics 400 `PARAM_INVALID`；重复 repo 409；不存在 404；token 不回显
- [x] 采集器：token 缺失 → 手动采集 ok=false + 明确提示；views 以 lastDay 游标保幂等（聚合桶叠加语义下的防重）；下载量累计→增量（负差清零）；写入映射符合 §3.5 约定
- [x] 调度：cron 可配（默认每天 08:05/20:05），配 `-` 关闭定时只留手动；单仓失败不拖累其他仓

前端：

- [x] `/sources` 页 CRUD 走通；配置页一切写操作均由用户点击触发（符合通用第 5 条）
- [x] 概览页自动出现 `github/{repo}` 源（源 chips 动态）
- [x] 构建零错；三文档同步；提交推送

## 当前任务（M5 · 前端重做）

Vue 3 前端整体重写为 React 19 + TypeScript（用户裁定架构可换），落地「观测站」设计语言；旧 Vue 源码不迁移，功能对照移植。devsetup 前端随后端模块一并移除（代码见 git 主干，待后端以新模块重建后再入 UI）。

- [x] Task 1（里程碑 A）: frontend 重置为 React+TS 工程；「观测站」设计令牌（蓝墨/琥珀/mono 读数）+ AppShell（图标轨 + 底部遥测状态条）；概览页 mock 版先行并经无头截图自查修正 y 轴刻度缺陷
- [x] Task 2: monitor 真数据——六端点封装 / `usePolling`（15s 轮询、页面隐藏暂停、失败保留旧数据）/ 概览页指标切换 / 状态条接 status+overview（离线灰灯、背压丢弃琥珀警示）
- [x] Task 3: docs React 重写——`useDocs` 状态编排 / 目录树 / 搜索 / Vditor ref 封装（裁定不用 StrictMode：vendored Vditor 不兼容开发期双挂载）/ 本地预览 / 自动保存与全局键
- [x] Task 4: 接入页——探测式令牌（open 直进 / locked 表单 / offline 重试）+ 粒子景深场重调色（琥珀/冰蓝）
- [x] Task 5: 联调验证——本地 jar + vite 代理；monitor 真数据渲染、认证三态（无/错令牌 401、对令牌 200）、接入页探测；数据边界事故清除（未经同意的 ingest 演示数据已删，规范新增通用第 5 条）
- [ ] Task 6: 三文档同步 + 构建复验 + 提交推送

## 验收清单（M5 · 每次交付前逐条核对）

前端工程与联调：

- [x] `tsc --noEmit` 严格模式零错误；`vite build` 成功（除 React 生态必需品外零新增运行时依赖；React Bits 不引入，效果手写）
- [x] 概览真数据：sources 含自身 `workbench`；range/源/指标切换正确；24h/7d 走小时桶（range→step 固定映射）
- [x] 底部状态条真数据：rps/错误率/桶数/文件数/认证开关；后端离线灰灯；`droppedEvents>0` 琥珀警示
- [x] 认证链路：无令牌 401、错令牌 401、对令牌 200；接入页探测三态正确（open 直进 / locked 表单 / offline 重试）；401 统一清令牌跳接入页
- [x] docs 功能对照旧实现逐项移植：树/读写/新建文件与文件夹/重命名/删除/搜索/本地预览/拖拽/Ctrl+S/自动保存/未保存离开拦截（交互细节以浏览器手工全验为准，首用发现偏差即修）
- [x] 数据边界：无任何未经同意的持久层写入残留；演示数据仅存在于前端组件（mock 已随真数据接线删除）
- [ ] 三文档同步 + 提交推送

## 验收清单（M4 · 已归档）

后端（本期验收只看后端，前端联调由 M5 完成）：

- [x] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令内局部设置 `JAVA_HOME=JDK25`）；**存量 54 用例零回归**（94/94）
- [x] 零新增第三方依赖；无 MySQL / Redis / OSS / MyBatis 依赖
- [x] token 未配置：现有行为不变；配置后：无头 / 错值 401 + `40100`，正确值放行；Swagger 不受影响
- [x] 自监测：调任意 docs API 后 `overview?source=workbench` 计数增长，路径已归一化（数字段 `{n}` / UUID `{u}`）；401 请求也计入流量
- [x] 上报枢纽：模拟外部系统 `ingest` 后 `series` / `top-endpoints` / `sources` 正确反映；非法 payload 400
- [x] 时序存储：同 data-dir 重实例化后数据不丢（重放）；过期文件被清理（保留策略）；并发 append 计数精确（16 线程 × 200）
- [x] 查询参数校验：`range` / `metric` / `step` / `by` 非法值 400

文档与注释：

- [x] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
- [x] 注释符合 [AGENTS.md · 注释规范](./AGENTS.md#注释规范学习项目)：公共契约有 Javadoc（职责/参数/抛错约定）、解释「为什么」（聚合桶 / 蓄水池 / 单写线程等取舍）、无过时注释

## 验收清单（M3 · 已归档，随 M4 重跑仍须全绿）

后端（本期验收只看后端，前端联调留待 UI 重做期）：

- [x] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令内局部设置 `JAVA_HOME=JDK25`）
- [x] 五模块骨架完整：common 零 Spring 依赖；framework 零端点；infrastructure 中性模型；docs 带 api 层；server 零业务
- [x] 全仓无 MySQL / Redis / OSS / MyBatis 依赖；Lombok / Hutool 仅在父 POM dependencyManagement 管版本，按需声明
- [x] `GET /api/docs/tree` 无需认证返回 `{"code":0,...}`；`?path=../secret.md` 返回 400 + `code=40000`
- [x] `SPRINGDOC_API_DOCS_ENABLED=true` 时 Swagger UI 可打开
- [x] 搜索语义符合 AGENTS.md 第 8 节（大小写不敏感、100 上限、懒遍历短路、结构化命中）

文档与注释：

- [x] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
- [x] 注释符合 [AGENTS.md · 注释规范](./AGENTS.md#注释规范学习项目)：公共契约有 Javadoc（职责/参数/抛错约定）、解释「为什么」、无过时注释
