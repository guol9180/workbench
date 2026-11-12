/** 项目监控：监测源卡片 + 运行日志，数据全部来自服务端。 */
import { useEffect, useRef, useState } from 'react'
import { errorRate, fmtClockSec, fmtDay, fmtStamp, fmtWan, LEVEL_META, STATUS_META } from './data'
import type { LogEntry, Project } from './data'
import Icon from './Icon'

export default function ProjectsPage({
  projects,
  logs,
  focusProjectId,
  onFocusConsumed,
  onProjectDetail,
  onProjectLogs,
  onExport,
  onRefreshLogs,
}: {
  projects: Project[]
  logs: LogEntry[]
  focusProjectId: string | null
  onFocusConsumed: () => void
  onProjectDetail: (project: Project, trigger?: HTMLElement) => void
  onProjectLogs: (projectId: string) => void
  onExport: (trigger?: HTMLElement) => void
  onRefreshLogs: () => void
}) {
  const [logProject, setLogProject] = useState('all')
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [logSearch, setLogSearch] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const logPanelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!focusProjectId) return
    setLogProject(focusProjectId)
    onFocusConsumed()
    requestAnimationFrame(() => logPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [focusProjectId, onFocusConsumed])

  const projectById = (id: string) => projects.find((project) => project.id === id)
  const filteredLogs = logs.filter((entry) => {
    const project = projectById(entry.projectId)
    const hitProject = logProject === 'all' || entry.projectId === logProject
    const hitLevel = logLevel === 'all' || entry.level === logLevel
    const keyword = logSearch.trim().toLowerCase()
    const hitKeyword = !keyword || `${entry.msg} ${project?.name ?? ''}`.toLowerCase().includes(keyword)
    return hitProject && hitLevel && hitKeyword
  })

  const refresh = () => {
    onRefreshLogs()
    setLastRefresh(new Date())
  }

  return (
    <section className="page" aria-labelledby="projects-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="projects-title">项目监控</h1>
          <p className="page-desc">集中查看监测源的数据与运行日志</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => onExport()}><Icon name="download" size={17} />导出数据</button>
        </div>
      </div>

      <section className="panel" aria-labelledby="project-list-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="project-list-title">项目列表</h2>
            <p className="panel-sub">共 {projects.length} 个监测源</p>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">还没有监测源</p>
            <p className="empty-desc">数据源由流量自动发现：任意系统向 /api/monitor/ingest 上报后出现在这里。</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => {
              const meta = STATUS_META[project.status]
              return (
                <article className="project-card" key={project.id}>
                  <div className="project-head">
                    <div style={{ minWidth: 0 }}>
                      <h3 className="project-name">{project.name}</h3>
                      <span className="project-stack">{project.stack}</span>
                    </div>
                    <span className={'status-tag ' + meta.cls}>{meta.label}</span>
                  </div>
                  <div className="project-stats">
                    <span className="project-stat"><b>{fmtWan(project.todayRequests)}</b><span>今日请求</span></span>
                    <span className="project-stat"><b>{errorRate(project.errors, project.todayRequests)}</b><span>错误率</span></span>
                    <span className="project-stat"><b>{project.todayRequests > 0 ? project.latency + 'ms' : '—'}</b><span>平均响应</span></span>
                  </div>
                  <div className="project-foot">
                    <span>最近活跃 {fmtDay(project.lastLogAt)}</span>
                    <span className="project-actions">
                      <button className="btn-text" type="button" onClick={(event) => onProjectDetail(project, event.currentTarget)}>详情</button>
                      <button className="btn-text" type="button" onClick={() => { setLogProject(project.id); onProjectLogs(project.id) }}>日志</button>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel" id="log-panel" aria-labelledby="log-title" ref={logPanelRef}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="log-title">运行日志</h2>
            <p className="panel-sub">共 {logs.length} 条日志，当前显示 {filteredLogs.length} 条{lastRefresh ? ' · 最近刷新 ' + fmtClockSec(lastRefresh) : ''}</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={refresh}><Icon name="refresh" size={16} />刷新日志</button>
        </div>
        <div className="toolbar">
          <select className="input" aria-label="按项目筛选日志" style={{ width: 'auto', minWidth: 160 }} value={logProject} onChange={(event) => setLogProject(event.target.value)}>
            <option value="all">全部项目</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <div className="toolbar" role="group" aria-label="按日志级别筛选" style={{ marginTop: 0 }}>
            {(['all', 'info', 'warn', 'error'] as const).map((level) => (
              <button key={level} className={'chip' + (logLevel === level ? ' is-active' : '')} type="button" aria-pressed={logLevel === level} onClick={() => setLogLevel(level)}>
                {level === 'all' ? '全部' : LEVEL_META[level].label}
              </button>
            ))}
          </div>
          <div className="search-field" style={{ flex: 1, minWidth: 180, maxWidth: 300 }}>
            <span className="search-glyph-static" aria-hidden="true"><Icon name="search" size={16} /></span>
            <input className="input" type="search" value={logSearch} placeholder="搜索日志内容" aria-label="搜索日志内容" onChange={(event) => setLogSearch(event.target.value)} />
          </div>
        </div>
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">没有匹配的日志</p>
            <p className="empty-desc">调整项目、级别或关键词后再试。</p>
          </div>
        ) : (
          <div className="log-scroll" aria-label="日志列表">
            {filteredLogs.map((entry) => {
              const project = projectById(entry.projectId)
              const meta = LEVEL_META[entry.level]
              return (
                <div className="log-row" key={entry.id}>
                  <span className="log-time">{fmtStamp(entry.ts)}</span>
                  <span className={'level-tag ' + meta.cls}>{meta.label}</span>
                  <span className="log-main"><span className="log-project">{project?.name ?? '未知项目'}</span><span className="log-msg">{entry.msg}</span></span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
