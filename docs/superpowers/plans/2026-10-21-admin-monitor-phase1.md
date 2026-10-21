# 后台管理系统一期：流量监测域 + 认证回归（仅后端）实施计划

> **For agentic workers:** 按 executing-plans 内联执行（用户已确认 Native 方式）。Steps 用 checkbox 跟踪。规划来源：plan mode 已批准的同名计划（2026-10-21）。

**Goal:** 项目定位升级为「个人后台管理系统（学习向）：流量监测 + 工具集」——docs 成为第一个工具（后端不动），新增流量监测域：本系统 API 自监测 + 其他系统通用上报接口 + 查询接口，零依赖 JSONL 时序存储，轻量 Token 认证。本期只动后端。

**技术选型声明：零新增第三方依赖。** 时序存储 JDK 原生（java.io/nio + ConcurrentHashMap/LongAdder + 定时线程），Filter/配置绑定用 Spring 内置，p95 手写蓄水池采样。刻意不用 Actuator/Micrometer（只覆盖本 JVM 且加依赖）与 Prometheus（需额外服务）。AGENTS §7 无需新增行。

**已确认决策：** 自监测 + 上报枢纽；零依赖 JSONL（infrastructure 中性组件，可无感换库）；新增 `workbench-module-monitor`；轻量 Token 认证（`X-API-Token`，配置式，空=关闭）。

## Global Constraints

- **命令包装**：所有命令经 PowerShell 执行；每条 Maven 命令前 `$env:JAVA_HOME='D:\dev\environment\jdk-25.0.4.1+1'`。
- **系统环境零影响**：不改系统/用户环境变量；JDK 25 仅命令内与 start.bat 引用。
- **版本钉死**：Spring Boot 4.1.1 / springdoc 3.1.1 不动；**零新增第三方依赖**。
- **模块**：新增 `workbench-module-monitor`（唯一新增）；monitor → framework/infrastructure/common；server → monitor、docs。
- **兼容红线**：`workbench.auth.token` 默认空 = 认证关闭，现有 54 测试零回归。
- **注释规范**：AGENTS「注释规范」节全量适用（公共契约 Javadoc、解释为什么、设计取舍）。
- **Git**：直接在 main 提交（上期合并后的小步延续），每任务一提交。

## Review Focus（测试必须钉死的风险）

1. 并发 append 计数精确（多线程压测断言总数）。
2. 重启重放不丢数（同 data-dir 重实例化后查询一致）。
3. Token 三态：关闭（旧行为）/401/放行；非 /api 路径不受影响。
4. 懒遍历与队列背压：有界队列满时丢弃计数，不阻塞业务请求。
5. 路径归一化矩阵（数字段/UUID 段/多级）。

---

## Task 0: 规范先行

- [ ] AGENTS.md：定位（后台管理系统：监测 + 工具集，docs 为第一个工具）、§1 增监测存储与 Token 条款、§2/§3 增 monitor 模块与各层新内容（ErrorCode +UNAUTHORIZED(40100)、framework +ApiTokenFilter、infrastructure +metrics/）、§4 依赖、§6 配置（workbench.auth.token / workbench.metrics.*）、§8 增 /api/monitor 六端点表与认证说明。
- [ ] README：定位、功能区（监测 + 工具箱）、模块树。
- [ ] DEVELOP_PLAN：M4 里程碑 + 任务 + 验收清单。
- [ ] Commit: `规范：定位升级为后台管理系统（流量监测 + 工具集），新增 monitor 模块与 Token 认证约定`

## Task 1: infrastructure 时序存储（零依赖 JSONL）

**Files:** Create `backend/workbench-infrastructure/src/main/java/com/imhgl/workbench/infrastructure/metrics/`：`MetricsProperties`、`TrafficRecord`、`TimeSeriesStore`、`JsonlTimeSeriesStore`；Test：`JsonlTimeSeriesStoreTest`。

**Interfaces:**
- Produces: `TimeSeriesStore`：`void append(TrafficRecord r)`、`List<SourceStat> sources()`、`Overview overview(String source, TimeRange r)`、`List<SeriesPoint> series(String source, String metric, TimeRange r, char step)`、`List<EndpointRank> topEndpoints(String source, TimeRange r, int limit, String by)`、`void flush()`、`void close()`；`record TrafficRecord(String source, String endpoint, String method, int status, int count, long totalMs, long maxMs, long minuteEpoch, List<Integer> latencySamples)`；查询模型 `SourceStat(name, lastSeenEpochMinute)`、`Overview(count, errCount, errRate, avgMs, p95Ms, rps)`、`SeriesPoint(bucketEpoch, value)`、`EndpointRank(endpoint, count, errCount, avgMs, p95Ms)`。
- 查询模型 `Overview/SeriesPoint/...` 放 infrastructure 中性包，monitor 适配为业务模型。

**TDD 矩阵：** 分钟聚合正确；小时归并；p95（固定样本集）；topEndpoints 按 count/err/avgMs；sources+lastSeen；并发 append（16 线程 × N 条，断言总数）；重启重放（同 dir 重实例化）；retention 清过期文件与内存桶；flush 后文件存在且行数正确。

- [ ] Step1 失败测试 → Step2 RED → Step3 实现 → Step4 GREEN → Step5 Commit `infrastructure：零依赖 JSONL 时序存储（聚合桶/蓄水池采样/重放/保留策略）`

## Task 2: framework Token 认证

**Files:** Create `framework/filter/ApiTokenFilter.java`、`framework/config/ApiTokenProperties.java`；Test `ApiTokenFilterTest`；Modify `common` ErrorCode +`UNAUTHORIZED(40100, "未认证")`。

**TDD：** token 空=放行（旧契约）；非 /api 放行；无头 401+40100；错值 401；正确值放行。

- [ ] RED → 实现 → GREEN → Commit `framework：轻量 Token 认证过滤器（X-API-Token，配置式，空=关闭）`

## Task 3: monitor 域模型与服务

**Files:** Create `module-monitor` Maven 模块（父 POM + 自身 pom）+ `model/TimeRange`、`model/*查询模型适配`、`dto/IngestRequest`、`service/MonitorService`、`service/TrafficRecordFilter`、`api/MonitorApi`+`impl`、`package-info`；Test：`TimeRangeTest`、`TrafficRecordFilterTest`。

**TDD：** TimeRange 合法/非法（5m|1h|6h|24h|7d）；Filter 归一化矩阵（数字段/UUID/多级）+ 有界队列丢弃计数不阻塞。

- [ ] RED → 实现 → GREEN → Commit `monitor：域模型/服务/自监测过滤器（TimeRange 值对象 + 路径归一化）`

## Task 4: 六端点 Controller

**Files:** Create `controller/MonitorController`；Test `MonitorControllerTest`（standalone + 假 MonitorApi）。

**TDD：** ingest @Valid 校验 400；六端点 ApiResult 形状与参数绑定；metric/step/by 非法值 400。

- [ ] RED → 实现 → GREEN → Commit `monitor：六端点（ingest/sources/overview/series/top-endpoints/status）`

## Task 5: server 集成

**Files:** Modify server pom（+monitor 依赖）、application.yml（workbench.auth.token/metrics.*）；Create `MonitorIntegrationTest`（RANDOM_PORT）。

**TDD：** 自监测链路（调 docs API → overview source=workbench 增长）；ingest 上报 → series/topEndpoints；token 三态（动态属性切配置）；status 自检；启动重放。

- [ ] RED → 实现 → GREEN → Commit `server：监测域集成（自监测/上报枢纽/Token 三态）`

## Task 6: 全量验证 + 收尾

- [ ] `mvn clean package` 全绿（现有 54 + 新增 ≈45）；README/DEVELOP_PLAN 定稿；提交推送 main。
