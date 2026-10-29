/**
 * 我的项目页：统计你放在 GitHub 上的项目——Pages 流量与 Release 下载量（M9.9 产品定位）。
 * 配置与查看合一：接入（仓库列表选择/手输）与项目数据（卡片展开内嵌图表）在同页完成；
 * 概览页专注系统自监测，GitHub 数据只住在这里。
 * 一切实写操作（接入/启停/删除/采集/token）都由用户点击触发——符合 AGENTS 通用第 5 条。
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { sourcesApi } from './api'
import type { SourceConfigInput, SourceConfigView, SourceMetric } from './api'
import { usePolling } from '../monitor/useMonitor'
import { minutesToMs, monitorApi } from '../monitor/api'
import type { SeriesPointData } from '../monitor/api'
import PulseChart from '../../components/PulseChart'
import { fmtClock, fmtInt, fmtMD } from '../../utils/format'
import { toast } from '../../ui/toast'
import { showConfirm } from '../../ui/dialog'
import { EmptyState, Field, GhostButton, Panel, StatusDot } from '../../components/ui/ui'
import './sources.css'

const ALL_METRICS: SourceMetric[] = ['pages', 'downloads']

/** epoch 分钟序列 → 图表视图模型 */
function toPoints(data: SeriesPointData[] | null): Array<{ t: number; v: number }> {
  return (data ?? []).map((p) => ({ t: minutesToMs(p.bucketEpoch), v: p.value }))
}

export default function SourcesView() {
  const configs = usePolling(() => sourcesApi.list(), 'source-configs', { intervalMs: 20_000 })
  // GitHub token 配置状态：驱动引导卡与接入区（配没配由服务端判定，这里只有布尔位）
  const statusQ = usePolling(() => monitorApi.status(), 'status', { intervalMs: 30_000 })
  const tokenSource = statusQ.data?.githubTokenSource ?? null
  const tokenReady = tokenSource != null
  const [repo, setRepo] = useState('')
  const [metrics, setMetrics] = useState<SourceMetric[]>(ALL_METRICS)
  const [busy, setBusy] = useState(false)
  const [editingToken, setEditingToken] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  // 仓库列表懒加载：点「拉取仓库列表」才请求（首次进页不必打 GitHub）
  const [repos, setRepos] = useState<string[] | null>(null)
  const [reposLoading, setReposLoading] = useState(false)

  // 轮询触发的重取：手动采集 / 增删改后刷新列表
  const [reloadTick, setReloadTick] = useState(0)
  const reload = () => setReloadTick((t) => t + 1)
  useEffect(() => {
    configs.reload()
    // eslint 挂载一次语义：reload 是 setState 包装，引用稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const input: SourceConfigInput = { type: 'github', repo: trimmed, enabled: true, metrics }
    await run(async () => {
      await sourcesApi.create(input)
      setRepo('')
    }, '已接入——等待下一次采集或点「立即采集」')
  }

  async function loadRepos() {
    if (reposLoading) return
    setReposLoading(true)
    try {
      const list = await sourcesApi.listGithubRepos()
      setRepos(list)
      if (list.length === 0) toast('令牌可见的仓库为空——检查令牌权限或所属账号', true)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setReposLoading(false)
    }
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
      setRepos(null)
      statusQ.reload()
    }, '已清除——回落环境变量 GITHUB_TOKEN（如设置）')
  }

  return (
    <div className="src">
      <header className="src-head">
        <h1 className="src-title">我的项目</h1>
        <span className="src-sub">统计你放在 GitHub 上的项目——Pages 流量与 Release 下载量，数据在卡片里直接看</span>
      </header>

      {!tokenReady && (
        <Panel className="src-guide">
          <h2 className="src-guide-title">先配置一次 GitHub 令牌</h2>
          <p className="src-guide-text">
            项目数据需要 GitHub 只读令牌（PAT）才能拉取：Pages 流量与 Release 下载量都走官方接口。
            令牌只保存在你的服务器本地（sources.json），任何接口都不回显。
          </p>
          <ol className="src-guide-steps">
            <li>GitHub → Settings → Developer settings → Personal access tokens</li>
            <li>建议 classic token，勾选 repo 读取权限（traffic 接口对 Fine-grained token 常见 403 限制）</li>
            <li>粘贴到下方保存——立即生效并自动采集已接入的项目</li>
          </ol>
          <div className="src-token-row">
            <input
              className="input src-token-input"
              type="password"
              value={tokenInput}
              placeholder="粘贴只读 PAT（ghp_… / github_pat_…）"
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void saveToken()}
            />
            <button className="src-btn primary" disabled={busy || !tokenInput.trim()} onClick={() => void saveToken()}>
              保存并开始
            </button>
          </div>
        </Panel>
      )}

      {tokenReady && (
        <Panel className="src-form">
          <form onSubmit={addSource}>
            <div className="src-form-grid">
              <Field label="仓库（owner/name）">
                <input
                  className="input src-form-repo"
                  value={repo}
                  list="src-repo-options"
                  placeholder="从下拉选择你的仓库，或手动输入 owner/name"
                  onChange={(e) => setRepo(e.target.value)}
                />
                <datalist id="src-repo-options">
                  {(repos ?? []).map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <div className="src-form-metrics" role="group" aria-label="采集指标">
                {(
                  [
                    { key: 'pages', label: 'Pages 流量' },
                    { key: 'downloads', label: 'Release 下载量' },
                  ] as Array<{ key: SourceMetric; label: string }>
                ).map((m) => (
                  <label key={m.key} className={'src-metric-chip' + (metrics.includes(m.key) ? ' on' : '')}>
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
            <div className="src-form-ops">
              <button className="src-btn primary" disabled={busy || !repo.trim()}>
                接入项目
              </button>
              <GhostButton plain disabled={reposLoading} onClick={() => void loadRepos()}>
                {reposLoading ? '拉取中…' : repos == null ? '拉取我的仓库列表' : '刷新仓库列表'}
              </GhostButton>
              {repos != null && <span className="src-repos-note">共 {repos.length} 个可见仓库</span>}
            </div>
          </form>
        </Panel>
      )}

      {tokenReady && (
        <details className="src-settings">
          <summary className="src-settings-head">
            <span className="src-settings-title">接入设置 · GitHub 令牌</span>
            {tokenSource && <span className="src-tag">来源：{tokenSource === 'page' ? '本页保存' : '环境变量'}</span>}
            <span className="src-settings-state">
              <StatusDot state="ok" />
              采集就绪
            </span>
          </summary>
          <div className="src-settings-body">
            {editingToken && (
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
                <GhostButton plain onClick={() => { setEditingToken(false); setTokenInput('') }}>
                  取消
                </GhostButton>
              </div>
            )}
            {!editingToken && (
              <div className="src-token-row">
                <span className="src-token-note">更换后立即生效并自动采集全部已启用项目；清除则回落环境变量 GITHUB_TOKEN（如已设置）。</span>
                <GhostButton plain onClick={() => setEditingToken(true)}>更换</GhostButton>
                <GhostButton plain danger disabled={busy} onClick={() => void clearToken()}>清除</GhostButton>
              </div>
            )}
          </div>
        </details>
      )}

      <section className="src-list">
        <header className="src-list-head">
          <span className="src-list-title">已接入 {configs.data?.length ?? 0} 个项目</span>
        </header>
        <div className="src-cards">
          {(configs.data ?? []).map((c) => (
            <ProjectCard key={c.id} config={c} busy={busy} onCollect={collect} run={run} />
          ))}
        </div>
        {configs.data?.length === 0 && (
          <EmptyState>
            {tokenReady ? '还没有接入任何项目——用上方表单接入第一个 GitHub 仓库' : '配置令牌后即可接入你的 GitHub 项目'}
          </EmptyState>
        )}
      </section>
    </div>
  )
}

/** 项目卡片：状态 + 操作 + 展开式数据区（views/downloads 各一条日粒度曲线） */
function ProjectCard({
  config,
  busy,
  onCollect,
  run,
}: {
  config: SourceConfigView
  busy: boolean
  onCollect: (c: SourceConfigView) => Promise<void>
  run: (action: () => Promise<void>, done: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const source = 'github/' + config.repo
  // 展开才取数：卡片列表本身不背图表流量；日粒度数据 60s 轮询足够
  const viewsQ = usePolling(() => monitorApi.series(source, 'count', '7d', 'views'), 'pv|' + config.id, {
    enabled: open,
    intervalMs: 60_000,
  })
  const dlQ = usePolling(() => monitorApi.series(source, 'count', '7d', 'downloads'), 'pd|' + config.id, {
    enabled: open,
    intervalMs: 60_000,
  })
  const viewsTotal = (viewsQ.data ?? []).reduce((s, p) => s + p.value, 0)
  const dlTotal = (dlQ.data ?? []).reduce((s, p) => s + p.value, 0)

  return (
    <Panel key={config.id} className="src-card">
      <div className="src-card-top">
        <StatusDot
          state={config.lastError ? 'err' : config.lastOkAt ? 'ok' : 'idle'}
          title={config.lastError ?? ''}
        />
        <span className="src-repo">{config.repo}</span>
        {!config.enabled && <span className="src-tag off">已停用</span>}
      </div>
      <div className="src-card-metrics">
        {config.metrics.map((m) => (
          <span key={m} className="src-tag">{m}</span>
        ))}
      </div>
      <div className="src-card-status">
        {config.lastError
          ? config.lastError
          : config.lastOkAt
            ? '上次成功 ' + fmtClock(config.lastOkAt) + (config.lastDay ? ' · 数据至 ' + config.lastDay : '')
            : '尚未采集'}
      </div>
      <div className="src-card-ops">
        <GhostButton plain onClick={() => setOpen(!open)}>
          {open ? '收起数据' : '查看数据'}
        </GhostButton>
        <GhostButton plain disabled={busy} onClick={() => void onCollect(config)}>立即采集</GhostButton>
        <GhostButton
          plain
          disabled={busy}
          onClick={() => void run(() => sourcesApi.update(config.id, { type: config.type, repo: config.repo, enabled: !config.enabled, metrics: config.metrics as SourceMetric[] }), config.enabled ? '已停用' : '已启用')}
        >
          {config.enabled ? '停用' : '启用'}
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
                message: '确定删除「' + config.repo + '」？接入立即停止，历史数据将按保留策略自然过期。',
                confirmText: '删除',
                danger: true,
              })
              if (yes) await run(() => sourcesApi.remove(config.id), '已删除（历史数据将按保留策略过期）')
            })()
          }}
        >
          删除
        </GhostButton>
      </div>

      {open && (
        <div className="src-detail">
          <div className="src-detail-nums">
            <span className="src-detail-num"><b>{fmtInt(viewsTotal)}</b> 浏览（7d）</span>
            <span className="src-detail-num"><b>{fmtInt(dlTotal)}</b> 下载增量（7d）</span>
          </div>
          <div className="src-chart">
            <div className="src-chart-head">Pages 浏览量 · 日</div>
            <PulseChart
              points={toPoints(viewsQ.data)}
              variant="bars"
              formatValue={fmtInt}
              formatTime={fmtMD}
              height={180}
            />
          </div>
          <div className="src-chart">
            <div className="src-chart-head">Release 下载量 · 日增量</div>
            <PulseChart
              points={toPoints(dlQ.data)}
              variant="bars"
              formatValue={fmtInt}
              formatTime={fmtMD}
              height={180}
            />
          </div>
          {(viewsQ.error || dlQ.error) && (
            <div className="src-detail-err">{viewsQ.error ?? dlQ.error}</div>
          )}
        </div>
      )}
    </Panel>
  )
}
