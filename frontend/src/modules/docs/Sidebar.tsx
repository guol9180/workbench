/** 目录侧栏：最近打开 + 搜索行 + 树/搜索结果二选一 */
import { useState } from 'react'
import { useDocs } from './useDocs'
import DocTree from './DocTree'
import SearchResults from './SearchResults'
import { getRecent } from './recent'
import { baseName } from './util'
import { Button, Icon, IconButton } from '../../components/ui/ui'

export default function Sidebar() {
  const { state, actions } = useDocs()
  const [query, setQuery] = useState('')
  // 随 store 渲染读取：openDoc 会写 localStorage，当前文档变化时本组件必然重渲染
  const recent = getRecent().filter((docPath) => docPath !== state.currentPath)

  function search() {
    void actions.doSearch(query)
  }

  const treeChildren = state.tree?.children ?? []

  return (
    <aside className="docp-sidebar">
      <div className="docp-search">
        <input
          value={query}
          type="search"
          placeholder="搜标题或正文…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && search()}
        />
        <IconButton label="搜索" size="sm" onClick={search}>
          <Icon name="search" size={15} />
        </IconButton>
      </div>

      {!state.searching ? (
        <div className="docp-treepanel">
          {recent.length > 0 && (
            <div className="docp-recent">
              <div className="docp-recent-head">最近打开</div>
              {recent.map((docPath) => (
                <button
                  key={docPath}
                  className="docp-recent-row"
                  title={docPath}
                  onClick={() => void actions.openDoc(docPath)}
                >
                  {baseName(docPath)}
                </button>
              ))}
            </div>
          )}
          <div className="docp-treeactions">
            <Button size="sm" title="在根目录新建文档" onClick={() => void actions.newFile('')}>
              <Icon name="file-plus" size={14} />新建文档
            </Button>
            <Button size="sm" title="在根目录新建文件夹" onClick={() => void actions.newDir('')}>
              <Icon name="folder-plus" size={14} />新建文件夹
            </Button>
            <Button variant="ghost" size="sm" title="刷新目录" onClick={() => void actions.loadTree()}>
              <Icon name="refresh" size={14} />刷新
            </Button>
          </div>
          <div className="docp-tree">
            {treeChildren.length === 0 ? (
              <div className="docp-empty">这里还没有文档。用上方的「新建文档」写下第一篇。</div>
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
