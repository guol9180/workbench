/**
 * 「值得注意」面板：把散在各处的异常聚合成最多 3 条可行动提示。
 * 产品语义：异常要自己浮上来，而不是等用户逐页巡检。
 * - 配置源采集失败（enabled 且 lastError 非空）→ 跳数据源页
 * - 当前源错误率 >1% → 原地把端点台账切成按错误排序
 * 后端离线不在这里重复（顶部错误横幅已承担）。
 */
import { useNavigate } from 'react-router-dom'
import { fmtRate } from '../../utils/format'
import type { OverviewData, RangeKey } from './api'
import type { SourceConfigView } from '../sources/api'

interface Props {
  configs: SourceConfigView[]
  overview: OverviewData | null
  source: string
  range: RangeKey
  onSortByErr: () => void
}

export default function AttentionPanel({ configs, overview, source, range, onSortByErr }: Props) {
  const navigate = useNavigate()

  const items: Array<{ key: string; text: string; actionLabel: string; onAction: () => void }> = []

  for (const c of configs.filter((x) => x.enabled && x.lastError).slice(0, 2)) {
    items.push({
      key: 'collect:' + c.id,
      text: `采集失败：${c.repo} — ${c.lastError}`,
      actionLabel: '去处理',
      onAction: () => navigate('/sources'),
    })
  }

  if (overview && overview.errRate > 0.01 && overview.errCount > 0) {
    items.push({
      key: 'errrate',
      text: `${source} 近 ${range} 错误率 ${fmtRate(overview.errRate)} 偏高`,
      actionLabel: '按错误排序',
      onAction: onSortByErr,
    })
  }

  const shown = items.slice(0, 3)
  if (shown.length === 0) return null

  return (
    <div className="mon-attention" role="status">
      {shown.map((it) => (
        <div key={it.key} className="mon-attention-row">
          <i className="mon-attention-dot" aria-hidden="true" />
          <span className="mon-attention-text">{it.text}</span>
          <button className="mon-attention-btn" onClick={it.onAction}>
            {it.actionLabel}
          </button>
        </div>
      ))}
    </div>
  )
}
