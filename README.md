# 工作台 · Workbench

个人后台管理系统（学习向）：以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体，定位是**流量监测 + 工具集**。当前包含：**流量监测域**（本系统 API 自监测 + 其他系统通用上报枢纽 + 管理查询）与第一个工具**在线 Markdown 文档**（文件树 / 在线编辑保存 / 全文搜索），后续工具以业务模块渐进扩展。

> 开发规范见 [AGENTS.md](./AGENTS.md)，当前计划与验收见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。

## 技术栈

- **语言 / 运行时**：Java 25 LTS（Temurin 25.0.4.1+1，位于 `D:\dev\environment\jdk-25.0.4.1+1`，仅以局部 `JAVA_HOME` 引用，不改系统环境变量）
- **框架**：Spring Boot 4.1.1（`spring-boot-starter-webmvc` + `starter-validation`）· SpringDoc OpenAPI 3.1.1（Swagger UI）
- **存储**：纯文件系统（文档即文件；监测时序数据为零依赖 JSONL 聚合存储），**无数据库、无缓存、无对象存储**
- **构建**：Maven 多模块（common / framework / infrastructure / module-docs / module-monitor / server 六模块）
- **认证**：轻量 Token（`X-API-Token` 请求头，配置式，空 = 关闭）
- **前端**：Vue 3 + Vite（`frontend/`，本期待 UI 重做期再与 v2 API 对齐，暂不联调）

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
├── frontend/                     # Vue 3 + Vite（UI 重做期对齐 v2 API）
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
| GET | `/api/monitor/status` | 监测域自检（桶数 / 文件数 / 认证开关） |

**认证**：环境变量 `API_TOKEN` 非空时，全部 `/api/**` 须携带请求头 `X-API-Token`，失败 401 + `40100`；为空 = 关闭。

错误映射：文件/目录不存在 → 400 + `40400`；已存在/冲突 → 400 + `40900`；非法输入（穿越、非法名、扩展名白名单外）→ 400 + `40000`；未知路径 → 404 + `40400`；方法不支持 → 405 + `40500`；未认证 → 401 + `40100`；未知异常 → 500 + `50000`「服务器内部错误」。完整行为约定见 [AGENTS.md · API 设计约定](./AGENTS.md#8-api-设计约定apidocs-与-apimonitor)。

## 部署

> 🚧 **部署链暂缓**：Docker / Caddy / CI / GitHub Pages 相关文件保留但基于旧版后端，恢复部署时按 Java 25 + docs-only 新栈重写；届时同步更新本节。
