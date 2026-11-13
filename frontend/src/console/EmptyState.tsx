/** 空状态：统一回答「为什么这里是空的、下一步做什么」，避免各页自造空表格文案。 */
import Icon from './Icon'
import type { ConsoleIconName } from './Icon'

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'ghost'
}

export interface EmptyStateStep {
  title: string
  description: string
}

export default function EmptyState({
  icon = 'dashboard',
  title,
  description,
  steps,
  actions,
  hint,
  compact = false,
}: {
  icon?: ConsoleIconName
  title: string
  description: string
  /** 冷启动时解释「这个页面收集哪几类东西」，按顺序展示 */
  steps?: EmptyStateStep[]
  /** 主次动作：第一个建议 primary，其余 ghost */
  actions?: EmptyStateAction[]
  hint?: string
  compact?: boolean
}) {
  return (
    <div className={'empty-state' + (compact ? ' is-compact' : '')}>
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <p className="empty-title">{title}</p>
      <p className="empty-desc">{description}</p>
      {steps && steps.length > 0 && (
        <ol className="empty-steps">
          {steps.map((step) => (
            <li key={step.title}>
              <b>{step.title}</b>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      )}
      {actions && actions.length > 0 && (
        <div className="empty-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              className={'btn ' + (action.variant === 'ghost' ? 'btn-ghost' : 'btn-primary')}
              type="button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  )
}
