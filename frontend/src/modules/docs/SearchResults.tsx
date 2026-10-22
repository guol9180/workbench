/** 搜索结果列表：命中路径 + 摘要，点击回树并打开 */
import { useDocs } from './useDocs'

export default function SearchResults() {
  const { state, actions } = useDocs()

  return (
    <div className="docp-results">
      <div className="docp-results-head">
        <span>{state.searchSummary}</span>
        <button className="docp-mini" onClick={actions.backToTree}>
          返回
        </button>
      </div>
      <div className="docp-hits">
        {state.searchResults.length === 0 && <div className="docp-empty">没有匹配的文档</div>}
        {state.searchResults.map((hit) => (
          <div key={hit.path} className="docp-hit" onClick={() => void actions.openSearchHit(hit.path)}>
            <div className="docp-hit-path">
              {hit.path}
              {hit.fileNameMatch && <em className="docp-hit-tag">文件名</em>}
            </div>
            <div className="docp-hit-snippet">{hit.snippet || ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
