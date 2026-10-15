# 工作台 · Workbench

个人学习练手的工作台系统：一个以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体，按功能模块组织，用最小的业务面留住完整的架构分层。当前唯一业务模块是**在线 Markdown 文档**（文件树 / 在线编辑保存 / 新建重命名删除 / 全文搜索）。

> 开发规范见 [AGENTS.md](./AGENTS.md)，当前计划与验收见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。

## 技术栈

- **语言 / 运行时**：Java 25 LTS（Temurin 25.0.4.1+1，位于 `D:\dev\environment\jdk-25.0.4.1+1`，仅以局部 `JAVA_HOME` 引用，不改系统环境变量）
- **框架**：Spring Boot 4.1.1（`spring-boot-starter-webmvc` + `starter-validation`）· SpringDoc OpenAPI 3.1.1（Swagger UI）
- **存储**：纯文件系统（文档即文件，`.md` 即数据），**无数据库、无缓存、无对象存储**
- **构建**：Maven 多模块（common / framework / infrastructure / module-docs / server 五模块）
- **前端**：Vue 3 + Vite（`frontend/`，本期待 UI 重做期再与 v2 API 对齐，暂不联调）

## 仓库结构

```text
workbench/
├── backend/                      # Maven 模块化单体
│   ├── workbench-common/         # 响应与异常契约（record ApiResult / ErrorCode / BusinessException）
│   ├── workbench-framework/      # Web 框架能力：全局异常映射 / 参数校验 / CORS / OpenAPI（零端点）
│   ├── workbench-infrastructure/ # 技术设施：中性文件树存储（防穿越 + 白名单 + 受控读写）
│   ├── workbench-module-docs/    # 在线文档业务模块（api 层 + DocPath 值对象 + 搜索服务）
│   └── workbench-server/         # 聚合启动（main + application.yml，禁止业务）
├── frontend/                     # Vue 3 + Vite（UI 重做期对齐 v2 API）
├── AGENTS.md / DEVELOP_PLAN.md / README.md
└── docs/superpowers/plans/       # 重构实施计划（2026-10-15-backend-refactor-docs-only.md）
```

## 本地开发

要求：JDK 25（本机 `D:\dev\environment\jdk-25.0.4.1+1`）、Maven 3.9+。纯文件存储，**无需 Docker / MySQL / Redis**，开箱即跑。

PowerShell 7 下（命令内局部设置 `JAVA_HOME`，不影响其他项目）：

```powershell
$env:JAVA_HOME = 'D:\dev\environment\jdk-25.0.4.1+1'
cd backend
mvn package                     # 全量构建 + 测试（46 个用例）
mvn -pl workbench-server spring-boot:run
```

启动后：<http://localhost:8080/swagger-ui.html>（接口文档），文档库默认在 `backend/data/docs`（环境变量 `DOCS_ROOT` 可改）。Windows 也可双击根目录 `start.bat`（已内置局部 `JAVA_HOME`）。

## API 一览（/api/docs，统一包装 `{message, code, data}`，code=0 成功）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/docs/tree` | 文件树（目录优先、不分大小写排序） |
| GET | `/api/docs/file?path=` | 读取文档 |
| POST / PUT | `/api/docs/file` | 新建 / 保存（body：`{path, content}`） |
| POST | `/api/docs/dir` | 新建文件夹（body：`{path}`） |
| POST | `/api/docs/rename` | 重命名/移动（body：`{from, to}`） |
| DELETE | `/api/docs/resource?path=` | 删除（递归） |
| GET | `/api/docs/search?q=` | 全文搜索（文件名+内容双匹配、上限 100、懒遍历短路、结构化命中） |

错误映射：领域冲突 → 400 + 语义错误码（40000/40400/40900）；校验失败 → 400 + 40000「请求参数错误」；未知异常 → 500 + 50000「服务器内部错误」。完整行为约定见 [AGENTS.md · API 设计约定](./AGENTS.md#8-api-设计约定apidocs)。

## 部署

> 🚧 **部署链暂缓**：Docker / Caddy / CI / GitHub Pages 相关文件保留但基于旧版后端，恢复部署时按 Java 25 + docs-only 新栈重写；届时同步更新本节。
