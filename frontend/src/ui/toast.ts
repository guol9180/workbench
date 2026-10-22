/**
 * 全局 Toast 状态（AppToast 组件渲染）：模块级单例 + 订阅回调。
 * 单条展示 2.2s；重复调用重置计时（旧 ui/toast.js 行为一致）。
 */

export interface ToastState {
  visible: boolean
  message: string
  error: boolean
}

let state: ToastState = { visible: false, message: '', error: false }
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToastState(): ToastState {
  return state
}

export function toast(message: string, isError = false): void {
  state = { visible: true, message, error: isError }
  emit()
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    state = { ...state, visible: false }
    emit()
  }, 2200)
}
