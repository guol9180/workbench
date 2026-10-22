/**
 * 读数格式化：读数排、图表轴、悬浮读数共用，保证全站数字口径一致。
 * 全部输出面向「扫一眼就懂」：千分位、合理单位、固定小数位。
 */

/** 整数千分位：12,480 */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** 延迟：142ms / 2.30 s */
export function fmtMs(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(2) + ' s' : Math.round(n) + ' ms'
}

/** 比率：0.008 → 0.80% */
export function fmtRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%'
}

/** k/M 短格式：图表轴标签专用，空间小 */
export function fmtShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(Math.round(n))
}

function pad(x: number): string {
  return String(x).padStart(2, '0')
}

/** HH:mm：图表 x 轴时间刻度 */
export function fmtHM(ts: number): string {
  const d = new Date(ts)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/** HH:mm:ss：状态条时钟 */
export function fmtClock(ts: number): string {
  const d = new Date(ts)
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}
