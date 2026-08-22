<script setup>
/**
 * Vditor 编辑器封装。Vditor 由 index.html 中的本地 vendored 脚本提供（window.Vditor），
 * cdn 选项指向同目录的 vendor 副本，GitHub Pages 上自包含、无外部 CDN。
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { attachEditor, markEditorReady } from '../editor'

const emit = defineEmits(['input'])

const el = ref(null)
let vditor = null
let suppressDirty = false

onMounted(() => {
  vditor = new window.Vditor(el.value, {
    cdn: import.meta.env.BASE_URL + 'vendor/vditor',
    lang: 'zh_CN',
    mode: 'ir',
    height: '100%',
    cache: { enable: false },
    placeholder: '选择左侧文档开始编辑，或点击「今日工作」新建日志…',
    preview: { hljs: { lineNumber: false, style: 'github' } },
    toolbar: [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'quote', 'code', 'inline-code', 'link', 'table', '|',
      'undo', 'redo', '|', 'edit-mode', 'preview', 'outline', 'fullscreen',
    ],
    toolbarConfig: { pin: true },
    input: () => {
      if (suppressDirty) return
      emit('input')
    },
    after: () => {
      markEditorReady()
    },
  })
  attachEditor({
    getValue: () => (vditor ? vditor.getValue() : ''),
    setValue: (text) => {
      if (!vditor) return
      suppressDirty = true
      vditor.setValue(text == null ? '' : text)
      setTimeout(() => {
        suppressDirty = false
      }, 0)
    },
  })
})

onBeforeUnmount(() => {
  attachEditor(null)
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
})
</script>

<template>
  <div ref="el" class="editor" />
</template>
