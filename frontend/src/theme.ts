/**
 * 主题状态：明暗双主题，默认跟随系统（无系统偏好表达时取暗色），手动切换后记忆。
 * 只负责 data-theme；域主题（data-domain）由 AppShell 按路由挂载，两者正交。
 */
export type Theme = 'light' | 'dark'

const THEME_KEY = 'wb-theme'
const listeners = new Set<(t: Theme) => void>()

export function currentTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** 应用启动时调用一次：把记忆/系统偏好落到 <html data-theme> */
export function initTheme(): Theme {
  const theme = currentTheme()
  apply(theme)
  return theme
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  apply(theme)
  listeners.forEach((fn) => fn(theme))
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

