/**
 * Vditor 编辑器封装（IR 模式）。
 * Vditor 由 index.html 的本地 vendored 脚本提供（window.Vditor）；
 * 就绪协议见 editor.ts——句柄先建、异步就绪后补挂，双向不阻塞。
 * 卸载时先解绑适配层再销毁实例：迟到的 after 回调会因句柄不符被忽略。
 */
import { useEffect, useRef, useState } from 'react'
import { attachEditor, markEditorReady } from './editor'
import { useTheme } from '../../theme'
import './editor.css'

export default function VditorEditor({ onInput }: { onInput: () => void }) {
  const elRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const vditorRef = useRef<VditorInstance | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const onInputRef = useRef(onInput)
  useEffect(() => {
    onInputRef.current = onInput
  })

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    let suppressDirty = false
    const handle = {
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
    const vditor = new window.Vditor(el, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      mode: 'ir',
      theme,
      height: '100%',
      cache: { enable: false },
      placeholder: '选择左侧文档开始编辑，或点击「今日工作」新建日志…',
      preview: { hljs: { lineNumber: false, style: theme === 'dark' ? 'github-dark' : 'github' } },
      toolbar: [
        'headings', 'bold', 'italic', 'strike', '|',
        'list', 'ordered-list', 'check', 'quote', 'code', 'inline-code', 'link', 'table', '|',
        'undo', 'redo', '|', 'edit-mode', 'preview', 'outline', 'fullscreen',
      ],
      toolbarConfig: { pin: true },
      input: () => {
        if (suppressDirty) return
        onInputRef.current()
      },
      after: () => {
        setEditorReady(true)
        markEditorReady(handle)
      },
    })
    vditorRef.current = vditor
    attachEditor(handle)
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
    const inst = vditorRef.current as unknown as { setTheme?: (t: string) => void } | null
    try {
      inst?.setTheme?.(theme)
    } catch {
      // vendored setTheme 行为差异可忽略：重建路径已保证最终一致
    }
  }, [theme])

  return (
    <div className="docp-editor-wrap">
      <div ref={elRef} className="docp-editor" />
      {/* Lute 引擎就绪前的诚实反馈：预载命中时几乎不出现，弱网/直链深跳时兜底 */}
      {!editorReady && (
        <div className="docp-editor-loading" role="status">
          <i className="docp-editor-loading-dot" />
          编辑器引擎加载中…
        </div>
      )}
    </div>
  )
}
