/**
 * 主题状态：明暗双主题，默认跟随系统（无系统偏好表达时取暗色），手动切换后记忆。
 * 只负责 data-theme；域主题（data-domain）由 AppShell 按路由挂载，两者正交。
 */
export type Theme = 'light' | 'dark'

const THEME_KEY = 'wb-theme'
const TRANSITION_CLASS = 'theme-switching'
let transitionTimer = 0
const listeners = new Set<(t: Theme) => void>()

export function currentTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  // 浏览器 UI（移动端地址栏 / 桌面端窗口边）跟随页面底色，避免明暗切换时边缘色不连贯
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0e0f' : '#eef2f1')
}

/** 应用启动时调用一次：把记忆/系统偏好落到 <html data-theme>（不做过渡，避免首屏闪一下） */
export function initTheme(): Theme {
  const theme = currentTheme()
  apply(theme)
  return theme
}

export interface ThemeOrigin {
  /** 切换按钮在视口中的位置：圆形揭示从这里扩散 */
  x: number
  y: number
}

export function setTheme(theme: Theme, origin?: ThemeOrigin): void {
    localStorage.setItem(THEME_KEY, theme)
    const root = document.documentElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 首选圆形揭示：旧画面保持不动，新主题从点击处扩散覆盖，全程不混色。
    // 交叉淡化会把明暗两帧平均成中灰（文字与背景同时失去对比），所以不用默认过渡。
    if (!reduced && typeof document.startViewTransition === 'function') {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const originX = origin?.x ?? viewportWidth / 2
      const originY = origin?.y ?? viewportHeight / 2
      const revealRadius = Math.hypot(
        Math.max(originX, viewportWidth - originX),
        Math.max(originY, viewportHeight - originY),
      )
      root.style.setProperty('--theme-origin-x', `${originX}px`)
      root.style.setProperty('--theme-origin-y', `${originY}px`)
      root.style.setProperty('--theme-reveal-radius', `${revealRadius}px`)
      document.startViewTransition(() => {
        apply(theme)
        listeners.forEach((listener) => listener(theme))
      })
      return
    }

    // 回退方案：临时挂类让所有表面同节奏换色；强制 reflow 保证过渡从当前色开始，
    // 否则同一帧内改 data-theme 会被浏览器合并成瞬切（表现为侧栏闪、主区慢半拍）。
    if (!reduced) {
      root.classList.add(TRANSITION_CLASS)
      void root.offsetWidth
      window.clearTimeout(transitionTimer)
      transitionTimer = window.setTimeout(() => root.classList.remove(TRANSITION_CLASS), 260)
    }
    apply(theme)
    listeners.forEach((listener) => listener(theme))
}

/** React 侧订阅：主题切换时需要重建的资源（如 Vditor 实例）从这里拿最新值 */
export function useTheme(): Theme {
  const [theme, setT] = useState<Theme>(currentTheme)
  useEffect(() => {
    const fn = (t: Theme) => setT(t)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])
  return theme
}
import { useEffect, useState } from 'react'

