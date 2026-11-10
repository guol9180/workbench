/** 新版控制台的本地示例数据、格式化与 Markdown 预览。与参考稿保持同一套行为。 */

export type StatusKey = 'running' | 'developing' | 'error' | 'stopped'
export type LogLevel = 'info' | 'warn' | 'error'
export type RouteKey = 'dashboard' | 'projects' | 'docs'

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

export interface Doc {
  id: string
  title: string
  content: string
  updatedAt: number
}

export interface ToolEntry {
  id: string
  name: string
  type: 'link' | 'command'
  target: string
  desc: string
}

export interface LocalDoc {
  name: string
  content: string
  handle: LocalFileHandle | null
  dirty: boolean
  updatedAt: number
  size: number
}

export interface LocalFileHandle {
  name?: string
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
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

export const LOG_POOL: Record<LogLevel, string[]> = {
  info: ['服务健康检查通过', '定时任务执行完成，耗时 1.2s', 'GET /api/health 200（12ms）', '本地缓存刷新完成', '构建产物已部署', '数据同步任务开始'],
  warn: ['响应时间超过阈值（480ms）', '内存使用率达到 78%', '第 3 次重试后成功', '检测到慢查询：SELECT 320ms', '磁盘剩余空间低于 20%'],
  error: ['上游连接超时：ETIMEDOUT', '数据库连接池已满', '目标站点返回 503，采集中止', '未捕获异常：TypeError: undefined', '部署回滚完成，原因：健康检查失败'],
}

const LOG_PROJECT_SEQ = ['p-gateway', 'p-gateway', 'p-blog', 'p-gateway', 'p-spider', 'p-tasks', 'p-spider', 'p-blog', 'p-gateway', 'p-tasks', 'p-spider', 'p-blog', 'p-gateway', 'p-spider', 'p-tasks', 'p-blog', 'p-gateway', 'p-spider', 'p-gateway', 'p-blog', 'p-tasks', 'p-spider', 'p-gateway', 'p-blog', 'p-spider', 'p-gateway', 'p-tasks', 'p-blog', 'p-gateway', 'p-spider', 'p-gateway', 'p-blog']

const now = new Date()
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

export function seedProjects(): Project[] {
  return [
    { id: 'p-blog', name: '个人博客站点', stack: 'Next.js', status: 'running', desc: '博客与文章发布', todayRequests: 82400, errors: 98, latency: 142, uptime: '99.98%', lastDeploy: daysAgo(3), lastLogAt: minutesAgo(6) },
    { id: 'p-gateway', name: 'API 网关服务', stack: 'Go', status: 'running', desc: '统一接入层与限流', todayRequests: 315600, errors: 1204, latency: 186, uptime: '99.92%', lastDeploy: daysAgo(1), lastLogAt: minutesAgo(2) },
    { id: 'p-tasks', name: '任务提醒小程序', stack: '微信小程序', status: 'developing', desc: '待办与提醒推送', todayRequests: 46800, errors: 41, latency: 230, uptime: '—', lastDeploy: daysAgo(6), lastLogAt: minutesAgo(46) },
    { id: 'p-spider', name: '数据采集爬虫', stack: 'Python', status: 'error', desc: '定时采集与清洗', todayRequests: 12700, errors: 856, latency: 95, uptime: '97.31%', lastDeploy: daysAgo(2), lastLogAt: minutesAgo(1) },
    { id: 'p-toolbox', name: '桌面工具箱', stack: 'Electron', status: 'stopped', desc: '本地小工具合集', todayRequests: 0, errors: 0, latency: 0, uptime: '—', lastDeploy: daysAgo(12), lastLogAt: minutesAgo(320) },
  ]
}

export function seedLogs(): LogEntry[] {
  return LOG_PROJECT_SEQ.map((projectId, index) => {
    const level: LogLevel = index % 9 === 4 ? 'error' : index % 4 === 2 ? 'warn' : 'info'
    const messages = LOG_POOL[level]
    return {
      id: `log-seed-${index}`,
      ts: new Date(now.getTime() - index * (9 + (index % 5) * 4) * 60_000),
      projectId,
      level,
      msg: messages[(index * 7 + level.length) % messages.length],
    }
  })
}

export function seedDocs(): Doc[] {
  return [
    {
      id: 'd-env',
      title: '开发环境配置手册',
      updatedAt: minutesAgo(95).getTime(),
      content: '# 开发环境配置手册\n\n记录本机常用环境的搭建步骤，避免每次重装系统都要重新查资料。\n\n## 基础环境\n\n- Node.js 22 LTS（使用 nvm 管理）\n- pnpm 作为默认包管理器\n- Docker Desktop + WSL2\n\n## 常用命令\n\n- 全局更新依赖：`pnpm up -g`\n- 清理构建缓存：`pnpm store prune`\n- 查看端口占用：`netstat -ano | findstr :3000`\n\n## 注意事项\n\n- 代理设置统一走环境变量，避免工具各自配置\n- 数据库默认只开本地端口，不暴露公网',
    },
    {
      id: 'd-weekly',
      title: '每周开发周报（模板）',
      updatedAt: daysAgo(4).getTime(),
      content: '# 本周进展\n\n- **项目**：本周完成了什么\n- **问题**：遇到了什么阻塞\n- **计划**：下周打算做什么\n\n# 数据速览\n\n| 项目 | 状态 | 备注 |\n| --- | --- | --- |\n| 示例项目 | 运行中 | 无异常 |',
    },
    {
      id: 'd-tools',
      title: '工具集成笔记',
      updatedAt: daysAgo(1).getTime(),
      content: '# 工具集成笔记\n\n## 已集成\n\n- 在线文档：本编辑器，内容保存在浏览器\n- 数据导出：看板与日志可导出 CSV / JSON\n\n## 待集成\n\n- 本地脚本入口（通过工具集添加）\n- 常用网页工具收藏\n\n## 命名约定\n\n- 工具名称不超过 12 个字，便于卡片展示',
    },
  ]
}

export const pad2 = (value: number) => String(value).padStart(2, '0')
export const fmtClock = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
export const fmtClockSec = (date: Date) => `${fmtClock(date)}:${pad2(date.getSeconds())}`
export const fmtStamp = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${fmtClock(date)}`
export const fmtDay = (date: Date) => `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
export const fmtNum = (value: number) => value.toLocaleString('zh-CN')
export const fmtWan = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : fmtNum(value)
export const errorRate = (errors: number, requests: number) => requests > 0 ? `${(errors / requests * 100).toFixed(2)}%` : '—'

export const loadJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export const saveJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存储不可用时保持内存态
  }
}

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
const renderInline = (text: string) => text
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

const splitTableRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())

/** 参考稿的轻量 Markdown 预览：标题、列表、粗体、行内代码、表格、代码块。 */
export function renderMarkdown(source: string): string {
  const lines = esc(source).split(/\r?\n/)
  const out: string[] = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*```/.test(line)) {
      closeList()
      const codeLines: string[] = []
      let codeIndex = index + 1
      while (codeIndex < lines.length && !/^\s*```/.test(lines[codeIndex])) {
        codeLines.push(lines[codeIndex])
        codeIndex += 1
      }
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
      index = codeIndex
      continue
    }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || '')) {
      closeList()
      const headers = splitTableRow(line)
      const rows: string[][] = []
      let rowIndex = index + 2
      while (rowIndex < lines.length && lines[rowIndex].trim().startsWith('|')) {
        const row = splitTableRow(lines[rowIndex])
        if (row.length > 0) rows.push(row)
        rowIndex += 1
      }
      out.push(`<table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      index = rowIndex - 1
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const listItem = /^\s*[-*]\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
    } else if (listItem) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${renderInline(listItem[1])}</li>`)
    } else if (line.trim() === '') {
      closeList()
    } else {
      closeList()
      out.push(`<p>${renderInline(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}
