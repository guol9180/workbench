# 工作台 · Workbench

个人后台管理系统（学习项目）：以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体，定位是**流量监测 + 工具集**。当前包含：**流量监测域**（本系统 API 自监测 + 其他系统通用上报枢纽 + 管理查询）与第一个工具**在线 Markdown 文档**（文件树 / 在线编辑保存 / 全文搜索），后续工具以业务模块渐进扩展。

> 开发规范见 [AGENTS.md](./AGENTS.md)，当前计划与验收见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。

## 技术栈

- **语言 / 运行时**：Java 25 LTS（Temurin 25.0.4.1+1，位于 `D:\dev\environment\jdk-25.0.4.1+1`，仅以局部 `JAVA_HOME` 引用，不改系统环境变量）
- **框架**：Spring Boot 4.1.1（`spring-boot-starter-webmvc` + `starter-validation`）· SpringDoc OpenAPI 3.1.1（Swagger UI）
- **存储**：纯文件系统（文档即文件；监测时序数据为零依赖 JSONL 聚合存储），**无数据库、无缓存、无对象存储**
- **构建**：Maven 多模块（common / framework / infrastructure / module-docs / module-monitor / server 六模块）
- **认证**：轻量 Token（`X-API-Token` 请求头，配置式，空 = 关闭）
- **前端**：React 19 + TypeScript + Vite 6（`frontend/`，分域主题设计系统：明暗双主题可切换，分析域石墨+青 / 文档域暖纸感，语义令牌唯一事实源 + 共享 UI 原语；工作台首页 + 分组可折叠侧栏；react-router 7 hash 路由；Vditor vendored 编辑器；字体自托管——React Bits 不引入，动效组件手写）

## 仓库结构

```text
workbench/
├── backend/                      # Maven 模块化单体
│   ├── workbench-common/         # 响应与异常契约（record ApiResult / ErrorCode / BusinessException）
│   ├── workbench-framework/      # Web 框架能力：全局异常 / 参数校验 / CORS / OpenAPI / Token 认证（零端点）
│   ├── workbench-infrastructure/ # 技术设施：中性文件树存储 + 中性 JSONL 时序存储
│   ├── workbench-module-docs/    # 工具：在线文档（api 层 + DocPath 值对象 + 搜索服务）
│   ├── workbench-module-monitor/ # 流量监测域：自监测 + 上报枢纽 + 查询（TimeRange 值对象）
│   └── workbench-server/         # 聚合启动（main + application.yml，禁止业务）
├── frontend/                     # React 19 + TS 前端：工作台首页 + 概览看板 + 在线文档 + 数据源 + 令牌接入
├── AGENTS.md / DEVELOP_PLAN.md / README.md
└── docs/superpowers/plans/       # 重构实施计划（2026-10-15-backend-refactor-docs-only.md）
```

## 本地开发

要求：JDK 25（本机 `D:\dev\environment\jdk-25.0.4.1+1`）、Maven 3.9+。纯文件存储，**无需 Docker / MySQL / Redis**，开箱即跑。

在任意终端（PowerShell / CMD 均可）中局部设置 `JAVA_HOME`（不影响其他项目）：

```powershell
$env:JAVA_HOME = 'D:\dev\environment\jdk-25.0.4.1+1'
cd backend
mvn package                     # 全量构建 + 测试（94 个用例）
mvn -pl workbench-server spring-boot:run
```

启动后：<http://localhost:8080/swagger-ui.html>（接口文档），文档库默认在 `backend/data/docs`（`DOCS_ROOT` 可改），监测数据默认在 `backend/data/metrics`（`METRICS_DATA` 可改）。本地默认不配 Token（`API_TOKEN` 可开启认证）。Windows 也可双击根目录 `start.bat`（已内置局部 `JAVA_HOME`）。

前端（另开一个终端）：

```powershell
cd frontend
npm install        # 或 pnpm install
npm run dev        # http://localhost:5173 （/api 已代理到本地 8080）
```

## API 一览（统一包装 `{message, code, data}`，code=0 成功）

**工具 · docs 域**：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/docs/tree` | 文件树（目录优先、不分大小写排序） |
| GET | `/api/docs/file?path=` | 读取文档 |
| POST / PUT | `/api/docs/file` | 新建 / 保存（body：`{path, content}`） |
| POST | `/api/docs/dir` | 新建文件夹（body：`{path}`） |
| POST | `/api/docs/rename` | 重命名/移动（body：`{from, to}`） |
| DELETE | `/api/docs/resource?path=` | 删除（递归） |
| GET | `/api/docs/search?q=` | 全文搜索（双匹配、上限 100、懒遍历短路） |

**监测 · monitor 域**：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/monitor/ingest` | 外部系统流量上报（body：`{source, points:[...]}`） |
| GET | `/api/monitor/sources` | 已知来源列表 + lastSeen（含自身 `workbench`） |
| GET | `/api/monitor/overview?source=&range=` | 总量 / 错误率 / avg / p95 / rps（range：5m~7d） |
| GET | `/api/monitor/series?source=&metric=&range=&step=` | 时间序列（metric：count/avgMs/errCount） |
| GET | `/api/monitor/top-endpoints?source=&range=&limit=&by=` | 端点排行（by：count/err/avgMs） |
| GET | `/api/monitor/status` | 监测域自检（桶数 / 文件数 / 认证开关 / GitHub token 配置状态） |

**源配置 · monitor 域（M6，配置页驱动）**：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/monitor/source-configs` | 已接入数据源（含采集状态；token 永不回显） |
| POST | `/api/monitor/source-configs` | 接入（body：`{type:"github", repo:"owner/name", enabled, metrics:["pages"\|"downloads"]}`） |
| PUT | `/api/monitor/source-configs/{id}` | 修改（启停 / 指标 / repo） |
| DELETE | `/api/monitor/source-configs/{id}` | 删除（停采集；历史数据按保留策略自然过期） |
| POST | `/api/monitor/source-configs/{id}/collect` | 手动立即采集（ok=false 时 error 给可行动原因） |

GitHub 采集：token 可直接在数据源页动态保存（持久化于 `data/sources.json`，**优先于环境变量** `GITHUB_TOKEN`，清除后回落 env）；Pages 流量为日粒度、最多回看 14 天（GitHub 侧限制）；下载量按采集增量入库。

**认证**：环境变量 `API_TOKEN` 非空时，全部 `/api/**` 须携带请求头 `X-API-Token`，失败 401 + `40100`；为空 = 关闭。登录页以「密码」呈现，密码即 `API_TOKEN` 同值。

错误映射：文件/目录不存在 → 400 + `40400`；已存在/冲突 → 400 + `40900`；非法输入（穿越、非法名、扩展名白名单外）→ 400 + `40000`；未知路径 → 404 + `40400`；方法不支持 → 405 + `40500`；未认证 → 401 + `40100`；未知异常 → 500 + `50000`「服务器内部错误」。完整行为约定见 [AGENTS.md · API 设计约定](./AGENTS.md#8-api-设计约定apidocs-与-apimonitor)。

## 部署

发布流：打 `v*` 标签（或手动触发）→ Actions 构建镜像推送 GHCR（`build-backend.yml`）；前端推 main 自动部署 GitHub Pages（`deploy-frontend.yml`）。

服务器（2c2G 参考配置）：

1. 克隆本仓库（用到 `docker-compose.yml` 与 `Caddyfile`），同目录建 `.env`（参考 `.env.example`，必填 `API_TOKEN`；`openssl rand -base64 24` 生成）
2. `docker compose pull && docker compose up -d`——Caddy 自动为 api.imhgl.com 申请证书并反代到 workbench:8080
3. 首次访问 workbench.imhgl.com 会被 401 拦到登录页，输入登录密码（即 `API_TOKEN`，仅存本机浏览器）

持久化：`workbench-docs` 卷存文档库；`workbench-runtime` 卷存监测时序与源配置（含 GitHub token，任何接口不回显）。认证开关 = `API_TOKEN` 是否为空；令牌遗失 → 置空重启回到关闭态，重新生成后再开。
