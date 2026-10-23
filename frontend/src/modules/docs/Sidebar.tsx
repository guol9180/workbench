/** 目录侧栏：最近打开 + 搜索行 + 树/搜索结果二选一 */
import { useRef, useState } from 'react'
import { useDocs } from './useDocs'
import DocTree from './DocTree'
import SearchResults from './SearchResults'
import { getRecent } from './recent'
import { baseName } from './util'

export default function Sidebar() {
  const { state, actions } = useDocs()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // 随 store 渲染读取：openDoc 会写 localStorage，当前文档变化时本组件必然重渲染
  const recent = getRecent().filter((p) => p !== state.currentPath)

  function search() {
    void actions.doSearch(query)
  }

  const treeChildren = state.tree?.children ?? []

  return (
    <aside className="docp-sidebar">
      <div className="docp-search">
        <input
          ref={inputRef}
          value={query}
          type="search"
          placeholder="搜索文档…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="docp-mini" title="搜索" onClick={search}>
          搜索
        </button>
      </div>

      {!state.searching ? (
        <div className="docp-treepanel">
          {recent.length > 0 && (
            <div className="docp-recent">
              <div className="docp-recent-head">最近</div>
              {recent.map((p) => (
                <button
                  key={p}
                  className="docp-recent-row"
                  title={p}
                  onClick={() => void actions.openDoc(p)}
                >
                  {baseName(p)}
                </button>
              ))}
            </div>
          )}
          <div className="docp-treeactions">
            <button className="docp-mini" title="在根目录新建文档" onClick={() => void actions.newFile('')}>
              + 文档
            </button>
            <button className="docp-mini" title="在根目录新建文件夹" onClick={() => void actions.newDir('')}>
              + 文件夹
            </button>
            <button className="docp-mini ghost" title="刷新" onClick={() => void actions.loadTree()}>
              刷新
            </button>
          </div>
          <div className="docp-tree">
            {treeChildren.length === 0 ? (
              <div className="docp-empty">文档库为空，点击「+ 文档」开始</div>
            ) : (
              <DocTree nodes={treeChildren} />
            )}
          </div>
        </div>
      ) : (
        <SearchResults />
      )}
    </aside>
  )
}
