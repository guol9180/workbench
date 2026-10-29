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
import './access.css'

export default function AccessView() {
  const navigate = useNavigate()
  const location = useLocation()
  // 「已退出」态：侧栏退出登录带状态进来时，open 探测不自动回跳（否则认证关闭会原地弹回首页）
  const loggedOut = useRef((location.state as { loggedOut?: boolean } | null)?.loggedOut === true)
  const [phase, setPhase] = useState<'probing' | 'locked' | 'offline' | 'open'>('probing')
  const [value, setValue] = useState('')
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

  const nx = useRef(0)
  const ny = useRef(0)
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({})

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!tiltEnabled.current) return
    nx.current = (e.clientX / window.innerWidth) * 2 - 1
    ny.current = (e.clientY / window.innerHeight) * 2 - 1
    setTiltStyle({
      '--rx': (-ny.current * 4).toFixed(2) + 'deg',
      '--ry': (nx.current * 6).toFixed(2) + 'deg',
    } as CSSProperties)
  }

  function shake() {
    setShaking(false)
    requestAnimationFrame(() => setShaking(true))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const password = value.trim()
    if (!password || busy) return
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
            <svg className="acc-mark" width="40" height="40" viewBox="0 0 24 24" fill="none" role="img" aria-label="工作台">
              <polyline
                points="3,7 7.5,17 12,9.5 16.5,17 21,7"
                stroke="var(--accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="acc-title">工作台</h1>
            <p className="acc-sub">流量观测 · 文档 · 工具——你的个人后台</p>

            {phase === 'probing' && <p className="acc-note">正在探测后端…</p>}

            {phase === 'open' && (
              <div className="acc-offline">
                <p>
                  {/* phase=open 只可能来自 loggedOut：无状态直链会被探测自动接回首页 */}
                  已退出登录。当前后端未开启认证。
                </p>
                <button className="acc-btn" onClick={() => navigate('/home', { replace: true })}>
                  重新进入工作台
                </button>
              </div>
            )}

            {phase === 'offline' && (
              <div className="acc-offline">
                <p>后端连不上。</p>
                <button
                  className="acc-btn"
                  onClick={() => {
                    setPhase('probing')
                    void probe()
                  }}
                >
                  重试
                </button>
              </div>
            )}

            {phase === 'locked' && (
              <form className="acc-form" onSubmit={submit}>
                <input
                  ref={inputRef}
                  value={value}
                  className="acc-input"
                  type="password"
                  placeholder="请输入登录密码"
                  autoComplete="current-password"
                  onChange={(e) => setValue(e.target.value)}
                />
                {error && <p className="acc-error">{error}</p>}
                <button className="acc-btn" type="submit" disabled={busy || !value.trim()}>
                  {busy ? '验证中…' : '进入'}
                </button>
              </form>
            )}

            <p className="acc-hint">
              {getToken() ? '本地已保存密码，失效后需重新输入。' : '密码仅保存在本机浏览器，不发往别处。'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
