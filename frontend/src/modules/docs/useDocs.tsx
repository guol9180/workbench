import type { DocNode, SearchHit } from './api'
import { docsApi } from './api'
import { baseName, extAllowed, parentOf, readLocalFile, todayLogPath, todayLogTemplate } from './util'
import { pushRecent } from './recent'
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
 * 状态收进单个 useState 对象 + stateRef 镜像：异步动作（保存/建文件链）要读最新值，
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
  const now = new Date()
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}

/** 未认证跳转由 http.ts 统一处理（清 token 并跳接入页），此处不再 toast 刷屏 */
function notifyError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
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
  doSearch: (searchText: string) => Promise<void>
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
    // 桌面宽屏默认展开目录侧栏；窄屏走抽屉态默认收起
    sidebarOpen: window.innerWidth >= 1024,
  })

  // 异步链路里的「最新状态」读取口
  const stateRef = useRef(state)
  stateRef.current = state

  const patch = useCallback((partialState: Partial<DocsState>) => {
    setState((currentState) => ({ ...currentState, ...partialState }))
  }, [])

  const loadTree = useCallback(async () => {
    try {
      const tree = await docsApi.tree()
      patch({ tree })
    } catch (error) {
      notifyError(error)
    }
  }, [patch])

  const expand = useCallback(
    (path: string) => {
      if (!path) return
      const nextExpanded = new Set(stateRef.current.expanded)
      nextExpanded.add(path)
      saveExpanded(nextExpanded)
      patch({ expanded: nextExpanded })
    },
    [patch],
  )

  const toggleDir = useCallback(
    (node: DocNode) => {
      const nextExpanded = new Set(stateRef.current.expanded)
      if (nextExpanded.has(node.path)) nextExpanded.delete(node.path)
      else nextExpanded.add(node.path)
      saveExpanded(nextExpanded)
      patch({ expanded: nextExpanded })
    },
    [patch],
  )

  /** 展开路径的所有祖先目录（如新建日志后展开 日志/ 与 日志/2026-10/） */
  const expandAncestors = useCallback(
    (path: string) => {
      const nextExpanded = new Set(stateRef.current.expanded)
      let directory = parentOf(path)
      while (directory) {
        nextExpanded.add(directory)
        directory = parentOf(directory)
      }
      saveExpanded(nextExpanded)
      patch({ expanded: nextExpanded })
    },
    [patch],
  )

  const openDoc = useCallback(
    async (path: string) => {
      try {
        const doc = await docsApi.getFile(path)
        pushRecent(doc.path)
        patch({
          currentPath: doc.path,
          savedContent: doc.content ?? '',
          dirty: false,
          saveStatus: '',
          savedAt: '',
          localFile: null,
        })
        setEditorValue(doc.content)
      } catch (error) {
        notifyError(error)
      }
    },
    [patch],
  )

  const refreshDirty = useCallback(() => {
    if (!hasEditor()) return
    patch({ dirty: getEditorValue() !== stateRef.current.savedContent })
  }, [patch])

  const suggestNewName = useCallback(() => {
    const parentDirectory = stateRef.current.currentPath ? parentOf(stateRef.current.currentPath) : ''
    return parentDirectory ? parentDirectory + '/未命名.md' : '未命名.md'
  }, [])

  const saveDoc = useCallback(async () => {
    if (!isEditorReady()) return
    try {
      const content = getEditorValue()
      let target = stateRef.current.currentPath
      if (!target) {
        const documentName = await showDialog({
          title: '保存文档',
          input: true,
          value: suggestNewName(),
          placeholder: '填写文档名，可用子目录，如 笔记/idea.md',
          confirmText: '保存',
        })
        if (!documentName || typeof documentName !== 'string') return
        target = extAllowed(documentName) ? documentName : documentName + '.md'
        await docsApi.createFile(target, content)
      } else {
        await docsApi.saveFile(target, content)
      }
      patch({ currentPath: target, savedContent: content, dirty: false, saveStatus: 'ok', savedAt: clockNow() })
      await loadTree()
      toast('已保存')
    } catch (error) {
      notifyError(error)
    }
  }, [loadTree, patch, suggestNewName])

  /**
   * 静默自动保存：仅限已命名文档（未命名仍走手动保存弹命名框）。
   * 失败不弹 toast（顶栏状态字提示），避免断网时连续输入刷屏。
   * 保存期间若又有输入，落定后 1 秒串行补存，不并发。
   */
  const autosaveRef = useRef<(() => Promise<void>) | undefined>(undefined)
  const autosave = useCallback(async () => {
    const currentState = stateRef.current
    if (!isEditorReady() || currentState.saving || !currentState.currentPath || !currentState.dirty) return
    patch({ saving: true, saveStatus: 'saving' })
    try {
      const content = getEditorValue()
      await docsApi.saveFile(currentState.currentPath, content)
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
      const enteredFileName = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文档' : '新建文档',
        input: true,
        value: '未命名.md',
        placeholder: '填写文档名，可用子目录',
        confirmText: '创建',
      })
      if (!enteredFileName || typeof enteredFileName !== 'string') return
      const fileName = extAllowed(enteredFileName) ? enteredFileName : enteredFileName + '.md'
      const documentPath = dirPath ? dirPath.replace(/\/$/, '') + '/' + fileName : fileName
      try {
        await docsApi.createFile(documentPath, '# ' + baseName(fileName).replace(/\.(md|markdown|txt)$/i, '') + '\n\n')
        if (dirPath) expand(dirPath)
        await loadTree()
        await openDoc(documentPath)
      } catch (error) {
        notifyError(error)
      }
    },
    [expand, loadTree, openDoc],
  )

  const newDir = useCallback(
    async (dirPath: string) => {
      const enteredFolderName = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文件夹' : '新建文件夹',
        input: true,
        value: '新建文件夹',
        placeholder: '文件夹名称',
        confirmText: '创建',
      })
      if (!enteredFolderName || typeof enteredFolderName !== 'string') return
      const folderPath = dirPath
        ? dirPath.replace(/\/$/, '') + '/' + enteredFolderName
        : enteredFolderName
      try {
        await docsApi.createDir(folderPath)
        if (dirPath) expand(dirPath)
        expand(folderPath)
        await loadTree()
        toast('文件夹已创建')
      } catch (error) {
        notifyError(error)
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
      const targetPath = parentOf(node.path) ? parentOf(node.path) + '/' + newName : newName
      try {
        await docsApi.rename(node.path, targetPath)
        if (stateRef.current.currentPath === node.path) patch({ currentPath: targetPath })
        await loadTree()
        toast('已重命名')
      } catch (error) {
        notifyError(error)
      }
    },
    [loadTree, patch],
  )

  const deleteNode = useCallback(
    async (node: DocNode) => {
      const isDirectory = node.type === 'dir'
      const message = isDirectory
        ? '文件夹「' + node.path + '」及其中内容将一并删除，确定继续？'
        : '删除「' + node.path + '」？此操作不可恢复。'
      if (!(await showConfirm({ title: '确认删除？', message, confirmText: '删除', danger: true }))) return
      try {
        await docsApi.remove(node.path)
        const currentPath = stateRef.current.currentPath
        if (currentPath === node.path || (isDirectory && currentPath && currentPath.startsWith(node.path + '/'))) {
          setEditorValue('')
          patch({ currentPath: '', savedContent: '', dirty: false })
        }
        await loadTree()
        toast('已删除')
      } catch (error) {
        notifyError(error)
      }
    },
    [loadTree, patch],
  )

  const openToday = useCallback(async () => {
    const path = todayLogPath()
    try {
      await docsApi.getFile(path)
      await openDoc(path)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('未认证')) return
      try {
        await docsApi.createFile(path, todayLogTemplate())
        expandAncestors(path)
        await loadTree()
        await openDoc(path)
      } catch (error) {
        notifyError(error)
      }
    }
  }, [expandAncestors, loadTree, openDoc])

  const doSearch = useCallback(
    async (searchText: string) => {
      const query = (searchText || '').trim()
      if (!query) return
      try {
        const searchHits = await docsApi.search(query)
        patch({ searching: true, searchResults: searchHits, searchSummary: '找到 ' + searchHits.length + ' 条结果' })
      } catch (error) {
        notifyError(error)
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
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), true)
      }
    },
    [patch],
  )

  const hideLocalPreview = useCallback(() => {
    patch({ localFile: null })
  }, [patch])

  const importLocalFile = useCallback(async () => {
    const localFile = stateRef.current.localFile
    if (!localFile) return
    const importPath = await showDialog({
      title: '导入到文档库',
      message: '将「' + localFile.name + '」保存到：',
      input: true,
      value: '导入/' + localFile.name,
      placeholder: '保存路径',
      confirmText: '导入',
    })
    if (!importPath || typeof importPath !== 'string') return
    try {
      await docsApi.createFile(importPath, localFile.content)
      expand(parentOf(importPath))
      await loadTree()
      toast('已导入：' + importPath)
      hideLocalPreview()
      await openDoc(importPath)
    } catch (error) {
      notifyError(error)
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
