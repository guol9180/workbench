import router from '../router'

/**
 * 统一 API 请求封装：
 * - 拼接 VITE_API_BASE（生产环境指向后端域名，本地开发为空走 vite 代理）
 * - 自动携带 Bearer token（token 认证，不依赖 cookie，天然支持跨域）
 * - 401 时清除 token 并跳转登录页
 */
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
const TOKEN_KEY = 'wb-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) {
    headers['Authorization'] = 'Bearer ' + token
  }
  const res = await fetch(BASE + url, { ...options, headers })
  if (res.status === 401) {
    setToken(null)
    if (router.currentRoute.value.path !== '/login') {
      router.push('/login')
    }
    throw new Error('未登录')
  }
  const body = await res.json()
  if (!body.success) {
    throw new Error(body.message || '操作失败')
  }
  return body.data
}
