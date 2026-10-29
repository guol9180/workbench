/**
 * 数据源配置页：用户在这里控制接入哪些外部数据（当前支持 GitHub 仓库）。
 * - 一切实写操作（接入/启停/删除/手动采集）都由用户点击触发——符合 AGENTS 通用第 5 条
 * - 主体 = 已接入源卡片列表（状态/最后采集/操作）；接入表单在列表上方
 * - GitHub 令牌收进「接入设置」折叠区：是支撑配置，不是页面的第一主角，
 *   且命名与系统登录密码明确区分
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { sourcesApi } from './api'
import type { SourceConfigInput, SourceConfigView, SourceMetric } from './api'
import { usePolling } from '../monitor/useMonitor'
import { monitorApi } from '../monitor/api'
import { fmtClock } from '../../utils/format'
import { toast } from '../../ui/toast'
import { showConfirm } from '../../ui/dialog'
import { EmptyState, Field, GhostButton, Panel, StatusDot } from '../../components/ui/ui'
import './sources.css'

const METRIC_LABELS: Array<{ key: SourceMetric; label: string; hint: string }> = [
  { key: 'pages', label: 'Pages 流量', hint: '每日浏览量（views），日粒度、最多回看 14 天' },
  { key: 'downloads', label: 'Release 下载量', hint: '全部 Release 资产下载次数，按采集增量入库' },
]

export default function SourcesView() {
  const configs = usePolling(() => sourcesApi.list(), 'source-configs', { intervalMs: 20_000 })
  // GitHub token 配置状态：驱动折叠区的状态灯（配没配由服务端判定，这里只有布尔位）
  const statusQ = usePolling(() => monitorApi.status(), 'status', { intervalMs: 30_000 })
  const tokenSource = statusQ.data?.githubTokenSource ?? null
  const tokenReady = tokenSource != null
  const [repo, setRepo] = useState('')
  const [metrics, setMetrics] = useState<SourceMetric[]>(['pages', 'downloads'])
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingToken, setEditingToken] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

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

  async function addSource(e: FormEvent) {
    e.preventDefault()
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

  /** 保存 token 后立即采集全部启用源：配置到数据可用，一次点击闭环 */
  async function saveToken() {
    const value = tokenInput.trim()
    if (busy || !value) return
    await run(async () => {
      await sourcesApi.setGithubToken(value)
      setTokenInput('')
      setEditingToken(false)
      const failures: string[] = []
      for (const c of await sourcesApi.list()) {
        if (!c.enabled) continue
        const r = await sourcesApi.collect(c.id)
        if (!r.ok) failures.push(c.repo + '：' + (r.error ?? '失败'))
      }
      if (failures.length > 0) throw new Error(failures.join('；'))
      statusQ.reload()
    }, '已保存并完成采集')
  }

  async function clearToken() {
    await run(async () => {
      await sourcesApi.clearGithubToken()
      statusQ.reload()
    }, '已清除——回落环境变量 GITHUB_TOKEN（如设置）')
  }

  return (
    <div className="src">
      <header className="src-head">
        <h1 className="src-title">数据源</h1>
        <span className="src-sub">接入外部数据到统一时序存储——概览页的源列表会随之出现</span>
      </header>

      <Panel className="src-form">
        <form onSubmit={addSource}>
          <div className="src-form-grid">
            <Field label="仓库">
              <input
                className="input src-form-repo"
                value={repo}
                placeholder="owner/name，如 guol9180/workbench"
                onChange={(e) => setRepo(e.target.value)}
              />
            </Field>
            <div className="src-form-row">
              <Field label="指标">
                <div className="src-checks">
                  {METRIC_LABELS.map((m) => (
                    <label key={m.key} className={'src-check' + (metrics.includes(m.key) ? ' on' : '')} title={m.hint}>
                      <input type="checkbox" checked={metrics.includes(m.key)} onChange={() => toggleMetrics(m.key)} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </Field>
              <button
                type="button"
                className={'src-switch' + (enabled ? ' on' : '')}
                onClick={() => setEnabled(!enabled)}
                title={enabled ? '接入后立即参与定时采集' : '暂不采集，可随时启用'}
              >
                <i className="src-switch-dot" />
                {enabled ? '立即启用采集' : '先接入，暂不采集'}
              </button>
              <button type="submit" className="src-btn" disabled={busy || !repo.trim()}>
                接入
              </button>
            </div>
          </div>
          <p className="src-note">
            GitHub 流量 API 需要在下方「接入设置」配置 GitHub 令牌（只读 PAT）；Pages 流量为日粒度、最多回看 14 天（GitHub 侧限制）。
          </p>
        </form>
      </Panel>

      {statusQ.data && (
        <details className="panel src-settings" open={!tokenReady}>
          <summary className="src-settings-summary">
            <span className="src-settings-title">接入设置 · GitHub 令牌</span>
            {tokenSource && <span className="src-tag">来源：{tokenSource === 'page' ? '本页保存' : '环境变量'}</span>}
            <span className="src-settings-state">
              <StatusDot state={tokenReady ? 'ok' : 'err'} />
              {tokenReady ? '采集就绪' : '未配置'}
            </span>
          </summary>
          <div className="src-settings-body">
            {(editingToken || !tokenReady) && (
              <div className="src-token-row">
                <input
                  className="input src-token-input"
                  type="password"
                  value={tokenInput}
                  placeholder="粘贴只读 PAT（ghp_… / github_pat_…），仅存本机服务端"
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void saveToken()}
                />
                <button className="src-btn" disabled={busy || !tokenInput.trim()} onClick={() => void saveToken()}>
                  保存并采集
                </button>
                {tokenReady && (
                  <GhostButton plain onClick={() => { setEditingToken(false); setTokenInput('') }}>
                    取消
                  </GhostButton>
                )}
              </div>
            )}
            {!editingToken && tokenReady && (
              <div className="src-token-row">
                <span className="src-token-note">保存后立即生效并自动采集全部已启用源；清除则回落环境变量 GITHUB_TOKEN（如已设置）。</span>
                <GhostButton plain onClick={() => setEditingToken(true)}>更换</GhostButton>
                <GhostButton plain danger disabled={busy} onClick={() => void clearToken()}>清除</GhostButton>
              </div>
            )}
          </div>
        </details>
      )}

      <section className="src-list">
        <header className="src-list-head">
          <span className="src-list-title">已接入 {configs.data?.length ?? 0} 个数据源</span>
        </header>
        <div className="src-cards">
          {(configs.data ?? []).map((c) => (
            <Panel key={c.id} className="src-card">
              <div className="src-card-top">
                <StatusDot
                  state={c.lastError ? 'err' : c.lastOkAt ? 'ok' : 'idle'}
                  title={c.lastError ?? ''}
                />
                <span className="src-repo">{c.repo}</span>
                {!c.enabled && <span className="src-tag off">已停用</span>}
              </div>
              <div className="src-card-metrics">
                {c.metrics.map((m) => (
                  <span key={m} className="src-tag">{m}</span>
                ))}
              </div>
              <div className="src-card-status">
                {c.lastError
                  ? c.lastError
                  : c.lastOkAt
                    ? '上次成功 ' + fmtClock(c.lastOkAt) + (c.lastDay ? ' · 数据至 ' + c.lastDay : '')
                    : '尚未采集'}
              </div>
              <div className="src-card-ops">
                <GhostButton plain disabled={busy} onClick={() => void collect(c)}>立即采集</GhostButton>
                <GhostButton
                  plain
                  disabled={busy}
                  onClick={() => void run(() => sourcesApi.update(c.id, { type: c.type, repo: c.repo, enabled: !c.enabled, metrics: c.metrics as SourceMetric[] }), c.enabled ? '已停用' : '已启用')}
                >
                  {c.enabled ? '停用' : '启用'}
                </GhostButton>
                <GhostButton
                  plain
                  danger
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
                </GhostButton>
              </div>
            </Panel>
          ))}
        </div>
        {configs.data?.length === 0 && (
          <EmptyState>还没有接入任何数据源——用上方表单接入第一个 GitHub 仓库</EmptyState>
        )}
      </section>
    </div>
  )
}
