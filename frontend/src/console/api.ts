/**
 * 服务端模式 API 层（M13）：双模式控制台的唯一后端入口。
 *
 * 职责：统一携带会话令牌、解包 ApiResult、把 401 / 网络错误归一为可判别的异常——
 * 页面与组件不感知 fetch 细节。演示模式（后端不可达）完全不经过本文件。
 */

/**
 * 后端基地址：开发态留空 = 同源相对路径，走 Vite 代理到本地 8080；
 * 生产由 CI 注入 VITE_API_BASE（如 https://api.imhgl.com）——GitHub Pages 是纯静态托管，
 * 不配基地址时前端只能探测自身域名的 /api（必然 404）并回落演示模式。
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

/** 后端统一响应包装（AGENTS §8）：code=0 成功 */
interface ApiEnvelope<T> {
  message: string
  code: number
  data: T
}

/** 业务/传输错误的统一形态：调用方按 needRelogin / offline 分流处理 */
export class ApiError extends Error {
  /** 业务错误码（40100 未认证 / 40400 不存在 / 40000 参数；网络失败为 0） */
  readonly apiCode: number
  /** HTTP 状态码；网络失败为 0 */
  readonly httpStatus: number

  constructor(message: string, apiCode: number, httpStatus: number) {
    super(message)
    this.apiCode = apiCode
    this.httpStatus = httpStatus
  }

  /** 会话失效（需回锁屏重登）或机器凭据被拒 */
  get needRelogin(): boolean {
    return this.httpStatus === 401
  }

  /** 后端不可达 / 代理失败——调用方应整体回落演示模式 */
  get offline(): boolean {
    return this.httpStatus === 0
  }
}

// ---------------- 后端契约模型（与 §8 表格一一对应） ----------------

export interface SourceStat {
  name: string
  lastSeenMinute: number
}

export interface Overview {
  count: number
  errCount: number
  errRate: number
  avgMs: number
  p95Ms: number
  rps: number
}

export interface SeriesPoint {
  bucketEpoch: number
  value: number
}

export interface RecentRecord {
  minute: number
  source: string
  endpoint: string
  method: string
  count: number
  errCount: number
  avgMs: number
  maxMs: number
}

export interface MonitorStatus {
  memoryBuckets: number
  dataFiles: number
  authEnabled: boolean
  droppedEvents: number
  githubTokenReady: boolean
  githubTokenSource: string | null
}

export interface DocNode {
  name: string
  path: string
  type: 'dir' | 'file'
  children: DocNode[]
}

export interface DocContent {
  path: string
  name: string
  content: string
}

export interface SearchHit {
  path: string
  name: string
  fileNameMatch: boolean
  line: number
  snippet: string
}

// ---------------- 会话令牌：只存内存，刷新即重登（AGENTS §9.4） ----------------

let sessionToken = ''

export function setSessionToken(token: string): void {
  sessionToken = token
}

export function hasSessionToken(): boolean {
  return sessionToken !== ''
}

/** 401 统一分流回调：由 ConsoleApp 注入（回锁屏重登） */
let unauthorizedHandler: (() => void) | null = null

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(sessionToken ? { 'X-API-Token': sessionToken } : {}),
        ...init.headers,
      },
    })
  } catch {
    // fetch 只有网络层失败才 reject（HTTP 4xx/5xx 都走 then），这里就是「后端不可达」
    throw new ApiError('后端不可达', 0, 0)
  }
  let envelope: ApiEnvelope<T> | null = null
  try {
    envelope = await response.json() as ApiEnvelope<T>
  } catch {
    // 非 JSON 响应（如代理 502 页面）：按离线处理，双模式回落演示
    throw new ApiError('后端响应异常', 0, response.status)
  }
  if (!response.ok || envelope.code !== 0) {
    const error = new ApiError(envelope.message || '请求失败', envelope.code, response.status)
    if (error.needRelogin && unauthorizedHandler) unauthorizedHandler()
    throw error
  }
  return envelope.data
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ---------------- 认证 ----------------

export async function login(password: string): Promise<{ token: string; expiresAt: number }> {
  return request(`${API_BASE}/api/auth/login`, { method: 'POST', body: JSON.stringify({ password }) })
}

export async function logout(): Promise<void> {
  if (!sessionToken) return
  try {
    await request(`${API_BASE}/api/auth/logout`, { method: 'POST' })
  } catch {
    // 注销失败不阻断锁屏（会话本来就会过期）
  }
  sessionToken = ''
}

// ---------------- 监测 ----------------

export function fetchMonitorStatus(): Promise<MonitorStatus> {
  return request(`${API_BASE}/api/monitor/status`)
}

export function fetchSources(): Promise<SourceStat[]> {
  return request(`${API_BASE}/api/monitor/sources`)
}

export function fetchOverview(source: string, range: string): Promise<Overview> {
  return request(`${API_BASE}/api/monitor/overview${queryString({ source, range })}`)
}

export function fetchSeries(source: string, metric: 'count' | 'avgMs' | 'errCount', range: string, step: 'm' | 'h' = 'h'): Promise<SeriesPoint[]> {
  return request(`${API_BASE}/api/monitor/series${queryString({ source, metric, range, step })}`)
}

export function fetchRecent(source?: string, limit = 100): Promise<RecentRecord[]> {
  return request(`${API_BASE}/api/monitor/recent${queryString({ source, limit })}`)
}

// ---------------- 文档 ----------------

export function fetchDocTree(): Promise<DocNode> {
  return request(`${API_BASE}/api/docs/tree`)
}

export function fetchDocFile(path: string): Promise<DocContent> {
  return request(`${API_BASE}/api/docs/file${queryString({ path })}`)
}

export function createDocFile(path: string, content: string): Promise<void> {
  return request(`${API_BASE}/api/docs/file`, { method: 'POST', body: JSON.stringify({ path, content }) })
}

export function saveDocFile(path: string, content: string): Promise<void> {
  return request(`${API_BASE}/api/docs/file`, { method: 'PUT', body: JSON.stringify({ path, content }) })
}

export function renameDocFile(from: string, to: string): Promise<void> {
  return request(`${API_BASE}/api/docs/rename`, { method: 'POST', body: JSON.stringify({ from, to }) })
}

export function deleteDocFile(path: string): Promise<void> {
  return request(`${API_BASE}/api/docs/resource${queryString({ path })}`, { method: 'DELETE' })
}

export function searchDocs(queryText: string): Promise<SearchHit[]> {
  return request(`${API_BASE}/api/docs/search${queryString({ q: queryText })}`)
}
