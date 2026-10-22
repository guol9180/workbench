/**
 * Vditor 由本地 vendored UMD 脚本提供（index.html 引入），无官方类型。
 * 只声明本工程实际用到的面：实例方法（getValue/setValue/destroy）与静态 preview。
 * 点击 Vditor 的类型细节（toolbar 配置等）保持宽松——适配层已把实例隔离在组件内。
 */
export {}

declare global {
  interface VditorStatic {
    preview(el: HTMLElement, markdown: string, options?: Record<string, unknown>): void
  }

  interface VditorInstance {
    getValue(): string
    setValue(value: string): void
    destroy(): void
  }

  interface Window {
    // 构造器与静态 preview 二合一：vendored UMD 全量挂在 window.Vditor 上
    Vditor: (new (el: HTMLElement, options: Record<string, unknown>) => VditorInstance) & VditorStatic
  }
}
