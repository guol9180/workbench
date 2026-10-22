/**
 * 统一 API 请求封装（对齐 v2 后端契约）：
 * - 认证走 X-API-Token 请求头（后端 workbench.auth.token；空值 = 认证关闭，无需令牌）
 * - 统一解包 ApiResult{message, code, data}；code !== 0 抛后端给出的中文消息
 * - 401：清除本地令牌并跳接入页——令牌失效 / 后端中途开启认证的统一出口
 */
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
const TOKEN_KEY = 'wb-api-token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** 后端返回 code !== 0 或 401 时抛出，message 面向用户可直接展示 */
export class ApiError extends Error {}

/** 探测结论：open=无需令牌，locked=需要令牌，offline=后端不可达 */
export type ProbeResult = 'open' | 'locked' | 'offline'

/**
 * 认证探测：只看 /api/monitor/status 的状态码，不做 401 跳转、不抛错——
 * 接入页与路由守卫据此判定「直接进入」还是「索要令牌」。
 */
export async function probeStatus(): Promise<ProbeResult> {
  try {
    const token = getToken()
    const res = await fetch(BASE + '/api/monitor/status', {
      headers: token ? { 'X-API-Token': token } : {},
    })
    return res.status === 401 ? 'locked' : 'open'
  } catch {
    return 'offline'
  }
}

export async function api<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers['X-API-Token'] = token

  const res = await fetch(BASE + url, { ...options, headers })
  if (res.status === 401) {
    setToken(null)
    // hash 路由：直接改 hash 触发路由切换，避免引入 router 依赖
    location.hash = '#/login'
    throw new ApiError('未认证：请输入接入令牌')
  }
  const body = (await res.json()) as { message: string; code: number; data: T }
  if (body.code !== 0) throw new ApiError(body.message || '操作失败')
  return body.data
}
