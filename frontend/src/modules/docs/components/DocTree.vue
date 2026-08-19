<script setup>
import { useDocsStore } from '../store'

defineOptions({ name: 'DocTree' })

defineProps({
  nodes: { type: Array, default: () => [] },
})

const store = useDocsStore()
</script>

<template>
  <div v-for="node in nodes" :key="node.path" class="tree-item">
    <div
      class="tree-row"
      :class="{ active: node.path === store.currentPath }"
      :title="node.path"
      @click="node.type === 'dir' ? store.toggleDir(node) : store.openDoc(node.path)"
    >
      <span class="tree-caret" :class="{ open: node.type === 'dir' && store.expanded.has(node.path) }">
        {{ node.type === 'dir' ? '▶' : '' }}
      </span>
      <span class="tree-icon">
        {{ node.type === 'dir' ? (store.expanded.has(node.path) ? '📂' : '📁') : '📄' }}
      </span>
      <span class="tree-name">{{ node.name }}</span>
      <span class="tree-ops">
        <button
          v-if="node.type === 'dir'"
          class="tree-op"
          title="在此新建文档"
          @click.stop="store.newFile(node.path)"
        >📄+</button>
        <button
          v-if="node.type === 'dir'"
          class="tree-op"
          title="在此新建文件夹"
          @click.stop="store.newDir(node.path)"
        >📁+</button>
        <button class="tree-op" title="重命名" @click.stop="store.renameNode(node)">✏️</button>
        <button class="tree-op danger" title="删除" @click.stop="store.deleteNode(node)">🗑</button>
      </span>
    </div>
    <div v-if="node.type === 'dir' && store.expanded.has(node.path)" class="tree-children">
      <DocTree :nodes="node.children" />
    </div>
  </div>
</template>
