/**
 * 文档工作区：目录 + 编辑器 + 本地预览。
 * 全局键盘（Ctrl+S 保存 / Esc 关预览）、拖拽打开本地文件、未保存离开拦截、
 * 250ms 脏刷新 + 2s 自动保存节流——交互骨架与旧 DocsView.vue 一致。
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isEditorReady, onEditorReady } from './editor'
import { DocsProvider, useDocs } from './useDocs'
import { Button, Icon, IconButton } from '../../components/ui/ui'
import Sidebar from './Sidebar'
import VditorEditor from './VditorEditor'
import LocalPreview from './LocalPreview'
import './docs.css'

export default function DocsView() {
  return (
    <DocsProvider>
      <DocsWorkspace />
    </DocsProvider>
  )
}

function DocsWorkspace() {
  const { state, actions } = useDocs()
  const location = useLocation()
  const navigate = useNavigate()
  const [dropActive, setDropActive] = useState(false)
  const dirtyTimer = useRef(0)
  const autosaveTimer = useRef(0)
  const dragDepth = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  // 编辑器就绪信号：Lute（3.7MB，Pages 免 gzip + 跨境慢链路）下载期间以纯文本先读
  const [editorReady, setEditorReady] = useState(isEditorReady())
  useEffect(() => onEditorReady(() => setEditorReady(true)), [])

  useEffect(() => {
    void actions.loadTree()
    // eslint 挂载一次语义：actions 为稳定引用
  }, [actions])

  // 命令面板直达：/docs 带 {openDoc: path} 状态时打开该文档，然后清掉状态防重放
  useEffect(() => {
    const target = (location.state as { openDoc?: string } | null)?.openDoc
    if (!target) return
    void actions.openDoc(target)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, actions, navigate])

  function onEditorInput() {
    window.clearTimeout(dirtyTimer.current)
    dirtyTimer.current = window.setTimeout(() => actions.refreshDirty(), 250)
    window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => void actions.autosave(), 2000)
  }

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault()
        void actions.saveDoc()
      }
      if (event.key === 'Escape' && state.localFile) {
        actions.hideLocalPreview()
      }
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (state.dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    function onDragEnter(event: DragEvent) {
      if (event.dataTransfer && [...event.dataTransfer.types].includes('Files')) {
        dragDepth.current++
        setDropActive(true)
      }
    }
    function onDragLeave() {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDropActive(false)
    }
    function onDragOver(event: DragEvent) {
      event.preventDefault()
    }
    function onDrop(event: DragEvent) {
      event.preventDefault()
      dragDepth.current = 0
      setDropActive(false)
      if (event.dataTransfer && event.dataTransfer.files.length > 0) {
        void actions.openLocalFile(event.dataTransfer.files[0])
      }
    }
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.clearTimeout(dirtyTimer.current)
      window.clearTimeout(autosaveTimer.current)
    }
  }, [actions, state.localFile, state.dirty])

  const saveStatusText =
    state.saveStatus === 'saving'
      ? '保存中…'
      : state.saveStatus === 'ok'
        ? state.savedAt
          ? '已保存 ' + state.savedAt
          : '已保存'
        : state.saveStatus === 'error'
          ? '自动保存失败'
          : ''

  return (
    <div className={'docp' + (state.sidebarOpen ? ' sidebar-open' : '')}>
      <header className="docp-bar">
        {/* 文件树收放全由用户手动控制（openDoc 不再自动收起）；收/放图标+提示语双态区分 */}
        <IconButton
          label={state.sidebarOpen ? '收起目录' : '展开目录'}
          onClick={() => actions.setSidebarOpen(!state.sidebarOpen)}
        >
          <Icon name={state.sidebarOpen ? 'close' : 'menu'} size={16} />
        </IconButton>
        <div className="docp-crumb">
          <span className="docp-brand">文档</span>
          <span className="docp-sep" aria-hidden="true">/</span>
          <span className="docp-doc" title={state.currentPath}>
            {state.currentPath || '还没打开文档'}
            {state.dirty && <i className="docp-dirty" title="还没保存" />}
          </span>
          {saveStatusText && (
            <span className={'docp-save' + (state.saveStatus === 'error' ? ' err' : '')}>{saveStatusText}</span>
          )}
        </div>
        <div className="docp-actions">
          {state.currentPath && (
            <Button variant="primary" size="sm" title="Ctrl+S" onClick={() => void actions.saveDoc()}>保存</Button>
          )}
          <Button variant="ghost" size="sm" title="打开或新建今天的日志" onClick={() => void actions.openToday()}>
            <Icon name="clock" size={14} />今日日志
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="选择本地 Markdown 文件在浏览器中预览"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="file" size={14} />打开本地文件
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.txt"
          className="docp-file"
          onChange={(event) => {
            void actions.openLocalFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </header>

      <div className="docp-layout">
        <div className="docp-backdrop" onClick={() => actions.setSidebarOpen(false)} />
        <Sidebar />
        <main className="docp-main">
          <VditorEditor onInput={onEditorInput} />
          {/* 空态：没有打开文档时给一张真正的入口卡，而不是只留编辑器 placeholder */}
          {!state.currentPath && !state.localFile && (
            <div className="docp-welcome">
              <div className="docp-welcome-inner">
                <span className="docp-welcome-mark" aria-hidden="true"><Icon name="file" size={22} /></span>
                <span className="docp-welcome-eyebrow">Docs / Workspace</span>
                <h2 className="docp-welcome-title">从一页空白开始</h2>
                <p className="docp-welcome-text">
                  在左侧选择文档，或新建一篇；也可以拖入本地 Markdown 文件预览。
                </p>
                <div className="docp-welcome-actions">
                  <Button variant="primary" onClick={() => void actions.newFile('')}>
                    <Icon name="file-plus" size={14} />新建文档
                  </Button>
                  <Button onClick={() => void actions.openToday()}><Icon name="clock" size={14} />今日日志</Button>
                  <Button variant="ghost" onClick={() => fileInput.current?.click()}>
                    <Icon name="file" size={14} />打开本地文件
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* 只在「已打开文档且引擎未就绪」时覆盖：未打开文档时让 Vditor 骨架
              （工具栏+placeholder，无需 Lute 即渲染）直接可见，避免整片空白 */}
          {!editorReady && state.currentPath && (
            <div className="docp-boot" role="status">
              <pre className="docp-boot-text">{state.savedContent}</pre>
              <div className="docp-boot-hint">
                <i className="docp-boot-dot" />
                编辑器还在加载，先展示纯文本，就绪后自动切换。
              </div>
            </div>
          )}
        </main>
        <LocalPreview />
      </div>

      {dropActive && (
        <div className="docp-drop">
          <div className="docp-drop-box">松开鼠标，预览这个 Markdown 文件</div>
        </div>
      )}
    </div>
  )
}
