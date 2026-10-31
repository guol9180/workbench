/**
 * 底部遥测状态条：整屏唯一常驻的「活」区域。
 * 数据 = /api/monitor/status（存储规模/认证开关/丢弃计数）+ workbench 的 5m overview（rps/错误率）。
 * 后端不可达时灰灯示警；droppedEvents > 0 时琥珀提示背压丢数——这是存储侧唯一的静默损失，必须可见。
 */
import { useEffect, useState } from 'react'
import { fmtClock, fmtRate } from '../utils/format'
import { monitorApi } from '../modules/monitor/api'
import type { MonitorStatusData, OverviewData } from '../modules/monitor/api'

interface Snap {
  status: MonitorStatusData
  overview: OverviewData
}

export default function StatusBar() {
  const [now, setNow] = useState(() => Date.now())
  const [snapshot, setSnapshot] = useState<Snap | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000)
    let alive = true
    const run = async () => {
      if (document.hidden) return
      try {
        const [status, overview] = await Promise.all([monitorApi.status(), monitorApi.overview('workbench', '5m')])
        if (!alive) return
        setSnapshot({ status, overview })
        setOffline(false)
      } catch {
        if (alive) setOffline(true)
      }
    }
    void run()
    const poll = setInterval(run, 15_000)
    return () => {
      alive = false
      clearInterval(clock)
      clearInterval(poll)
    }
  }, [])

  const dropped = snapshot?.status.droppedEvents ?? 0

  return (
    <footer className="strip">
      {offline ? (
        <span className="strip-live is-offline">
          <i className="strip-dot strip-dot-off" aria-hidden="true" />
          后端未运行，启动 workbench-server 后自动恢复。
        </span>
      ) : (
        <span className="strip-live">
          <i className="strip-dot" aria-hidden="true" />
          workbench · {snapshot ? snapshot.overview.rps.toFixed(1) : '…'} rps
        </span>
      )}
      <span className="strip-mid">
        {snapshot &&
          `错误 ${fmtRate(snapshot.overview.errRate)} · 内存桶 ${snapshot.status.memoryBuckets} · 文件 ${snapshot.status.dataFiles}`}
        {dropped > 0 && <em className="strip-warn"> · 丢弃 {dropped} 条</em>}
      </span>
      <span className="strip-right">
        {snapshot ? (snapshot.status.authEnabled ? '认证已开' : '认证已关') : '——'} · <span className="strip-clock">{fmtClock(now)}</span>
      </span>
    </footer>
  )
}
