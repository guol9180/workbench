# AGENTS.md

## 0. 总则

本项目为**个人学习练手项目**：一个以「架构清晰、代码质量优先」为标准的 Spring Boot 模块化单体，当前唯一业务模块为**在线 Markdown 文档（docs）**。

所有参与本项目开发的人员、AI Agent、代码生成工具，都必须严格遵守本文件中的架构规范、模块规范、命名规范、依赖规则与 API 约定。

如果口头需求、临时讨论、历史代码与本文件冲突，原则上以本文件为准。如果确实需要调整架构，必须先修改本文件，再修改代码。

---

## 通用规范（必建三条 + 项目追加）

1. **终端统一 PowerShell 7**：所有终端命令使用 PowerShell 7（pwsh）执行；本机未安装时提示用户安装后再继续，不以旧版 PowerShell 替代。
2. **复用优先，不过度设计**：同一逻辑或结构出现第二份副本时，立即抽取为公共函数 / 公共样式 / 公共组件；前端页面表现优先组件化；保证代码质量，不为假想的未来需求预先抽象。
3. **文档同步**：每次开发结束或提交之前，同步更新 README.md、AGENTS.md、DEVELOP_PLAN.md；文档与代码不同步视为任务未完成。
4. **代码质量优先（项目追加）**：对代码质量要求高——凡能通过合理的设计模式或算法优化提升清晰度、健壮性与性能处，积极实践；但必须服务于当下真实需求，拒绝炫技式、无收益的抽象。每处抽象都要能回答「它解决了什么已发生的问题」。
5. **注释质量（学习项目追加）**：注释要规范且易懂，以「帮助下一次阅读的人真正理解代码」为标准；具体要求见下节「注释规范」，与代码同等对待——注释缺失或过时视为未完成。

---

## 注释规范（学习项目）

本项目是学习项目，注释是写给「下一次阅读的人（含未来的自己）」的教材，与代码同等重要：

1. **公共契约必写 Javadoc**：类、接口、公共方法说明职责、参数语义、返回与抛错约定（如 `FileTreeStorage.read` 须写明「文件不存在抛 StorageException(NOT_FOUND)」）。
2. **解释「为什么」，不复述「做什么」**：`i++` 不需要注释；「为什么上限是 100」「为什么先物化路径清单再懒读内容」必须注释。
3. **记录设计取舍**：值对象、守卫、算法短路这类决策点，注明动机与代价（如 `DocPath` 拒绝空段而非折叠——把理由写出来）。
4. **与代码同步**：改行为必须改注释；过时的注释比没有更糟，删除优于留错。
5. **语言与文风**：中文、简练、直给；一行说得清的不写三行；不复读代码字面。
6. **package-info 承载架构说明**：每个模块根包的 package-info 与 AGENTS.md 3.x 对应小节是同一规范的两个载体，修改时必须同步。

---

## 1. 架构定位

> **模块化单体**（学习向：用最小的业务面留住完整的架构分层）

1. 单体部署，统一由 `workbench-server` 启动。
2. 业务代码按模块隔离；模块之间只通过 `api` 层交互，禁止跨模块访问 `model`、`service.impl`、`controller`。
3. 公共能力下沉 `workbench-common`，框架能力沉淀 `workbench-framework`，技术设施沉淀 `workbench-infrastructure`。
4. 禁止在公共模块、框架模块、技术设施模块中写业务逻辑；禁止在启动模块中写业务逻辑。
5. **纯文件存储，无数据库**：文档即文件（`.md`），不引入 MySQL / Redis / OSS 等外部服务。
6. 本期后端不与前端联调：API 按本文件约定设计，不为旧前端兼容妥协；前端在 UI 重做期对齐 v2 API。
7. 架构演进渐进式，未经确认不新增 Maven 模块。

---

## 2. Maven 模块结构

```text
workbench-backend
├── workbench-common             # 响应与异常契约（零业务、零 Spring 依赖）
├── workbench-framework          # Web 框架能力（异常映射 / 校验 / CORS / OpenAPI，零端点）
├── workbench-infrastructure     # 技术设施（中性文件树存储，防穿越 + 白名单）
├── workbench-module-docs        # 在线文档业务模块（/api/docs/**）
└── workbench-server             # 聚合启动（main + 配置，禁止业务、禁止被依赖）
```

模块命名约定：`workbench-module-<x>` 对应包名 `com.imhgl.workbench.<x>`，HTTP 接口统一挂 `/api/<x>/**`。

---

## 3. 各模块职责细则

各模块根包的 `package-info.java` 与本节是同一规范的两个载体，修改时必须同步。

### 3.1 workbench-common（com.imhgl.workbench.common）

职责：统一响应与异常契约，全局最小公约数。

- 允许存放：统一返回结果 `ApiResult`、错误码枚举 `ErrorCode`、业务异常 `BusinessException`、通用常量与基础工具。
- 禁止存放：任何业务逻辑、Spring 依赖、HTTP 端点、技术设施封装。
- 当前内容：`record ApiResult<T>(message, code, data)`（code=0 成功）、`ErrorCode`（PARAM_INVALID / NOT_FOUND / CONFLICT / METHOD_NOT_ALLOWED / INTERNAL_ERROR）、`BusinessException`。

### 3.2 workbench-framework（com.imhgl.workbench.framework）

职责：Web 应用运行所需的通用框架能力。

- 允许存放：全局异常处理（业务异常→400 语义错误码；校验失败→400 `PARAM_INVALID`；未知→500 不泄漏细节）、参数校验、CORS 配置、SpringDoc/OpenAPI 配置、请求上下文等 Web 通用机制。
- 禁止存放：HTTP 端点（一律放业务模块）、业务逻辑、业务 DTO。
- 当前内容：`handler/GlobalExceptionHandler`、`config/`（CorsProperties、CorsConfig、OpenApiConfig）。

### 3.3 workbench-infrastructure（com.imhgl.workbench.infrastructure）

职责：外部技术组件与资源的中性封装。

- 允许存放：文件树存储（防路径穿越、扩展名白名单、受控读写）、未来可能的缓存 / 对象存储等中性封装。
- 禁止存放：业务规则、业务 Controller / Service / DTO；禁止业务色彩命名。
- 当前内容：`storage/`——`FileTreeStorage`（受控文件系统入口：resolve / validateName / validateExtension / isAllowedFile / tree / listAllowedFiles / read / create / save / createDir / rename / delete / toRel）、`record StorageNode`（中性树模型）、`StorageException`（中性状态异常，NOT_FOUND / CONFLICT，由业务模块翻译）、`FileStorageProperties`（`workbench.storage.*`）。
- 附加规则：只产出中性模型与中性配置；业务语义由业务模块的 api 实现层适配。

### 3.4 workbench-module-docs（com.imhgl.workbench.docs）

职责：在线 Markdown 文档业务——文件树、在线读写保存、新建文档/文件夹、重命名、删除、全文搜索。

- 内部结构：`api/`（`DocsApi` 对外唯一契约 + `impl/` 适配实现）、`controller/`（八端点，只注入 `DocsApi`）、`dto/`（请求入参 record + jakarta validation）、`model/`（领域与出参 record，含 `DocPath` 值对象）、`service/`（模块内业务服务，如 `DocSearchService`）。
- **`DocPath` 值对象约定**：相对路径的归一化与安全校验收拢在 `model/DocPath`，service 层一律以 `DocPath` 流转；api/controller 边界收 `String`，跨模块友好。
- 搜索：文件名与内容双匹配、大小写不敏感、上限 100、懒遍历短路（命中即停，不整树物化）、结构化 `SearchHit{path, name, fileNameMatch, line, snippet}`。

### 3.5 workbench-server（com.imhgl.workbench）

职责：启动模块、聚合模块、部署模块。

- 允许存放：Spring Boot 启动类（`@ConfigurationPropertiesScan`）、`application.yml`、日志配置。
- 禁止存放：业务 Controller / Service / DTO / 业务逻辑；禁止被任何模块依赖。

---

## 4. 依赖规则

```text
workbench-server        → workbench-module-docs（含传递 framework / infrastructure / common）
workbench-module-docs   → workbench-framework、workbench-infrastructure、workbench-common
workbench-framework     → workbench-common
workbench-infrastructure → workbench-common
workbench-common        → 零依赖
```

1. 依赖方向由各模块 pom 强制保证，写不出违规依赖。
2. 禁止循环依赖；任何模块禁止依赖 `workbench-server`。
3. common / framework / infrastructure 禁止依赖业务模块。
4. 业务模块经 framework 获得 Web 与校验能力，经 infrastructure 获得受控文件访问，经 common 获得响应契约。
5. 全局基础件（Lombok / Hutool）只在父 POM dependencyManagement 管版本，**不默认注入**——谁用谁在模块里声明，保证「common 零依赖」名实相符。

---

## 5. 业务模块内部结构

```text
com.imhgl.workbench.<x>/
├── api/          # 对外唯一契约（接口），跨模块交互只允许注入此接口
│   └── impl/     # api 实现（适配 infrastructure 中性模型为业务语义）
├── controller/   # HTTP 端点（/api/<x>/**），入参用 dto + @Valid，不收裸 Map
├── dto/          # 请求入参（record + jakarta validation）
├── model/        # 领域与出参模型（record；含 DocPath 这类值对象）
└── service/      # 模块内业务服务
```

1. controller 不写业务规则，薄到「接参 → 调 api → 包 ApiResult」。
2. 值对象优先：有不变量约束的概念（如相对路径）做成值对象，不让裸字符串穿透 service 层。
3. 新增业务模块：`backend/` 下建 `workbench-module-xxx`，父 POM 加 `<module>`，server 加依赖；包名以 `com.imhgl.workbench` 开头即被自动扫描；先在本文件登记职责再动代码。

---

## 6. 配置命名约定

1. 业务模块配置：`workbench.<module>.*`（如 `workbench.docs.*`）。
2. infrastructure 配置：技术组件中性命名（如 `workbench.storage.*`），禁止业务前缀。
3. 环境变量映射保持部署稳定：改配置键不改环境变量（`workbench.storage.root` ↔ `DOCS_ROOT`、`workbench.cors.allowed-origins` ↔ `CORS_ALLOWED_ORIGINS`、SpringDoc 开关 ↔ `SPRINGDOC_API_DOCS_ENABLED`）。

---

## 7. 技术选型

| 组件 | 选型 | 版本 | 归属 |
|---|---|---|---|
| 语言 / 运行时 | Java（Temurin JDK） | 25 LTS（25.0.4.1+1，`D:\dev\environment\jdk-25.0.4.1+1`） | 全局 |
| 应用框架 | Spring Boot（parent） | 4.1.1 | 全局 |
| Web | `spring-boot-starter-webmvc`（Boot 4 新坐标） | parent 管理 | framework |
| 参数校验 | `spring-boot-starter-validation` | parent 管理 | framework |
| 接口文档 | SpringDoc OpenAPI（`springdoc-openapi-starter-webmvc-ui`） | 3.1.1 | framework |
| 测试 | JUnit 5（`spring-boot-starter-test` / `junit-jupiter`） | parent 管理 | 各模块 test |
| 样板代码 | Lombok | parent 管理（provided） | 父 POM dependencyManagement，按需在模块声明 |
| 通用工具 | Hutool（`hutool-all`） | 父 POM dependencyManagement | 父 POM dependencyManagement，按需在模块声明 |

规则：

1. **新增第三方依赖必须先登记到本表，再写代码**（先改规范再改代码）。
2. 版本统一由父 POM / Spring Boot parent `dependencyManagement` 管理。
3. **数据库零依赖**：不引入 ORM / JDBC / NoSQL 驱动；docs 模块持久化即文件系统。
4. Lombok / Hutool 按需使用、不为用而用；record 能覆盖的场景优先 record。
5. JDK 25 仅以局部 `JAVA_HOME`（命令内或 start.bat 内）引用，**禁止写入系统/用户环境变量**——其他项目继续使用 JDK 21。
6. Web starter 若 `spring-boot-starter-webmvc` 不可解析，回退 `spring-boot-starter-web` 并在提交信息注明。

---

## 8. API 设计约定（/api/docs）

统一包装：`ApiResult{message, code, data}`，`code=0` 成功；错误码见 3.1。

| 方法 | 路径 | 入参 | 出参 data |
|---|---|---|---|
| GET | `/api/docs/tree` | - | `DocNode{name, path, type:"dir"\|"file", children[]}` |
| GET | `/api/docs/file?path=` | query | `DocContent{path, name, content}` |
| POST | `/api/docs/file` | `{path, content}` | - |
| PUT | `/api/docs/file` | `{path, content}` | - |
| POST | `/api/docs/dir` | `{path}` | - |
| POST | `/api/docs/rename` | `{from, to}` | - |
| DELETE | `/api/docs/resource?path=` | query | - |
| GET | `/api/docs/search?q=` | query | `List<SearchHit{path, name, fileNameMatch, line, snippet}>` |

错误映射：领域冲突 → HTTP 400 + 语义错误码 + 具体中文消息——不存在 = `NOT_FOUND(40400)`、已存在/状态冲突 = `CONFLICT(40900)`；非法输入（路径穿越、非法名、扩展名不在白名单）→ HTTP 400 + `PARAM_INVALID(40000)`；未知路径 → HTTP 404 + `NOT_FOUND`；方法不支持 → HTTP 405 + `METHOD_NOT_ALLOWED(40500)`；校验失败 / 缺参 / 体不可读 → HTTP 400 + `PARAM_INVALID("请求参数错误")`；未知异常 → HTTP 500 + `INTERNAL_ERROR("服务器内部错误")`，不泄漏堆栈与类名。

> 语义化机制：infrastructure 的文件操作抛中性的 `StorageException`（Reason = NOT_FOUND / CONFLICT），docs 模块 api 实现层负责翻译为 `BusinessException`——中性异常不出技术设施语义，业务错误码不出现在 infrastructure。

搜索行为：q trim 后空返回 `[]`；大小写不敏感；文件名命中 `fileNameMatch=true` 且 `snippet` 为文件名；内容命中给 `line`（1 起）与 `snippet`（命中行 strip，超 120 字符截断加 `…`）；双命中都给、`snippet` 取内容命中；上限 100；相对路径字典序；单文件 IO 失败静默跳过；懒遍历短路。

---

> 项目背景、技术栈与启动方式见 [README.md](./README.md)，当前计划与验收清单见 [DEVELOP_PLAN.md](./DEVELOP_PLAN.md)。三文档职责互斥：同一信息只写在归属文件，其余位置引用而不复制；修订时只改归属文件，引用处自动生效。
