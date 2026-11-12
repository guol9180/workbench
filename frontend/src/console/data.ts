/** 控制台共享模型与格式化工具。数据一律来自服务端，本文件不产生示例数据。 */

export type StatusKey = 'running' | 'developing' | 'error' | 'stopped'
export type LogLevel = 'info' | 'warn' | 'error'
export type RouteKey = 'dashboard' | 'projects'

export interface Project {
  id: string
  name: string
  stack: string
  status: StatusKey
  desc: string
  todayRequests: number
  errors: number
  latency: number
  uptime: string
  lastDeploy: Date
  lastLogAt: Date
}

export interface LogEntry {
  id: string
  ts: Date
  projectId: string
  level: LogLevel
  msg: string
}

export const STATUS_META: Record<StatusKey, { label: string; cls: string; fill: string }> = {
  running: { label: '运行中', cls: 'status-success', fill: '#14805e' },
  developing: { label: '开发中', cls: 'status-running', fill: '#176d95' },
  error: { label: '异常', cls: 'status-danger', fill: '#b02a37' },
  stopped: { label: '已停止', cls: 'status-muted', fill: '#8fa3a6' },
}

export const LEVEL_META: Record<LogLevel, { label: string; cls: string }> = {
  info: { label: 'INFO', cls: 'level-info' },
  warn: { label: 'WARN', cls: 'level-warn' },
  error: { label: 'ERROR', cls: 'level-error' },
}

export const pad2 = (value: number) => String(value).padStart(2, '0')
export const fmtClock = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
export const fmtClockSec = (date: Date) => `${fmtClock(date)}:${pad2(date.getSeconds())}`
export const fmtStamp = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${fmtClock(date)}`
export const fmtDay = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
export const fmtNum = (value: number) => value.toLocaleString('zh-CN')
export const fmtWan = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : fmtNum(value)
export const errorRate = (errors: number, requests: number) => requests > 0 ? `${(errors / requests * 100).toFixed(2)}%` : '—'
