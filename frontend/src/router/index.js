import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import docsRoutes from '../modules/docs/routes'

// hash 路由：GitHub Pages 无需 404.html 兜底，深链接直接可用
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/docs' },
    ...docsRoutes,
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.authed) {
    return '/login'
  }
  if (to.path === '/login' && auth.authed) {
    return '/docs'
  }
})

export default router
