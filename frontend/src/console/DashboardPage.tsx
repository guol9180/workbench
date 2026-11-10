/** 数据看板：示例项目指标、请求/错误走势、状态分布与项目健康明细。 */
import { useMemo, useState } from 'react'
import TrendChart, { buildDemoPoints } from './TrendChart'
import type { TrendPoint } from './TrendChart'
import { errorRate, fmtClock, fmtNum, fmtStamp, fmtWan, STATUS_META } from './data'
import type { Project, StatusKey } from './data'
import Icon from './Icon'

const RANGES = [7, 14, 30]

function projectStatus(project: Project) {
  return STATUS_META[project.status]
}

export default function DashboardPage({
  projects,
  range,
  setRange,
  onExport,
  onProjectDetail,
  trendPoints,
}: {
  projects: Project[]
  range: number
  setRange: (range: number) => void
  onExport: () => void
  onProjectDetail: (project: Project, trigger?: HTMLElement) => void
  /** 服务端模式的真实走势；缺省 = 演示序列（参考稿公式） */
  trendPoints?: TrendPoint[] | null
}) {
  const [healthSearch, setHealthSearch] = useState('')
  const [healthStatus, setHealthStatus] = useState<'all' | StatusKey>('all')

  const metrics = useMemo(() => {
    const requests = projects.reduce((sum, project) => sum + project.todayRequests, 0)
    const errors = projects.reduce((sum, project) => sum + project.errors, 0)
    const latencyBase = projects.reduce((sum, project) => sum + project.latency * project.todayRequests, 0)
    const latency = requests > 0 ? Math.round(latencyBase / requests) : 0
    const counts: Record<StatusKey, number> = { running: 0, developing: 0, error: 0, stopped: 0 }
    projects.forEach((project) => { counts[project.status] += 1 })
    return { total: projects.length, requests, errors, latency, counts }
  }, [projects])

  const activeProjects = metrics.counts.running + metrics.counts.developing
  const chartPoints = trendPoints ?? buildDemoPoints(range)
  // 汇总文案直接来自走势序列本身（而非另算口径），与参考稿「合计/日均」一致
  const trendSummary = useMemo(() => {
    const totalRequests = chartPoints.reduce((sum, point) => sum + point.requests, 0)
    return {
      sum: totalRequests.toFixed(1),
      dailyAverage: (totalRequests / range).toFixed(1),
    }
  }, [range, trendPoints])
  const healthRows = projects.filter((project) => {
    const keyword = healthSearch.trim().toLowerCase()
    const matchesKeyword = !keyword || `${project.name} ${project.stack}`.toLowerCase().includes(keyword)
    const matchesStatus = healthStatus === 'all' || project.status === healthStatus
    return matchesKeyword && matchesStatus
  })
  const statuses: Array<{ key: StatusKey; label: string; fill: string }> = [
    { key: 'running', label: '运行中', fill: STATUS_META.running.fill },
    { key: 'developing', label: '开发中', fill: STATUS_META.developing.fill },
    { key: 'error', label: '异常', fill: STATUS_META.error.fill },
    { key: 'stopped', label: '已停止', fill: STATUS_META.stopped.fill },
  ]
  const now = new Date()

  return (
    <section className="page" aria-labelledby="dashboard-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="dashboard-title">数据看板</h1>
          <p className="page-desc">个人开发项目的运行总览 · 数据为本地示例</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => onExport()}>
            <Icon name="download" size={17} />导出看板数据
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <p className="metric-label">活跃项目</p>
          <strong className="metric-value">{activeProjects}</strong>
          <p className="metric-foot"><span>共登记 {metrics.total} 个项目 · {metrics.counts.error} 个异常</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">今日请求</p>
          <strong className="metric-value">{fmtWan(metrics.requests)}</strong>
          <p className="metric-foot"><span className="trend-tag up">+6.2%</span><span>对比昨日</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">今日错误</p>
          <strong className="metric-value">{fmtNum(metrics.errors)}</strong>
          <p className="metric-foot"><span>错误率 {errorRate(metrics.errors, metrics.requests)}</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">平均响应</p>
          <strong className="metric-value">{metrics.requests > 0 ? metrics.latency + 'ms' : '—'}</strong>
          <p className="metric-foot"><span className="trend-tag flat">-8ms</span><span>对比昨日</span></p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="trend-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="trend-title">请求与错误走势</h2>
              <p className="panel-sub">近 {range} 日合计 {trendSummary.sum} 万次请求，日均 {trendSummary.dailyAverage} 万次</p>
            </div>
            <div className="range-group" role="group" aria-label="时间范围">
              {RANGES.map((days) => (
                <button
                  key={days}
                  className="range-btn"
                  type="button"
                  aria-pressed={range === days}
                  onClick={() => setRange(days)}
                >近{days}天</button>
              ))}
            </div>
          </div>
          <TrendChart days={range} points={chartPoints} />
          <div className="chart-legend">
            <span><span className="legend-dot" style={{ background: '#0f766e' }} />日请求数（万次）</span>
            <span><span className="legend-dot" style={{ background: '#b02a37' }} />日错误数（百次）</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="status-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="status-title">项目状态分布</h2>
              <p className="panel-sub">按当前登记项目统计</p>
            </div>
          </div>
          <div className="status-list">
            {statuses.map((status) => {
              const count = metrics.counts[status.key]
              const width = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0
              return (
                <div className="status-row" key={status.key}>
                  <span className="status-label">{status.label}</span>
                  <span className="status-track"><span className="status-fill" style={{ width: width + '%', background: status.fill }} /></span>
                  <span className="status-count">{count} 个</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="health-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="health-title">项目健康明细</h2>
            <p className="panel-sub">共 {projects.length} 个项目，当前显示 {healthRows.length} 个</p>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <div className="search-field" style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
            <span className="search-glyph-static" aria-hidden="true"><Icon name="search" size={16} /></span>
            <input
              className="input"
              type="search"
              value={healthSearch}
              placeholder="搜索项目 / 技术栈"
              aria-label="搜索项目健康明细"
              onChange={(event) => setHealthSearch(event.target.value)}
            />
          </div>
          <div className="toolbar" role="group" aria-label="按状态筛选" style={{ marginTop: 0 }}>
            {(['all', 'running', 'developing', 'error', 'stopped'] as const).map((key) => (
              <button
                key={key}
                className={'chip' + (healthStatus === key ? ' is-active' : '')}
                type="button"
                aria-pressed={healthStatus === key}
                onClick={() => setHealthStatus(key)}
              >
                {key === 'all' ? '全部' : STATUS_META[key].label}
              </button>
            ))}
          </div>
        </div>

        {healthRows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">没有匹配的项目</p>
            <p className="empty-desc">换个关键词或清除筛选条件试试。</p>
            <button className="btn btn-ghost" type="button" onClick={() => { setHealthSearch(''); setHealthStatus('all') }}>清除筛选</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>项目</th><th>状态</th><th>今日请求</th><th>错误数</th><th>平均响应</th><th>最近日志</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.map((project) => {
                  const meta = projectStatus(project)
                  const sameDay = project.lastLogAt.toDateString() === now.toDateString()
                  return (
                    <tr key={project.id}>
                      <td><div style={{ fontWeight: 600 }}>{project.name}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{project.stack}</div></td>
                      <td><span className={'status-tag ' + meta.cls}>{meta.label}</span></td>
                      <td>{fmtNum(project.todayRequests)}</td>
                      <td>{fmtNum(project.errors)}</td>
                      <td>{project.todayRequests > 0 ? project.latency + 'ms' : '—'}</td>
                      <td>{sameDay ? fmtClock(project.lastLogAt) : fmtStamp(project.lastLogAt)}</td>
                      <td><button className="btn-text" type="button" onClick={(event) => onProjectDetail(project, event.currentTarget)}>详情</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
