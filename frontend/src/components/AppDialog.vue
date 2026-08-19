<script setup>
import { useDialog, dialogOk, dialogCancel } from '../ui/dialog'

const dialog = useDialog()

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    dialogCancel()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    dialogOk()
  }
}
</script>

<template>
  <div v-if="dialog.visible" class="modal" @keydown="onKeydown">
    <div class="modal-card">
      <div class="modal-title">{{ dialog.title }}</div>
      <div v-if="dialog.message" class="modal-message">{{ dialog.message }}</div>
      <input
        v-if="dialog.showInput"
        id="modal-input"
        v-model="dialog.value"
        class="modal-input"
        type="text"
        autocomplete="off"
        :placeholder="dialog.placeholder"
      >
      <div class="modal-actions">
        <button class="top-btn" @click="dialogCancel">取消</button>
        <button class="top-btn" :class="{ primary: !dialog.danger, danger: dialog.danger }" @click="dialogOk">
          {{ dialog.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
