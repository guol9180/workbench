<script setup>
import { ref } from 'vue'
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
</script>

<template>
  <header class="topbar">
    <button class="icon-btn menu-btn" title="菜单" @click="store.sidebarOpen = !store.sidebarOpen">☰</button>
    <div class="title-wrap">
      <span class="app-name">工作台</span>
      <span class="doc-title" :class="{ dirty: store.dirty }">{{ store.docTitle }}</span>
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
