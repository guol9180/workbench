/**
 * monitor 域 API：/api/monitor/** 六端点的前端封装。
 * 类型与后端查询模型 record 的组件名一一对应（改后端必同步此处）。
 * 注意 bucketEpoch / lastSeenMinute 的口径是 epoch 分钟，展示前须 ×60000。
 */
import { api, probeStatus } from '../../api/http'
import type { ProbeResult } from '../../api/http'

export type RangeKey = '5m' | '1h' | '6h' | '24h' | '7d'
export type MetricKey = 'count' | 'avgMs' | 'errCount'
export type SortKey = 'count' | 'err' | 'avgMs'

export interface SourceStat {
  name: string
  /** epoch 分钟：展示前 ×60000 */
  lastSeenMinute: number
}

export interface OverviewData {
  count: number
  errCount: number
  errRate: number
  avgMs: number
  p95Ms: number
  rps: number
}

export interface SeriesPointData {
  /** epoch 分钟：小时步长时整小时对齐；展示前 ×60000 */
  bucketEpoch: number
  value: number
}

export interface EndpointRank {
  endpoint: string
  count: number
  errCount: number
  avgMs: number
  p95Ms: number
}

export interface MonitorStatusData {
  memoryBuckets: number
  dataFiles: number
  authEnabled: boolean
  droppedEvents: number
}

/**
 * range→step 固定映射：24h/7d 用小时桶。
 * 原因：7d×1m 有一万个点，传输与描迹都无意义；近端三档分钟桶保细节。
 */
export const RANGE_STEPS: Record<RangeKey, 'm' | 'h'> = {
  '5m': 'm',
  '1h': 'm',
  '6h': 'm',
  '24h': 'h',
  '7d': 'h',
}

export const monitorApi = {
  sources: () => api<SourceStat[]>('/api/monitor/sources'),

  overview: (source: string, range: RangeKey) =>
    api<OverviewData>(`/api/monitor/overview?source=${encodeURIComponent(source)}&range=${range}`),

  series: (source: string, metric: MetricKey, range: RangeKey) =>
    api<SeriesPointData[]>(
      `/api/monitor/series?source=${encodeURIComponent(source)}&metric=${metric}&range=${range}&step=${RANGE_STEPS[range]}`,
    ),

  topEndpoints: (source: string, range: RangeKey, by: SortKey, limit = 10) =>
    api<EndpointRank[]>(
      `/api/monitor/top-endpoints?source=${encodeURIComponent(source)}&range=${range}&by=${by}&limit=${limit}`,
    ),

  status: () => api<MonitorStatusData>('/api/monitor/status'),
}

/** epoch 分钟 → Date 可用的毫秒 */
export function minutesToMs(minutes: number): number {
  return minutes * 60_000
}

/** probeStatus 的转发导出：让模块消费方只依赖本文件 */
export function probeAuth(): Promise<ProbeResult> {
  return probeStatus()
}
