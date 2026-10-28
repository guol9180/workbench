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

- 允许存放：全局异常处理（业务异常→400 语义错误码；校验失败→400 `PARAM_INVALID`；未知→500 不泄漏细节）、参数校验、CORS 配置、SpringDoc/OpenAPI 配置、轻量 Token 认证过滤器、请求上下文等 Web 通用机制。
- 禁止存放：HTTP 端点（一律放业务模块）、业务逻辑、业务 DTO。
- 当前内容：`handler/GlobalExceptionHandler`、`config/`（CorsProperties、CorsConfig、OpenApiConfig、ApiTokenProperties）、`filter/ApiTokenFilter`。

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
- **`TimeRange` 值对象约定**：查询区间 `5m|1h|6h|24h|7d` 的解析与校验收拢在 model，非法值抛 `IllegalArgumentException` → 400。
- **自监测约定**：`TrafficRecordFilter` 拦 `/api/**`（order 先于 Token 过滤器，未认证请求也计入流量），`source="workbench"`；路径归一化（纯数字段→`{n}`、UUID 段→`{u}`）；异步投递有界队列，队列满丢弃并计数、绝不阻塞业务请求。
- **上报枢纽**：外部系统按 `IngestRequest` 结构 POST 到 `/api/monitor/ingest`，`source` 自带标识（如 `nginx`、`server-a`），数据进同一时序存储。
- **源配置约定（M6）**：配置持久化为 JSON 文件（`workbench.sources.file`，默认 `data/sources.json`），由 `SourceConfigStore` 独占读写；仓库范围由用户在配置页管理，**运行期配置而非 yml**。同 repo 重复接入 → `CONFLICT(40900)`；删除源只停采集，历史数据按保留策略自然过期。
- **拉取采集约定（M6）**：`GithubCollector` 按 cron 定时 + 支持手动触发，用 JDK `HttpClient` 调 GitHub REST API（只读权限），解析零新增依赖（Jackson 为 web starter 既有传递依赖）；**非 HTTP 指标的入库映射**：`source = github/{owner}/{repo}`、`endpoint = 指标名`（views / downloads）、`status = 200`、`totalMs/maxMs = 0`、`count = 增量`（相对上次采集；重启后重新起算基线，首次记 0）、`ts = 数据所属日（UTC 日零点对齐分钟）`——GitHub 侧只提供日粒度、14 天窗口，此为上限而非实现选择。
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
3. 环境变量映射保持部署稳定：改配置键不改环境变量（`workbench.storage.root` ↔ `DOCS_ROOT`、`workbench.cors.allowed-origins` ↔ `CORS_ALLOWED_ORIGINS`、SpringDoc 开关 ↔ `SPRINGDOC_API_DOCS_ENABLED`、`workbench.auth.token` ↔ `API_TOKEN`、`workbench.metrics.data-dir` ↔ `METRICS_DATA`、`workbench.sources.github-token` ↔ `GITHUB_TOKEN`）。
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
| 前端路由 | `react-router-dom`（hash 路由，保 GitHub Pages 深链） | 7 | frontend |
| 编辑器 | Vditor（本地 vendored UMD 副本，`public/vendor/vditor`） | 4.0.0 | frontend（无 npm 包） |
| 前端字体 | `@fontsource/chakra-petch` / `@fontsource/overpass-mono`（latin 子集自托管） | 5 | frontend |

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

**认证（全局）**：`workbench.auth.token` 非空时，全部 `/api/**` 请求须携带请求头 `X-API-Token`（含 docs 与 monitor；Swagger 路径不在 `/api/**` 内天然放行），失败 → HTTP 401 + `UNAUTHORIZED(40100, "未认证")`；token 为空 = 认证关闭。

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

**monitor 域（监测六端点 + 源配置五端点）**：

| 方法 | 路径 | 入参 | 出参 data |
|---|---|---|---|
| POST | `/api/monitor/ingest` | `{source, points:[{endpoint, method, status, count, totalMs, maxMs, ts}]}` | - |
| GET | `/api/monitor/sources` | - | `List<SourceStat{name, lastSeenMinute}>`（含自身 `workbench`） |
| GET | `/api/monitor/overview?source=&range=5m\|1h\|6h\|24h\|7d` | query | `Overview{count, errCount, errRate, avgMs, p95Ms, rps}` |
| GET | `/api/monitor/series?source=&metric=count\|avgMs\|errCount&range=&step=m\|h` | query | `List<SeriesPoint{bucketEpoch, value}>` |
| GET | `/api/monitor/top-endpoints?source=&range=&limit=&by=count\|err\|avgMs` | query | `List<EndpointRank{endpoint, count, errCount, avgMs, p95Ms}>` |
| GET | `/api/monitor/status` | - | 监测域自检（内存桶数 / 数据文件数 / 认证开关 / GitHub token 配置状态与来源；不回显任何 token 值） |
| PUT | `/api/monitor/settings/github-token` | `{token}`（trim 后非空） | -（保存页面级 token，立即生效，优先于环境变量） |
| DELETE | `/api/monitor/settings/github-token` | - | -（清除页面级 token，回落环境变量） |
| GET | `/api/monitor/source-configs` | - | `List<SourceConfigView{id, type, repo, enabled, metrics[], createdAt, lastOkAt, lastError}>`（token 永不回显） |
| POST | `/api/monitor/source-configs` | `{type:"github", repo:"owner/name", enabled, metrics:["pages"\|"downloads"]}` | `{id}` |
| PUT | `/api/monitor/source-configs/{id}` | 同 POST body | - |
| DELETE | `/api/monitor/source-configs/{id}` | - | -（停采集；历史数据按保留策略自然过期） |
| POST | `/api/monitor/source-configs/{id}/collect` | - | `{ok, error}`（手动立即采集；token 未配置时 ok=false 并给提示） |

源配置约定：`type` 当前仅 `github`；`repo` 须为 `owner/name`；`metrics` ⊆ {pages, downloads}；同 repo 重复接入 → 400 + `CONFLICT(40900)`；不存在 id → 404 + `NOT_FOUND(40400)`；校验失败 → 400 + `PARAM_INVALID`。

监测约定：`range` / `metric` / `step` / `by` 非法值 → 400（`TimeRange` 值对象校验）；`ts` 为分钟级 epoch 毫秒；错误判定 = HTTP status ≥ 400；`rps` = count / 区间秒数。

错误映射：领域冲突 → HTTP 400 + 语义错误码 + 具体中文消息——不存在 = `NOT_FOUND(40400)`、已存在/状态冲突 = `CONFLICT(40900)`；非法输入（路径穿越、非法名、扩展名不在白名单）→ HTTP 400 + `PARAM_INVALID(40000)`；未知路径 → HTTP 404 + `NOT_FOUND`；方法不支持 → HTTP 405 + `METHOD_NOT_ALLOWED(40500)`；校验失败 / 缺参 / 体不可读 → HTTP 400 + `PARAM_INVALID("请求参数错误")`；未知异常 → HTTP 500 + `INTERNAL_ERROR("服务器内部错误")`，不泄漏堆栈与类名。

> 语义化机制：infrastructure 的文件操作抛中性的 `StorageException`（Reason = NOT_FOUND / CONFLICT），docs 模块 api 实现层负责翻译为 `BusinessException`——中性异常不出技术设施语义，业务错误码不出现在 infrastructure。

搜索行为：q trim 后空返回 `[]`；大小写不敏感；文件名命中 `fileNameMatch=true` 且 `snippet` 为文件名；内容命中给 `line`（1 起）与 `snippet`（命中行 strip，超 120 字符截断加 `…`）；双命中都给、`snippet` 取内容命中；上限 100；相对路径字典序；单文件 IO 失败静默跳过；懒遍历短路。

---

## 9. 前端约定（frontend/）

React 19 + TypeScript（严格模式）+ Vite，替代已删除的 Vue 3 前端（历史见 git 主干）。与后端同守「架构清晰、代码质量优先」，本节是前端的对应规范。

1. **目录结构（按域分模块）**：`src/modules/<域>/`（home / monitor / docs / sources / access）内聚各自的 `api.ts`（唯一出域请求封装）、视图组件与样式；跨域公共件放 `src/components/`（AppShell / PulseChart / 浮层 / `ui/` 原语层），全局样式只有 `src/styles/tokens.css`（设计令牌唯一来源）与 `base.css`。
2. **设计系统「分域主题」（M9 起）**：
   - **令牌三层**：全局中性层（`data-theme='light'|'dark'`：背景/表面 4 档/文字 3 级/线条/ok/danger）→ 域强调层（`data-domain`：analysis 石墨+青 / docs 暖纸感，双主题各自成套）→ 组件只引用语义变量；禁止散落硬编码色值与 rgba 变体（发光/遮罩走 `--ok-glow`/`--overlay` 等专用令牌）。
   - **明暗双主题**：默认跟随 `prefers-color-scheme`（无系统偏好取暗色），侧栏手动切换并记忆（`src/theme.ts` 唯一读写口）；`prefers-reduced-motion` 全局熄灭动效。
   - **域只换主区气质**：AppShell 按路由把 `data-domain` 挂在主区，侧栏与底部状态条保持中性骨架；未来新工具可在 analysis/docs 之外定义自己的域主题块。
   - **警示色独立**：`--warn`（琥珀黄）专职警示，与品牌强调色色相分离，禁止用强调色表达警告。
   - **标尺**：字号 7 档（11/12/13/14/16/20/26；文档编辑区阅读面特批 15px/1.75）、间距 4/8/12/16/24 节奏；text-3 两主题对表面 ≥4.5:1（WCAG AA）。
3. **组件原语**：Panel / Segmented / Chip / GhostButton / StatusDot / Banner / Field / EmptyState（`components/ui/`）是共享视觉件的唯一来源；模块 CSS 只写布局与域特有样式，禁止复制原语观感。
4. **骨架与信息架构**：`/home` 工作台首页是默认路由（工具卡片 + 全局健康摘要 + 最近文档）；侧栏分组「分析/工具」，折叠钮在 logo 行且记忆折叠态，底部为 暗色模式 / 访问令牌 / 退出登录（清除本机令牌并回接入页，带 loggedOut 状态防认证关闭时自动回跳）；导航条目带域色点，未来新增工具 = 首页加一卡 + 侧栏加一条。
5. **数据层**：全部请求经 `src/api/http.ts`（X-API-Token 头、`ApiResult` 解包、401 清令牌跳接入页、非 JSON 响应统一翻译为离线提示）；展示型数字一律走 `src/utils/format.ts`，口径全站一致；monitor 查询用 `usePolling`（15s、页面隐藏暂停、失败保留旧数据）。
6. **契约对齐**：后端查询模型字段与前端 TS 接口一一对应；`bucketEpoch` / `lastSeenMinute` 口径为 **epoch 分钟**（展示前 ×60000）；range→step 固定映射（24h/7d → 小时桶）。
7. **认证流**：接入页探测 `/api/monitor/status`——open 直进首页 / locked 出令牌表单 / offline 重试；侧栏「访问令牌」（manage）与「退出登录」（loggedOut）进入时 open 不自动回跳，停留显示认证状态卡；令牌仅存 localStorage，不出浏览器。
8. **依赖纪律**：React Bits 不作为依赖引入（其效果按需手写，如 PulseChart）；新增 npm 依赖先登记第 7 节表格；禁早熟抽象——第二个副本出现才抽公共组件。
9. **编辑器**：Vditor 走 `public/vendor` 本地副本（无 CDN）；经 `modules/docs/editor.ts` 适配层隔离实例；主题切换走实例 `setTheme` 热切换（重建实例会丢编辑器缓冲内容，禁止用 remount 换肤）；**不使用 React StrictMode**（vendored Vditor 不兼容开发期双挂载）。

---

> 项目背景、技术栈与启动方式见 [README.md](./README.md)，当前计划与验收清单见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。三文档职责互斥：同一信息只写在归属文件，其余位置引用而不复制；修订时只改归属文件，引用处自动生效。
