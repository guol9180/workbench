/**
 * 登录页 Canvas 粒子景深场。
 * - 粒子分三档景深 z∈[0.2,1]:尺寸/透明度/漂浮速度随 z 变化,双圆绘制(光晕+内核),不用 shadowBlur
 * - 鼠标视差:归一化坐标经 lerp 弹性缓动,粒子按 z×14px 偏移;粗指针设备(触屏)不启用
 * - prefers-reduced-motion 只画静态一帧;document.hidden 暂停 RAF;返回清理函数,卸载时调用
 */

const COLORS = ['#7dd3fc', '#93c5fd', '#a5b4fc']
const PARALLAX = 14 // 鼠标视差最大位移(px,乘以景深 z)

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function withAlpha(hex, alpha) {
  // hex 形如 #7dd3fc;拼 rgba 避免 ctx.globalAlpha 逐粒子状态切换
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

export function initLoginScene(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const mobile = window.matchMedia('(max-width: 768px)').matches

  let width = 0
  let height = 0
  let raf = 0
  let disposed = false

  // 粒子:x/y 像素坐标,z 景深,r 内核半径,vy 上升速度,tw 闪烁频率,phase 相位
  const particles = []
  function spawn(initial) {
    const z = rand(0.2, 1)
    return {
      x: rand(0, width),
      y: initial ? rand(0, height) : height + rand(6, 30),
      z,
      r: 0.7 + z * 1.8,
      vy: 0.06 + z * 0.22,
      tw: rand(0.6, 1.6),
      phase: rand(0, Math.PI * 2),
      color: COLORS[(Math.random() * COLORS.length) | 0],
    }
  }

  // 鼠标视差:target 是目标值,pos 每帧向 target 缓动
  const target = { x: 0, y: 0 }
  const pos = { x: 0, y: 0 }
  function onMouseMove(e) {
    target.x = (e.clientX / window.innerWidth) * 2 - 1
    target.y = (e.clientY / window.innerHeight) * 2 - 1
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height)
    for (const p of particles) {
      if (!reduced) {
        p.y -= p.vy
        if (p.y < -12) {
          Object.assign(p, spawn(false))
        }
        p.x += Math.sin(t * 0.00035 + p.phase) * 0.06
      }
      const px = p.x + pos.x * p.z * PARALLAX
      const py = p.y + pos.y * p.z * PARALLAX
      const twinkle = 0.55 + 0.45 * Math.sin(t * 0.001 * p.tw + p.phase)
      const alpha = (0.14 + 0.5 * p.z) * twinkle
      ctx.beginPath()
      ctx.fillStyle = withAlpha(p.color, alpha * 0.22)
      ctx.arc(px, py, p.r * 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = withAlpha(p.color, alpha)
      ctx.arc(px, py, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function frame(t) {
    if (disposed) return
    pos.x += (target.x - pos.x) * 0.05
    pos.y += (target.y - pos.y) * 0.05
    draw(t)
    raf = requestAnimationFrame(frame)
  }

  function onVisibility() {
    if (disposed || reduced) return
    cancelAnimationFrame(raf)
    if (!document.hidden) raf = requestAnimationFrame(frame)
  }
  function onResize() {
    resize()
    if (reduced) draw(0)
  }

  resize()
  const count = mobile ? 36 : 70
  for (let i = 0; i < count; i++) particles.push(spawn(true))

  window.addEventListener('resize', onResize)
  if (!coarse) window.addEventListener('mousemove', onMouseMove, { passive: true })
  if (reduced) {
    draw(0) // 减动效:静态一帧
  } else {
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)
  }

  return function cleanup() {
    disposed = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
