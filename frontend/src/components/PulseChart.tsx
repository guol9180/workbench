/**
 * PulseChart：观测站的示波器主图（纯 SVG，零图表库依赖）。
 * - 刻度栅格 + 琥珀面积描迹；数据到达时描迹自左向右绘线一次——全站唯一非用户触发的动效
 * - hover 十字线吸附最近桶，浮层给出该桶时间与读数
 * - 宽度由 ResizeObserver 实测像素，保证 1px 描迹清晰不模糊；
 *   reduced-motion 下绘线动画被全局 CSS 熄灭（瞬时呈现）
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { fmtShort } from '../utils/format'
import './PulseChart.css'

/** 图表视图模型：时间(epoch ms) + 值。后端字段名由 monitor 模块映射后再传入 */
export interface ChartPoint {
  t: number
  v: number
}

/** 内边距：左留轴读数，下留时间刻度 */
const PAD = { top: 16, right: 14, bottom: 24, left: 46 }

interface Props {
  points: ChartPoint[]
  height?: number
  color?: string
  formatValue: (v: number) => string
  formatTime: (t: number) => string
}

/** y 轴上界取 1/2/2.5/5×10^k 的「好看」值：避免 20→50 这类粗跳把描迹压进底部死角 */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const base = Math.pow(10, Math.floor(Math.log10(max)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (max <= m * base) return m * base
  }
  return 10 * base
}

export default function PulseChart({ points, height = 300, color = 'var(--amber)', formatValue, formatTime }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // useId 生成渐变 id：同页多实例不串渐变
  const gradientId = useId()

  const geom = useMemo(() => {
    if (width < 80 || points.length === 0) return null
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const top = niceMax(Math.max(...points.map((p) => p.v)))
    const denom = Math.max(1, points.length - 1)
    const x = (i: number) => PAD.left + (i / denom) * innerW
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
    const baseY = (PAD.top + innerH).toFixed(1)
    const area = `${line} L${x(points.length - 1).toFixed(1)},${baseY} L${PAD.left},${baseY} Z`
    // 等分份数按上界整除性选（4 或 5），保证每条栅格的读数都是整洁整数
    const divisions = top % 4 === 0 ? 4 : 5
    const gridY = Array.from({ length: divisions + 1 }, (_, k) => {
      const f = k / divisions
      return { y: PAD.top + innerH * f, v: top * (1 - f) }
    })
    const tickEvery = Math.max(1, Math.round(points.length / 6))
    const ticks = points.map((p, i) => ({ p, i })).filter(({ i }) => i % tickEvery === 0)
    // 补右端点刻度：数据到 16:50 而最后刻度停在 16:41 会像被切掉；与前一刻度太近则放弃
    const lastIdx = points.length - 1
    if (lastIdx % tickEvery !== 0) {
      const prevIdx = ticks.length > 0 ? ticks[ticks.length - 1].i : 0
      if (lastIdx - prevIdx >= 3) ticks.push({ p: points[lastIdx], i: lastIdx })
    }
    return { innerW, innerH, x, y, line, area, gridY, ticks }
  }, [width, height, points])

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (!geom) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - PAD.left) / geom.innerW
    const idx = Math.round(ratio * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const hoverPoint = hover != null && geom ? points[hover] : null

  return (
    <div ref={boxRef} className="pulse" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {geom && (
        <svg width={width} height={height} className="pulse-svg" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {geom.gridY.map((g) => (
            <g key={g.y}>
              <line x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} className="pulse-grid" />
              <text x={PAD.left - 8} y={g.y + 3} className="pulse-axis" textAnchor="end">
                {fmtShort(g.v)}
              </text>
            </g>
          ))}
          {geom.ticks.map(({ p, i }) => (
            <text key={i} x={geom.x(i)} y={height - 6} className="pulse-axis" textAnchor="middle">
              {formatTime(p.t)}
            </text>
          ))}

          <path d={geom.area} fill={`url(#${gradientId})`} />
          {/* pathLength=1 归一化：dash 绘线动画无需测量真实路径长度 */}
          <path
            d={geom.line}
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="pulse-trace"
          />

          {hover != null && (
            <g>
              <line x1={geom.x(hover)} x2={geom.x(hover)} y1={PAD.top} y2={PAD.top + geom.innerH} className="pulse-cross" />
              <circle cx={geom.x(hover)} cy={geom.y(points[hover].v)} r="3.5" fill={color} stroke="var(--ink-1)" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      )}

      {hoverPoint && geom && (
        <div className="pulse-tip" style={{ left: Math.min(Math.max(geom.x(hover!), 64), width - 64) }}>
          <span className="pulse-tip-v">{formatValue(hoverPoint.v)}</span>
          <span className="pulse-tip-t">{formatTime(hoverPoint.t)}</span>
        </div>
      )}

      {points.length === 0 && <div className="pulse-empty">暂无流量——调用任意 /api 接口后，这里会出现描迹</div>}
    </div>
  )
}
