# AGENTS.md

## 0. 总则

本项目为 **Spring Boot 单体架构 + Maven 多模块** 项目。

所有参与本项目开发的人员、AI Agent、代码生成工具，都必须严格遵守本文件中的架构规范、模块规范、命名规范和依赖规则。

如果口头需求、临时讨论、历史代码与本文件冲突，原则上以本文件为准。

如果确实需要调整架构，必须先修改本文件，再修改代码。

---

## 1. 架构定位

本项目采用：

> **模块化单体架构**

当前阶段不拆微服务，但通过 Maven 模块和业务模块内部 `api` 层，保证后续可扩展、可拆分。

核心原则：

1. 单体部署，统一由 `workbench-server` 启动。
2. 业务代码按模块隔离。
3. 公共能力下沉到 `workbench-common`。
4. 框架能力沉淀到 `workbench-framework`。
5. 技术设施沉淀到 `workbench-infrastructure`。
6. 业务模块之间必须通过 `api` 层交互。
7. 禁止跨模块直接访问 `DO`、`mapper`、`service.impl`、`controller`。
8. 禁止在公共模块中写业务逻辑。
9. 禁止在启动模块中写业务逻辑。
10. 架构演进采用渐进式，不允许未经确认随意新增 Maven 模块。

---

## 2. Maven 模块结构

当前项目固定为以下模块：

```text
workbench
├── workbench-common             # 公共基础能力（零依赖）
├── workbench-framework          # 框架能力（Web 运行通用机制，零端点）
├── workbench-infrastructure     # 技术设施（中间件与外部资源封装，中性模型）
├── workbench-module-auth        # 认证授权业务模块（/api/auth/**）
├── workbench-module-docs        # 在线文档业务模块（/api/docs/**）
├── workbench-module-XXX业务功能  # 未来扩展的业务模块
└── workbench-server             # 聚合启动（main + 配置，禁止业务）
```

模块命名约定：`workbench-module-<x>` 对应包名 `com.imhgl.workbench.<x>`，HTTP 接口统一挂 `/api/<x>/**`（自动纳入 Token 认证拦截）。

---

## 3. 各模块职责细则

各模块根包的 `package-info.java` 与本节是同一规范的两个载体，修改时必须同步。

### 3.1 workbench-common（com.imhgl.workbench.common）

职责：存放通用、无业务含义的基础能力。

允许存放：统一返回结果、分页对象、通用异常、错误码枚举、通用常量、通用枚举、基础工具类、基础注解、基础实体。

禁止存放：业务逻辑、Controller、Service、Mapper、Entity、Redis 封装、短信封装、文件存储封装、第三方调用。

当前内容：`result/ApiResult`（统一响应 {message, code, data}，code=0 成功）、`exception/`（ErrorCode 错误码枚举、BusinessException 业务异常）、`page/`（PageQuery 分页入参归一化、PageResult 分页返回）。

### 3.2 workbench-framework（com.imhgl.workbench.framework）

职责：存放应用框架层能力，即 Web 应用运行所需的通用框架能力。

允许存放：全局异常处理、统一日志切面、操作日志切面、权限拦截器、登录拦截器、Token 校验契约（TokenVerifier）、接口文档配置、Web MVC 配置、Jackson 配置、CORS 配置、参数解析器、过滤器、请求上下文、当前登录用户解析。

禁止存放：HTTP 端点（Controller，一律放业务模块）、具体业务逻辑、业务 Mapper、业务 Entity、业务 DTO、业务 VO、第三方业务调用。

当前内容：`interceptor/`（AuthInterceptor）、`token/`（TokenVerifier 契约）、`config/`（CORS、API 安全策略、SpringDoc 接口文档）、`handler/`（全局异常处理），`aspect/`、`filter/`、`resolver/` 为预留占位。

### 3.3 workbench-infrastructure（com.imhgl.workbench.infrastructure）

职责：存放基础设施层能力，即外部技术组件、第三方服务、中间件封装。

允许存放：Redis、缓存、文件存储、本地存储、OSS、短信、邮件、消息队列、支付网关、微信、支付宝、第三方 HTTP 客户端、定时任务基础组件。

禁止存放：用户业务规则、业务 Controller、业务 Service、业务 Mapper、业务 DO。

附加规则：只产出中性模型与中性配置（如 `StorageNode`、`workbench.storage.*`），禁止业务色彩命名。

当前内容：`storage/`（FileTreeStorage、StorageNode、FileStorageProperties）、`mybatis/`（MybatisPlusConfig 分页插件、Pages 分页结果适配）；已引入 MySQL 驱动、MyBatis-Plus、MyBatis-Plus-Join、Redis 依赖（见第 7 节技术选型）。

### 3.4 workbench-module-auth（com.imhgl.workbench.auth）

职责：认证授权业务，对外提供 `/api/auth/**`（密码登录、登录状态查询）。

内部结构：`controller/`（端点）、`service/`（TokenService：token 签发与校验，实现 framework 的 `TokenVerifier` 契约，供登录拦截器调用）、`config/`（AuthProperties：`workbench.auth.*`）、`dto/`（LoginRequest）。登出由前端删除本地 token 完成（无状态 token 无需服务端注销）。当前无跨模块调用方，暂无 api 层；一旦被跨模块调用，必须先补 api 接口。

### 3.5 workbench-module-docs（com.imhgl.workbench.docs）

职责：在线文档功能相关业务代码（文档/文件夹 CRUD、全文搜索）。

### 3.6 workbench-server（com.imhgl.workbench）

职责：启动模块、聚合模块、部署模块。

允许存放：Spring Boot 启动类、应用级配置、数据源配置、MyBatis 配置、Redis 配置、Security 配置、线程池配置、多环境配置文件、日志配置、数据库脚本。配置统一放在 `backend/workbench-server/src/main/resources` 下。

禁止存放：业务 Controller、业务 Service、业务 Mapper、业务 DO、业务 DTO、业务 VO、具体业务逻辑；禁止被任何模块依赖。

---

## 4. 依赖规则

```text
workbench-server        → 业务模块（module-*）、workbench-framework
业务模块（module-*）     → workbench-framework、workbench-infrastructure、workbench-common
workbench-framework     → workbench-common
workbench-infrastructure → workbench-common（允许，当前未使用）
workbench-common        → 零依赖（禁止依赖任何模块）
```

1. 依赖方向由各模块 pom 强制保证，写不出违规依赖。
2. 禁止循环依赖；任何模块禁止依赖 `workbench-server`。
3. `common`、`framework`、`infrastructure` 禁止依赖任何业务模块。

---

## 5. 业务模块内部结构

```text
com.imhgl.workbench.<x>/
├── api/          # 对外唯一契约（接口），跨模块交互只允许注入此接口
│   └── impl/     # api 实现
├── controller/   # HTTP 端点（/api/<x>/**），不收裸 Map，入参用 dto
├── dto/          # 请求入参
├── model/        # 领域与出参模型
├── entity/       # 数据库 DO（MyBatis-Plus @TableName，仅模块内可见）
├── mapper/       # MyBatis-Plus mapper 接口（@Mapper，经 infrastructure 传递获得 MP）
└── service/      # 模块内业务服务
```

不涉及数据库的模块可省略 entity/、mapper/（如 docs、auth）。建表 SQL 放 `backend/db/init/`（见该目录 README）。

1. 跨模块交互只走对方 `api` 接口，禁止访问对方的 DO、mapper、service.impl、controller、storage。
2. infrastructure 产出的中性模型（如 `StorageNode`）由业务模块的 api 实现层适配为业务语义。
3. 新增业务模块：在 `backend/` 下建 `workbench-module-xxx` 子工程，父 POM 加 `<module>`，`workbench-server` 加依赖；包名以 `com.imhgl.workbench` 开头即被自动扫描。

---

## 6. 配置命名约定

1. 业务模块配置：`workbench.<module>.*`（如 `workbench.docs.*`）。
2. 认证配置 `workbench.auth.*` 由 auth 模块的 `AuthProperties` 绑定（密码、密钥、有效期），framework 的登录拦截器只依赖 `TokenVerifier` 契约，不绑定业务配置。
3. infrastructure 配置：按技术组件中性命名（如 `workbench.storage.*`），禁止业务前缀。
4. 环境变量映射保持部署稳定：改配置键不改环境变量（如 `DOCS_ROOT` → `workbench.storage.root`）。

---

## 7. 技术选型

| 组件 | 选型 | 版本 | 归属 |
|---|---|---|---|
| 语言 / 运行时 | Java 21（虚拟线程） | - | 全局 |
| 应用框架 | Spring Boot | 3.5.4（parent 管理） | 全局 |
| 数据库 | MySQL 8 | - | compose 容器；驱动在 infrastructure |
| ORM | MyBatis-Plus（`mybatis-plus-spring-boot3-starter` + `mybatis-plus-jsqlparser`） | 3.5.17 | infrastructure |
| 连表查询 | MyBatis-Plus-Join（`mybatis-plus-join-boot-starter`） | 1.5.9 | infrastructure |
| 缓存 | Redis（`spring-boot-starter-data-redis`） | parent 管理 | infrastructure |
| 接口文档 | SpringDoc OpenAPI（`springdoc-openapi-starter-webmvc-ui`） | 2.8.9 | framework |
| 样板代码 | Lombok | parent 管理（provided） | 父 POM 全局 |
| 通用工具 | Hutool（`hutool-all`） | 5.8.38 | 父 POM 全局 |

规则：

1. 新增第三方依赖必须先登记到本表，再写代码（先改规范再改代码）。
2. 版本统一由父 POM `dependencyManagement` 管理；`mysql-connector-j`、redis starter、lombok 由 Spring Boot parent 管理。
3. 依赖归属：DB / ORM / 缓存等中间件封装 → infrastructure；接口文档等 Web 框架能力 → framework；lombok / hutool 全局基础件 → 父 POM。
4. 业务模块经 infrastructure 传递获得 MyBatis-Plus / MPJ；mapper 接口用 `@Mapper` 注解即被自动扫描，无需集中 `@MapperScan`。
5. docs 模块的文档存储仍为文件系统（.md 即数据）；MySQL 服务承载后续业务模块（博客等）的结构化数据。
6. Redis 当前仅引入依赖与连接配置，出现真实消费场景前不写封装类。
7. 相关环境变量：`MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USERNAME` / `MYSQL_ROOT_PASSWORD`、`REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`；接口文档开关 `SPRINGDOC_API_DOCS_ENABLED`（默认开启，生产可关）。
8. 分页约定：查询入参用 common 的 `PageQuery`，MP 查询用 `Page`，返回经 infrastructure 的 `Pages.toResult()` 转为 common 的 `PageResult`。
