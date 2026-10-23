/**
 * 全局态势卡片行：回答「我所有系统还好吗」——每个源一张卡，一眼看健康度。
 * - 固定窗口语义：HTTP 源看近 1h，GitHub 日粒度源看近 7d（各自给有意义的窗口，卡片上标注）
 * - 异常源（错误率 >1%）排最前：先看坏的
 * - 点击切到该源的深潜（概览主图随之切换）
 */
import { useEffect, useRef, useState } from 'react'
import { monitorApi } from './api'
import type { OverviewData, RangeKey } from './api'
import { fmtInt, fmtRate } from '../../utils/format'

interface Card extends OverviewData {
  name: string
  win: RangeKey
}

export default function SourceCards({
  sources,
  active,
  onPick,
}: {
  sources: string[]
  active: string
  onPick: (name: string) => void
}) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const key = sources.join('|')
  const sourcesRef = useRef(sources)
  useEffect(() => {
    sourcesRef.current = sources
  })

  useEffect(() => {
    let alive = true
    const load = async () => {
      const list = sourcesRef.current
      if (list.length === 0) {
        setCards([])
        return
      }
      try {
        const rows = await Promise.all(
          list.map(async (name) => {
            // github/* 是日粒度数据，1h 窗口几乎恒为空——给 7d 才是「有意义的近期」
            const win: RangeKey = name.startsWith('github/') ? '7d' : '1h'
            const ov = await monitorApi.overview(name, win)
            return { name, win, ...ov }
          }),
        )
        if (alive) setCards(rows)
      } catch {
        // 卡片是辅助层：失败时保留旧值，不打断主图
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
  }, [key])

  if (!cards || cards.length === 0) return null

  // 异常源排最前（错误率降序），其余按名称稳定排序
  const sorted = [...cards].sort((a, b) => {
    const bad = (c: Card) => (c.errRate > 0.01 ? 1 : 0)
    if (bad(b) !== bad(a)) return bad(b) - bad(a)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="mon-cards" role="group" aria-label="源健康度">
      {sorted.map((c) => {
        const state = c.errRate > 0.01 ? 'err' : c.errCount > 0 ? 'warn' : 'ok'
        return (
          <button
            key={c.name}
            className={'mon-card' + (c.name === active ? ' active' : '')}
            onClick={() => onPick(c.name)}
          >
            <span className="mon-card-top">
              <i className={'mon-card-dot ' + state} aria-hidden="true" />
              <span className="mon-card-name">{c.name}</span>
              <span className="mon-card-win">{c.win}</span>
            </span>
            <span className="mon-card-num">{fmtInt(c.count)}</span>
            <span className={'mon-card-sub' + (c.errRate > 0.01 ? ' bad' : '')}>
              err {fmtRate(c.errRate)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
