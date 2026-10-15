# 后端重构（docs-only · Java 25 + Spring Boot 4.1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development（上游 skill，本仓库未收录） (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留 Maven 模块化单体骨架，将后端按「架构清晰、代码质量优先」标准整体重做为「仅 docs 模块、纯文件存储」的学习练手版：Java 25 + Spring Boot 4.1.1，删除 auth/devsetup 模块与 MySQL/Redis/OSS 依赖；本期不与前端联调，API 按最优设计产出；README / AGENTS / DEVELOP_PLAN 三文档按重构后的项目全新撰写。

**Architecture:** 五模块骨架不变（common / framework / infrastructure / module-docs / server）。common 收敛为响应与异常契约；infrastructure 只留中性文件树存储（防穿越 + 白名单 + 值对象级路径安全）；framework 只留全局异常 / CORS / SpringDoc / 参数校验；module-docs 保留 api 层适配模式并引入 `DocPath` 值对象；server 只做聚合启动与配置。

**Tech Stack:** Java 25（Temurin 25.0.4.1+1，位于 `D:\dev\environment\jdk-25.0.4.1+1`）· Spring Boot 4.1.1（parent）· springdoc-openapi-starter-webmvc-ui 3.1.1 · spring-boot-starter-validation · JUnit 5（starter-parent 管理）· Lombok / Hutool 保留在父 POM 全局，按需使用 · Maven 3.9.16。

**Spec:** 用户确认的决策与修订（升级最新栈 / 只留 docs 去 DB / 本期不联调前端 / 部署链暂缓 / Lombok·Hutool 按需 / 三文档全新写 / 代码质量观见 Task 1 第 4 条规范）；Task 1 完成后以重写后的 [AGENTS.md](../../../AGENTS.md) 为准。

## Global Constraints

- **命令包装（必建三条 #1）**：所有终端命令经 PowerShell 7 执行：`& 'D:\software\powershell7\7\pwsh.exe' -NoProfile -Command "<命令>"`；每条 Maven 命令前先 `$env:JAVA_HOME='D:\dev\environment\jdk-25.0.4.1+1'`。
- **系统环境零影响**：禁止修改系统/用户 `JAVA_HOME`、`PATH`、注册表；JDK 25 只通过命令内 `$env:JAVA_HOME` 与 start.bat 局部 `set` 引用（其他项目继续用 JDK 21）。
- **版本钉死**：parent `spring-boot-starter-parent:4.1.1`；`<java.version>25</java.version>`；`springdoc-openapi-starter-webmvc-ui:3.1.1`。Web starter 用 `spring-boot-starter-webmvc`（Boot 4 新坐标，已确认存在于 Maven Central；若解析失败回退 `spring-boot-starter-web` 并在提交信息注明）。
- **依赖策略**：Lombok（provided）与 Hutool 全局保留，按实际需要使用、不为用而用；MyBatis-Plus / MySQL / Redis / aliyun-oss 全仓禁止出现；不新增其他第三方依赖（如确需，先登记 AGENTS 技术选型表再引入）。
- **代码质量观（本项目验收标准之一）**：能通过合理的设计模式或算法优化提升清晰度、健壮性、性能的地方要积极实践（如值对象、策略拆分、懒遍历短路等），但必须服务于当下真实需求，拒绝炫技式、无收益的抽象；每处抽象都要能答出「它解决了什么已发生的问题」。
- **模块固定**：仅 `workbench-common`、`workbench-framework`、`workbench-infrastructure`、`workbench-module-docs`、`workbench-server` 五个 Maven 模块；删除 `workbench-module-auth`、`workbench-module-devsetup`、`backend/db/init/`；未经确认不新增模块。
- **前端与部署零修改**：`frontend/` 目录本次不动（API 不为其做兼容妥协，联调留待 UI 重做期）；`docker-compose*.yml`、`Caddyfile`、`.env.example`、`.github/workflows/` 零修改，仅 README 标注暂缓。
- **API 设计（v2 契约基线，测试以此钉死）**：
  - 基址 `/api/docs`，统一 `ApiResult<T>{message, code, data}` 包装，`code=0` 成功
  - `GET /tree` → 文件树 `DocNode{name, path, type:"dir"|"file", children:[]}`（children 恒为空数组初始化）；`GET /file?path=` → `DocContent{path, name, content}`；`POST /file` body `{path, content}` 新建；`PUT /file` body `{path, content}` 保存；`POST /dir` body `{path}`；`POST /rename` body `{from, to}`；`DELETE /resource?path=`；`GET /search?q=` → `List<SearchHit>`
  - `SearchHit{path, name, fileNameMatch, line, snippet}`：结构化替代旧版文本装饰——文件名命中 `fileNameMatch=true` 且 `snippet` 为文件名；内容命中给 `line`（1 起行号）与 `snippet`（该行 `strip()`，超 120 字符截断加 `…`）；两者同中时都给、`snippet` 取内容命中
  - 搜索行为：q trim；空返回 `[]`；大小写不敏感；上限 100；相对路径字典序；单文件 IO 失败静默跳过；**懒遍历短路**——命中满 100 立即停止，不整树排序物化（算法实践点）
  - 路径安全：模块内引入 `DocPath` 值对象（归一化分隔符、拒绝穿越/非法段/盘符绝对路径），service 层一律以 `DocPath` 流转，api/controller 边界收 `String`
  - 参数校验：DTO 用 jakarta validation（`@NotBlank` 等，rename 的 `from/to` 必填），失败 → 400
  - 错误映射：领域冲突（不存在/已存在/非法名/越界）→ 400 + 语义错误码；校验失败/缺参/体不可读 → 400 + `PARAM_INVALID("请求参数错误")`；未知异常 → 500 + `INTERNAL_ERROR("服务器内部错误")`（不泄漏堆栈与异常类名）
  - 错误码枚举：`PARAM_INVALID(40000)`、`NOT_FOUND(40400)`、`CONFLICT(40900)`、`INTERNAL_ERROR(50000)`
  - 存储配置：`workbench.storage.root`（env `DOCS_ROOT`，默认 `./data/docs`）；扩展名白名单 `md/markdown/txt`（小写比对）；树排序目录优先、名称不分大小写；相对路径一律正斜杠
  - CORS：`workbench.cors.allowed-origins`（env `CORS_ALLOWED_ORIGINS`，默认 `*`）；SpringDoc 开关 env `SPRINGDOC_API_DOCS_ENABLED` 默认 true，`swagger-ui.path=/swagger-ui.html`
- **三文档全新撰写**：AGENTS.md / DEVELOP_PLAN.md 在 Task 1 按新项目重写（规范先于代码）；README.md 在 Task 8 按最终代码现实全新重写（避免写完即过时）；三者职责互斥、引用不复制。
- **Git**：main 上先提交现有文档与计划；重构在新分支 `refactor/docs-only` 进行，每任务一提交，消息用中文（风格沿用现有 log）。

## Review Focus

1. **路径穿越 / 绝对路径注入**：`../`、`..\`、混合分隔符、`C:/x` 盘符、`%2e%2e` 解码后形式——期望一律拒绝或归约到根内。→ 钉在 Task 4 `resolve` 参数矩阵测试 + Task 6 `DocPath.of` 测试 + Task 7 集成 `?path=../secret.md` 断言 400。
2. **白名单绕过**：目录当文件创建、无扩展名文件、尾斜杠、`content=null`——期望文件写操作必须过白名单，null 内容按空串。→ 钉在 Task 4 `validateExtension`/`create`/`save` 测试。
3. **错误映射一致性**：语义错误码与 HTTP 状态一一对应；未知异常必须 500 且不泄漏类名/堆栈/消息。→ 钉在 Task 5 探针 controller 四分支测试 + Task 7 集成断言 JSON。
4. **搜索语义与算法**：大小写、中文名、120 截断、100 上限、行号正确、坏文件跳过、懒遍历短路（用命中计数文件数远大于 100 的 fixture 验证不物化全树）。→ 钉在 Task 6 `DocSearchService` 语义矩阵测试。
5. **record 序列化形状稳定**：`children` 恒为数组非 null、字段名稳定、`data:null` 显式序列化——作为 v2 契约基线钉死。→ 钉在 Task 7 对原始 body 字符串断言 `"children":[]`、`"data":null`、`"code":0`。

---

### Task 0: 前置环境（JDK 25 已完成 ✅ + 建分支）

**Files:** 无代码改动；git 分支操作。

**Interfaces:** Produces: 分支 `refactor/docs-only`（后续所有 Task 在其上提交）。

- [x] **Step 1: 安装 JDK 25** —— 已完成：`D:\dev\environment\jdk-25.0.4.1+1`，`java -version` 与 `javac --version`（25.0.4.1）验证通过，未动系统环境变量
- [ ] **Step 2: 提交 main 上的文档与计划成果** —— Run: `git add AGENTS.md README.md DEVELOP_PLAN.md docs; git commit -m "项目三文档初始化 + 后端重构实施计划"`；Expected: 工作区 clean
- [ ] **Step 3: 创建重构分支** —— Run: `git checkout -b refactor/docs-only`；Expected: `git branch --show-current` 输出 `refactor/docs-only`

### Task 1: 规范先行——三文档按新项目重写

**Files:**
- Modify: `AGENTS.md`（全新撰写）
- Modify: `DEVELOP_PLAN.md`（全新撰写）
- Create: `README.md` 占位重构说明（正式版在 Task 8 按代码现实撰写，避免双写）

**Interfaces:** Produces: 与目标架构一致的规范文本（Task 2-8 的验收依据；各模块 package-info 与其同步）。

- [ ] **Step 1: 重写 AGENTS.md** —— 结构：总则（定位：个人学习练手项目，以架构清晰与代码质量为先）→ 通用规范（必建三条标准原文保留 + 追加第 4 条：「**代码质量优先**：对代码质量要求高——凡能通过合理的设计模式或算法优化提升清晰度、健壮性与性能处，积极实践；但必须服务于当下真实需求，拒绝炫技式、无收益的抽象」）→ 架构定位（模块化单体，唯一业务模块 docs，本期不联调前端）→ Maven 模块结构（五模块树）→ 各模块职责细则（3.1-3.5，含 package-info 同步条款）→ 依赖规则（server→module-docs→framework→common；infrastructure→common；均禁止反向）→ 业务模块内部结构（api/controller/dto/model/service，无 entity/mapper，`DocPath` 值对象约定）→ 配置命名约定（仅 `workbench.storage.*` / `workbench.cors.*`）→ 技术选型表（Java 25 / Boot 4.1.1 / springdoc 3.1.1 / validation / JUnit 5 / Lombok·Hutool 按需；规则：新依赖先登记本表再写代码）→ API 设计约定（八端点简表 + 错误映射 + 搜索行为要点，权威版本随代码演进在本节维护，不锚定一次性计划文件）→ 文末交叉引用行保留
- [ ] **Step 2: 重写 DEVELOP_PLAN.md** —— 已完成区归档 M1/M2（注明 devsetup 与部署链已随重构移除、历史见 git）；任务清单替换为本计划 Task 2-8（链接本计划文件）；里程碑 M3 =「后端重构（Java 25 + docs-only）」；验收清单按 v2 契约（开放访问、无认证断言、Swagger 可用、防穿越 400）
- [ ] **Step 3: README.md 置为重构中说明** —— 顶部横幅「后端重构进行中（分支 refactor/docs-only），本文档将在重构完成后按最终现实重写」+ 保留旧内容折叠或删除（选择：删除旧正文，仅留横幅与指向 AGENTS/DEVELOP_PLAN 的链接）
- [ ] **Step 4: 自检** —— 三文档无重复内容、分类归属正确（换人接手看 README / 改码守 AGENTS / 做没做完看 DEVELOP_PLAN）
- [ ] **Step 5: Commit** —— `git commit -m "规范先行：三文档按 Java 25 + docs-only 学习版全新撰写，新增代码质量优先规范"`

### Task 2: 骨架切换——父 POM 升级 + 删模块 + 空壳可启动

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/workbench-common/pom.xml`、`backend/workbench-framework/pom.xml`、`backend/workbench-infrastructure/pom.xml`、`backend/workbench-module-docs/pom.xml`、`backend/workbench-server/pom.xml`
- Delete: `backend/workbench-module-auth/`、`backend/workbench-module-devsetup/`、`backend/db/init/`（整目录）；五模块 `src/main/java/**` 全部旧 .java 与 `src/test/**`
- Create: `backend/workbench-server/src/main/java/com/imhgl/workbench/WorkbenchApplication.java`、`backend/workbench-server/src/main/resources/application.yml`（最小化）、`backend/workbench-server/src/test/java/com/imhgl/workbench/WorkbenchApplicationTests.java`

**Interfaces:**
- Produces: 可编译可启动的空壳（`WorkbenchApplication` 仅 `@SpringBootApplication`；yml 仅 `server.port: ${SERVER_PORT:8080}`）；各模块 pom 依赖形态为后续地基——common 零依赖+junit-jupiter(test)；infrastructure `spring-boot-starter`+junit-jupiter(test)；framework `spring-boot-starter-webmvc`+`spring-boot-starter-validation`+springdoc+starter-test(test)；module-docs 依赖三模块+starter-test(test)；server 依赖 module-docs+starter-test(test)+spring-boot-maven-plugin；父 POM 保留 lombok(provided)/hutool 全局依赖与版本管理

- [ ] **Step 1: 写失败测试** —— `WorkbenchApplicationTests`：`@SpringBootTest` + `contextLoads()` 断言上下文可启动
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-server test`；Expected: FAIL（旧代码引用已删除的依赖/类，编译错误）
- [ ] **Step 3: 实施** —— 父 POM：parent 4.1.1、java.version 25、`<modules>` 缩为五个、properties 仅 `springdoc.version`、dependencyManagement 仅 springdoc；删两业务模块目录与 `backend/db/init/`；清空各模块旧源码；写 server 最小三件套；`WorkbenchApplication` 挂 `com.imhgl.workbench` 根包
- [ ] **Step 4: 跑测试确认通过** —— Run: `mvn package`；Expected: BUILD SUCCESS，全部测试 PASS（含 contextLoads）
- [ ] **Step 5: Commit** —— `git commit -m "骨架切换：Boot 4.1.1 + Java 25 + 五模块瘦身，移除 auth/devsetup/DB/Redis/OSS（空壳可启动，Lombok/Hutool 按需保留）"`

### Task 3: workbench-common——响应与异常契约

**Files:**
- Create: `backend/workbench-common/src/main/java/com/imhgl/workbench/common/result/ApiResult.java`、`.../common/exception/ErrorCode.java`、`.../common/exception/BusinessException.java`、`.../common/package-info.java`
- Test: `backend/workbench-common/src/test/java/com/imhgl/workbench/common/result/ApiResultTest.java`

**Interfaces:**
- Produces: `record ApiResult<T>(String message, int code, T data)` + 静态工厂 `ok()` / `ok(T)` / `error(ErrorCode, String)` / `error(ErrorCode)`；`enum ErrorCode`：`PARAM_INVALID(40000,"请求参数错误")`、`NOT_FOUND(40400,"资源不存在")`、`CONFLICT(40900,"资源冲突")`、`INTERNAL_ERROR(50000,"服务器内部错误")`；`class BusinessException extends RuntimeException`（`getErrorCode()`）

- [ ] **Step 1: 写失败测试** —— `ApiResultTest`：`ok(data)` 断言 code=0、data 透传；`ok()` 断言 data=null；`error(NOT_FOUND,"x")` 断言 code=40400、message="x"、data=null；`error(e)` 用默认消息；`BusinessException(NOT_FOUND,"y")` 断言 getErrorCode 与 getMessage
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-common test`；Expected: FAIL（类不存在）
- [ ] **Step 3: 实现** —— record 组件顺序 message/code/data；工厂方法语义如上
- [ ] **Step 4: 跑测试确认通过** —— Expected: PASS
- [ ] **Step 5: Commit** —— `git commit -m "common 重写：ApiResult/ErrorCode/BusinessException，语义化错误码，删 page 分页包"`

### Task 4: workbench-infrastructure——中性文件树存储

**Files:**
- Create: `backend/workbench-infrastructure/src/main/java/com/imhgl/workbench/infrastructure/storage/FileStorageProperties.java`、`.../storage/StorageNode.java`、`.../storage/FileTreeStorage.java`、`.../infrastructure/package-info.java`
- Test: `backend/workbench-infrastructure/src/test/java/com/imhgl/workbench/infrastructure/storage/FileTreeStorageTest.java`

**Interfaces:**
- Produces: `record FileStorageProperties(String root, Set<String> allowedExtensions)`（`@ConfigurationProperties("workbench.storage")`，默认 `./data/docs`、`md/markdown/txt`）；`record StorageNode(String name, String path, String type, List<StorageNode> children)`（紧凑构造器 children null→空表）；`FileTreeStorage`（构造器注入 properties 并创建根目录）方法集：`Path resolve(String)`、`void validateName(String)`、`void validateExtension(Path)`、`boolean isAllowedFile(Path)`、`StorageNode tree()`、`String read(String)`、`void create(String,String)`、`void save(String,String)`、`void createDir(String)`、`void rename(String,String)`、`void delete(String)`、`String toRel(Path)`、`Path getRoot()`——错误一律抛 `IllegalArgumentException`

- [ ] **Step 1: 写失败测试** —— `FileTreeStorageTest`（`@TempDir` 根）：① resolve 矩阵：`../x`、`..\\x`、`a/../../x`、`/abs`、`C:/x`、含 `\0` → IllegalArgumentException；`null`/`""`/`"."`→根；`a/b.md`→根内路径；② validateName：空、含分隔符、`.`、`..` 拒绝；③ validateExtension：`a.md` 放行、`a.exe` 拒绝、`A.MD` 放行（小写比对）；④ create/read/save：新建→读回一致、重复建拒、保存不存在文件拒、content=null 按空串；⑤ createDir/rename/delete：目录建/重名拒、文件与目录重命名、目标已存在拒、重命名根拒、删除根拒、递归删目录、rename 目标落在源子树内（`a`→`a/b`）拒绝；⑥ tree：目录/文件混排（目录优先、不分大小写）、非白名单文件过滤、toRel 输出正斜杠
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-infrastructure test`；Expected: FAIL
- [ ] **Step 3: 实现** —— 逻辑参考旧版（git 历史 `45c4602` 前的 infrastructure 可查），新增守卫：rename 根拒绝、rename 目标位于源目录子树内拒绝；构造器内 `Files.createDirectories(root)` 包 `UncheckedIOException`
- [ ] **Step 4: 跑测试确认通过** —— Expected: PASS（Windows 真实路径分隔符下全绿）
- [ ] **Step 5: Commit** —— `git commit -m "infrastructure 重写：FileTreeStorage/StorageNode/Properties，补 rename 根与子树守卫"`

### Task 5: workbench-framework——全局异常 / 校验 / CORS / SpringDoc

**Files:**
- Create: `backend/workbench-framework/src/main/java/com/imhgl/workbench/framework/handler/GlobalExceptionHandler.java`、`.../config/CorsProperties.java`、`.../config/CorsConfig.java`、`.../config/OpenApiConfig.java`、`.../framework/package-info.java`
- Test: `backend/workbench-framework/src/test/java/com/imhgl/workbench/framework/handler/GlobalExceptionHandlerTest.java`

**Interfaces:**
- Consumes: Task 3 的 `ApiResult` / `ErrorCode` / `BusinessException`
- Produces: `GlobalExceptionHandler`（`@RestControllerAdvice`）：`BusinessException`→400+`ApiResult.error(e.getErrorCode(), e.getMessage())`；`IllegalArgumentException`→400+PARAM_INVALID+原消息；`MethodArgumentNotValidException`/`MissingServletRequestParameterException`/`MethodArgumentTypeMismatchException`/`HttpMessageNotReadableException`→400+PARAM_INVALID+`"请求参数错误"`；`Exception`→500+INTERNAL_ERROR+`"服务器内部错误"` 并 error 级记日志（不含异常消息）。`CorsProperties`（`@ConfigurationProperties("workbench.cors")`，`List<String> allowedOrigins` 默认 `["*"]`）；`CorsConfig` 实现 `WebMvcConfigurer` 注册全局 CORS（`*` 时不允许凭据）；`OpenApiConfig` 提供 `OpenAPI` Bean（标题 workbench）

- [ ] **Step 1: 写失败测试** —— `GlobalExceptionHandlerTest`（MockMvc standaloneSetup 探针 controller：分别抛 `BusinessException(NOT_FOUND,"资源不存在x")` / `IllegalArgumentException("非法路径")` / `@RequestParam` 缺参 / `@Valid` body 校验失败 / `RuntimeException("boom")`）：断言状态码 400×4、500×1；body 中 code=40400+消息原文、PARAM_INVALID 原文、`"请求参数错误"`×2、`"服务器内部错误"`；500 body 不含 "boom"
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-framework test`；Expected: FAIL
- [ ] **Step 3: 实现** —— 校验异常归一为 PARAM_INVALID；CORS/OpenAPI 类不含端点、不含业务
- [ ] **Step 4: 跑测试确认通过** —— Expected: PASS
- [ ] **Step 5: Commit** —— `git commit -m "framework 重写：全局异常/参数校验/CORS/SpringDoc，语义化错误映射"`

### Task 6: workbench-module-docs——值对象、契约与实现（api 层模式保留）

**Files:**
- Create: `backend/workbench-module-docs/src/main/java/com/imhgl/workbench/docs/model/DocPath.java`、`.../docs/dto/SaveRequest.java`、`.../dto/CreateDirRequest.java`、`.../dto/RenameRequest.java`、`.../docs/model/DocNode.java`、`.../docs/model/DocContent.java`、`.../docs/model/SearchHit.java`、`.../docs/api/DocsApi.java`、`.../docs/api/impl/DocsApiImpl.java`、`.../docs/service/DocSearchService.java`、`.../docs/controller/DocController.java`、`.../docs/package-info.java`
- Test: `backend/workbench-module-docs/src/test/java/com/imhgl/workbench/docs/model/DocPathTest.java`、`.../docs/api/DocsApiImplTest.java`、`.../docs/service/DocSearchServiceTest.java`

**Interfaces:**
- Consumes: Task 3 `ApiResult`；Task 4 `FileTreeStorage` / `StorageNode` / `FileStorageProperties`
- Produces:
  - `DocPath`（值对象，设计模式实践点）：静态工厂 `DocPath.of(String raw)` 归一化（`\`→`/`、去首尾 `/`、拒绝 `\0`/穿越段/盘符绝对路径/空段）并复用（ intern 式缓存可选）；实例方法 `value()`（正斜杠相对路径）、`name()`（末段）、`extension()`（小写、无点返回 ""）、`resolve(String child)`、`isRoot()`
  - dto record：`SaveRequest(@NotBlank String path, String content)`、`CreateDirRequest(@NotBlank String path)`、`RenameRequest(@NotBlank String from, @NotBlank String to)`
  - model record：`DocNode(String name, String path, String type, List<DocNode> children)`（children null→空表）、`DocContent(String path, String name, String content)`、`SearchHit(String path, String name, boolean fileNameMatch, int line, String snippet)`
  - `DocsApi`（跨模块唯一契约，边界收 String）：`DocNode tree()`、`DocContent read(String path)`、`void create(String path, String content)`、`void save(String path, String content)`、`void createDir(String path)`、`void rename(String from, String to)`、`void delete(String path)`、`List<SearchHit> search(String query)`（均 `throws IOException`）
  - `DocSearchService`（常量 `SEARCH_LIMIT=100`、`SNIPPET_LENGTH=120`）——懒遍历短路实现
  - `DocController`：八端点映射见 Global Constraints；入参 `@Valid @RequestBody`，controller 只注入 `DocsApi`

- [ ] **Step 1: 写失败测试** —— `DocPathTest`：`of(null)`/`of("")`→根语义（value() 为 ""）；`a\\b.md`→`a/b.md`；`/a/`→`a`；`../x`、`a/../../x`、`C:/x`、含 `\0`、`a//b` 空段 → IllegalArgumentException；`name()`/`extension()`（`B.MD`→`md`）/`isRoot()`。`DocsApiImplTest`（`@TempDir`）：空树 `name=""、type="dir"、children=[]`；create→read（DocContent.name 取文件名）→save 全链路；delete 后读抛 IllegalArgumentException；非法路径透传 DocPath 异常。`DocSearchServiceTest`：fixture 多级目录+中文名+大小写混合内容 → 仅文件名命中（fileNameMatch=true、line=0、snippet=文件名）；仅内容命中（line 正确、snippet strip/截断 `…`）；双命中都给；空 q 返回 `[]`；非白名单与读取失败文件跳过；105 个白名单文件断言 ≤100 且按相对路径字典序；懒遍历：在第 101 个文件放置其余命中源，断言其未被读取（文件计数器或标记文件副作用）
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-module-docs test`；Expected: FAIL
- [ ] **Step 3: 实现** —— service 层以 `DocPath` 流转；`DocsApiImpl` 适配 `StorageNode`→`DocNode`；搜索用 Stream 懒遍历 + takeWhile 式短路（命中满即停）
- [ ] **Step 4: 跑测试确认通过** —— Expected: PASS
- [ ] **Step 5: Commit** —— `git commit -m "docs 模块重写：DocPath 值对象 + record 契约 + 结构化搜索结果 + 懒遍历短路"`

### Task 7: workbench-server——配置与集成冒烟

**Files:**
- Modify: `backend/workbench-server/src/main/java/com/imhgl/workbench/WorkbenchApplication.java`（加 `@ConfigurationPropertiesScan("com.imhgl.workbench")`）
- Modify: `backend/workbench-server/src/main/resources/application.yml`
- Test: `backend/workbench-server/src/test/java/com/imhgl/workbench/DocsApiIntegrationTest.java`

**Interfaces:**
- Consumes: Task 3-6 全部产出
- Produces: 最终 `application.yml`：`server.port ${SERVER_PORT:8080}`；`spring.threads.virtual.enabled: true`；`springdoc.api-docs.enabled ${SPRINGDOC_API_DOCS_ENABLED:true}` + `swagger-ui.path /swagger-ui.html`；`workbench.storage.root ${DOCS_ROOT:./data/docs}`；`workbench.cors.allowed-origins ${CORS_ALLOWED_ORIGINS:*}`；`logging.level.root: info`（无任何 datasource/redis/mybatis/oss/auth 键）

- [ ] **Step 1: 写失败测试** —— `DocsApiIntegrationTest`：`@SpringBootTest(RANDOM_PORT)` + `TestRestTemplate` + `@DynamicPropertySource` 将 `workbench.storage.root` 指向临时目录。用例：① `GET /api/docs/tree` body 字符串含 `"code":0` 与 `"children":[]`；② `POST /api/docs/file {path:"笔记/中文.md",content:"# hi"}` 后 `GET /api/docs/file?path=笔记/中文.md` content="# hi"；③ PUT 保存后再读生效；④ `GET /api/docs/search?q=HI` 命中且 `fileNameMatch=false`、`line` 为整数；⑤ `GET /api/docs/file?path=../secret.md` → 400 且 body 含 `"code":40000`；⑥ `GET /api/docs/file`（缺参）→ 400 且含 `"请求参数错误"`；⑦ `POST /api/docs/file` 空 path → 400 `"请求参数错误"`；⑧ rename→delete→tree 复原；⑨ OPTIONS 预检（Origin: http://example.com）返回允许头；⑩ `GET /swagger-ui.html` 2xx/3xx
- [ ] **Step 2: 跑测试确认失败** —— Run: `mvn -pl workbench-server test`；Expected: 部分 FAIL（yml 键与扫描缺失）
- [ ] **Step 3: 实现** —— 补 `@ConfigurationPropertiesScan` 与最终 yml
- [ ] **Step 4: 跑测试确认通过** —— Expected: 全部 PASS（含 `"data":null` 形状随 ⑤⑥ 附带断言）
- [ ] **Step 5: Commit** —— `git commit -m "server 配置定型 + 集成冒烟：v2 契约形状/防穿越/校验/CORS/Swagger 全断言，虚拟线程开启"`

### Task 8: 全量验证与文档定稿

**Files:**
- Modify: `README.md`（按最终代码现实全新撰写）、`start.bat`（局部 JAVA_HOME）、`DEVELOP_PLAN.md`（勾选）、`AGENTS.md`（如有出入修正）

**Interfaces:** Consumes: Task 2-7 的最终代码形态。

- [ ] **Step 1: 全量构建** —— Run: `mvn clean package`；Expected: BUILD SUCCESS，全部测试 PASS
- [ ] **Step 2: 手动冒烟（可选）** —— `mvn -pl workbench-server spring-boot:run` 后浏览器开 `http://localhost:8080/swagger-ui.html` 与 `GET /api/docs/tree`
- [ ] **Step 3: 全新撰写 README.md** —— 一句话定位（个人学习练手的工作台，当前模块：在线 Markdown 文档）；技术栈（Java 25 / Boot 4.1.1 / 纯文件存储 / 无 DB）；仓库结构（五模块树 + frontend 标注「UI 重做期对齐 v2 API」）；本地开发（`$env:JAVA_HOME='D:\dev\environment\jdk-25.0.4.1+1'` 写明不依赖系统 JDK）；API 一览表（v2 八端点）；部署章横幅「暂缓：待恢复部署时按新栈重写」；不复制 AGENTS/DEVELOP_PLAN 内容，只链接
- [ ] **Step 4: 更新 start.bat** —— 后端启动行前加 `set "JAVA_HOME=D:\dev\environment\jdk-25.0.4.1+1"`（仅该 cmd 窗口生效，不影响其他项目）
- [ ] **Step 5: 确认 `.gitignore` 忽略后端运行时 `backend/data/`**（如无则补）
- [ ] **Step 6: 勾选 DEVELOP_PLAN.md 对应任务，AGENTS.md 与实际有出入处修正；提交** —— `git commit -m "重构收尾：README 按最终现实重写，start.bat 局部 JAVA_HOME，部署链标注暂缓，文档同步"`
- [ ] **Step 7: 终验** —— `git log --oneline main..refactor/docs-only` 核对每任务一提交；工作区 clean
