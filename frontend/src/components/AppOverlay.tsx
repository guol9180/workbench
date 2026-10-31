/**
 * 全局浮层（对话框 + Toast）：portal 之外直接挂在路由根，
 * 状态源在 ui/dialog.ts 与 ui/toast.ts，经 useSyncExternalStore 订阅。
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { dialogCancel, dialogOk, getDialogState, setDialogValue, subscribeDialog } from '../ui/dialog'
import { getToastState, subscribeToast } from '../ui/toast'
import './overlay.css'

export function AppDialog() {
  const state = useSyncExternalStore(subscribeDialog, getDialogState)
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开时聚焦并预选文件名主体（不含扩展名），方便直接输入替换
  useEffect(() => {
    if (!state.visible || !state.showInput) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    const dot = input.value.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length)
  }, [state.visible, state.showInput])

  if (!state.visible) return null

  function onKeydown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      dialogCancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      dialogOk()
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions —— Escape/Enter 快捷键挂在遮罩层
    <div className="ovl-modal" onKeyDown={onKeydown}>
      <div className="ovl-card">
        <div className="ovl-title">{state.title}</div>
        {state.message && <div className="ovl-message">{state.message}</div>}
        {state.showInput && (
          <input
            ref={inputRef}
            value={state.value}
            className="ovl-input"
            type="text"
            autoComplete="off"
            placeholder={state.placeholder}
            onChange={(e) => setDialogValue(e.target.value)}
          />
        )}
        <div className="ovl-actions">
          <button className="ovl-btn" onClick={dialogCancel}>取消</button>
          <button
            className={'ovl-btn ' + (state.danger ? 'danger' : 'primary')}
            onClick={dialogOk}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppToast() {
  const state = useSyncExternalStore(subscribeToast, getToastState)
  if (!state.visible) return null
  return <div className={'ovl-toast' + (state.error ? ' error' : '')}>{state.message}</div>
}
