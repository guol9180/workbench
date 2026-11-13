/** 控制台共享模型与格式化工具。数据一律来自服务端，本文件不产生示例数据。 */

export type StatusKey = 'running' | 'error' | 'stopped' | 'idle'
export type RouteKey = 'overview' | 'services' | 'projects' | 'settings'

export const STATUS_META: Record<StatusKey, { label: string; cls: string; fill: string }> = {
  running: { label: '运行中', cls: 'status-success', fill: '#14805e' },
  error: { label: '异常', cls: 'status-danger', fill: '#b02a37' },
  stopped: { label: '已停止', cls: 'status-muted', fill: '#8fa3a6' },
  idle: { label: '无数据', cls: 'status-muted', fill: '#8fa3a6' },
}

export const pad2 = (value: number) => String(value).padStart(2, '0')
export const fmtClock = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
export const fmtStamp = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${fmtClock(date)}`
export const fmtDay = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
export const fmtNum = (value: number) => value.toLocaleString('zh-CN')
export const fmtWan = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : fmtNum(value)
export const errorRate = (errors: number, requests: number) => requests > 0 ? `${(errors / requests * 100).toFixed(2)}%` : '—'

/** 分钟 epoch → 本地时间 */
export const minuteToDate = (minute: number) => new Date(minute * 60_000)

/** 毫秒时间戳 → 相对描述（用于 lastOkAt / lastError 展示） */
export function fmtAgo(timestampMs: number | null): string {
  if (!timestampMs) return '—'
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestampMs) / 60_000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const hours = Math.floor(diffMinutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}
