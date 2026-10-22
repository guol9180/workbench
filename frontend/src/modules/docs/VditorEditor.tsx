/**
 * Vditor 编辑器封装（IR 模式）。
 * Vditor 由 index.html 的本地 vendored 脚本提供（window.Vditor）；
 * 就绪协议见 editor.ts——句柄先建、异步就绪后补挂，双向不阻塞。
 * 卸载时先解绑适配层再销毁实例：迟到的 after 回调会因句柄不符被忽略。
 */
import { useEffect, useRef } from 'react'
import { attachEditor, markEditorReady } from './editor'
import './editor.css'

export default function VditorEditor({ onInput }: { onInput: () => void }) {
  const elRef = useRef<HTMLDivElement>(null)
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
      theme: 'dark',
      height: '100%',
      cache: { enable: false },
      placeholder: '选择左侧文档开始编辑，或点击「今日工作」新建日志…',
      preview: { hljs: { lineNumber: false, style: 'github-dark' } },
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
      after: () => markEditorReady(handle),
    })
    attachEditor(handle)
    return () => {
      attachEditor(null)
      vditor.destroy()
    }
  }, [])

  return <div ref={elRef} className="docp-editor" />
}
