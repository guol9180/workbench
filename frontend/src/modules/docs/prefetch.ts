/**
 * Vditor Lute 引擎空闲预载。
 * 背景：Lute（约 3.7MB）平时在进入文档页、编辑器初始化时才开始下载，且 GitHub Pages
 * 静态资源缓存仅 10 分钟——每个新会话首开文档都要白等「下载 + 解析」数秒，内容虽然
 * 已从 API 拿到却只能挂在 pendingValue 里等它。这里在应用启动空闲时提前执行该脚本，
 * 把这段耗时挪出用户的等待路径。
 *
 * 与 Vditor 加载器的握手约定：其懒加载按 id="vditorLuteScript" 去重（查到即复用、
 * 不再注入）。预载脚本必须等 onload 后才补 id——若一注入就占 id，Vditor 会在脚本
 * 尚未执行完时误判引擎可用，导致 Lute 未定义而初始化失败。id 时机与其自身实现
 * （onload 后置 id）保持一致。
 * 用户在预载完成前就进文档页也安全：Vditor 注入同 URL 脚本，浏览器对同 URL 并发
 * 请求自动合并，不会双份下载；两个 onload 竞速由下方「已存在即不重复置 id」收敛。
 */
const LUTE_ID = 'vditorLuteScript'

export function prefetchVditorLute(): void {
  if (document.getElementById(LUTE_ID)) return
  const run = () => {
    if (document.getElementById(LUTE_ID)) return
    const script = document.createElement('script')
    script.src = import.meta.env.BASE_URL + 'vendor/vditor/dist/js/lute/lute.min.js'
    script.async = true
    script.onload = () => {
      // 只在尚无同 id 脚本时置 id，避免与 Vditor 自己注入的那份产生重复 id
      if (!document.getElementById(LUTE_ID)) script.id = LUTE_ID
    }
    document.head.appendChild(script)
  }
  // 空闲才下载：不与首屏渲染抢带宽；timeout 兜底保证最迟也会执行
  window.requestIdleCallback(run, { timeout: 3000 })
}
