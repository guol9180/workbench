/** 锁屏：只接受服务端密码登录；认证关闭时不会出现锁屏。 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

export default function LockScreen({ open, onUnlock, serverLogin }: {
  open: boolean
  onUnlock: () => void
  /** 返回 null = 成功，字符串 = 错误提示 */
  serverLogin: (password: string) => Promise<string | null>
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setChecking(true)
    const serverError = await serverLogin(password)
    setChecking(false)
    if (serverError) {
      setError(serverError)
      triggerShake()
      return
    }
    onUnlock()
  }

  function triggerShake() {
    setShaking(false)
    requestAnimationFrame(() => {
      setShaking(true)
      inputRef.current?.select()
    })
  }

  if (!open) return null

  return (
    <div className="lock-screen">
      <div
        className={'lock-card' + (shaking ? ' is-error' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-title"
        onAnimationEnd={() => setShaking(false)}
      >
        <div className="lock-brand" aria-hidden="true">WB</div>
        <h2 className="lock-title" id="lock-title">控制台已锁屏</h2>
        <p className="lock-sub">输入登录密码继续</p>
        <form className="lock-form" onSubmit={submit}>
          <label className="field-label" htmlFor="lock-password">密码</label>
          <input
            ref={inputRef}
            id="lock-password"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="输入密码"
            value={password}
            onChange={(event) => { setPassword(event.target.value); if (error) setError('') }}
          />
          <p className="lock-error">{error}</p>
          <button className="btn btn-primary lock-submit" type="submit" disabled={checking}>{checking ? '验证中…' : '解锁'}</button>
        </form>
      </div>
    </div>
  )
}
