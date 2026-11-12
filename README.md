# Workbench

> 个人观测台：一眼看清我的服务、站点与开源项目的健康与互动。

![Java](https://img.shields.io/badge/Java-25-blue) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1.1-6DB33F) ![React](https://img.shields.io/badge/React-19-61DAFB) ![License](https://img.shields.io/badge/License-MIT-yellow)

Workbench 是一个**单用户、自托管**的后台系统，同时是一个以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体学习项目。它把我自己的三类东西收进一个控制台：

- 自有服务器上部署的服务——活着吗、谁在用、哪里报错、多慢；
- 开源项目的静态页面——能不能打开；
- GitHub 仓库——有没有人看、增长如何。

它解决的是一个很具体的问题：每天打开一次，比 SSH 上去翻日志更快地知道「我的东西都活着吗、有人在看吗」。后端纯文件存储，无数据库、无缓存、无对象存储；一条 `docker compose up -d` 即可在 2C2G 的小机器上跑起来。

> 开发规范见 [AGENTS.md](./AGENTS.md)，当前计划与验收见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。

## 功能（能力类别快照，不逐功能追加）

- **总览**：所有观测对象的健康卡与异常汇总，一屏回答「现在有没有东西挂了」。
- **服务与站点**：自部署服务的拨测状态、可用率与延迟历史；自有服务可经 ingest 上报结构化访问记录。
- **开源项目**：GitHub 仓库接入与 token 管理；views/clones 流量曲线、每日快照（stars / forks / watchers / open issues）与 releases 下载量。
- **设置**：数据源管理、GitHub token、主题与锁屏。
- **认证**：密码登录换取会话令牌（服务端只存哈希，会话存内存）；外部上报可用机器令牌。两者皆空即关闭认证，适合本机开发。

## 技术栈

| 组件 | 选型 | 说明 |
|---|---|---|
| 语言 / 运行时 | Java 25 LTS（Temurin 25.0.4.1+1） | 仅以局部 `JAVA_HOME` 引用，不写系统环境变量 |
| 应用框架 | Spring Boot 4.1.1（`spring-boot-starter-webmvc` + `starter-validation`） | 模块化单体 |
| 接口文档 | SpringDoc OpenAPI 3.1.1 | Swagger UI |
| 存储 | 纯文件系统：JSONL 时序数据 + JSON 配置 | 无数据库 / 缓存 / 对象存储 |
| 前端 | React 19 + TypeScript 5.8 + Vite 6 | 单页控制台，`console.css` 自绘，无 UI 框架 |
| 前端字体 | IBM Plex Sans / Mono（fontsource 自托管，latin 子集） | 正文与数据分字体 |
| 测试 | JUnit 5（各模块 test） | `mvn test` |

模块划分、依赖规则与内部结构见 [AGENTS.md · 架构与目录约定](./AGENTS.md#4-架构与目录约定)。

## 快速开始

要求：JDK 25、Maven 3.9+、Node 20+ 与 pnpm。纯文件存储，无需 Docker。

```bash
git clone https://github.com/guol9180/workbench.git
cd workbench

# 后端
export JAVA_HOME=/path/to/jdk-25
cd backend && mvn package && java -jar workbench-server/target/workbench-server.jar

# 前端（另开终端）
cd frontend && pnpm install && pnpm dev
```

Windows 用户可直接双击根目录 `start.bat`（内置局部 `JAVA_HOME`）。后端默认 `http://localhost:8080`，接口文档 `/swagger-ui.html`，前端开发服务器 `http://localhost:5173`（`/api` 已代理到 8080）。

## 部署

单域名、单部署单元：Caddy 对外提供 HTTPS，托管前端静态产物并反代 `/api` 到后端容器；前后端同源，不存在 CORS 配置。参考 2C2G 服务器：workbench 容器上限 768m、Caddy 上限 128m。

```bash
cp .env.example .env        # 填写 AUTH_PASSWORD_SHA256
docker compose pull && docker compose up -d
```

- 镜像：打 `v*` 标签触发 Actions 构建两个镜像——后端 `:latest`、前端静态产物 `:frontend`（Caddy 运行时）
- 持久化：`workbench-runtime` 卷存时序数据与 `sources.json`（含 GitHub token，任何接口不回显）
- 密码遗失兜底：置空 `AUTH_PASSWORD_SHA256` 重启回到关闭态

## 数据与隐私

- 数据只存在你自己的机器上：时序 JSONL + `sources.json`，无遥测、无外部上报。
- GitHub token 只用于只读 API；任何接口不回显 token 值。
- 数据目录内只有真实探测、采集与用户操作产生的数据；测试一律使用临时目录。

## 许可证

本项目采用 [MIT 许可证](./LICENSE)。
