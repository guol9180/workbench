# 开发规范

> 项目背景见 [README.md](./README.md)，当前计划与验收见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。本文件只回答「改代码必须遵守什么」。

## 1 通用规范

### 1.1 必建四条

1. **复用优先，不过度设计**：同一逻辑或结构出现第二份副本时，立即抽取为公共函数 / 公共样式 / 公共组件；前端页面表现优先组件化；保证代码质量，不为假想的未来需求预先抽象。
2. **文档同步**：DEVELOP_PLAN.md 随任务同步（进度只追加、状态如实流转）；AGENTS.md 仅在开发规范变化时更新；README.md 仅在项目定位、结构、用法或环境变化时更新——新增功能默认只记录在 DEVELOP_PLAN.md，不逐条追加进 README，README 不是变更日志。文档与代码不同步视为任务未完成。
3. **计划执行分离**：动手前先在 DEVELOP_PLAN.md 建任务卡（目标、验收标准、边界）并确认；执行中不得顺手扩范围，需求或范围变化先回任务卡更新，再改代码。
4. **诚实终态**：声明完成必须附实际产出文件与验证证据（执行了什么、结果如何）；未运行的测试或验证不得声称通过；受阻时如实标注 blocked 并写明原因与可否绕行。

### 1.2 项目追加

5. **代码质量优先**：抽象必须服务当下真实需求，能回答「它解决了什么已发生的问题」；可读、可测、可维护优先于技巧。
6. **注释与命名**：分别见 [§2](#2-注释规范) 与 [§3](#3-命名与代码风格)。
7. **数据边界**：前端禁止伪造服务端数据；服务端只存真实探测、采集与用户操作产生的数据；禁止未经同意向持久层写入模拟数据（含模拟 ingest）；测试一律使用临时目录。
8. **前端原语统一**：见 [§8](#8-前端约定)。

## 2 注释规范

1. **公共契约必写 Javadoc**：类、接口、公共方法说明职责、参数语义、返回与抛错约定。
2. **解释「为什么」并记录取舍**：上限、短路、值对象、守卫等决策点写动机与代价；不复述代码字面。
3. **与代码同步**：改行为必须改注释；过时注释直接删除。
4. **package-info 同步**：每个模块根包的 package-info 与 [§6](#6-模块职责) 对应小节是同一规范的两个载体。

## 3 命名与代码风格

1. **命名完整表意**：禁止 `a` / `b` / `x` / `tmp` / `data1` / `foo`，局部变量同样适用；读者不回看上下文就能判断它承载什么。
2. **缩写与词形**：缩写只用领域通用词（`url` / `id` / `request`）；循环索引用 `index` / `pointIndex`；Boolean 用 `is` / `has` / `can`；集合用复数。
3. **不可变优先**：record 能覆盖的场景优先 record；设计意图能用 `final` 表达就不省略。
4. **语言**：注释、文案、提交信息用中文；代码标识符用英文。

## 4 架构与目录约定

模块化单体：所有能力打包为一个 Spring Boot 应用，业务按模块隔离，模块间只经 `api` 层交互，统一由 `workbench-server` 启动。

### 4.1 结构与数据流

```text
frontend（React 控制台）
        │  /api
        ▼
workbench-server（聚合启动）
        │
        ├─ workbench-module-monitor   观测域：自监测 / ingest / 查询 / 拨测 / GitHub 采集
        │        │
        │        ▼
        ├─ workbench-infrastructure   中性 JSONL 时序存储
        ├─ workbench-framework        Web 框架能力：异常映射 / 校验 / OpenAPI / 认证
        └─ workbench-common           响应与异常契约（零业务、零 Spring 依赖）
```

```text
backend/
├── workbench-common/          # 响应与异常契约（零业务、零 Spring 依赖）
├── workbench-framework/       # Web 框架能力（异常映射 / 校验 / OpenAPI / 认证）
├── workbench-infrastructure/  # 中性 JSONL 时序存储
├── workbench-module-monitor/  # 观测域（/api/monitor/**）
└── workbench-server/          # 聚合启动（main + 配置，禁止业务、禁止被依赖）
frontend/src/console/          # React 控制台（四页）
```

模块命名：`workbench-module-<x>` ↔ 包 `com.imhgl.workbench.<x>`，HTTP 接口挂 `/api/<x>/**`。

### 4.2 业务模块内部结构

```text
com.imhgl.workbench.<x>/
├── api/          # 对外唯一契约；impl/ 适配 infrastructure 中性模型
├── controller/   # 端点，dto + @Valid，不收裸 Map
├── dto/          # 请求入参（record + jakarta validation）
├── model/        # 领域与出参模型（record；含值对象）
└── service/      # 模块内业务服务
```

1. controller 薄到「接参 → 调 api → 包 ApiResult」，不写业务规则。
2. 有不变量约束的概念（如查询区间）做成值对象，不让裸字符串穿透 service 层。
3. 新增模块先在本文件 §6 登记职责，再建模块、加父 POM `<module>` 与 server 依赖；未经确认不新增 Maven 模块。

### 4.3 配置命名

1. 业务模块用 `workbench.<module>.*`；infrastructure 用中性命名（如 `workbench.metrics.*`），禁止业务前缀。
2. 环境变量映射保持部署稳定——**改配置键不改环境变量**；新增配置键必须登记本表与 `application.yml` 注释：

| 配置键 | 环境变量 | 默认 |
|---|---|---|
| `server.port` | `SERVER_PORT` | 8080 |
| `workbench.auth.password-sha256` | `AUTH_PASSWORD_SHA256` | 空 |
| `workbench.auth.machine-token` | `API_TOKEN` | 空 |
| `workbench.auth.session-ttl-hours` | — | 168 |
| `workbench.metrics.data-dir` | `METRICS_DATA` | `./data/metrics` |
| `workbench.metrics.retention-days` | — | 14 |
| `workbench.metrics.flush-interval-seconds` | — | 5 |
| `workbench.sources.file` | `WORKBENCH_SOURCES_FILE` | `./data/sources.json` |
| `workbench.sources.github-token` | `GITHUB_TOKEN` | 空 |
| `workbench.sources.cron` | `SOURCES_CRON` | `0 5 8,20 * * *` |
| `workbench.probe.enabled` | — | true |
| `workbench.probe.interval-seconds` | — | 60 |
| `workbench.probe.timeout-ms` | — | 5000 |
| `springdoc.api-docs.enabled` | `SPRINGDOC_API_DOCS_ENABLED` | true |

3. 同源单部署，不再提供 CORS 配置；禁止重新引入跨域部署形态。

## 5 依赖规则

```text
workbench-server         → workbench-module-monitor（传递 framework / infrastructure / common）
workbench-module-monitor → workbench-framework、workbench-infrastructure、workbench-common
workbench-framework      → workbench-common
workbench-infrastructure → workbench-common
workbench-common         → 零依赖
```

1. 依赖方向由各模块 pom 强制保证；禁止循环依赖，禁止任何模块依赖 `workbench-server`。
2. common / framework / infrastructure 禁止依赖业务模块；业务模块只经 `api` 层交互。
3. 业务模块经 framework 获得 Web 与校验能力，经 infrastructure 获得中性时序存储。
4. Lombok / Hutool 只在父 POM `dependencyManagement` 管版本，谁用谁声明；common 保持零依赖。新增第三方依赖必须先登记 README 技术栈。

## 6 模块职责

各模块根包的 `package-info.java` 与本节同步。

### 6.1 workbench-common

统一响应与异常契约：`ApiResult<T>(message, code, data)`（code=0 成功）、`ErrorCode`、`BusinessException`、通用常量。零业务、零 Spring 依赖、零端点。

错误码：`PARAM_INVALID(40000)` / `UNAUTHORIZED(40100)` / `NOT_FOUND(40400)` / `CONFLICT(40900)` / `METHOD_NOT_ALLOWED(40500)` / `INTERNAL_ERROR(50000)`。

### 6.2 workbench-framework

Web 通用能力：全局异常处理、参数校验、SpringDoc/OpenAPI、认证（Token 过滤器 + `/api/auth/login|logout` 认证端点）、请求上下文。

禁止业务逻辑、业务 DTO、业务端点（认证端点属框架机制，是唯一例外）。

### 6.3 workbench-infrastructure

外部技术组件的中性封装：`TimeSeriesStore`（append / replace / sources / overview / series / topEndpoints / recent / status / flush / close）、`JsonlTimeSeriesStore`（分钟聚合桶 + 蓄水池延迟采样 + 按天 JSONL 刷盘 + 启动重放 + 保留清理）、`TrafficRecord` 与查询模型（SourceStat / Overview / SeriesPoint / EndpointRank / RecentRecord / StoreStatus）、`MetricsProperties`。`series` 的 metric 支持 `count / errCount / avgMs / last`——`last` 取桶内最后写入值，供快照类指标使用。

只产出中性模型与中性配置，禁止业务语义与业务色彩命名。文件树存储随 docs 域删除；若恢复 md 笔记能力，从 git 历史取回。

### 6.4 workbench-module-monitor

观测域：自监测、ingest 上报枢纽、查询、主动拨测、GitHub 采集与快照、源配置管理。

内部结构：`api/`（`MonitorApi` + `impl/`）、`controller/`、`dto/`、`model/`（`TimeRange` 等）、`service/`、`collector/`、`probe/`。

- **TimeRange**：`5m|1h|6h|24h|7d|14d|30d` 的解析与校验收拢在 model，非法值 → 400。
- **自监测**：`TrafficRecordFilter` 拦 `/api/**`（order 先于 Token 过滤器），`source="workbench"`；路径归一化（数字段 `{n}`、UUID 段 `{u}`）；异步有界队列，队列满丢弃并计数，绝不阻塞请求。
- **上报**：外部系统按 ingest 结构 POST，`source` 自带标识，数据进同一时序存储。
- **源配置**：`SourceConfigStore` 独占读写 JSON 配置（`workbench.sources.file`）；同 repo 重复接入 → `CONFLICT(40900)`；删除源只停采集，历史数据按保留策略自然过期。
- **GitHub 采集**：cron 定时 + 手动触发，JDK `HttpClient` 只读调用，零新增依赖。映射分两类：流量用 `source=github/{owner}/{repo}`、`endpoint=views/downloads`、`count=增量`（相对上次采集，重启重新起算）、`ts=数据所属日`（UTC 日零点对齐分钟）；快照用独立来源 `source=snapshot/github/{owner}/{repo}`、`endpoint=stars/forks/watchers/openIssues`、`count=绝对值`、`ts=UTC 日桶`，每次采集都写、同日覆盖（不累加），查询用 `metric=last` 取日末值。两类 source 分离是为了避免快照绝对值污染流量求和；openIssues 为 GitHub 口径（含 PR）。
- **token**：设置页可运行期设置（`PUT|DELETE /api/monitor/settings/github-token`），持久化于 sources.json，优先级页面 > `GITHUB_TOKEN`；任何接口不回显 token。
- **主动拨测（M15）**：目标列表持久化于 sources.json 的 `probes` 区，目标名与 URL 均唯一；调度默认 60 秒、单目标超时 5 秒。结果以合成流量记录入库：`source = probe/{name}`、`endpoint = url`、`method = GET`、`status = HTTP 码（连接失败/超时记 0）`、`count = 1`、`totalMs/maxMs = 延迟`，延迟样本供 p95 使用。启用开关只影响调度，不删历史数据；改名等于换 source，历史留在旧 source、不迁移。

### 6.5 workbench-server

启动与聚合：Spring Boot 启动类（`@ConfigurationPropertiesScan`）、`application.yml`、日志配置。禁止业务代码与端点；禁止被任何模块依赖。

## 7 API 设计约定

统一包装 `ApiResult{message, code, data}`，`code=0` 成功。

### 7.1 认证（双凭据）

- `AUTH_PASSWORD_SHA256`：`POST /api/auth/login` {password} 常量时间比对后签发会话令牌（内存态，默认 168 小时，重启失效）；连续 5 次失败全局锁 60 秒（429 + Retry-After）。
- `API_TOKEN`：机器凭据，供 ingest 静态携带。
- 任一非空 = 认证开启，`/api/**`（`/api/auth/**` 与 Swagger 除外）须带 `X-API-Token`，失败 → 401 + `UNAUTHORIZED(40100)`；两者皆空 = 关闭。
- `POST /api/auth/logout` 失效当前会话。

### 7.2 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/monitor/ingest` | 外部流量上报 |
| GET | `/api/monitor/sources` | 来源列表（含 `workbench`） |
| GET | `/api/monitor/overview` | 区间总览（source / range） |
| GET | `/api/monitor/series` | 时序（metric=count/errCount/avgMs/last；可带 endpoint 过滤） |
| GET | `/api/monitor/top-endpoints` | 端点排行（source / range / limit / by） |
| GET | `/api/monitor/recent` | 最近分钟桶（source / limit 1..500） |
| GET | `/api/monitor/status` | 自检（不回显 token） |
| PUT / DELETE | `/api/monitor/settings/github-token` | 页面级 token 设置 / 清除 |
| GET / POST | `/api/monitor/source-configs` | 列表 / 接入 |
| PUT / DELETE | `/api/monitor/source-configs/{id}` | 修改 / 停采集 |
| POST | `/api/monitor/source-configs/{id}/collect` | 手动采集 |
| GET | `/api/monitor/github/repos` | 当前 token 可见仓库（上限 100） |
| GET | `/api/monitor/probe-targets` | 拨测目标列表 |
| POST | `/api/monitor/probe-targets` | 新增拨测目标（name / url / enabled） |
| PUT | `/api/monitor/probe-targets/{id}` | 修改拨测目标 |
| DELETE | `/api/monitor/probe-targets/{id}` | 删除目标（停拨测，历史数据自然过期） |
| POST | `/api/auth/login` | 密码换会话令牌 |
| POST | `/api/auth/logout` | 失效当前会话 |

新端点必须先登记本表再写代码。

### 7.3 参数与错误

- 源配置：`type=github`；`repo=owner/name`；`metrics ⊆ {pages, downloads}`；重复 → 400 + `40900`；不存在 → 400 + `40400`；校验失败 → 400 + `40000`。
- 拨测目标：`name` 1..40 字符且不含 `/` 与控制字符；`url` 仅接受 http / https；重名或同 URL → 400 + `40900`；不存在 id → 400 + `40400`；校验失败 → 400 + `40000`。
- 查询：`range` / `metric` / `step` / `by` 非法 → 400 + `40000`；`metric ∈ {count, errCount, avgMs, last}`（last = 快照桶内最后值）；`ts` 为分钟级 epoch 毫秒；错误判定 = status 0（连接失败/超时）或 ≥ 400；`rps` = count / 区间秒数。
- 映射：业务异常 → 400 + 语义码；未知路由 → 404；方法不支持 → 405 + `40500`；校验 / 缺参 → 400 + `40000`；未认证 → 401 + `40100`；未知异常 → 500 + `50000`，不泄漏堆栈与类名。

## 8 前端约定

1. **入口**：活动代码在 `frontend/src/console/`（`ConsoleApp` / `OverviewPage` / `ServicesPage` / `OssProjectsPage` / `SettingsPage` / `Sparkline` / `LockScreen` / `Icon` / `data.ts` / `api.ts` / `console.css`）；`App.tsx` 只渲染 `ConsoleApp`，`main.tsx` 只加载字体、`console.css` 与主题初始化。
2. **页面**：总览 / 服务与站点 / 开源项目 / 设置四页。
3. **视觉与交互**：`console.css` 是唯一视觉源；图标只来自 `Icon.tsx`，禁止内联手写 SVG（品牌 logo 除外）；常用 UI（按钮、表单、面板、空态、加载态）原语化复用；交互覆盖 hover / active / focus-visible / disabled / loading；动效走 `--dur-fast` / `--dur` / `--ease` 并尊重 `prefers-reduced-motion`。
4. **模式**：只运行服务端模式，同源 `/api` 取真实数据；不保留演示模式与 mock；网络错误显示提示条并保留上次数据。
5. **接口封装**：`api.ts` 统一处理同源基地址、`X-API-Token`（令牌只存内存）、`ApiResult` 解包、`code != 0` 抛错、401 回锁屏。
6. **本地存储**：仅主题 / 侧栏 / 锁屏状态（`devconsole.theme.v1` / `devconsole.sidebar.v1` / `devconsole.locked.v1`）；会话令牌只存内存。
7. **验收基准**：桌面 1440 / 移动 390 无横向溢出；`pnpm build` 零错。

## 9 流程要求

1. **计划先行**：动手前更新 DEVELOP_PLAN 任务卡并确认；需求或范围变化先回任务卡（见通用规范第 3 条）。
2. **分支与提交**：个人项目默认直接提交 `main`；需要隔离的试验用 `codex/<topic>` 分支；提交信息中文简述并标注任务卡编号（如 `T1`）。
3. **验证**：后端改动跑 `mvn test`（局部 `JAVA_HOME`）；前端改动跑 `pnpm build`；涉及数据或部署的改动附命令与结果。未验证不得声明通过。
4. **JDK 隔离**：JDK 25 只以局部 `JAVA_HOME`（命令内或 `start.bat`）引用，禁止写入系统 / 用户环境变量。

## 10 禁止事项

1. 禁止在 common / framework / infrastructure / server 写业务逻辑；禁止在启动模块写端点。
2. 禁止引入数据库、ORM、缓存、对象存储；存储只用文件系统。
3. 禁止模拟数据写入持久层，禁止服务端返回 mock / 演示数据。
4. 禁止恢复已删除的 docs 域、演示模式、集成工具与死代码——除非先在 DEVELOP_PLAN 立卡确认。
5. 禁止未登记就新增第三方依赖；禁止把大体积 vendor、构建产物、日志提交进仓库。
6. 禁止页面内联手写 SVG 与另造按钮 / 标签 / 加载态观感。
