/** 本地文件预览：浏览器内渲染（Vditor.preview），不上传 */
import { useEffect, useRef } from 'react'
import { useDocs } from './useDocs'
import { currentTheme } from '../../theme'
import { Button } from '../../components/ui/ui'

export default function LocalPreview() {
  const { state, actions } = useDocs()
  const contentRef = useRef<HTMLDivElement>(null)
  const localFile = state.localFile

  useEffect(() => {
    if (!localFile || !contentRef.current) return
    window.Vditor.preview(contentRef.current, localFile.content, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      hljs: { lineNumber: false, style: currentTheme() === 'dark' ? 'github-dark' : 'github' },
    })
  }, [localFile])

  if (!localFile) return null

  return (
    <div className="docp-lp">
      <div className="docp-lp-bar">
        <span className="docp-lp-title">{localFile.name}</span>
        <span className="docp-lp-tip">仅在浏览器中打开，不会上传</span>
        <div className="docp-lp-actions">
          <Button variant="primary" size="sm" onClick={() => void actions.importLocalFile()}>导入到文档库</Button>
          <Button size="sm" onClick={actions.hideLocalPreview}>关闭</Button>
        </div>
      </div>
      <div ref={contentRef} className="docp-lp-content" />
    </div>
  )
}
