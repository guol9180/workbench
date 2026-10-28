/**
 * 共享 UI 原语（对应 ui.css）：Panel / Segmented / Chip / GhostButton / StatusDot /
 * Banner / Field / EmptyState。只做结构与语义类，视觉全部在 ui.css 引用设计令牌。
 * 模块样式只补布局与域特有差异，不再复制这些视觉定义。
 */
import type { CSSProperties, ReactNode } from 'react'

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={'panel ' + className}>{children}</section>
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
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            className={'seg-item' + (mono ? ' mono' : '') + (active ? ' active' : '')}
            style={itemStyle?.(o.value, active)}
            onClick={() => onChange(o.value)}
          >
            {o.label}
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

export function GhostButton({
  plain,
  danger,
  disabled,
  onClick,
  title,
  children,
}: {
  plain?: boolean
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  children: ReactNode
}) {
  const cls = 'ghost-btn' + (plain ? ' plain' : '') + (danger ? ' danger' : '')
  return (
    <button className={cls} disabled={disabled} title={title} onClick={onClick}>
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
      {actionLabel && <GhostButton onClick={onAction}>{actionLabel}</GhostButton>}
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
