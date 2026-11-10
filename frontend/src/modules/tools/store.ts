/**
 * 集成工具的前端配置：只承载浏览器本地入口，不写后端。
 * 工具由用户主动添加/删除；命令类点击复制，链接类在新窗口打开。
 */
export interface ToolEntry {
  id: string
  name: string
  type: 'link' | 'command'
  target: string
  desc: string
}

const TOOLS_KEY = 'wb-tools'

export function loadTools(): ToolEntry[] {
  try {
    const raw = localStorage.getItem(TOOLS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ToolEntry[]
    return Array.isArray(parsed) ? parsed.filter((tool) => tool && tool.id && tool.name && tool.target) : []
  } catch {
    return []
  }
}

export function saveTools(tools: ToolEntry[]): void {
  localStorage.setItem(TOOLS_KEY, JSON.stringify(tools))
}

export function newToolId(): string {
  return 'tool-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}
