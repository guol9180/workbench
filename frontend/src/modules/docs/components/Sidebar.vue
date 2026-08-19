<script setup>
import { ref } from 'vue'
import { useDocsStore } from '../store'
import DocTree from './DocTree.vue'
import SearchResults from './SearchResults.vue'

const store = useDocsStore()
const query = ref('')

function search() {
  store.doSearch(query.value)
}
</script>

<template>
  <aside class="sidebar">
    <div class="search-row">
      <input
        v-model="query"
        type="search"
        placeholder="搜索文档…"
        @keydown.enter="search"
      >
      <button class="icon-btn" title="搜索" @click="search">🔍</button>
    </div>

    <div v-if="!store.searching" class="tree-panel">
      <div class="tree-actions">
        <button class="mini-btn" title="在根目录新建文档" @click="store.newFile('')">📄 新文档</button>
        <button class="mini-btn" title="在根目录新建文件夹" @click="store.newDir('')">📁 新文件夹</button>
        <button class="icon-btn" title="刷新" @click="store.loadTree()">⟳</button>
      </div>
      <div class="tree-container">
        <div v-if="!store.tree || !store.tree.children || store.tree.children.length === 0" class="tree-empty">
          文档库为空，点击「新文档」开始
        </div>
        <DocTree v-else :nodes="store.tree.children" />
      </div>
    </div>

    <SearchResults v-else />
  </aside>
</template>
