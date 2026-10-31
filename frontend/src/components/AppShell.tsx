/**
 * 应用骨架：分组文字侧栏（可折叠记忆）+ 主区 + 底部遥测状态条。
 * - 主区按路由挂 data-domain：换域即换气质（analysis 石墨青 / docs 暖纸），骨架恒定
 * - 侧栏底部：主题切换（明暗记忆）+ 退出登录；登录页无侧栏入口（401 拦截与退出落地已覆盖全部到达路径）
 * - 骨架不掺任何业务语义；各模块自带头部条
 */
import { useEffect, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logoutRequest, setToken } from '../api/http'
import StatusBar from './StatusBar'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/ui'
import { currentTheme, setTheme, type Theme } from '../theme'
import './AppShell.css'

const COLLAPSE_KEY = 'wb-rail-collapsed'

interface NavItem {
  to: string
  label: string
  icon: ReactElement
}



const HOME: NavItem = {
  to: '/home',
  label: '首页',
  icon: <Icon name="home" />,
}
const GROUPS: Array<{ name: string; items: NavItem[] }> = [
  {
    name: '分析',
    items: [
      {
        to: '/monitor',
        label: '概览',
        icon: <Icon name="pulse" />,
      },
      { to: '/sources', label: '我的项目', icon: <Icon name="projects" /> },
    ],
  },
  {
    name: '工具',
    items: [
      { to: '/docs', label: '文档', icon: <Icon name="docs" /> },
    ],
  },
]

const LOGOUT_ICON = <Icon name="logout" />

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  // 域随路由：docs → 暖纸感；其余 → 分析域。挂在 main 上，侧栏/状态条保持中性骨架
  const domain = location.pathname.startsWith('/docs') ? 'docs' : 'analysis'

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [theme, setThemeState] = useState<Theme>(() => currentTheme())

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    // 以点击位置为圆心做圆形揭示，明暗切换不经过中灰
    setTheme(next, { x: event.clientX, y: event.clientY })
    setThemeState(next)
  }

  /** 退出登录：先尽力失效服务端会话，再清本机密码并回登录页。
   *  带 loggedOut 状态让登录页跳过 open 自动回跳（认证关闭时否则会原地弹回首页）。 */
  async function logout() {
    await logoutRequest()
    setToken(null)
    navigate('/login', { state: { loggedOut: true } })
  }

  const itemCls = (active: boolean) => 'side-item' + (active ? ' active' : '')

  const renderItem = (navItem: NavItem) => (
    <NavLink key={navItem.to} to={navItem.to} title={navItem.label} className={({ isActive }) => itemCls(isActive)}>
      {navItem.icon}
      <span className="side-item-label">{navItem.label}</span>
    </NavLink>
  )

  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '')}>
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" role="img" aria-label="工作台">
              <polyline
                points="3,7 7.5,17 12,9.5 16.5,17 21,7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="side-brand-text">
            <span className="side-wordmark">工作台</span>
            <span className="side-caption">Personal Console</span>
          </span>
          <IconButton
            className="side-collapse"
            size="sm"
            label={collapsed ? '展开侧栏' : '收起侧栏'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Icon
              name="chevron-left"
              size={16}
              style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
            />
          </IconButton>
        </div>

        <nav className="side-nav">
          {renderItem(HOME)}
          {GROUPS.map((group) => (
            <div key={group.name} className="side-group">
              <div className="side-group-name">{group.name}</div>
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <button
            className="side-item"
            title={theme === 'dark' ? '切到浅色' : '切到暗色'}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            <span className="side-item-label">{theme === 'dark' ? '浅色模式' : '暗色模式'}</span>
          </button>
          <button className="side-item side-logout" title="退出当前登录" onClick={() => void logout()}>
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
