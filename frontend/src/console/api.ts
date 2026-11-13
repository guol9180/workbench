/**
 * 服务端 API 层：控制台唯一后端入口。
 *
 * 职责：统一携带会话令牌、解包 ApiResult、把 401 / 网络错误归一为可判别的异常——
 * 页面与组件不感知 fetch 细节。
 */

/** 前端与后端同源部署，请求一律使用相对路径；开发态由 Vite 代理到 8080。 */

/** 后端统一响应包装（AGENTS §7）：code=0 成功 */
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

  /** 后端不可达 / 代理失败 */
  get offline(): boolean {
    return this.httpStatus === 0
  }
}

// ---------------- 后端契约模型（与 AGENTS §7.2 表格一一对应） ----------------

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
  githubTokenConfigured: boolean
  githubTokenSource: string | null
}

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

export interface SourceConfigRequest {
  type: 'github'
  repo: string
  enabled: boolean
  metrics: string[]
}

export interface ProbeTargetView {
  id: string
  name: string
  url: string
  enabled: boolean
  createdAt: number
}

export interface ProbeTargetRequest {
  name: string
  url: string
  enabled: boolean
}

export interface CollectResult {
  ok: boolean
  error: string | null
}

// ---------------- 会话令牌：只存内存，刷新即重登（AGENTS §8.6） ----------------

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
    // 非 JSON 响应（如代理 502 页面）：按离线处理
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
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
}

export async function logout(): Promise<void> {
  const tokenAtStart = sessionToken
  if (!tokenAtStart) return
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } catch {
    // 注销失败不阻断锁屏（会话本来就会过期）
  }
  // 锁屏后可能已重新登录：只清理发起注销时的旧令牌
  if (sessionToken === tokenAtStart) sessionToken = ''
}

// ---------------- 监测 ----------------

export function fetchMonitorStatus(): Promise<MonitorStatus> {
  return request('/api/monitor/status')
}

export function fetchSources(): Promise<SourceStat[]> {
  return request('/api/monitor/sources')
}

export function fetchOverview(source: string, range: string): Promise<Overview> {
  return request(`/api/monitor/overview${queryString({ source, range })}`)
}

export function fetchSeries(
  source: string,
  metric: 'count' | 'avgMs' | 'errCount' | 'last',
  range: string,
  step: 'm' | 'h' = 'h',
  endpoint?: string,
): Promise<SeriesPoint[]> {
  return request(`/api/monitor/series${queryString({ source, metric, range, step, endpoint })}`)
}

export function fetchRecent(source?: string, limit = 100): Promise<RecentRecord[]> {
  return request(`/api/monitor/recent${queryString({ source, limit })}`)
}

// ---------------- 数据源配置（GitHub） ----------------

export function fetchSourceConfigs(): Promise<SourceConfigView[]> {
  return request('/api/monitor/source-configs')
}

export function createSourceConfig(body: SourceConfigRequest): Promise<{ id: string }> {
  return request('/api/monitor/source-configs', { method: 'POST', body: JSON.stringify(body) })
}

export function updateSourceConfig(id: string, body: SourceConfigRequest): Promise<void> {
  return request(`/api/monitor/source-configs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteSourceConfig(id: string): Promise<void> {
  return request(`/api/monitor/source-configs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function collectSourceConfig(id: string): Promise<CollectResult> {
  return request(`/api/monitor/source-configs/${encodeURIComponent(id)}/collect`, { method: 'POST' })
}

export function fetchGithubRepos(): Promise<string[]> {
  return request('/api/monitor/github/repos')
}

export function setGithubToken(token: string): Promise<void> {
  return request('/api/monitor/settings/github-token', { method: 'PUT', body: JSON.stringify({ token }) })
}

export function clearGithubToken(): Promise<void> {
  return request('/api/monitor/settings/github-token', { method: 'DELETE' })
}

// ---------------- 拨测目标 ----------------

export function fetchProbeTargets(): Promise<ProbeTargetView[]> {
  return request('/api/monitor/probe-targets')
}

export function createProbeTarget(body: ProbeTargetRequest): Promise<{ id: string }> {
  return request('/api/monitor/probe-targets', { method: 'POST', body: JSON.stringify(body) })
}

export function updateProbeTarget(id: string, body: ProbeTargetRequest): Promise<void> {
  return request(`/api/monitor/probe-targets/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteProbeTarget(id: string): Promise<void> {
  return request(`/api/monitor/probe-targets/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
