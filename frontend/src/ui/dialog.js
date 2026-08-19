import { reactive, nextTick } from 'vue'
import { toast } from './toast'

/**
 * 全局对话框（AppDialog.vue 渲染）。
 * showDialog: input=true 时返回输入值（取消返回 null），否则返回 true/false
 */
const state = reactive({
  visible: false,
  title: '',
  message: '',
  showInput: false,
  value: '',
  placeholder: '',
  confirmText: '确定',
  danger: false,
})

let resolver = null

export function showDialog(opts) {
  state.title = opts.title || ''
  state.message = opts.message || ''
  state.showInput = !!opts.input
  state.value = opts.value || ''
  state.placeholder = opts.placeholder || ''
  state.confirmText = opts.confirmText || '确定'
  state.danger = !!opts.danger
  state.visible = true
  nextTick(() => {
    if (state.showInput) {
      // 默认选中文件名主体（不含扩展名），方便直接输入替换
      const input = document.getElementById('modal-input')
      if (input) {
        input.focus()
        const dot = input.value.lastIndexOf('.')
        input.setSelectionRange(0, dot > 0 ? dot : input.value.length)
      }
    }
  })
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export async function showConfirm(opts) {
  return !!(await showDialog({
    title: opts.title,
    message: opts.message,
    confirmText: opts.confirmText || '确定',
    danger: opts.danger,
  }))
}

export function useDialog() {
  return state
}

export function dialogOk() {
  if (state.showInput && !state.value.trim()) {
    toast('名称不能为空', true)
    return
  }
  const value = state.showInput ? state.value.trim() : true
  close(value)
}

export function dialogCancel() {
  close(null)
}

function close(value) {
  state.visible = false
  if (resolver) {
    resolver(value)
    resolver = null
  }
}
