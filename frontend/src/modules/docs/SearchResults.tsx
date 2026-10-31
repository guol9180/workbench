/** 搜索结果列表：命中路径 + 摘要，点击回树并打开 */
import { useDocs } from './useDocs'
import { Button, Tag } from '../../components/ui/ui'

export default function SearchResults() {
  const { state, actions } = useDocs()

  return (
    <div className="docp-results">
      <div className="docp-results-head">
        <span>{state.searchSummary}</span>
        <Button size="sm" variant="ghost" onClick={actions.backToTree}>返回</Button>
      </div>
      <div className="docp-hits">
        {state.searchResults.length === 0 && <div className="docp-empty">没有匹配的文档</div>}
        {state.searchResults.map((hit) => (
          <div key={hit.path} className="docp-hit" onClick={() => void actions.openSearchHit(hit.path)}>
            <div className="docp-hit-path">
              {hit.path}
              {hit.fileNameMatch && <Tag tone="accent" className="docp-hit-tag">文件名</Tag>}
            </div>
            <div className="docp-hit-snippet">{hit.snippet || ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
