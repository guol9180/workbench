import { api } from '../../api/http'

/** 在线文档模块 API（对应后端 /api/docs/**） */
export const docsApi = {
  tree: () => api('/api/docs/tree'),
  getFile: (path) => api('/api/docs/file?path=' + encodeURIComponent(path)),
  createFile: (path, content) =>
    api('/api/docs/file', { method: 'POST', body: JSON.stringify({ path, content }) }),
  saveFile: (path, content) =>
    api('/api/docs/file', { method: 'PUT', body: JSON.stringify({ path, content }) }),
  createDir: (path) => api('/api/docs/dir', { method: 'POST', body: JSON.stringify({ path }) }),
  rename: (from, to) =>
    api('/api/docs/rename', { method: 'POST', body: JSON.stringify({ from, to }) }),
  remove: (path) =>
    api('/api/docs/resource?path=' + encodeURIComponent(path), { method: 'DELETE' }),
  search: (q) => api('/api/docs/search?q=' + encodeURIComponent(q)),
}
