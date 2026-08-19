<script setup>
import { useToast } from '../ui/toast'

const toast = useToast()
</script>

<template>
  <div v-if="toast.visible" class="toast" :class="{ error: toast.error }">{{ toast.message }}</div>
</template>
