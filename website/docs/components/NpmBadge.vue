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
  <a class="prae-brand-callout prae-brand-callout--npm" :href="`https://www.npmjs.com/package/${encodeURIComponent(props.pkg)}`" target="_blank" rel="noopener noreferrer" aria-label="Praetorius npm package">
    <span class="prae-brand-callout-label">npm</span>
    <span class="prae-brand-callout-hint">
      <template v-if="version">v{{ version }}</template>
      <template v-else>package</template>
    </span>
  </a>
</template>
