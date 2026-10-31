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
  { label: '回首页', sub: '页面', path: '/home' },
  { label: '看概览', sub: '页面', path: '/monitor' },
  { label: '写文档', sub: '页面', path: '/docs' },
  { label: '我的项目', sub: '页面', path: '/sources' },
]

export default function CommandPalette() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  function openPalette() {
    setQuery('')
    setSearchHits(null)
    setSelectedIndex(0)
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
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
      setSearchHits(null)
      setSelectedIndex(0)
    }
  }, [open])

  // 搜索防抖：250ms 内不再输入才发请求（docs search 上限 100，取前 12 条展示）
  useEffect(() => {
    if (!open) return
    const searchQuery = query.trim()
    if (!searchQuery) {
      setSearchHits(null)
      return
    }
    const timer = setTimeout(() => {
      void docsApi
        .search(searchQuery)
        .then((foundHits) => setSearchHits(foundHits.slice(0, 12)))
        .catch(() => setSearchHits([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open])

  const staticItems = useMemo<Item[]>(
    () =>
      PAGES.filter((page) => page.path !== location.pathname)
        .filter((page) => !query || page.label.includes(query.trim()))
        .map((page) => ({
          id: 'page:' + page.path,
          label: page.label,
          sub: page.sub,
          run: () => navigate(page.path),
        })),
    [query, location.pathname, navigate],
  )

  const docItems = useMemo<Item[]>(
    () =>
      (searchHits ?? []).map((hit) => ({
        id: 'doc:' + hit.path,
        label: hit.path,
        sub: hit.snippet || '文档',
        run: () => navigate('/docs', { state: { openDoc: hit.path } }),
      })),
    [searchHits, navigate],
  )

  const items = useMemo(() => [...staticItems, ...docItems], [staticItems, docItems])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, searchHits])

  function close() {
    setOpen(false)
  }

  function runItem(item: Item | undefined) {
    if (!item) return
    close()
    item.run()
  }

  function onInputKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((currentIndex) => Math.min(items.length - 1, currentIndex + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((currentIndex) => Math.max(0, currentIndex - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runItem(items[selectedIndex])
    }
  }

  // 滚动跟随键盘选择
  useEffect(() => {
    const el = listRef.current?.querySelector('.cmdk-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="cmdk-overlay" onMouseDown={close}>
      <div className="cmdk" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          value={query}
          placeholder="搜文档，或直接跳页面…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKey}
        />
        <div className="cmdk-list" ref={listRef}>
          {staticItems.map((item, index) => (
            <button
              key={item.id}
              className={'cmdk-item' + (index === selectedIndex ? ' active' : '')}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => runItem(item)}
            >
              <span className="cmdk-item-label">{item.label}</span>
              <span className="cmdk-item-sub">{item.sub}</span>
            </button>
          ))}
          {query.trim() && searchHits === null && <div className="cmdk-note">搜索中…</div>}
          {query.trim() && searchHits?.length === 0 && staticItems.length === 0 && (
            <div className="cmdk-note">没有匹配的文档</div>
          )}
          {docItems.map((item, index) => {
            const itemIndex = staticItems.length + index
            return (
              <button
                key={item.id}
                className={'cmdk-item' + (itemIndex === selectedIndex ? ' active' : '')}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
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
