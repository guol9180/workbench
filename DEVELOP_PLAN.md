# 开发计划与验收

> 项目背景与运行方式见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」。

## 任务清单

### T1 M14 减法与部署合并（P0）

- 目标：删掉与新定位无关的一切存量，把部署收敛为单域名单单元，为 M15–M17 提供干净地基。
- 动机：docs 域实际只产出过一篇 86 字节文档；演示模式与双站部署为「对外可演示」服务，自用定位下是纯负担。
- 验收标准：
  - 后端：删除 `workbench-module-docs` 模块（父 POM `<modules>` 与 server 依赖同步删除，含 3 个测试类）；删除 infrastructure 的 `storage` 包（FileTreeStorage / StorageNode / StorageException / FileStorageProperties）及 `workbench.storage.*` 配置；`workbench.sources.file` 占位改为 `${WORKBENCH_SOURCES_FILE:...}`，消除环境变量漂移；`mvn test` 全绿。
  - 前端：删除未挂载旧代码（`src/modules`、`src/components`、`src/styles`、`src/api/http.ts`、`src/types`、`src/utils` 等，以 `tsc` 校验后删除）；删除 `public/vendor/vditor`（531 文件 / 21.9MB）、`sync:vditor` 脚本与 `react-router-dom` 依赖；删除 DocsPage 及文档 API / 类型 / localStorage 键；删除演示模式（模式探测、mock 数据、演示密码回落、`devconsole.docs.v1` / `devconsole.tools.v1` / `devconsole.lockPassword.v1`）；删除集成工具 dialog 与 ToolForm；保留 Dashboard / Projects 以服务端模式运行作为过渡；`pnpm build` 零错。
  - 部署：`Caddyfile` 改为 `workbench.imhgl.com` 托管前端静态产物 + `/api` 反代 `workbench:8080`（SPA fallback）；`docker-compose.yml` 删除 `DOCS_ROOT`、`workbench-docs` 卷与 `CORS_ALLOWED_ORIGINS`；前端产物分发方式定稿并在 README 部署节记录；删除 GitHub Pages 部署工作流；`.env.example` 同步。
  - 清理：删除根目录构建日志（`m7p2-build.log` / `m8-build.log` / `m8b-build.log`）与 `docs/superpowers` 旧计划；清理 `backend/workbench-server/data` 测试残留。
  - 行为：单域名打开即登录页；登录后总览与项目页取真实数据；全仓库 `rg "com\.imhgl\.workbench\.docs|vditor|VITE_API_BASE|CORS_ALLOWED_ORIGINS"` 零命中（历史文档与忽略目录除外）。
  - 数据：根目录 `data/` 下的历史 metrics / sources.json 原样保留，不清除、不改写。
- 边界：不新增拨测 / 快照能力；不重画剩余页面（M17 负责）；不动历史数据；不引入新依赖。
- 状态：in-progress
- 进度（只追加新行，不修改旧行）：
  - 2026-11-12 计划 三文档按新定位重写，任务卡确认
  - 2026-11-12 计划 README 改为开源结构、AGENTS 精简（验收范围不变）
  - 2026-11-12 计划 README 移除贡献与致谢栏，补充 MIT 许可证
  - 2026-11-12 计划 README 移除 API 栏
  - 2026-11-12 计划 README 移除配置栏，配置对照迁入 AGENTS §4.3
  - 2026-11-12 计划 README 架构栏迁入 AGENTS §4.1
  - 2026-11-12 执行 删除 docs 域与 storage、前端死代码/演示模式/集成工具，合并单域名部署（前端产物进 Caddy 镜像）
  - 2026-11-12 验证 mvn clean test 78/78 通过；pnpm build 通过（45 模块，dist 772KB）；残留扫描零命中
  - 2026-11-12 交付 T1 完成，验收证据见上两行
  - 2026-11-12 验证 开发态实测通过：密码登录 → 看板真实数据 → 项目页日志 → 锁屏 → 重登；401 与登录接口 curl 实测
  - 2026-11-12 计划 更正：「交付 T1 完成」仅指代码 / 构建 / 联调范围；本机无 Docker/Caddy，单域名运行时未验证，T1 保持 in-progress

### T2 M15 主动拨测（P0）

- 目标：为自有服务与开源项目静态页提供 HTTP 拨测：目标配置、定时探测、结果入库、现有查询可直接消费。
- 动机：被动流量回答不了「网站挂了没」——挂了就没人上报。
- 验收标准：
  - 拨测目标可增删改（名称 + URL + 启用），持久化于源配置文件，重启不丢。
  - 默认 1 分钟粒度调度；单目标超时/失败不影响其他目标；实现用 JDK `HttpClient`，零新增依赖。
  - 结果以合成流量记录入库复用 `TimeSeriesStore`：`status` = HTTP 码（连接失败记 0）、`totalMs` = 延迟、`count` = 1；`source` 命名在 AGENTS §6.4 与 §7.2 登记。
  - WHEN 配置 2 个真实目标 THEN 1 分钟内 `recent` / `series` 出现记录；WHEN 手动停掉其一 THEN 该目标状态可判定为异常（API 层验证，页面红色归 M17 验收）。
  - 重启后配置与历史数据不丢（重放生效）；`mvn test` 全绿，新增用例覆盖超时、连接失败与非 2xx。
- 边界：不做主动告警推送；不做原始文本日志聚合；不做外部 uptime 服务集成；不建第二套存储。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-12 计划 任务卡确认

### T3 M16 GitHub 每日快照（P1）

- 目标：在现有 traffic 采集之上增加每日快照（stars / forks / watchers / open issues）与 releases 下载量。
- 动机：项目定位要回答「有没有人看我的项目」，互动数据不能只有 views/downloads。
- 验收标准：
  - collector 每日快照入库，快照类指标取「日末值」语义（不求和），`source = github/{owner}/{repo}`、`endpoint = 指标名`，映射登记到 AGENTS §6.4。
  - releases 下载量并入采集与查询。
  - 重启后快照连续，不重新起算基线；token 缺失时状态可见且不报 500。
  - `mvn test` 全绿，新增用例覆盖快照解析、日末值语义与重启连续性。
- 边界：不接第三方 star 历史数据集；不新增约定之外的指标；不改前端（M17 统一消费）。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-12 计划 任务卡确认

### T4 M17 前端四页（P0）

- 目标：按新定位把控制台重画为总览 / 服务与站点 / 开源项目 / 设置四页，全部消费真实数据。
- 动机：现有三页（看板 / 项目 / 文档）是旧定位的载体，信息架构与新锚点错位。
- 验收标准：
  - 四页可用且互不重复：总览聚合全部对象健康；服务与站点展示拨测状态 / 可用率 / 延迟与自有服务访问记录；开源项目展示 traffic 曲线与快照读数；设置管理数据源、token、主题与锁屏。
  - WHEN 停掉一个拨测目标 THEN 总览与服务与站点页出现红色异常态。
  - 桌面 1440 / 移动 390 逐页无横向溢出；`pnpm build` 零错；`prefers-reduced-motion` 生效。
  - 无演示模式、mock 数据与占位假数据；接口错误显示提示条并保留上次数据。
- 边界：不新增后端接口（除 T2 / T3 已建）；不扩设计系统超出 `console.css` 原语；不恢复已删功能。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-12 计划 任务卡确认

### T5 M18 收尾验收（P0）

- 目标：按下文「验收清单」全量验证，三文档按分频规则同步，Backlog 有条目。
- 验收标准：验收清单 1–5 全部满足，且每条附命令或操作证据。
- 边界：不新增功能；只修验收暴露的问题。
- 状态：planned
- 进度（只追加新行，不修改旧行）：
  - 2026-11-12 计划 任务卡确认

## Backlog（已登记、本期不做）

- 主动告警推送：站点挂了主动通知（Bark / Telegram / 邮件 / webhook），含防抖、恢复通知与静默时段。
- md 笔记记录地：独立 Markdown 记录空间（暂缓；如恢复，FileTreeStorage 可从 git 历史取回）。
- 原始文本日志聚合：tail / grep 各服务日志（2C2G 上需严格限额与保留策略）。
- Star 历史曲线：长周期增长曲线（依赖第三方数据集）。

## 状态枚举

| 状态 | 含义 |
|---|---|
| planned | 已建卡确认，未动手 |
| in-progress | 执行中 |
| done | 验收标准全部满足且有验证证据 |
| blocked | 受阻；最新进度行注明原因与可否绕行 |
| canceled | 放弃；最新进度行注明原因 |

## 卡面约定

- 进度行格式：`YYYY-MM-DD 阶段 结果一句话`，阶段取 计划 / 执行 / 验证 / 交付 之一；只追加不改写，历史即审计记录。
- WHEN / THEN 写法用于接口与交互类验收：WHEN <操作> THEN <可观察结果>。
- done 卡不删：完成的任务保留在任务清单中，进度即项目史。

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M14 | 减法与部署合并：删 docs 域 / 演示模式 / 死代码，单域名部署 | in-progress |
| M15 | 主动拨测：目标配置 + 定时探测 + 合成流量入库 | planned |
| M16 | GitHub 每日快照与 releases 下载量 | planned |
| M17 | 前端四页：总览 / 服务与站点 / 开源项目 / 设置 | planned |
| M18 | 收尾：全量验收 + 三文档按分频规则同步 | planned |

## 验收清单（改造总验收）

1. **减法**：仓库无死代码 / vendor 残留；`mvn test` 与 `pnpm build` 全绿；全仓库无 docs 域引用；单域名打开即登录页，登录后全功能可用，无任何 CORS 配置项。
2. **拨测**：2 个真实拨测目标 1 分钟粒度入库；停掉其一后该目标状态可判定为异常（API 验证），并在 M17 后于总览 / 服务与站点标红。
3. **GitHub**：接入仓库后 traffic 曲线与每日快照（stars 等）可见，重启后快照连续不重置。
4. **数据边界**：历史数据（根目录 `data/`）原样保留；新增数据全部来自真实探测 / 采集；零模拟写入；只清理测试残留。
5. **文档**：三文档按分频规则同步——README 仅定位 / 结构 / 用法 / 环境变化时更新，AGENTS 仅规范变化时更新，DEVELOP_PLAN 随任务更新（进度追加、状态流转）；配置键、package-info、错误码映射与代码一致；md 笔记与主动告警在 Backlog 有明确条目。

## 历史

M1–M13（2026-08 → 2026-11，67 次提交，标签 v1.0.0–v1.5.0）已归档于 git 主干；随本次重新定位，旧任务卡不再保留，本文件从 M14 重新起算。
