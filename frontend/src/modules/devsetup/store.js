import { defineStore } from 'pinia'
import { devsetupApi } from './api'
import { toast } from '../../ui/toast'

/** 未登录已由 http.js 统一处理（清 token 并跳登录页），其余错误以 toast 提示 */
function notifyError(e) {
  if (e.message !== '未登录') toast(e.message, true)
}

/** 触发浏览器下载 Blob */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 工具表单默认值 */
export function emptyTool() {
  return { name: '', category: 'WINGET', sourceRef: '', version: '', enabled: true, sort: 0, note: '' }
}

/** 配置文件表单默认值 */
export function emptyConfigFile() {
  return { name: '', targetPath: '', content: '', enabled: true, note: '' }
}

/**
 * 开发环境管家状态：工具清单、配置文件、IDEA 配置快照工件与引导清单。
 */
export const useDevsetupStore = defineStore('devsetup', {
  state: () => ({
    tools: [],
    configFiles: [],
    artifacts: [],
    manifest: null, // { tools, configFiles, artifacts }
    loading: false,
    uploading: false,
  }),

  actions: {
    /* ---------------- 加载 ---------------- */

    async loadAll() {
      this.loading = true
      try {
        await Promise.all([this.loadTools(), this.loadConfigFiles(), this.loadArtifacts()])
      } finally {
        this.loading = false
      }
    },

    async loadTools() {
      try {
        this.tools = await devsetupApi.tools()
      } catch (e) {
        notifyError(e)
      }
    },

    async loadConfigFiles() {
      try {
        this.configFiles = await devsetupApi.configFiles()
      } catch (e) {
        notifyError(e)
      }
    },

    async loadArtifacts() {
      try {
        this.artifacts = await devsetupApi.artifacts()
      } catch (e) {
        notifyError(e)
      }
    },

    async loadManifest() {
      try {
        this.manifest = await devsetupApi.manifest()
      } catch (e) {
        notifyError(e)
      }
    },

    /* ---------------- 工具清单 ---------------- */

    async saveTool(tool, id) {
      try {
        if (id) {
          await devsetupApi.updateTool(id, tool)
        } else {
          await devsetupApi.createTool(tool)
        }
        toast(id ? '工具已更新' : '工具已添加')
        await this.loadTools()
        this.manifest = null
        return true
      } catch (e) {
        notifyError(e)
        return false
      }
    },

    async removeTool(tool) {
      try {
        await devsetupApi.deleteTool(tool.id)
        toast('已删除：' + tool.name)
        await this.loadTools()
      } catch (e) {
        notifyError(e)
      }
    },

    async toggleTool(tool) {
      try {
        await devsetupApi.updateTool(tool.id, { ...tool, enabled: !tool.enabled })
        await this.loadTools()
      } catch (e) {
        notifyError(e)
      }
    },

    /* ---------------- 配置文件 ---------------- */

    async saveConfigFile(cf, id) {
      try {
        if (id) {
          await devsetupApi.updateConfigFile(id, cf)
        } else {
          await devsetupApi.createConfigFile(cf)
        }
        toast(id ? '配置已更新' : '配置已添加')
        await this.loadConfigFiles()
        return true
      } catch (e) {
        notifyError(e)
        return false
      }
    },

    async removeConfigFile(cf) {
      try {
        await devsetupApi.deleteConfigFile(cf.id)
        toast('已删除：' + cf.name)
        await this.loadConfigFiles()
      } catch (e) {
        notifyError(e)
      }
    },

    async loadConfigFileContent(id) {
      try {
        return await devsetupApi.configFile(id)
      } catch (e) {
        notifyError(e)
        return null
      }
    },

    /* ---------------- IDEA 配置快照 ---------------- */

    async uploadArtifact(name, note, file) {
      this.uploading = true
      try {
        await devsetupApi.uploadArtifact(name, note, file)
        toast('快照已上传')
        await this.loadArtifacts()
        this.manifest = null
        return true
      } catch (e) {
        notifyError(e)
        return false
      } finally {
        this.uploading = false
      }
    },

    async removeArtifact(artifact) {
      try {
        await devsetupApi.deleteArtifact(artifact.name)
        toast('已删除快照：' + artifact.name)
        await this.loadArtifacts()
      } catch (e) {
        notifyError(e)
      }
    },

    async downloadArtifactFile(artifact) {
      try {
        const blob = await devsetupApi.downloadArtifact(artifact.name)
        saveBlob(blob, artifact.filename || artifact.name + '.zip')
      } catch (e) {
        notifyError(e)
      }
    },

    /* ---------------- 脚本 ---------------- */

    async downloadScript(name) {
      try {
        const blob = await devsetupApi.downloadScript(name)
        saveBlob(blob, name)
      } catch (e) {
        notifyError(e)
      }
    },
  },
})
