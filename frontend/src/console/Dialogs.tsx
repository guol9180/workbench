/** 两个原生 dialog：项目详情、导出。 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { errorRate, fmtDay, fmtNum, fmtStamp, LEVEL_META, STATUS_META } from './data'
import type { LogEntry, Project } from './data'
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
    <Modal open={!!project} title="项目详情" sub={`${project.name} · 实时数据`} onClose={onClose}>
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
    <Modal open={open} title="导出数据" sub="从当前视图数据生成文件并下载" onClose={onClose}>
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
