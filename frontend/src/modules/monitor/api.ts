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

/** 区间的人话标签：同一档位在图表、源卡片、健康表里读法一致 */
export const RANGE_LABEL: Record<RangeKey, string> = {
  '5m': '5 分钟',
  '1h': '1 小时',
  '6h': '6 小时',
  '24h': '24 小时',
  '7d': '7 天',
}

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
  /** 只暴露「配没配」布尔位与来源（page/env，未配置 null）：数据源页据此渲染配置块；token 值永不回传 */
  githubTokenConfigured: boolean
  githubTokenSource: string | null
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

/** 区间分钟数：与后端 TimeRange.seconds / 60 对齐（起点 = now - N，含首尾共 N+1 个分钟桶） */
const RANGE_MINUTES: Record<RangeKey, number> = {
  '5m': 5,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
}

/**
 * 把后端稀疏序列补齐成整个查询窗口的连续桶。
 * 后端只返回「有流量的桶」，直接连点会把 2 个分钟桶拉成横跨整窗的斜线——图形会撒谎。
 * 缺桶语义 = 该分钟无流量 = 0；小时步长按整小时对齐，与后端分组口径一致。
 */
export function fillSeries(points: SeriesPointData[], range: RangeKey, nowMs = Date.now()): SeriesPointData[] {
  const hourly = RANGE_STEPS[range] === 'h'
  const step = hourly ? 60 : 1
  const bucketCount = Math.floor(RANGE_MINUTES[range] / step) + 1
  const nowBucket = Math.floor(nowMs / 60_000)
  // 桶键必须与后端口径一致：小时步长按整小时对齐，否则后端返回的 HH:00 桶全部对不上（整窗归零）
  const align = (bucket: number) => (hourly ? bucket - (bucket % 60) : bucket)
  // 本机时钟可能略慢于服务端：窗口末尾至少覆盖已有数据的最大桶，不丢最新点
  const maxBucket = points.reduce((largestBucket, point) => Math.max(largestBucket, point.bucketEpoch), 0)
  const end = Math.max(align(nowBucket), align(maxBucket))
  const start = end - (bucketCount - 1) * step
  const byBucket = new Map(points.map((point) => [point.bucketEpoch, point.value]))
  const filled: SeriesPointData[] = []
  for (let bucket = start; bucket <= end; bucket += step) {
    filled.push({ bucketEpoch: bucket, value: byBucket.get(bucket) ?? 0 })
  }
  return filled
}

export const monitorApi = {
  sources: () => api<SourceStat[]>('/api/monitor/sources'),

  overview: (source: string, range: RangeKey) =>
    api<OverviewData>(`/api/monitor/overview?source=${encodeURIComponent(source)}&range=${range}`),

  /** endpointFilter：按端点过滤（GitHub 源拆 views/downloads 曲线用；缺省=不过滤） */
  series: (source: string, metric: MetricKey, range: RangeKey, endpointFilter?: string) =>
    api<SeriesPointData[]>(
      `/api/monitor/series?source=${encodeURIComponent(source)}&metric=${metric}&range=${range}&step=${RANGE_STEPS[range]}` +
        (endpointFilter ? '&endpoint=' + encodeURIComponent(endpointFilter) : ''),
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
