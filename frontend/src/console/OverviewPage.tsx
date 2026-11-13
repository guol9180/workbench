/** 总览：三类观测对象的健康快照与异常汇总。 */
import { useEffect, useMemo, useState } from 'react'
import type { RouteKey, StatusKey } from './data'
import { STATUS_META, errorRate, fmtAgo, fmtWan } from './data'
import {
  fetchOverview,
  fetchProbeTargets,
  fetchRecent,
  fetchSourceConfigs,
  fetchSources,
} from './api'
import type { Overview, ProbeTargetView, RecentRecord, SourceConfigView, SourceStat } from './api'
import Icon from './Icon'
import EmptyState from './EmptyState'

interface HealthRow {
  key: string
  name: string
  kind: string
  status: StatusKey
  summary: string
  lastSeen: string
  route: RouteKey
}

const TRAFFIC_PREFIXES = ['probe/', 'github/', 'snapshot/']
/** 本机自监测来源：只要控制台在用就一直存在，不算「已接入的观测对象」 */
const SELF_SOURCE = 'workbench'

function isTrafficSource(name: string): boolean {
  return !TRAFFIC_PREFIXES.some((prefix) => name.startsWith(prefix))
}

export default function OverviewPage({ onNavigate }: { onNavigate: (route: RouteKey) => void }) {
  const [sources, setSources] = useState<SourceStat[]>([])
  const [overviews, setOverviews] = useState<Record<string, Overview | null>>({})
  const [recents, setRecents] = useState<RecentRecord[]>([])
  const [configs, setConfigs] = useState<SourceConfigView[]>([])
  const [probes, setProbes] = useState<ProbeTargetView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [sourceStats, recentRecords, sourceConfigs, probeTargets] = await Promise.all([
        fetchSources(),
        fetchRecent(undefined, 500),
        fetchSourceConfigs(),
        fetchProbeTargets(),
      ])
      const entries = await Promise.all(sourceStats.map(async (stat) => {
        const overview = await fetchOverview(stat.name, '24h').catch(() => null)
        return [stat.name, overview] as const
      }))
      setSources(sourceStats)
      setRecents(recentRecords)
      setConfigs(sourceConfigs)
      setProbes(probeTargets)
      setOverviews(Object.fromEntries(entries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const trafficSources = sources.filter((source) => isTrafficSource(source.name))
  const externalTrafficSources = trafficSources.filter((source) => source.name !== SELF_SOURCE)
  /** 冷启动判定只看真正接入的对象；否则自监测流量会让空状态永远不出现 */
  const hasObservedObjects = externalTrafficSources.length > 0 || probes.length > 0 || configs.length > 0

  const latestProbeRecord = useMemo(() => {
    const latest = new Map<string, RecentRecord>()
    for (const record of recents) {
      if (!record.source.startsWith('probe/')) continue
      const current = latest.get(record.source)
      if (!current || record.minute > current.minute) latest.set(record.source, record)
    }
    return latest
  }, [recents])

  const rows = useMemo<HealthRow[]>(() => {
    const trafficRows = trafficSources.map((source) => {
      const overview = overviews[source.name]
      const count = overview?.count ?? 0
      const errors = overview?.errCount ?? 0
      const status: StatusKey = count === 0 ? 'stopped' : (errors / count) >= 0.01 ? 'error' : 'running'
      return {
        key: `traffic-${source.name}`,
        name: source.name,
        kind: '自部署服务',
        status,
        summary: count > 0
          ? `24h ${fmtWan(count)} 次 · 错误率 ${errorRate(errors, count)} · 平均 ${Math.round(overview?.avgMs ?? 0)}ms`
          : '24h 无流量',
        lastSeen: fmtAgo(source.lastSeenMinute * 60_000),
        route: 'services' as RouteKey,
      }
    })

    const probeRows = probes.map((target) => {
      const source = `probe/${target.name}`
      const overview = overviews[source]
      const latest = latestProbeRecord.get(source)
      const status: StatusKey = !target.enabled
        ? 'stopped'
        : !latest
          ? 'idle'
          : latest.errCount > 0 ? 'error' : 'running'
      const count = overview?.count ?? 0
      const errors = overview?.errCount ?? 0
      const uptime = count > 0 ? ((count - errors) / count) * 100 : null
      return {
        key: `probe-${target.id}`,
        name: target.name,
        kind: '拨测站点',
        status,
        summary: !target.enabled
          ? '已停用'
          : uptime === null
            ? '等待首次探测'
            : `24h 可用率 ${uptime.toFixed(2)}% · 平均 ${Math.round(overview?.avgMs ?? 0)}ms · ${target.url}`,
        lastSeen: latest ? fmtAgo(latest.minute * 60_000) : '—',
        route: 'services' as RouteKey,
      }
    })

    const repoRows = configs.map((config) => {
      const status: StatusKey = !config.enabled
        ? 'stopped'
        : config.lastError ? 'error' : config.lastOkAt ? 'running' : 'idle'
      return {
        key: `repo-${config.id}`,
        name: config.repo,
        kind: 'GitHub 仓库',
        status,
        summary: config.lastError ?? `指标：${config.metrics.join(' / ')} · 最近采集 ${fmtAgo(config.lastOkAt)}`,
        lastSeen: fmtAgo(config.lastOkAt),
        route: 'projects' as RouteKey,
      }
    })

    return [...probeRows, ...trafficRows, ...repoRows]
  }, [configs, latestProbeRecord, overviews, probes, trafficSources])

  const abnormalCount = rows.filter((row) => row.status === 'error').length
  const requestTotal = sources
    .filter((source) => !source.name.startsWith('snapshot/'))
    .reduce((sum, source) => sum + (overviews[source.name]?.count ?? 0), 0)
  const enabledProbeCount = probes.filter((target) => target.enabled).length

  return (
    <section className="page" aria-labelledby="overview-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="overview-title">总览</h1>
          <p className="page-desc">我的服务、站点与开源项目的健康快照</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={16} />{loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </div>

      {error && <div className="notice-banner" role="alert">{error}</div>}

      {!hasObservedObjects ? (
        loading ? (
          <EmptyState compact icon="clock" title="正在读取观测数据…" description="连接后端并加载服务、拨测与仓库状态。" />
        ) : error ? null : (
          <section className="panel" aria-label="开始使用">
            <EmptyState
              icon="dashboard"
              title="观测台还没有接入任何对象"
              description="这里汇总你自己的服务、站点与开源项目。先接入一个，数据会在下一个采集周期出现。"
              steps={[
                { title: '拨测站点', description: '每 60 秒检查一次可用率与延迟，站点挂掉也能及时发现。' },
                { title: '接入 GitHub 仓库', description: '每日采集 views / downloads 与 stars 等互动快照。' },
                { title: '上报自有服务', description: '服务按 ingest 格式上报访问量，自动出现在流量来源。' },
              ]}
              actions={[
                { label: '添加拨测目标', onClick: () => onNavigate('services') },
                { label: '接入开源仓库', variant: 'ghost', onClick: () => onNavigate('projects') },
                { label: '配置 GitHub token', variant: 'ghost', onClick: () => onNavigate('settings') },
              ]}
              hint="所有数字都来自真实探测与上报；没接入之前不显示占位数据。"
            />
          </section>
        )
      ) : (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <p className="metric-label">观测对象</p>
              <strong className="metric-value">{externalTrafficSources.length + probes.length + configs.length}</strong>
              <p className="metric-foot"><span>{externalTrafficSources.length} 个服务 · {probes.length} 个拨测 · {configs.length} 个仓库</span></p>
            </div>
            <div className="metric-card">
              <p className="metric-label">异常</p>
              <strong className="metric-value">{abnormalCount}</strong>
              <p className="metric-foot"><span>{abnormalCount > 0 ? '需要处理' : '全部正常'}</span></p>
            </div>
            <div className="metric-card">
              <p className="metric-label">24h 请求</p>
              <strong className="metric-value">{fmtWan(requestTotal)}</strong>
              <p className="metric-foot"><span>不含快照读数</span></p>
            </div>
            <div className="metric-card">
              <p className="metric-label">拨测目标</p>
              <strong className="metric-value">{enabledProbeCount}</strong>
              <p className="metric-foot"><span>共 {probes.length} 个 · 启用 {enabledProbeCount} 个</span></p>
            </div>
          </div>

          <section className="panel" aria-labelledby="health-title">
            <div className="panel-head">
              <div>
                <h2 className="panel-title" id="health-title">健康明细</h2>
                <p className="panel-sub">拨测优先展示最新状态；服务与仓库按 24h / 采集状态派生</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>名称</th><th>类型</th><th>状态</th><th>摘要</th><th>最近活动</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = STATUS_META[row.status]
                    return (
                      <tr key={row.key}>
                        <td><div style={{ fontWeight: 600 }}>{row.name}</div></td>
                        <td><span className="chip" style={{ pointerEvents: 'none' }}>{row.kind}</span></td>
                        <td><span className={'status-tag ' + meta.cls}>{meta.label}</span></td>
                        <td className="cell-clip">{row.summary}</td>
                        <td>{row.lastSeen}</td>
                        <td><button className="btn-text" type="button" onClick={() => onNavigate(row.route)}>查看</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="page-grid">
            {([
              ['services', '服务与站点', '拨测状态、可用率与自有服务访问记录'],
              ['projects', '开源项目', 'GitHub 流量曲线与每日互动快照'],
              ['settings', '设置', '数据源、GitHub token、主题与锁屏'],
            ] as const).map(([route, title, desc]) => (
              <button className="panel category-card" type="button" key={route} onClick={() => onNavigate(route)}>
                <span className="panel-title">{title}</span>
                <span className="panel-sub">{desc}</span>
                <span className="category-arrow" aria-hidden="true"><Icon name="expand" size={16} /></span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
