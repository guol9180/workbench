/**
 * 应用骨架：分组文字侧栏（可折叠记忆）+ 主区 + 底部遥测状态条。
 * - 主区按路由挂 data-domain：换域即换气质（analysis 石墨青 / docs 暖纸），骨架恒定
 * - 侧栏底部：主题切换（明暗记忆）+ 访问令牌 + 折叠钮
 * - 骨架不掺任何业务语义；各模块自带头部条
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { setToken } from '../api/http'
import StatusBar from './StatusBar'
import { initTheme, setTheme, type Theme } from '../theme'
import './AppShell.css'

const COLLAPSE_KEY = 'wb-rail-collapsed'

interface NavItem {
  to: string
  label: string
  domain: 'analysis' | 'docs'
  icon: ReactElement
}

const w = (d: string): ReactElement => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const HOME: NavItem = {
  to: '/home',
  label: '首页',
  domain: 'analysis',
  icon: w('M4 11 12 4l8 7M6.5 9.5V20h11V9.5'),
}
const GROUPS: Array<{ name: string; items: NavItem[] }> = [
  {
    name: '分析',
    items: [
      {
        to: '/monitor',
        label: '概览',
        domain: 'analysis',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline
              points="2,12 7,12 9.5,6 14.5,18 17,12 22,12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      { to: '/sources', label: '数据源', domain: 'analysis', icon: w('M12 3c4.4 0 8 1.25 8 2.8v12.4c0 1.55-3.6 2.8-8 2.8s-8-1.25-8-2.8V5.8C4 4.25 7.6 3 12 3Zm-8 2.8c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8M4 12c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8') },
    ],
  },
  {
    name: '工具',
    items: [
      { to: '/docs', label: '文档', domain: 'docs', icon: w('M7 2.5h7l4 4V21.5H7zM14 2.5v4h4M10 12.5h5M10 16h5') },
    ],
  },
]

const TOKEN_ICON = w('M8 15a4.5 4.5 0 1 1 3.5-4.5M11.5 11.5 20 3M16.5 6.5l3 3')
const LOGOUT_ICON = w('M13 4h5v16h-5M9.5 8l-4 4 4 4M5.5 12H16')

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  // 域随路由：docs → 暖纸感；其余 → 分析域。挂在 main 上，侧栏/状态条保持中性骨架
  const domain = location.pathname.startsWith('/docs') ? 'docs' : 'analysis'

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [theme, setThemeState] = useState<Theme>(() => initTheme())

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  /** 退出登录：无服务端会话可销毁，语义 = 清除本机令牌并回接入页。
   *  带 loggedOut 状态让接入页跳过 open 自动回跳（认证关闭时否则会原地弹回首页）。 */
  function logout() {
    setToken(null)
    navigate('/login', { state: { loggedOut: true } })
  }

  const itemCls = (active: boolean) => 'side-item' + (active ? ' active' : '')

  const renderItem = (it: NavItem) => (
    <NavLink key={it.to} to={it.to} title={it.label} className={({ isActive }) => itemCls(isActive)}>
      {it.icon}
      <span className="side-item-label">{it.label}</span>
      <i className={'side-item-domain d-' + it.domain} aria-hidden="true" />
    </NavLink>
  )

  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '')}>
      <aside className="sidebar">
        <div className="side-brand">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" role="img" aria-label="工作台">
            <polyline
              points="3,7 7.5,17 12,9.5 16.5,17 21,7"
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="side-wordmark">工作台</span>
          <button
            className="side-collapse"
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
            >
              <path d="M14 6.5 8.5 12l5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="side-nav">
          {renderItem(HOME)}
          {GROUPS.map((g) => (
            <div key={g.name} className="side-group">
              <div className="side-group-name">{g.name}</div>
              {g.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <button
            className="side-item"
            title={theme === 'dark' ? '切到浅色' : '切到暗色'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            )}
            <span className="side-item-label">{theme === 'dark' ? '浅色模式' : '暗色模式'}</span>
          </button>
          <NavLink to="/login" title="访问令牌" className={({ isActive }) => itemCls(isActive)}>
            {TOKEN_ICON}
            <span className="side-item-label">访问令牌</span>
          </NavLink>
          <button className="side-item side-logout" title="清除本机令牌并退出" onClick={logout}>
            {LOGOUT_ICON}
            <span className="side-item-label">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="shell-main" data-domain={domain}>
        <Outlet />
      </main>

      <StatusBar />
    </div>
  )
}
