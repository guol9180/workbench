/**
 * 登录页：密码登录（界面呈现为密码；内部机制 = 密码即后端 API_TOKEN，经 X-API-Token 携带）。
 * 流程：进页探测 /api/monitor/status——open 直接进首页；locked 出密码表单；
 * offline 给重试。提交 = 写入本地 + 重新探测，成功即走。
 * 视觉：粒子景深场（琥珀/冰蓝）+ 玻璃卡 + 指针 3D 倾斜 + 失败抖动——旧登录页的好基因全保留。
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getToken, loginRequest, probeStatus } from '../../api/http'
import { initLoginScene } from './loginScene'
import { Button, Spinner } from '../../components/ui/ui'
import './access.css'

export default function AccessView() {
  const navigate = useNavigate()
  const location = useLocation()
  // 「已退出」态：侧栏退出登录带状态进来时，open 探测不自动回跳（否则认证关闭会原地弹回首页）
  const loggedOut = useRef((location.state as { loggedOut?: boolean } | null)?.loggedOut === true)
  const [phase, setPhase] = useState<'probing' | 'locked' | 'offline' | 'open'>('probing')
  const [passwordInput, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 消费即清 history state：刷新后视为新访问，不留残留标记
  useEffect(() => {
    if (loggedOut.current) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps —— 仅进页时清一次
  }, [])

  // 指针 3D 视差：细指针且未开启「减少动效」时启用，写入 CSS 变量给 .acc-tilt
  const tiltEnabled = useRef(false)

  async function probe(): Promise<'open' | 'locked' | 'offline'> {
    const result = await probeStatus()
    if (result === 'open' && !loggedOut.current) {
      navigate('/home', { replace: true })
    } else {
      setPhase(result)
      if (result === 'locked') setTimeout(() => inputRef.current?.focus(), 50)
    }
    return result
  }

  useEffect(() => {
    tiltEnabled.current =
      window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanup = canvasRef.current ? initLoginScene(canvasRef.current) : undefined
    void probe()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps —— 探测与场景只在进页时发生一次
  }, [])

  const normalizedX = useRef(0)
  const normalizedY = useRef(0)
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({})

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!tiltEnabled.current) return
    normalizedX.current = (event.clientX / window.innerWidth) * 2 - 1
    normalizedY.current = (event.clientY / window.innerHeight) * 2 - 1
    setTiltStyle({
      '--rx': (-normalizedY.current * 4).toFixed(2) + 'deg',
      '--ry': (normalizedX.current * 6).toFixed(2) + 'deg',
    } as CSSProperties)
  }

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
    <div className="acc" onMouseMove={onMouseMove}>
      <div className="acc-aurora" aria-hidden="true">
        <i className="acc-blob acc-blob-a" />
        <i className="acc-blob acc-blob-b" />
      </div>
      <canvas ref={canvasRef} className="acc-scene" aria-hidden="true" />

      <div className="acc-stage">
        <div className="acc-tilt" style={tiltStyle}>
          <div className={'acc-card' + (shaking ? ' shake' : '')} onAnimationEnd={() => setShaking(false)}>
            <span className="acc-eyebrow">Private Workbench</span>
            <svg className="acc-mark" width="36" height="36" viewBox="0 0 24 24" fill="none" role="img" aria-label="工作台">
              <polyline
                points="3,7 7.5,17 12,9.5 16.5,17 21,7"
                stroke="var(--accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="acc-title">工作台</h1>
            <p className="acc-sub">流量、文档与工具，都在这一个后台。</p>

            {phase === 'probing' && <p className="acc-note">正在连接后端…</p>}

            {phase === 'open' && (
              <div className="acc-offline">
                <p>
                  {/* phase=open 只可能来自 loggedOut：无状态直链会被探测自动接回首页 */}
                  已退出登录。后端未开启认证，可以直接回到工作台。
                </p>
                <Button variant="primary" size="lg" onClick={() => navigate('/home', { replace: true })}>
                  回到工作台
                </Button>
              </div>
            )}

            {phase === 'offline' && (
              <div className="acc-offline">
                <p>后端无响应。确认服务已启动后重试。</p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    setPhase('probing')
                    void probe()
                  }}
                >
                  重试
                </Button>
              </div>
            )}

            {phase === 'locked' && (
              <form className="acc-form" onSubmit={submit}>
                <input
                  ref={inputRef}
                  value={passwordInput}
                  className="acc-input"
                  type="password"
                  placeholder="请输入登录密码"
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPasswordInput(event.target.value)
                    if (error) setError('')
                  }}
                />
                {error && <p className="acc-error">{error}</p>}
                <Button variant="primary" size="lg" type="submit" disabled={busy} className="acc-submit">
                  {busy ? <><Spinner size={12} />验证中…</> : '进入'}
                </Button>
              </form>
            )}

            <p className="acc-hint">
              {getToken()
                ? '登录状态保存在这台浏览器中，失效后需重新输入密码。'
                : '密码仅用于换取登录状态，不会发送到其他位置。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
