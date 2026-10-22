import type { DocNode, SearchHit } from './api'
import { docsApi } from './api'
import { baseName, extAllowed, parentOf, readLocalFile, todayLogPath, todayLogTemplate } from './util'
import { getEditorValue, hasEditor, isEditorReady, setEditorValue } from './editor'
import { showDialog, showConfirm } from '../../ui/dialog'
import { toast } from '../../ui/toast'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/**
 * docs 模块状态与业务编排（旧 store.js 的 React 移植）：
 * 文件树、当前文档、脏状态与自动保存、搜索、本地预览。
 * 状态收进单个 useState 对象 + ref 镜像：异步动作（保存/建文件链）要读最新值，
 * 镜像让动作可以整体用 useCallback 包成稳定引用，组件树不必反复订阅。
 */

export interface DocsState {
  tree: DocNode | null
  currentPath: string
  savedContent: string
  dirty: boolean
  saving: boolean
  saveStatus: '' | 'saving' | 'ok' | 'error'
  savedAt: string
  expanded: Set<string>
  searching: boolean
  searchResults: SearchHit[]
  searchSummary: string
  localFile: { name: string; content: string } | null
  sidebarOpen: boolean
}

const EXPANDED_KEY = 'wb-expanded'

function loadExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveExpanded(set: Set<string>): void {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]))
}

function clockNow(): string {
  const d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/** 未认证跳转由 http.ts 统一处理（清 token 并跳接入页），此处不再 toast 刷屏 */
function notifyError(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e)
  if (!message.startsWith('未认证')) toast(message, true)
}

export interface DocsActions {
  loadTree: () => Promise<void>
  toggleDir: (node: DocNode) => void
  expand: (path: string) => void
  openDoc: (path: string) => Promise<void>
  refreshDirty: () => void
  saveDoc: () => Promise<void>
  autosave: () => Promise<void>
  newFile: (dirPath: string) => Promise<void>
  newDir: (dirPath: string) => Promise<void>
  renameNode: (node: DocNode) => Promise<void>
  deleteNode: (node: DocNode) => Promise<void>
  openToday: () => Promise<void>
  doSearch: (q: string) => Promise<void>
  backToTree: () => void
  openSearchHit: (path: string) => Promise<void>
  openLocalFile: (file: File | null | undefined) => Promise<void>
  hideLocalPreview: () => void
  importLocalFile: () => Promise<void>
  setSidebarOpen: (open: boolean) => void
}

export interface DocsStore {
  state: DocsState
  actions: DocsActions
}

function useDocsStoreValue(): DocsStore {
  const [state, setState] = useState<DocsState>({
    tree: null,
    currentPath: '',
    savedContent: '',
    dirty: false,
    saving: false,
    saveStatus: '',
    savedAt: '',
    expanded: loadExpanded(),
    searching: false,
    searchResults: [],
    searchSummary: '',
    localFile: null,
    sidebarOpen: false,
  })

  // 异步链路里的「最新状态」读取口
  const ref = useRef(state)
  ref.current = state

  const patch = useCallback((p: Partial<DocsState>) => {
    setState((s) => ({ ...s, ...p }))
  }, [])

  const loadTree = useCallback(async () => {
    try {
      const tree = await docsApi.tree()
      patch({ tree })
    } catch (e) {
      notifyError(e)
    }
  }, [patch])

  const expand = useCallback(
    (path: string) => {
      if (!path) return
      const next = new Set(ref.current.expanded)
      next.add(path)
      saveExpanded(next)
      patch({ expanded: next })
    },
    [patch],
  )

  const toggleDir = useCallback(
    (node: DocNode) => {
      const next = new Set(ref.current.expanded)
      if (next.has(node.path)) next.delete(node.path)
      else next.add(node.path)
      saveExpanded(next)
      patch({ expanded: next })
    },
    [patch],
  )

  /** 展开路径的所有祖先目录（如新建日志后展开 日志/ 与 日志/2026-10/） */
  const expandAncestors = useCallback(
    (path: string) => {
      const next = new Set(ref.current.expanded)
      let dir = parentOf(path)
      while (dir) {
        next.add(dir)
        dir = parentOf(dir)
      }
      saveExpanded(next)
      patch({ expanded: next })
    },
    [patch],
  )

  const openDoc = useCallback(
    async (path: string) => {
      try {
        const doc = await docsApi.getFile(path)
        patch({
          currentPath: doc.path,
          savedContent: doc.content ?? '',
          dirty: false,
          saveStatus: '',
          savedAt: '',
          localFile: null,
          sidebarOpen: false,
        })
        setEditorValue(doc.content)
      } catch (e) {
        notifyError(e)
      }
    },
    [patch],
  )

  const refreshDirty = useCallback(() => {
    if (!hasEditor()) return
    patch({ dirty: getEditorValue() !== ref.current.savedContent })
  }, [patch])

  const suggestNewName = useCallback(() => {
    const dir = ref.current.currentPath ? parentOf(ref.current.currentPath) : ''
    return dir ? dir + '/未命名.md' : '未命名.md'
  }, [])

  const saveDoc = useCallback(async () => {
    if (!isEditorReady()) return
    try {
      const content = getEditorValue()
      let target = ref.current.currentPath
      if (!target) {
        const name = await showDialog({
          title: '保存文档',
          input: true,
          value: suggestNewName(),
          placeholder: '可含子目录，如：笔记/idea.md',
          confirmText: '保存',
        })
        if (!name || typeof name !== 'string') return
        target = extAllowed(name) ? name : name + '.md'
        await docsApi.createFile(target, content)
      } else {
        await docsApi.saveFile(target, content)
      }
      patch({ currentPath: target, savedContent: content, dirty: false, saveStatus: 'ok', savedAt: clockNow() })
      await loadTree()
      toast('已保存')
    } catch (e) {
      notifyError(e)
    }
  }, [loadTree, patch, suggestNewName])

  /**
   * 静默自动保存：仅限已命名文档（未命名仍走手动保存弹命名框）。
   * 失败不弹 toast（顶栏状态字提示），避免断网时连续输入刷屏。
   * 保存期间若又有输入，落定后 1 秒串行补存，不并发。
   */
  const autosaveRef = useRef<(() => Promise<void>) | undefined>(undefined)
  const autosave = useCallback(async () => {
    const s = ref.current
    if (!isEditorReady() || s.saving || !s.currentPath || !s.dirty) return
    patch({ saving: true, saveStatus: 'saving' })
    try {
      const content = getEditorValue()
      await docsApi.saveFile(s.currentPath, content)
      patch({ savedContent: content, saving: false })
      // 保存期间有输入则保持脏标记，供补存判断
      patch({ dirty: getEditorValue() !== content, saveStatus: 'ok', savedAt: clockNow() })
      if (getEditorValue() !== content) {
        setTimeout(() => void autosaveRef.current?.(), 1000)
      }
    } catch {
      patch({ saving: false, saveStatus: 'error' })
    }
  }, [patch])
  autosaveRef.current = autosave

  const newFile = useCallback(
    async (dirPath: string) => {
      const base = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文档' : '新建文档',
        input: true,
        value: '未命名.md',
        placeholder: '文档名，可含子目录',
        confirmText: '创建',
      })
      if (!base || typeof base !== 'string') return
      const fixed = extAllowed(base) ? base : base + '.md'
      const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + fixed : fixed
      try {
        await docsApi.createFile(path, '# ' + baseName(fixed).replace(/\.(md|markdown|txt)$/i, '') + '\n\n')
        if (dirPath) expand(dirPath)
        await loadTree()
        await openDoc(path)
      } catch (e) {
        notifyError(e)
      }
    },
    [expand, loadTree, openDoc],
  )

  const newDir = useCallback(
    async (dirPath: string) => {
      const base = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文件夹' : '新建文件夹',
        input: true,
        value: '新建文件夹',
        placeholder: '文件夹名称',
        confirmText: '创建',
      })
      if (!base || typeof base !== 'string') return
      const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + base : base
      try {
        await docsApi.createDir(path)
        if (dirPath) expand(dirPath)
        expand(path)
        await loadTree()
        toast('文件夹已创建')
      } catch (e) {
        notifyError(e)
      }
    },
    [expand, loadTree],
  )

  const renameNode = useCallback(
    async (node: DocNode) => {
      const newName = await showDialog({
        title: '重命名「' + node.name + '」',
        input: true,
        value: node.name,
        placeholder: '新名称',
        confirmText: '重命名',
      })
      if (!newName || typeof newName !== 'string' || newName === node.name) return
      const to = parentOf(node.path) ? parentOf(node.path) + '/' + newName : newName
      try {
        await docsApi.rename(node.path, to)
        if (ref.current.currentPath === node.path) patch({ currentPath: to })
        await loadTree()
        toast('已重命名')
      } catch (e) {
        notifyError(e)
      }
    },
    [loadTree, patch],
  )

  const deleteNode = useCallback(
    async (node: DocNode) => {
      const isDir = node.type === 'dir'
      const msg = isDir ? '确定删除文件夹「' + node.path + '」及其全部内容？' : '确定删除「' + node.path + '」？'
      if (!(await showConfirm({ title: '删除确认', message: msg, confirmText: '删除', danger: true }))) return
      try {
        await docsApi.remove(node.path)
        const cur = ref.current.currentPath
        if (cur === node.path || (isDir && cur && cur.startsWith(node.path + '/'))) {
          setEditorValue('')
          patch({ currentPath: '', savedContent: '', dirty: false })
        }
        await loadTree()
        toast('已删除')
      } catch (e) {
        notifyError(e)
      }
    },
    [loadTree, patch],
  )

  const openToday = useCallback(async () => {
    const path = todayLogPath()
    try {
      await docsApi.getFile(path)
      await openDoc(path)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('未认证')) return
      try {
        await docsApi.createFile(path, todayLogTemplate())
        expandAncestors(path)
        await loadTree()
        await openDoc(path)
      } catch (err) {
        notifyError(err)
      }
    }
  }, [expandAncestors, loadTree, openDoc])

  const doSearch = useCallback(
    async (q: string) => {
      const query = (q || '').trim()
      if (!query) return
      try {
        const hits = await docsApi.search(query)
        patch({ searching: true, searchResults: hits, searchSummary: '找到 ' + hits.length + ' 条结果' })
      } catch (e) {
        notifyError(e)
      }
    },
    [patch],
  )

  const backToTree = useCallback(() => {
    patch({ searching: false, searchResults: [] })
  }, [patch])

  const openSearchHit = useCallback(
    async (path: string) => {
      backToTree()
      await openDoc(path)
    },
    [backToTree, openDoc],
  )

  const openLocalFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return
      if (!extAllowed(file.name)) {
        toast('仅支持 .md / .markdown / .txt 文件', true)
        return
      }
      try {
        patch({ localFile: { name: file.name, content: await readLocalFile(file) } })
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), true)
      }
    },
    [patch],
  )

  const hideLocalPreview = useCallback(() => {
    patch({ localFile: null })
  }, [patch])

  const importLocalFile = useCallback(async () => {
    const file = ref.current.localFile
    if (!file) return
    const target = await showDialog({
      title: '导入到文档库',
      message: '将「' + file.name + '」保存到：',
      input: true,
      value: '导入/' + file.name,
      placeholder: '保存路径',
      confirmText: '导入',
    })
    if (!target || typeof target !== 'string') return
    try {
      await docsApi.createFile(target, file.content)
      expand(parentOf(target))
      await loadTree()
      toast('已导入：' + target)
      hideLocalPreview()
      await openDoc(target)
    } catch (e) {
      notifyError(e)
    }
  }, [expand, hideLocalPreview, loadTree, openDoc])

  const setSidebarOpen = useCallback(
    (open: boolean) => {
      patch({ sidebarOpen: open })
    },
    [patch],
  )

  const actions = useMemo<DocsActions>(
    () => ({
      loadTree,
      toggleDir,
      expand,
      openDoc,
      refreshDirty,
      saveDoc,
      autosave,
      newFile,
      newDir,
      renameNode,
      deleteNode,
      openToday,
      doSearch,
      backToTree,
      openSearchHit,
      openLocalFile,
      hideLocalPreview,
      importLocalFile,
      setSidebarOpen,
    }),
    [
      loadTree, toggleDir, expand, openDoc, refreshDirty, saveDoc, autosave, newFile, newDir,
      renameNode, deleteNode, openToday, doSearch, backToTree, openSearchHit, openLocalFile,
      hideLocalPreview, importLocalFile, setSidebarOpen,
    ],
  )

  return { state, actions }
}

const DocsContext = createContext<DocsStore | null>(null)

export function DocsProvider({ children }: { children: ReactNode }) {
  const store = useDocsStoreValue()
  return <DocsContext.Provider value={store}>{children}</DocsContext.Provider>
}

export function useDocs(): DocsStore {
  const store = useContext(DocsContext)
  if (!store) throw new Error('useDocs 必须在 DocsProvider 内使用')
  return store
}
