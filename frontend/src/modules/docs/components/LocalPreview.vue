<script setup>
import { ref, watch, nextTick } from 'vue'
import { useDocsStore } from '../store'

const store = useDocsStore()
const contentEl = ref(null)

// 本地文件内容仅在浏览器中渲染，不上传
watch(() => store.localFile, async (file) => {
  if (!file) return
  await nextTick()
  if (contentEl.value) {
    window.Vditor.preview(contentEl.value, file.content, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      hljs: { lineNumber: false, style: 'github' },
    })
  }
}, { immediate: true })
</script>

<template>
  <div v-if="store.localFile" class="local-preview">
    <div class="lp-bar">
      <span class="lp-title">{{ store.localFile.name }}</span>
      <span class="lp-tip">（文件仅在浏览器中打开，未上传）</span>
      <div class="lp-actions">
        <button class="top-btn primary" @click="store.importLocalFile()">导入到文档库</button>
        <button class="top-btn" @click="store.hideLocalPreview()">关闭</button>
      </div>
    </div>
    <div ref="contentEl" class="lp-content" />
  </div>
</template>
