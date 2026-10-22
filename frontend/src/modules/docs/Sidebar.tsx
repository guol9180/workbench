/** 目录侧栏：搜索行 + 树/搜索结果二选一 */
import { useRef, useState } from 'react'
import { useDocs } from './useDocs'
import DocTree from './DocTree'
import SearchResults from './SearchResults'

export default function Sidebar() {
  const { state, actions } = useDocs()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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
