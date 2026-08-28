<script setup>
import { ref } from 'vue'
import { useDevsetupStore, emptyTool } from '../store'
import { showConfirm } from '../../../ui/dialog'

/**
 * 工具清单面板：winget / ZIP / IDEA 插件三类条目的增删改与启停。
 */
const store = useDevsetupStore()

const CATEGORY_HINTS = {
  WINGET: 'winget 包 id，如 Git.Git、Microsoft.OpenJDK.21、JetBrains.IntelliJIDEA.Community',
  ZIP: 'zip 直链（如 Maven 官方二进制包），脚本会解压到 %USERPROFILE%\\tools 并把 bin 加入 PATH',
  IDEA_PLUGIN: '插件 id：取插件页网址 https://plugins.jetbrains.com/plugin/<id> 中的数字 id',
}

const editing = ref(false)
const editingId = ref(null)
const form = ref(emptyTool())

function startAdd() {
  editingId.value = null
  form.value = emptyTool()
  editing.value = true
}

function startEdit(tool) {
  editingId.value = tool.id
  form.value = { ...emptyTool(), ...tool }
  editing.value = true
}

async function submitForm() {
  if (!form.value.name.trim() || !form.value.sourceRef.trim()) {
    return
  }
  const ok = await store.saveTool({ ...form.value, name: form.value.name.trim(), sourceRef: form.value.sourceRef.trim() }, editingId.value)
  if (ok) {
    editing.value = false
  }
}

async function removeTool(tool) {
  if (await showConfirm({ title: '删除工具', message: `确定删除「${tool.name}」？`, danger: true })) {
    store.removeTool(tool)
  }
}

const CATEGORY_LABELS = { WINGET: 'winget', ZIP: 'ZIP', IDEA_PLUGIN: 'IDEA插件' }
</script>

<template>
  <section class="card">
    <div class="head">
      <h2 class="card-title">工具清单</h2>
      <button class="top-btn primary" @click="startAdd">+ 添加工具</button>
    </div>

    <div v-if="editing" class="form">
      <div class="form-row">
        <label class="fld">
          <span>名称</span>
          <input v-model="form.name" class="ipt" placeholder="如 Git、IntelliJ IDEA">
        </label>
        <label class="fld">
          <span>安装类型</span>
          <select v-model="form.category" class="ipt">
            <option value="WINGET">WINGET（软件包）</option>
            <option value="ZIP">ZIP（绿色版直链）</option>
            <option value="IDEA_PLUGIN">IDEA 插件</option>
          </select>
        </label>
        <label v-if="form.category === 'WINGET'" class="fld">
          <span>版本（可空）</span>
          <input v-model="form.version" class="ipt" placeholder="空=最新">
        </label>
        <label class="fld fld-sort">
          <span>排序</span>
          <input v-model.number="form.sort" type="number" class="ipt">
        </label>
      </div>
      <div class="form-row">
        <label class="fld fld-grow">
          <span>{{ form.category === 'IDEA_PLUGIN' ? '插件 id' : (form.category === 'ZIP' ? 'zip 直链' : 'winget 包 id') }}</span>
          <input v-model="form.sourceRef" class="ipt" :placeholder="CATEGORY_HINTS[form.category]">
        </label>
      </div>
      <div class="hint">{{ CATEGORY_HINTS[form.category] }}</div>
      <div class="form-row">
        <label class="fld fld-grow">
          <span>备注（可选）</span>
          <input v-model="form.note" class="ipt">
        </label>
        <label class="chk"><input v-model="form.enabled" type="checkbox"> 启用</label>
      </div>
      <div class="row-actions">
        <button class="top-btn primary" @click="submitForm">保存</button>
        <button class="top-btn" @click="editing = false">取消</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr><th>名称</th><th>类型</th><th>来源 / 包 id</th><th>版本</th><th>排序</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in store.tools" :key="t.id" :class="{ disabled: !t.enabled }">
            <td>{{ t.name }}</td>
            <td>{{ CATEGORY_LABELS[t.category] || t.category }}</td>
            <td class="mono">{{ t.sourceRef }}</td>
            <td>{{ t.version || '—' }}</td>
            <td>{{ t.sort }}</td>
            <td>
              <span class="badge" :class="t.enabled ? 'on' : 'off'">{{ t.enabled ? '启用' : '停用' }}</span>
            </td>
            <td class="row-actions">
              <button class="mini-btn" @click="startEdit(t)">编辑</button>
              <button class="mini-btn" @click="store.toggleTool(t)">{{ t.enabled ? '停用' : '启用' }}</button>
              <button class="mini-btn danger" @click="removeTool(t)">删除</button>
            </td>
          </tr>
          <tr v-if="!store.tools.length">
            <td colspan="7" class="empty">还没有工具，点右上角「添加工具」，比如 Git.Git、JetBrains.IntelliJIDEA.Community、Microsoft.OpenJDK.21</td>
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
  margin-bottom: 12px;
}
.card-title {
  margin: 0;
  font-size: 16px;
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
}
.fld-grow {
  flex: 1;
  min-width: 240px;
}
.fld-sort {
  width: 90px;
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
select.ipt {
  height: 33px;
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
  margin-top: 18px;
}
.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: -4px 0 10px;
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
.mono {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
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
