import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发态把 /api 代理到本地后端（workbench-server 8080）；
// 生产由 VITE_API_BASE 指向后端域名（见 .env.example）。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
