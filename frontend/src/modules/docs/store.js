import { defineStore } from 'pinia'
import { docsApi } from './api'
import { parentOf, baseName, extAllowed, todayLogPath, todayLogTemplate, readLocalFile } from './util'
import { hasEditor, isEditorReady, getEditorValue, setEditorValue } from './editor'
import { toast } from '../../ui/toast'
import { showDialog, showConfirm } from '../../ui/dialog'

const EXPANDED_KEY = 'wb-expanded'

/** 未登录已由 http.js 统一处理（清 token 并跳登录页），其余错误以 toast 提示 */
function notifyError(e) {
  if (e.message !== '未登录') toast(e.message, true)
}

/**
 * 在线文档模块状态与业务编排：文件树、当前文档、脏状态、搜索、本地预览。
 * 编辑器句柄见 editor.js；路径/日志模板/文件读取等纯函数见 util.js。
 */
export const useDocsStore = defineStore('docs', {
  state: () => ({
    tree: null,
    currentPath: '',
    savedContent: '',
    dirty: false,
    expanded: loadExpanded(),
    searching: false,
    searchResults: [],
    searchSummary: '',
    localFile: null, // { name, content }
    sidebarOpen: false,
  }),

  getters: {
    docTitle: (s) => s.currentPath || '未打开文档',
  },

  actions: {
    /* ---------------- 文件树 ---------------- */

    async loadTree() {
      try {
        this.tree = await docsApi.tree()
      } catch (e) {
        notifyError(e)
      }
    },

    toggleDir(node) {
      if (this.expanded.has(node.path)) {
        this.expanded.delete(node.path)
      } else {
        this.expanded.add(node.path)
      }
      saveExpanded(this.expanded)
    },

    expand(path) {
      if (path) {
        this.expanded.add(path)
        saveExpanded(this.expanded)
      }
    },

    /** 展开路径的所有祖先目录（如 新建日志后展开 日志/ 与 日志/2026-08/） */
    expandAncestors(path) {
      let dir = parentOf(path)
      while (dir) {
        this.expand(dir)
        dir = parentOf(dir)
      }
    },

    /* ---------------- 文档操作 ---------------- */

    async openDoc(path) {
      try {
        const doc = await docsApi.getFile(path)
        this.currentPath = doc.path
        this.savedContent = doc.content == null ? '' : doc.content
        this.dirty = false
        setEditorValue(doc.content)
        this.hideLocalPreview()
        this.sidebarOpen = false
      } catch (e) {
        notifyError(e)
      }
    },

    refreshDirty() {
      if (!hasEditor()) return
      this.dirty = getEditorValue() !== this.savedContent
    },

    async saveDoc() {
      if (!isEditorReady()) return
      try {
        const content = getEditorValue()
        if (!this.currentPath) {
          const name = await showDialog({
            title: '保存文档',
            input: true,
            value: this.suggestNewName(),
            placeholder: '可含子目录，如：笔记/idea.md',
            confirmText: '保存',
          })
          if (!name) return
          const fixed = extAllowed(name) ? name : name + '.md'
          await docsApi.createFile(fixed, content)
          this.currentPath = fixed
        } else {
          await docsApi.saveFile(this.currentPath, content)
        }
        this.savedContent = content
        this.dirty = false
        await this.loadTree()
        toast('已保存')
      } catch (e) {
        notifyError(e)
      }
    },

    suggestNewName() {
      const dir = this.currentPath ? parentOf(this.currentPath) : ''
      return dir ? dir + '/未命名.md' : '未命名.md'
    },

    async newFile(dirPath) {
      const base = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文档' : '新建文档',
        input: true,
        value: '未命名.md',
        placeholder: '文档名，可含子目录',
        confirmText: '创建',
      })
      if (!base) return
      const fixed = extAllowed(base) ? base : base + '.md'
      const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + fixed : fixed
      try {
        await docsApi.createFile(path, '# ' + baseName(fixed).replace(/\.(md|markdown|txt)$/i, '') + '\n\n')
        this.expand(dirPath)
        await this.loadTree()
        this.openDoc(path)
      } catch (e) {
        notifyError(e)
      }
    },

    async newDir(dirPath) {
      const base = await showDialog({
        title: dirPath ? '在「' + dirPath + '」中新建文件夹' : '新建文件夹',
        input: true,
        value: '新建文件夹',
        placeholder: '文件夹名称',
        confirmText: '创建',
      })
      if (!base) return
      const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + base : base
      try {
        await docsApi.createDir(path)
        this.expand(dirPath)
        this.expand(path)
        await this.loadTree()
        toast('文件夹已创建')
      } catch (e) {
        notifyError(e)
      }
    },

    async renameNode(node) {
      const newName = await showDialog({
        title: '重命名「' + node.name + '」',
        input: true,
        value: node.name,
        placeholder: '新名称',
        confirmText: '重命名',
      })
      if (!newName || newName === node.name) return
      const to = parentOf(node.path) ? parentOf(node.path) + '/' + newName : newName
      try {
        await docsApi.rename(node.path, to)
        if (this.currentPath === node.path) {
          this.currentPath = to
        }
        await this.loadTree()
        toast('已重命名')
      } catch (e) {
        notifyError(e)
      }
    },

    async deleteNode(node) {
      const isDir = node.type === 'dir'
      const msg = isDir
        ? '确定删除文件夹「' + node.path + '」及其全部内容？'
        : '确定删除「' + node.path + '」？'
      if (!await showConfirm({ title: '删除确认', message: msg, confirmText: '删除', danger: true })) return
      try {
        await docsApi.remove(node.path)
        if (this.currentPath === node.path || (isDir && this.currentPath && this.currentPath.startsWith(node.path + '/'))) {
          this.currentPath = ''
          this.savedContent = ''
          this.dirty = false
          setEditorValue('')
        }
        await this.loadTree()
        toast('已删除')
      } catch (e) {
        notifyError(e)
      }
    },

    /* ---------------- 今日工作 ---------------- */

    async openToday() {
      const path = todayLogPath()
      try {
        await docsApi.getFile(path)
        this.openDoc(path)
      } catch (e) {
        if (e.message === '未登录') return
        try {
          await docsApi.createFile(path, todayLogTemplate())
          this.expandAncestors(path)
          await this.loadTree()
          this.openDoc(path)
        } catch (err) {
          notifyError(err)
        }
      }
    },

    /* ---------------- 搜索 ---------------- */

    async doSearch(q) {
      const query = (q || '').trim()
      if (!query) return
      try {
        const hits = await docsApi.search(query)
        this.searching = true
        this.searchResults = hits
        this.searchSummary = '找到 ' + hits.length + ' 条结果'
      } catch (e) {
        notifyError(e)
      }
    },

    backToTree() {
      this.searching = false
      this.searchResults = []
    },

    async openSearchHit(path) {
      this.backToTree()
      this.openDoc(path)
    },

    /* ---------------- 本地文件预览 ---------------- */

    async openLocalFile(file) {
      if (!file) return
      if (!extAllowed(file.name)) {
        toast('仅支持 .md / .markdown / .txt 文件', true)
        return
      }
      try {
        this.localFile = { name: file.name, content: await readLocalFile(file) }
      } catch (e) {
        toast(e.message, true)
      }
    },

    hideLocalPreview() {
      this.localFile = null
    },

    async importLocalFile() {
      if (!this.localFile) return
      const target = await showDialog({
        title: '导入到文档库',
        message: '将「' + this.localFile.name + '」保存到：',
        input: true,
        value: '导入/' + this.localFile.name,
        placeholder: '保存路径',
        confirmText: '导入',
      })
      if (!target) return
      try {
        await docsApi.createFile(target, this.localFile.content)
        this.expand(parentOf(target))
        await this.loadTree()
        toast('已导入：' + target)
        this.hideLocalPreview()
        this.openDoc(target)
      } catch (e) {
        notifyError(e)
      }
    },
  },
})

function loadExpanded() {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || '[]'))
  } catch (e) {
    return new Set()
  }
}

function saveExpanded(set) {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]))
}
