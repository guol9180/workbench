import { defineStore } from 'pinia'
import { docsApi } from './api'
import { parentOf, baseName, extAllowed } from './util'
import { toast } from '../../ui/toast'
import { showDialog, showConfirm } from '../../ui/dialog'

const EXPANDED_KEY = 'wb-expanded'

/**
 * 在线文档模块状态：文件树、当前文档、脏状态、搜索、本地文件预览。
 * 编辑器实例由 VditorEditor 组件挂载后注入（attachEditor）。
 */
export const useDocsStore = defineStore('docs', {
  state: () => ({
    tree: null,
    currentPath: '',
    savedContent: '',
    dirty: false,
    editorReady: false,
    editor: null, // { getValue(), setValue(text) } 由 VditorEditor 注入
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
    attachEditor(editor) {
      this.editor = editor
    },

    /* ---------------- 文件树 ---------------- */

    async loadTree() {
      try {
        this.tree = await docsApi.tree()
      } catch (e) {
        if (e.message !== '未登录') toast(e.message, true)
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

    /* ---------------- 文档操作 ---------------- */

    async openDoc(path) {
      try {
        const doc = await docsApi.getFile(path)
        this.currentPath = doc.path
        this.savedContent = doc.content == null ? '' : doc.content
        this.dirty = false
        if (this.editor) this.editor.setValue(doc.content)
        this.hideLocalPreview()
        this.sidebarOpen = false
      } catch (e) {
        if (e.message !== '未登录') toast(e.message, true)
      }
    },

    currentContent() {
      return this.editor ? this.editor.getValue() : ''
    },

    refreshDirty() {
      if (!this.editor) return
      this.dirty = this.editor.getValue() !== this.savedContent
    },

    async saveDoc() {
      if (!this.editorReady || !this.editor) return
      try {
        const content = this.editor.getValue()
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
        if (e.message !== '未登录') toast(e.message, true)
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
        if (e.message !== '未登录') toast(e.message, true)
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
        if (e.message !== '未登录') toast(e.message, true)
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
        if (e.message !== '未登录') toast(e.message, true)
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
          if (this.editor) this.editor.setValue('')
        }
        await this.loadTree()
        toast('已删除')
      } catch (e) {
        if (e.message !== '未登录') toast(e.message, true)
      }
    },

    /* ---------------- 今日工作 ---------------- */

    async openToday() {
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const month = now.getFullYear() + '-' + mm
      const day = mm + '-' + dd
      const path = '日志/' + month + '/' + now.getFullYear() + '-' + day + '.md'
      try {
        await docsApi.getFile(path)
        this.openDoc(path)
      } catch (e) {
        if (e.message === '未登录') return
        const template = '# ' + now.getFullYear() + '-' + day + ' 工作日志\n\n'
          + '## 今日工作\n\n- \n\n## 问题与备注\n\n- \n'
        try {
          await docsApi.createFile(path, template)
          this.expand('日志')
          this.expand('日志/' + month)
          await this.loadTree()
          this.openDoc(path)
        } catch (err) {
          if (err.message !== '未登录') toast(err.message, true)
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
        if (e.message !== '未登录') toast(e.message, true)
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

    openLocalFile(file) {
      if (!file) return
      if (!extAllowed(file.name)) {
        toast('仅支持 .md / .markdown / .txt 文件', true)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        this.localFile = { name: file.name, content: String(reader.result || '') }
      }
      reader.onerror = () => toast('文件读取失败', true)
      reader.readAsText(file, 'utf-8')
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
        if (e.message !== '未登录') toast(e.message, true)
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
