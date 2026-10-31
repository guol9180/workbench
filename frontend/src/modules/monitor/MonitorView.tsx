/**
 * 概览页：观测站主盘（真数据版）。
 * 数据链：sources 列表就绪 → 选源（优先 workbench）→ 按 源+区间 轮询 overview/series/top-endpoints。
 * 空态与失败态是页面的正式状态：后端离线给启动指引，无流量给上报指引，绝不白屏。
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import PulseChart from '../../components/PulseChart'
import { fmtClock, fmtHM, fmtInt, fmtMs, fmtRate } from '../../utils/format'
import { fillSeries, minutesToMs, monitorApi, RANGE_LABEL } from './api'
import type { MetricKey, RangeKey, SeriesPointData, SortKey } from './api'
import { usePolling } from './useMonitor'
import SourceCards from './SourceCards'
import FirstRunGuide from './FirstRunGuide'
import AttentionPanel from './AttentionPanel'
import { Banner, PageHeader, Segmented } from '../../components/ui/ui'
import { sourcesApi } from '../sources/api'
import './monitor.css'

const RANGES: RangeKey[] = ['5m', '1h', '6h', '24h', '7d']

/** 主图指标档：描迹颜色与读数格式随指标切换 */
const METRICS: Array<{ key: MetricKey; label: string; color: string; format: (v: number) => string }> = [
  { key: 'count', label: '请求数', color: 'var(--accent)', format: fmtInt },
  { key: 'avgMs', label: '平均延迟', color: 'var(--chart-2)', format: fmtMs },
  { key: 'errCount', label: '错误数', color: 'var(--danger)', format: fmtInt },
]

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'count', label: '按请求' },
  { key: 'err', label: '按错误' },
  { key: 'avgMs', label: '按延迟' },
]

/** 窗口后半段 vs 前半程：请求数/均延用百分比，错误率用百分点差（pp） */
function pctDelta(series: SeriesPointData[], useMean = false): number | null {
  if (series.length < 4) return null
  const halfIndex = Math.floor(series.length / 2)
  const aggregate = (points: SeriesPointData[]) =>
    useMean
      ? points.reduce((total, point) => total + point.value, 0) / points.length
      : points.reduce((total, point) => total + point.value, 0)
  const previousHalf = aggregate(series.slice(0, halfIndex))
  const currentHalf = aggregate(series.slice(halfIndex))
  if (previousHalf === 0) return null
  return ((currentHalf - previousHalf) / previousHalf) * 100
}

function ratePpDelta(countSeries: SeriesPointData[], errorSeries: SeriesPointData[]): number | null {
  if (countSeries.length < 4) return null
  const halfIndex = Math.floor(countSeries.length / 2)
  const sum = (points: SeriesPointData[]) => points.reduce((total, point) => total + point.value, 0)
  const previousCount = sum(countSeries.slice(0, halfIndex))
  const currentCount = sum(countSeries.slice(halfIndex))
  if (previousCount === 0 || currentCount === 0) return null
  return (
    (sum(errorSeries.slice(halfIndex)) / currentCount - sum(errorSeries.slice(0, halfIndex)) / previousCount) * 100
  )
}

function fmtPct(changePercent: number): string {
  const magnitude = Math.abs(changePercent)
  return (changePercent >= 0 ? '↑ ' : '↓ ') + (magnitude >= 10 ? magnitude.toFixed(0) : magnitude.toFixed(1)) + '%'
}

function fmtPp(changePoints: number): string {
  return (changePoints >= 0 ? '↑ +' : '↓ -') + Math.abs(changePoints).toFixed(2) + 'pp'
}

/** 读数位：数字 + 标签 + 可选环比小注（语境让数字可解读） */
function Readout({ num, label, delta, numStyle }: { num: string; label: string; delta?: { text: string; cls: string } | null; numStyle?: CSSProperties }) {
  return (
    <div className="mon-readout">
      <span className="mon-num" style={numStyle}>{num}</span>
      <span className="mon-label-row">
        <span className="mon-label">{label}</span>
        {delta && (
          <span className={'mon-delta ' + delta.cls} title="和前半程相比">
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
    ? '后端未连接。先在 backend 目录启动 workbench-server（JDK 25），再重试。'
    : message
}

export default function MonitorView() {
  const sourcesQuery = usePolling(monitorApi.sources, 'sources')
  const [source, setSource] = useState('')
  const [range, setRange] = useState<RangeKey>('1h')
  const [metric, setMetric] = useState<MetricKey>('count')
  const [sortBy, setSortBy] = useState<SortKey>('count')

  // 概览页专注系统自监测（M9.9 定位）：GitHub 项目数据住「我的项目」页，源列表在这里不出现
  const apiSources = (sourcesQuery.data ?? []).filter((source) => !source.name.startsWith('github/'))

  // 源列表就绪后矫正选择：优先自身 workbench，否则第一个源；无源清空选择（不发起后续请求）
  useEffect(() => {
    const names = apiSources.map((source) => source.name)
    if (names.length === 0) {
      if (source !== '') setSource('')
      return
    }
    if (!names.includes(source)) {
      setSource(names.includes('workbench') ? 'workbench' : names[0])
    }
  }, [sourcesQuery.data, source])

  const enabled = source !== ''
  const selKey = `${source}|${range}`
  const overviewQueryKey = 'ov|' + selKey
  const seriesQueryKey = 'se|' + selKey + '|' + metric
  const endpointsQueryKey = 'ep|' + selKey + '|' + sortBy
  const deltasQueryKey = 'delta|' + selKey

  const overviewQuery = usePolling(() => monitorApi.overview(source, range), overviewQueryKey, { enabled })
  const seriesQuery = usePolling(() => monitorApi.series(source, metric, range), seriesQueryKey, { enabled })
  const endpointsQuery = usePolling(() => monitorApi.topEndpoints(source, range, sortBy), endpointsQueryKey, { enabled })
  // 环比注脚：一次取三个指标序列，前半程 vs 后半段在客户端算（后端不支持历史窗口偏移）
  const deltasQuery = usePolling(
    () =>
      Promise.all([
        monitorApi.series(source, 'count', range),
        monitorApi.series(source, 'avgMs', range),
        monitorApi.series(source, 'errCount', range),
      ]),
    deltasQueryKey,
    { enabled },
  )
  const configsQuery = usePolling(() => sourcesApi.list(), 'source-configs')

  const overview = overviewQuery.data
  const endpoints = useMemo(() => endpointsQuery.data ?? [], [endpointsQuery.data])

  // 切换查询条件时保留上一帧图形：旧数据不再套新窗口（会画出假斜线），
  // 图表也不重挂载（不重播绘线动画）——新数据到达后一次性替换。
  const [lastSeries, setLastSeries] = useState<{ range: RangeKey; data: SeriesPointData[] }>({
    range,
    data: [],
  })
  const isSeriesCurrent = seriesQuery.data !== null && seriesQuery.dataKey === seriesQueryKey
  useLayoutEffect(() => {
    if (seriesQuery.data && seriesQuery.dataKey === seriesQueryKey) {
      setLastSeries({ range, data: seriesQuery.data })
    }
  }, [seriesQuery.data, seriesQuery.dataKey, seriesQueryKey, range])

  const chartSeries = isSeriesCurrent && seriesQuery.data ? { range, data: seriesQuery.data } : lastSeries
  const points = useMemo(
    () =>
      fillSeries(chartSeries.data, chartSeries.range).map((point) => ({
        timestamp: minutesToMs(point.bucketEpoch),
        value: point.value,
      })),
    [chartSeries.data, chartSeries.range],
  )
  const maxCount = Math.max(...endpoints.map((endpoint) => endpoint.count), 1)
  const activeMetric = METRICS.find((metricOption) => metricOption.key === metric)!

  // 数据是否仍对应旧查询条件：用于压暗旧帧并显示「同步中」，
  // 而不是让旧读数伪装成新条件的结果。请求失败时不压暗（错误横幅已说明）。
  const isSeriesStale = seriesQuery.dataKey !== null && seriesQuery.dataKey !== seriesQueryKey && !seriesQuery.error
  const isOverviewStale = overviewQuery.dataKey !== null && overviewQuery.dataKey !== overviewQueryKey && !overviewQuery.error
  const isEndpointsStale = endpointsQuery.dataKey !== null && endpointsQuery.dataKey !== endpointsQueryKey && !endpointsQuery.error
  const isDeltasStale = deltasQuery.dataKey !== null && deltasQuery.dataKey !== deltasQueryKey && !deltasQuery.error
  const isSwitching = isSeriesStale || isOverviewStale || isEndpointsStale || isDeltasStale

  // 环比读数：请求数（中性）、错误率（pp，升=坏）、均延（升=坏）；P95 无序列口径，不出注脚
  // 切换条件期间不拿旧序列套新区间，直接收起小注，等新数据到达再显示
  const [countSeries, avgSeries, errSeries] = (isDeltasStale ? null : deltasQuery.data) ?? [null, null, null]
  const countPct = countSeries ? pctDelta(fillSeries(countSeries, range)) : null
  const avgPct = avgSeries ? pctDelta(fillSeries(avgSeries, range), true) : null
  const errPp =
    countSeries && errSeries ? ratePpDelta(fillSeries(countSeries, range), fillSeries(errSeries, range)) : null

  const tone = (changeValue: number, badSide: number): string =>
    changeValue > badSide ? 'bad' : changeValue < -badSide ? 'good' : 'flat'
  // 低于显著阈值不展示（「+0.00pp」是噪音）；超过 10 倍的百分比同样没有解读价值，一并收敛
  const isNoise = (changePercent: number, minMagnitude: number): boolean =>
    Math.abs(changePercent) < minMagnitude || Math.abs(changePercent) >= 1000
  const countDelta = countPct === null || isNoise(countPct, 0.5) ? null : { text: fmtPct(countPct), cls: 'flat' }
  const errDelta = errPp === null || isNoise(errPp, 0.05) ? null : { text: fmtPp(errPp), cls: tone(errPp, 0.1) }
  const avgDelta = avgPct === null || isNoise(avgPct, 0.5) ? null : { text: fmtPct(avgPct), cls: tone(avgPct, 0.5) }

  const firstError = sourcesQuery.error ?? overviewQuery.error ?? seriesQuery.error ?? endpointsQuery.error
  const retryAll = () => {
    sourcesQuery.reload()
    overviewQuery.reload()
    seriesQuery.reload()
    endpointsQuery.reload()
  }
  const updatedAt = overviewQuery.updatedAt ?? seriesQuery.updatedAt ?? endpointsQuery.updatedAt

  return (
    <div className="mon">
      <PageHeader eyebrow="观测 / Monitor" title="概览" desc="接口流量和端点状态，每 15 秒自动刷新">
        <Segmented
          options={RANGES.map((rangeOption) => ({ value: rangeOption, label: rangeOption }))}
          value={range}
          onChange={setRange}
          ariaLabel="时间区间"
        />
      </PageHeader>

      {/* 源切换唯一入口：单源时收敛为信息行，多源时才是可选卡片——不与别的选择器重复 */}
      <SourceCards sources={apiSources} active={source} onPick={setSource} />

      {firstError && (
        <Banner tone="err" actionLabel="重试" onAction={retryAll}>
          {friendly(firstError)}
        </Banner>
      )}

      {apiSources.length === 0 && !sourcesQuery.loading && !sourcesQuery.error ? (
        <FirstRunGuide />
      ) : (
        <>
          <AttentionPanel
            configs={configsQuery.data ?? []}
            overview={overview}
            source={source}
            range={range}
            onSortByErr={() => setSortBy('err')}
          />

          <div className={'mon-body' + (isSwitching ? ' is-switching' : '')}>
            <section className="mon-hero panel">
              <header className="mon-hero-head">
                <div className="mon-hero-title-row">
                  <span className="mon-hero-title">流量描迹</span>
                  <span className="mon-hero-window">近 {RANGE_LABEL[range]}</span>
                </div>
                <div className="mon-hero-tools">
                  {isSwitching ? (
                    <span className="mon-updated is-busy">同步中…</span>
                  ) : (
                    updatedAt && <span className="mon-updated">更新于 {fmtClock(updatedAt)}</span>
                  )}
                  <Segmented
                    options={METRICS.map((metricOption) => ({ value: metricOption.key, label: metricOption.label }))}
                    value={metric}
                    onChange={setMetric}
                    mono={false}
                    ariaLabel="描迹指标"
                    itemStyle={(metricKey, active) => {
                      const metricOption = METRICS.find((candidate) => candidate.key === metricKey)
                      return active && metricOption ? { color: metricOption.color } : undefined
                    }}
                  />
                </div>
              </header>
              <PulseChart
                points={points}
                height={320}
                variant="trace"
                color={activeMetric.color}
                formatValue={activeMetric.format}
                formatTime={fmtHM}
              />

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
            </section>

            {endpoints.length > 0 && (
              <section className="mon-ledger panel">
                <header className="mon-ledger-head">
                  <span className="mon-ledger-title">端点排行 · 前 10</span>
                  <Segmented
                    options={SORTS.map((sortOption) => ({ value: sortOption.key, label: sortOption.label }))}
                    value={sortBy}
                    onChange={setSortBy}
                    mono={false}
                    ariaLabel="排序"
                  />
                </header>
                <table className="mon-table">
                  <thead>
                    <tr>
                      <th>端点</th>
                      <th className="num">请求</th>
                      <th className="num">错误</th>
                      <th className="num">延迟</th>
                      <th className="num">P95</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((endpoint) => (
                      <tr key={endpoint.endpoint}>
                        <td className="mon-ep">{endpoint.endpoint}</td>
                        <td className="num mon-count-cell">
                          <span
                            className="mon-count"
                            style={{ width: (endpoint.count / maxCount) * 100 + '%' }}
                            aria-hidden="true"
                          />
                          <span className="mon-count-n">{fmtInt(endpoint.count)}</span>
                        </td>
                        <td className={'num' + (endpoint.errCount > 0 ? ' mon-err' : ' mon-zero')}>
                          {endpoint.errCount > 0 ? fmtInt(endpoint.errCount) : '—'}
                        </td>
                        <td className="num">{fmtMs(endpoint.avgMs)}</td>
                        <td className="num mon-zero">{fmtMs(endpoint.p95Ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
