/**
 * 登录 / 锁屏页：沿用密码换会话的既有流程，视觉对齐控制台参考稿的锁屏卡。
 * 进页探测 /api/monitor/status：open 直接进首页；locked 出密码表单；offline 给重试。
 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginRequest, probeStatus } from '../../api/http'
import { Button, Spinner } from '../../components/ui/ui'
import './access.css'

export default function AccessView() {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedOut = useRef((location.state as { loggedOut?: boolean } | null)?.loggedOut === true)
  const [phase, setPhase] = useState<'probing' | 'locked' | 'offline' | 'open'>('probing')
  const [passwordInput, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loggedOut.current) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function probe(): Promise<void> {
    const result = await probeStatus()
    if (result === 'open' && !loggedOut.current) {
      navigate('/home', { replace: true })
    } else {
      setPhase(result)
      if (result === 'locked') setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  useEffect(() => {
    void probe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function shake() {
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const password = passwordInput.trim()
    if (!password) {
      setError('请输入密码')
      shake()
      return
    }
    setBusy(true)
    setError('')
    const result = await loginRequest(password)
    setBusy(false)
    if (result.ok) {
      navigate('/home', { replace: true })
    } else {
      setError(result.message)
      shake()
    }
  }

  return (
    <div className="lock-screen">
      <div className={'lock-card' + (shaking ? ' is-error' : '')} role="dialog" aria-modal="true" aria-labelledby="lock-title" onAnimationEnd={() => setShaking(false)}>
        <div className="lock-brand" aria-hidden="true">DC</div>
        <h1 className="lock-title" id="lock-title">{loggedOut.current ? '控制台已锁屏' : '进入控制台'}</h1>
        <p className="lock-sub">输入密码继续 · 当前 AI：Command Code</p>

        {phase === 'probing' && <p className="lock-probing"><Spinner size={14} /> 正在连接后端…</p>}

        {phase === 'offline' && (
          <div className="lock-offline">
            <p>后端无响应。确认 workbench-server 已启动后重试。</p>
            <Button variant="primary" size="lg" onClick={() => { setPhase('probing'); void probe() }}>重试</Button>
          </div>
        )}

        {phase === 'open' && (
          <div className="lock-offline">
            <p>后端未开启认证，可以直接回到工作台。</p>
            <Button variant="primary" size="lg" onClick={() => navigate('/home', { replace: true })}>回到工作台</Button>
          </div>
        )}

        {phase === 'locked' && (
          <form className="lock-form" onSubmit={submit}>
            <label className="field-label" htmlFor="lock-password">密码</label>
            <input
              ref={inputRef}
              id="lock-password"
              value={passwordInput}
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="输入密码"
              onChange={(event) => {
                setPasswordInput(event.target.value)
                if (error) setError('')
              }}
            />
            <p className="lock-error" role="alert">{error || ' '}</p>
            <Button variant="primary" type="submit" disabled={busy} className="lock-submit">
              {busy ? <><Spinner size={12} />验证中…</> : '解锁'}
            </Button>
          </form>
        )}

        <p className="lock-hint">密码仅用于换取本机会话；当前 AI 配置页后续开放。</p>
      </div>
    </div>
  )
}
