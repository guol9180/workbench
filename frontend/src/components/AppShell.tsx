/**
 * 应用骨架：参考控制台稿的深色纵轨、顶栏与主区。
 * - 域只换强调色（docs 紫 / 监控 蓝 / 默认青），侧栏始终是同一块深色骨架
 * - 顶栏承担页面标题、全局搜索、主题与当前 AI；锁屏走既有退出登录流程
 * - 侧栏折叠只做宽度与标签淡出，不重排图标
 */
import { useEffect, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logoutRequest, setToken } from '../api/http'
import { currentTheme, setTheme, type Theme } from '../theme'
import { toast } from '../ui/toast'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/ui'
import TopSearch from './TopSearch'
import './AppShell.css'

const COLLAPSE_KEY = 'wb-rail-collapsed'

interface NavItem {
  to: string
  label: string
  icon: ReactElement
}

const GROUPS: Array<{ name: string; items: NavItem[] }> = [
  {
    name: '总览',
    items: [{ to: '/home', label: '数据看板', icon: <Icon name="dashboard" /> }],
  },
  {
    name: '监控',
    items: [
      { to: '/sources', label: '项目监控', icon: <Icon name="monitor" /> },
      { to: '/monitor', label: '流量监测', icon: <Icon name="pulse" /> },
    ],
  },
  {
    name: '工具',
    items: [
      { to: '/docs', label: '在线文档', icon: <Icon name="docs" /> },
      { to: '/tools', label: '集成工具', icon: <Icon name="tools" /> },
    ],
  },
]

interface RouteMeta {
  title: string
  sub: string
  domain: 'docs' | 'monitor' | ''
}

const ROUTES: Record<string, RouteMeta> = {
  '/home': { title: '数据看板', sub: '流量与项目运行总览 · 自动刷新', domain: '' },
  '/sources': { title: '项目监控', sub: 'GitHub 项目流量与下载量', domain: 'monitor' },
  '/monitor': { title: '流量监测', sub: '接口流量与端点状态 · 每 15 秒刷新', domain: 'monitor' },
  '/docs': { title: '在线文档', sub: '写作与笔记 · 支持本地 Markdown', domain: 'docs' },
  '/tools': { title: '集成工具', sub: '常用入口与本地命令', domain: '' },
}

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const meta = ROUTES[location.pathname] ?? { title: '工作台', sub: '个人开发控制台', domain: '' }

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(() => currentTheme())

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    document.querySelector<HTMLElement>('#main-content')?.scrollTo(0, 0)
  }, [location.pathname])

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next, { x: event.clientX, y: event.clientY })
    setThemeState(next)
  }

  async function lock() {
    await logoutRequest()
    setToken(null)
    navigate('/login', { state: { loggedOut: true } })
  }

  const renderItem = (navItem: NavItem) => (
    <NavLink
      key={navItem.to}
      to={navItem.to}
      title={navItem.label}
      className={({ isActive }) => 'side-item' + (isActive ? ' active' : '')}
      onClick={() => setMobileOpen(false)}
    >
      {navItem.icon}
      <span className="side-item-label">{navItem.label}</span>
    </NavLink>
  )

  return (
    <div
      className={'shell' + (collapsed ? ' is-collapsed' : '') + (mobileOpen ? ' is-mobile-open' : '')}
      data-domain={meta.domain || undefined}
    >
      <aside className="sidebar" aria-label="控制台导航">
        <div className="side-brand">
          <span className="side-mark" aria-hidden="true">DC</span>
          <span className="side-brand-text">
            <strong className="side-wordmark">个人开发控制台</strong>
            <span className="side-caption">数据监控 · 开发工具</span>
          </span>
        </div>

        <nav className="side-nav" aria-label="主导航">
          {GROUPS.map((group) => (
            <div key={group.name} className="side-group">
              <span className="side-group-name">{group.name}</span>
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <button
            className="side-item side-collapse-btn"
            type="button"
            aria-expanded={!collapsed}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Icon
              name={collapsed ? 'chevron-right' : 'chevron-left'}
              size={16}
              className="side-collapse-icon"
            />
            <span className="side-item-label">{collapsed ? '展开侧栏' : '收起侧栏'}</span>
          </button>
          <button className="side-item side-lock" type="button" title="锁屏" onClick={() => void lock()}>
            <Icon name="lock" size={16} />
            <span className="side-item-label">锁屏</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />
      )}

      <div className="workspace">
        <header className="topbar">
          <IconButton
            className="menu-btn"
            label={mobileOpen ? '关闭导航' : '打开导航'}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Icon name="menu" size={18} />
          </IconButton>

          <div className="top-heading">
            <strong className="top-title">{meta.title}</strong>
            <span className="top-sub">{meta.sub}</span>
          </div>

          <TopSearch />

          <button
            className="topbar-icon"
            type="button"
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到暗色主题'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到暗色主题'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          <button
            className="account"
            type="button"
            title="当前 AI：Command Code · AI 配置页后续开放"
            onClick={() => toast('AI 配置页后续开放，当前使用 Command Code。')}
          >
            <span className="avatar ai-avatar" aria-hidden="true">AI</span>
            <span className="account-text">
              <strong className="account-name">Command Code</strong>
              <span className="account-role">当前 AI · 编码助手</span>
            </span>
          </button>
        </header>

        <main className="shell-body" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
