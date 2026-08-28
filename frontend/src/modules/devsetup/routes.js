/** 开发环境管家模块路由。在 router/index.js 中挂载 */
export default [
  {
    path: '/setup',
    component: () => import('./components/DevSetupView.vue'),
  },
]
