# 工作台 · Workbench

个人工作台系统：**前端部署在 GitHub Pages，后端跑在自己的服务器 Docker 容器里**，按功能模块组织，方便后续扩展更多服务。

首个功能模块：**在线 Markdown 文档系统**。

## 架构

```
┌─────────────────────┐         HTTPS (Bearer Token)        ┌──────────────────────────┐
│  前端 (GitHub Pages) │ ──────────────────────────────────▶ │  后端 (你的服务器 Docker)  │
│  Vue 3 + Vite       │                                      │  Spring Boot 模块化单体    │
│  frontend/          │                                      │  backend/                 │
└─────────────────────┘                                      └──────────────────────────┘
```

### 仓库结构（Monorepo）

```
workbench/
├── frontend/                     # Vue 3 + Vite + Pinia，发布到 GitHub Pages
│   ├── public/vendor/vditor/     # Vditor 编辑器本地副本（无 CDN 依赖）
│   └── src/modules/docs/         # 在线文档模块（路由 + API + 组件 + 状态）
└── backend/                      # Maven 多模块单体（一个容器，2核2G 友好）
    ├── workbench-common/         # 公共：统一响应 / 全局异常 / Token 认证 / CORS
    ├── workbench-module-docs/    # 在线文档模块（/api/docs/**）
    └── workbench-server/         # 启动聚合应用（main + 配置）
```

### 功能（在线文档模块）

- **文档管理**：新建 / 编辑 / 重命名 / 删除文档与文件夹，文件树浏览
- **Markdown 编辑**：所见即所得 + 分屏预览 + 大纲导航（Vditor），`Ctrl+S` 保存
- **今日工作**：一键创建 / 打开按日期组织的日志（`日志/2026-08/2026-08-19.md`）
- **打开本地文件**：选择或拖拽本地 `.md` 文件直接预览（文件不离开浏览器），可一键导入
- **全文搜索**：按文件名和内容搜索
- **密码登录**：无状态 Token（30 天有效），跨域部署友好
- **移动端适配**：侧边栏收为抽屉，触屏可用

## 本地开发

要求：JDK 21+、Maven 3.6.3+、Node 18+

```bash
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
# 服务器上：克隆仓库后，在仓库根目录创建 .env 写入密码与密钥（不要提交）
cat > .env <<'EOF'
APP_PASSWORD=改成你的密码
APP_TOKEN_SECRET=改成一串随机长字符
EOF

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

架构：外部流量 → Caddy（443，HTTPS）→ workbench 容器（8080，仅本机回环），compose 中后端端口只绑定 `127.0.0.1`，不直接暴露公网。

### 性能（2核2G 服务器）

- 单 JVM 单容器，`-XX:MaxRAMPercentage=75` + compose `mem_limit: 1g`（堆约 768M）
- Java 21 虚拟线程，文件 IO 型负载低开销
- 无状态 Token 认证，零会话内存，重启不掉登录
- 静态资源全部由 GitHub Pages 承担，服务器零静态流量
- CI 构建镜像避免在小内存服务器上跑 Maven 编译

## 如何新增功能模块

后端：在 `backend/` 下新建 `workbench-module-xxx` 子工程（参考 `workbench-module-docs`），父 POM 加 `<module>`，`workbench-server` 加依赖，包名以 `com.imhgl.workbench` 开头即可被自动扫描，接口挂 `/api/xxx/**` 自动纳入 Token 认证。

前端：在 `frontend/src/modules/` 下新建 `xxx/` 目录（`routes.js` + `api.js` + `components/`），在 `src/router/index.js` 中挂载路由即可。

## 数据与备份

文档以 `.md` 纯文本保存在 `DOCS_ROOT`（Docker 卷 `workbench-docs`），拷贝该目录即完成备份，可用任何 Markdown 软件打开。
