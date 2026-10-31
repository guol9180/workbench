/**
 * 接入页 Canvas 粒子景深场（旧 loginScene.js 的 TS 移植，重调色为观测站色板）。
 * - 粒子分三档景深 depth∈[0.2,1]：尺寸/透明度/漂浮速度随 depth 变化，双圆绘制（光晕+内核），不用 shadowBlur
 * - 鼠标视差：归一化坐标经 lerp 弹性缓动，粒子按 depth×14px 偏移；粗指针设备（触屏）不启用
 * - prefers-reduced-motion 只画静态一帧；document.hidden 暂停 RAF；返回清理函数，卸载时调用
 */

// 分析域色板：青为主、冰蓝点缀，与全站强调色一致
const PARTICLE_COLORS = ['#46d5c5', '#86efe4', '#8fb8f5']
const PARALLAX_DISTANCE = 14 // 鼠标视差最大位移(px，乘以景深)

interface Particle {
  positionX: number
  positionY: number
  depth: number
  radius: number
  riseSpeed: number
  twinkleRate: number
  phase: number
  color: string
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function withAlpha(hexColor: string, alpha: number): string {
  // hex 形如 #e8a33d；拼 rgba 避免 context.globalAlpha 逐粒子状态切换
  const red = parseInt(hexColor.slice(1, 3), 16)
  const green = parseInt(hexColor.slice(3, 5), 16)
  const blue = parseInt(hexColor.slice(5, 7), 16)
  return `rgba(${red},${green},${blue},${alpha.toFixed(3)})`
}

export function initLoginScene(canvas: HTMLCanvasElement): () => void {
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) return () => {}
  const context: CanvasRenderingContext2D = canvasContext

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const smallViewport = window.matchMedia('(max-width: 768px)').matches

  let viewportWidth = 0
  let viewportHeight = 0
  let animationFrameId = 0
  let disposed = false

  // 粒子：positionX/positionY 像素坐标，depth 景深，radius 内核半径，
  // riseSpeed 上升速度，twinkleRate 闪烁频率，phase 相位
  const particles: Particle[] = []

  function spawnParticle(initial: boolean): Particle {
    const depth = randomBetween(0.2, 1)
    return {
      positionX: randomBetween(0, viewportWidth),
      positionY: initial ? randomBetween(0, viewportHeight) : viewportHeight + randomBetween(6, 30),
      depth,
      radius: 0.7 + depth * 1.8,
      riseSpeed: 0.06 + depth * 0.22,
      twinkleRate: randomBetween(0.6, 1.6),
      phase: randomBetween(0, Math.PI * 2),
      color: PARTICLE_COLORS[(Math.random() * PARTICLE_COLORS.length) | 0],
    }
  }

  // 鼠标视差：targetOffset 是目标值，currentOffset 每帧向 targetOffset 缓动
  const targetOffset = { horizontal: 0, vertical: 0 }
  const currentOffset = { horizontal: 0, vertical: 0 }

  function handleMouseMove(event: MouseEvent) {
    targetOffset.horizontal = (event.clientX / window.innerWidth) * 2 - 1
    targetOffset.vertical = (event.clientY / window.innerHeight) * 2 - 1
  }

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    viewportWidth = canvas.clientWidth
    viewportHeight = canvas.clientHeight
    canvas.width = Math.round(viewportWidth * pixelRatio)
    canvas.height = Math.round(viewportHeight * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  function drawParticles(timestamp: number) {
    context.clearRect(0, 0, viewportWidth, viewportHeight)
    for (const particle of particles) {
      if (!prefersReducedMotion) {
        particle.positionY -= particle.riseSpeed
        if (particle.positionY < -12) {
          Object.assign(particle, spawnParticle(false))
        }
        particle.positionX += Math.sin(timestamp * 0.00035 + particle.phase) * 0.06
      }
      const drawX = particle.positionX + currentOffset.horizontal * particle.depth * PARALLAX_DISTANCE
      const drawY = particle.positionY + currentOffset.vertical * particle.depth * PARALLAX_DISTANCE
      const twinkle =
        0.55 + 0.45 * Math.sin(timestamp * 0.001 * particle.twinkleRate + particle.phase)
      const alpha = (0.14 + 0.5 * particle.depth) * twinkle
      context.beginPath()
      context.fillStyle = withAlpha(particle.color, alpha * 0.22)
      context.arc(drawX, drawY, particle.radius * 3, 0, Math.PI * 2)
      context.fill()
      context.beginPath()
      context.fillStyle = withAlpha(particle.color, alpha)
      context.arc(drawX, drawY, particle.radius, 0, Math.PI * 2)
      context.fill()
    }
  }

  function animationFrameStep(timestamp: number) {
    if (disposed) return
    currentOffset.horizontal += (targetOffset.horizontal - currentOffset.horizontal) * 0.05
    currentOffset.vertical += (targetOffset.vertical - currentOffset.vertical) * 0.05
    drawParticles(timestamp)
    animationFrameId = requestAnimationFrame(animationFrameStep)
  }

  function handleVisibility() {
    if (disposed || prefersReducedMotion) return
    cancelAnimationFrame(animationFrameId)
    if (!document.hidden) animationFrameId = requestAnimationFrame(animationFrameStep)
  }

  function handleResize() {
    resizeCanvas()
    if (prefersReducedMotion) drawParticles(0)
  }

  resizeCanvas()
  const particleCount = smallViewport ? 36 : 70
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex++) {
    particles.push(spawnParticle(true))
  }

  window.addEventListener('resize', handleResize)
  if (!coarsePointer) window.addEventListener('mousemove', handleMouseMove, { passive: true })
  if (prefersReducedMotion) {
    drawParticles(0) // 减动效：静态一帧
  } else {
    document.addEventListener('visibilitychange', handleVisibility)
    animationFrameId = requestAnimationFrame(animationFrameStep)
  }

  return function cleanup() {
    disposed = true
    cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
