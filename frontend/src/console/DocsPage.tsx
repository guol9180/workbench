/** 在线文档：文档列表 + 编辑器/预览 + 本地 Markdown 写回。与参考稿同布局。 */
import { useEffect, useRef, useState } from 'react'
import { fmtStamp, renderMarkdown } from './data'
import type { Doc, LocalDoc, LocalFileHandle } from './data'
import Icon from './Icon'

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: { multiple?: boolean; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<Array<LocalFileHandle & { getFile: () => Promise<File> }>>
  showSaveFilePicker?: (options?: { suggestedName?: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<LocalFileHandle>
}

const PICKER_TYPES = [{ description: 'Markdown / 文本', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } }]

export default function DocsPage({
  docs,
  activeDocId,
  localDoc,
  localSaveState,
  docPreview,
  listCollapsed,
  saveState,
  onOpenDoc,
  onNewDoc,
  onDeleteDoc,
  onUpdateDoc,
  onUpdateLocalContent,
  onOpenLocalFile,
  onSaveLocal,
  onCloseLocal,
  onTogglePreview,
  onToggleList,
  onSearchDocs,
  filteredDocIds,
}: {
  docs: Doc[]
  activeDocId: string | null
  localDoc: LocalDoc | null
  localSaveState: string
  docPreview: boolean
  listCollapsed: boolean
  saveState: string
  onOpenDoc: (id: string) => void
  onNewDoc: () => void
  onDeleteDoc: () => void
  onUpdateDoc: (id: string, patch: Partial<Doc>) => void
  onUpdateLocalContent: (content: string) => void
  onOpenLocalFile: (file: File, handle?: LocalFileHandle | null) => void
  onSaveLocal: () => void
  onCloseLocal: () => void
  onTogglePreview: () => void
  onToggleList: () => void
  onSearchDocs: (query: string) => void
  /** 服务端搜索结果（文档 id/path 列表）；undefined = 演示模式本地过滤，null = 服务端模式未搜索，数组 = 命中清单 */
  filteredDocIds?: string[] | null
}) {
  const [docSearch, setDocSearch] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeDoc = docs.find((doc) => doc.id === activeDocId) ?? null
  const isLocal = activeDocId === 'local' && !!localDoc
  const keyword = docSearch.trim().toLowerCase()
  const visibleDocs = filteredDocIds === undefined
    ? docs.filter((doc) => !keyword || doc.title.toLowerCase().includes(keyword) || doc.content.toLowerCase().includes(keyword))
    : filteredDocIds === null
      ? docs
      : docs.filter((doc) => filteredDocIds.includes(doc.id))
  const localMatches = localDoc && (!keyword || `${localDoc.name} ${localDoc.content}`.toLowerCase().includes(keyword))
  const value = isLocal ? localDoc?.content ?? '' : activeDoc?.content ?? ''
  const wordCount = value.replace(/\s+/g, '').length
  const updated = isLocal
    ? localDoc?.dirty ? '本地文件 · 有未保存改动' : `本地文件 · ${fmtStamp(new Date(localDoc?.updatedAt ?? Date.now()))}`
    : activeDoc ? (activeDoc.updatedAt > 0 ? `${fmtStamp(new Date(activeDoc.updatedAt))} 更新` : '服务端文档') : ''

  useEffect(() => {
    setDeleteArmed(false)
  }, [activeDocId])

  useEffect(() => {
    if (!deleteArmed) return
    const timer = window.setTimeout(() => setDeleteArmed(false), 3200)
    return () => window.clearTimeout(timer)
  }, [deleteArmed])

  async function chooseLocalFile() {
    const pickerWindow = window as FilePickerWindow
    if (typeof pickerWindow.showOpenFilePicker !== 'function') {
      fileInput.current?.click()
      return
    }
    try {
      const [handle] = await pickerWindow.showOpenFilePicker({ multiple: false, types: PICKER_TYPES })
      if (!handle) return
      const file = await handle.getFile()
      onOpenLocalFile(file, handle)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        window.alert(error instanceof Error ? error.message : String(error))
      }
    }
  }

  useEffect(() => {
    function isFileDrag(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }
    function onDragEnter(event: DragEvent) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      dragDepth.current += 1
      setDropActive(true)
    }
    function onDragLeave(event: DragEvent) {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!event.relatedTarget || dragDepth.current === 0) {
        dragDepth.current = 0
        setDropActive(false)
      }
    }
    function onDragOver(event: DragEvent) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    function onDrop(event: DragEvent) {
      if (!isFileDrag(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDropActive(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) onOpenLocalFile(file)
    }
    function onKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && isLocal) {
        event.preventDefault()
        onSaveLocal()
      }
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (localDoc?.dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [isLocal, localDoc?.dirty, onOpenLocalFile, onSaveLocal])

  function deleteOrClose() {
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    setDeleteArmed(false)
    if (isLocal) onCloseLocal()
    else onDeleteDoc()
  }

  return (
    <section className="page" aria-labelledby="docs-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="docs-title">在线文档</h1>
          <p className="page-desc">编辑在线文档，也可以打开或拖入本地 Markdown 文件预览、修改并写回。</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" type="button" onClick={() => void chooseLocalFile()}><Icon name="file" size={17} />打开本地文件</button>
          <input ref={fileInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onOpenLocalFile(file) }} />
          <button className="btn btn-ghost" type="button" aria-expanded={!listCollapsed} onClick={onToggleList}>
            <Icon name={listCollapsed ? 'expand' : 'collapse'} size={16} />
            {listCollapsed ? '展开列表' : '收起列表'}
          </button>
          <button className="btn btn-primary" type="button" onClick={onNewDoc}><Icon name="file-plus" size={17} />新建文档</button>
        </div>
      </div>

      <div className={'doc-layout' + (listCollapsed ? ' is-list-collapsed' : '')}>
        <section className="panel doc-list-panel" aria-labelledby="doc-list-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="doc-list-title">文档列表</h2>
              <p className="panel-sub">共 {docs.length} 篇文档{localDoc ? ' · 1 个本地文件' : ''}</p>
            </div>
          </div>
          <div className="search-field" style={{ marginTop: 14 }}>
            <span className="search-glyph-static" aria-hidden="true"><Icon name="search" size={16} /></span>
            <input className="input" type="search" value={docSearch} placeholder="搜索文档标题" aria-label="搜索文档" onChange={(event) => { setDocSearch(event.target.value); onSearchDocs(event.target.value) }} />
          </div>
          <div className="doc-list">
            {localMatches && localDoc && (
              <button className={'doc-item is-local' + (activeDocId === 'local' ? ' is-active' : '')} type="button" onClick={() => onOpenDoc('local')}>
                <span className="doc-item-body">
                  <span className="doc-item-title">{localDoc.name}<span className="doc-local-tag">本地</span></span>
                  <span className="doc-item-meta">{localDoc.dirty ? '本地文件 · 有未保存改动' : `本地文件 · ${fmtStamp(new Date(localDoc.updatedAt))}`}</span>
                </span>
              </button>
            )}
            {visibleDocs.map((doc) => (
              <button key={doc.id} className={'doc-item' + (doc.id === activeDocId ? ' is-active' : '')} type="button" onClick={() => onOpenDoc(doc.id)}>
                <span className="doc-item-body">
                  <span className="doc-item-title">{doc.title}</span>
                  <span className="doc-item-meta">{doc.updatedAt > 0 ? `${fmtStamp(new Date(doc.updatedAt))} 更新` : '服务端文档'}</span>
                </span>
              </button>
            ))}
          </div>
          {visibleDocs.length === 0 && !localMatches && (
            <div className="empty-state">
              <p className="empty-title">没有匹配的文档</p>
              <p className="empty-desc">换个关键词，或新建一份文档。</p>
            </div>
          )}
        </section>

        <section className="panel" aria-label="文档编辑器">
          {activeDoc || localDoc ? (
            <div className="doc-editor">
              <input className="doc-title-input" type="text" value={isLocal ? localDoc?.name ?? '' : activeDoc?.title ?? ''} readOnly={isLocal} aria-label="文档标题" placeholder="文档标题" onChange={(event) => { if (!isLocal && activeDoc) onUpdateDoc(activeDoc.id, { title: event.target.value.trim() || '未命名文档' }) }} />
              <div className="doc-meta">
                <span>{isLocal ? (localDoc?.dirty ? '本地文件有改动，保存后写回或另存' : localSaveState || '本地文件已加载') : saveState || '已加载'}</span>
                {isLocal && <span className="doc-local-badge">本地文件</span>}
                <span>{wordCount} 字</span>
                <span>{updated}</span>
              </div>
              <div className="toolbar" style={{ marginTop: 0 }}>
                <button className="btn btn-ghost" type="button" aria-pressed={docPreview} onClick={onTogglePreview}>
                  <Icon name="eye" size={16} />
                  {docPreview ? '继续编辑' : '预览'}
                </button>
                {isLocal && (
                  <button className="btn btn-primary" type="button" onClick={onSaveLocal}>
                    {localDoc?.handle ? '保存到本地' : (typeof (window as FilePickerWindow).showSaveFilePicker === 'function' ? '另存为…' : '下载副本')}
                  </button>
                )}
                <button className={'btn btn-danger' + (deleteArmed ? ' is-armed' : '')} type="button" onClick={deleteOrClose}>
                  {deleteArmed ? (isLocal ? '确认关闭？' : '确认删除？') : (isLocal ? '关闭本地文件' : '删除文档')}
                </button>
              </div>
              {docPreview ? (
                <div className="doc-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<p style="color:var(--ink-3)">暂无内容</p>' }} />
              ) : (
                <textarea
                  className="doc-content"
                  aria-label="文档内容"
                  value={value}
                  placeholder="支持简单的 Markdown：# 标题、**加粗**、`代码`、- 列表"
                  onChange={(event) => {
                    if (isLocal) onUpdateLocalContent(event.target.value)
                    else if (activeDoc) onUpdateDoc(activeDoc.id, { content: event.target.value })
                  }}
                />
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-title">选择左侧文档开始编辑</p>
              <p className="empty-desc">新建文档自动保存到浏览器；也可以打开或拖入本地 Markdown 文件。</p>
            </div>
          )}
        </section>
      </div>

      {dropActive && (
        <div className="doc-drop">
          <div className="doc-drop-box">
            <strong>松开鼠标，打开 Markdown 文件</strong>
            <span>支持 .md / .markdown / .txt，编辑后可写回原文件或另存</span>
          </div>
        </div>
      )}
    </section>
  )
}
