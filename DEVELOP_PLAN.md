# 开发计划与验收

> 项目背景与技术栈见 [README.md](./README.md)，改码规则见 [AGENTS.md](./AGENTS.md)。本文件只回答「做什么、做到哪、怎么算完成」。任务完成即勾选，交付前以「验收清单」为统一出口。

## 里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M1（已归档） | 模块化单体骨架 + 认证 + 在线文档 v1 | ✅ 已完成，随重构移除（auth 模块删除） |
| M2（已归档） | 部署链（Docker/Caddy/CI）+ 开发环境管家 devsetup | ✅ 已完成，随重构移除（devsetup 模块与部署链暂缓；历史见 git 主干） |
| M3（已归档） | 后端重构：Java 25 + Spring Boot 4.1 + docs-only | ✅ 已完成并合入 main（54 测试，审查 Important 全修） |
| M4（已归档） | **后台管理系统一期：流量监测域 + 轻量 Token 认证（仅后端）** | ✅ 已完成并推送 main（00447e6，94/94，审查 Important 3 项全修） |
| M5 | **前端重做：React「观测站」设计语言 + v2 API 全面对齐** | ✅ 已完成并推送（382aa7f，105 用例基线） |
| M6 | **GitHub 数据源接入：Pages 流量 / Release 下载量 + 数据源配置页** | ✅ 已完成并推送（6a0b3ff，105 用例） |
| M7 | **体验补全：P0 态势卡片/命令面板 + P1 语境与浮出 + P2 GitHub 适配与 token 闭环** | ✅ 已完成并推送（56fb5d8 / f78781a / P2 本提交） |
| M8 | **GitHub token 页面动态配置（免重启闭环）** | ✅ 已完成并推送（本提交） |
| M9 | **设计系统重构：分域主题 + 明暗双主题 + 工作台首页** | ✅ 已完成（本提交） |
| M9.1 | **线上反馈修复批：台账溢出 + 退出登录 + 文档树显示** | ✅ 已完成（本提交） |
| M9.2 | **开启登录验证前置：CORS 移至 Filter 层（401 带跨域头）** | ✅ 已完成（v1.2.1） |
| M9.3 | **部署链对齐现状：清退旧栈遗留，compose 重写为当前架构** | ✅ 已完成（本提交） |
| M9.4 | **登录体验密码化 + 移除侧栏令牌入口** | ✅ 已完成 |
| M9.5 | **密码→会话认证（服务端只存哈希 + 登录限流 + 会话令牌）** | ✅ 已完成（v1.3.0） |
| M9.6 | **文档首开提速：Lute 空闲预载 + 编辑器加载反馈 + Vditor 主库 defer** | ✅ 已完成（本提交） |
| M9.7 | **删除侧栏域色点（易误读为状态提示）** | ✅ 已完成（本提交） |
| M9.8 | **文档打开零等待：纯文本先读 + hljs 预载** | ✅ 已完成（本提交） |

## 当前任务（M9.4 · 登录体验密码化，已完成）

用户要求登录方式为「输入密码」而非「输入 token」——令牌机制保留在内部（密码即 `API_TOKEN`，X-API-Token 携带），界面全面密码化；并移除侧栏「访问令牌」入口（所有到达路径已被 401 拦截与退出落地覆盖，手动入口冗余）。

- [x] 登录页文案密码化：placeholder「请输入登录密码」/ 错误「密码不正确」/ 提示「密码仅保存在本机浏览器」/ 认证关闭卡同步改口
- [x] 侧栏删除「访问令牌」入口与 TOKEN_ICON，底部剩 暖色/暗色切换 + 退出登录；退出按钮 tooltip 改「清除已保存的密码并退出」
- [x] 清理死代码：AccessView 的 manage 状态（唯一发送方是被删的侧栏入口）；401 提示改「未认证或密码已变更，请重新登录」
- [x] `/login` 路由保留：401 自动拦截、退出落地、无状态直链（认证关闭时自动进入）三种路径不变

## 当前任务（M9.5 · 密码→会话认证，已完成）

（设计触发与威胁模型分析见 git 历史 96e9e57 的暂停记录；本节为落地清单。）

- [x] `AuthProperties`（替换 ApiTokenProperties）：passwordSha256 / machineToken / sessionTtlHours 三字段 + enabled()/loginEnabled() 语义
- [x] `LoginService`：SHA-256 常量时间比对、SecureRandom 32B 会话签发（内存 Map、TTL 惰性清理）、全局 5 次失败锁 60 秒、WrongPassword/RateLimited/LoginDisabled 语义异常
- [x] `AuthController`：POST /api/auth/login（401 密码错 / 429 带 Retry-After / 404 未启用）、POST /api/auth/logout
- [x] `ApiTokenFilter` → `AuthFilter`：会话令牌 ∨ 机器令牌双校验；/api/auth/** 直通（login 无凭据可达，logout 对未知令牌无害）
- [x] monitor status：authEnabled = 密码哈希非空 ∨ 机器令牌非空（AuthProperties.enabled()）
- [x] 测试：LoginServiceTest 5 例、AuthFilterTest 7 例（禁用/会话流/机器流/锁定/预检/直通）、CorsApiTokenCompositionTest 4 例（401 带跨域头 + 登录跨域可达）、MonitorTokenIntegrationTest 迁移到 machine-token——全量构建 EXIT=0
- [x] 前端：http.ts loginRequest（fetch 直连防自跳转）+ logoutRequest；AccessView 提交走登录端点（401/429 文案直显）；退出登录先失效服务端会话
- [x] 配置/文档：application.yml 双凭据键、compose 与 .env.example 换 AUTH_PASSWORD_SHA256、README 认证段与部署步、AGENTS §3.2/§6.3/§8 修订

**触发**：用户裁定「安全永远第一位」，否决 M9.4 的「密码与 API_TOKEN 同值直传」作为长期方案（该方案的真实缺口：① 无爆破防护——静态头可被无限次猜解且无锁定；② 服务端明文存 API_TOKEN——compose/.env 泄露即全失守；③ 浏览器存全权永久凭据——XSS 窃取即失守）。

**设计（已定稿）**：

- 新环境变量 `AUTH_PASSWORD_SHA256`（服务端只存密码的 SHA-256 hex；生成：`echo -n '密码' | sha256sum`，或 PowerShell `Get-FileHash` 管道）——配置文件泄露不再泄露可用凭据
- `API_TOKEN` 保留但语义改为**机器凭据**（ingest 外部上报用；静态 API key 明文是业界常态，类比 GitHub PAT），与人类密码分离
- `POST /api/auth/login` {password} → 常量时间比对 SHA-256 → 签发 SecureRandom 32B hex 会话令牌（内存 ConcurrentHashMap，TTL 默认 7 天、惰性清理）→ 返回 {token, expiresAt}；容器重启 = 全部会话失效（个人工具可接受，重启后重新输密码）
- 登录限流：全局桶 5 次失败锁 60 秒（Caddy 反代后无法取真实 IP，单用户场景全局桶即可）
- `POST /api/auth/logout` 失效当前会话（前端退出登录时先调它再清 localStorage）
- ApiTokenFilter 校验改为：会话令牌 ∈ 活跃集（常量时间比较）∨ machine-token 匹配；status 的 authEnabled = 密码哈希非空 ∨ machine-token 非空

**AGENTS 前置修订（动码前必须先改）**：§3.2 framework 允许承载 `/api/auth/login|logout` 端点（认证机制属框架能力，与 Token 过滤器同属）；§8 认证段重写为双凭据模型；§6.3 增 `workbench.auth.password-sha256` ↔ `AUTH_PASSWORD_SHA256` 映射。

**已勘点（探查结论， resume 时直接用）**：`ApiTokenProperties` 触点 = framework 的 config/filter 与 ApiTokenFilterTest、CorsApiTokenCompositionTest（重写为 AuthProperties + 组合场景）+ monitor `MonitorApiImpl`（status 的 authEnabled）与 MonitorCon…测试；前端触点 = AccessView submit（改打 login 端点，fetch 直连不走 api() 包装——401 在登录页不能触发自跳转）、http.ts 加 loginRequest 帮助函数、AppShell logout 先调 logout 端点。

## 当前任务（M9.6 · 文档首开提速，已完成）

**排查结论**：在线文档「内容已拿到但渲染慢」的瓶颈不在服务器（前端静态走 GitHub Pages CDN、API 只传文本），而在浏览器端——Vditor 的 Lute 引擎（3,656KB）在进入文档页时才开始懒加载下载+解析，`after()` 触发前 setValue 全部挂起；Pages 缓存仅 10 分钟，每个新会话首开都要重下。已读 vendored 压缩源码确认其加载器按 `id="vditorLuteScript"` 去重、id 存在即复用。

- [x] `modules/docs/prefetch.ts`：应用空闲（requestIdleCallback，3s 兜底）预执行 Lute；onload 后才补 id 且已存在时不重复置——与 Vditor 加载器握手安全，早于预载进文档页时同 URL 并发请求自动合并
- [x] `VditorEditor` 就绪前渲染「编辑器引擎加载中」遮罩（弱网/深链兜底，预载命中时几乎不出现）
- [x] `index.html` Vditor 主库（290KB）加 `defer`——解除对全站首屏的阻塞，window.Vditor 仅文档路由挂载时访问、时序安全
- [x] 验证：`tsc` + `vite build` 零错；本地 preview 实测编辑器正常初始化（工具栏渲染、占位出现、遮罩消失）；后端零改动

## 当前任务（M9.7 · 删除侧栏域色点，已完成）

用户反馈侧栏导航条目右侧的域色点（M9 引入的分析青/文档赭棕装饰）容易被误会为信息类提示。当前 2 域 4 页规模下该符号无可辨识信息量，且无 tooltip 等解释通道——删除。同步清理 NavItem.domain 死字段与 AppShell.css 中两处硬编码色值（#b4632e/#d08a4a）；主区 data-domain 域主题切换逻辑不受影响。AGENTS §9.4 已裁定：导航条目不加装饰性标记。

## 当前任务（M9.8 · 文档打开零等待，已完成）

**实测定位**（M9.6 预载后用户仍报等待很久）：`curl` 线上实测 `lute.min.js` —— Content-Encoding 为空（GitHub Pages/Fastly 对 3.7MB 大文件免 gzip），原样传输 3,701,520 bytes，跨境链路有效带宽约 17KB/s，总下载 215.5 秒。预载逻辑正常，但预载自身也受同一慢链路制约；等待与服务器（2C2G）无关。

- [x] 打开文档不再等引擎：`docp-boot` 纯文本只读预览层（数据 = openDoc 已有的 savedContent，零额外请求），编辑器就绪（onEditorReady 订阅，先补写后通知）后自动切换；未打开文档时退化为加载提示
- [x] VditorEditor 内部 loading 遮罩删除，加载 UI 统一归 DocsView（单一覆盖层）
- [x] prefetch 扩展：hljs `highlight.min.js?v=11.7.0` 与 `third-languages.js?v=1.0.1`（查询串与 Vditor 请求逐字一致以合并下载）
- [x] 保存安全：saveDoc/autosave 均有 isEditorReady 卫语句，预览期无输入无保存请求
- [x] 验证：tsc + vite build 零错；preview 实测编辑器就绪后 boot 层正确卸载、无布局回归；后端零改动

**服务器开启方式（v1.3.0 起）**：compose 设 `AUTH_PASSWORD_SHA256`（生成方式见 .env.example）→ `docker compose pull && up -d` → 浏览器登录输密码。密码遗失兜底：置空哈希重启 = 关闭认证。

## 任务归档（M9.2 · 开启登录验证前置，已完成）

用户要在生产开启 `API_TOKEN` 登录验证。排查发现跨域部署下存在死锁缺陷：CORS 原在 MVC 层（`addCorsMappings`）处理，而 401 是 `ApiTokenFilter` 在 Filter 层直接写出的——无 `Access-Control-Allow-Origin` 的 401 被浏览器按 CORS 失败拦截，前端把 locked 误判为 offline，登录流程无法开始。

- [x] `CorsConfig` 从 MVC 层迁至 Filter 层：`CorsFilter` 注册于 `/api/*`、order -150（先于 ApiTokenFilter 的 -100），任何 /api 响应（200 与 401）都带 CORS 头
- [x] 显式 `allowedHeaders: *`（X-API-Token 是自定义头，预检须放行）与 `allowCredentials: false`
- [x] 新增组合回归测试：401 带跨域头 / 预检放行带头 / 白名单外来源拒绝
- [x] 全量构建测试通过；打 v1.2.1 触发镜像重建；服务器侧开启步骤见交付说明（compose 设 `API_TOKEN`、收紧 `CORS_ALLOWED_ORIGINS`、pull + up）

## 任务归档（M9.3 · 部署链对齐现状，已完成）

仓库中的 docker-compose.yml / docker-compose.dev.yml / .env.example 仍是 M1/M2 旧栈（MySQL/Redis/OSS/APP_PASSWORD——backend/db 目录甚至已不存在），照着 up 会直接失败。清理与对齐：

- [x] 删除 docker-compose.dev.yml（纯文件存储架构，本地开发零容器依赖）
- [x] docker-compose.yml 重写为当前架构：workbench（GHCR 镜像 + API_TOKEN + CORS + 持久化卷）+ Caddy（api.imhgl.com 反代）
- [x] 持久化补全：监测时序（METRICS_DATA）与源配置（WORKBENCH_SOURCES_FILE）挂 workbench-runtime 卷——此前为容器内临时层，重建即丢源配置与 GitHub token
- [x] .env.example 重写为当前变量；README 部署节从「暂缓」改为实际发布流（tag → GHCR → pull）
- [x] 后端零改动（v1.2.1 镜像继续有效，无需新 tag）

## 任务归档（M9.1 · 线上反馈修复批，已完成）

线上验收（大屏 + 实数据）反馈四点，全部前端修复：

- [x] 大屏台账裁切：`.mon-ledger` 改横向滚动 + 表格 min-width 全局 560px；视口 ≥1440px 时概览容器放宽到 1320px
- [x] 侧栏底部「收起」替换为「退出登录」：清本机令牌 → 接入页；AccessView 加「已退出」态（loggedOut 时跳过 open 自动回跳，显示重新进入按钮，消费后清 history state）
- [x] 折叠/展开按钮移到 logo 行右侧（折叠态置于 logo 下方），底部剩 暗色模式 / 访问令牌 / 退出登录
- [x] 文档页文件树不显示：根节点漏绑 `sidebar-open` 类（静态 className），改动态绑定——桌面侧栏与移动端抽屉一并修复；线上 docs 数据完好（已验证 /api/docs/tree 有内容）
- [x] `tsc` + `vite build` 零错；推送后 gh 确认 Pages 部署成功；后端零改动

## 任务归档（M9 · 设计系统重构，已完成）

用户裁定：现有蓝墨+琥珀暗色「太丑」，功能入口割裂，各域应有自己的气质。方案：明暗双主题（石墨+青分析域 / 暖纸感文档域）、工作台首页 + 分组可折叠侧栏、共享 UI 原语层。

- [x] tokens.css 重写为语义令牌：全局中性层（明/暗）+ 域强调层（analysis/docs）；警示色 `--warn` 与品牌色相分离；13 处琥珀硬编码清零；字号 7 档/间距节奏归一；text-3 达 WCAG AA
- [x] 主题切换：`src/theme.ts` 唯一读写口，跟随系统（无偏好取暗色），侧栏手动切换记忆
- [x] 骨架：分组文字侧栏（分析/工具 + 域色点）可折叠记忆；主区按路由挂 `data-domain` 换域气质
- [x] `/home` 工作台首页（默认路由）：工具卡片 + 全局健康摘要（15s 刷新）+ 最近文档 + Ctrl K 提示
- [x] 概览宽屏双栏（主图+读数居左 / 端点台账居右 sticky，<1024px 回落纵向）；区间/指标/排序切换收敛到 Segmented 原语
- [x] 文档域暖纸感：衬线标题、15px/1.75 阅读排版、Vditor 表面语义令牌化；侧栏桌面可折叠；本地预览宽屏升级为右侧阅读栏；编辑器主题走 setTheme 热切换（不重建实例）
- [x] 数据源页重排：接入表单置顶，「GitHub 令牌」收进「接入设置」折叠区（与系统访问令牌区分），已接入源改为卡片列表
- [x] 共享 UI 原语 components/ui/（Panel/Segmented/Chip/GhostButton/StatusDot/Banner/Field/EmptyState）落地并替换各页重复样式
- [x] http.ts 非 JSON 响应守卫（错误横幅不再泄漏解析异常原文）；接入页改青系配色；探测成功跳首页
- [x] 验证：`tsc --noEmit` 零错误 + `vite build` 成功；首页/概览/文档/数据源 × 明暗主题截图验收（域切换、警示/强调分离、卡片列表、暖纸感均确认）；后端零改动（110 用例基线不受影响）
- [x] 三文档同步（本节 + AGENTS §9 重写 + README 技术栈行）

## 任务归档（M8 · token 动态配置，已完成）

用户反馈「页面上没有配置 token 的地方」——环境变量 + 重启的接入方式不闭环。规范修订见 [AGENTS.md §3.5](./AGENTS.md)（「token 不落盘」约定废止及其理由）。

- [x] `PUT|DELETE /api/monitor/settings/github-token`：保存/清除页面级 token，持久化于 sources.json 的 settings 区，**页面设置 > 环境变量**（清除回落 env）
- [x] `GithubTokenProvider`：token 唯一读取口（client/collector/status 共用），优先级口径全站一致；status 出参加 `githubTokenSource`（page/env/null）
- [x] 数据源页 token 配置块：粘贴保存即生效并自动采集全部启用源；已配置显示来源与更换/清除
- [x] 验证：110 用例全绿（新增 settings 往返 + provider 优先级）；端到端联调——保存假 token 即时生效并打出真实 GitHub 401，清除回落 env

## 当前任务（M7 · 体验补全 P0）

产品审查（M5/M6 三页）结论：功能完备但缺「全局态势 / 变化语境 / 行动引导」三层叙事。P0 先补最痛的四项，P1/P2 后续排期（环比注脚、值得注意面板、最近打开、GitHub 日粒度柱状适配、token 状态闭环）。

- [x] 全局态势卡片行：概览页顶部每源一卡（状态灯/近窗口请求数/错误率，异常源排前，点击切深潜；HTTP 源 1h、github/* 源 7d 各取有意义窗口）
- [x] Ctrl+K 全局命令面板：页面跳转 + 文档搜索直达（防抖 250ms，键盘 ↑↓/Enter/Esc，结果经 location.state 交给文档页打开）
- [x] 数据源删除二次确认（复用全局对话框——M6 重写时遗漏的危险操作确认）
- [x] 空态即引导：概览无源时展示「三步点亮观测站」（产生流量 → 接 GitHub → 看描迹），替代旧的一行提示
- [x] rail「接入」更名「访问令牌」（与数据源接入用词解耦）
- [x] P1 读数环比注脚：三指标序列取回后客户端算「后半段 vs 前半程」（请求数/均延 ±%，错误率 ±pp，低于显著阈值不显示，P95 无序列口径不出）
- [x] P1 值得注意面板：采集失败（enabled 且 lastError）与错误率 >1% 聚合为顶部可行动提示（≤3 条），点击跳转/就地排序
- [x] P1 文档「最近打开」：localStorage 记最近 5 篇，侧栏顶部「最近」区一键回跳
- [x] P2 GitHub 日粒度适配：github/* 源选中自动切 7d、隐藏指标切换（恒 count）、PulseChart 柱状变体（等宽槽居中/悬浮高亮/入场淡入）、读数位换为 总活动/Pages 浏览量/下载增量/有数据天数、x 轴 MM-dd
- [x] P2 token 配置状态闭环：status 出参新增 `githubTokenConfigured`（只暴露布尔位）；数据源页未配置时显示含配置方法与「重新检测」的引导条，已配置显示就绪提示
- [x] `mvn clean package` 全绿 + `tsc`/`vite build` 零错 + status 新字段联调验证 + 截图验收

## 验收清单（M7）

- [x] `tsc --noEmit` 零错误；`vite build` 成功；截图验证态势卡片渲染
- [x] 命令面板与删除确认的交互以浏览器手工验证为准（首用发现偏差即修）
- [x] 三文档同步；提交推送

## 任务归档（M6 · GitHub 数据源 + 配置页）

- [x] Task 1: 源配置存储与 API——`SourceConfigStore`（JSON 文件原子读写）+ source-configs 五端点 + 校验（TDD：store 往返 / 重复 repo 冲突 / 非法 repo / 不存在 id）
- [x] Task 2: GitHub 采集器——`GithubClient`（HttpClient + Jackson 窄解析，fixture 单测）+ `GithubCollector`（cron + 手动触发，lastDay 游标保幂等 / 下载量增量入库，token 缺失诚实报错）
- [x] Task 3: server 集成——`@EnableScheduling` + `workbench.sources.*` 配置 + `mvn package` 全绿（105 用例：存量 94 零回归 + 新增 11）
- [x] Task 4: 前端数据源页——`/sources` 路由 + 图标轨第三项：接入表单（repo + 指标勾选）、源列表（状态灯/最后成功/立即采集/启停/删除）
- [x] Task 5: 联调验证（CRUD + 重复 409 + 无 token 采集诚实报错 + 状态回写）+ 文档同步 + 提交推送

## 验收清单（M6 · 每次交付前逐条核对）

后端：

- [x] `mvn clean package` 全绿，存量 94 用例零回归；新增 store/解析/API 用例（105/105）
- [x] source-configs CRUD + 校验：非法 repo/metrics 400 `PARAM_INVALID`；重复 repo 409；不存在 404；token 不回显
- [x] 采集器：token 缺失 → 手动采集 ok=false + 明确提示；views 以 lastDay 游标保幂等（聚合桶叠加语义下的防重）；下载量累计→增量（负差清零）；写入映射符合 §3.5 约定
- [x] 调度：cron 可配（默认每天 08:05/20:05），配 `-` 关闭定时只留手动；单仓失败不拖累其他仓

前端：

- [x] `/sources` 页 CRUD 走通；配置页一切写操作均由用户点击触发（符合通用第 5 条）
- [x] 概览页自动出现 `github/{repo}` 源（源 chips 动态）
- [x] 构建零错；三文档同步；提交推送

## 任务归档（M5 · 前端重做）

Vue 3 前端整体重写为 React 19 + TypeScript（用户裁定架构可换），落地「观测站」设计语言；旧 Vue 源码不迁移，功能对照移植。devsetup 前端随后端模块一并移除（代码见 git 主干，待后端以新模块重建后再入 UI）。

- [x] Task 1（里程碑 A）: frontend 重置为 React+TS 工程；「观测站」设计令牌（蓝墨/琥珀/mono 读数）+ AppShell（图标轨 + 底部遥测状态条）；概览页 mock 版先行并经无头截图自查修正 y 轴刻度缺陷
- [x] Task 2: monitor 真数据——六端点封装 / `usePolling`（15s 轮询、页面隐藏暂停、失败保留旧数据）/ 概览页指标切换 / 状态条接 status+overview（离线灰灯、背压丢弃琥珀警示）
- [x] Task 3: docs React 重写——`useDocs` 状态编排 / 目录树 / 搜索 / Vditor ref 封装（裁定不用 StrictMode：vendored Vditor 不兼容开发期双挂载）/ 本地预览 / 自动保存与全局键
- [x] Task 4: 接入页——探测式令牌（open 直进 / locked 表单 / offline 重试）+ 粒子景深场重调色（琥珀/冰蓝）
- [x] Task 5: 联调验证——本地 jar + vite 代理；monitor 真数据渲染、认证三态（无/错令牌 401、对令牌 200）、接入页探测；数据边界事故清除（未经同意的 ingest 演示数据已删，规范新增通用第 5 条）
- [x] Task 6: 三文档同步 + 构建复验 + 提交推送（382aa7f）

## 验收清单（M5 · 每次交付前逐条核对）

前端工程与联调：

- [x] `tsc --noEmit` 严格模式零错误；`vite build` 成功（除 React 生态必需品外零新增运行时依赖；React Bits 不引入，效果手写）
- [x] 概览真数据：sources 含自身 `workbench`；range/源/指标切换正确；24h/7d 走小时桶（range→step 固定映射）
- [x] 底部状态条真数据：rps/错误率/桶数/文件数/认证开关；后端离线灰灯；`droppedEvents>0` 琥珀警示
- [x] 认证链路：无令牌 401、错令牌 401、对令牌 200；接入页探测三态正确（open 直进 / locked 表单 / offline 重试）；401 统一清令牌跳接入页
- [x] docs 功能对照旧实现逐项移植：树/读写/新建文件与文件夹/重命名/删除/搜索/本地预览/拖拽/Ctrl+S/自动保存/未保存离开拦截（交互细节以浏览器手工全验为准，首用发现偏差即修）
- [x] 数据边界：无任何未经同意的持久层写入残留；演示数据仅存在于前端组件（mock 已随真数据接线删除）
- [x] 三文档同步 + 提交推送（382aa7f）

## 验收清单（M4 · 已归档）

后端（本期验收只看后端，前端联调由 M5 完成）：

- [x] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令内局部设置 `JAVA_HOME=JDK25`）；**存量 54 用例零回归**（94/94）
- [x] 零新增第三方依赖；无 MySQL / Redis / OSS / MyBatis 依赖
- [x] token 未配置：现有行为不变；配置后：无头 / 错值 401 + `40100`，正确值放行；Swagger 不受影响
- [x] 自监测：调任意 docs API 后 `overview?source=workbench` 计数增长，路径已归一化（数字段 `{n}` / UUID `{u}`）；401 请求也计入流量
- [x] 上报枢纽：模拟外部系统 `ingest` 后 `series` / `top-endpoints` / `sources` 正确反映；非法 payload 400
- [x] 时序存储：同 data-dir 重实例化后数据不丢（重放）；过期文件被清理（保留策略）；并发 append 计数精确（16 线程 × 200）
- [x] 查询参数校验：`range` / `metric` / `step` / `by` 非法值 400

文档与注释：

- [x] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
- [x] 注释符合 [AGENTS.md · 注释规范](./AGENTS.md#注释规范学习项目)：公共契约有 Javadoc（职责/参数/抛错约定）、解释「为什么」（聚合桶 / 蓄水池 / 单写线程等取舍）、无过时注释

## 验收清单（M3 · 已归档，随 M4 重跑仍须全绿）

后端（本期验收只看后端，前端联调留待 UI 重做期）：

- [x] `backend/` 下 `mvn clean package` 构建成功，全部测试通过（命令内局部设置 `JAVA_HOME=JDK25`）
- [x] 五模块骨架完整：common 零 Spring 依赖；framework 零端点；infrastructure 中性模型；docs 带 api 层；server 零业务
- [x] 全仓无 MySQL / Redis / OSS / MyBatis 依赖；Lombok / Hutool 仅在父 POM dependencyManagement 管版本，按需声明
- [x] `GET /api/docs/tree` 无需认证返回 `{"code":0,...}`；`?path=../secret.md` 返回 400 + `code=40000`
- [x] `SPRINGDOC_API_DOCS_ENABLED=true` 时 Swagger UI 可打开
- [x] 搜索语义符合 AGENTS.md 第 8 节（大小写不敏感、100 上限、懒遍历短路、结构化命中）

文档与注释：

- [x] README.md / AGENTS.md / DEVELOP_PLAN.md 与代码同步（不同步视为任务未完成）
- [x] 注释符合 [AGENTS.md · 注释规范](./AGENTS.md#注释规范学习项目)：公共契约有 Javadoc（职责/参数/抛错约定）、解释「为什么」、无过时注释
