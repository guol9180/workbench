import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // GitHub Pages 部署在子路径（<user>.github.io/<repo>/），必须用相对 base
  base: './',
  plugins: [vue()],
  server: {
    // 本地开发：/api 代理到后端，无需处理跨域；VITE_API_BASE 留空即可
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
