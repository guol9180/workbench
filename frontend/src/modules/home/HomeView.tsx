/**
 * 数据看板：控制台门面。指标、走势、源状态与健康明细都来自真实监测接口，
 * 不再使用旧稿里的项目/日志示例数据。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PulseChart from '../../components/PulseChart'
import type { ChartPoint } from '../../components/PulseChart'
import { Button, EmptyState, Icon, PageHeader, Panel, Segmented } from '../../components/ui/ui'
import { fmtClock, fmtHM, fmtInt, fmtMs, fmtRate } from '../../utils/format'
import { fillSeries, minutesToMs, monitorApi, RANGE_LABEL } from '../monitor/api'
import type { OverviewData, RangeKey, SourceStat } from '../monitor/api'
import { usePolling } from '../monitor/useMonitor'
import './home.css'

interface HealthRow {
  name: string
  lastSeenMinute: number
  win: RangeKey
  overview: OverviewData
}

const RANGES: RangeKey[] = ['1h', '6h', '24h', '7d']

function isGithub(source: string): boolean {
  return source.startsWith('github/')
}

function shortSource(source: string): string {
  return source.startsWith('github/') ? source.split('/').slice(-1)[0] : source
}

function exportCsv(rows: HealthRow[]): void {
  const header = ['源', '窗口', '请求', '错误数', '错误率', '平均延迟(ms)', 'P95(ms)', '最近活跃']
  const lines = [
    header,
    ...rows.map((row) => [
      row.name,
      RANGE_LABEL[row.win],
      row.overview.count,
      row.overview.errCount,
      (row.overview.errRate * 100).toFixed(2) + '%',
      row.overview.avgMs,
      row.overview.p95Ms,
      fmtHM(minutesToMs(row.lastSeenMinute)),
    ]),
  ]
  const csv = lines.map((line) => line.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'workbench-dashboard.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function HomeView() {
  const navigate = useNavigate()
  const sourcesQuery = usePolling(monitorApi.sources, 'home-sources', { intervalMs: 15_000 })
  const sources: SourceStat[] = sourcesQuery.data ?? []
  const sourceKey = sources.map((source) => source.name + ':' + source.lastSeenMinute).join('|')
  const [rows, setRows] = useState<HealthRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<RangeKey>('24h')

  useEffect(() => {
    let alive = true
    async function loadRows() {
      if (sources.length === 0) {
        if (alive) {
          setRows([])
          setRowsLoading(false)
        }
        return
      }
      const nextRows = await Promise.all(
        sources.map(async (source): Promise<HealthRow | null> => {
          const win: RangeKey = isGithub(source.name) ? '7d' : '24h'
          try {
            return {
              name: source.name,
              lastSeenMinute: source.lastSeenMinute,
              win,
              overview: await monitorApi.overview(source.name, win),
            }
          } catch {
            return null
          }
        }),
      )
      if (!alive) return
      setRows(nextRows.filter((row): row is HealthRow => row !== null))
      setRowsLoading(false)
    }
    void loadRows()
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadRows()
    }, 15_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
    // sourceKey 把源集合与最近活跃变化作为刷新信号
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  const workbench = rows.find((row) => row.name === 'workbench') ?? null
  const countQuery = usePolling(() => monitorApi.series('workbench', 'count', range), 'home-count|' + range, {
    intervalMs: 20_000,
  })
  const errQuery = usePolling(() => monitorApi.series('workbench', 'errCount', range), 'home-err|' + range, {
    intervalMs: 20_000,
  })

  const countPoints: ChartPoint[] = useMemo(
    () =>
      fillSeries(countQuery.data ?? [], range).map((point) => ({
        timestamp: minutesToMs(point.bucketEpoch),
        value: point.value,
      })),
    [countQuery.data, range],
  )
  const errPoints: ChartPoint[] = useMemo(
    () =>
      fillSeries(errQuery.data ?? [], range).map((point) => ({
        timestamp: minutesToMs(point.bucketEpoch),
        value: point.value,
      })),
    [errQuery.data, range],
  )
  const totalCount = countPoints.reduce((sum, point) => sum + point.value, 0)
  const githubCount = sources.filter((source) => isGithub(source.name)).length
  const badRows = rows.filter((row) => row.overview.errRate > 0.01)
  const healthyRows = rows.filter((row) => row.overview.errRate <= 0.01)
  const filteredRows = rows.filter((row) => !query.trim() || row.name.toLowerCase().includes(query.trim().toLowerCase()))
  const distribution = [
    { label: '健康', count: healthyRows.length, color: 'var(--ok)' },
    { label: '错误率偏高', count: badRows.length, color: 'var(--danger)' },
    { label: 'GitHub 项目', count: githubCount, color: 'var(--accent)' },
  ]
  const totalSources = Math.max(rows.length, 1)
  const firstError = sourcesQuery.error ?? countQuery.error ?? errQuery.error

  return (
    <div className="home dash">
      <PageHeader
        title="数据看板"
        desc="流量、错误与项目状态的总览；数据来自 workbench 监测接口，每 15 秒刷新。"
      >
        <Button variant="ghost" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
          <Icon name="download" size={16} />
          导出看板数据
        </Button>
      </PageHeader>

      {firstError && (
        <div className="dash-inline-error" role="alert">
          监控接口暂不可达：{firstError}
          <Button size="sm" onClick={() => { sourcesQuery.reload(); countQuery.reload(); errQuery.reload() }}>重试</Button>
        </div>
      )}

      <section className="metric-grid" aria-label="关键指标">
        <article className="metric-card">
          <p className="metric-label">监测源</p>
          <strong className="metric-value">{sources.length}</strong>
          <p className="metric-foot">
            <span>{githubCount} 个 GitHub 项目</span>
            <span>{sources.length - githubCount} 个接口源</span>
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">近 {RANGE_LABEL[range]}请求</p>
          <strong className="metric-value">{countPoints.length > 0 ? fmtInt(totalCount) : '—'}</strong>
          <p className="metric-foot"><span>workbench 自监测</span></p>
        </article>
        <article className="metric-card">
          <p className="metric-label">错误率</p>
          <strong className="metric-value" style={workbench && workbench.overview.errRate > 0.01 ? { color: 'var(--danger)' } : undefined}>
            {workbench ? fmtRate(workbench.overview.errRate) : '—'}
          </strong>
          <p className="metric-foot"><span>{workbench ? fmtInt(workbench.overview.errCount) + ' 次错误' : '等待数据'}</span></p>
        </article>
        <article className="metric-card">
          <p className="metric-label">平均响应</p>
          <strong className="metric-value">{workbench ? fmtMs(workbench.overview.avgMs) : '—'}</strong>
          <p className="metric-foot"><span>{workbench ? 'P95 ' + fmtMs(workbench.overview.p95Ms) : '等待数据'}</span></p>
        </article>
      </section>

      <div className="dashboard-grid">
        <Panel className="dash-chart-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">请求与错误走势</h2>
              <p className="panel-sub">近 {RANGE_LABEL[range]} · 合计 {countPoints.length > 0 ? fmtInt(totalCount) : '—'} 次请求</p>
            </div>
            <Segmented
              options={RANGES.map((rangeKey) => ({ value: rangeKey, label: rangeKey }))}
              value={range}
              onChange={setRange}
              ariaLabel="走势时间范围"
            />
          </div>
          <PulseChart
            points={countPoints}
            overlayPoints={errPoints}
            height={280}
            formatValue={fmtInt}
            formatTime={fmtHM}
            emptyText="还没有流量。调用任意 /api 接口后，这里会开始记录。"
          />
          <div className="chart-legend">
            <span><i className="legend-dot" style={{ background: 'var(--accent)' }} />请求数</span>
            <span><i className="legend-dot" style={{ background: 'var(--danger)' }} />错误数</span>
          </div>
        </Panel>

        <Panel className="dash-status-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">源状态分布</h2>
              <p className="panel-sub">按最近 24 小时的错误率统计</p>
            </div>
          </div>
          <div className="status-list">
            {distribution.map((item) => (
              <div className="status-row" key={item.label}>
                <span className="status-label">{item.label}</span>
                <span className="status-track">
                  <i className="status-fill" style={{ width: (item.count / totalSources) * 100 + '%', background: item.color }} />
                </span>
                <span className="status-count">{item.count}</span>
              </div>
            ))}
          </div>
          <div className="dash-status-foot">
            <span>最近刷新</span>
            <span>{sourcesQuery.updatedAt ? fmtClock(sourcesQuery.updatedAt) : '—'}</span>
          </div>
        </Panel>
      </div>

      <Panel className="dash-health-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">源健康明细</h2>
            <p className="panel-sub">共 {rows.length} 个源{rowsLoading ? ' · 正在刷新' : ''}</p>
          </div>
          <label className="search-field dash-search">
            <span className="search-glyph-static" aria-hidden="true"><Icon name="search" size={16} /></span>
            <input
              className="input"
              type="search"
              value={query}
              placeholder="搜索源名称"
              aria-label="搜索源名称"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState>还没有监测到源。启动后端或调用任意接口后，这里会出现健康明细。</EmptyState>
        ) : filteredRows.length === 0 ? (
          <EmptyState>没有匹配的源，换个关键词再试。</EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>源</th>
                  <th>状态</th>
                  <th>窗口</th>
                  <th className="num">请求</th>
                  <th className="num">错误率</th>
                  <th className="num">平均延迟</th>
                  <th>最近活跃</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isBad = row.overview.errRate > 0.01
                  return (
                    <tr key={row.name}>
                      <td>
                        <span className="dash-source-name">{row.name}</span>
                        <span className="dash-source-short">{shortSource(row.name)}</span>
                      </td>
                      <td><span className={'status-tag ' + (isBad ? 'status-danger' : 'status-success')}>{isBad ? '需关注' : '正常'}</span></td>
                      <td className="dash-mono">{RANGE_LABEL[row.win]}</td>
                      <td className="num dash-mono">{fmtInt(row.overview.count)}</td>
                      <td className={'num dash-mono' + (isBad ? ' is-bad' : '')}>{fmtRate(row.overview.errRate)}</td>
                      <td className="num dash-mono">{fmtMs(row.overview.avgMs)}</td>
                      <td className="dash-mono">{fmtHM(minutesToMs(row.lastSeenMinute))}</td>
                      <td>
                        <button
                          className="btn-text"
                          type="button"
                          onClick={() => navigate(isGithub(row.name) ? '/sources' : '/monitor')}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
