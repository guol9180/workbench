# 开发计划与验收

> 项目背景与技术栈见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」。任务完成即勾选，交付前以「验收清单」为统一出口。

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1（已归档） | 模块化单体骨架 + 认证 + 在线文档 v1 | ✅ 已完成，随重构移除（auth 模块删除） |
| M2（已归档） | 部署链（Docker/Caddy/CI）+ 开发环境管家 devsetup | ✅ 已完成，随重构移除（devsetup 模块与部署链暂缓；历史见 git 主干） |
| M3（已归档） | 后端重构：Java 25 + Spring Boot 4.1 + docs-only | ✅ 已完成并合入 main（54 测试，审查 Important 全修） |
| M4 | **后台管理系统一期：流量监测域 + 轻量 Token 认证（仅后端）** | 🚩 进行中 |

## 当前任务（M4 · 流量监测一期）

实施计划（唯一权威）：[docs/superpowers/plans/2026-10-21-admin-monitor-phase1.md](./docs/superpowers/plans/2026-10-21-admin-monitor-phase1.md)——契约细节、测试矩阵、Review Focus 以计划文件为准，此处只跟踪状态。

- [ ] Task 0: 规范先行——AGENTS / README / DEVELOP_PLAN 升级为「后台管理系统（监测 + 工具集）」定位，登记 monitor 模块与 Token 认证约定
- [ ] Task 1: infrastructure 时序存储——`TimeSeriesStore` / `JsonlTimeSeriesStore`（分钟聚合桶 / 蓄水池采样 / JSONL 刷盘 / 重放 / 保留）
- [ ] Task 2: framework Token 认证——`ApiTokenFilter`（X-API-Token，空 = 关闭）+ `UNAUTHORIZED(40100)`
- [ ] Task 3: monitor 域模型与服务——`TimeRange` 值对象 / `MonitorService` / `TrafficRecordFilter` 自监测
- [ ] Task 4: monitor 六端点——ingest / sources / overview / series / top-endpoints / status
- [ ] Task 5: server 集成——配置 + `MonitorIntegrationTest`（自监测链路 / 上报 / Token 三态）
- [ ] Task 6: 全量验证——`mvn clean package` 全绿（54 存量零回归 + 新增用例），文档定稿，推送 main

## 验收清单（M4 · 每次交付前逐条核对）

后端（本期验收只看后端，前端联调留待 UI 重做期）：

- [ ] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令内局部设置 `JAVA_HOME=JDK25`）；**存量 54 用例零回归**
- [ ] 零新增第三方依赖；无 MySQL / Redis / OSS / MyBatis 依赖
- [ ] token 未配置：现有行为不变；配置后：无头 / 错值 401 + `40100`，正确值放行；Swagger 不受影响
- [ ] 自监测：调任意 docs API 后 `overview?source=workbench` 计数增长，路径已归一化（数字段 `{n}` / UUID `{u}`）
- [ ] 上报枢纽：模拟外部系统 `ingest` 后 `series` / `top-endpoints` / `sources` 正确反映；非法 payload 400
- [ ] 时序存储：同 data-dir 重实例化后数据不丢（重放）；过期文件被清理（保留策略）；并发 append 计数精确
- [ ] 查询参数校验：`range` / `metric` / `step` / `by` 非法值 400

文档与注释：

- [ ] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
- [ ] 注释符合 [AGENTS.md · 注释规范](./AGENTS.md#注释规范学习项目)：公共契约有 Javadoc（职责/参数/抛错约定）、解释「为什么」（聚合桶 / 蓄水池 / 单写线程等取舍）、无过时注释

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
