<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ pkg?: string }>(), { pkg: 'praetorius' })
const version = ref<string | null>(null)

onMounted(async () => {
  try {
    const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(props.pkg)}/latest`)
    if (r.ok) {
      const j = await r.json()
      version.value = j.version ?? null
    }
  } catch {}
})
</script>

<template>
  <span>npm <b v-if="version">v{{ version }}</b></span>
</template>
