/**
 * 编辑器适配层：VditorEditor 组件挂载后注入命令式句柄（getValue/setValue），
 * 模块内其余代码统一经此读写编辑器，不直接持有 Vditor 实例，也不把它混进 React 状态。
 * 两阶段就绪：attachEditor 挂载后立即生效，markEditorReady 在 Vditor 异步初始化完成后置位。
 * Vditor 的 Lute 引擎是懒加载的大脚本（约 3.7MB，见 vendor/vditor/dist/js/lute/lute.min.js），
 * 就绪前调用实例方法会抛 "Cannot read properties of undefined (reading 'Md2VditorIRDOM')"
 * （IR 模式下 setValue 内部读 vditor.lute）。所以就绪前的写入先挂起、就绪后补写，
 * 就绪前的读取返回挂起值：让「打开文档」与「编辑器初始化」两条异步链路互不依赖先后。
 */
export interface EditorHandle {
  getValue(): string
  setValue(text: string | null | undefined): void
}

let editor: EditorHandle | null = null
let ready = false
let pendingValue: string | null = null // 就绪前收到、待补写的内容；null 表示没有待补写内容

export function attachEditor(instance: EditorHandle | null): void {
  editor = instance
  ready = false
  pendingValue = null
}

/** Vditor 初始化完成。instance 与当前句柄不符说明是已卸载实例的迟到回调，忽略之 */
export function markEditorReady(instance: EditorHandle): void {
  if (instance !== editor) return
  ready = true
  if (pendingValue === null) return
  const text = pendingValue
  pendingValue = null
  editor!.setValue(text)
}

export function hasEditor(): boolean {
  return editor != null
}

export function isEditorReady(): boolean {
  return ready && editor != null
}

export function getEditorValue(): string {
  if (!ready || !editor) return pendingValue ?? ''
  return editor.getValue()
}

export function setEditorValue(text: string | null | undefined): void {
  const value = text == null ? '' : text
  if (!editor) return
  if (!ready) {
    pendingValue = value
    return
  }
  editor.setValue(value)
}
