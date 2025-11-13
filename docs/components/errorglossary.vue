<script setup lang="ts">
const props = defineProps<{ items: { code:string; title:string; cause:string; fix:string }[] }>()
</script>

<template>
  <div class="errors">
    <details v-for="e in items" :key="e.code" class="prae-card" style="padding:12px;margin-bottom:12px;">
      <summary><b>{{ e.title }}</b> <small style="opacity:.7">({{ e.code }})</small></summary>
      <p><b>Cause:</b> {{ e.cause }}</p>
      <p><b>Fix:</b> {{ e.fix }}</p>
    </details>
  </div>
</template>
