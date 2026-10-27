/**
 * 数据源配置模块 API（对应后端 /api/monitor/source-configs 五端点，M6）。
 * 类型与后端 SourceConfigView / SourceCollectResult 严格对齐。
 */
import { api } from '../../api/http'

export interface SourceConfigView {
  id: string
  type: string
  repo: string
  enabled: boolean
  metrics: string[]
  createdAt: number
  lastOkAt: number | null
  lastError: string | null
  lastDay: string | null
}

export interface SourceCollectResult {
  ok: boolean
  error: string | null
}

export type SourceMetric = 'pages' | 'downloads'

export interface SourceConfigInput {
  type: string
  repo: string
  enabled: boolean
  metrics: SourceMetric[]
}

export const sourcesApi = {
  list: () => api<SourceConfigView[]>('/api/monitor/source-configs'),
  create: (input: SourceConfigInput) =>
    api<{ id: string }>('/api/monitor/source-configs', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: SourceConfigInput) =>
    api<void>('/api/monitor/source-configs/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) =>
    api<void>('/api/monitor/source-configs/' + encodeURIComponent(id), { method: 'DELETE' }),
  collect: (id: string) =>
    api<SourceCollectResult>('/api/monitor/source-configs/' + encodeURIComponent(id) + '/collect', { method: 'POST' }),
  /** 保存页面级 GitHub token（立即生效，优先于环境变量）；值只在服务端持久化，永不回显 */
  setGithubToken: (token: string) =>
    api<void>('/api/monitor/settings/github-token', { method: 'PUT', body: JSON.stringify({ token }) }),
  /** 清除页面级 token（回落环境变量） */
  clearGithubToken: () =>
    api<void>('/api/monitor/settings/github-token', { method: 'DELETE' }),
}
