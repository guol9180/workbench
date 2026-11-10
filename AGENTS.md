# AGENTS.md

## 0. 总则

本项目为**个人后台管理系统（学习项目）**：以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体，定位是**流量监测 + 工具集**——当前含流量监测域（monitor）与第一个工具模块**在线 Markdown 文档（docs）**，后续工具以业务模块形式渐进扩展。

所有参与本项目开发的人员、AI Agent、代码生成工具，都必须严格遵守本文件中的架构规范、模块规范、命名规范、依赖规则与 API 约定。

如果口头需求、临时讨论、历史代码与本文件冲突，原则上以本文件为准。如果确实需要调整架构，必须先修改本文件，再修改代码。

---

## 通用规范（必建两条 + 项目追加）

1. **复用优先，不过度设计**：同一逻辑或结构出现第二份副本时，立即抽取为公共函数 / 公共样式 / 公共组件；前端页面表现优先组件化；保证代码质量，不为假想的未来需求预先抽象。
2. **文档同步**：每次开发结束或提交之前，同步更新 README.md、AGENTS.md、DEVELOP_PLAN.md；文档与代码不同步视为任务未完成。
3. **代码质量优先（项目追加）**：对代码质量要求高——凡能通过合理的设计模式或算法优化提升清晰度、健壮性与性能处，积极实践；但必须服务于当下真实需求，拒绝炫技式、无收益的抽象。每处抽象都要能回答「它解决了什么已发生的问题」。
4. **注释质量（项目追加）**：注释要规范且易懂，以「帮助下一次阅读的人真正理解代码」为标准；具体要求见下节「注释规范」，与代码同等对待——注释缺失或过时视为未完成。
5. **数据边界（项目追加）**：前端演示/测试允许自造 mock 数据（仅存在于组件与前端状态，不落盘）；禁止未经同意向任何持久层（时序存储、文档库、配置等）写入数据——包括模拟 ingest 上报、伪造外部源、创建样例文档；接入真实外部数据源属于架构级动作，必须先征得同意并说明形态。未经同意写入的数据视为事故，发现即清除。
6. **命名规范（项目追加）**：变量、函数、类型、文件命名必须完整表意，禁止 `a` / `b` / `x` / `tmp` / `data1` / `foo` 这类随意或简陋命名——**局部变量同样适用，作用域小不是豁免理由**；衡量标尺 = 读者不需要回看实现与上下文，就能判断这个变量承载什么。缩写只接受领域通用词（如 `url`、`id`、`request`），循环索引用 `index`、`pointIndex` 这类可读名，不得用单字母；Boolean 走 `is/has/can` 前缀，集合用复数名。
7. **组件与图标统一（项目追加）**：常用 UI 必须复用 `components/ui` 原语（PageHeader / Button / IconButton / Tag / Spinner / Segmented / Chip / Panel / Banner / Field / EmptyState），图标只能来自 `components/ui/Icon.tsx`——禁止页面内联手写 SVG（品牌 logo 除外）、禁止另造按钮/标签/加载态观感。交互至少覆盖 hover / active / focus-visible / disabled / loading，动效统一使用 `--dur-fast` / `--dur` / `--ease` 并尊重 `prefers-reduced-motion`；新增常用件先入 `components/ui`，再在页面使用。

---

## 注释规范（学习项目）

本项目是学习项目，注释是写给「下一次阅读的人（含未来的自己）」的教材，与代码同等重要：

1. **公共契约必写 Javadoc**：类、接口、公共方法说明职责、参数语义、返回与抛错约定（如 `FileTreeStorage.read` 须写明「文件不存在抛 StorageException(NOT_FOUND)」）。
2. **解释「为什么」，不复述「做什么」**：`i++` 不需要注释；「为什么上限是 100」「为什么先物化路径清单再懒读内容」必须注释。
3. **记录设计取舍**：值对象、守卫、算法短路这类决策点，注明动机与代价（如 `DocPath` 拒绝空段而非折叠——把理由写出来）。
4. **与代码同步**：改行为必须改注释；过时的注释比没有更糟，删除优于留错。
5. **语言与文风**：中文、简练、直给；一行说得清的不写三行；不复读代码字面。
6. **package-info 承载架构说明**：每个模块根包的 package-info 与 AGENTS.md 3.x 对应小节是同一规范的两个载体，修改时必须同步。

---

## 1. 架构定位

> **模块化单体**（学习项目：用最小的业务面留住完整的架构分层）

1. 单体部署，统一由 `workbench-server` 启动。
2. 业务代码按模块隔离；模块之间只通过 `api` 层交互，禁止跨模块访问 `model`、`service.impl`、`controller`。
3. 公共能力下沉 `workbench-common`，框架能力沉淀 `workbench-framework`，技术设施沉淀 `workbench-infrastructure`。
4. 禁止在公共模块、框架模块、技术设施模块中写业务逻辑；禁止在启动模块中写业务逻辑。
5. **纯文件存储，无数据库**：文档即文件（`.md`），不引入 MySQL / Redis / OSS 等外部服务；监测时序数据同样零依赖——用 infrastructure 的中性 JSONL 时序存储（接口抽象，将来可无感替换实现）。
6. **轻量 Token 认证**：`workbench.auth.token` 非空时 `/api/**` 校验请求头 `X-API-Token`（失败 401 + `UNAUTHORIZED(40100)`）；空值 = 认证关闭（本地开发与既有测试零回归）。单 Token、无用户体系。
7. 前端已于 UI 重做期（M5）对齐 v2 API：后端契约（路径 / 字段 / 错误码）变更时，必须同步 `frontend/src/modules/*/api.ts` 与 AGENTS 第 8 节。
8. 架构演进渐进式，未经确认不新增 Maven 模块。

---

## 2. Maven 模块结构

```text
workbench-backend
├── workbench-common             # 响应与异常契约（零业务、零 Spring 依赖）
├── workbench-framework          # Web 框架能力（异常映射 / 校验 / CORS / OpenAPI / Token 认证，零端点）
├── workbench-infrastructure     # 技术设施（中性文件树存储 + 中性 JSONL 时序存储）
├── workbench-module-docs        # 工具：在线 Markdown 文档（/api/docs/**）
├── workbench-module-monitor     # 流量监测域：自监测 + 上报枢纽 + 查询（/api/monitor/**）
└── workbench-server             # 聚合启动（main + 配置，禁止业务、禁止被依赖）
```

模块命名约定：`workbench-module-<x>` 对应包名 `com.imhgl.workbench.<x>`，HTTP 接口统一挂 `/api/<x>/**`。

---

## 3. 各模块职责细则

各模块根包的 `package-info.java` 与本节是同一规范的两个载体，修改时必须同步。

### 3.1 workbench-common（com.imhgl.workbench.common）

职责：统一响应与异常契约，全局最小公约数。

- 允许存放：统一返回结果 `ApiResult`、错误码枚举 `ErrorCode`、业务异常 `BusinessException`、通用常量与基础工具。
- 禁止存放：任何业务逻辑、Spring 依赖、HTTP 端点、技术设施封装。
- 当前内容：`record ApiResult<T>(message, code, data)`（code=0 成功）、`ErrorCode`（PARAM_INVALID / UNAUTHORIZED / NOT_FOUND / CONFLICT / METHOD_NOT_ALLOWED / INTERNAL_ERROR）、`BusinessException`。

### 3.2 workbench-framework（com.imhgl.workbench.framework）

职责：Web 应用运行所需的通用框架能力。

- 允许存放：全局异常处理（业务异常→400 语义错误码；校验失败→400 `PARAM_INVALID`；未知→500 不泄漏细节）、参数校验、CORS 配置、SpringDoc/OpenAPI 配置、轻量认证机制（Token 过滤器 + `/api/auth/login|logout` 认证端点——M9.5 起修订放行，属认证机制而非业务端点）、请求上下文等 Web 通用机制。
- 禁止存放：HTTP 端点（一律放业务模块）、业务逻辑、业务 DTO。
- 当前内容：`handler/GlobalExceptionHandler`、`config/`（CorsProperties、CorsConfig、OpenApiConfig、AuthProperties）、`filter/AuthFilter`、`auth/`（LoginService 密码→会话签发与失败锁定、AuthController 认证端点）。CORS 在 Filter 层处理（CorsFilter 先于 ApiTokenFilter，401 响应也带跨域头），不用 MVC 层 CORS——原因见 CorsConfig Javadoc。

### 3.3 workbench-infrastructure（com.imhgl.workbench.infrastructure）

职责：外部技术组件与资源的中性封装。

- 允许存放：文件树存储（防路径穿越、扩展名白名单、受控读写）、监测时序存储（JSONL 聚合桶、重放、保留策略）、未来可能的缓存 / 对象存储等中性封装。
- 禁止存放：业务规则、业务 Controller / Service / DTO；禁止业务色彩命名。
- 当前内容：`storage/`——`FileTreeStorage`（受控文件系统入口：resolve / validateName / validateExtension / isAllowedFile / tree / listAllowedFiles / read / create / save / createDir / rename / delete / toRel）、`record StorageNode`（中性树模型）、`StorageException`（中性状态异常，NOT_FOUND / CONFLICT，由业务模块翻译）、`FileStorageProperties`（`workbench.storage.*`）；`metrics/`——`TimeSeriesStore`（中性时序存储契约：append / sources / overview / series / topEndpoints / flush / close）、`JsonlTimeSeriesStore`（零依赖实现：内存分钟聚合桶 + 蓄水池延迟采样 + 按天 JSONL 刷盘 + 启动重放 + 保留清理）、`TrafficRecord`（中性流量记录）与查询模型（SourceStat / Overview / SeriesPoint / EndpointRank）、`MetricsProperties`（`workbench.metrics.*`）。
- 附加规则：只产出中性模型与中性配置；业务语义由业务模块的 api 实现层适配。

### 3.4 workbench-module-docs（com.imhgl.workbench.docs）

职责：在线 Markdown 文档业务——文件树、在线读写保存、新建文档/文件夹、重命名、删除、全文搜索。

- 内部结构：`api/`（`DocsApi` 对外唯一契约 + `impl/` 适配实现）、`controller/`（八端点，只注入 `DocsApi`）、`dto/`（请求入参 record + jakarta validation）、`model/`（领域与出参 record，含 `DocPath` 值对象）、`service/`（模块内业务服务，如 `DocSearchService`）。
- **`DocPath` 值对象约定**：相对路径的归一化与安全校验收拢在 `model/DocPath`，service 层一律以 `DocPath` 流转；api/controller 边界收 `String`，跨模块友好。
- 搜索：文件名与内容双匹配、大小写不敏感、上限 100、懒遍历短路（命中即停，不整树物化）、结构化 `SearchHit{path, name, fileNameMatch, line, snippet}`。

### 3.5 workbench-module-monitor（com.imhgl.workbench.monitor）

职责：流量监测域——本系统 API 自监测（Filter 采集）、外部系统通用上报（ingest 枢纽）、**外部数据源拉取采集（collector，M6 起）**、面向管理台的查询（sources / overview / series / top-endpoints / status）与**数据源配置管理（source-configs，M6 起）**。

- 内部结构：`api/`（`MonitorApi` 对外唯一契约 + `impl/` 适配 infrastructure 中性查询模型）、`controller/`（监测与源配置端点，只注入 `MonitorApi`）、`dto/`（`IngestRequest`/`Point` 与 `SourceConfigRequest`，record + jakarta validation）、`model/`（`TimeRange` 值对象与业务查询模型）、`service/`（`MonitorService` 查询编排与采集入口、`TrafficRecordFilter` 自监测过滤器）、`collector/`（源配置文件存储、GitHub 采集客户端与调度，M6 起）。无 entity / mapper。
- **`TimeRange` 值对象约定**：查询区间 `5m|1h|6h|24h|7d|14d|30d` 的解析与校验收拢在 model，非法值抛 `IllegalArgumentException` → 400。14d/30d 为 M13 前端联调新增档位（走势图近 14/30 天视图）；数据可见性仍受 retention-days 约束。
- **自监测约定**：`TrafficRecordFilter` 拦 `/api/**`（order 先于 Token 过滤器，未认证请求也计入流量），`source="workbench"`；路径归一化（纯数字段→`{n}`、UUID 段→`{u}`）；异步投递有界队列，队列满丢弃并计数、绝不阻塞业务请求。
- **上报枢纽**：外部系统按 `IngestRequest` 结构 POST 到 `/api/monitor/ingest`，`source` 自带标识（如 `nginx`、`server-a`），数据进同一时序存储。
- **源配置约定（M6）**：配置持久化为 JSON 文件（`workbench.sources.file`，默认 `data/sources.json`），由 `SourceConfigStore` 独占读写；仓库范围由用户在配置页管理，**运行期配置而非 yml**。同 repo 重复接入 → `CONFLICT(40900)`；删除源只停采集，历史数据按保留策略自然过期。
- **拉取采集约定（M6）**：`GithubCollector` 按 cron 定时 + 支持手动触发，用 JDK `HttpClient` 调 GitHub REST API（只读权限），解析零新增依赖（Jackson 为 web starter 既有传递依赖）；**非 HTTP 指标的入库映射**：`source = github/{owner}/{repo}`、`endpoint = 指标名`（views / downloads）、`status = 200`、`totalMs/maxMs = 0`、`count = 增量`（相对上次采集；重启后重新起算基线，首次记 0）、`ts = 数据所属日（UTC 日零点对齐分钟）`——GitHub 侧只提供日粒度、14 天窗口，此为上限而非实现选择。
- **项目数据查询约定（M9.9 起）**：series 支持 `endpoint` 过滤（中性维度，BucketKey 本就含 endpoint）——GitHub 源的 views/downloads 单独出曲线；`GET /api/monitor/github/repos` 用当前 token 拉用户仓库列表供前端勾选接入（只读，/user/repos 上限 100 按 pushed 排序）。产品定位「我的项目」页：配置与数据查看合一，概览页专注 workbench 自监测（前端过滤 github/* 源）。
- **GitHub token 动态配置（M7 起）**：token 支持配置页运行期设置（`PUT|DELETE /api/monitor/settings/github-token`），持久化于 sources.json 的 settings 区；**生效优先级 = 页面设置 > 环境变量 GITHUB_TOKEN**（页面清除后回落 env）。token 值任何接口永不回显，只暴露「已配置布尔位 + 来源（page/env）」。修订说明：原「token 不落盘」约定随动态配置需求废止——本地个人工具下，文件持久化与环境变量的暴露面等同，且换来免重启闭环。

### 3.6 workbench-server（com.imhgl.workbench）

职责：启动模块、聚合模块、部署模块。

- 允许存放：Spring Boot 启动类（`@ConfigurationPropertiesScan`）、`application.yml`、日志配置。
- 禁止存放：业务 Controller / Service / DTO / 业务逻辑；禁止被任何模块依赖。

---

## 4. 依赖规则

```text
workbench-server         → workbench-module-docs、workbench-module-monitor（含传递 framework / infrastructure / common）
workbench-module-docs    → workbench-framework、workbench-infrastructure、workbench-common
workbench-module-monitor → workbench-framework、workbench-infrastructure、workbench-common
workbench-framework      → workbench-common
workbench-infrastructure → workbench-common
workbench-common         → 零依赖
```

1. 依赖方向由各模块 pom 强制保证，写不出违规依赖。
2. 禁止循环依赖；任何模块禁止依赖 `workbench-server`。
3. common / framework / infrastructure 禁止依赖业务模块。
4. 业务模块经 framework 获得 Web 与校验能力，经 infrastructure 获得受控文件访问，经 common 获得响应契约。
5. 全局基础件（Lombok / Hutool）只在父 POM dependencyManagement 管版本，**不默认注入**——谁用谁在模块里声明，保证「common 零依赖」名实相符。

---

## 5. 业务模块内部结构

```text
com.imhgl.workbench.<x>/
├── api/          # 对外唯一契约（接口），跨模块交互只允许注入此接口
│   └── impl/     # api 实现（适配 infrastructure 中性模型为业务语义）
├── controller/   # HTTP 端点（/api/<x>/**），入参用 dto + @Valid，不收裸 Map
├── dto/          # 请求入参（record + jakarta validation）
├── model/        # 领域与出参模型（record；含 DocPath 这类值对象）
└── service/      # 模块内业务服务
```

1. controller 不写业务规则，薄到「接参 → 调 api → 包 ApiResult」。
2. 值对象优先：有不变量约束的概念（如相对路径）做成值对象，不让裸字符串穿透 service 层。
3. 新增业务模块：`backend/` 下建 `workbench-module-xxx`，父 POM 加 `<module>`，server 加依赖；包名以 `com.imhgl.workbench` 开头即被自动扫描；先在本文件登记职责再动代码。

---

## 6. 配置命名约定

1. 业务模块配置：`workbench.<module>.*`（如 `workbench.docs.*`）。
2. infrastructure 配置：技术组件中性命名（如 `workbench.storage.*`），禁止业务前缀。
3. 环境变量映射保持部署稳定：改配置键不改环境变量（`workbench.storage.root` ↔ `DOCS_ROOT`、`workbench.cors.allowed-origins` ↔ `CORS_ALLOWED_ORIGINS`、SpringDoc 开关 ↔ `SPRINGDOC_API_DOCS_ENABLED`、`workbench.auth.token` ↔ `API_TOKEN`、`workbench.metrics.data-dir` ↔ `METRICS_DATA`、`workbench.sources.github-token` ↔ `GITHUB_TOKEN`）。M9.5 起认证为双凭据模型：`workbench.auth.password-sha256` ↔ `AUTH_PASSWORD_SHA256`（人类登录，服务端只存哈希）、`workbench.auth.machine-token` ↔ `API_TOKEN`（机器凭据，ingest 沿用原名）。
   源配置文件路径 `workbench.sources.file` ↔ `WORKBENCH_SOURCES_FILE`（M9.2 起生产 compose 持久化到 workbench-runtime 卷，避免容器重建丢源配置与 token）。
4. framework 认证配置 `workbench.auth.token` 归 framework 中性管理（Web 通用机制）；infrastructure 时序配置 `workbench.metrics.*`（data-dir / retention-days / flush-interval-seconds）中性命名；monitor 源采集配置 `workbench.sources.*`（file / github-token / cron）归 monitor 模块。

---

## 7. 技术选型

| 组件 | 选型 | 版本 | 归属 |
|---|---|---|---|
| 语言 / 运行时 | Java（Temurin JDK） | 25 LTS（25.0.4.1+1，`D:\dev\environment\jdk-25.0.4.1+1`） | 全局 |
| 应用框架 | Spring Boot（parent） | 4.1.1 | 全局 |
| Web | `spring-boot-starter-webmvc`（Boot 4 新坐标） | parent 管理 | framework |
| 参数校验 | `spring-boot-starter-validation` | parent 管理 | framework |
| 接口文档 | SpringDoc OpenAPI（`springdoc-openapi-starter-webmvc-ui`） | 3.1.1 | framework |
| 测试 | JUnit 5（`spring-boot-starter-test` / `junit-jupiter`） | parent 管理 | 各模块 test |
| 样板代码 | Lombok | parent 管理（provided） | 父 POM dependencyManagement，按需在模块声明 |
| 通用工具 | Hutool（`hutool-all`） | 父 POM dependencyManagement | 父 POM dependencyManagement，按需在模块声明 |
| 前端框架 | React + TypeScript（严格模式） | 19 / 5.8 | frontend |
| 前端构建 | Vite + `@vitejs/plugin-react` | 6 | frontend devDependencies |
| 前端字体 | `@fontsource/ibm-plex-sans` / `@fontsource/ibm-plex-mono`（latin 子集自托管） | 5 | frontend |

规则：

1. **新增第三方依赖必须先登记到本表，再写代码**（先改规范再改代码）。
2. 版本统一由父 POM / Spring Boot parent `dependencyManagement` 管理。
3. **数据库零依赖**：不引入 ORM / JDBC / NoSQL 驱动；docs 模块持久化即文件系统。
4. Lombok / Hutool 按需使用、不为用而用；record 能覆盖的场景优先 record。
5. JDK 25 仅以局部 `JAVA_HOME`（命令内或 start.bat 内）引用，**禁止写入系统/用户环境变量**——其他项目继续使用 JDK 21。
6. Web starter 若 `spring-boot-starter-webmvc` 不可解析，回退 `spring-boot-starter-web` 并在提交信息注明。

---

## 8. API 设计约定（/api/docs 与 /api/monitor）

统一包装：`ApiResult{message, code, data}`，`code=0` 成功；错误码见 3.1。

**认证（全局，M9.5 双凭据模型）**：启用方式二选一或并用——① `AUTH_PASSWORD_SHA256`（登录密码的 SHA-256 hex，服务端只存哈希）：`POST /api/auth/login` {password} 常量时间比对后签发会话令牌（内存态，默认 7 天过期，重启即失效），浏览器后续以 `X-API-Token: <会话令牌>` 访问；连续 5 次失败全局锁 60 秒（HTTP 429 + Retry-After）。② `API_TOKEN`（机器凭据，供 ingest 外部上报静态携带）。任一非空 = 认证开启，全部 `/api/**`（`/api/auth/**` 与 Swagger 除外）须携带 `X-API-Token`，失败 → HTTP 401 + `UNAUTHORIZED(40100, "未认证")`；两者皆空 = 认证关闭。`POST /api/auth/logout` 失效当前会话。

**docs 域（八端点，工具）**：

| 方法 | 路径 | 入参 | 出参 data |
|---|---|---|---|
| GET | `/api/docs/tree` | - | `DocNode{name, path, type:"dir"\|"file", children[]}` |
| GET | `/api/docs/file?path=` | query | `DocContent{path, name, content}` |
| POST | `/api/docs/file` | `{path, content}` | - |
| PUT | `/api/docs/file` | `{path, content}` | - |
| POST | `/api/docs/dir` | `{path}` | - |
| POST | `/api/docs/rename` | `{from, to}` | - |
| DELETE | `/api/docs/resource?path=` | query | - |
| GET | `/api/docs/search?q=` | query | `List<SearchHit{path, name, fileNameMatch, line, snippet}>` |

**monitor 域（监测七端点 + 源配置五端点）**：

| 方法 | 路径 | 入参 | 出参 data |
|---|---|---|---|
| POST | `/api/monitor/ingest` | `{source, points:[{endpoint, method, status, count, totalMs, maxMs, ts}]}` | - |
| GET | `/api/monitor/sources` | - | `List<SourceStat{name, lastSeenMinute}>`（含自身 `workbench`） |
| GET | `/api/monitor/overview?source=&range=5m\|1h\|6h\|24h\|7d\|14d\|30d` | query | `Overview{count, errCount, errRate, avgMs, p95Ms, rps}` |
| GET | `/api/monitor/series?source=&metric=count\|avgMs\|errCount&range=&step=m\|h&endpoint=` | query | `List<SeriesPoint{bucketEpoch, value}>`（endpoint 可选：视图按端点过滤，如 GitHub 源的 views/downloads 单独出曲线；缺省=不过滤） |
| GET | `/api/monitor/top-endpoints?source=&range=&limit=&by=count\|err\|avgMs` | query | `List<EndpointRank{endpoint, count, errCount, avgMs, p95Ms}>` |
| GET | `/api/monitor/recent?source=&limit=` | query | `List<RecentRecord{minute, source, endpoint, method, count, errCount, avgMs, maxMs}>`（M13：最近分钟桶记录，按分钟倒序，limit 默认 100 上限 500；前端「运行日志」用，level 由前端派生） |
| GET | `/api/monitor/status` | - | 监测域自检（内存桶数 / 数据文件数 / 认证开关 / GitHub token 配置状态与来源；不回显任何 token 值） |
| PUT | `/api/monitor/settings/github-token` | `{token}`（trim 后非空） | -（保存页面级 token，立即生效，优先于环境变量） |
| DELETE | `/api/monitor/settings/github-token` | - | -（清除页面级 token，回落环境变量） |
| GET | `/api/monitor/source-configs` | - | `List<SourceConfigView{id, type, repo, enabled, metrics[], createdAt, lastOkAt, lastError}>`（token 永不回显） |
| POST | `/api/monitor/source-configs` | `{type:"github", repo:"owner/name", enabled, metrics:["pages"\|"downloads"]}` | `{id}` |
| PUT | `/api/monitor/source-configs/{id}` | 同 POST body | - |
| DELETE | `/api/monitor/source-configs/{id}` | - | -（停采集；历史数据按保留策略自然过期） |
| POST | `/api/monitor/source-configs/{id}/collect` | - | `{ok, error}`（手动立即采集；token 未配置时 ok=false 并给提示） |
| GET | `/api/monitor/github/repos` | - | `List<String>`（当前 token 可见的仓库 full_name 列表，按最近推送排序、上限 100——「我的项目」页勾选式接入用；未配置 token → 400 + PARAM_INVALID） |

源配置约定：`type` 当前仅 `github`；`repo` 须为 `owner/name`；`metrics` ⊆ {pages, downloads}；同 repo 重复接入 → 400 + `CONFLICT(40900)`；不存在 id → 404 + `NOT_FOUND(40400)`；校验失败 → 400 + `PARAM_INVALID`。

监测约定：`range` / `metric` / `step` / `by` 非法值 → 400（`TimeRange` 值对象校验）；`ts` 为分钟级 epoch 毫秒；错误判定 = HTTP status ≥ 400；`rps` = count / 区间秒数。

错误映射：领域冲突 → HTTP 400 + 语义错误码 + 具体中文消息——不存在 = `NOT_FOUND(40400)`、已存在/状态冲突 = `CONFLICT(40900)`；非法输入（路径穿越、非法名、扩展名不在白名单）→ HTTP 400 + `PARAM_INVALID(40000)`；未知路径 → HTTP 404 + `NOT_FOUND`；方法不支持 → HTTP 405 + `METHOD_NOT_ALLOWED(40500)`；校验失败 / 缺参 / 体不可读 → HTTP 400 + `PARAM_INVALID("请求参数错误")`；未知异常 → HTTP 500 + `INTERNAL_ERROR("服务器内部错误")`，不泄漏堆栈与类名。

> 语义化机制：infrastructure 的文件操作抛中性的 `StorageException`（Reason = NOT_FOUND / CONFLICT），docs 模块 api 实现层负责翻译为 `BusinessException`——中性异常不出技术设施语义，业务错误码不出现在 infrastructure。

搜索行为：q trim 后空返回 `[]`；大小写不敏感；文件名命中 `fileNameMatch=true` 且 `snippet` 为文件名；内容命中给 `line`（1 起）与 `snippet`（命中行 strip，超 120 字符截断加 `…`）；双命中都给、`snippet` 取内容命中；上限 100；相对路径字典序；单文件 IO 失败静默跳过；懒遍历短路。

---

## 9. 前端约定（M13：参考稿 UI + 后端联调双模式）

React 19 + TypeScript + Vite。**旧版前端页面（backend API 看板 / Vditor 文档工作区 / 登录页）已不再挂载**；当前入口是 `src/console/ConsoleApp.tsx`。M13 起前端按「双模式」运行：启动时探测 `GET /api/monitor/status`——可达即 **服务端模式**（真实数据），不可达即 **演示模式**（M12 的本地示例行为原样保留，前端单独部署到 GitHub Pages 仍是完整可演示产品）。两种模式共用同一套参考稿 UI，不引入第二套页面。

1. **目录与入口**：活动代码全部在 `src/console/`（`ConsoleApp` / `DashboardPage` / `ProjectsPage` / `DocsPage` / `Dialogs` / `LockScreen` / `TrendChart` / `Icon` / `data.ts` / `api.ts` / `console.css`）；`App.tsx` 只渲染 `ConsoleApp`，`main.tsx` 只加载字体、`console.css` 与主题初始化。
2. **视觉唯一事实源**：`src/console/console.css` 从参考稿抽取，页面只使用参考稿类名与原语观感；旧 `styles/tokens.css`、`components/ui` 不再参与渲染。明暗主题由 `src/theme.ts` 同时写 `html[data-theme]` 与 `body[data-theme]`；保留旧版圆形揭示动画（View Transitions + 点击坐标）。
3. **信息架构**：内部路由只有 `dashboard` / `projects` / `docs`；侧栏固定深色 268px（折叠 76px），分组「总览 / 监控 / 工具」。项目监控含项目卡与运行日志；在线文档为列表 + 编辑器/预览；「集成工具」是导航按钮 + 原生 dialog，不单独建页面。锁屏是本地密码遮罩，默认演示密码 `commandcode`。
4. **数据边界（按模式）**：演示模式 = 项目与日志是会话内示例数据，文档与自定义工具保存在浏览器 localStorage（`devconsole.docs.v1` / `devconsole.tools.v1`），不写后端、不伪造服务端记录；服务端模式 = 看板与项目监控读 `/api/monitor/**` 真实数据，在线文档读写 `/api/docs/**` 服务端文件库（只作用于后端 DOCS_ROOT）。自定义工具两种模式下均存 `devconsole.tools.v1`（个人快捷入口，无服务端概念）；主题 / 侧栏 / 锁屏键分别为 `devconsole.theme.v1` / `devconsole.sidebar.v1` / `devconsole.locked.v1`，会话令牌只存内存不落盘。
5. **本地 Markdown**：文档页支持打开/拖入本地文件，预览与「继续编辑」；有 File System Access 句柄时写回原文件，否则另存/下载；`Ctrl/Cmd+S` 保存本地文件，未保存关闭/刷新有提示。此能力与模式无关，服务端模式下与服务端文档并存。
6. **交互与文案**：页面进入只做一次轻微上浮；主题揭示、侧栏 260ms、面板 hover 走统一缓动；`prefers-reduced-motion` 熄灭动效。文案沿用参考稿：直给、具体、有活人感但不过度口语化。
7. **服务端模式契约（api.ts 统一封装）**：后端基地址由构建时 `VITE_API_BASE` 注入（仓库 Actions Variables 配置，生产指向 `https://api.imhgl.com`；缺省空 = 同源，开发态走 Vite 代理）——GitHub Pages 是纯静态托管，不注入基地址则前端只能探测自身域名 `/api`（404）并回落演示模式。请求带 `X-API-Token`（会话令牌，登录后存内存）；`ApiResult` 统一解包，`code != 0` 抛业务错误；401 → 回锁屏重登；网络错误 → 回落演示模式并提示；路由或 range 变化即重拉监测数据（切页取最新数，查询本身也计入自监测闭环）。数据看板：指标卡 = `overview(workbench, 24h)` + 活跃源数；走势 = `series(workbench, count|errCount, 7d|14d|30d, step=h)` 按日聚合（requests 换算万次、errors 换算百次）；状态分布与健康明细 = `sources()` + 每源 `overview(source, 24h)`（状态派生：错误率 ≥1% 且有流量 → 异常；24h 无流量 → 已停止；其余 → 运行中；stack 派生：github/ 前缀 → GitHub，否则本机服务）。项目监控：源卡同上，**「新增项目」按钮在服务端模式隐藏**（数据源由流量自动发现，无手动登记语义）；运行日志 = `GET /api/monitor/recent`，级别派生 errCount>0 → ERROR、maxMs>800 → WARN、否则 INFO，消息文案 `METHOD endpoint · N 次 · 平均 Xms`；「刷新日志」= 重新拉取。在线文档：tree / file / save / rename / delete / search 直连 `/api/docs/**`，标题与路径一一对应（`标题.md`，Windows 保留字符过滤，内容懒加载，编辑防抖 900ms 落盘，标题变更同时 rename，新建同名冲突自动加 -2 后缀）。锁屏：后端认证开启时解锁即 `POST /api/auth/login` 换会话令牌、锁屏即 `POST /api/auth/logout` 注销；认证关闭时沿用本地演示密码。后端 CORS 须放行前端域名（compose 默认 `workbench.imhgl.com` 与 `guol9180.github.io` 双域，可用 `CORS_ALLOWED_ORIGINS` 覆盖）。
8. **验收**：桌面 1440 / 移动 390 逐页与参考稿比对；`pnpm build` 零错；演示模式必测项同 M12（项目新增、日志筛选/刷新、工具新增/删除/激活、文档新建/删除/搜索、本地文件写回、搜索、锁屏、侧栏折叠）；服务端模式必测 = 登录 → 看板真实指标（自监测闭环：页面查询本身计入 workbench 流量）→ 文档服务端 CRUD（新建/编辑/重命名/删除/搜索）→ 项目页源卡与 recent 日志 → 停后端自动回落演示模式。
---

> 项目背景、技术栈与启动方式见 [README.md](./README.md)，当前计划与验收清单见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。三文档职责互斥：同一信息只写在归属文件，其余位置引用而不复制；修订时只改归属文件，引用处自动生效。
