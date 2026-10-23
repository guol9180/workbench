/**
 * 概览页：观测站主盘（真数据版）。
 * 数据链：sources 列表就绪 → 选源（优先 workbench）→ 按 源+区间 轮询 overview/series/top-endpoints。
 * 空态与失败态是页面的正式状态：后端离线给启动指引，无流量给上报指引，绝不白屏。
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import PulseChart from '../../components/PulseChart'
import { fmtClock, fmtHM, fmtInt, fmtMs, fmtRate } from '../../utils/format'
import { minutesToMs, monitorApi } from './api'
import type { MetricKey, RangeKey, SeriesPointData, SortKey } from './api'
import { usePolling } from './useMonitor'
import SourceCards from './SourceCards'
import FirstRunGuide from './FirstRunGuide'
import AttentionPanel from './AttentionPanel'
import { sourcesApi } from '../sources/api'
import './monitor.css'

const RANGES: RangeKey[] = ['5m', '1h', '6h', '24h', '7d']

/** 主图指标档：描迹颜色与读数格式随指标切换 */
const METRICS: Array<{ key: MetricKey; label: string; color: string; format: (v: number) => string }> = [
  { key: 'count', label: '请求数', color: 'var(--amber)', format: fmtInt },
  { key: 'avgMs', label: '平均延迟', color: 'var(--ice)', format: fmtMs },
  { key: 'errCount', label: '错误数', color: 'var(--danger)', format: fmtInt },
]

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'count', label: '按请求' },
  { key: 'err', label: '按错误' },
  { key: 'avgMs', label: '按均延' },
]

/** 窗口后半段 vs 前半程：请求数/均延用百分比，错误率用百分点差（pp） */
function pctDelta(series: SeriesPointData[], mean = false): number | null {
  if (series.length < 4) return null
  const half = Math.floor(series.length / 2)
  const agg = (arr: SeriesPointData[]) =>
    mean ? arr.reduce((s, p) => s + p.value, 0) / arr.length : arr.reduce((s, p) => s + p.value, 0)
  const prev = agg(series.slice(0, half))
  const cur = agg(series.slice(half))
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function ratePpDelta(count: SeriesPointData[], err: SeriesPointData[]): number | null {
  if (count.length < 4) return null
  const half = Math.floor(count.length / 2)
  const sum = (arr: SeriesPointData[]) => arr.reduce((s, p) => s + p.value, 0)
  const c1 = sum(count.slice(0, half))
  const c2 = sum(count.slice(half))
  if (c1 === 0 || c2 === 0) return null
  return ((sum(err.slice(half)) / c2) - (sum(err.slice(0, half)) / c1)) * 100
}

function fmtPct(p: number): string {
  const a = Math.abs(p)
  return (p >= 0 ? '↑ ' : '↓ ') + (a >= 10 ? a.toFixed(0) : a.toFixed(1)) + '%'
}

function fmtPp(p: number): string {
  return (p >= 0 ? '↑ +' : '↓ -') + Math.abs(p).toFixed(2) + 'pp'
}

/** 读数位：数字 + 标签 + 可选环比小注（语境让数字可解读） */
function Readout({ num, label, delta, numStyle }: { num: string; label: string; delta?: { text: string; cls: string } | null; numStyle?: CSSProperties }) {
  return (
    <div className="mon-readout">
      <span className="mon-num" style={numStyle}>{num}</span>
      <span className="mon-label-row">
        <span className="mon-label">{label}</span>
        {delta && (
          <span className={'mon-delta ' + delta.cls} title="窗口后半段与前半程对比">
            {delta.text}
          </span>
        )}
      </span>
    </div>
  )
}

/** fetch 类失败翻译成行动指引；业务错误消息原样透出 */
function friendly(message: string): string {
  return /fetch|network|Failed to fetch/i.test(message)
    ? '后端连不上——先启动 workbench-server（backend 目录，JDK 25），再点重试'
    : message
}

export default function MonitorView() {
  const sourcesQ = usePolling(monitorApi.sources, 'sources')
  const [source, setSource] = useState('')
  const [range, setRange] = useState<RangeKey>('1h')
  const [metric, setMetric] = useState<MetricKey>('count')
  const [sortBy, setSortBy] = useState<SortKey>('count')

  // 源列表就绪后矫正选择：优先自身 workbench，否则第一个源；无源保持空（不发起后续请求）
  useEffect(() => {
    const names = (sourcesQ.data ?? []).map((s) => s.name)
    if (names.length > 0 && !names.includes(source)) {
      setSource(names.includes('workbench') ? 'workbench' : names[0])
    }
  }, [sourcesQ.data, source])

  const enabled = source !== ''
  const selKey = `${source}|${range}`
  const overviewQ = usePolling(() => monitorApi.overview(source, range), 'ov|' + selKey, { enabled })
  const seriesQ = usePolling(() => monitorApi.series(source, metric, range), 'se|' + selKey + '|' + metric, { enabled })
  const endpointsQ = usePolling(() => monitorApi.topEndpoints(source, range, sortBy), 'ep|' + selKey + '|' + sortBy, { enabled })
  // 环比注脚：一次取三个指标序列，前半程 vs 后半段在客户端算（后端不支持历史窗口偏移）
  const deltasQ = usePolling(
    () =>
      Promise.all([
        monitorApi.series(source, 'count', range),
        monitorApi.series(source, 'avgMs', range),
        monitorApi.series(source, 'errCount', range),
      ]),
    'delta|' + selKey,
    { enabled },
  )
  const configsQ = usePolling(() => sourcesApi.list(), 'source-configs')

  const sources = sourcesQ.data ?? []
  const overview = overviewQ.data
  const endpoints = useMemo(() => endpointsQ.data ?? [], [endpointsQ.data])
  const points = useMemo(
    () => (seriesQ.data ?? []).map((p) => ({ t: minutesToMs(p.bucketEpoch), v: p.value })),
    [seriesQ.data],
  )
  const maxCount = Math.max(...endpoints.map((e) => e.count), 1)
  const activeMetric = METRICS.find((m) => m.key === metric)!

  // 环比读数：请求数（中性）、错误率（pp，升=坏）、均延（升=坏）；P95 无序列口径，不出注脚
  const [countSeries, avgSeries, errSeries] = deltasQ.data ?? [null, null, null]
  const countPct = countSeries ? pctDelta(countSeries) : null
  const avgPct = avgSeries ? pctDelta(avgSeries, true) : null
  const errPp = countSeries && errSeries ? ratePpDelta(countSeries, errSeries) : null

  const tone = (v: number, badSide: number): string =>
    v > badSide ? 'bad' : v < -badSide ? 'good' : 'flat'
  // 低于显著阈值的环比不展示——「+0.00pp」是噪音不是信息
  const countDelta = countPct === null || Math.abs(countPct) < 0.5 ? null : { text: fmtPct(countPct), cls: 'flat' }
  const errDelta = errPp === null || Math.abs(errPp) < 0.05 ? null : { text: fmtPp(errPp), cls: tone(errPp, 0.1) }
  const avgDelta = avgPct === null || Math.abs(avgPct) < 0.5 ? null : { text: fmtPct(avgPct), cls: tone(avgPct, 0.5) }

  const firstError = sourcesQ.error ?? overviewQ.error ?? seriesQ.error ?? endpointsQ.error
  const retryAll = () => {
    sourcesQ.reload()
    overviewQ.reload()
    seriesQ.reload()
    endpointsQ.reload()
  }
  const updatedAt = overviewQ.updatedAt ?? seriesQ.updatedAt ?? endpointsQ.updatedAt

  return (
    <div className="mon">
      <header className="mon-head">
        <h1 className="mon-title">概览</h1>
        <div className="mon-ranges" role="group" aria-label="时间区间">
          {RANGES.map((r) => (
            <button key={r} className={'mon-range' + (r === range ? ' active' : '')} onClick={() => setRange(r)}>
              {r}
            </button>
          ))}
        </div>
      </header>

      <div className="mon-sources">
        <span className="mon-sources-label">源</span>
        {sources.map((s) => (
          <button
            key={s.name}
            className={'mon-chip' + (s.name === source ? ' active' : '')}
            title={'最后活跃 ' + fmtHM(minutesToMs(s.lastSeenMinute))}
            onClick={() => setSource(s.name)}
          >
            <i className={'mon-chip-dot' + (s.name === source ? ' on' : '')} aria-hidden="true" />
            {s.name}
          </button>
        ))}
        {updatedAt && <span className="mon-updated">更新于 {fmtClock(updatedAt)} · 每 15s 刷新</span>}
      </div>

      <AttentionPanel
        configs={configsQ.data ?? []}
        overview={overview}
        source={source}
        range={range}
        onSortByErr={() => setSortBy('err')}
      />

      {firstError && (
        <div className="mon-banner" role="alert">
          <span>{friendly(firstError)}</span>
          <button className="mon-banner-btn" onClick={retryAll}>重试</button>
        </div>
      )}

      {sources.length === 0 && !sourcesQ.loading && !sourcesQ.error ? (
        <FirstRunGuide />
      ) : (
        <>
          <SourceCards sources={sources.map((s) => s.name)} active={source} onPick={setSource} />

          <section className="mon-hero panel">
            <header className="mon-hero-head">
              <span className="mon-hero-title">流量描迹</span>
              <div className="mon-metrics" role="group" aria-label="描迹指标">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    className={'mon-metric' + (m.key === metric ? ' active' : '')}
                    style={m.key === metric ? { color: m.color } : undefined}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </header>
            <PulseChart
              key={selKey + '|' + metric}
              points={points}
              color={activeMetric.color}
              formatValue={activeMetric.format}
              formatTime={fmtHM}
            />
          </section>

          <section className="mon-readouts">
            <Readout num={overview ? fmtInt(overview.count) : '—'} label="请求数" delta={countDelta} />
            <Readout
              num={overview ? fmtRate(overview.errRate) : '—'}
              label="错误率"
              delta={errDelta}
              numStyle={overview && overview.errRate > 0.01 ? { color: 'var(--danger)' } : undefined}
            />
            <Readout num={overview ? fmtMs(overview.avgMs) : '—'} label="平均延迟" delta={avgDelta} />
            <Readout num={overview ? fmtMs(overview.p95Ms) : '—'} label="P95 延迟" />
          </section>
        </>
      )}

      {endpoints.length > 0 && (
        <section className="mon-ledger panel">
          <header className="mon-ledger-head">
            <span className="mon-ledger-title">端点遥测 · 前 10</span>
            <div className="mon-sorts">
              {SORTS.map((s) => (
                <button key={s.key} className={'mon-sort' + (s.key === sortBy ? ' active' : '')} onClick={() => setSortBy(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </header>
          <table className="mon-table">
            <thead>
              <tr>
                <th>端点</th>
                <th className="num">请求</th>
                <th className="num">错误</th>
                <th className="num">均延</th>
                <th className="num">P95</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.endpoint}>
                  <td className="mon-ep">{e.endpoint}</td>
                  <td className="num mon-count-cell">
                    <span className="mon-count" style={{ width: (e.count / maxCount) * 100 + '%' }} aria-hidden="true" />
                    <span className="mon-count-n">{fmtInt(e.count)}</span>
                  </td>
                  <td className={'num' + (e.errCount > 0 ? ' mon-err' : ' mon-zero')}>{e.errCount > 0 ? fmtInt(e.errCount) : '—'}</td>
                  <td className="num">{fmtMs(e.avgMs)}</td>
                  <td className="num mon-zero">{fmtMs(e.p95Ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
