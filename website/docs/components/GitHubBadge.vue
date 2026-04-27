<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ repo?: string }>(), { repo: 'cbassuarez/praetorius' })
const repoUrl = computed(() => `https://github.com/${props.repo}`)
const homepage = ref<string | null>(null)

onMounted(async () => {
  try {
    const r = await fetch(`https://api.github.com/repos/${props.repo}`)
    if (r.ok) {
      const j = await r.json()
      const url = String(j?.homepage || '').trim()
      if (url) homepage.value = url
    }
  } catch {}
})

const href = computed(() => homepage.value || repoUrl.value)
</script>

<template>
  <a class="prae-brand-callout prae-brand-callout--github" :href="href" target="_blank" rel="noopener noreferrer" aria-label="Praetorius project homepage">
    <svg class="prae-brand-callout-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.94 10.94 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
    </svg>
    <span class="prae-brand-callout-label">GitHub</span>
    <span class="prae-brand-callout-hint">{{ props.repo }}</span>
  </a>
</template>
