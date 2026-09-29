<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../../stores/auth'
import { useDocsStore } from '../store'

const router = useRouter()
const auth = useAuthStore()
const store = useDocsStore()
const fileInput = ref(null)

function openLocalPicker() {
  fileInput.value && fileInput.value.click()
}

function onFileChange(e) {
  store.openLocalFile(e.target.files[0])
  e.target.value = ''
}

function logout() {
  auth.logout()
  router.push('/login')
}

/** 自动保存的安静状态字：saving/ok/error，空串时不渲染 */
const saveStatusText = computed(() => {
  if (store.saveStatus === 'saving') return '保存中…'
  if (store.saveStatus === 'ok') return store.savedAt ? '已自动保存 ' + store.savedAt : '已保存'
  if (store.saveStatus === 'error') return '自动保存失败'
  return ''
})
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu-btn" title="菜单" @click="store.sidebarOpen = !store.sidebarOpen">☰</button>
    <div class="title-wrap">
      <span class="app-name">工作台</span>
      <span class="doc-title" :class="{ dirty: store.dirty }">{{ store.docTitle }}</span>
      <span v-if="saveStatusText" class="save-status" :class="store.saveStatus">{{ saveStatusText }}</span>
    </div>
    <div class="topbar-actions">
      <button class="top-btn primary" title="Ctrl+S" @click="store.saveDoc()">保存</button>
      <button class="top-btn" title="打开/创建今日工作日志" @click="store.openToday()">今日工作</button>
      <button class="top-btn" title="选择本地 .md 文件在浏览器中预览" @click="openLocalPicker">打开本地文件</button>
      <button class="top-btn" title="开发环境管家：新机一键安装与配置" @click="router.push('/setup')">环境管家</button>
      <button class="top-btn" title="退出登录" @click="logout">登出</button>
    </div>
    <input ref="fileInput" type="file" accept=".md,.markdown,.txt" class="file-hidden" @change="onFileChange">
  </header>
</template>
