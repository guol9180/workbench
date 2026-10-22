/**
 * 应用骨架：仪表舱三件——左图标轨（模块切换）、主区、底部遥测状态条。
 * 模块只挂主区；各模块自带头部条，骨架不掺任何业务语义。
 */
import { NavLink, Outlet } from 'react-router-dom'
import StatusBar from './StatusBar'
import './AppShell.css'

export default function AppShell() {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-brand" title="工作台">
          {/* 品牌标记：琥珀描迹「W」，与示波器描迹同一笔意 */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" role="img" aria-label="工作台">
            <polyline
              points="3,7 7.5,17 12,9.5 16.5,17 21,7"
              stroke="var(--amber)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <nav className="rail-nav">
          <NavLink to="/monitor" title="概览" className={({ isActive }) => 'rail-btn' + (isActive ? ' active' : '')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline
                points="2,12 7,12 9.5,6 14.5,18 17,12 22,12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </NavLink>
          <NavLink to="/docs" title="文档" className={({ isActive }) => 'rail-btn' + (isActive ? ' active' : '')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 2.5h7l4 4V21.5H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M14 2.5v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M10 12.5h5M10 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </NavLink>
        </nav>

        <div className="rail-foot">
          <NavLink to="/login" title="接入" className={({ isActive }) => 'rail-btn' + (isActive ? ' active' : '')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="8" cy="15" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M11.5 11.5 20 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16.5 6.5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </NavLink>
        </div>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>

      <StatusBar />
    </div>
  )
}
