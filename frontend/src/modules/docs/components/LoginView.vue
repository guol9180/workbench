<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../../stores/auth'
import { initLoginScene } from '../loginScene'

const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const error = ref('')
const submitting = ref(false)
const inputEl = ref(null)
const canvasEl = ref(null)

/* 鼠标 3D 视差:细指针且未开启「减少动效」时启用,写入 CSS 变量给 .tilt */
const nx = ref(0)
const ny = ref(0)
const finePointer = window.matchMedia('(pointer: fine)').matches
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const tiltEnabled = finePointer && !reducedMotion
const tiltStyle = computed(() => ({
  '--rx': (-ny.value * 5).toFixed(2) + 'deg',
  '--ry': (nx.value * 8).toFixed(2) + 'deg',
}))

let moveRaf = 0
function onMouseMove(e) {
  if (moveRaf) return
  moveRaf = requestAnimationFrame(() => {
    moveRaf = 0
    nx.value = (e.clientX / window.innerWidth) * 2 - 1
    ny.value = (e.clientY / window.innerHeight) * 2 - 1
  })
}

/* 登录失败时卡片轻微抖动;animationend 后复位,保证下次失败可重触发 */
const shaking = ref(false)
async function shake() {
  shaking.value = false
  await nextTick()
  shaking.value = true
}

async function submit() {
  if (!password.value || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await auth.login(password.value)
    router.push('/docs')
  } catch (e) {
    error.value = e.message || '登录失败'
    shake()
  } finally {
    submitting.value = false
  }
}

let cleanupScene = null
onMounted(() => {
  inputEl.value && inputEl.value.focus()
  if (canvasEl.value) {
    cleanupScene = initLoginScene(canvasEl.value)
  }
  if (tiltEnabled) {
    window.addEventListener('mousemove', onMouseMove, { passive: true })
  }
})

onBeforeUnmount(() => {
  cleanupScene && cleanupScene()
  if (tiltEnabled) {
    window.removeEventListener('mousemove', onMouseMove)
  }
  if (moveRaf) cancelAnimationFrame(moveRaf)
})
</script>

<template>
  <div class="login-view">
    <div class="aurora" aria-hidden="true">
      <i class="blob blob-a"></i>
      <i class="blob blob-b"></i>
      <i class="blob blob-c"></i>
    </div>
    <canvas ref="canvasEl" class="scene" aria-hidden="true"></canvas>

    <div class="stage">
      <div class="tilt" :style="tiltStyle">
        <div class="logo3d">
          <i class="orbit" aria-hidden="true"></i>
          <div class="logo-float" :class="{ shake: shaking }">
            <svg width="76" height="76" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="工作台">
              <defs>
                <linearGradient id="login-logo-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#1e3a8a"/>
                  <stop offset="0.6" stop-color="#2563eb"/>
                  <stop offset="1" stop-color="#3b82f6"/>
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="112" fill="url(#login-logo-g)"/>
              <polyline points="140,176 208,332 256,258 304,332 372,176"
                        fill="none" stroke="#ffffff" stroke-width="60"
                        stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <form class="glass-card" :class="{ shake: shaking }" @submit.prevent="submit" @animationend="shaking = false">
          <h1>工作台</h1>
          <p class="sub">在线文档 · 环境管家 — 你的个人工作台</p>
          <input
            ref="inputEl"
            v-model="password"
            type="password"
            placeholder="请输入访问密码"
            autocomplete="current-password"
          >
          <button type="submit" :disabled="submitting">
            <span v-if="submitting" class="spinner" aria-label="登录中"></span>
            <span v-else>登 录</span>
          </button>
          <div class="login-error">{{ error }}</div>
        </form>
      </div>
    </div>

    <p class="footnote">工作台 Workbench</p>
  </div>
</template>

<style scoped>
/* ---------- 场景底色与极光 ---------- */
.login-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 90% at 70% 0%, #12245c 0%, transparent 55%),
    linear-gradient(160deg, #0a1230 0%, #070d1f 55%, #0b1530 100%);
  color-scheme: dark;
}
.aurora {
  position: absolute;
  inset: 0;
  filter: blur(90px);
  pointer-events: none;
}
.blob {
  position: absolute;
  border-radius: 50%;
  opacity: 0.62;
  will-change: transform;
}
.blob-a {
  width: 46vw; height: 46vw; min-width: 420px; min-height: 420px;
  left: 6%; top: -14%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.6) 0%, transparent 65%);
  animation: drift-a 26s ease-in-out infinite alternate;
}
.blob-b {
  width: 38vw; height: 38vw; min-width: 360px; min-height: 360px;
  right: 2%; top: 18%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.48) 0%, transparent 65%);
  animation: drift-b 21s ease-in-out infinite alternate;
}
.blob-c {
  width: 42vw; height: 42vw; min-width: 400px; min-height: 400px;
  left: 30%; bottom: -22%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.5) 0%, transparent 65%);
  animation: drift-c 30s ease-in-out infinite alternate;
}
@keyframes drift-a {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(9vw, 7vh, 0) scale(1.15); }
}
@keyframes drift-b {
  from { transform: translate3d(0, 0, 0) scale(1.1); }
  to { transform: translate3d(-7vw, 10vh, 0) scale(0.92); }
}
@keyframes drift-c {
  from { transform: translate3d(0, 0, 0) scale(0.95); }
  to { transform: translate3d(6vw, -8vh, 0) scale(1.12); }
}

.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ---------- 3D 舞台:透视 + 鼠标倾斜 ---------- */
.stage {
  position: relative;
  z-index: 2;
  perspective: 1100px;
}
.tilt {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transform-style: preserve-3d;
  transition: transform 0.3s ease-out;
  will-change: transform;
}

/* logo:更近的景深层,鼠标倾斜时视差更明显 */
.logo3d {
  position: relative;
  transform: translateZ(70px);
  margin-bottom: -26px;
  z-index: 2;
}
.logo-float {
  animation:
    logo-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both,
    logo-bob 5.5s ease-in-out 1.4s infinite alternate;
}
@keyframes logo-in {
  from { opacity: 0; transform: translateY(-46px) rotateX(28deg) scale(0.86); }
  to { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }
}
@keyframes logo-bob {
  from { transform: translateY(0); }
  to { transform: translateY(-9px); }
}
.logo-float svg {
  display: block;
  border-radius: 22.6%;
  box-shadow:
    0 24px 60px rgba(2, 8, 30, 0.65),
    0 6px 18px rgba(37, 99, 235, 0.35);
}
/* logo 下方悬浮光环 */
.orbit {
  position: absolute;
  left: 50%; bottom: -30px;
  width: 168px; height: 42px;
  margin-left: -84px;
  border-radius: 50%;
  border: 1.5px solid rgba(125, 211, 252, 0.4);
  border-top-color: rgba(125, 211, 252, 0.05);
  transform: rotateX(74deg);
  animation: orbit-spin 13s linear infinite;
  pointer-events: none;
}
.orbit::after {
  content: '';
  position: absolute;
  left: 8%; top: 8%;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 10px 2px rgba(125, 211, 252, 0.8);
}
@keyframes orbit-spin {
  from { transform: rotateX(74deg) rotateZ(0deg); }
  to { transform: rotateX(74deg) rotateZ(360deg); }
}

/* ---------- 玻璃卡 ---------- */
.glass-card {
  position: relative;
  width: min(380px, 90vw);
  padding: 62px 34px 28px;
  text-align: center;
  border-radius: 18px;
  background: linear-gradient(165deg, rgba(30, 41, 80, 0.6) 0%, rgba(13, 20, 40, 0.55) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 30px 80px rgba(2, 8, 30, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  animation: card-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(30px) rotateX(10deg) scale(0.97); }
  to { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }
}
.glass-card.shake {
  animation: card-shake 0.4s ease;
}
@keyframes card-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(3px); }
}

.glass-card h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #f5f8ff;
}
.sub {
  margin: 0 0 24px;
  font-size: 13px;
  color: rgba(198, 212, 245, 0.6);
  letter-spacing: 0.02em;
}

.glass-card input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  font-size: 15px;
  color: #f5f8ff;
  background: rgba(255, 255, 255, 0.06);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.glass-card input::placeholder {
  color: rgba(198, 212, 245, 0.42);
}
.glass-card input:focus {
  border-color: rgba(59, 130, 246, 0.85);
  background: rgba(255, 255, 255, 0.09);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);
}
/* 深色输入框上浏览器自动填充的白色底修正 */
.glass-card input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #16203f inset;
  -webkit-text-fill-color: #f5f8ff;
  caret-color: #f5f8ff;
  transition: background-color 9999s;
}

.glass-card button {
  width: 100%;
  margin-top: 14px;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.35em;
  text-indent: 0.35em;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}
.glass-card button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5);
  filter: brightness(1.06);
}
.glass-card button:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.97);
}
.glass-card button:disabled {
  opacity: 0.65;
  cursor: default;
}

.spinner {
  display: inline-block;
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: -3px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-error {
  color: #f87171;
  font-size: 13px;
  min-height: 20px;
  margin-top: 10px;
}

.footnote {
  position: absolute;
  bottom: 22px;
  left: 0; right: 0;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  color: rgba(198, 212, 245, 0.32);
  pointer-events: none;
  animation: card-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both;
}

/* ---------- 响应式与可访问性 ---------- */
@media (max-width: 768px) {
  .aurora {
    filter: blur(60px);
  }
  .glass-card {
    padding: 56px 26px 24px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .tilt {
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .blob,
  .logo-float,
  .orbit,
  .glass-card,
  .footnote,
  .spinner {
    animation: none !important;
  }
  .tilt {
    transition: none;
    transform: none;
  }
}
</style>
