/**
 * PulseChart：观测站的主图（纯 SVG，零图表库依赖）。
 * - variant='trace'：刻度栅格 + 面积描迹（分钟/小时语义）；数据到达时描迹自左向右绘线一次——全站唯一非用户触发的动效
 * - variant='bars'：日柱（GitHub 日粒度数据）——柱心按等宽槽分布，悬浮高亮当前柱
 * - hover 十字线/柱高亮吸附最近桶，浮层给出该桶时间与读数
 * - 宽度由 ResizeObserver 实测像素，保证 1px 描迹清晰不模糊；
 *   reduced-motion 下动画被全局 CSS 熄灭（瞬时呈现）
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { fmtShort } from '../utils/format'
import './PulseChart.css'

/** 图表视图模型：时间(epoch ms) + 值。后端字段名由 monitor 模块映射后再传入 */
export interface ChartPoint {
  timestamp: number
  value: number
}

/** 内边距：左留轴读数，下留时间刻度 */
const CHART_PADDING = { top: 16, right: 14, bottom: 24, left: 46 }

interface Props {
  points: ChartPoint[]
  height?: number
  color?: string
  variant?: 'trace' | 'bars'
  formatValue: (value: number) => string
  formatTime: (timestamp: number) => string
  /** 无数据时的空态文案（trace 与 bars 的语义不同，由调用方决定） */
  emptyText?: string
}

/** y 轴上界取 1/2/2.5/5×10^k 的「好看」值：避免 20→50 这类粗跳把描迹压进底部死角 */
function niceMax(maxValue: number): number {
  if (maxValue <= 0) return 1
  const base = Math.pow(10, Math.floor(Math.log10(maxValue)))
  for (const multiplier of [1, 2, 2.5, 5, 10]) {
    if (maxValue <= multiplier * base) return multiplier * base
  }
  return 10 * base
}

export default function PulseChart({
  points,
  height = 300,
  color = 'var(--accent)',
  variant = 'trace',
  formatValue,
  formatTime,
  emptyText,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // useId 生成渐变 id：同页多实例不串渐变
  const gradientId = useId()

  const geometry = useMemo(() => {
    if (width < 80 || points.length === 0) return null
    const plotWidth = width - CHART_PADDING.left - CHART_PADDING.right
    const plotHeight = height - CHART_PADDING.top - CHART_PADDING.bottom
    const pointCount = points.length
    const topValue = niceMax(Math.max(...points.map((point) => point.value)))

    // trace：桶心铺满左右边；bars：等宽槽居中（首尾柱不裁边）
    const traceX = (pointIndex: number) =>
      CHART_PADDING.left + (pointIndex / Math.max(1, pointCount - 1)) * plotWidth
    const slotX = (pointIndex: number) =>
      CHART_PADDING.left + ((pointIndex + 0.5) / pointCount) * plotWidth
    const xForIndex = variant === 'bars' ? slotX : traceX
    const barWidth = Math.max(2, (plotWidth / pointCount) * 0.6)
    const valueY = (value: number) =>
      CHART_PADDING.top + plotHeight - (value / topValue) * plotHeight

    const line = points
      .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${traceX(pointIndex).toFixed(1)},${valueY(point.value).toFixed(1)}`)
      .join(' ')
    const baselineY = (CHART_PADDING.top + plotHeight).toFixed(1)
    const area = `${line} L${traceX(pointCount - 1).toFixed(1)},${baselineY} L${CHART_PADDING.left},${baselineY} Z`

    // 等分份数按上界整除性选（4 或 5），保证每条栅格的读数都是整洁整数
    const divisions = topValue % 4 === 0 ? 4 : 5
    const gridLines = Array.from({ length: divisions + 1 }, (_, divisionIndex) => {
      const fraction = divisionIndex / divisions
      return { y: CHART_PADDING.top + plotHeight * fraction, value: topValue * (1 - fraction) }
    })

    const tickInterval = Math.max(
      1,
      Math.ceil(pointCount / Math.max(2, Math.min(8, Math.floor(plotWidth / 72)))),
    )
    const ticks = points
      .map((point, pointIndex) => ({ point, pointIndex }))
      .filter(({ pointIndex }) => pointIndex % tickInterval === 0)
    // 补右端点刻度：数据到 16:50 而最后刻度停在 16:41 会像被切掉；与前一刻度太近则放弃
    const lastIndex = pointCount - 1
    if (lastIndex % tickInterval !== 0) {
      const previousTickIndex = ticks.length > 0 ? ticks[ticks.length - 1].pointIndex : 0
      if (lastIndex - previousTickIndex >= 3) {
        ticks.push({ point: points[lastIndex], pointIndex: lastIndex })
      }
    }

    return {
      plotWidth,
      plotHeight,
      xForIndex,
      slotX,
      barWidth,
      valueY,
      line,
      area,
      gridLines,
      ticks,
    }
  }, [width, height, points, variant])

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!geometry) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left - CHART_PADDING.left) / geometry.plotWidth
    const candidateIndex =
      variant === 'bars' ? Math.floor(ratio * points.length) : Math.round(ratio * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, candidateIndex)))
  }

  const hoverPoint = hoverIndex != null && geometry ? points[hoverIndex] : null
  const hasSignal = points.some((point) => point.value > 0)

  return (
    <div
      ref={boxRef}
      className="pulse"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      {geometry && (
        <svg width={width} height={height} className="pulse-svg" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {geometry.gridLines.map((gridLine) => (
            <g key={gridLine.y}>
              <line
                x1={CHART_PADDING.left}
                x2={width - CHART_PADDING.right}
                y1={gridLine.y}
                y2={gridLine.y}
                className="pulse-grid"
              />
              <text
                x={CHART_PADDING.left - 8}
                y={gridLine.y + 3}
                className="pulse-axis"
                textAnchor="end"
              >
                {fmtShort(gridLine.value)}
              </text>
            </g>
          ))}
          {geometry.ticks.map(({ point, pointIndex }) => {
            // 距左右边界不足 30px 时改端点对齐：中间对齐会把时间标签画出绘图区
            const tickX = geometry.xForIndex(pointIndex)
            const textAnchor =
              tickX - CHART_PADDING.left < 30
                ? 'start'
                : width - CHART_PADDING.right - tickX < 30
                  ? 'end'
                  : 'middle'
            return (
              <text
                key={pointIndex}
                x={tickX}
                y={height - 6}
                className="pulse-axis"
                textAnchor={textAnchor}
              >
                {formatTime(point.timestamp)}
              </text>
            )
          })}

          {variant === 'bars' ? (
            <g className="pulse-bars">
              {points.map((point, pointIndex) => {
                const barY = geometry.valueY(point.value)
                const barHeight = Math.max(1, CHART_PADDING.top + geometry.plotHeight - barY)
                return (
                  <rect
                    key={pointIndex}
                    x={geometry.slotX(pointIndex) - geometry.barWidth / 2}
                    y={barY}
                    width={geometry.barWidth}
                    height={barHeight}
                    rx="1.5"
                    fill={color}
                    opacity={hoverIndex === pointIndex ? 1 : 0.72}
                  />
                )
              })}
            </g>
          ) : (
            <>
              <path d={geometry.area} fill={`url(#${gradientId})`} />
              {/* pathLength=1 归一化：dash 绘线动画无需测量真实路径长度 */}
              <path
                d={geometry.line}
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="pulse-trace"
              />
            </>
          )}

          {hoverIndex != null && (
            <g>
              <line
                x1={geometry.xForIndex(hoverIndex)}
                x2={geometry.xForIndex(hoverIndex)}
                y1={CHART_PADDING.top}
                y2={CHART_PADDING.top + geometry.plotHeight}
                className="pulse-cross"
              />
              <circle
                cx={geometry.xForIndex(hoverIndex)}
                cy={geometry.valueY(points[hoverIndex].value)}
                r="3.5"
                fill={color}
                stroke="var(--s0)"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      )}

      {hoverPoint && geometry && hoverIndex != null && (
        <div
          className="pulse-tip"
          style={{ left: Math.min(Math.max(geometry.xForIndex(hoverIndex), 64), width - 64) }}
        >
          <span className="pulse-tip-v" style={{ color }}>
            {formatValue(hoverPoint.value)}
          </span>
          <span className="pulse-tip-t">{formatTime(hoverPoint.timestamp)}</span>
        </div>
      )}

      {!hasSignal && (
        <div className="pulse-empty">{emptyText ?? '这里还没有流量。调用任意 /api 接口后，这里会出现描迹。'}</div>
      )}
    </div>
  )
}
