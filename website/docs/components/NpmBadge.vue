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
    <svg class="prae-brand-callout-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M2 8h20v8h-10v2H8v-2H2V8zm2 6h4v-4h2v4h2V10h-8v4zm10-4v6h2v-4h2v4h2V10h-6z"/>
    </svg>
    <span class="prae-brand-callout-label">npm</span>
    <span class="prae-brand-callout-hint">
      <template v-if="version">v{{ version }}</template>
      <template v-else>package</template>
    </span>
  </a>
</template>
