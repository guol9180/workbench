/**
 * 全局对话框状态（AppDialog 组件渲染）：框架无关的模块级单例。
 * showDialog 返回 Promise——input 时 resolve 输入值（取消为 null），否则 resolve true/false。
 * 与旧 Vue 版 (ui/dialog.js) 行为一致，仅把响应式换成订阅回调。
 */
import { toast } from './toast'

export interface DialogOptions {
  title: string
  message?: string
  input?: boolean
  value?: string
  placeholder?: string
  confirmText?: string
  danger?: boolean
}

export interface DialogState {
  visible: boolean
  title: string
  message: string
  showInput: boolean
  value: string
  placeholder: string
  confirmText: string
  danger: boolean
}

const initialDialogState: DialogState = {
  visible: false,
  title: '',
  message: '',
  showInput: false,
  value: '',
  placeholder: '',
  confirmText: '确定',
  danger: false,
}

let state: DialogState = initialDialogState
let resolver: ((result: string | boolean | null) => void) | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((notifyListener) => notifyListener())
}

export function subscribeDialog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDialogState(): DialogState {
  return state
}

export function showDialog(options: DialogOptions): Promise<string | boolean | null> {
  state = {
    visible: true,
    title: options.title,
    message: options.message ?? '',
    showInput: !!options.input,
    value: options.value ?? '',
    placeholder: options.placeholder ?? '',
    confirmText: options.confirmText ?? '确定',
    danger: !!options.danger,
  }
  emit()
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export async function showConfirm(options: Omit<DialogOptions, 'input' | 'value' | 'placeholder'>): Promise<boolean> {
  return !!(await showDialog({ ...options, confirmText: options.confirmText ?? '确定' }))
}

export function dialogOk(): void {
  if (state.showInput && !state.value.trim()) {
    toast('名称不能为空', true)
    return
  }
  close(state.showInput ? state.value.trim() : true)
}

/** 输入框受控更新（AppDialog 的 onChange 直接调用） */
export function setDialogValue(value: string): void {
  state = { ...state, value }
  emit()
}

export function dialogCancel(): void {
  close(null)
}

function close(value: string | boolean | null): void {
  state = { ...state, visible: false }
  emit()
  if (resolver) {
    resolver(value)
    resolver = null
  }
}
