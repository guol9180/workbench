/** 参考稿的四个原生 dialog：项目详情、新增项目、集成工具、导出。 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { errorRate, fmtDay, fmtNum, fmtStamp, LEVEL_META, STATUS_META } from './data'
import type { LogEntry, Project, ToolEntry } from './data'
import Icon from './Icon'

function Modal({
  open,
  title,
  sub,
  onClose,
  children,
  className = '',
}: {
  open: boolean
  title: string
  sub?: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className={className} onClose={onClose}>
      <div className="dialog-head">
        <div>
          <h2 className="dialog-title">{title}</h2>
          {sub && <span className="dialog-sub">{sub}</span>}
        </div>
        <button className="icon-btn" type="button" aria-label="关闭" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}

export function ProjectDetailDialog({
  project,
  logs,
  onClose,
  onShowLogs,
}: {
  project: Project | null
  logs: LogEntry[]
  onClose: () => void
  onShowLogs: (projectId: string) => void
}) {
  if (!project) return null
  const meta = STATUS_META[project.status]
  const recentLogs = logs.filter((entry) => entry.projectId === project.id).slice(0, 6)
  return (
    <Modal open={!!project} title="项目详情" sub={`${project.name} · 数据为本地示例`} onClose={onClose}>
      <div className="detail-grid">
        {[
          ['状态', <span key="status" className={'status-tag ' + meta.cls}>{meta.label}</span>],
          ['技术栈', project.stack],
          ['今日请求', fmtNum(project.todayRequests)],
          ['错误 / 错误率', `${fmtNum(project.errors)} · ${errorRate(project.errors, project.todayRequests)}`],
          ['平均响应', project.todayRequests > 0 ? `${project.latency}ms` : '—'],
          ['可用率', project.uptime],
          ['最近部署', fmtDay(project.lastDeploy)],
          ['说明', project.desc || '—'],
        ].map(([label, value]) => (
          <div className="detail-item" key={String(label)}>{label}<b>{value}</b></div>
        ))}
      </div>
      <div>
        <h3 className="panel-title">最近日志</h3>
        <div className="dialog-log-list" style={{ marginTop: 10 }}>
          {recentLogs.length === 0 ? (
            <div className="log-row"><span className="log-time">—</span><span className="level-tag level-info">INFO</span><span className="log-main"><span className="log-msg">暂无日志</span></span></div>
          ) : recentLogs.map((entry) => (
            <div className="log-row" key={entry.id}>
              <span className="log-time">{fmtStamp(entry.ts)}</span>
              <span className={'level-tag ' + LEVEL_META[entry.level].cls}>{LEVEL_META[entry.level].label}</span>
              <span className="log-main"><span className="log-project">{project.name}</span><span className="log-msg">{entry.msg}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>关闭</button>
        <button className="btn btn-primary" type="button" onClick={() => onShowLogs(project.id)}>查看全部日志</button>
      </div>
    </Modal>
  )
}

export interface ProjectDraft {
  name: string
  stack: string
  status: Project['status']
  desc: string
}

export function ProjectFormDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (draft: ProjectDraft) => void
}) {
  const [name, setName] = useState('')
  const [stack, setStack] = useState('')
  const [status, setStatus] = useState<Project['status']>('running')
  const [desc, setDesc] = useState('')
  const [errors, setErrors] = useState<{ name?: string; stack?: string }>({})

  useEffect(() => {
    if (!open) return
    setName(''); setStack(''); setStatus('running'); setDesc(''); setErrors({})
  }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: { name?: string; stack?: string } = {}
    if (!name.trim()) nextErrors.name = '请填写项目名称'
    if (!stack.trim()) nextErrors.stack = '请填写技术栈'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({ name: name.trim(), stack: stack.trim(), status, desc: desc.trim() })
  }

  return (
    <Modal open={open} title="新增项目" sub="登记一个你自己开发的项目" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="project-input-name">项目名称</label>
          <input id="project-input-name" className="input" value={name} maxLength={20} placeholder="例如：个人博客站点" onChange={(event) => setName(event.target.value)} />
          <p className="field-error">{errors.name ?? ''}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="project-input-stack">技术栈</label>
          <input id="project-input-stack" className="input" value={stack} maxLength={20} placeholder="例如：Next.js" onChange={(event) => setStack(event.target.value)} />
          <p className="field-error">{errors.stack ?? ''}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="project-input-status">当前状态</label>
          <select id="project-input-status" className="input" value={status} onChange={(event) => setStatus(event.target.value as Project['status'])}>
            <option value="running">运行中</option>
            <option value="developing">开发中</option>
            <option value="stopped">已停止</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="project-input-desc">项目说明（可选）</label>
          <textarea id="project-input-desc" className="input" rows={3} maxLength={60} placeholder="一句话说明这个项目" value={desc} onChange={(event) => setDesc(event.target.value)} />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" type="button" onClick={() => { setName(''); setStack(''); setStatus('running'); setDesc(''); setErrors({}) }}>清空</button>
          <button className="btn btn-primary" type="submit">保存项目</button>
        </div>
      </form>
    </Modal>
  )
}

export function ToolFormDialog({
  open,
  tools,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean
  tools: ToolEntry[]
  onClose: () => void
  onSubmit: (draft: Omit<ToolEntry, 'id'>) => void
  onDelete: (tool: ToolEntry) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'link' | 'command'>('link')
  const [target, setTarget] = useState('')
  const [desc, setDesc] = useState('')
  const [errors, setErrors] = useState<{ name?: string; target?: string }>({})

  useEffect(() => {
    if (!open) return
    setName(''); setType('link'); setTarget(''); setDesc(''); setErrors({})
  }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: { name?: string; target?: string } = {}
    if (!name.trim()) nextErrors.name = '请填写工具名称'
    if (!target.trim()) nextErrors.target = '请填写地址或命令'
    else if (type === 'link' && !/^https?:\/\//i.test(target.trim())) nextErrors.target = '网页链接需以 http:// 或 https:// 开头'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit({ name: name.trim(), type, target: target.trim(), desc: desc.trim() })
  }

  return (
    <Modal open={open} title="集成新工具" sub="添加你常用的网页工具或本地命令入口" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="tool-input-name">工具名称</label>
          <input id="tool-input-name" className="input" value={name} maxLength={12} placeholder="例如：JSON 格式化" onChange={(event) => setName(event.target.value)} />
          <p className="field-error">{errors.name ?? ''}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tool-input-type">工具类型</label>
          <select id="tool-input-type" className="input" value={type} onChange={(event) => setType(event.target.value as 'link' | 'command')}>
            <option value="link">网页链接</option>
            <option value="command">本地命令</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tool-input-target">工具地址 / 命令</label>
          <input id="tool-input-target" className="input" value={target} placeholder="网页以 http(s):// 开头，或填写命令" onChange={(event) => setTarget(event.target.value)} />
          <p className="field-error">{errors.target ?? ''}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tool-input-desc">工具说明（可选）</label>
          <input id="tool-input-desc" className="input" value={desc} maxLength={30} placeholder="一句话说明用途" onChange={(event) => setDesc(event.target.value)} />
        </div>
        {tools.length > 0 && (
          <div className="field">
            <span className="field-label">已集成的自定义工具</span>
            <div className="manage-list">
              {tools.map((tool) => (
                <div className="manage-item" key={tool.id}>
                  <span style={{ minWidth: 0 }}>
                    <span className="manage-name">{tool.name}</span>
                    <span className="manage-type">{tool.type === 'link' ? '网页链接' : '本地命令'} · {tool.target}</span>
                  </span>
                  <button className="btn-text" type="button" style={{ color: 'var(--danger)' }} onClick={() => onDelete(tool)}>删除</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <button className="btn btn-ghost" type="button" onClick={() => { setName(''); setType('link'); setTarget(''); setDesc(''); setErrors({}) }}>清空</button>
          <button className="btn btn-primary" type="submit">保存工具</button>
        </div>
      </form>
    </Modal>
  )
}

export function ExportDialog({
  open,
  defaultScope,
  onClose,
  onRun,
}: {
  open: boolean
  defaultScope: 'dashboard' | 'projects' | 'logs'
  onClose: () => void
  onRun: (scope: 'dashboard' | 'projects' | 'logs', format: 'csv' | 'json') => string
}) {
  const [scope, setScope] = useState(defaultScope)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [result, setResult] = useState('')
  useEffect(() => {
    if (!open) return
    setScope(defaultScope)
    setFormat('csv')
    setResult('')
  }, [open, defaultScope])
  return (
    <Modal open={open} title="导出数据" sub="从本地示例数据生成文件并下载" onClose={onClose}>
      <div className="field">
        <label className="field-label" htmlFor="export-scope">导出范围</label>
        <select id="export-scope" className="input" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
          <option value="dashboard">看板汇总</option>
          <option value="projects">项目清单</option>
          <option value="logs">最近日志</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="export-format">文件格式</label>
        <select id="export-format" className="input" value={format} onChange={(event) => setFormat(event.target.value as 'csv' | 'json')}>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <p className="panel-sub">{result}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>取消</button>
        <button className="btn btn-primary" type="button" onClick={() => setResult(onRun(scope, format))}>生成并下载</button>
      </div>
    </Modal>
  )
}
