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
      <div class="login-logo">📘</div>
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
