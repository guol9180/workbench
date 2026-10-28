/**
 * 工作台首页：统一门面，消解"多个小应用硬粘在一起"的割裂感。
 * - 工具卡片区：每个业务模块一张卡（域色点 + 一句话 + 快捷入口），后续新工具 = 加一张卡
 * - 健康摘要条：所有监测源的状态一行看完，异常源排前，点击去概览深潜
 * - 最近文档：最近打开 3 篇直达（经 location.state 交给文档页打开）
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { monitorApi } from '../monitor/api'
import type { OverviewData, RangeKey } from '../monitor/api'
import { fmtClock, fmtHM, fmtInt, fmtRate } from '../../utils/format'
import { minutesToMs } from '../monitor/api'
import { getRecent } from '../docs/recent'
import { baseName } from '../docs/util'
import { Panel, StatusDot } from '../../components/ui/ui'
import './home.css'

interface HealthRow {
  name: string
  win: RangeKey
  lastSeenMinute: number
  overview: OverviewData
}

/** 健康摘要：sources → 逐源 overview（GitHub 源取 7d，其余 1h），异常排前，15s 静默刷新 */
function useHealth(): HealthRow[] {
  const [rows, setRows] = useState<HealthRow[]>([])
  const [namesKey, setNamesKey] = useState('')
  const namesRef = useRef<string[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const sources = await monitorApi.sources()
        const names = sources.map((s) => s.name)
        namesRef.current = names
        if (alive) setNamesKey(names.join('|'))
        if (names.length === 0) {
          if (alive) setRows([])
          return
        }
        const list = await Promise.all(
          sources.map(async (s) => {
            const name = s.name
            const win: RangeKey = name.startsWith('github/') ? '7d' : '1h'
            return { name, win, lastSeenMinute: s.lastSeenMinute, overview: await monitorApi.overview(name, win) }
          }),
        )
        if (alive) setRows(list)
      } catch {
        // 摘要是辅助层：失败保留旧值，不打断首页
      }
    }
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 15_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    // namesKey 变化即重排：异常源（错误率 >1%）排最前，其余按名称稳定排序
    setRows((prev) => [...prev].sort((a, b) => {
      const bad = (r: HealthRow) => (r.overview.errRate > 0.01 ? 1 : 0)
      if (bad(b) !== bad(a)) return bad(b) - bad(a)
      return a.name.localeCompare(b.name)
    }))
  }, [namesKey])

  return rows
}

function greeting(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

const TOOLS = [
  {
    to: '/monitor',
    name: '概览',
    domain: 'analysis' as const,
    desc: 'API 流量态势、延迟描迹与端点遥测台账',
  },
  {
    to: '/docs',
    name: '文档',
    domain: 'docs' as const,
    desc: '在线 Markdown 写作：目录树、全文搜索、自动保存',
  },
  {
    to: '/sources',
    name: '数据源',
    domain: 'analysis' as const,
    desc: '接入 GitHub Pages 流量与 Release 下载量等外部数据',
  },
]

export default function HomeView() {
  const navigate = useNavigate()
  const health = useHealth()
  const [now, setNow] = useState(() => new Date())
  const recent = getRecent().slice(0, 3)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <h1 className="home-title">{greeting(now.getHours())}，工作台</h1>
          <p className="home-sub">
            {now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} · 随时
            <kbd className="home-kbd">Ctrl K</kbd> 跳转或搜文档
          </p>
        </div>
        <span className="home-clock">{fmtClock(now.getTime())}</span>
      </header>

      <div className="home-tools">
        {TOOLS.map((t) => (
          <button key={t.to} className="home-tool panel" onClick={() => navigate(t.to)}>
            <span className="home-tool-top">
              <i className={'home-tool-domain d-' + t.domain} aria-hidden="true" />
              <span className="home-tool-name">{t.name}</span>
              <span className="home-tool-arrow" aria-hidden="true">→</span>
            </span>
            <span className="home-tool-desc">{t.desc}</span>
          </button>
        ))}
      </div>

      {health.length > 0 && (
        <Panel className="home-health">
          <header className="home-health-head">
            <span className="home-health-title">全局健康</span>
            <button className="home-health-more" onClick={() => navigate('/monitor')}>
              去概览 →
            </button>
          </header>
          <div className="home-health-rows">
            {health.map((r) => {
              const bad = r.overview.errRate > 0.01
              return (
                <button key={r.name} className="home-health-row" title={'近 ' + r.win} onClick={() => navigate('/monitor')}>
                  <StatusDot state={bad ? 'err' : 'ok'} />
                  <span className="home-health-name">{r.name}</span>
                  <span className="home-health-num">{fmtInt(r.overview.count)}</span>
                  <span className={'home-health-err' + (bad ? ' bad' : '')}>{fmtRate(r.overview.errRate)}</span>
                  <span className="home-health-seen" title="最后活跃">{fmtHM(minutesToMs(r.lastSeenMinute))}</span>
                </button>
              )
            })}
          </div>
        </Panel>
      )}

      {recent.length > 0 && (
        <Panel className="home-recent">
          <header className="home-health-head">
            <span className="home-health-title">最近文档</span>
            <button className="home-health-more" onClick={() => navigate('/docs')}>
              打开文档 →
            </button>
          </header>
          <div className="home-recent-rows">
            {recent.map((p) => (
              <button
                key={p}
                className="home-recent-row"
                title={p}
                onClick={() => navigate('/docs', { state: { openDoc: p } })}
              >
                {baseName(p)}
              </button>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
