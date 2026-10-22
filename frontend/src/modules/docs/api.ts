/**
 * 在线文档模块 API（对应后端 /api/docs/** 八端点）。
 * 类型对齐后端 model record 的组件名；DocNode 递归结构由后端 tree 直接给出。
 */
import { api } from '../../api/http'

export interface DocNode {
  name: string
  path: string
  type: 'dir' | 'file'
  children: DocNode[]
}

export interface DocContent {
  path: string
  name: string
  content: string
}

export interface SearchHit {
  path: string
  name: string
  /** 文件名命中（此时 snippet 是文件名）；内容命中时 line 给 1 起的行号 */
  fileNameMatch: boolean
  line: number | null
  snippet: string
}

export const docsApi = {
  tree: () => api<DocNode>('/api/docs/tree'),
  getFile: (path: string) => api<DocContent>('/api/docs/file?path=' + encodeURIComponent(path)),
  createFile: (path: string, content: string) =>
    api<void>('/api/docs/file', { method: 'POST', body: JSON.stringify({ path, content }) }),
  saveFile: (path: string, content: string) =>
    api<void>('/api/docs/file', { method: 'PUT', body: JSON.stringify({ path, content }) }),
  createDir: (path: string) => api<void>('/api/docs/dir', { method: 'POST', body: JSON.stringify({ path }) }),
  rename: (from: string, to: string) =>
    api<void>('/api/docs/rename', { method: 'POST', body: JSON.stringify({ from, to }) }),
  remove: (path: string) => api<void>('/api/docs/resource?path=' + encodeURIComponent(path), { method: 'DELETE' }),
  search: (q: string) => api<SearchHit[]>('/api/docs/search?q=' + encodeURIComponent(q)),
}
