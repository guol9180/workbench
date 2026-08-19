import { reactive } from 'vue'

/** 全局 Toast 状态（AppToast.vue 渲染） */
const state = reactive({
  visible: false,
  message: '',
  error: false,
})

let timer = null

export function toast(msg, isError) {
  state.message = msg
  state.error = !!isError
  state.visible = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    state.visible = false
  }, 2200)
}

export function useToast() {
  return state
}
