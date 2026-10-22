/** 文件树（递归）：目录折叠展开、行内操作（新建/重命名/删除）hover 浮现 */
import { useDocs } from './useDocs'
import type { DocNode } from './api'

export default function DocTree({ nodes }: { nodes: DocNode[] }) {
  const { state, actions } = useDocs()

  return (
    <>
      {nodes.map((node) => {
        const isDir = node.type === 'dir'
        const isOpen = isDir && state.expanded.has(node.path)
        return (
          <div key={node.path} className="docp-item">
            <div
              className={'docp-row' + (node.path === state.currentPath ? ' active' : '')}
              title={node.path}
              onClick={() => (isDir ? actions.toggleDir(node) : void actions.openDoc(node.path))}
            >
              <span className={'docp-caret' + (isOpen ? ' open' : '')}>{isDir ? '▶' : ''}</span>
              <span className="docp-name">{node.name}</span>
              <span className="docp-ops">
                {isDir && (
                  <>
                    <button className="docp-op" title="在此新建文档" onClick={(e) => { e.stopPropagation(); void actions.newFile(node.path) }}>
                      +文
                    </button>
                    <button className="docp-op" title="在此新建文件夹" onClick={(e) => { e.stopPropagation(); void actions.newDir(node.path) }}>
                      +夹
                    </button>
                  </>
                )}
                <button className="docp-op" title="重命名" onClick={(e) => { e.stopPropagation(); void actions.renameNode(node) }}>
                  改名
                </button>
                <button className="docp-op danger" title="删除" onClick={(e) => { e.stopPropagation(); void actions.deleteNode(node) }}>
                  删除
                </button>
              </span>
            </div>
            {isOpen && node.children.length > 0 && (
              <div className="docp-children">
                <DocTree nodes={node.children} />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
