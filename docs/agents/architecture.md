# 架构与依赖规则

> 规范主文件见 [AGENTS.md](../../AGENTS.md)，项目定位与启动方式见 [README.md](../../README.md)。本文是后端架构的常驻细节。

## 架构与目录约定

模块化单体：所有能力打包为一个 Spring Boot 应用，业务按模块隔离，模块间只经 `api` 层交互，统一由 `workbench-server` 启动。

### 结构与数据流

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

### 业务模块内部结构

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
3. 新增模块先在 [modules.md](./modules.md) 登记职责，再建模块、加父 POM `<module>` 与 server 依赖；未经确认不新增 Maven 模块。

### 配置命名

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

## 依赖规则

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
