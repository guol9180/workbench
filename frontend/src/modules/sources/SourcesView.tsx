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
import { Button, Combobox, EmptyState, Field, Icon, PageHeader, Panel, Spinner, StatusDot, Tag } from '../../components/ui/ui'
import './sources.css'

const ALL_METRICS: SourceMetric[] = ['pages', 'downloads']

/** epoch 分钟序列 → 图表视图模型 */
function toPoints(data: SeriesPointData[] | null): Array<{ timestamp: number; value: number }> {
  return (data ?? []).map((point) => ({ timestamp: minutesToMs(point.bucketEpoch), value: point.value }))
}

export default function SourcesView() {
  const configsQuery = usePolling(() => sourcesApi.list(), 'source-configs', { intervalMs: 20_000 })
  // GitHub token 配置状态：驱动引导卡与接入区（配没配由服务端判定，这里只有布尔位）
  const statusQuery = usePolling(() => monitorApi.status(), 'status', { intervalMs: 30_000 })
  const tokenSource = statusQuery.data?.githubTokenSource ?? null
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
    configsQuery.reload()
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
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), true)
    } finally {
      setBusy(false)
    }
  }

  async function addSource(event: FormEvent) {
    event.preventDefault()
    const trimmedRepo = repo.trim()
    if (!trimmedRepo || busy) return
    const input: SourceConfigInput = { type: 'github', repo: trimmedRepo, enabled: true, metrics }
    await run(async () => {
      await sourcesApi.create(input)
      setRepo('')
    }, '已接入。等下一次采集，或点「立即采集」。')
  }

  async function loadRepos() {
    if (reposLoading) return
    setReposLoading(true)
    try {
      const list = await sourcesApi.listGithubRepos()
      setRepos(list)
      if (list.length === 0) toast('令牌没有返回可见仓库，请检查权限或账号归属。', true)
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), true)
    } finally {
      setReposLoading(false)
    }
  }

  function toggleMetrics(metricKey: SourceMetric) {
    setMetrics((currentMetrics) =>
      currentMetrics.includes(metricKey)
        ? currentMetrics.filter((candidate) => candidate !== metricKey)
        : [...currentMetrics, metricKey],
    )
  }

  async function collect(config: SourceConfigView) {
    await run(async () => {
      const result = await sourcesApi.collect(config.id)
      if (!result.ok) throw new Error(result.error ?? '采集失败')
    }, '采集完成。')
  }

  /** 保存 token 后立即采集全部启用源：配置到数据可用，一次点击闭环 */
  async function saveToken() {
    const tokenValue = tokenInput.trim()
    if (busy || !tokenValue) return
    await run(async () => {
      await sourcesApi.setGithubToken(tokenValue)
      setTokenInput('')
      setEditingToken(false)
      const failures: string[] = []
      for (const config of await sourcesApi.list()) {
        if (!config.enabled) continue
        const result = await sourcesApi.collect(config.id)
        if (!result.ok) failures.push(config.repo + '：' + (result.error ?? '失败'))
      }
      if (failures.length > 0) throw new Error(failures.join('；'))
      statusQuery.reload()
    }, '令牌已保存，并完成一轮采集。')
  }

  async function clearToken() {
    await run(async () => {
      await sourcesApi.clearGithubToken()
      setRepos(null)
      statusQuery.reload()
    }, '令牌已清除，会回落到环境变量 GITHUB_TOKEN（如果已设置）。')
  }

  return (
    <div className="src">
      <PageHeader
        eyebrow="项目 / GitHub"
        title="我的项目"
        desc="接入 GitHub 仓库，Pages 流量与 Release 下载量集中在这里。"
      >
        <span className={'src-token-status' + (tokenReady ? ' ok' : '')}>
          <StatusDot state={tokenReady ? 'ok' : 'warn'} />
          {tokenReady ? '令牌已就绪' : '未配置令牌'}
        </span>
      </PageHeader>

      {!tokenReady && (
        <Panel className="src-guide">
          <span className="src-panel-eyebrow">Setup / Token</span>
          <h2 className="src-guide-title">先配置 GitHub 令牌</h2>
          <p className="src-guide-text">
            Pages 流量和 Release 下载量都要走 GitHub 官方接口，所以这里需要一个只读令牌。
            令牌只保存在本机服务器的 sources.json 中，接口不会返回它。
          </p>
          <ol className="src-guide-steps">
            <li>GitHub → Settings → Developer settings → Personal access tokens</li>
            <li>创建一个 classic token，勾选 repo 读取权限。traffic 接口对 fine-grained token 常返回 403。</li>
            <li>粘贴到下方保存。生效后会自动采集已接入的项目。</li>
          </ol>
          <div className="src-token-row">
            <input
              className="input src-token-input"
              type="password"
              value={tokenInput}
              placeholder="粘贴 PAT，ghp_ 或 github_pat_ 开头"
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void saveToken()}
            />
            <Button variant="primary" disabled={busy || !tokenInput.trim()} onClick={() => void saveToken()}>
              {busy ? <><Spinner size={12} />处理中…</> : '保存并采集'}
            </Button>
          </div>
        </Panel>
      )}

      {tokenReady && (
        <Panel className="src-form">
          <div className="src-panel-head">
            <span className="src-panel-eyebrow">Connect / Repository</span>
            <span className="src-panel-hint">从下拉选择，或直接输入 owner/name</span>
          </div>
          <form onSubmit={addSource}>
            <div className="src-form-grid">
              <Field label="仓库">
                <Combobox
                  className="src-form-repo"
                  value={repo}
                  onChange={setRepo}
                  options={repos ?? []}
                  ariaLabel="仓库"
                  placeholder="owner/name，或从列表选择"
                  emptyText={
                    repos == null
                      ? '尚未拉取仓库列表。点下方按钮，或直接输入 owner/name。'
                      : '没有匹配的仓库。'
                  }
                />
              </Field>
              <div className="src-form-metrics" role="group" aria-label="采集指标">
                {(
                  [
                    { key: 'pages', label: 'Pages 流量' },
                    { key: 'downloads', label: 'Release 下载量' },
                  ] as Array<{ key: SourceMetric; label: string }>
                ).map((metricOption) => (
                  <label
                    key={metricOption.key}
                    className={'src-metric-chip' + (metrics.includes(metricOption.key) ? ' on' : '')}
                  >
                    <input
                      type="checkbox"
                      checked={metrics.includes(metricOption.key)}
                      onChange={() => toggleMetrics(metricOption.key)}
                    />
                    {metricOption.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="src-form-ops">
              <Button type="submit" variant="primary" disabled={busy || !repo.trim()}>
                {busy ? <><Spinner size={12} />处理中…</> : '接入项目'}
              </Button>
              <Button size="sm" disabled={reposLoading} onClick={() => void loadRepos()}>
                {reposLoading ? (
                  <><Spinner size={12} />正在拉取…</>
                ) : repos == null ? (
                  '拉取我的仓库列表'
                ) : (
                  '刷新仓库列表'
                )}
              </Button>
              {repos != null && <span className="src-repos-note">能看到 {repos.length} 个仓库</span>}
            </div>
          </form>
        </Panel>
      )}

      {tokenReady && (
        <details className="src-settings">
          <summary className="src-settings-head">
            <span className="src-settings-title">接入设置 · GitHub 令牌</span>
            {tokenSource && <Tag>来源：{tokenSource === 'page' ? '本页保存' : '环境变量'}</Tag>}
            <span className="src-settings-state">
              <StatusDot state="ok" />
              采集正常
            </span>
            <Icon name="chevron-down" size={14} className="src-settings-caret" />
          </summary>
          <div className="src-settings-body">
            {editingToken && (
              <div className="src-token-row">
                <input
                  className="input src-token-input"
                  type="password"
                  value={tokenInput}
                  placeholder="粘贴 PAT，只存在本机服务端"
                  onChange={(event) => setTokenInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void saveToken()}
                />
                <Button variant="primary" disabled={busy || !tokenInput.trim()} onClick={() => void saveToken()}>
                  {busy ? <><Spinner size={12} />处理中…</> : '保存并采集'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingToken(false); setTokenInput('') }}>
                  取消
                </Button>
              </div>
            )}
            {!editingToken && (
              <div className="src-token-row">
                <span className="src-token-note">换了会立即生效，并自动采集所有启用项目。清除后回落到环境变量 GITHUB_TOKEN（如果设了）。</span>
                <Button variant="ghost" size="sm" onClick={() => setEditingToken(true)}>更换</Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={() => void clearToken()}>清除</Button>
              </div>
            )}
          </div>
        </details>
      )}

      <section className="src-list">
        <header className="src-list-head">
          <span className="src-list-title">已接入 {configsQuery.data?.length ?? 0} 个项目</span>
          <span className="src-list-hint">展开卡片查看每天的曲线</span>
        </header>
        <div className="src-cards">
          {(configsQuery.data ?? []).map((config) => (
            <ProjectCard key={config.id} config={config} busy={busy} onCollect={collect} run={run} />
          ))}
        </div>
        {configsQuery.data?.length === 0 && (
          <EmptyState>
            {tokenReady ? '还没有接入项目。用上面的表单接第一个仓库。' : '配好令牌后，就能接第一个项目了。'}
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
  const viewsQuery = usePolling(() => monitorApi.series(source, 'count', '7d', 'views'), 'pv|' + config.id, {
    enabled: open,
    intervalMs: 60_000,
  })
  const downloadsQuery = usePolling(() => monitorApi.series(source, 'count', '7d', 'downloads'), 'pd|' + config.id, {
    enabled: open,
    intervalMs: 60_000,
  })
  const viewsTotal = (viewsQuery.data ?? []).reduce((total, point) => total + point.value, 0)
  const downloadsTotal = (downloadsQuery.data ?? []).reduce((total, point) => total + point.value, 0)

  return (
    <Panel key={config.id} className="src-card">
      <div className="src-card-top">
        <StatusDot
          state={config.lastError ? 'err' : config.lastOkAt ? 'ok' : 'idle'}
          title={config.lastError ?? ''}
        />
        <span className="src-repo">{config.repo}</span>
        {!config.enabled && <Tag tone="warn">已停用</Tag>}
      </div>
      <div className="src-card-metrics">
        {config.metrics.map((metric) => (
          <Tag key={metric}>
            {metric === 'pages' ? 'Pages 流量' : 'Release 下载量'}
          </Tag>
        ))}
      </div>
      <div className="src-card-status">
        {config.lastError
          ? config.lastError
          : config.lastOkAt
            ? '上次成功 ' + fmtClock(config.lastOkAt) + (config.lastDay ? ' · 数据到 ' + config.lastDay : '')
            : '尚未采集'}
      </div>
      <div className="src-card-ops">
        <Button size="sm" onClick={() => setOpen(!open)}>
          {open ? '收起数据' : '查看数据'}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void onCollect(config)}>立即采集</Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void run(() => sourcesApi.update(config.id, { type: config.type, repo: config.repo, enabled: !config.enabled, metrics: config.metrics as SourceMetric[] }), config.enabled ? '已停用。' : '已启用。')}
        >
          {config.enabled ? '停用' : '启用'}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => {
            // 破坏性操作必须二次确认：删除立即停采集，不可恢复
            void (async () => {
              const confirmed = await showConfirm({
                title: '确认删除？',
                message: '删除「' + config.repo + '」后会立即停止采集。历史数据会按保留策略自然过期。',
                confirmText: '删除',
                danger: true,
              })
              if (confirmed) await run(() => sourcesApi.remove(config.id), '已删除。历史数据会按保留策略过期。')
            })()
          }}
        >
          删除
        </Button>
      </div>

      {open && (
        <div className="src-detail">
          <div className="src-detail-nums">
            <span className="src-detail-num"><b>{fmtInt(viewsTotal)}</b> 7 天浏览</span>
            <span className="src-detail-num"><b>{fmtInt(downloadsTotal)}</b> 7 天下载</span>
          </div>
          <div className="src-chart">
            <div className="src-chart-head">Pages 浏览量 · 每天</div>
            <PulseChart
              points={toPoints(viewsQuery.data)}
              variant="bars"
              formatValue={fmtInt}
              formatTime={fmtMD}
              height={180}
              emptyText="还没有数据。采集完成后，这里会按天出现柱子。"
            />
          </div>
          <div className="src-chart">
            <div className="src-chart-head">Release 下载量 · 每天新增</div>
            <PulseChart
              points={toPoints(downloadsQuery.data)}
              variant="bars"
              formatValue={fmtInt}
              formatTime={fmtMD}
              height={180}
              emptyText="还没有数据。采集完成后，这里会按天出现柱子。"
            />
          </div>
          {(viewsQuery.error || downloadsQuery.error) && (
            <div className="src-detail-err">{viewsQuery.error ?? downloadsQuery.error}</div>
          )}
        </div>
      )}
    </Panel>
  )
}
