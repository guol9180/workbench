/**
 * 读数格式化：读数排、图表轴、悬浮读数共用，保证全站数字口径一致。
 * 全部输出面向「扫一眼就懂」：千分位、合理单位、固定小数位。
 */

/** 整数千分位：12,480 */
export function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** 延迟：142ms / 2.30 s */
export function fmtMs(value: number): string {
  return value >= 1000 ? (value / 1000).toFixed(2) + ' s' : Math.round(value) + ' ms'
}

/** 比率：0.008 → 0.80% */
export function fmtRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%'
}

/** k/M 短格式：图表轴标签专用，空间小 */
export function fmtShort(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(value))
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** HH:mm：图表 x 轴时间刻度 */
export function fmtHM(timestamp: number): string {
  const date = new Date(timestamp)
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

/** MM-dd：日粒度柱图的 x 轴刻度 */
export function fmtMD(timestamp: number): string {
  const date = new Date(timestamp)
  return pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

/** HH:mm:ss：状态条时钟 */
export function fmtClock(timestamp: number): string {
  const date = new Date(timestamp)
  return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
}
