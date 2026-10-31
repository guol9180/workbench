import { createRoot } from 'react-dom/client'

// 字体自托管（fontsource 随依赖分发，无 Google Fonts 外网依赖）；只取 latin 子集，界面用不到其它字集
import '@fontsource/chakra-petch/latin-500.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@fontsource/overpass-mono/latin-400.css'
import '@fontsource/overpass-mono/latin-500.css'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'
import App from './App'
import { initTheme } from './theme'
import { prefetchVditorAssets } from './modules/docs/prefetch'

// 主题必须在任何路由渲染前落到 <html>：登录页在 AppShell 之外，
// 若只由骨架初始化，从空状态直达 /login 时所有语义令牌都会是空值（整页无样式）。
initTheme()

createRoot(document.getElementById('root')!).render(
  // 不用 StrictMode：开发期「挂载→卸载→再挂载」会让 vendored Vditor 在半初始化态被
  // destroy 后重建，内部抛 "reading 'element'"。编辑器生命周期自身已保证配对（见 VditorEditor）。
  <App />,
)

// 空闲预载 Vditor 大脚本（Lute 引擎 / 代码高亮）：文档页首开不再白等（详见 prefetch.ts）
prefetchVditorAssets()
