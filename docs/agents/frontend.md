# 前端约定

> 规范主文件见 [AGENTS.md](../../AGENTS.md)，API 契约见 [api.md](./api.md)。

1. **入口**：活动代码在 `frontend/src/console/`（`ConsoleApp` / `OverviewPage` / `ServicesPage` / `OssProjectsPage` / `SettingsPage` / `EmptyState` / `Sparkline` / `LockScreen` / `Icon` / `data.ts` / `api.ts` / `console.css`）；`App.tsx` 只渲染 `ConsoleApp`，`main.tsx` 只加载字体、`console.css` 与主题初始化。
2. **页面**：总览 / 服务与站点 / 开源项目 / 设置四页。
3. **视觉与交互**：`console.css` 是唯一视觉源；全局单一强调色（氧化橙），禁止按路由切换强调色，状态色只用于真实语义状态；图标只来自 `Icon.tsx`，禁止内联手写 SVG（品牌 logo 除外）；常用 UI（按钮、表单、面板、加载态）原语化复用；交互覆盖 hover / active / focus-visible / disabled / loading；动效走 `--dur-fast` / `--dur` / `--ease` 并尊重 `prefers-reduced-motion`。
4. **空状态**：统一用 `EmptyState`（图标 + 标题 + 说明 + 可选步骤 + 主次动作），必须回答「为什么空 + 下一步」；冷启动不渲染零值指标卡或空表格，动作要能直接完成下一步（聚焦表单 / 拉取列表 / 跳转设置）。判定「已接入对象」不含 `workbench` 自监测来源，否则自监测会让空状态永不出现。
5. **模式**：只运行服务端模式，同源 `/api` 取真实数据；不保留演示模式与 mock；网络错误显示提示条并保留上次数据。
6. **接口封装**：`api.ts` 统一处理同源基地址、`X-API-Token`（令牌只存内存）、`ApiResult` 解包、`code != 0` 抛错、401 回锁屏。
7. **本地存储**：仅主题 / 侧栏 / 锁屏状态（`devconsole.theme.v1` / `devconsole.sidebar.v1` / `devconsole.locked.v1`）；会话令牌只存内存。
8. **验收基准**：桌面 1440 / 移动 390 无横向溢出；`pnpm build` 零错。
