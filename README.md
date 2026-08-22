# 工作台 · Workbench

个人工作台系统：**前端部署在 GitHub Pages，后端跑在自己的服务器 Docker 容器里**，按功能模块组织，方便后续扩展更多服务。

首个功能模块：**在线 Markdown 文档系统**；另有**认证授权模块**（密码登录 + 无状态 Token）。

## 架构

```
┌─────────────────────┐         HTTPS (Bearer Token)        ┌──────────────────────────┐
│  前端 (GitHub Pages) │ ──────────────────────────────────▶ │  后端 (你的服务器 Docker)  │
│  Vue 3 + Vite       │                                      │  Spring Boot 模块化单体    │
│  frontend/          │                                      │  backend/                 │
└─────────────────────┘                                      └──────────────────────────┘
```

### 技术栈

- **后端**：Java 21（虚拟线程）· Spring Boot 3.5.4 · MySQL 8 · MyBatis-Plus 3.5.17（含 MyBatis-Plus-Join 连表查询）· Redis（预留）· SpringDoc OpenAPI（Swagger UI）· Lombok · Hutool
- **前端**：Vue 3 · Vite · Pinia · vue-router 4（hash）· Vditor（本地副本，无 CDN）
- **部署**：Docker Compose（app + MySQL + Redis + Caddy HTTPS 反代）· GitHub Actions（前端 Pages / 后端 GHCR 镜像）

### 仓库结构（Monorepo）

```
workbench/
├── frontend/                     # Vue 3 + Vite + Pinia，发布到 GitHub Pages
│   ├── public/vendor/vditor/     # Vditor 编辑器本地副本（无 CDN 依赖）
│   └── src/modules/docs/         # 在线文档模块（路由 + API + 组件 + 状态）
└── backend/                      # Maven 模块化单体（一个容器，2核2G 友好）
    ├── workbench-common/         # 公共能力：统一响应 / 错误码 / 业务异常 / 分页对象（零依赖，禁止业务）
    ├── workbench-framework/      # 框架能力：登录拦截器 + Token 校验契约 + 全局异常 + CORS（零端点）
    ├── workbench-infrastructure/ # 技术设施：MySQL / MyBatis-Plus / Redis 依赖与配置、文件树存储（防穿越 / 白名单，中性模型）
    ├── workbench-module-auth/    # 认证授权业务模块（/api/auth/**，Token 机制由 framework 提供）
    ├── workbench-module-docs/    # 在线文档业务模块（api 层为模块间唯一交互入口）
    └── workbench-server/         # 聚合启动（仅 main + 配置，禁止业务、禁止被依赖）
```

### 模块与包结构约定

依赖方向为强制规则（由各模块 pom 保证，写不出违规依赖）：`server → 业务模块 → framework → common`，`业务模块 → infrastructure`；common 零依赖；common / framework / infrastructure 不依赖业务模块；禁止循环依赖；业务模块禁止依赖 server；未经确认不新增 Maven 模块。完整架构规范（模块职责细则、依赖规则、配置命名约定）见 [AGENTS.md](AGENTS.md)。

| 模块 | 包名 | 定位 | 禁止 |
|---|---|---|---|
| `workbench-common` | `com.imhgl.workbench.common` | 公共基础能力：统一响应 `ApiResult`（{message, code, data}，code=0 成功）、`ErrorCode` + `BusinessException`、分页 `PageQuery` / `PageResult` | 依赖任何模块；业务逻辑 |
| `workbench-framework` | `com.imhgl.workbench.framework` | 框架能力：登录拦截器、Token 校验契约（TokenVerifier）、全局异常、CORS、API 安全策略 | HTTP 端点；依赖业务模块；业务逻辑 |
| `workbench-infrastructure` | `com.imhgl.workbench.infrastructure` | 技术设施：承载 MySQL / MyBatis-Plus / Redis 依赖与配置（分页插件、`Pages` 分页适配），文件树存储 `FileTreeStorage`，只产出中性模型与中性配置 | 依赖业务模块；业务色彩命名 |
| `workbench-module-auth` | `com.imhgl.workbench.auth` | 认证授权业务：`/api/auth/**`（密码登录、登录状态），TokenService 实现 framework 的 TokenVerifier 契约 | 同业务模块通用规则 |
| `workbench-module-<x>` | `com.imhgl.workbench.<x>` | 业务模块，内部模板 `api / controller / dto / model / service`，接口挂 `/api/<x>/**` | 依赖 server；跨模块访问对方的 service / storage / controller（只允许走对方 api 层） |
| `workbench-server` | `com.imhgl.workbench` | 聚合启动：main + application.yml | 业务逻辑；被任何模块依赖 |

- 业务模块对外只暴露 `api` 接口（如 `DocsApi`），controller 与未来跨模块调用方统一注入该接口；auth 模块当前无跨模块调用方，暂无 api 层
- 登录拦截器与 Token 校验契约（TokenVerifier）沉淀在 framework；认证端点、密码校验与 token 签发/校验（TokenService，实现 TokenVerifier）在 `workbench-module-auth`，配置同用 `workbench.auth.*`
- infrastructure 只产出中性模型（如 `StorageNode`），业务语义（「文档库」根命名、文档域模型）由业务模块的 api 实现层适配
- 模块内 `dto/` 与 `model/` 分界：前者是请求入参，后者是领域与出参模型，controller 不收裸 `Map`
- 单一职责底线：一个类超过约 400 行或出现第二种变化原因时按职责拆

前端同理：`src/modules/<x>/` 自包含（routes + api + store + components + util），模块之间零引用；共享层只有 `src/api/http.js`（传输）、`src/stores/auth.js`（登录态）、`src/components` + `src/ui`（对话框 / Toast）。命令式的编辑器句柄不进 Pinia 状态，见 `modules/docs/editor.js` 的适配层写法。

### 功能（在线文档模块）

- **文档管理**：新建 / 编辑 / 重命名 / 删除文档与文件夹，文件树浏览
- **Markdown 编辑**：所见即所得 + 分屏预览 + 大纲导航（Vditor），`Ctrl+S` 保存
- **今日工作**：一键创建 / 打开按日期组织的日志（`日志/2026-08/2026-08-19.md`）
- **打开本地文件**：选择或拖拽本地 `.md` 文件直接预览（文件不离开浏览器），可一键导入
- **全文搜索**：按文件名和内容搜索
- **密码登录**：无状态 Token（30 天有效），跨域部署友好
- **移动端适配**：侧边栏收为抽屉，触屏可用

## 本地开发

要求：JDK 21+、Maven 3.6.3+、Node 20+、Docker（本地跑 MySQL / Redis）

```bash
# 基础设施（终端 0）：本地 MySQL + Redis（仅这两个服务）
docker compose -f docker-compose.dev.yml up -d

# 后端（终端 1）
cd backend
mvn spring-boot:run -pl workbench-server -am        # http://localhost:8080

# 前端（终端 2）
cd frontend
npm install
npm run dev                                         # http://localhost:5173
```

本地开发时前端请求由 Vite 代理转发到 `localhost:8080`，无需任何跨域配置。Windows 下可直接双击根目录 `start.bat`。

## 部署

### 第一步：前端 → GitHub Pages

1. 推送本仓库到 GitHub。
2. 仓库 **Settings → Pages**：Source 选择 **GitHub Actions**。
3. 仓库 **Settings → Secrets and variables → Actions → Variables** 新增 `VITE_API_BASE`，值为后端地址（如 `https://api.example.com`）。
4. 修改 `frontend/` 下任何文件并推送，`.github/workflows/deploy-frontend.yml` 会自动构建发布。

前端构建产物自包含（Vditor 为本地副本），访问地址形如 `https://<用户名>.github.io/<仓库名>/`。

### 第二步：后端 → 服务器 Docker

compose 已集成 Caddy 反向代理，自动为 API 域名申请续期 HTTPS 证书（需放行 80/443 端口，域名 `api.imhgl.com` 在 `Caddyfile` 中配置）。

```bash
# 服务器上：克隆仓库后，在仓库根目录创建 .env 写入密码与密钥（不要提交，可参考 .env.example）
cp .env.example .env && vim .env

# 方式一（推荐，2核2G 友好）：使用 CI 构建好的镜像
# 1. 打标签触发 .github/workflows/build-backend.yml 构建并推送 GHCR
git tag v1.0.0 && git push origin v1.0.0
# 2. 服务器上编辑 docker-compose.yml，启用 image: ghcr.io/guol9180/workbench:latest
docker compose pull && docker compose up -d

# 方式二：服务器上直接构建
docker compose up -d --build
```

环境变量（compose 已配置默认值，生产环境务必修改）：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `SERVER_PORT` | `8080` | 服务端口 |
| `APP_PASSWORD` | `workbench123` | 登录密码（**务必修改**） |
| `APP_TOKEN_SECRET` | 临时随机 | Token 签名密钥（**务必设置**，否则每次重启需重新登录） |
| `CORS_ALLOWED_ORIGINS` | `*` | 允许的前端来源，逗号分隔（可填 `https://workbench.imhgl.com` 收紧） |
| `DOCS_ROOT` | `/data/docs` | 文档库存储目录（持久化卷） |
| `MYSQL_ROOT_PASSWORD` | `please-change-mysql-password` | MySQL root 密码（**务必修改**） |
| `MYSQL_DATABASE` | `workbench` | 数据库名 |
| `REDIS_PASSWORD` | 空 | Redis 密码（未设密码留空） |
| `SPRINGDOC_API_DOCS_ENABLED` | `true` | 接口文档开关（生产可关） |

架构：外部流量 → Caddy（443，HTTPS）→ workbench 容器（8080，仅本机回环），compose 中后端端口只绑定 `127.0.0.1`，不直接暴露公网。

### 性能（2核2G 服务器）

- 四容器总预算：app 768m + MySQL 384m + Redis 48m + Caddy 128m，为系统留出余量
- app：`-XX:MaxRAMPercentage=75`（堆约 576M），Java 21 虚拟线程，文件 IO 型负载低开销
- MySQL：InnoDB buffer pool 128M、performance-schema 关闭（个人项目够用）
- Redis：纯缓存 32M 上限 + LRU 淘汰，关闭持久化
- 无状态 Token 认证，零会话内存，重启不掉登录
- 静态资源全部由 GitHub Pages 承担，服务器零静态流量
- CI 构建镜像避免在小内存服务器上跑 Maven 编译

## 如何新增功能模块

后端：在 `backend/` 下新建 `workbench-module-xxx` 子工程，包名 `com.imhgl.workbench.xxx`，内部模板 `api / controller / dto / model / entity / mapper / service`（api 为对外唯一契约，参考 `workbench-module-docs`；涉及数据库的模块用 `entity`（DO）+ `mapper`（@Mapper 接口，MyBatis-Plus 经 infrastructure 传递获得），建表 SQL 放 `backend/db/init/`）；依赖 framework、infrastructure 与 common，父 POM 加 `<module>`，`workbench-server` 加依赖。包名以 `com.imhgl.workbench` 开头即可被自动扫描，接口挂 `/api/xxx/**` 自动纳入 Token 认证。

前端：在 `frontend/src/modules/` 下新建 `xxx/` 目录（`routes.js` + `api.js` + `components/`），在 `src/router/index.js` 中挂载路由即可。

## 数据与备份

- 文档：`.md` 纯文本保存在 `DOCS_ROOT`（Docker 卷 `workbench-docs`），拷贝该目录即完成备份，可用任何 Markdown 软件打开
- MySQL：`docker exec workbench-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" workbench > backup.sql`
- Redis 为纯缓存（无持久化数据），无需备份
