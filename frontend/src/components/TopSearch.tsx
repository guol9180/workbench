/**
 * 顶栏全局搜索：页面 + 文档 + GitHub 项目 + 本地工具。
 * 文档走 /api/docs/search；项目只在搜索展开时拉一次 source-configs；命令面板（Ctrl+K）聚焦到这里。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { docsApi } from '../modules/docs/api'
import type { SearchHit } from '../modules/docs/api'
import { sourcesApi } from '../modules/sources/api'
import type { SourceConfigView } from '../modules/sources/api'
import { loadTools } from '../modules/tools/store'
import type { ToolEntry } from '../modules/tools/store'
import { toast } from '../ui/toast'
import { Icon } from './ui/Icon'
import './top-search.css'

interface ResultItem {
  id: string
  kind: string
  label: string
  sub: string
  run: () => void
}

const PAGES = [
  { path: '/home', label: '数据看板', sub: '总览' },
  { path: '/sources', label: '项目监控', sub: '监控' },
  { path: '/monitor', label: '流量监测', sub: '监控' },
  { path: '/docs', label: '在线文档', sub: '工具' },
  { path: '/tools', label: '集成工具', sub: '工具' },
]

export default function TopSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<SearchHit[]>([])
  const [sources, setSources] = useState<SourceConfigView[]>([])
  const [tools, setTools] = useState<ToolEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setTools(loadTools())
    if (sources.length > 0) return
    void sourcesApi
      .list()
      .then(setSources)
      .catch(() => setSources([]))
  }, [open, sources.length])

  const keyword = query.trim()
  useEffect(() => {
    if (!open || !keyword) {
      setDocs([])
      return
    }
    const timer = window.setTimeout(() => {
      void docsApi
        .search(keyword)
        .then((hits) => setDocs(hits.slice(0, 6)))
        .catch(() => setDocs([]))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [keyword, open])

  const items = useMemo<ResultItem[]>(() => {
    const normalized = keyword.toLowerCase()
    const matches = (text: string) => !normalized || text.toLowerCase().includes(normalized)
    const pageItems = PAGES.filter((page) => page.path !== location.pathname && matches(page.label + ' ' + page.sub))
      .map((page) => ({
        id: 'page:' + page.path,
        kind: '页面',
        label: page.label,
        sub: page.sub,
        run: () => navigate(page.path),
      }))
    const docItems = docs.map((hit) => ({
      id: 'doc:' + hit.path,
      kind: '文档',
      label: hit.name || hit.path,
      sub: hit.path,
      run: () => navigate('/docs', { state: { openDoc: hit.path } }),
    }))
    const sourceItems = sources
      .filter((source) => matches(source.repo))
      .slice(0, 5)
      .map((source) => ({
        id: 'source:' + source.id,
        kind: '项目',
        label: source.repo,
        sub: source.enabled ? 'GitHub 项目 · 采集中' : 'GitHub 项目 · 已停用',
        run: () => navigate('/sources'),
      }))
    const toolItems = tools
      .filter((tool) => matches(tool.name + ' ' + tool.desc + ' ' + tool.target))
      .slice(0, 5)
      .map((tool) => ({
        id: 'tool:' + tool.id,
        kind: '工具',
        label: tool.name,
        sub: tool.type === 'link' ? tool.target : '命令 · ' + tool.target,
        run: () => {
          if (tool.type === 'link') {
            window.open(tool.target, '_blank', 'noopener')
          } else {
            void navigator.clipboard?.writeText(tool.target)
            toast('已复制命令：' + tool.target)
          }
        },
      }))
    return [...pageItems, ...docItems, ...sourceItems, ...toolItems]
  }, [docs, keyword, location.pathname, navigate, sources, tools])

  useEffect(() => {
    setSelectedIndex(0)
  }, [keyword, docs, sources, tools])

  function runItem(item: ResultItem | undefined) {
    if (!item) return
    setOpen(false)
    setQuery('')
    item.run()
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(items.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runItem(items[selectedIndex])
    }
  }

  return (
    <div className="top-search" ref={wrapRef}>
      <span className="top-search-glyph" aria-hidden="true">
        <Icon name="search" size={17} />
      </span>
      <input
        ref={inputRef}
        className="top-search-input"
        type="search"
        value={query}
        placeholder="搜索项目、工具或文档"
        aria-label="全局搜索"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="search-pop" role="listbox" aria-label="搜索结果">
          {items.length === 0 ? (
            <p className="search-none">{keyword ? '没有匹配的结果' : '输入关键词搜索文档、项目或工具'}</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={'search-item' + (index === selectedIndex ? ' is-active' : '')}
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runItem(item)}
              >
                <span className="search-kind">{item.kind}</span>
                <span className="search-name">{item.label}</span>
                <span className="search-sub">{item.sub}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
