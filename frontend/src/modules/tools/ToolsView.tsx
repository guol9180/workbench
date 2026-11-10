/**
 * 集成工具：常用链接 / 本地命令的前端入口。
 * 数据只存在当前浏览器的 localStorage，不走后端；命令点击复制，链接新窗口打开。
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { loadTools, newToolId, saveTools } from './store'
import type { ToolEntry } from './store'
import { toast } from '../../ui/toast'
import { showConfirm } from '../../ui/dialog'
import { Button, EmptyState, Icon, PageHeader, Panel, Tag } from '../../components/ui/ui'
import './tools.css'

export default function ToolsView() {
  const [tools, setTools] = useState<ToolEntry[]>(loadTools)
  const [name, setName] = useState('')
  const [type, setType] = useState<'link' | 'command'>('link')
  const [target, setTarget] = useState('')
  const [desc, setDesc] = useState('')

  function persist(nextTools: ToolEntry[]) {
    setTools(nextTools)
    saveTools(nextTools)
  }

  function addTool(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedTarget = target.trim()
    if (!trimmedName || !trimmedTarget) {
      toast('工具名称和地址 / 命令都不能为空。', true)
      return
    }
    if (type === 'link' && !/^https?:\/\//i.test(trimmedTarget)) {
      toast('网页工具地址需要以 http:// 或 https:// 开头。', true)
      return
    }
    const entry: ToolEntry = {
      id: newToolId(),
      name: trimmedName,
      type,
      target: trimmedTarget,
      desc: desc.trim(),
    }
    persist([entry, ...tools])
    setName('')
    setTarget('')
    setDesc('')
    toast('已添加「' + trimmedName + '」')
  }

  function activate(tool: ToolEntry) {
    if (tool.type === 'link') {
      window.open(tool.target, '_blank', 'noopener')
      return
    }
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(tool.target).then(
        () => toast('已复制命令：' + tool.target),
        () => toast('命令：' + tool.target),
      )
    } else {
      toast('命令：' + tool.target)
    }
  }

  async function removeTool(tool: ToolEntry) {
    const confirmed = await showConfirm({
      title: '删除工具？',
      message: '「' + tool.name + '」会从本机工具列表中移除。',
      confirmText: '删除',
      danger: true,
    })
    if (!confirmed) return
    persist(tools.filter((candidate) => candidate.id !== tool.id))
    toast('已删除「' + tool.name + '」')
  }

  return (
    <div className="tools">
      <PageHeader title="集成工具" desc="把常用网页和本地命令收在一个入口；配置只保存在这台浏览器。">
        <Tag>{tools.length} 个工具</Tag>
      </PageHeader>

      <div className="tools-layout">
        <Panel className="tools-form-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">添加工具</h2>
              <p className="panel-sub">网页链接或需要复制执行的命令</p>
            </div>
          </div>
          <form className="tools-form" onSubmit={addTool}>
            <label className="tools-field">
              <span>名称</span>
              <input className="input" value={name} maxLength={16} placeholder="例如：JSON 格式化" onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="tools-field">
              <span>类型</span>
              <select className="input" value={type} onChange={(event) => setType(event.target.value as 'link' | 'command')}>
                <option value="link">网页链接</option>
                <option value="command">本地命令</option>
              </select>
            </label>
            <label className="tools-field">
              <span>地址 / 命令</span>
              <input
                className="input"
                value={target}
                placeholder={type === 'link' ? 'https://…' : '例如：pnpm dev'}
                onChange={(event) => setTarget(event.target.value)}
              />
            </label>
            <label className="tools-field">
              <span>说明（可选）</span>
              <input className="input" value={desc} maxLength={40} placeholder="一句话说明用途" onChange={(event) => setDesc(event.target.value)} />
            </label>
            <Button variant="primary" type="submit">
              <Icon name="plus" size={16} />添加工具
            </Button>
          </form>
        </Panel>

        <section className="tools-list-panel" aria-label="工具列表">
          {tools.length === 0 ? (
            <Panel className="tools-empty-panel">
              <EmptyState>还没有工具。左侧填一个常用链接或命令，之后就能从这里直接打开或复制。</EmptyState>
            </Panel>
          ) : (
            <div className="tools-grid">
              {tools.map((tool) => (
                <article className="tool-card" key={tool.id}>
                  <div className="tool-card-head">
                    <span className="tool-mark">{tool.type === 'link' ? <Icon name="external" size={18} /> : <Icon name="terminal" size={18} />}</span>
                    <Tag tone={tool.type === 'link' ? 'accent' : 'muted'}>{tool.type === 'link' ? '网页' : '命令'}</Tag>
                  </div>
                  <h3 className="tool-name">{tool.name}</h3>
                  {tool.desc && <p className="tool-desc">{tool.desc}</p>}
                  <p className="tool-target" title={tool.target}>{tool.target}</p>
                  <div className="tool-actions">
                    <Button size="sm" variant="primary" onClick={() => activate(tool)}>
                      {tool.type === 'link' ? '打开' : '复制命令'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void removeTool(tool)}>删除</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
