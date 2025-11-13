<script setup lang="ts">
import { onMounted, ref } from 'vue'
const props = defineProps<{ pkg: string }>()
const version = ref<string|null>(null)
onMounted(async () => {
  try { const r = await fetch(`https://registry.npmjs.org/${props.pkg}/latest`); const j = await r.json(); version.value = j.version ?? null } catch{}
})
</script>

<template>
  <span>npm <b v-if="version">v{{ version }}</b></span>
</template>
