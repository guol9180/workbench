/**
 * 全局命令面板（Ctrl+K / Cmd+K）：页面跳转 + 文档搜索直达。
 * - 是全局体验的一部分，不是某个页面的功能：任何页面按下即达
 * - 文档结果经 location.state 传给文档页打开（DocsWorkspace 消费后清除）
 * - 键盘优先：↑↓ 选择、Enter 执行、Esc 关闭；鼠标点击等价
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { docsApi } from '../modules/docs/api'
import type { SearchHit } from '../modules/docs/api'
import './palette.css'

interface Item {
  id: string
  label: string
  sub: string
  run: () => void
}

const PAGES: Array<{ label: string; sub: string; path: string }> = [
  { label: '打开首页', sub: '页面', path: '/home' },
  { label: '打开概览', sub: '页面', path: '/monitor' },
  { label: '打开文档', sub: '页面', path: '/docs' },
  { label: '打开数据源', sub: '页面', path: '/sources' },
]

export default function CommandPalette() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function openPalette() {
    setQuery('')
    setHits(null)
    setSel(0)
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (open) {
          setOpen(false)
        } else {
          openPalette()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 关闭时丢弃搜索状态
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits(null)
      setSel(0)
    }
  }, [open])

  // 搜索防抖：250ms 内不再输入才发请求（docs search 上限 100，取前 12 条展示）
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setHits(null)
      return
    }
    const timer = setTimeout(() => {
      void docsApi
        .search(q)
        .then((r) => setHits(r.slice(0, 12)))
        .catch(() => setHits([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open])

  const staticItems = useMemo<Item[]>(
    () =>
      PAGES.filter((p) => p.path !== location.pathname)
        .filter((p) => !query || p.label.includes(query.trim()))
        .map((p) => ({
          id: 'page:' + p.path,
          label: p.label,
          sub: p.sub,
          run: () => navigate(p.path),
        })),
    [query, location.pathname, navigate],
  )

  const docItems = useMemo<Item[]>(
    () =>
      (hits ?? []).map((h) => ({
        id: 'doc:' + h.path,
        label: h.path,
        sub: h.snippet || '文档',
        run: () => navigate('/docs', { state: { openDoc: h.path } }),
      })),
    [hits, navigate],
  )

  const items = useMemo(() => [...staticItems, ...docItems], [staticItems, docItems])

  useEffect(() => {
    setSel(0)
  }, [query, hits])

  function close() {
    setOpen(false)
  }

  function runItem(item: Item | undefined) {
    if (!item) return
    close()
    item.run()
  }

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(items.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runItem(items[sel])
    }
  }

  // 滚动跟随键盘选择
  useEffect(() => {
    const el = listRef.current?.querySelector('.cmdk-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  return (
    <div className="cmdk-overlay" onMouseDown={close}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          placeholder="搜索文档，或跳转到页面…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
        />
        <div className="cmdk-list" ref={listRef}>
          {staticItems.map((item, i) => (
            <button
              key={item.id}
              className={'cmdk-item' + (i === sel ? ' active' : '')}
              onMouseEnter={() => setSel(i)}
              onClick={() => runItem(item)}
            >
              <span className="cmdk-item-label">{item.label}</span>
              <span className="cmdk-item-sub">{item.sub}</span>
            </button>
          ))}
          {query.trim() && hits === null && <div className="cmdk-note">搜索中…</div>}
          {query.trim() && hits?.length === 0 && staticItems.length === 0 && (
            <div className="cmdk-note">没有匹配的文档</div>
          )}
          {docItems.map((item, i) => {
            const idx = staticItems.length + i
            return (
              <button
                key={item.id}
                className={'cmdk-item' + (idx === sel ? ' active' : '')}
                onMouseEnter={() => setSel(idx)}
                onClick={() => runItem(item)}
              >
                <span className="cmdk-item-label">{item.label}</span>
                <span className="cmdk-item-sub">{item.sub}</span>
              </button>
            )
          })}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ 选择</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
