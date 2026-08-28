<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDevsetupStore } from '../store'
import BootstrapPanel from './BootstrapPanel.vue'
import ToolsPanel from './ToolsPanel.vue'
import ConfigFilesPanel from './ConfigFilesPanel.vue'

const router = useRouter()
const store = useDevsetupStore()

onMounted(() => store.loadAll())
</script>

<template>
  <div class="setup-view">
    <header class="setup-topbar">
      <div class="title-wrap">
        <button class="top-btn" @click="router.push('/docs')">← 返回文档</button>
        <span class="app-title">环境管家</span>
        <span class="app-sub">新电脑一键安装软件与恢复配置</span>
      </div>
    </header>

    <main class="setup-main">
      <BootstrapPanel />
      <ToolsPanel />
      <ConfigFilesPanel />
    </main>
  </div>
</template>

<style scoped>
.setup-view {
  min-height: 100vh;
  background: var(--bg);
}
.setup-topbar {
  height: var(--topbar-h);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-title {
  font-weight: 700;
  font-size: 16px;
}
.app-sub {
  color: var(--text-muted);
  font-size: 13px;
}
.setup-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 16px 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (max-width: 768px) {
  .app-sub {
    display: none;
  }
}
</style>
