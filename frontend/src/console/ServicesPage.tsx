/** 服务与站点：拨测目标管理 + 自部署服务的流量记录。 */
import { useEffect, useRef, useState } from 'react'
import {
  createProbeTarget,
  deleteProbeTarget,
  fetchOverview,
  fetchProbeTargets,
  fetchRecent,
  fetchSeries,
  fetchSources,
  updateProbeTarget,
} from './api'
import type { Overview, ProbeTargetView, RecentRecord, SourceStat } from './api'
import { STATUS_META, errorRate, fmtAgo, fmtNum } from './data'
import type { RouteKey, StatusKey } from './data'
import Sparkline from './Sparkline'
import Icon from './Icon'
import EmptyState from './EmptyState'

const TRAFFIC_PREFIXES = ['probe/', 'github/', 'snapshot/']
/** 本机自监测来源：控制台自身流量，始终存在，不作为「外部接入」展示 */
const SELF_SOURCE = 'workbench'

function isTrafficSource(name: string): boolean {
  return !TRAFFIC_PREFIXES.some((prefix) => name.startsWith(prefix))
}

export default function ServicesPage({
  notify,
  onNavigate,
}: {
  notify: (message: string) => void
  onNavigate: (route: RouteKey) => void
}) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [probes, setProbes] = useState<ProbeTargetView[]>([])
  const [sources, setSources] = useState<SourceStat[]>([])
  const [overviews, setOverviews] = useState<Record<string, Overview | null>>({})
  const [recents, setRecents] = useState<RecentRecord[]>([])
  const [latencySeries, setLatencySeries] = useState<Record<string, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [sourceStats, probeTargets, recentRecords] = await Promise.all([
        fetchSources(),
        fetchProbeTargets(),
        fetchRecent(undefined, 500),
      ])
      const entries = await Promise.all(sourceStats.map(async (stat) => {
        const overview = await fetchOverview(stat.name, '24h').catch(() => null)
        return [stat.name, overview] as const
      }))
      const seriesEntries = await Promise.all(probeTargets.map(async (target) => {
        const points = await fetchSeries(`probe/${target.name}`, 'avgMs', '24h', 'h').catch(() => [])
        return [`probe/${target.name}`, points.map((point) => point.value)] as const
      }))
      setSources(sourceStats)
      setProbes(probeTargets)
      setRecents(recentRecords)
      setOverviews(Object.fromEntries(entries))
      setLatencySeries(Object.fromEntries(seriesEntries))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addProbe() {
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl) {
      setFormError('名称与 URL 都不能为空')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await createProbeTarget({ name: trimmedName, url: trimmedUrl, enabled: true })
      setName('')
      setUrl('')
      notify(`已添加拨测目标「${trimmedName}」`)
      await load()
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : '添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function toggleProbe(target: ProbeTargetView) {
    try {
      await updateProbeTarget(target.id, { name: target.name, url: target.url, enabled: !target.enabled })
      notify(target.enabled ? `已停用「${target.name}」` : `已启用「${target.name}」`)
      await load()
    } catch (toggleError) {
      notify(toggleError instanceof Error ? toggleError.message : '操作失败')
    }
  }

  async function removeProbe(target: ProbeTargetView) {
    if (!window.confirm(`删除拨测目标「${target.name}」？历史数据会按保留策略自然过期。`)) return
    try {
      await deleteProbeTarget(target.id)
      notify(`已删除「${target.name}」`)
      await load()
    } catch (deleteError) {
      notify(deleteError instanceof Error ? deleteError.message : '删除失败')
    }
  }

  const latestProbeRecord = (source: string): RecentRecord | undefined =>
    recents.filter((record) => record.source === source).sort((first, second) => second.minute - first.minute)[0]

  const selfSource = sources.find((source) => source.name === SELF_SOURCE)
  const externalTrafficSources = sources.filter((source) => isTrafficSource(source.name) && source.name !== SELF_SOURCE)

  function focusProbeForm() {
    const input = nameInputRef.current
    if (!input) return
    input.scrollIntoView({ block: 'center', behavior: 'smooth' })
    input.focus({ preventScroll: true })
  }

  return (
    <section className="page" aria-labelledby="services-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="services-title">服务与站点</h1>
          <p className="page-desc">拨测状态与自部署服务的访问记录</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={16} />{loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </div>

      {error && <div className="notice-banner" role="alert">{error}</div>}

      <section className="panel" aria-labelledby="probe-add-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="probe-add-title">新增拨测目标</h2>
            <p className="panel-sub">默认每 60 秒探测一次；连接失败或超时记为异常</p>
          </div>
        </div>
        <div className="form-inline">
          <label className="field-compact">
            <span className="field-label">名称</span>
            <input ref={nameInputRef} className="input" value={name} maxLength={40} placeholder="例如：主站" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field-compact">
            <span className="field-label">URL</span>
            <input className="input" value={url} placeholder="https://example.com" onChange={(event) => setUrl(event.target.value)} />
          </label>
          <button className="btn btn-primary" type="button" onClick={() => void addProbe()} disabled={saving}>
            <Icon name="plus" size={16} />{saving ? '保存中…' : '添加目标'}
          </button>
        </div>
        {formError && <p className="field-error">{formError}</p>}
      </section>

      <section className="panel" aria-labelledby="probe-list-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="probe-list-title">拨测目标</h2>
            <p className="panel-sub">共 {probes.length} 个 · 启用 {probes.filter((target) => target.enabled).length} 个</p>
          </div>
        </div>
        {probes.length === 0 ? (
          <EmptyState
            icon="projects"
            title="还没有拨测目标"
            description="添加后每 60 秒探测一次，可用率与延迟在这里累计；连接失败或超时记为异常。"
            actions={[{ label: '填写第一个目标', onClick: focusProbeForm }]}
            hint="名称是数据源标识：改名等于换一个新数据源，历史记录留在旧名称下。"
          />
        ) : (
          <div className="project-grid">
            {probes.map((target) => {
              const source = `probe/${target.name}`
              const overview = overviews[source]
              const latest = latestProbeRecord(source)
              const count = overview?.count ?? 0
              const errors = overview?.errCount ?? 0
              const uptime = count > 0 ? ((count - errors) / count) * 100 : null
              const status: StatusKey = !target.enabled
                ? 'stopped'
                : !latest
                  ? 'idle'
                  : latest.errCount > 0 ? 'error' : 'running'
              const meta = STATUS_META[status]
              return (
                <article className="project-card" key={target.id}>
                  <div className="project-head">
                    <div style={{ minWidth: 0 }}>
                      <h3 className="project-name">{target.name}</h3>
                      <span className="project-stack cell-clip">{target.url}</span>
                    </div>
                    <span className={'status-tag ' + meta.cls}>{meta.label}</span>
                  </div>
                  <div className="project-stats">
                    <span className="project-stat"><b>{uptime === null ? '—' : uptime.toFixed(2) + '%'}</b><span>24h 可用率</span></span>
                    <span className="project-stat"><b>{count > 0 ? Math.round(overview?.avgMs ?? 0) + 'ms' : '—'}</b><span>平均延迟</span></span>
                    <span className="project-stat"><b>{latest ? fmtAgo(latest.minute * 60_000) : '—'}</b><span>最近探测</span></span>
                  </div>
                  <Sparkline values={latencySeries[source] ?? []} ariaLabel={`${target.name} 近 24 小时延迟走势`} />
                  <div className="project-foot">
                    <span>审计：{latest ? `错误 ${latest.errCount} / 请求 ${latest.count}` : '暂无记录'}</span>
                    <span className="project-actions">
                      <button className="btn-text" type="button" onClick={() => void toggleProbe(target)}>{target.enabled ? '停用' : '启用'}</button>
                      <button className="btn-text is-danger" type="button" onClick={() => void removeProbe(target)}>删除</button>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="traffic-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="traffic-title">流量来源</h2>
            <p className="panel-sub">自有服务向 <code>/api/monitor/ingest</code> 上报后在这里出现</p>
          </div>
        </div>
        {externalTrafficSources.length === 0 ? (
          <EmptyState
            icon="eye"
            title="还没有外部流量来源"
            description="外部服务按 ingest 结构上报后出现在这里，用于补充拨测看不到的访问量。"
            actions={[{ label: '查看上报格式', variant: 'ghost', onClick: () => onNavigate('settings') }]}
            hint={selfSource
              ? `本机自监测已记录 ${fmtNum(overviews[SELF_SOURCE]?.count ?? 0)} 次请求，单独统计，不计入外部来源。`
              : undefined}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>来源</th><th>24h 请求</th><th>错误率</th><th>平均响应</th><th>最近活跃</th></tr>
              </thead>
              <tbody>
                {externalTrafficSources.map((source) => {
                  const overview = overviews[source.name]
                  return (
                    <tr key={source.name}>
                      <td><strong>{source.name}</strong></td>
                      <td>{fmtNum(overview?.count ?? 0)}</td>
                      <td>{errorRate(overview?.errCount ?? 0, overview?.count ?? 0)}</td>
                      <td>{(overview?.count ?? 0) > 0 ? Math.round(overview?.avgMs ?? 0) + 'ms' : '—'}</td>
                      <td>{fmtAgo(source.lastSeenMinute * 60_000)}</td>
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
