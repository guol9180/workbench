/**
 * 编辑器适配层：VditorEditor 组件挂载后注入命令式句柄（getValue/setValue），
 * 模块内其余代码统一经此读写编辑器，不直接持有 Vditor 实例，也不把它混入 Pinia 状态。
 * 两阶段就绪：attachEditor 挂载后立即生效，markEditorReady 在 Vditor 异步初始化完成后置位——
 * 就绪前 getValue 会拿到空内容，saveDoc 以 isEditorReady() 挡住这种情况。
 */
let editor = null
let ready = false

export function attachEditor(instance) {
  editor = instance
  ready = false
}

export function markEditorReady() {
  ready = true
}

export function hasEditor() {
  return editor != null
}

export function isEditorReady() {
  return ready && editor != null
}

export function getEditorValue() {
  return editor ? editor.getValue() : ''
}

export function setEditorValue(text) {
  if (editor) editor.setValue(text)
}
