/** 新版控制台应用：参考稿信息架构 + M13 双模式（服务端真实数据 / 后端不可达时的本地演示）。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useTheme, setTheme } from '../theme'
import DashboardPage from './DashboardPage'
import ProjectsPage from './ProjectsPage'
import DocsPage from './DocsPage'
import LockScreen from './LockScreen'
import { ExportDialog, ProjectDetailDialog, ProjectFormDialog, ToolFormDialog } from './Dialogs'
import type { ProjectDraft } from './Dialogs'
import {
  errorRate,
  fmtClockSec,
  fmtDay,
  fmtNum,
  fmtStamp,
  loadJSON,
  LOG_POOL,
  saveJSON,
  seedDocs,
  seedLogs,
  seedProjects,
  STATUS_META,
} from './data'
import type { Doc, LocalDoc, LocalFileHandle, LogEntry, LogLevel, Project, RouteKey, ToolEntry } from './data'
import type { TrendPoint } from './TrendChart'
import {
  ApiError,
  createDocFile,
  deleteDocFile,
  fetchDocFile,
  fetchDocTree,
  fetchMonitorStatus,
  fetchOverview,
  fetchRecent,
  fetchSeries,
  fetchSources,
  hasSessionToken,
  login,
  logout,
  onUnauthorized,
  renameDocFile,
  saveDocFile,
  searchDocs,
  setSessionToken,
} from './api'
import type { DocNode, Overview, RecentRecord, SeriesPoint, SourceStat } from './api'
import Icon from './Icon'

const SIDEBAR_KEY = 'devconsole.sidebar.v1'
const LOCKED_KEY = 'devconsole.locked.v1'
const DOCS_KEY = 'devconsole.docs.v1'
const TOOLS_KEY = 'devconsole.tools.v1'

/** 走势图档位 → 后端 range 标签（M13 起后端支持 14d/30d） */
const RANGE_API_LABELS: Record<number, string> = { 7: '7d', 14: '14d', 30: '30d' }

const ROUTE_META: Record<RouteKey, { title: string; sub: string; accent: string }> = {
  dashboard: { title: '数据看板', sub: '个人开发总览 · 示例数据', accent: '' },
  projects: { title: '项目监控', sub: '项目数据与运行日志 · 示例数据', accent: 'monitor' },
  docs: { title: '在线文档', sub: '写作与笔记 · 支持本地 Markdown', accent: 'docs' },
}

/** 服务端模式的顶栏副标题：明确告知数据来源已切换，避免「示例数据」误导 */
const SERVER_ROUTE_SUB: Record<RouteKey, string> = {
  dashboard: '个人开发总览 · 实时数据',
  projects: '数据源与运行日志 · 实时数据',
  docs: '写作与笔记 · 服务端文档',
}

interface SearchResult {
  kind: string
  name: string
  extra: string
  run: () => void
}

// ---------------- 服务端数据 → 页面模型的适配（真实派生，不造假字段） ----------------

/** 服务端文档路径 → 列表标题：去扩展名；多级目录保留父路径语境 */
function pathToTitle(path: string): string {
  const fileName = path.split('/').pop() ?? path
  return fileName.replace(/\.(md|markdown|txt)$/i, '')
}

/** 列表标题 → 服务端路径：过滤 Windows 保留字符与路径分隔符（后端与部署环境都会拒绝） */
function titleToPath(title: string): string {
  const safeName = title.replace(/[\\/:*?"<>|\u0000]/g, '').trim()
  return `${safeName || '未命名文档'}.md`
}

/** 后端文件树 → 扁平文档列表（content 懒加载，updatedAt=0 表示尚未读过） */
function flattenDocTree(node: DocNode, collected: Doc[] = []): Doc[] {
  node.children.forEach((child) => {
    if (child.type === 'file') {
      collected.push({ id: child.path, title: pathToTitle(child.name), content: '', updatedAt: 0 })
    } else {
      flattenDocTree(child, collected)
    }
  })
  return collected.sort((first, second) => first.id.localeCompare(second.id))
}

/** 监测源 + 24h 总览 → 项目卡片模型：状态与文案全部真实派生（AGENTS §9.7 派生规则） */
function adaptSourceToProject(stat: SourceStat, overview: Overview | null): Project {
  const requestCount = overview?.count ?? 0
  const errorCount = overview?.errCount ?? 0
  const errorRatio = requestCount > 0 ? errorCount / requestCount : 0
  const lastSeenAt = new Date(stat.lastSeenMinute * 60_000)
  return {
    id: stat.name,
    name: stat.name,
    stack: stat.name.startsWith('github/') ? 'GitHub' : '本机服务',
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

/** 最近分钟桶记录 → 运行日志行：级别与消息文案按约定派生（errCount>0→ERROR，maxMs>800→WARN） */
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

export default function ConsoleApp() {
  const theme = useTheme()
  const appRef = useRef<HTMLDivElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [route, setRoute] = useState<RouteKey>('dashboard')
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const [logs, setLogs] = useState<LogEntry[]>(seedLogs)
  const [docs, setDocs] = useState<Doc[]>(() => loadJSON(DOCS_KEY, seedDocs()))
  const [tools, setTools] = useState<ToolEntry[]>(() => loadJSON(TOOLS_KEY, []))
  const [range, setRange] = useState(7)
  const [activeDocId, setActiveDocId] = useState<string | null>(docs[0]?.id ?? null)
  const [localDoc, setLocalDoc] = useState<LocalDoc | null>(null)
  const [localSaveState, setLocalSaveState] = useState('')
  const [docPreview, setDocPreview] = useState(false)
  const [docSaveState, setDocSaveState] = useState('')
  const [listCollapsed, setListCollapsed] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [locked, setLocked] = useState(() => localStorage.getItem(LOCKED_KEY) === '1')
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [toolFormOpen, setToolFormOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'dashboard' | 'projects' | 'logs' | null>(null)
  const [focusProjectId, setFocusProjectId] = useState<string | null>(null)
  const toastTimer = useRef(0)

  /* ---------------- M13 双模式状态 ---------------- */
  type ConsoleMode = 'probing' | 'server' | 'demo'
  const [mode, setMode] = useState<ConsoleMode>('probing')
  const [authRequired, setAuthRequired] = useState(false)
  const [serverProjects, setServerProjects] = useState<Project[] | null>(null)
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([])
  const [serverTrendPoints, setServerTrendPoints] = useState<TrendPoint[] | null>(null)
  /** null = 服务端模式未搜索（显示全部）；undefined = 演示模式本地过滤 */
  const [filteredDocIds, setFilteredDocIds] = useState<string[] | null | undefined>(undefined)
  const docsRef = useRef(docs)
  const serverDocSaveTimer = useRef(0)
  const docSearchTimer = useRef(0)

  const isServerMode = mode === 'server'
  const displayProjects = isServerMode ? (serverProjects ?? []) : projects
  const displayLogs = isServerMode ? serverLogs : logs
  const displayTrendPoints = isServerMode ? (serverTrendPoints ?? []) : null
  const topSub = isServerMode ? SERVER_ROUTE_SUB[route] : ROUTE_META[route].sub
  const routeMeta = ROUTE_META[route]
  const detailProject = displayProjects.find((project) => project.id === detailProjectId) ?? null
  const serverReady = isServerMode && (!authRequired || hasSessionToken())

  useEffect(() => {
    docsRef.current = docs
  }, [docs])

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
    document.title = '个人开发控制台 · 数据监控与工具集'
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
    saveJSON(TOOLS_KEY, tools)
  }, [tools])

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

  /* ---------------- M13：模式探测与服务端数据加载 ---------------- */

  /** 会话失效统一回锁屏（api 层 401 时回调） */
  useEffect(() => {
    onUnauthorized(() => { lockNow() })
  }, [])

  /** 启动探测：可达 → 服务端模式（认证开启且未登录则锁屏）；不可达 → 演示模式 */
  useEffect(() => {
    let probeCancelled = false
    fetchMonitorStatus()
      .then((status) => {
        if (probeCancelled) return
        setMode('server')
        setAuthRequired(status.authEnabled)
        if (status.authEnabled && !hasSessionToken()) lockNow()
      })
      .catch((error: unknown) => {
        if (probeCancelled) return
        if (error instanceof ApiError && error.needRelogin) {
          // 401 说明后端存在且开启了认证：进入服务端模式 + 锁屏，而非误判离线
          setMode('server')
          setAuthRequired(true)
          lockNow()
          return
        }
        setMode('demo')
      })
    return () => { probeCancelled = true }
  }, [])

  /** 服务端模式就绪后加载监测数据；路由/range 变化时重拉——切页即取最新数，查询本身也计入自监测闭环 */
  useEffect(() => {
    if (!serverReady) return
    void loadServerData()
  }, [serverReady, route, range])

  /** 服务端文档只加载一次（登录态切换由 serverReady 变化触发） */
  useEffect(() => {
    if (!serverReady) return
    void loadServerDocs()
  }, [serverReady])

  function handleServerError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.needRelogin) return
      if (error.offline) {
        enterDemoMode()
        return
      }
      showToast(error.message)
      return
    }
    showToast('请求失败，请稍后重试')
  }

  /** 后端失联：整体回落演示模式，并把文档/视图状态还原为本地形态（避免两种数据源混写） */
  function enterDemoMode() {
    setMode('demo')
    setAuthRequired(false)
    setServerProjects(null)
    setServerLogs([])
    setServerTrendPoints(null)
    setFilteredDocIds(undefined)
    const demoDocs = loadJSON<Doc[]>(DOCS_KEY, seedDocs())
    setDocs(demoDocs)
    setActiveDocId(demoDocs[0]?.id ?? null)
    showToast('后端不可用，已切换本地演示')
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
      const overviews = await Promise.all(sourceStats.map((stat) =>
        fetchOverview(stat.name, '24h').catch((error: unknown) => {
          // 单源总览失败不拖垮整个看板；但 401 必须上抛触发回锁屏
          if (error instanceof ApiError && error.needRelogin) throw error
          return null
        })))
      setServerProjects(sourceStats.map((stat, index) => adaptSourceToProject(stat, overviews[index])))
      setServerLogs(recentRecords.map(adaptRecentToLog))
      setServerTrendPoints(aggregateDailyTrend(countSeries, errSeries))
    } catch (error) {
      handleServerError(error)
    }
  }

  async function loadServerDocs() {
    try {
      const tree = await fetchDocTree()
      const serverDocs = flattenDocTree(tree)
      setDocs(serverDocs)
      setActiveDocId((current) => current === 'local' ? current : (serverDocs.some((doc) => doc.id === current) ? current : serverDocs[0]?.id ?? null))
      setFilteredDocIds(null)
    } catch (error) {
      handleServerError(error)
    }
  }

  async function refreshServerLogs() {
    try {
      const records = await fetchRecent(undefined, 200)
      setServerLogs(records.map(adaptRecentToLog))
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

  function activateTool(tool: ToolEntry) {
    if (tool.type === 'link') {
      window.open(tool.target, '_blank', 'noopener')
      return
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(tool.target).then(
        () => showToast(`已复制命令：${tool.target}`),
        () => showToast(`命令：${tool.target}`),
      )
    } else {
      showToast(`命令：${tool.target}`)
    }
  }

  function openProjectDetail(project: Project) {
    setDetailProjectId(project.id)
  }

  function addProject(draft: ProjectDraft) {
    const now = new Date()
    const project: Project = {
      id: `p-${Date.now()}`,
      name: draft.name,
      stack: draft.stack,
      status: draft.status,
      desc: draft.desc,
      todayRequests: 0,
      errors: 0,
      latency: 0,
      uptime: '—',
      lastDeploy: now,
      lastLogAt: now,
    }
    setProjects((current) => [...current, project])
    setLogs((current) => [{ id: `log-${Date.now()}`, ts: now, projectId: project.id, level: 'info', msg: '项目已登记，等待接入数据源' }, ...current])
    setProjectFormOpen(false)
    changeRoute('projects')
    showToast(`已登记项目「${draft.name}」`)
  }

  function refreshLogs() {
    const levels: LogEntry['level'][] = ['info', 'info', 'warn', 'error']
    const activeProjects = projects.filter((project) => project.status !== 'stopped')
    const nextLogs: LogEntry[] = []
    for (let index = 0; index < 4; index += 1) {
      const level = levels[Math.floor(Math.random() * levels.length)]
      const project = activeProjects[Math.floor(Math.random() * Math.max(activeProjects.length, 1))]
      if (!project) break
      const messages = LOG_POOL[level]
      nextLogs.push({
        id: `log-${Date.now()}-${index}`,
        ts: new Date(Date.now() - index * 1500),
        projectId: project.id,
        level,
        msg: messages[Math.floor(Math.random() * messages.length)],
      })
    }
    setLogs((current) => [...nextLogs, ...current].slice(0, 200))
    showToast('已获取最新日志')
  }

  /* ---------------- 文档：双模式分派 ---------------- */

  function createDoc() {
    if (isServerMode) {
      void serverCreateDoc()
      return
    }
    const doc: Doc = {
      id: `d-${Date.now()}`,
      title: '未命名文档',
      content: '# 未命名文档\n\n开始记录你的内容…',
      updatedAt: Date.now(),
    }
    setDocs((current) => {
      const next = [doc, ...current]
      saveJSON(DOCS_KEY, next)
      return next
    })
    setActiveDocId(doc.id)
    setDocPreview(false)
    setDocSaveState('已加载')
    showToast('已新建文档')
  }

  /** 服务端新建：路径由标题生成；同名冲突时自动追加 -2/-3 后缀（上限 20 次避免死循环） */
  async function serverCreateDoc() {
    const defaultContent = '# 未命名文档\n\n开始记录你的内容…'
    for (let attempt = 1; attempt <= 20; attempt++) {
      const path = attempt === 1 ? titleToPath('未命名文档') : titleToPath(`未命名文档-${attempt}`)
      try {
        await createDocFile(path, defaultContent)
        const doc: Doc = { id: path, title: pathToTitle(path), content: defaultContent, updatedAt: Date.now() }
        setDocs((current) => [doc, ...current])
        setActiveDocId(path)
        setDocPreview(false)
        setDocSaveState('已加载')
        setFilteredDocIds(null)
        showToast('已新建文档')
        return
      } catch (error) {
        if (error instanceof ApiError && error.apiCode === 40900) continue
        showToast(error instanceof ApiError ? error.message : '新建文档失败')
        return
      }
    }
    showToast('新建失败：同名文档过多，请换个标题')
  }

  function openDoc(id: string) {
    if (id === 'local') {
      if (localDoc) setActiveDocId('local')
      return
    }
    setActiveDocId(id)
    setDocPreview(false)
    setDocSaveState('已加载')
    if (isServerMode) void serverOpenDoc(id)
  }

  /** 服务端打开：列表只带元信息，内容在此懒加载（updatedAt>0 = 已缓存） */
  async function serverOpenDoc(docId: string) {
    const cached = docsRef.current.find((doc) => doc.id === docId)
    if (cached && cached.updatedAt > 0) return
    try {
      const file = await fetchDocFile(docId)
      setDocs((current) => current.map((doc) => doc.id === docId
        ? { ...doc, title: pathToTitle(file.name), content: file.content, updatedAt: Date.now() }
        : doc))
    } catch (error) {
      handleServerError(error)
    }
  }

  function updateDoc(id: string, patch: Partial<Doc>) {
    if (isServerMode) {
      serverUpdateDoc(id, patch)
      return
    }
    setDocs((current) => {
      const next = current.map((doc) => doc.id === id ? { ...doc, ...patch, updatedAt: Date.now() } : doc)
      saveJSON(DOCS_KEY, next)
      return next
    })
    setDocSaveState('已自动保存 ' + fmtClockSec(new Date()))
  }

  /** 服务端编辑：UI 即时更新 + 防抖落盘（标题变更同时触发 rename） */
  function serverUpdateDoc(docId: string, patch: Partial<Doc>) {
    setDocs((current) => current.map((doc) => doc.id === docId ? { ...doc, ...patch, updatedAt: Date.now() } : doc))
    setDocSaveState('保存中…')
    window.clearTimeout(serverDocSaveTimer.current)
    serverDocSaveTimer.current = window.setTimeout(() => { void persistServerDoc(docId) }, 900)
  }

  async function persistServerDoc(docId: string) {
    const doc = docsRef.current.find((candidate) => candidate.id === docId)
    if (!doc) return
    try {
      const nextPath = titleToPath(doc.title)
      if (nextPath !== docId) {
        await renameDocFile(docId, nextPath)
        setDocs((current) => current.map((candidate) => candidate.id === docId ? { ...candidate, id: nextPath } : candidate))
        setActiveDocId((current) => current === docId ? nextPath : current)
      }
      await saveDocFile(nextPath, doc.content)
      setDocs((current) => current.map((candidate) => candidate.id === nextPath ? { ...candidate, updatedAt: Date.now() } : candidate))
      setDocSaveState('已自动保存 ' + fmtClockSec(new Date()))
    } catch (error) {
      setDocSaveState('保存失败：' + (error instanceof ApiError ? error.message : '请重试'))
    }
  }

  function deleteDoc() {
    if (!activeDocId || activeDocId === 'local') return
    if (isServerMode) {
      void serverDeleteDoc(activeDocId)
      return
    }
    const doc = docs.find((candidate) => candidate.id === activeDocId)
    if (!doc) return
    setDocs((current) => {
      const next = current.filter((candidate) => candidate.id !== doc.id)
      saveJSON(DOCS_KEY, next)
      return next
    })
    setActiveDocId(null)
    setDocSaveState('')
    showToast(`已删除「${doc.title}」`)
  }

  async function serverDeleteDoc(docId: string) {
    const doc = docsRef.current.find((candidate) => candidate.id === docId)
    if (!doc) return
    try {
      await deleteDocFile(docId)
      setDocs((current) => current.filter((candidate) => candidate.id !== docId))
      setActiveDocId((current) => current === docId ? null : current)
      setDocSaveState('')
      showToast(`已删除「${doc.title}」`)
    } catch (error) {
      handleServerError(error)
    }
  }

  /** 文档搜索分派：服务端模式调 API（防抖），演示模式由 DocsPage 本地过滤 */
  function handleDocSearch(query: string) {
    if (!isServerMode) return
    window.clearTimeout(docSearchTimer.current)
    const keyword = query.trim()
    if (!keyword) {
      setFilteredDocIds(null)
      return
    }
    docSearchTimer.current = window.setTimeout(() => {
      void searchDocs(keyword)
        .then((hits) => setFilteredDocIds(hits.map((hit) => hit.path)))
        .catch(() => setFilteredDocIds([]))
    }, 300)
  }

  async function openLocalFile(file: File, handle?: LocalFileHandle | null) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      showToast('只支持 .md / .markdown / .txt 文件')
      return
    }
    if (localDoc?.dirty && !window.confirm(`「${localDoc.name}」有未保存的改动，继续打开会丢失，确定继续？`)) return
    try {
      const content = await file.text()
      setLocalDoc({ name: file.name, content, handle: handle ?? null, dirty: false, updatedAt: file.lastModified || Date.now(), size: file.size })
      setLocalSaveState('')
      setActiveDocId('local')
      setDocPreview(true)
    } catch {
      showToast('读取本地文件失败，请重试')
    }
  }

  function updateLocalContent(content: string) {
    setLocalDoc((current) => current ? { ...current, content, dirty: true } : current)
  }

  async function saveLocal() {
    if (!localDoc) return
    try {
      if (localDoc.handle) {
        const writable = await localDoc.handle.createWritable()
        await writable.write(localDoc.content)
        await writable.close()
        setLocalDoc({ ...localDoc, dirty: false, updatedAt: Date.now() })
        setLocalSaveState('已写回本地 ' + fmtClockSec(new Date()))
        showToast('已写回本地文件')
        return
      }
      const pickerWindow = window as Window & {
        showSaveFilePicker?: (options: unknown) => Promise<LocalFileHandle>
      }
      if (typeof pickerWindow.showSaveFilePicker === 'function') {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: localDoc.name,
          types: [{ description: 'Markdown / 文本', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(localDoc.content)
        await writable.close()
        setLocalDoc({ ...localDoc, handle, dirty: false, updatedAt: Date.now() })
        setLocalSaveState('已另存为本地文件 ' + fmtClockSec(new Date()))
        showToast('已保存到本地文件')
        return
      }
      const blob = new Blob([localDoc.content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = localDoc.name
      link.click()
      URL.revokeObjectURL(url)
      setLocalDoc({ ...localDoc, dirty: false, updatedAt: Date.now() })
      setLocalSaveState('已下载修改后的文件')
      showToast('当前浏览器不支持写回，已下载修改后的文件')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showToast('写入本地文件失败，请重试或另存为')
    }
  }

  function closeLocal() {
    setLocalDoc(null)
    setActiveDocId(null)
    showToast('已关闭本地文件')
  }

  function runExport(scope: 'dashboard' | 'projects' | 'logs', format: 'csv' | 'json'): string {
    const exportProjects = displayProjects
    const exportLogs = displayLogs
    let head: string[]
    let rows: Array<Array<string | number>>
    if (scope === 'projects') {
      head = ['项目', '技术栈', '状态', '今日请求', '错误数', '平均响应(ms)', '最近部署']
      rows = exportProjects.map((project) => [project.name, project.stack, STATUS_META[project.status].label, project.todayRequests, project.errors, project.todayRequests > 0 ? project.latency : '', fmtDay(project.lastDeploy)])
    } else if (scope === 'logs') {
      head = ['时间', '项目', '级别', '内容']
      rows = exportLogs.slice(0, 200).map((entry) => [fmtStamp(entry.ts), exportProjects.find((project) => project.id === entry.projectId)?.name ?? '', entry.level.toUpperCase(), entry.msg])
    } else {
      const requests = exportProjects.reduce((sum, project) => sum + project.todayRequests, 0)
      const errors = exportProjects.reduce((sum, project) => sum + project.errors, 0)
      const latencyBase = exportProjects.reduce((sum, project) => sum + project.latency * project.todayRequests, 0)
      head = ['指标', '数值']
      rows = [
        ['登记项目', exportProjects.length],
        ['活跃项目', exportProjects.filter((project) => project.status === 'running' || project.status === 'developing').length],
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
      link.download = `devconsole-${scope}-${fmtDay(new Date())}.${format}`
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
    const results: SearchResult[] = [
      ...displayProjects.map((project) => ({
        kind: '项目',
        name: project.name,
        extra: project.stack,
        run: () => { changeRoute('projects'); setDetailProjectId(project.id) },
      })),
      ...tools.map((tool) => ({
        kind: '工具',
        name: tool.name,
        extra: tool.desc || (tool.type === 'link' ? '网页链接' : '本地命令'),
        run: () => activateTool(tool),
      })),
      ...(localDoc ? [{ kind: '文档', name: localDoc.name, extra: '本地文件', run: () => { changeRoute('docs'); setActiveDocId('local') } }] : []),
      ...docs.map((doc) => ({
        kind: '文档',
        name: doc.title,
        extra: '在线文档',
        run: () => { changeRoute('docs'); openDoc(doc.id) },
      })),
    ]
    return results.filter((item) => `${item.name} ${item.extra}`.toLowerCase().includes(keyword)).slice(0, 8)
  }, [docs, localDoc, displayProjects, searchQuery, tools])

  function runSearch(index: number) {
    const result = searchResults[index]
    setSearchOpen(false)
    setSearchQuery('')
    if (result) result.run()
  }

  function lockNow() {
    // 服务端模式同时注销会话（内存令牌清空）；logout 无令牌时是空操作，演示模式不受影响
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
            <span className="brand-mark" aria-hidden="true">DC</span>
            <span className="brand-text">
              <strong className="brand-title">个人开发控制台</strong>
              <span className="brand-sub">数据监控 · 开发工具</span>
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
            <div className="nav-group">
              <span className="nav-group-label">工具</span>
              <button className="nav-item" type="button" aria-current={route === 'docs' ? 'page' : undefined} title="在线文档" onClick={() => changeRoute('docs')}>
                <Icon name="docs" /><span className="nav-label">在线文档</span>
              </button>
              {tools.length > 0 && (
                <div className="nav-group">
                  <span className="nav-group-label">我的工具</span>
                  {tools.map((tool) => (
                    <button className="nav-item" type="button" title={tool.desc || tool.name} key={tool.id} onClick={() => activateTool(tool)}>
                      <Icon name="tool" /><span className="nav-label">{tool.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="nav-item" type="button" onClick={() => setToolFormOpen(true)}>
                <Icon name="plus" /><span className="nav-label">集成工具</span>
              </button>
            </div>
          </nav>
          <div className="sidebar-foot">
            <button className="collapse-btn" id="sidebar-collapse" type="button" aria-expanded={!collapsed} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => setCollapsed(!collapsed)}>
              <Icon name={collapsed ? 'expand' : 'collapse'} className="icon-collapse" />
              <span className="nav-label">{collapsed ? '展开侧栏' : '收起侧栏'}</span>
            </button>
            <button className="collapse-btn lock-btn" id="lock-button" type="button" aria-label="锁屏" onClick={lockNow}>
              <Icon name="lock" /><span className="nav-label">锁屏</span>
            </button>
          </div>
        </aside>
        {mobileOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />}
        <div className="workspace">
          <header className="topbar">
            <button className="icon-btn menu-btn" type="button" aria-expanded={mobileOpen} aria-controls="sidebar" aria-label="打开导航" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" /></button>
            <div className="top-heading">
              <strong className="top-title">{routeMeta.title}</strong>
              <span className="top-sub">{topSub}</span>
            </div>
            <div className="search-wrap" ref={searchWrapRef}>
              <div className="global-search">
                <span className="search-glyph" aria-hidden="true"><Icon name="search" size={18} /></span>
                <input
                  className="input global-input"
                  type="search"
                  value={searchQuery}
                  placeholder="搜索项目、工具或文档"
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
                  {searchResults.length === 0 ? <p className="search-none">没有匹配的项目、工具或文档</p> : searchResults.map((item, index) => (
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
            <div className="account" title="当前 AI：Command Code · AI 配置页后续开放" aria-label="当前 AI：Command Code">
              <span className="avatar ai-avatar" aria-hidden="true">AI</span>
              <span className="account-text">
                <strong className="account-name">Command Code</strong>
                <span className="account-role">当前 AI · 编码助手</span>
              </span>
            </div>
          </header>
          <main className="main" id="main-content" tabIndex={-1}>
            {route === 'dashboard' && (
              <DashboardPage
                projects={displayProjects}
                range={range}
                setRange={setRange}
                onExport={() => setExportScope('dashboard')}
                onProjectDetail={openProjectDetail}
                trendPoints={displayTrendPoints}
              />
            )}
            {route === 'projects' && (
              <ProjectsPage
                projects={displayProjects}
                logs={displayLogs}
                focusProjectId={focusProjectId}
                onFocusConsumed={() => setFocusProjectId(null)}
                onAddProject={isServerMode ? undefined : () => setProjectFormOpen(true)}
                onProjectDetail={openProjectDetail}
                onProjectLogs={(projectId) => setFocusProjectId(projectId)}
                onExport={() => setExportScope('projects')}
                onRefreshLogs={isServerMode ? () => void refreshServerLogs() : refreshLogs}
              />
            )}
            {route === 'docs' && (
              <DocsPage
                docs={docs}
                activeDocId={activeDocId}
                localDoc={localDoc}
                localSaveState={localSaveState}
                docPreview={docPreview}
                listCollapsed={listCollapsed}
                saveState={docSaveState}
                onOpenDoc={openDoc}
                onNewDoc={createDoc}
                onDeleteDoc={deleteDoc}
                onUpdateDoc={updateDoc}
                onUpdateLocalContent={updateLocalContent}
                onOpenLocalFile={(file, handle) => void openLocalFile(file, handle)}
                onSaveLocal={() => void saveLocal()}
                onCloseLocal={closeLocal}
                onTogglePreview={() => setDocPreview(!docPreview)}
                onToggleList={() => setListCollapsed(!listCollapsed)}
                onSearchDocs={handleDocSearch}
                filteredDocIds={isServerMode ? filteredDocIds : undefined}
              />
            )}
          </main>
        </div>
      </div>

      <ProjectDetailDialog
        project={detailProject}
        logs={displayLogs}
        onClose={() => setDetailProjectId(null)}
        onShowLogs={(projectId) => { setDetailProjectId(null); changeRoute('projects'); setFocusProjectId(projectId) }}
      />
      <ProjectFormDialog open={projectFormOpen} onClose={() => setProjectFormOpen(false)} onSubmit={addProject} />
      <ToolFormDialog
        open={toolFormOpen}
        tools={tools}
        onClose={() => setToolFormOpen(false)}
        onSubmit={(draft) => {
          setTools((current) => [...current, { ...draft, id: `t-${Date.now()}` }])
          setToolFormOpen(false)
          showToast(`已集成工具「${draft.name}」`)
        }}
        onDelete={(tool) => { setTools((current) => current.filter((candidate) => candidate.id !== tool.id)); showToast(`已移除工具「${tool.name}」`) }}
      />
      <ExportDialog open={exportScope !== null} defaultScope={exportScope ?? 'dashboard'} onClose={() => setExportScope(null)} onRun={runExport} />
      <LockScreen
        open={locked}
        onUnlock={unlock}
        serverLogin={isServerMode && authRequired ? handleServerLogin : undefined}
      />
      {toastMessage && <div className="toast" role="status" aria-live="polite">{toastMessage}</div>}
    </>
  )
}
