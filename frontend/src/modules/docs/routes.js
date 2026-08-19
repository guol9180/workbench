/** 在线文档模块路由。新增功能模块时在 router/index.js 中同样挂载各自 routes */
export default [
  {
    path: '/login',
    component: () => import('./components/LoginView.vue'),
  },
  {
    path: '/docs',
    component: () => import('./components/DocsView.vue'),
  },
]
