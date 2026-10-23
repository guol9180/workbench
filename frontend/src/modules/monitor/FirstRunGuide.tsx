/** 首次使用引导：空态即门，不是墙。三步是真实顺序，编号合法 */
import { Link } from 'react-router-dom'

export default function FirstRunGuide() {
  return (
    <section className="panel mon-guide">
      <h2 className="mon-guide-title">三步点亮你的观测站</h2>
      <ol className="mon-guide-steps">
        <li>
          <span className="mon-guide-num">1</span>
          <div>
            <b>让本系统产生流量</b>
            <p>随便打开一页文档——自监测会把每次 /api 调用记成描迹。</p>
            <Link className="mon-guide-link" to="/docs">打开文档工具</Link>
          </div>
        </li>
        <li>
          <span className="mon-guide-num">2</span>
          <div>
            <b>接入你的 GitHub 仓库</b>
            <p>Pages 浏览量与 Release 下载量将作为独立数据源出现在上面的源列表。</p>
            <Link className="mon-guide-link" to="/sources">去数据源页接入</Link>
          </div>
        </li>
        <li>
          <span className="mon-guide-num">3</span>
          <div>
            <b>回到概览看描迹出现</b>
            <p>顶部卡片是所有源的健康度；随时按 Ctrl K 跳转或搜索文档。</p>
          </div>
        </li>
      </ol>
    </section>
  )
}
