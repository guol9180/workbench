/** 本地文件预览：浏览器内渲染（Vditor.preview），不上传 */
import { useEffect, useRef } from 'react'
import { useDocs } from './useDocs'

export default function LocalPreview() {
  const { state, actions } = useDocs()
  const contentRef = useRef<HTMLDivElement>(null)
  const file = state.localFile

  useEffect(() => {
    if (!file || !contentRef.current) return
    window.Vditor.preview(contentRef.current, file.content, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      hljs: { lineNumber: false, style: 'github-dark' },
    })
  }, [file])

  if (!file) return null

  return (
    <div className="docp-lp">
      <div className="docp-lp-bar">
        <span className="docp-lp-title">{file.name}</span>
        <span className="docp-lp-tip">文件仅在浏览器中打开，未上传</span>
        <div className="docp-lp-actions">
          <button className="docp-btn primary" onClick={() => void actions.importLocalFile()}>
            导入到文档库
          </button>
          <button className="docp-btn" onClick={actions.hideLocalPreview}>
            关闭
          </button>
        </div>
      </div>
      <div ref={contentRef} className="docp-lp-content" />
    </div>
  )
}
