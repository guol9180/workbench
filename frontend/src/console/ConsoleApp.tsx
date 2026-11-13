/** 控制台应用：四页导航、认证锁屏与主题；业务数据由各页面自行加载。 */
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useTheme, setTheme } from '../theme'
import OverviewPage from './OverviewPage'
import ServicesPage from './ServicesPage'
import OssProjectsPage from './OssProjectsPage'
import SettingsPage from './SettingsPage'
import LockScreen from './LockScreen'
import type { RouteKey } from './data'
import { ApiError, fetchMonitorStatus, hasSessionToken, login, logout, onUnauthorized, setSessionToken } from './api'
import type { ConsoleIconName } from './Icon'
import Icon from './Icon'

const SIDEBAR_KEY = 'devconsole.sidebar.v1'
const LOCKED_KEY = 'devconsole.locked.v1'

const ROUTE_META: Record<RouteKey, { title: string; sub: string; accent: string; icon: ConsoleIconName }> = {
  overview: { title: '总览', sub: '服务、站点与开源项目的健康快照', accent: '', icon: 'dashboard' },
  services: { title: '服务与站点', sub: '拨测状态与自部署服务流量', accent: 'monitor', icon: 'projects' },
  projects: { title: '开源项目', sub: 'GitHub 流量与互动快照', accent: 'docs', icon: 'tool' },
  settings: { title: '设置', sub: '凭据、系统状态与外观', accent: '', icon: 'settings' },
}

type ConsoleMode = 'probing' | 'server' | 'offline'

export default function ConsoleApp() {
  const theme = useTheme()
  const appRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef(0)
  const [route, setRoute] = useState<RouteKey>('overview')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [mode, setMode] = useState<ConsoleMode>('probing')
  const [authRequired, setAuthRequired] = useState(false)
  const [locked, setLocked] = useState(() => localStorage.getItem(LOCKED_KEY) === '1')

  const routeMeta = ROUTE_META[route]
  const showLock = mode === 'server' && locked

  function notify(message: string) {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 2400)
  }

  function changeRoute(next: RouteKey) {
    setRoute(next)
    setMobileOpen(false)
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }

  useEffect(() => {
    document.body.dataset.accent = routeMeta.accent
    document.title = 'Workbench · 个人观测台'
  }, [routeMeta])

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed)
    localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  useEffect(() => {
    document.body.classList.toggle('is-locked', locked)
    document.documentElement.style.overflow = locked ? 'hidden' : ''
    const app = appRef.current
    if (!app) return
    if (locked) {
      app.setAttribute('inert', '')
      app.setAttribute('aria-hidden', 'true')
    } else {
      app.removeAttribute('inert')
      app.removeAttribute('aria-hidden')
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [locked])

  useEffect(() => {
    document.body.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && mobileOpen) setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [mobileOpen])

  useEffect(() => {
    onUnauthorized(() => { lockNow() })
  }, [])

  useEffect(() => {
    void probeServer()
  }, [])

  async function probeServer() {
    setMode('probing')
    try {
      const status = await fetchMonitorStatus()
      setAuthRequired(status.authEnabled)
      setMode('server')
      if (status.authEnabled) {
        if (!hasSessionToken()) lockNow()
      } else {
        unlock()
      }
    } catch (error) {
      if (error instanceof ApiError && error.needRelogin) {
        setAuthRequired(true)
        setMode('server')
        lockNow()
        return
      }
      setMode('offline')
    }
  }

  async function handleServerLogin(password: string): Promise<string | null> {
    try {
      const session = await login(password)
      setSessionToken(session.token)
      return null
    } catch (error) {
      if (error instanceof ApiError) return error.message
      return '登录失败，请重试'
    }
  }

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next, { x: event.clientX, y: event.clientY })
  }

  function lockNow() {
    void logout()
    localStorage.setItem(LOCKED_KEY, '1')
    setLocked(true)
  }

  function unlock() {
    localStorage.removeItem(LOCKED_KEY)
    setLocked(false)
  }

  return (
    <>
      <div className="app" ref={appRef}>
        <aside className={'sidebar' + (mobileOpen ? ' is-open' : '')} aria-label="控制台导航">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">WB</span>
            <span className="brand-text">
              <strong className="brand-title">Workbench</strong>
              <span className="brand-sub">个人观测台</span>
            </span>
          </div>
          <nav className="side-nav" aria-label="主导航">
            <div className="nav-group">
              <span className="nav-group-label">总览</span>
              <button className="nav-item" type="button" aria-current={route === 'overview' ? 'page' : undefined} title="总览" onClick={() => changeRoute('overview')}>
                <Icon name="dashboard" /><span className="nav-label">总览</span>
              </button>
            </div>
            <div className="nav-group">
              <span className="nav-group-label">监控</span>
              <button className="nav-item" type="button" aria-current={route === 'services' ? 'page' : undefined} title="服务与站点" onClick={() => changeRoute('services')}>
                <Icon name="projects" /><span className="nav-label">服务与站点</span>
              </button>
              <button className="nav-item" type="button" aria-current={route === 'projects' ? 'page' : undefined} title="开源项目" onClick={() => changeRoute('projects')}>
                <Icon name="tool" /><span className="nav-label">开源项目</span>
              </button>
            </div>
            <div className="nav-group">
              <span className="nav-group-label">系统</span>
              <button className="nav-item" type="button" aria-current={route === 'settings' ? 'page' : undefined} title="设置" onClick={() => changeRoute('settings')}>
                <Icon name="settings" /><span className="nav-label">设置</span>
              </button>
            </div>
          </nav>
          <div className="sidebar-foot">
            <button className="collapse-btn" id="sidebar-collapse" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => setCollapsed(!collapsed)}>
              <Icon name={collapsed ? 'expand' : 'collapse'} className="icon-collapse" />
              <span className="nav-label">{collapsed ? '展开侧栏' : '收起侧栏'}</span>
            </button>
            {authRequired && (
              <button className="collapse-btn lock-btn" id="lock-button" type="button" aria-label="锁屏" onClick={lockNow}>
                <Icon name="lock" /><span className="nav-label">锁屏</span>
              </button>
            )}
          </div>
        </aside>
        {mobileOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />}
        <div className="workspace">
          <header className="topbar">
            <button className="icon-btn menu-btn" type="button" aria-expanded={mobileOpen} aria-controls="sidebar" aria-label="打开导航" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button>
            <div className="top-heading">
              <strong className="top-title">{routeMeta.title}</strong>
              <span className="top-sub">{routeMeta.sub}</span>
            </div>
            <button className="icon-btn" type="button" aria-label="切换明暗主题" aria-pressed={theme === 'dark'} onClick={toggleTheme}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </header>
          <main className="main" id="main-content" tabIndex={-1}>
            {mode === 'offline' && (
              <div className="offline-banner" role="alert">
                <span>后端不可用，控制台暂时没有数据。</span>
                <button className="btn btn-ghost" type="button" onClick={() => void probeServer()}>重试连接</button>
              </div>
            )}
            {mode === 'probing' ? (
              <div className="empty-state">
                <p className="empty-title">正在连接后端…</p>
                <p className="empty-desc">连不上时会显示离线提示，不会展示假数据。</p>
              </div>
            ) : mode === 'server' ? (
              <>
                {route === 'overview' && <OverviewPage onNavigate={changeRoute} />}
                {route === 'services' && <ServicesPage notify={notify} />}
                {route === 'projects' && <OssProjectsPage notify={notify} onNavigate={changeRoute} />}
                {route === 'settings' && <SettingsPage authRequired={authRequired} onLock={lockNow} notify={notify} />}
              </>
            ) : null}
          </main>
        </div>
      </div>

      {showLock && <LockScreen open={showLock} onUnlock={unlock} serverLogin={handleServerLogin} />}
      {toastMessage && <div className="toast" role="status" aria-live="polite">{toastMessage}</div>}
    </>
  )
}
