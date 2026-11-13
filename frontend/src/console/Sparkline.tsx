/** 无坐标轴微型趋势线：空数据画一条平线，避免图表区域跳动。 */
export default function Sparkline({
  values,
  color = 'var(--primary)',
  height = 36,
  ariaLabel,
}: {
  values: number[]
  color?: string
  height?: number
  ariaLabel: string
}) {
  const width = 140
  const safeValues = values.length > 0 ? values : [0, 0]
  const max = Math.max(...safeValues, 1)
  const min = Math.min(...safeValues, 0)
  const span = max - min || 1
  const points = safeValues
    .map((value, index) => {
      const x = safeValues.length === 1 ? width / 2 : (width * index) / (safeValues.length - 1)
      const y = height - 4 - ((value - min) / span) * (height - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
