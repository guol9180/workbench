import { createRoot } from 'react-dom/client'

// 字体自托管（fontsource 随依赖分发，无外部字体网络依赖）
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './console/console.css'
import App from './App'
import { initTheme } from './theme'

// 主题必须在首屏渲染前落到 html/body：控制台 CSS 的变量挂在 body[data-theme] 上
initTheme()

createRoot(document.getElementById('root')!).render(<App />)
