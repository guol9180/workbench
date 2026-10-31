/**
 * 最近打开的文档（localStorage，容量 5 篇）。
 * 每天回到工作台的第一件事往往是「接着昨天写」——最近列表把这件事变成一次点击。
 * 只存路径不存内容：内容仍以文件系统为唯一事实源。
 */
const KEY = 'wb-recent-docs'

export function getRecent(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]') as string[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function pushRecent(path: string): void {
  const list = getRecent().filter((docPath) => docPath !== path)
  list.unshift(path)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)))
}
