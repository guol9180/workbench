/**
 * 路由根：hash 路由保持 GitHub Pages 深链可用。
 * / 默认进概览；接入页独立于骨架（全屏无轨无状态条）；全局对话框/Toast 挂在路由根外。
 */
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { AppDialog, AppToast } from './components/AppOverlay'
import MonitorView from './modules/monitor/MonitorView'
import DocsView from './modules/docs/DocsView'
import AccessView from './modules/access/AccessView'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/monitor" replace />} />
          <Route path="/monitor" element={<MonitorView />} />
          <Route path="/docs" element={<DocsView />} />
        </Route>
        <Route path="/login" element={<AccessView />} />
        <Route path="*" element={<Navigate to="/monitor" replace />} />
      </Routes>
      <AppDialog />
      <AppToast />
    </HashRouter>
  )
}
