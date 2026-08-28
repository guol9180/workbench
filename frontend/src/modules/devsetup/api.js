import { api, apiForm, apiBlob } from '../../api/http'

/** 开发环境管家模块 API（对应后端 /api/devsetup/**） */
export const devsetupApi = {
  /* 工具清单 */
  tools: () => api('/api/devsetup/tools'),
  createTool: (tool) => api('/api/devsetup/tools', { method: 'POST', body: JSON.stringify(tool) }),
  updateTool: (id, tool) =>
    api('/api/devsetup/tools/' + id, { method: 'PUT', body: JSON.stringify(tool) }),
  deleteTool: (id) => api('/api/devsetup/tools/' + id, { method: 'DELETE' }),

  /* 配置文件 */
  configFiles: () => api('/api/devsetup/config-files'),
  configFile: (id) => api('/api/devsetup/config-files/' + id),
  createConfigFile: (cf) =>
    api('/api/devsetup/config-files', { method: 'POST', body: JSON.stringify(cf) }),
  updateConfigFile: (id, cf) =>
    api('/api/devsetup/config-files/' + id, { method: 'PUT', body: JSON.stringify(cf) }),
  deleteConfigFile: (id) => api('/api/devsetup/config-files/' + id, { method: 'DELETE' }),

  /* 二进制工件（IDEA 配置快照） */
  artifacts: () => api('/api/devsetup/artifacts'),
  uploadArtifact: (name, note, file) => {
    const form = new FormData()
    form.append('name', name)
    if (note) form.append('note', note)
    form.append('file', file)
    return apiForm('/api/devsetup/artifacts', form)
  },
  deleteArtifact: (name) =>
    api('/api/devsetup/artifacts/' + encodeURIComponent(name), { method: 'DELETE' }),
  downloadArtifact: (name) => apiBlob('/api/devsetup/artifacts/' + encodeURIComponent(name) + '/download'),

  /* 清单与脚本 */
  manifest: () => api('/api/devsetup/manifest'),
  downloadScript: (name) => apiBlob('/api/devsetup/' + name),
}
