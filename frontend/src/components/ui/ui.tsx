/**
 * 共享 UI 原语（对应 ui.css）：Panel / PageHeader / Button / IconButton / Tag /
 * Spinner / Segmented / Chip / StatusDot / Banner / Field / EmptyState。
 * 只做结构与语义类，视觉全部在 ui.css 引用设计令牌。
 * 模块样式只补布局与域特有差异，不再复制这些视觉定义。
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export { Icon } from './Icon'
export type { IconName } from './Icon'
export { Combobox } from './Combobox'
export type { ComboboxProps } from './Combobox'

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={'panel ' + className}>{children}</section>
}

/** 页头：眉标（域/编号）+ 标题 + 一行说明 + 右侧操作。全站页面共用同一节奏 */
export function PageHeader({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow?: string
  title: string
  desc?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="page-heading">
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  )
}

export type ButtonVariant = 'default' | 'primary' | 'outline' | 'ghost' | 'danger'

/** 统一按钮：四种高度/五种语义；模块里不再各自发明按钮观感 */
export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    'btn',
    variant !== 'default' ? variant : '',
    size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}

/** 图标按钮：只给无文字的图标操作；aria-label/title 必填，保证可读 */
export function IconButton({
  label,
  size = 'md',
  className = '',
  children,
  ...rest
}: {
  label: string
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['icon-btn', size === 'sm' ? 'sm' : '', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

export type TagTone = 'muted' | 'accent' | 'warn' | 'ok'

/** 标签：指标 / 窗口 / 来源等短标记的唯一观感 */
export function Tag({
  tone = 'muted',
  className = '',
  children,
}: {
  tone?: TagTone
  className?: string
  children: ReactNode
}) {
  return <span className={['tag', tone !== 'muted' ? tone : '', className].filter(Boolean).join(' ')}>{children}</span>
}

/** 加载指示：按钮内联用，颜色继承 currentColor */
export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
}

export interface SegOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  mono = true,
  itemStyle,
  ariaLabel,
}: {
  options: Array<SegOption<T>>
  value: T
  onChange: (v: T) => void
  mono?: boolean
  itemStyle?: (v: T, active: boolean) => CSSProperties | undefined
  ariaLabel?: string
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            className={'seg-item' + (mono ? ' mono' : '') + (active ? ' active' : '')}
            style={itemStyle?.(option.value, active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({
  active,
  dotOn,
  title,
  onClick,
  children,
}: {
  active?: boolean
  dotOn?: boolean
  title?: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button className={'chip' + (active ? ' active' : '')} title={title} onClick={onClick}>
      <i className={'chip-dot' + (dotOn ? ' on' : '')} aria-hidden="true" />
      {children}
    </button>
  )
}

export type DotState = 'ok' | 'warn' | 'err' | 'idle'

export function StatusDot({ state, title }: { state: DotState; title?: string }) {
  return <i className={'dot ' + state} title={title} aria-hidden="true" />
}

export function Banner({
  tone = 'warn',
  actionLabel,
  onAction,
  children,
}: {
  tone?: 'warn' | 'err'
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <div className={'banner' + (tone === 'err' ? ' err' : '')} role="alert">
      <span>{children}</span>
      {actionLabel && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
