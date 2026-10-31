/** 文件树（递归）：目录折叠展开、行内操作（新建/重命名/删除）hover 浮现 */
import { useDocs } from './useDocs'
import { Icon } from '../../components/ui/ui'
import type { DocNode } from './api'

export default function DocTree({ nodes }: { nodes: DocNode[] }) {
  const { state, actions } = useDocs()

  return (
    <>
      {nodes.map((node) => {
        const isDirectory = node.type === 'dir'
        const isOpen = isDirectory && state.expanded.has(node.path)
        return (
          <div key={node.path} className="docp-item">
            <div
              className={'docp-row' + (node.path === state.currentPath ? ' active' : '')}
              title={node.path}
              onClick={() => (isDirectory ? actions.toggleDir(node) : void actions.openDoc(node.path))}
            >
              <span className={'docp-caret' + (isOpen ? ' open' : '')}>
                {isDirectory && <Icon name="chevron-right" size={12} />}
              </span>
              <span className="docp-name">{node.name}</span>
              <span className="docp-ops">
                {isDirectory && (
                  <>
                    <button
                      className="docp-op"
                      title="在这里新建文档"
                      aria-label="在这里新建文档"
                      onClick={(event) => {
                        event.stopPropagation()
                        void actions.newFile(node.path)
                      }}
                    >
                      <Icon name="file-plus" size={13} />
                    </button>
                    <button
                      className="docp-op"
                      title="在这里新建文件夹"
                      aria-label="在这里新建文件夹"
                      onClick={(event) => {
                        event.stopPropagation()
                        void actions.newDir(node.path)
                      }}
                    >
                      <Icon name="folder-plus" size={13} />
                    </button>
                  </>
                )}
                <button
                  className="docp-op"
                  title="重命名"
                  aria-label="重命名"
                  onClick={(event) => {
                    event.stopPropagation()
                    void actions.renameNode(node)
                  }}
                >
                  <Icon name="pencil" size={13} />
                </button>
                <button
                  className="docp-op danger"
                  title="删除"
                  aria-label="删除"
                  onClick={(event) => {
                    event.stopPropagation()
                    void actions.deleteNode(node)
                  }}
                >
                  <Icon name="trash" size={13} />
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
