<script setup>
import { useDocsStore } from '../store'

const store = useDocsStore()
</script>

<template>
  <div class="search-results">
    <div class="search-results-head">
      <span>{{ store.searchSummary }}</span>
      <button class="mini-btn" @click="store.backToTree()">← 返回</button>
    </div>
    <div class="search-list">
      <div v-if="store.searchResults.length === 0" class="tree-empty">没有匹配的文档</div>
      <div
        v-for="hit in store.searchResults"
        :key="hit.path"
        class="search-hit"
        @click="store.openSearchHit(hit.path)"
      >
        <div class="search-hit-path">{{ hit.path }}</div>
        <div class="search-hit-snippet">{{ hit.snippet || '' }}</div>
      </div>
    </div>
  </div>
</template>
