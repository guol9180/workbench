/** 开源项目：GitHub 仓库接入、流量曲线与每日互动快照。 */
import { useEffect, useState } from 'react'
import {
  collectSourceConfig,
  createSourceConfig,
  deleteSourceConfig,
  fetchGithubRepos,
  fetchMonitorStatus,
  fetchSeries,
  fetchSourceConfigs,
} from './api'
import type { MonitorStatus, SeriesPoint, SourceConfigView } from './api'
import { STATUS_META, fmtAgo, fmtNum, fmtWan } from './data'
import type { StatusKey } from './data'
import Sparkline from './Sparkline'
import Icon from './Icon'

const RANGE_OPTIONS = [7, 14, 30] as const
const RANGE_LABELS: Record<number, string> = { 7: '7d', 14: '14d', 30: '30d' }

function lastValue(points: SeriesPoint[]): number | null {
  return points.length > 0 ? points[points.length - 1].value : null
}

function repoStatus(config: SourceConfigView): StatusKey {
  if (!config.enabled) return 'stopped'
  if (config.lastError) return 'error'
  return config.lastOkAt ? 'running' : 'idle'
}

function RepoCard({
  config,
  range,
  notify,
  onChanged,
}: {
  config: SourceConfigView
  range: number
  notify: (message: string) => void
  onChanged: () => void
}) {
  const [views, setViews] = useState<SeriesPoint[]>([])
  const [downloads, setDownloads] = useState<SeriesPoint[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [viewPoints, downloadPoints, stars, forks, watchers, issues] = await Promise.all([
        fetchSeries(`github/${config.repo}`, 'count', RANGE_LABELS[range] ?? '7d', 'h', 'views'),
        fetchSeries(`github/${config.repo}`, 'count', RANGE_LABELS[range] ?? '7d', 'h', 'downloads'),
        fetchSeries(`snapshot/github/${config.repo}`, 'last', '30d', 'h', 'stars'),
        fetchSeries(`snapshot/github/${config.repo}`, 'last', '30d', 'h', 'forks'),
        fetchSeries(`snapshot/github/${config.repo}`, 'last', '30d', 'h', 'watchers'),
        fetchSeries(`snapshot/github/${config.repo}`, 'last', '30d', 'h', 'openIssues'),
      ])
      setViews(viewPoints)
      setDownloads(downloadPoints)
      setSnapshots({
        stars: lastValue(stars),
        forks: lastValue(forks),
        watchers: lastValue(watchers),
        openIssues: lastValue(issues),
      })
    } catch {
      // 单卡失败不拖垮页面，保留空态
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [config.repo, config.enabled, range])

  async function collect() {
    setCollecting(true)
    try {
      const result = await collectSourceConfig(config.id)
      notify(result.ok ? `「${config.repo}」采集完成` : (result.error ?? '采集失败'))
      await load()
      onChanged()
    } catch (collectError) {
      notify(collectError instanceof Error ? collectError.message : '采集失败')
    } finally {
      setCollecting(false)
    }
  }

  async function remove() {
    if (!window.confirm(`删除「${config.repo}」？历史数据会按保留策略自然过期。`)) return
    try {
      await deleteSourceConfig(config.id)
      notify(`已删除「${config.repo}」`)
      onChanged()
    } catch (deleteError) {
      notify(deleteError instanceof Error ? deleteError.message : '删除失败')
    }
  }

  const meta = STATUS_META[repoStatus(config)]
  const viewsTotal = views.reduce((sum, point) => sum + point.value, 0)
  const downloadsTotal = downloads.reduce((sum, point) => sum + point.value, 0)

  return (
    <article className="project-card">
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="project-name cell-clip">{config.repo}</h3>
          <span className="project-stack">{config.metrics.join(' / ')}</span>
        </div>
        <span className={'status-tag ' + meta.cls}>{meta.label}</span>
      </div>

      <div className="snapshot-row">
        {([
          ['stars', 'Stars'],
          ['forks', 'Forks'],
          ['watchers', 'Watchers'],
          ['openIssues', 'Open Issues'],
        ] as const).map(([key, label]) => (
          <div className="snapshot-item" key={key}>
            <span>{label}</span>
            <b>{snapshots[key] === null || snapshots[key] === undefined ? '—' : fmtNum(snapshots[key] as number)}</b>
          </div>
        ))}
      </div>

      <div className="repo-chart">
        <div className="repo-chart-head">
          <span>Views</span>
          <b>{loading ? '…' : fmtWan(viewsTotal)}</b>
        </div>
        <Sparkline values={views.map((point) => point.value)} ariaLabel={`${config.repo} 浏览量走势`} />
      </div>
      <div className="repo-chart">
        <div className="repo-chart-head">
          <span>Downloads</span>
          <b>{loading ? '…' : fmtWan(downloadsTotal)}</b>
        </div>
        <Sparkline values={downloads.map((point) => point.value)} color="#b4632e" ariaLabel={`${config.repo} 下载量走势`} />
      </div>

      {config.lastError && <p className="field-error">{config.lastError}</p>}

      <div className="project-foot">
        <span>最近采集 {fmtAgo(config.lastOkAt)}</span>
        <span className="project-actions">
          <button className="btn-text" type="button" onClick={() => void collect()} disabled={collecting}>
            {collecting ? '采集中…' : '立即采集'}
          </button>
          <button className="btn-text" type="button" onClick={() => void remove()}>删除</button>
        </span>
      </div>
    </article>
  )
}

export default function OssProjectsPage({
  notify,
  onNavigate,
}: {
  notify: (message: string) => void
  onNavigate: (route: 'settings') => void
}) {
  const [configs, setConfigs] = useState<SourceConfigView[]>([])
  const [status, setStatus] = useState<MonitorStatus | null>(null)
  const [range, setRange] = useState(7)
  const [repoInput, setRepoInput] = useState('')
  const [repoOptions, setRepoOptions] = useState<string[]>([])
  const [metrics, setMetrics] = useState<Set<string>>(new Set(['pages', 'downloads']))
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [fetchingRepos, setFetchingRepos] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [sourceConfigs, monitorStatus] = await Promise.all([
        fetchSourceConfigs(),
        fetchMonitorStatus().catch(() => null),
      ])
      setConfigs(sourceConfigs)
      setStatus(monitorStatus)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addRepo() {
    const repo = repoInput.trim()
    if (!repo || !repo.includes('/')) {
      setError('仓库格式为 owner/name')
      return
    }
    if (metrics.size === 0) {
      setError('至少选择一个指标')
      return
    }
    setAdding(true)
    setError('')
    try {
      await createSourceConfig({ type: 'github', repo, enabled: true, metrics: [...metrics] })
      setRepoInput('')
      notify(`已接入「${repo}」`)
      await load()
      setVersion((current) => current + 1)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '接入失败')
    } finally {
      setAdding(false)
    }
  }

  async function loadRepoOptions() {
    setFetchingRepos(true)
    try {
      const repos = await fetchGithubRepos()
      setRepoOptions(repos)
      notify(`已拉取 ${repos.length} 个仓库`)
    } catch (reposError) {
      notify(reposError instanceof Error ? reposError.message : '拉取仓库列表失败')
    } finally {
      setFetchingRepos(false)
    }
  }

  function toggleMetric(metric: string) {
    setMetrics((current) => {
      const next = new Set(current)
      if (next.has(metric)) next.delete(metric)
      else next.add(metric)
      return next
    })
  }

  return (
    <section className="page" aria-labelledby="projects-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="projects-title">开源项目</h1>
          <p className="page-desc">GitHub 流量与互动快照</p>
        </div>
        <div className="page-actions">
          <div className="range-group" role="group" aria-label="时间范围">
            {RANGE_OPTIONS.map((days) => (
              <button key={days} className="range-btn" type="button" aria-pressed={range === days} onClick={() => setRange(days)}>
                近{days}天
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={16} />{loading ? '加载中…' : '刷新'}
          </button>
        </div>
      </div>

      {error && <div className="notice-banner" role="alert">{error}</div>}
      {status && !status.githubTokenConfigured && (
        <div className="notice-banner" role="alert">
          <span>尚未配置 GitHub token，仓库采集与互动快照不可用。</span>
          <button className="btn btn-ghost" type="button" onClick={() => onNavigate('settings')}>去设置</button>
        </div>
      )}

      <section className="panel" aria-labelledby="repo-add-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="repo-add-title">接入仓库</h2>
            <p className="panel-sub">只读访问；同一仓库不能重复接入</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => void loadRepoOptions()} disabled={fetchingRepos}>
            {fetchingRepos ? '拉取中…' : '拉取我的仓库'}
          </button>
        </div>
        <div className="form-inline">
          <label className="field-compact">
            <span className="field-label">仓库</span>
            <input
              className="input"
              list="github-repos"
              value={repoInput}
              placeholder="owner/name"
              onChange={(event) => setRepoInput(event.target.value)}
            />
            <datalist id="github-repos">
              {repoOptions.map((repo) => <option value={repo} key={repo} />)}
            </datalist>
          </label>
          <div className="field-compact">
            <span className="field-label">指标</span>
            <div className="toolbar" style={{ marginTop: 0 }}>
              {(['pages', 'downloads'] as const).map((metric) => (
                <button key={metric} className={'chip' + (metrics.has(metric) ? ' is-active' : '')} type="button" aria-pressed={metrics.has(metric)} onClick={() => toggleMetric(metric)}>
                  {metric === 'pages' ? 'Pages 流量' : 'Release 下载'}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => void addRepo()} disabled={adding}>
            <Icon name="plus" size={16} />{adding ? '接入中…' : '接入仓库'}
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="repo-list-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="repo-list-title">已接入仓库</h2>
            <p className="panel-sub">共 {configs.length} 个 · 快照为每日最后一次采集值</p>
          </div>
        </div>
        {configs.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">还没有接入仓库</p>
            <p className="empty-desc">在「设置」配置 token 后，可拉取仓库列表或手输 owner/name。</p>
          </div>
        ) : (
          <div className="project-grid">
            {configs.map((config) => (
              <RepoCard
                key={`${config.id}-${version}`}
                config={config}
                range={range}
                notify={notify}
                onChanged={() => { void load(); setVersion((current) => current + 1) }}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
