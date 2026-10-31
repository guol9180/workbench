/** 首次使用引导：空态即门，不是墙。三步是真实顺序，编号合法 */
import { Link } from 'react-router-dom'

export default function FirstRunGuide() {
  return (
    <section className="panel mon-guide">
      <h2 className="mon-guide-title">还没有流量，先做三件事</h2>
      <ol className="mon-guide-steps">
        <li>
          <span className="mon-guide-num">1</span>
          <div>
            <b>让系统先产生流量</b>
            <p>打开任意一篇文档，接口就会被调用。第一次描迹从那里开始。</p>
            <Link className="mon-guide-link" to="/docs">去写一篇</Link>
          </div>
        </li>
        <li>
          <span className="mon-guide-num">2</span>
          <div>
            <b>接入一个 GitHub 项目</b>
            <p>Pages 浏览量和 Release 下载量会作为独立数据源出现在这里。</p>
            <Link className="mon-guide-link" to="/sources">去我的项目</Link>
          </div>
        </li>
        <li>
          <span className="mon-guide-num">3</span>
          <div>
            <b>回来看结果</b>
            <p>源、错误率和最忙的端点都在这一页。Ctrl K 随时跳转。</p>
          </div>
        </li>
      </ol>
    </section>
  )
}
