/**
 * monitor 取数 hook：轮询 + 页面隐藏暂停 + 失败保留旧数据。
 * - key 变化（换源/换区间）立即重取；enabled=false 时不发请求（源列表未就绪前）
 * - 刷新失败不清空已有数据：网络抖一下不该把在看的图表打没
 */
import { useEffect, useRef, useState } from 'react'

export interface PollState<T> {
  data: T | null
  error: string | null
  /** 首次取数完成前 true；此后刷新不再置 true，避免图表闪烁 */
  loading: boolean
  /** 最近一次成功取数的本地时间戳（毫秒），供「更新于」展示 */
  updatedAt: number | null
  /** 立即重取（错误横幅的重试按钮用） */
  reload: () => void
}

interface Opts {
  enabled?: boolean
  intervalMs?: number
}

export function usePolling<T>(fetcher: () => Promise<T>, key: string, opts: Opts = {}): PollState<T> {
  const enabled = opts.enabled ?? true
  const intervalMs = opts.intervalMs ?? 15_000

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  // latest-ref：动作与定时器永远拿到最新的 fetcher，不进依赖数组
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let alive = true
    const run = async () => {
      try {
        const d = await fetcherRef.current()
        if (!alive) return
        setData(d)
        setError(null)
        setUpdatedAt(Date.now())
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    }
    setLoading(true)
    void run()
    const timer = window.setInterval(() => {
      // 页面隐藏时跳过本轮：轮询为看板服务，后台标签页不必打后端
      if (!document.hidden) void run()
    }, intervalMs)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [key, enabled, intervalMs, tick])

  const reload = () => setTick((t) => t + 1)

  return { data, error, loading, updatedAt, reload }
}
