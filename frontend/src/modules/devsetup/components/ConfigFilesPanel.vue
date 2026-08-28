<script setup>
import { ref } from 'vue'
import { useDevsetupStore, emptyConfigFile } from '../store'
import { showConfirm } from '../../../ui/dialog'

/**
 * 配置文件面板：maven settings.xml / .gitconfig 等文本配置的增删改与启停。
 */
const store = useDevsetupStore()

const editing = ref(false)
const editingId = ref(null)
const form = ref(emptyConfigFile())

async function startAdd() {
  editingId.value = null
  form.value = emptyConfigFile()
  editing.value = true
}

async function startEdit(cf) {
  const detail = await store.loadConfigFileContent(cf.id)
  if (!detail) return
  editingId.value = cf.id
  form.value = { name: detail.name, targetPath: detail.targetPath, content: detail.content, enabled: detail.enabled, note: detail.note || '' }
  editing.value = true
}

async function submitForm() {
  if (!form.value.name.trim() || !form.value.targetPath.trim()) {
    return
  }
  const ok = await store.saveConfigFile(
    { ...form.value, name: form.value.name.trim(), targetPath: form.value.targetPath.trim() },
    editingId.value
  )
  if (ok) {
    editing.value = false
  }
}

async function removeConfigFile(cf) {
  if (await showConfirm({ title: '删除配置', message: `确定删除「${cf.name}」（${cf.targetPath}）？`, danger: true })) {
    store.removeConfigFile(cf)
  }
}
</script>

<template>
  <section class="card">
    <div class="head">
      <h2 class="card-title">配置文件下发</h2>
      <button class="top-btn primary" @click="startAdd">+ 添加配置</button>
    </div>
    <div class="lead">文本配置（maven settings.xml、.gitconfig、.npmrc 等）会由引导脚本写入目标路径，覆盖前自动备份。<b>禁止存放密钥和密码。</b></div>

    <div v-if="editing" class="form">
      <div class="form-row">
        <label class="fld">
          <span>名称</span>
          <input v-model="form.name" class="ipt" placeholder="如 Maven 配置">
        </label>
        <label class="fld fld-grow">
          <span>目标路径（支持 %USERPROFILE% 等环境变量）</span>
          <input v-model="form.targetPath" class="ipt mono" placeholder="%USERPROFILE%\.m2\settings.xml">
        </label>
        <label class="chk"><input v-model="form.enabled" type="checkbox"> 启用</label>
      </div>
      <label class="fld">
        <span>文件内容</span>
        <textarea v-model="form.content" class="ipt mono ta" rows="12" spellcheck="false"></textarea>
      </label>
      <div class="form-row">
        <label class="fld fld-grow">
          <span>备注（可选）</span>
          <input v-model="form.note" class="ipt">
        </label>
      </div>
      <div class="row-actions">
        <button class="top-btn primary" @click="submitForm">保存</button>
        <button class="top-btn" @click="editing = false">取消</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr><th>名称</th><th>目标路径</th><th>状态</th><th>备注</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="cf in store.configFiles" :key="cf.id" :class="{ disabled: !cf.enabled }">
            <td>{{ cf.name }}</td>
            <td class="mono">{{ cf.targetPath }}</td>
            <td>
              <span class="badge" :class="cf.enabled ? 'on' : 'off'">{{ cf.enabled ? '启用' : '停用' }}</span>
            </td>
            <td class="muted">{{ cf.note }}</td>
            <td class="row-actions">
              <button class="mini-btn" @click="startEdit(cf)">编辑</button>
              <button class="mini-btn danger" @click="removeConfigFile(cf)">删除</button>
            </td>
          </tr>
          <tr v-if="!store.configFiles.length">
            <td colspan="5" class="empty">还没有配置文件，点右上角「添加配置」</td>
          </tr>
        </tbody>
      </table>
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
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card-title {
  margin: 0;
  font-size: 16px;
}
.lead {
  color: var(--text-muted);
  font-size: 12px;
  margin-bottom: 14px;
}
.form {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: #fafbfc;
}
.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.fld-grow {
  flex: 1;
  min-width: 240px;
}
.ipt {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
  background: var(--panel);
  color: var(--text);
  min-width: 120px;
}
.mono {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
}
.ta {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  line-height: 1.5;
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
  margin-top: 18px;
}
.row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.table-wrap {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th,
.tbl td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.tbl th {
  color: var(--text-muted);
  font-weight: 600;
}
tr.disabled td {
  color: var(--text-muted);
}
.muted {
  color: var(--text-muted);
}
.badge {
  border-radius: 10px;
  padding: 2px 9px;
  font-size: 12px;
}
.badge.on {
  background: #dbeafe;
  color: var(--primary-dark);
}
.badge.off {
  background: #eef0f3;
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
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 24px 0 !important;
  white-space: normal !important;
}
</style>
