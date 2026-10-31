/**
 * 源的唯一选择入口：回答「我在看哪套系统」。
 * - 单源：没有可切换对象，收敛成一行状态（名字 + 来源语义 + 最后活跃），不摆点了没反应的卡片
 * - 多源：可选卡片；异常源（错误率 >1%）排最前，点击切到该源的深潜
 * - 固定窗口语义：HTTP 源看近 1h，GitHub 日粒度源看近 7d（各自给有意义的窗口，卡片上标注）
 * 只接收概览域已过滤的源（github/* 属「我的项目」页），避免展示与可切换集合不一致。
 */
import { useEffect, useRef, useState } from 'react'
import { minutesToMs, monitorApi, RANGE_LABEL } from './api'
import type { OverviewData, RangeKey, SourceStat } from './api'
import { fmtHM, fmtInt, fmtRate } from '../../utils/format'
import { StatusDot, Tag } from '../../components/ui/ui'
import type { DotState } from '../../components/ui/ui'

interface Card extends OverviewData {
  name: string
  win: RangeKey
}

/** 状态灯：错误率优先，其次「有错误但未超阈值」，全绿才是 ok */
function stateOf(card: Card): DotState {
  return card.errRate > 0.01 ? 'err' : card.errCount > 0 ? 'warn' : 'ok'
}

export default function SourceCards({
  sources,
  active,
  onPick,
}: {
  sources: SourceStat[]
  active: string
  onPick: (name: string) => void
}) {
  const [cards, setCards] = useState<Card[] | null>(null)
  const sourcesKey = sources.map((source) => source.name).join('|')
  const sourcesRef = useRef(sources)
  useEffect(() => {
    sourcesRef.current = sources
  })

  useEffect(() => {
    let alive = true
    const load = async () => {
      const sourceList = sourcesRef.current
      if (sourceList.length === 0) {
        setCards([])
        return
      }
      try {
        const rows = await Promise.all(
          sourceList.map(async (source) => {
            // github/* 是日粒度数据，1h 窗口几乎恒为空——给 7d 才是「有意义的近期」
            const win: RangeKey = source.name.startsWith('github/') ? '7d' : '1h'
            const overview = await monitorApi.overview(source.name, win)
            return { name: source.name, win, ...overview }
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
  }, [sourcesKey])

  if (!cards || cards.length === 0) return null

  if (cards.length === 1) {
    const card = cards[0]
    const state = stateOf(card)
    return (
      <div className="mon-source">
        <StatusDot state={state} title={state === 'err' ? '错误率偏高' : '运行正常'} />
        <span className="mon-source-name">{card.name}</span>
        <span className="mon-source-meta">
          {card.name === 'workbench' ? '自监测' : '外部上报'} · 近 {RANGE_LABEL[card.win]}
        </span>
        <span className="mon-source-seen">最近活跃 {fmtHM(minutesToMs(sources[0].lastSeenMinute))}</span>
      </div>
    )
  }

  // 异常源排最前（错误率降序），其余按名称稳定排序
  const sortedCards = [...cards].sort((leftCard, rightCard) => {
    const isBadCard = (card: Card) => card.errRate > 0.01
    if (isBadCard(rightCard) !== isBadCard(leftCard)) return isBadCard(rightCard) ? -1 : 1
    return leftCard.name.localeCompare(rightCard.name)
  })

  return (
    <div className="mon-cards" role="group" aria-label="监测源">
      {sortedCards.map((card) => {
        const state = stateOf(card)
        return (
          <button
            key={card.name}
            className={'mon-card' + (card.name === active ? ' active' : '')}
            aria-pressed={card.name === active}
            onClick={() => onPick(card.name)}
          >
            <span className="mon-card-top">
              <i className={'mon-card-dot ' + state} aria-hidden="true" />
              <span className="mon-card-name">{card.name}</span>
              <Tag className="mon-card-win">{RANGE_LABEL[card.win]}</Tag>
            </span>
            <span className="mon-card-num">{fmtInt(card.count)}</span>
            <span className={'mon-card-sub' + (card.errRate > 0.01 ? ' bad' : '')}>
              错误 {fmtRate(card.errRate)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
