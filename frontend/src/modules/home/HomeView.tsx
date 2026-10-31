/**
 * 工作台首页：统一门面，消解"多个小应用硬粘在一起"的割裂感。
 * - 工具卡片区：每个业务模块一张卡（图标 + 一句话 + 域标签），后续新工具 = 加一张卡
 * - 全局健康：所有监测源的状态一张表看完，异常源排前；点击去对应页面深潜
 * - 最近文档：最近打开 3 篇直达（经 location.state 交给文档页打开）
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { minutesToMs, monitorApi, RANGE_LABEL } from '../monitor/api'
import type { MonitorStatusData, OverviewData, RangeKey } from '../monitor/api'
import { usePolling } from '../monitor/useMonitor'
import { fmtClock, fmtHM, fmtInt, fmtRate } from '../../utils/format'
import { getRecent } from '../docs/recent'
import { baseName } from '../docs/util'
import { Button, EmptyState, Icon, PageHeader, Panel, StatusDot, Tag } from '../../components/ui/ui'
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
        const names = sources.map((source) => source.name)
        namesRef.current = names
        if (alive) setNamesKey(names.join('|'))
        if (names.length === 0) {
          if (alive) setRows([])
          return
        }
        const list = await Promise.all(
          sources.map(async (source) => {
            const name = source.name
            const win: RangeKey = name.startsWith('github/') ? '7d' : '1h'
            return {
              name,
              win,
              lastSeenMinute: source.lastSeenMinute,
              overview: await monitorApi.overview(name, win),
            }
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
    setRows((previousRows) =>
      [...previousRows].sort((leftRow, rightRow) => {
        const isBadRow = (row: HealthRow) => row.overview.errRate > 0.01
        if (isBadRow(rightRow) !== isBadRow(leftRow)) return isBadRow(rightRow) ? -1 : 1
        return leftRow.name.localeCompare(rightRow.name)
      }),
    )
  }, [namesKey])

  return rows
}

interface PulseSnapshot {
  status: MonitorStatusData | null
  overview: OverviewData | null
}

/** 系统脉搏：存储规模 + workbench 近 5m 速率；失败时保留旧值，页面不闪 */
function usePulse(): PulseSnapshot {
  const statusQuery = usePolling(monitorApi.status, 'home-status', { intervalMs: 20_000 })
  const overviewQuery = usePolling(() => monitorApi.overview('workbench', '5m'), 'home-pulse', {
    intervalMs: 15_000,
  })
  return { status: statusQuery.data, overview: overviewQuery.data }
}

function greeting(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 窄屏简称：github/owner/name 只留仓库名（owner 相同，前缀没有信息量） */
function shortSourceName(sourceName: string): string {
  if (!sourceName.startsWith('github/')) return sourceName
  return sourceName.split('/').slice(-1)[0]
}



const TOOLS: Array<{
  to: string
  name: string
  tag: string
  domain: 'analysis' | 'docs'
  desc: string
  icon: ReactElement
}> = [
  {
    to: '/monitor',
    name: '概览',
    tag: '监测',
    domain: 'analysis',
    desc: '流量、延迟、端点，一屏看完。',
    icon: <Icon name="pulse" />,
  },
  {
    to: '/docs',
    name: '文档',
    tag: '写作',
    domain: 'docs',
    desc: 'Markdown 写作、自动保存、全文搜索。',
    icon: <Icon name="docs" />,
  },
  {
    to: '/sources',
    name: '我的项目',
    tag: '统计',
    domain: 'analysis',
    desc: 'GitHub 项目的 Pages 流量与 Release 下载量。',
    icon: <Icon name="projects" />,
  },
]

export default function HomeView() {
  const navigate = useNavigate()
  const health = useHealth()
  const pulse = usePulse()
  const [now, setNow] = useState(() => new Date())
  const recent = getRecent().slice(0, 3)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const dateText = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  const weekdayText = now.toLocaleDateString('zh-CN', { weekday: 'long' })

  return (
    <div className="home">
      <PageHeader
        eyebrow="工作台 / Workbench"
        title={greeting(now.getHours())}
        desc={
          <>
            {dateText} · {weekdayText} · <kbd>Ctrl K</kbd> 跳转或搜索
          </>
        }
      >
        <span className="home-clock">
          <i className="dot ok" aria-hidden="true" />
          {fmtClock(now.getTime())}
        </span>
      </PageHeader>

      <section className="home-tools" aria-label="工具">
        {TOOLS.map((tool) => (
          <button key={tool.to} className="home-tool panel" onClick={() => navigate(tool.to)}>
            <span className={'home-tool-mark d-' + tool.domain}>{tool.icon}</span>
            <span className="home-tool-body">
              <span className="home-tool-top">
                <span className="home-tool-name">{tool.name}</span>
                <Tag>{tool.tag}</Tag>
              </span>
              <span className="home-tool-desc">{tool.desc}</span>
            </span>
            <Icon name="arrow-right" size={16} className="home-tool-arrow" />
          </button>
        ))}
      </section>

      <div className="home-lower">
        <Panel className="home-health">
          <header className="home-panel-head">
            <span className="home-panel-title">全局健康</span>
            <Tag>{health.length} 个源</Tag>
            <Button variant="ghost" size="sm" className="home-panel-more" onClick={() => navigate('/monitor')}>
              看细节 <Icon name="arrow-right" size={14} />
            </Button>
          </header>

          {health.length === 0 ? (
            <EmptyState>还没有监测源。打开一篇文档或调用任意接口，之后会在这里开始记录。</EmptyState>
          ) : (
            <div className="home-rows">
              <div className="home-row home-row-head" aria-hidden="true">
                <span />
                <span>源</span>
                <span className="num">范围</span>
                <span className="num">请求</span>
                <span className="num">错误率</span>
                <span className="num">最近活跃</span>
              </div>
              {health.map((row) => {
                const isBad = row.overview.errRate > 0.01
                const isRepo = row.name.startsWith('github/')
                return (
                  <button
                    key={row.name}
                    className="home-row"
                    title={'近 ' + RANGE_LABEL[row.win] + ' · ' + row.name}
                    onClick={() => navigate(isRepo ? '/sources' : '/monitor')}
                  >
                    <StatusDot state={isBad ? 'err' : 'ok'} />
                    <span className="home-row-name">
                      <span className="home-row-name-full">{row.name}</span>
                      <span className="home-row-name-short">{shortSourceName(row.name)}</span>
                    </span>
                    <span className="home-row-win">{RANGE_LABEL[row.win]}</span>
                    <span className="home-row-num">{fmtInt(row.overview.count)}</span>
                    <span className={'home-row-num' + (isBad ? ' bad' : '')}>{fmtRate(row.overview.errRate)}</span>
                    <span className="home-row-seen">{fmtHM(minutesToMs(row.lastSeenMinute))}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel className="home-recent">
          <header className="home-panel-head">
            <span className="home-panel-title">最近文档</span>
            <Button variant="ghost" size="sm" className="home-panel-more" onClick={() => navigate('/docs')}>
              去写文档 <Icon name="arrow-right" size={14} />
            </Button>
          </header>

          {recent.length === 0 ? (
            <EmptyState>最近没有打开过的文档。去写一篇。</EmptyState>
          ) : (
            <div className="home-docs">
              {recent.map((docPath) => (
                <button
                  key={docPath}
                  className="home-doc-row"
                  title={docPath}
                  onClick={() => navigate('/docs', { state: { openDoc: docPath } })}
                >
                  <span className="home-doc-icon"><Icon name="file" size={16} /></span>
                  <span className="home-doc-name">{baseName(docPath)}</span>
                  <span className="home-doc-path">{docPath}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="home-pulse">
        <header className="home-panel-head">
          <span className="home-panel-title">系统脉搏</span>
          <Tag>workbench · 近 5 分钟</Tag>
        </header>
        <div className="home-pulse-grid">
          <div className="home-pulse-cell">
            <span className="home-pulse-num">{pulse.overview ? pulse.overview.rps.toFixed(1) : '—'}</span>
            <span className="home-pulse-label">每秒请求</span>
          </div>
          <div className="home-pulse-cell">
            <span className="home-pulse-num">{pulse.overview ? fmtRate(pulse.overview.errRate) : '—'}</span>
            <span className="home-pulse-label">错误率</span>
          </div>
          <div className="home-pulse-cell">
            <span className="home-pulse-num">{pulse.status ? fmtInt(pulse.status.memoryBuckets) : '—'}</span>
            <span className="home-pulse-label">内存桶</span>
          </div>
          <div className="home-pulse-cell">
            <span className="home-pulse-num">{pulse.status ? fmtInt(pulse.status.dataFiles) : '—'}</span>
            <span className="home-pulse-label">数据文件</span>
          </div>
        </div>
        <div className="home-pulse-foot">
          {pulse.status ? (
            <>
              <span>认证{pulse.status.authEnabled ? '已开' : '已关'}</span>
              <span className={pulse.status.droppedEvents > 0 ? 'warn' : undefined}>
                {pulse.status.droppedEvents > 0
                  ? '有 ' + fmtInt(pulse.status.droppedEvents) + ' 条数据被丢弃'
                  : '没有丢弃数据'}
              </span>
            </>
          ) : (
            <span>后端离线，数据暂停更新</span>
          )}
        </div>
      </Panel>
    </div>
  )
}
