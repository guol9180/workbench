/** 控制台应用：服务端模式，数据全部来自 /api；后端不可达时显示离线提示。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useTheme, setTheme } from '../theme'
import DashboardPage from './DashboardPage'
import ProjectsPage from './ProjectsPage'
import LockScreen from './LockScreen'
import { ExportDialog, ProjectDetailDialog } from './Dialogs'
import { errorRate, fmtDay, fmtNum, fmtStamp, STATUS_META } from './data'
import type { LogEntry, LogLevel, Project, RouteKey } from './data'
import type { TrendPoint } from './TrendChart'
import {
  ApiError,
  fetchMonitorStatus,
  fetchOverview,
  fetchRecent,
  fetchSeries,
  fetchSources,
  hasSessionToken,
  login,
  logout,
  onUnauthorized,
  setSessionToken,
} from './api'
import type { Overview, RecentRecord, SeriesPoint, SourceStat } from './api'
import Icon from './Icon'

const SIDEBAR_KEY = 'devconsole.sidebar.v1'
const LOCKED_KEY = 'devconsole.locked.v1'

/** 走势图档位 → 后端 range 标签 */
const RANGE_API_LABELS: Record<number, string> = { 7: '7d', 14: '14d', 30: '30d' }

const ROUTE_META: Record<RouteKey, { title: string; sub: string; accent: string }> = {
  dashboard: { title: '数据看板', sub: '个人观测总览 · 实时数据', accent: '' },
  projects: { title: '项目监控', sub: '数据源与运行日志 · 实时数据', accent: 'monitor' },
}

interface SearchResult {
  kind: string
  name: string
  extra: string
  run: () => void
}

// ---------------- 服务端数据 → 页面模型的适配（真实派生，不造假字段） ----------------

/** 监测源 + 24h 总览 → 项目卡片模型：状态与文案全部真实派生 */
function adaptSourceToProject(stat: SourceStat, overview: Overview | null): Project {
  const requestCount = overview?.count ?? 0
  const errorCount = overview?.errCount ?? 0
  const errorRatio = requestCount > 0 ? errorCount / requestCount : 0
  const lastSeenAt = new Date(stat.lastSeenMinute * 60_000)
  return {
    id: stat.name,
    name: stat.name,
    stack: stat.name.startsWith('github/') || stat.name.startsWith('snapshot/github/')
      ? 'GitHub'
      : stat.name.startsWith('probe/') ? '拨测' : '本机服务',
    status: requestCount === 0 ? 'stopped' : errorRatio >= 0.01 ? 'error' : 'running',
    desc: requestCount > 0
      ? `24h ${fmtNum(requestCount)} 次调用 · 错误率 ${(errorRatio * 100).toFixed(2)}%`
      : '24h 无调用',
    todayRequests: requestCount,
    errors: errorCount,
    latency: Math.round(overview?.avgMs ?? 0),
    uptime: '—',
    lastDeploy: lastSeenAt,
    lastLogAt: lastSeenAt,
  }
}

/** 最近分钟桶记录 → 运行日志行：级别按 errCount>0→ERROR、maxMs>800→WARN 派生 */
function adaptRecentToLog(record: RecentRecord): LogEntry {
  const level: LogLevel = record.errCount > 0 ? 'error' : record.maxMs > 800 ? 'warn' : 'info'
  return {
    id: `${record.minute}-${record.source}-${record.endpoint}-${record.method}`,
    ts: new Date(record.minute * 60_000),
    projectId: record.source,
    level,
    msg: `${record.method} ${record.endpoint} · ${record.count} 次 · 平均 ${record.avgMs}ms`,
  }
}

/** 小时序列 → 按日聚合的走势点：requests 单位换算为万次、errors 为百次（与图例一致） */
function aggregateDailyTrend(countSeries: SeriesPoint[], errSeries: SeriesPoint[]): TrendPoint[] {
  const dailyBuckets = new Map<string, { date: Date; requests: number; errors: number }>()
  countSeries.forEach((point) => {
    const date = new Date(point.bucketEpoch * 60_000)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const bucket = dailyBuckets.get(dayKey) ?? { date, requests: 0, errors: 0 }
    bucket.requests += point.value / 10000
    dailyBuckets.set(dayKey, bucket)
  })
  errSeries.forEach((point) => {
    const date = new Date(point.bucketEpoch * 60_000)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const bucket = dailyBuckets.get(dayKey)
    if (bucket) {
      bucket.errors += point.value / 100
      return
    }
    dailyBuckets.set(dayKey, { date, requests: 0, errors: point.value / 100 })
  })
  return [...dailyBuckets.values()]
    .sort((first, second) => first.date.getTime() - second.date.getTime())
    .map((bucket) => ({ date: bucket.date, requests: bucket.requests, errors: bucket.errors }))
}

type ConsoleMode = 'probing' | 'server' | 'offline'

export default function ConsoleApp() {
  const theme = useTheme()
  const appRef = useRef<HTMLDivElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [route, setRoute] = useState<RouteKey>('dashboard')
  const [range, setRange] = useState(7)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [locked, setLocked] = useState(() => localStorage.getItem(LOCKED_KEY) === '1')
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)
  const [exportScope, setExportScope] = useState<'dashboard' | 'projects' | 'logs' | null>(null)
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null)
  const toastTimer = useRef(0)

  /* ---------------- 服务端状态 ---------------- */
  const [mode, setMode] = useState<ConsoleMode>('probing')
  const [authRequired, setAuthRequired] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([])

  const routeMeta = ROUTE_META[route]
  const detailProject = projects.find((project) => project.id === detailProjectId) ?? null
  const serverReady = mode === 'server' && (!authRequired || hasSessionToken())
  const showLock = mode === 'server' && locked

  function showToast(message: string) {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 2400)
  }

  function changeRoute(next: RouteKey) {
    setRoute(next)
    setMobileOpen(false)
    setSearchOpen(false)
    setSearchQuery('')
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
      if (event.key === 'Escape' && mobileOpen && !document.querySelector('dialog[open]')) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [mobileOpen])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  /* ---------------- 连接探测与服务端数据加载 ---------------- */

  /** 会话失效统一回锁屏（api 层 401 时回调） */
  useEffect(() => {
    onUnauthorized(() => { lockNow() })
  }, [])

  useEffect(() => {
    void probeServer()
  }, [])

  /** 服务端就绪后加载监测数据；路由/range 变化时重拉——切页即取最新数 */
  useEffect(() => {
    if (!serverReady) return
    void loadServerData()
  }, [serverReady, route, range])

  /** 启动探测：可达 → 服务端模式（认证开启且未登录则锁屏）；不可达 → 离线提示 */
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
        // 401 说明后端存在且开启了认证：进入服务端模式 + 锁屏，而非误判离线
        setAuthRequired(true)
        setMode('server')
        lockNow()
        return
      }
      setMode('offline')
    }
  }

  function handleServerError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.needRelogin) return
      if (error.offline) {
        setMode('offline')
        return
      }
      showToast(error.message)
      return
    }
    showToast('请求失败，请稍后重试')
  }

  async function loadServerData() {
    const rangeLabel = RANGE_API_LABELS[range] ?? '7d'
    try {
      const [sourceStats, recentRecords, countSeries, errSeries] = await Promise.all([
        fetchSources(),
        fetchRecent(undefined, 200),
        fetchSeries('workbench', 'count', rangeLabel, 'h'),
        fetchSeries('workbench', 'errCount', rangeLabel, 'h'),
      ])
      // 快照源（绝对值）由 M17 项目页单独消费；当前流量看板只展示流量源，避免把 stars 当请求数
      const trafficSources = sourceStats.filter((stat) => !stat.name.startsWith('snapshot/'))
      const overviews = await Promise.all(trafficSources.map((stat) =>
        fetchOverview(stat.name, '24h').catch((error: unknown) => {
          // 单源总览失败不拖垮整个看板；但 401 必须上抛触发回锁屏
          if (error instanceof ApiError && error.needRelogin) throw error
          return null
        })))
      setProjects(trafficSources.map((stat, index) => adaptSourceToProject(stat, overviews[index])))
      setLogs(recentRecords.map(adaptRecentToLog))
      setTrendPoints(aggregateDailyTrend(countSeries, errSeries))
    } catch (error) {
      handleServerError(error)
    }
  }

  async function refreshServerLogs() {
    try {
      const records = await fetchRecent(undefined, 200)
      setLogs(records.map(adaptRecentToLog))
      showToast('已获取最新日志')
    } catch (error) {
      handleServerError(error)
    }
  }

  /** 服务端登录：成功返回 null（令牌已写入 api 层），失败返回可读错误 */
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

  function openProjectDetail(project: Project) {
    setDetailProjectId(project.id)
  }

  function runExport(scope: 'dashboard' | 'projects' | 'logs', format: 'csv' | 'json'): string {
    let head: string[]
    let rows: Array<Array<string | number>>
    if (scope === 'projects') {
      head = ['项目', '技术栈', '状态', '今日请求', '错误数', '平均响应(ms)', '最近活跃']
      rows = projects.map((project) => [project.name, project.stack, STATUS_META[project.status].label, project.todayRequests, project.errors, project.todayRequests > 0 ? project.latency : '', fmtDay(project.lastLogAt)])
    } else if (scope === 'logs') {
      head = ['时间', '项目', '级别', '内容']
      rows = logs.slice(0, 200).map((entry) => [fmtStamp(entry.ts), projects.find((project) => project.id === entry.projectId)?.name ?? '', entry.level.toUpperCase(), entry.msg])
    } else {
      const requests = projects.reduce((sum, project) => sum + project.todayRequests, 0)
      const errors = projects.reduce((sum, project) => sum + project.errors, 0)
      const latencyBase = projects.reduce((sum, project) => sum + project.latency * project.todayRequests, 0)
      head = ['指标', '数值']
      rows = [
        ['监测源', projects.length],
        ['活跃源', projects.filter((project) => project.status === 'running' || project.status === 'developing').length],
        ['今日请求', requests],
        ['今日错误', errors],
        ['错误率', errorRate(errors, requests)],
        ['平均响应(ms)', requests > 0 ? Math.round(latencyBase / requests) : '—'],
      ]
    }
    const content = format === 'csv'
      ? [head, ...rows].map((row) => row.map((cell) => {
        const value = String(cell ?? '')
        return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
      }).join(',')).join('\r\n')
      : JSON.stringify({ scope, generatedAt: new Date().toISOString(), head, rows }, null, 2)
    try {
      const blob = new Blob(['\ufeff' + content], { type: format === 'csv' ? 'text/csv' : 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `workbench-${scope}-${fmtDay(new Date())}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      return `已生成 ${rows.length} 条记录的 ${format.toUpperCase()} 文件并开始下载。`
    } catch {
      return '当前环境阻止了文件下载，数据仍可在页面中查看。'
    }
  }

  const searchResults = useMemo<SearchResult[]>(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return []
    return projects
      .filter((project) => `${project.name} ${project.stack}`.toLowerCase().includes(keyword))
      .slice(0, 8)
      .map((project) => ({
        kind: '项目',
        name: project.name,
        extra: project.stack,
        run: () => { changeRoute('projects'); setDetailProjectId(project.id) },
      }))
  }, [projects, searchQuery])

  function runSearch(index: number) {
    const result = searchResults[index]
    setSearchOpen(false)
    setSearchQuery('')
    if (result) result.run()
  }

  function lockNow() {
    // 锁屏即注销会话（内存令牌清空）；认证关闭时不会展示锁屏
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
              <button className="nav-item" type="button" aria-current={route === 'dashboard' ? 'page' : undefined} title="数据看板" onClick={() => changeRoute('dashboard')}>
                <Icon name="dashboard" /><span className="nav-label">数据看板</span>
              </button>
            </div>
            <div className="nav-group">
              <span className="nav-group-label">监控</span>
              <button className="nav-item" type="button" aria-current={route === 'projects' ? 'page' : undefined} title="项目监控" onClick={() => changeRoute('projects')}>
                <Icon name="projects" /><span className="nav-label">项目监控</span>
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
            <div className="search-wrap" ref={searchWrapRef}>
              <div className="global-search">
                <span className="search-glyph" aria-hidden="true"><Icon name="search" size={18} /></span>
                <input
                  className="input global-input"
                  type="search"
                  value={searchQuery}
                  placeholder="搜索项目"
                  autoComplete="off"
                  aria-label="全局搜索"
                  onFocus={() => { if (searchQuery.trim()) setSearchOpen(true) }}
                  onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(!!event.target.value.trim()) }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); if (searchResults.length > 0) runSearch(0) }
                    else if (event.key === 'Escape') setSearchOpen(false)
                  }}
                />
              </div>
              {searchOpen && (
                <div className="search-pop">
                  {searchResults.length === 0 ? <p className="search-none">没有匹配的项目</p> : searchResults.map((item, index) => (
                    <button className="search-item" type="button" key={`${item.kind}-${item.name}-${index}`} onClick={() => runSearch(index)}>
                      <span className="search-kind">{item.kind}</span>
                      <span className="search-name">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
                <p className="empty-desc">连不上时会保留离线提示，不会展示假数据。</p>
              </div>
            ) : (
              <>
                {route === 'dashboard' && (
                  <DashboardPage
                    projects={projects}
                    range={range}
                    setRange={setRange}
                    onExport={() => setExportScope('dashboard')}
                    onProjectDetail={openProjectDetail}
                    trendPoints={trendPoints}
                  />
                )}
                {route === 'projects' && (
                  <ProjectsPage
                    projects={projects}
                    logs={logs}
                    focusProjectId={focusProjectId}
                    onFocusConsumed={() => setFocusProjectId(null)}
                    onProjectDetail={openProjectDetail}
                    onProjectLogs={(projectId) => setFocusProjectId(projectId)}
                    onExport={() => setExportScope('projects')}
                    onRefreshLogs={() => void refreshServerLogs()}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      <ProjectDetailDialog
        project={detailProject}
        logs={logs}
        onClose={() => setDetailProjectId(null)}
        onShowLogs={(projectId) => { setDetailProjectId(null); changeRoute('projects'); setFocusProjectId(projectId) }}
      />
      <ExportDialog open={exportScope !== null} defaultScope={exportScope ?? 'dashboard'} onClose={() => setExportScope(null)} onRun={runExport} />
      {showLock && <LockScreen open={showLock} onUnlock={unlock} serverLogin={handleServerLogin} />}
      {toastMessage && <div className="toast" role="status" aria-live="polite">{toastMessage}</div>}
    </>
  )
}
