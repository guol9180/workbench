/**
 * 本地文件预览/编辑：浏览器内渲染 Markdown，不上传。
 * 通过 File System Access 打开的 file handle 可以写回原文件；拖入文件则走另存/下载。
 */
import { useEffect, useRef, useState } from 'react'
import { useDocs } from './useDocs'
import { currentTheme } from '../../theme'
import { Button, Icon } from '../../components/ui/ui'

export default function LocalPreview() {
  const { state, actions } = useDocs()
  const contentRef = useRef<HTMLDivElement>(null)
  const localFile = state.localFile
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setEditing(false)
  }, [localFile?.name])

  useEffect(() => {
    if (!localFile || !contentRef.current || editing) return
    window.Vditor.preview(contentRef.current, localFile.content, {
      cdn: import.meta.env.BASE_URL + 'vendor/vditor',
      lang: 'zh_CN',
      hljs: { lineNumber: false, style: currentTheme() === 'dark' ? 'github-dark' : 'github' },
    })
  }, [localFile, editing])

  if (!localFile) return null

  return (
    <div className="docp-lp">
      <div className="docp-lp-bar">
        <span className="docp-lp-title">{localFile.name}</span>
        <span className={'doc-local-badge' + (localFile.dirty ? ' is-dirty' : '')}>
          {localFile.dirty ? '未保存' : '本地文件'}
        </span>
        <span className="docp-lp-tip">
          {localFile.handle ? '编辑后可直接写回原文件' : '编辑后可另存到本地'}
        </span>
        <div className="docp-lp-actions">
          <Button size="sm" onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'file' : 'pencil'} size={14} />
            {editing ? '预览' : '继续编辑'}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void actions.saveLocalFile()}>
            <Icon name="save" size={14} />
            {localFile.handle ? '保存到本地' : '另存为…'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void actions.importLocalFile()}>导入文档库</Button>
          <Button size="sm" variant="ghost" onClick={() => void actions.hideLocalPreview()}>关闭</Button>
        </div>
      </div>
      {editing ? (
        <textarea
          className="docp-lp-editor"
          value={localFile.content}
          aria-label="本地 Markdown 内容"
          onChange={(event) => actions.updateLocalContent(event.target.value)}
        />
      ) : (
        <div ref={contentRef} className="docp-lp-content" />
      )}
    </div>
  )
}
