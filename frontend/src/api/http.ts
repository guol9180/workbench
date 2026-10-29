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

/** 登录请求结果：ok=false 时 message 为可直接展示的错误文案 */
export interface LoginResult {
  ok: boolean
  message: string
}

/** 探测结论：open=无需令牌，locked=需要令牌，offline=后端不可达 */
export type ProbeResult = 'open' | 'locked' | 'offline'

/**
 * 密码登录：POST /api/auth/login 换取会话令牌并写入本地存储。
 * fetch 直连不走 api()——登录页自身的 401/429 不能触发「清令牌跳登录页」的自跳转。
 */
export async function loginRequest(password: string): Promise<LoginResult> {
  try {
    const res = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      const body = (await res.json()) as { code: number; data: { token: string } | null; message: string | null }
      if (body.code === 0 && body.data?.token) {
        setToken(body.data.token)
        return { ok: true, message: '' }
      }
      return { ok: false, message: body.message || '登录失败' }
    }
    if (res.status === 401) return { ok: false, message: '密码不正确——请核对后重试' }
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      return { ok: false, message: body?.message ?? '尝试次数过多，请稍后再试' }
    }
    return { ok: false, message: '登录失败，请稍后再试' }
  } catch {
    return { ok: false, message: '后端无响应或返回异常——请确认 workbench-server 已启动' }
  }
}

/** 注销：尽力失效服务端会话（离线/失败不阻断本地清理，调用方负责清令牌） */
export async function logoutRequest(): Promise<void> {
  try {
    const token = getToken()
    if (!token) return
    await fetch(BASE + '/api/auth/logout', { method: 'POST', headers: { 'X-API-Token': token } })
  } catch {
    // 离线时本地清理照常进行
  }
}

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
    throw new ApiError('未认证或密码已变更，请重新登录')
  }
  // 非 JSON 响应（离线代理错误页/空响应）不能把解析异常原文抛给用户
  let body: { message: string; code: number; data: T }
  try {
    body = (await res.json()) as { message: string; code: number; data: T }
  } catch {
    throw new ApiError('后端无响应或返回异常——请确认 workbench-server 已启动')
  }
  if (body.code !== 0) throw new ApiError(body.message || '操作失败')
  return body.data
}
