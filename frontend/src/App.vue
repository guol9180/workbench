<script setup>
import AppDialog from './components/AppDialog.vue'
import AppToast from './components/AppToast.vue'
</script>

<template>
  <router-view />
  <AppDialog />
  <AppToast />
</template>
