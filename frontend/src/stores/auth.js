import { defineStore } from 'pinia'
import { api, getToken, setToken } from '../api/http'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken() || '',
  }),
  getters: {
    authed: (s) => !!s.token,
  },
  actions: {
    async login(password) {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      this.token = data.token
      setToken(data.token)
    },
    logout() {
      // 无状态 token：登出即前端删除，无需调用服务端
      this.token = ''
      setToken(null)
    },
  },
})
