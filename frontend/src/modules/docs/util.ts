/** docs 模块纯函数：路径工具、今日日志约定、本地文件读取 */

/** 相对路径的父目录（根目录返回空串） */
export function parentOf(path: string): string {
  const slashIndex = path.lastIndexOf('/')
  return slashIndex < 0 ? '' : path.substring(0, slashIndex)
}

/** 相对路径的最后一段 */
export function baseName(path: string): string {
  const slashIndex = path.lastIndexOf('/')
  return slashIndex < 0 ? path : path.substring(slashIndex + 1)
}

/** 文件名是否为允许的文档扩展名（与后端白名单一致） */
export function extAllowed(name: string): boolean {
  return /\.(md|markdown|txt)$/i.test(name)
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** 今日工作日志路径：日志/YYYY-MM/YYYY-MM-DD.md */
export function todayLogPath(now = new Date()): string {
  const month = now.getFullYear() + '-' + padTwoDigits(now.getMonth() + 1)
  return '日志/' + month + '/' + month + '-' + padTwoDigits(now.getDate()) + '.md'
}

/** 今日工作日志初始模板 */
export function todayLogTemplate(now = new Date()): string {
  const title = now.getFullYear() + '-' + padTwoDigits(now.getMonth() + 1) + '-' + padTwoDigits(now.getDate()) + ' 工作日志'
  return '# ' + title + '\n\n## 今天做了什么\n\n- \n\n## 卡住的地方 / 备注\n\n- \n'
}

/** 读取本地文本文件（utf-8），FileReader 的 Promise 封装 */
export function readLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}
