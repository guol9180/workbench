# 模块职责

> 架构与依赖规则见 [architecture.md](./architecture.md)；规范主文件见 [AGENTS.md](../../AGENTS.md)。

各模块根包的 `package-info.java` 与本文同步。

## workbench-common

统一响应与异常契约：`ApiResult<T>(message, code, data)`（code=0 成功）、`ErrorCode`、`BusinessException`、通用常量。零业务、零 Spring 依赖、零端点。

错误码：`PARAM_INVALID(40000)` / `UNAUTHORIZED(40100)` / `NOT_FOUND(40400)` / `CONFLICT(40900)` / `METHOD_NOT_ALLOWED(40500)` / `INTERNAL_ERROR(50000)`。

## workbench-framework

Web 通用能力：全局异常处理、参数校验、SpringDoc/OpenAPI、认证（Token 过滤器 + `/api/auth/login|logout` 认证端点）、请求上下文。

禁止业务逻辑、业务 DTO、业务端点（认证端点属框架机制，是唯一例外）。

## workbench-infrastructure

外部技术组件的中性封装：`TimeSeriesStore`（append / replace / sources / overview / series / topEndpoints / recent / status / flush / close）、`JsonlTimeSeriesStore`（分钟聚合桶 + 蓄水池延迟采样 + 按天 JSONL 刷盘 + 启动重放 + 保留清理）、`TrafficRecord` 与查询模型（SourceStat / Overview / SeriesPoint / EndpointRank / RecentRecord / StoreStatus）、`MetricsProperties`。`series` 的 metric 支持 `count / errCount / avgMs / last`——`last` 取桶内最后写入值，供快照类指标使用。

只产出中性模型与中性配置，禁止业务语义与业务色彩命名。文件树存储随 docs 域删除；若恢复 md 笔记能力，从 git 历史取回。

## workbench-module-monitor

观测域：自监测、ingest 上报枢纽、查询、主动拨测、GitHub 采集与快照、源配置管理。

内部结构：`api/`（`MonitorApi` + `impl/`）、`controller/`、`dto/`、`model/`（`TimeRange` 等）、`service/`、`collector/`、`probe/`。

- **TimeRange**：`5m|1h|6h|24h|7d|14d|30d` 的解析与校验收拢在 model，非法值 → 400。
- **自监测**：`TrafficRecordFilter` 拦 `/api/**`（order 先于 Token 过滤器），`source="workbench"`；路径归一化（数字段 `{n}`、UUID 段 `{u}`）；异步有界队列，队列满丢弃并计数，绝不阻塞请求。
- **上报**：外部系统按 ingest 结构 POST，`source` 自带标识，数据进同一时序存储。
- **源配置**：`SourceConfigStore` 独占读写 JSON 配置（`workbench.sources.file`）；同 repo 重复接入 → `CONFLICT(40900)`；删除源只停采集，历史数据按保留策略自然过期。
- **GitHub 采集**：cron 定时 + 手动触发，JDK `HttpClient` 只读调用，零新增依赖。映射分两类：流量用 `source=github/{owner}/{repo}`、`endpoint=views/downloads`、`count=增量`（相对上次采集，重启重新起算）、`ts=数据所属日`（UTC 日零点对齐分钟）；快照用独立来源 `source=snapshot/github/{owner}/{repo}`、`endpoint=stars/forks/watchers/openIssues`、`count=绝对值`、`ts=UTC 日桶`，每次采集都写、同日覆盖（不累加），查询用 `metric=last` 取日末值。两类 source 分离是为了避免快照绝对值污染流量求和；openIssues 为 GitHub 口径（含 PR）。
- **token**：设置页可运行期设置（`PUT|DELETE /api/monitor/settings/github-token`），持久化于 sources.json，优先级页面 > `GITHUB_TOKEN`；任何接口不回显 token。
- **主动拨测（M15）**：目标列表持久化于 sources.json 的 `probes` 区，目标名与 URL 均唯一；调度默认 60 秒、单目标超时 5 秒。结果以合成流量记录入库：`source = probe/{name}`、`endpoint = url`、`method = GET`、`status = HTTP 码（连接失败/超时记 0）`、`count = 1`、`totalMs/maxMs = 延迟`，延迟样本供 p95 使用。启用开关只影响调度，不删历史数据；改名等于换 source，历史留在旧 source、不迁移。

## workbench-server

启动与聚合：Spring Boot 启动类（`@ConfigurationPropertiesScan`）、`application.yml`、日志配置。禁止业务代码与端点；禁止被任何模块依赖。
