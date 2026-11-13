/** 设置：GitHub token、系统状态、主题与锁屏。 */
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { clearGithubToken, fetchMonitorStatus, setGithubToken } from './api'
import type { MonitorStatus } from './api'
import { useTheme, setTheme } from '../theme'
import Icon from './Icon'

export default function SettingsPage({
  authRequired,
  onLock,
  notify,
}: {
  authRequired: boolean
  onLock: () => void
  notify: (message: string) => void
}) {
  const theme = useTheme()
  const [status, setStatus] = useState<MonitorStatus | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setStatus(await fetchMonitorStatus())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '状态加载失败')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveToken() {
    if (!token.trim()) {
      setError('令牌不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      await setGithubToken(token.trim())
      setToken('')
      notify('GitHub token 已保存，立即生效')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function clearToken() {
    if (!window.confirm('清除页面级 token？将回落到环境变量 GITHUB_TOKEN。')) return
    try {
      await clearGithubToken()
      notify('页面级 token 已清除')
      await load()
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : '清除失败')
    }
  }

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next, { x: event.clientX, y: event.clientY })
  }

  const tokenSourceLabel = status?.githubTokenSource === 'page'
    ? '页面设置'
    : status?.githubTokenSource === 'env' ? '环境变量' : null

  return (
    <section className="page" aria-labelledby="settings-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="settings-title">设置</h1>
          <p className="page-desc">数据源凭据、系统状态与外观</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />刷新状态
          </button>
        </div>
      </div>

      {error && <div className="notice-banner" role="alert">{error}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <p className="metric-label">认证</p>
          <strong className="metric-value">{status ? (status.authEnabled ? '开启' : '关闭') : '—'}</strong>
          <p className="metric-foot"><span>{status?.authEnabled ? '需要登录密码' : '本地开发模式'}</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">内存桶</p>
          <strong className="metric-value">{status?.memoryBuckets ?? '—'}</strong>
          <p className="metric-foot"><span>分钟聚合桶数量</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">数据文件</p>
          <strong className="metric-value">{status?.dataFiles ?? '—'}</strong>
          <p className="metric-foot"><span>按天 JSONL 文件</span></p>
        </div>
        <div className="metric-card">
          <p className="metric-label">丢弃事件</p>
          <strong className="metric-value">{status?.droppedEvents ?? '—'}</strong>
          <p className="metric-foot"><span>有界队列背压计数</span></p>
        </div>
      </div>

      <div className="page-grid">
        <section className="panel" aria-labelledby="token-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="token-title">GitHub token</h2>
              <p className="panel-sub">
                {status?.githubTokenConfigured
                  ? `已配置${tokenSourceLabel ? ` · 来源：${tokenSourceLabel}` : ''} · 任何接口不回显`
                  : '未配置 · 仓库采集不可用'}
              </p>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="github-token">只读 token</label>
            <input
              id="github-token"
              className="input"
              type="password"
              autoComplete="off"
              value={token}
              placeholder="粘贴 token 后保存，立即生效"
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          <div className="dialog-actions" style={{ marginTop: 12 }}>
            {status?.githubTokenConfigured && (
              <button className="btn btn-ghost" type="button" onClick={() => void clearToken()}>清除页面 token</button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => void saveToken()} disabled={saving}>
              {saving ? '保存中…' : '保存 token'}
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="appearance-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="appearance-title">外观与锁屏</h2>
              <p className="panel-sub">主题与锁屏状态只保存在本机浏览器</p>
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn btn-ghost" type="button" onClick={toggleTheme}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />切换到{theme === 'dark' ? '浅色' : '深色'}
            </button>
            {authRequired && (
              <button className="btn btn-ghost" type="button" onClick={onLock}>
                <Icon name="lock" size={17} />锁屏
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="ingest-title">
        <div className="panel-head">
          <div>
            <h2 className="panel-title" id="ingest-title">服务接入</h2>
            <p className="panel-sub">自有服务按 ingest 结构上报，机器凭据使用 API_TOKEN</p>
          </div>
        </div>
        <pre className="code-block">{`POST /api/monitor/ingest
X-API-Token: <API_TOKEN>
{"source":"my-service","points":[
  {"endpoint":"/api/health","method":"GET","status":200,
   "count":1,"totalMs":12,"maxMs":12,"ts":1762900000000}
]}`}</pre>
      </section>
    </section>
  )
}
