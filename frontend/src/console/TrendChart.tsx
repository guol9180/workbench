/** 参考稿的请求/错误双线走势图（纯 SVG，无图表库）。M13 起接受外部数据点（服务端模式真实序列）。 */
import { useMemo } from 'react'
import { fmtDay } from './data'

/** 走势数据点：date 为所属日；requests 单位「万次」、errors 单位「百次」（与图例一致） */
export interface TrendPoint {
  date: Date
  requests: number
  errors: number
}

/** 演示模式的示例走势：与参考稿同一公式，保证曲线与汇总口径一致 */
export function buildDemoPoints(days: number): TrendPoint[] {
  const points: TrendPoint[] = []
  for (let index = days - 1; index >= 0; index -= 1) {
    let requests: number
    if (index === 0) {
      requests = 45.8
    } else {
      const wave = Math.sin(index * 1.7) * 3.2 + Math.cos(index * 0.9) * 2.1
      requests = Math.max(24, 38 + wave + (days - index) * 0.12)
    }
    const errorRate = index === 0 ? 0.0048 : 0.0035 + Math.abs(Math.sin(index * 2.3)) * 0.0035
    points.push({
      date: new Date(Date.now() - index * 86_400_000),
      requests,
      errors: Math.round((requests * 10000 * errorRate) / 100),
    })
  }
  return points
}

export default function TrendChart({ days, points }: { days: number; points: TrendPoint[] }) {
  const geometry = useMemo(() => {
    const width = 720
    const height = 280
    const left = 48
    const right = 14
    const top = 16
    const bottom = 40
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    // 真实流量可能远小于演示量级：yMax 保底 10，避免 0 流量时除零与空刻度
    const maxRequest = points.length ? Math.max(...points.map((point) => point.requests)) : 0
    const maxError = Math.max(...points.map((point) => point.errors), 1)
    const yMax = Math.max(10, Math.ceil(maxRequest / 10) * 10)
    const lastIndex = points.length - 1
    const x = (index: number) => lastIndex <= 0 ? left + plotWidth / 2 : left + (plotWidth * index) / lastIndex
    const yRequest = (value: number) => top + plotHeight * (1 - value / yMax)
    const yError = (value: number) => top + plotHeight * (1 - value / (maxError * 1.15))
    const grid = Array.from({ length: 5 }, (_, gridIndex) => {
      const y = top + (plotHeight * gridIndex) / 4
      return { y, value: Math.round(yMax - (yMax * gridIndex) / 4) }
    })
    const labelStep = Math.max(1, Math.ceil(points.length / 7))
    const labels = points
      .map((point, index) => ({ index, date: point.date }))
      .filter(({ index }) => index % labelStep === 0 || index === days - 1)
    const requestPoints = points.map((point, index) => `${x(index).toFixed(1)},${yRequest(point.requests).toFixed(1)}`).join(' ')
    const errorPoints = points.map((point, index) => `${x(index).toFixed(1)},${yError(point.errors).toFixed(1)}`).join(' ')
    return { width, height, left, right, top, plotHeight, x, yRequest, grid, labels, requestPoints, errorPoints }
  }, [days, points])

  return (
    <svg className="trend-chart" viewBox="0 0 720 280" role="img" aria-labelledby="trend-chart-title" preserveAspectRatio="xMidYMid meet">
      {/* 图表的可访问描述随范围变化，与参考稿保持同一句式 */}
      <title id="trend-chart-title">近 {days} 日请求与错误走势，横轴为日期，纵轴为每日请求量。</title>
      {geometry.grid.map((gridLine) => (
        <g key={gridLine.y}>
          <line x1={geometry.left} y1={gridLine.y} x2={geometry.width - geometry.right} y2={gridLine.y} stroke="var(--chart-grid)" strokeWidth="1" />
          <text x={geometry.left - 8} y={gridLine.y + 4} textAnchor="end" fontSize="11" fill="var(--chart-text)">{gridLine.value}</text>
        </g>
      ))}
      {geometry.labels.map(({ index, date }) => (
        <text key={index} x={geometry.x(index)} y={geometry.height - 14} textAnchor="middle" fontSize="11" fill="var(--chart-text)">{fmtDay(date)}</text>
      ))}
      <polyline points={geometry.errorPoints} fill="none" stroke="#b02a37" strokeWidth="1.8" strokeDasharray="5 4" strokeLinejoin="round" />
      <polyline points={geometry.requestPoints} fill="none" stroke="#0f766e" strokeWidth="2.4" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle key={`${point.date.getTime()}-${index}`} cx={geometry.x(index)} cy={geometry.yRequest(point.requests)} r="2.6" fill="#0f766e" />
      ))}
    </svg>
  )
}
