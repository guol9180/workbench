/**
 * 数据源配置页：用户在这里控制接入哪些外部数据（当前支持 GitHub 仓库）。
 * - 一切实写操作（接入/启停/删除/手动采集）都由用户点击触发——符合 AGENTS 通用第 5 条
 * - 采集运行状态（状态灯 / 最后成功 / 错误）直接可见：接入不是配置完就完，要能看出它在工作
 */
import { useEffect, useState } from 'react'
import { sourcesApi } from './api'
import type { SourceConfigInput, SourceConfigView, SourceMetric } from './api'
import { usePolling } from '../monitor/useMonitor'
import { fmtClock } from '../../utils/format'
import { toast } from '../../ui/toast'
import { showConfirm } from '../../ui/dialog'
import './sources.css'

const METRIC_LABELS: Array<{ key: SourceMetric; label: string; hint: string }> = [
  { key: 'pages', label: 'Pages 流量', hint: '每日浏览量（views），日粒度、最多回看 14 天' },
  { key: 'downloads', label: 'Release 下载量', hint: '全部 Release 资产下载次数，按采集增量入库' },
]

export default function SourcesView() {
  const configs = usePolling(() => sourcesApi.list(), 'source-configs', { intervalMs: 20_000 })
  const [repo, setRepo] = useState('')
  const [metrics, setMetrics] = useState<SourceMetric[]>(['pages', 'downloads'])
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)

  // 轮询触发的重取：手动采集 / 增删改后刷新列表
  const [reloadTick, setReloadTick] = useState(0)
  const reload = () => setReloadTick((t) => t + 1)
  useEffect(() => {
    configs.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps —— 仅在操作后主动刷新
  }, [reloadTick])

  async function run(action: () => Promise<void>, done: string) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      toast(done)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setBusy(false)
    }
  }

  async function addSource() {
    const trimmed = repo.trim()
    if (!trimmed || busy) return
    const input: SourceConfigInput = { type: 'github', repo: trimmed, enabled, metrics }
    await run(async () => {
      await sourcesApi.create(input)
      setRepo('')
    }, '已接入——等待下一次采集或点「立即采集」')
  }

  function toggleMetrics(key: SourceMetric) {
    setMetrics((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]))
  }

  async function collect(c: SourceConfigView) {
    await run(async () => {
      const result = await sourcesApi.collect(c.id)
      if (!result.ok) throw new Error(result.error ?? '采集失败')
    }, '采集完成')
  }

  return (
    <div className="src">
      <header className="src-head">
        <h1 className="src-title">数据源</h1>
        <span className="src-sub">接入外部数据到统一时序存储——概览页的源列表会随之出现</span>
      </header>

      <section className="panel src-form">
        <div className="src-form-row">
          <span className="src-form-label">类型</span>
          <span className="src-type">GitHub 仓库</span>
        </div>
        <div className="src-form-row">
          <span className="src-form-label">仓库</span>
          <input
            className="src-input"
            value={repo}
            placeholder="owner/name，如 guol9180/workbench"
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addSource()}
          />
        </div>
        <div className="src-form-row">
          <span className="src-form-label">指标</span>
          <div className="src-checks">
            {METRIC_LABELS.map((m) => (
              <label key={m.key} className={'src-check' + (metrics.includes(m.key) ? ' on' : '')} title={m.hint}>
                <input
                  type="checkbox"
                  checked={metrics.includes(m.key)}
                  onChange={() => toggleMetrics(m.key)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
        <div className="src-form-row">
          <span className="src-form-label">接入后</span>
          <button
            className={'src-switch' + (enabled ? ' on' : '')}
            onClick={() => setEnabled(!enabled)}
            title={enabled ? '接入后立即参与定时采集' : '暂不采集，可随时启用'}
          >
            <i className="src-switch-dot" />
            {enabled ? '立即启用采集' : '先接入，暂不采集'}
          </button>
          <button className="src-btn primary" disabled={busy || !repo.trim()} onClick={() => void addSource()}>
            接入
          </button>
        </div>
        <p className="src-note">
          GitHub 流量 API 需要服务端配置 GITHUB_TOKEN（只读 PAT）；Pages 流量为日粒度、最多回看 14 天（GitHub 侧限制）。
        </p>
      </section>

      <section className="panel src-list">
        <header className="src-list-head">
          <span className="src-list-title">已接入 {configs.data?.length ?? 0} 个数据源</span>
        </header>
        {(configs.data ?? []).map((c) => (
          <div key={c.id} className="src-item">
            <div className="src-item-main">
              <i className={'src-state ' + (c.lastError ? 'err' : c.lastOkAt ? 'ok' : 'idle')} title={c.lastError ?? ''} />
              <span className="src-repo">{c.repo}</span>
              {c.metrics.map((m) => (
                <span key={m} className="src-tag">{m}</span>
              ))}
              {!c.enabled && <span className="src-tag off">已停用</span>}
            </div>
            <div className="src-item-status">
              {c.lastError
                ? c.lastError
                : c.lastOkAt
                  ? '上次成功 ' + fmtClock(c.lastOkAt) + (c.lastDay ? ' · 数据至 ' + c.lastDay : '')
                  : '尚未采集'}
            </div>
            <div className="src-item-ops">
              <button className="src-op" disabled={busy} onClick={() => void collect(c)}>立即采集</button>
              <button
                className="src-op"
                disabled={busy}
                onClick={() => void run(() => sourcesApi.update(c.id, { type: c.type, repo: c.repo, enabled: !c.enabled, metrics: c.metrics as SourceMetric[] }), c.enabled ? '已停用' : '已启用')}
              >
                {c.enabled ? '停用' : '启用'}
              </button>
              <button
                className="src-op danger"
                disabled={busy}
                onClick={() => {
                  // 破坏性操作必须二次确认：删除立即停采集，不可恢复
                  void (async () => {
                    const yes = await showConfirm({
                      title: '删除确认',
                      message: '确定删除「' + c.repo + '」？接入立即停止，历史数据将按保留策略自然过期。',
                      confirmText: '删除',
                      danger: true,
                    })
                    if (yes) await run(() => sourcesApi.remove(c.id), '已删除（历史数据将按保留策略过期）')
                  })()
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
        {configs.data?.length === 0 && (
          <div className="src-empty">还没有接入任何数据源——用上方表单接入第一个 GitHub 仓库</div>
        )}
      </section>
    </div>
  )
}
