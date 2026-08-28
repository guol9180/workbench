<script setup>
import { computed, ref } from 'vue'
import { useDevsetupStore } from '../store'
import { showConfirm } from '../../../ui/dialog'

/**
 * 一键引导面板：一行命令、脚本下载、IDEA 配置快照管理与步骤预览。
 */
const store = useDevsetupStore()

/* 后端基地址：生产取 VITE_API_BASE，本地开发走 vite 代理（origin 即可） */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '') || window.location.origin
const oneLiner = `irm ${API_BASE}/api/devsetup/bootstrap.ps1 | iex`

const copied = ref(false)
async function copyOneLiner() {
  try {
    await navigator.clipboard.writeText(oneLiner)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = oneLiner
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

/* IDEA 快照上传表单 */
const artifactName = ref('idea-settings')
const artifactNote = ref('')
const artifactFile = ref(null)

function onFileChange(e) {
  artifactFile.value = e.target.files[0]
}

async function uploadSnapshot() {
  if (!artifactFile.value) {
    return
  }
  const ok = await store.uploadArtifact(artifactName.value.trim() || 'idea-settings', artifactNote.value, artifactFile.value)
  if (ok) {
    artifactFile.value = null
    artifactNote.value = ''
    resetFileInput()
  }
}
function resetFileInput() {
  const input = document.getElementById('artifact-file-input')
  if (input) input.value = ''
}

async function removeArtifact(a) {
  if (await showConfirm({ title: '删除快照', message: `确定删除快照「${a.name}」（${a.filename}）？`, danger: true })) {
    store.removeArtifact(a)
  }
}

function formatSize(size) {
  if (size == null) return ''
  return size > 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + ' MB' : Math.round(size / 1024) + ' KB'
}
function formatTime(t) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

/* 步骤预览 */
const previewOpen = ref(false)
async function togglePreview() {
  previewOpen.value = !previewOpen.value
  if (previewOpen.value && !store.manifest) {
    await store.loadManifest()
  }
}
const preview = computed(() => {
  const m = store.manifest
  if (!m) return null
  return {
    winget: m.tools.filter((t) => t.category === 'WINGET'),
    zip: m.tools.filter((t) => t.category === 'ZIP'),
    plugins: m.tools.filter((t) => t.category === 'IDEA_PLUGIN'),
    configs: m.configFiles,
    artifacts: m.artifacts,
  }
})
</script>

<template>
  <section class="card">
    <h2 class="card-title">新电脑一键引导</h2>

    <div class="block">
      <div class="block-label">1. 在新电脑的 PowerShell 中执行（建议以管理员身份运行）：</div>
      <div class="cmd-row">
        <code class="cmd">{{ oneLiner }}</code>
        <button class="top-btn primary" @click="copyOneLiner">{{ copied ? '已复制' : '复制' }}</button>
      </div>
      <div class="hint">脚本运行时会要求输入工作台访问密码；全程不需要 JetBrains 账号。</div>
    </div>

    <div class="block">
      <div class="block-label">2. 在旧电脑采集 IDEA 配置快照（换机前做一次）：</div>
      <div class="row-actions">
        <button class="top-btn" @click="store.downloadScript('capture.ps1')">下载 capture.ps1</button>
        <button class="top-btn" @click="store.downloadScript('bootstrap.ps1')">下载 bootstrap.ps1</button>
        <button class="top-btn" @click="togglePreview">{{ previewOpen ? '收起步骤预览' : '预览将执行的步骤' }}</button>
      </div>
      <div class="hint">采集脚本会把 IDEA 的主题/快捷键/代码风格打包成 zip 放到桌面，然后在下方上传。</div>
    </div>

    <div class="block">
      <div class="block-label">3. 上传 IDEA 配置快照（同名覆盖，建议工件名保持 idea-settings）：</div>
      <div class="upload-row">
        <input v-model="artifactName" class="ipt ipt-name" placeholder="工件名（如 idea-settings）">
        <input v-model="artifactNote" class="ipt" placeholder="备注（可选，如采集自某台机器）">
        <input id="artifact-file-input" type="file" accept=".zip" class="file-input" @change="onFileChange">
        <button class="top-btn primary" :disabled="!artifactFile || store.uploading" @click="uploadSnapshot">
          {{ store.uploading ? '上传中…' : '上传快照' }}
        </button>
      </div>
      <label for="artifact-file-input" class="file-label">{{ artifactFile ? artifactFile.name : '选择快照 zip 文件' }}</label>

      <table v-if="store.artifacts.length" class="tbl">
        <thead>
          <tr><th>工件名</th><th>文件</th><th>大小</th><th>更新时间</th><th>备注</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in store.artifacts" :key="a.id">
            <td>{{ a.name }}</td>
            <td>{{ a.filename }}</td>
            <td>{{ formatSize(a.size) }}</td>
            <td>{{ formatTime(a.updateTime) }}</td>
            <td class="muted">{{ a.note }}</td>
            <td class="row-actions">
              <button class="mini-btn" @click="store.downloadArtifactFile(a)">下载</button>
              <button class="mini-btn danger" @click="removeArtifact(a)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="hint">还没有快照。上传后，引导脚本在新电脑上会自动恢复 IDEA 设置。</div>
    </div>

    <div v-if="previewOpen && preview" class="block">
      <div class="block-label">将执行的步骤（基于当前启用的清单）：</div>
      <ol class="steps">
        <li>
          安装软件（winget，<b>{{ preview.winget.length }}</b> 项）
          <ul><li v-for="t in preview.winget" :key="t.id">{{ t.name }}（{{ t.sourceRef }}{{ t.version ? ' @' + t.version : '' }}）</li></ul>
        </li>
        <li>
          绿色版工具（ZIP，<b>{{ preview.zip.length }}</b> 项，解压并加入 PATH）
          <ul><li v-for="t in preview.zip" :key="t.id">{{ t.name }}</li></ul>
        </li>
        <li>
          下发配置文件（<b>{{ preview.configs.length }}</b> 个，覆盖前自动备份）
          <ul><li v-for="c in preview.configs" :key="c.name">{{ c.name }} → {{ c.targetPath }}</li></ul>
        </li>
        <li>
          安装 IDEA 插件（<b>{{ preview.plugins.length }}</b> 个，命令行免账号）
          <ul><li v-for="t in preview.plugins" :key="t.id">{{ t.name }}（{{ t.sourceRef }}）</li></ul>
        </li>
        <li>恢复 IDEA 配置快照（<b>{{ preview.artifacts.length }}</b> 个可选）</li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
}
.card-title {
  margin: 0 0 14px;
  font-size: 16px;
}
.block {
  margin-bottom: 16px;
}
.block:last-child {
  margin-bottom: 0;
}
.block-label {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
}
.cmd-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.cmd {
  flex: 1;
  background: #f1f3f6;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: Consolas, Menlo, monospace;
  font-size: 13px;
  word-break: break-all;
  white-space: pre-wrap;
}
.row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 6px;
}
.upload-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ipt {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
  background: var(--panel);
  color: var(--text);
}
.ipt-name {
  width: 180px;
}
.ipt:nth-child(2) {
  flex: 1;
  min-width: 200px;
}
.file-input {
  display: none;
}
.file-label {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 12px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.file-label:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 13px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
}
.tbl th {
  color: var(--text-muted);
  font-weight: 600;
}
.muted {
  color: var(--text-muted);
}
.mini-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 5px;
  padding: 3px 9px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
}
.mini-btn:hover {
  background: var(--hover);
}
.mini-btn.danger {
  color: var(--danger);
}
.steps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.9;
}
.steps ul {
  margin: 2px 0 6px;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: 12px;
}
@media (max-width: 768px) {
  .cmd-row {
    flex-direction: column;
  }
}
</style>
