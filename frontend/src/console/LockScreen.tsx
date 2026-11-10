/** 锁屏：参考稿的本地密码锁，默认演示密码 commandcode；服务端模式改走后端登录。 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

const PASSWORD_KEY = 'devconsole.lockPassword.v1'

export default function LockScreen({ open, onUnlock, serverLogin }: {
  open: boolean
  onUnlock: () => void
  /** 服务端登录（M13）：返回 null = 成功，字符串 = 错误提示；缺省 = 本地演示密码 */
  serverLogin?: (password: string) => Promise<string | null>
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setError('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (serverLogin) {
      setChecking(true)
      const serverError = await serverLogin(password)
      setChecking(false)
      if (serverError) {
        setError(serverError)
        triggerShake()
        return
      }
      onUnlock()
      return
    }
    let expectedPassword = 'commandcode'
    try {
      expectedPassword = localStorage.getItem(PASSWORD_KEY) || expectedPassword
    } catch {
      // 存储不可用时使用演示密码
    }
    if (password !== expectedPassword) {
      setError('密码不正确，再试一次。')
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
        ref={cardRef}
        className={'lock-card' + (shaking ? ' is-error' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-title"
        onAnimationEnd={() => setShaking(false)}
      >
        <div className="lock-brand" aria-hidden="true">DC</div>
        <h2 className="lock-title" id="lock-title">控制台已锁屏</h2>
        <p className="lock-sub">输入密码继续 · 当前 AI：Command Code</p>
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
        {!serverLogin && <p className="lock-hint">演示密码：commandcode</p>}
      </div>
    </div>
  )
}
