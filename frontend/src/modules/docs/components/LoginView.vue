<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const error = ref('')
const submitting = ref(false)
const inputEl = ref(null)

onMounted(() => inputEl.value && inputEl.value.focus())

async function submit() {
  if (!password.value || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await auth.login(password.value)
    router.push('/docs')
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-view">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-logo">
        <svg width="56" height="56" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="login-logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#1e3a8a"/>
              <stop offset="0.6" stop-color="#2563eb"/>
              <stop offset="1" stop-color="#3b82f6"/>
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="112" fill="url(#login-logo-g)"/>
          <polyline points="140,176 208,332 256,258 304,332 372,176"
                    fill="none" stroke="#ffffff" stroke-width="60"
                    stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1>工作台 · 在线文档</h1>
      <input
        ref="inputEl"
        v-model="password"
        type="password"
        placeholder="请输入访问密码"
        autocomplete="current-password"
      >
      <button type="submit" :disabled="submitting">登 录</button>
      <div class="login-error">{{ error }}</div>
    </form>
  </div>
</template>
