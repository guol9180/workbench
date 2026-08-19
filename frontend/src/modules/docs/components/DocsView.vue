<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useDocsStore } from '../store'
import TopBar from './TopBar.vue'
import Sidebar from './Sidebar.vue'
import VditorEditor from './VditorEditor.vue'
import LocalPreview from './LocalPreview.vue'

const store = useDocsStore()
const dropActive = ref(false)

let dirtyTimer = null

function onEditorInput() {
  clearTimeout(dirtyTimer)
  dirtyTimer = setTimeout(() => store.refreshDirty(), 250)
}

/* 全局键盘：Ctrl+S 保存，Esc 关闭本地预览 */
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    store.saveDoc()
  }
  if (e.key === 'Escape' && store.localFile) {
    store.hideLocalPreview()
  }
}

function onBeforeUnload(e) {
  if (store.dirty) {
    e.preventDefault()
    e.returnValue = ''
  }
}

/* 拖拽本地 .md 文件到页面任意位置 */
let dragDepth = 0

function onDragEnter(e) {
  if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
    dragDepth++
    dropActive.value = true
  }
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) {
    dropActive.value = false
  }
}

function onDragOver(e) {
  e.preventDefault()
}

function onDrop(e) {
  e.preventDefault()
  dragDepth = 0
  dropActive.value = false
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    store.openLocalFile(e.dataTransfer.files[0])
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('drop', onDrop)
  store.loadTree()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop)
  clearTimeout(dirtyTimer)
})
</script>

<template>
  <div class="app-view" :class="{ 'sidebar-open': store.sidebarOpen }">
    <TopBar />

    <div class="layout">
      <div class="sidebar-backdrop" @click="store.sidebarOpen = false" />
      <Sidebar />
      <main class="main-area">
        <VditorEditor @input="onEditorInput" />
        <LocalPreview />
      </main>
    </div>

    <div v-if="dropActive" class="drop-overlay">
      <div class="drop-box">📥 松开以预览 Markdown 文件</div>
    </div>
  </div>
</template>
