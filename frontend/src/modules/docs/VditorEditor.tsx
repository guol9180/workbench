/**
 * Vditor 编辑器封装（IR 模式）。
 * Vditor 由 index.html 的本地 vendored 脚本提供（window.Vditor）；
 * 就绪协议见 editor.ts——句柄先建、异步就绪后补挂，双向不阻塞。
 * 卸载时先解绑适配层再销毁实例：迟到的 after 回调会因句柄不符被忽略。
 */
import { useEffect, useRef } from 'react'
import { attachEditor, markEditorReady } from './editor'
import { useTheme } from '../../theme'
import './editor.css'

export default function VditorEditor({ onInput }: { onInput: () => void }) {
  const elRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const vditorRef = useRef<VditorInstance | null>(null)
  const onInputRef = useRef(onInput)
  useEffect(() => {
    onInputRef.current = onInput
  })

  useEffect(() => {
    const mountElement = elRef.current
    if (!mountElement) return
    let suppressDirty = false
    const editorHandle = {
      getValue: () => vditor?.getValue() ?? '',
      setValue: (text: string | null | undefined) => {
        if (!vditor) return
        suppressDirty = true
        vditor.setValue(text == null ? '' : text)
        setTimeout(() => {
          suppressDirty = false
        }, 0)
      },
    }
    const vditor = new window.Vditor(mountElement, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      mode: 'ir',
      theme,
      height: '100%',
      cache: { enable: false },
      placeholder: '从左侧选择一篇开始，或点「今日日志」写今天的记录…',
      preview: { hljs: { lineNumber: false, style: theme === 'dark' ? 'github-dark' : 'github' } },
      toolbar: [
        'headings', 'bold', 'italic', 'strike', '|',
        'list', 'ordered-list', 'check', 'quote', 'code', 'inline-code', 'link', 'table', '|',
        'undo', 'redo', '|', 'edit-mode', 'preview', 'outline', 'fullscreen',
      ],
      // 文档树已在左侧，大纲默认从右侧抽屉展开，避免两个左栏叠在一起
      outline: { enable: false, position: 'right' },
      toolbarConfig: { pin: true },
      input: () => {
        if (suppressDirty) return
        onInputRef.current()
      },
      after: () => markEditorReady(editorHandle),
    })
    vditorRef.current = vditor
    attachEditor(editorHandle)
    return () => {
      attachEditor(null)
      vditor.destroy()
    }
    // 刻意只挂载一次：重建实例会丢编辑器缓冲内容。主题热切换交给下方 setTheme API，
    // hljs 风格保持初始化值（可接受的次要差异）；重新进入页面时取到新主题。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 热切换优先走实例 API（不丢编辑内容）；vendored 实现差异时静默放弃，重建路径兜底
  useEffect(() => {
    const vditorInstance = vditorRef.current as unknown as { setTheme?: (nextTheme: string) => void } | null
    try {
      vditorInstance?.setTheme?.(theme)
    } catch {
      // vendored setTheme 行为差异可忽略：重建路径已保证最终一致
    }
  }, [theme])

  // 加载反馈不在本组件：DocsView 以 boot 预览层统一覆盖（含纯文本先读），避免两层 UI
  return (
    <div className="docp-editor">
      <div ref={elRef} className="docp-editor-mount" />
    </div>
  )
}
