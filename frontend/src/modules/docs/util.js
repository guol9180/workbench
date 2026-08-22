/** 相对路径的父目录（根目录返回空串） */
export function parentOf(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.substring(0, i)
}

/** 相对路径的最后一段 */
export function baseName(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? path : path.substring(i + 1)
}

/** 文件名是否为允许的文档扩展名 */
export function extAllowed(name) {
  return /\.(md|markdown|txt)$/i.test(name)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 今日工作日志路径：日志/YYYY-MM/YYYY-MM-DD.md */
export function todayLogPath(now = new Date()) {
  const month = now.getFullYear() + '-' + pad2(now.getMonth() + 1)
  return '日志/' + month + '/' + month + '-' + pad2(now.getDate()) + '.md'
}

/** 今日工作日志初始模板 */
export function todayLogTemplate(now = new Date()) {
  const title = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + ' 工作日志'
  return '# ' + title + '\n\n## 今日工作\n\n- \n\n## 问题与备注\n\n- \n'
}

/** 读取本地文本文件（utf-8），FileReader 的 Promise 封装 */
export function readLocalFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}
