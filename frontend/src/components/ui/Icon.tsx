/**
 * 图标库：全站唯一来源，统一 24 网格 / 1.6 描边 / round cap。
 * 只画线条图标；品牌描迹是 logo，留在 AppShell 内单独画。
 */
import type { CSSProperties, ReactNode } from 'react'

export type IconName =
  | 'home'
  | 'pulse'
  | 'projects'
  | 'docs'
  | 'arrow-right'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'menu'
  | 'close'
  | 'search'
  | 'plus'
  | 'refresh'
  | 'save'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'file'
  | 'folder'
  | 'file-plus'
  | 'folder-plus'
  | 'clock'
  | 'trash'
  | 'pencil'
  | 'external'
  | 'pause'
  | 'play'
  | 'check'

const ICON_CONTENT: Record<IconName, ReactNode> = {
  home: <path d="M4 11 12 4l8 7M6.5 9.5V20h11V9.5" />,
  pulse: <polyline points="2,12 7,12 9.5,6 14.5,18 17,12 22,12" />,
  projects: (
    <path d="M12 3c4.4 0 8 1.25 8 2.8v12.4c0 1.55-3.6 2.8-8 2.8s-8-1.25-8-2.8V5.8C4 4.25 7.6 3 12 3Zm-8 2.8c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8M4 12c0 1.55 3.6 2.8 8 2.8s8-1.25 8-2.8" />
  ),
  docs: <path d="M7 2.5h7l4 4V21.5H7zM14 2.5v4h4M10 12.5h5M10 16h5" />,
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  'chevron-left': <path d="M14.5 6 9 12l5.5 6" />,
  'chevron-right': <path d="M9.5 6 15 12l-5.5 6" />,
  'chevron-down': <path d="M6 9.5 12 15.5 18 9.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 6.7M20 5v6h-6" />,
  save: <path d="M5 3.5h11l3 3V20.5H5zM8 3.5v6h8v-6M8 20.5v-6h8v6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
    </>
  ),
  moon: <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />,
  logout: <path d="M13 4h5v16h-5M9.5 8l-4 4 4 4M5.5 12H16" />,
  file: <path d="M7 2.5h7l4 4V21.5H7zM14 2.5v4h4M10 12.5h5M10 16h5" />,
  folder: <path d="M3.5 6.5h6l2 2h9v11h-17z" />,
  'file-plus': <path d="M7 2.5h7l4 4V21.5H7zM14 2.5v4h4M10 15h5M12.5 12.5v5" />,
  'folder-plus': <path d="M3.5 6.5h6l2 2h9v11h-17zM12.5 11v6M9.5 14h6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6.5 7l1 14h9l1-14M10 11v6M14 11v6" />,
  pencil: <path d="M4 20l4.5-1 10-10-3.5-3.5-10 10zM13.5 5.5 18.5 10.5" />,
  external: <path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M8 5v14l11-7z" />,
  check: <path d="M5 12.5 10 17.5 19 6.5" />,
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.6,
  className = '',
  style,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={'icon ' + className}
      style={style}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_CONTENT[name]}
    </svg>
  )
}
