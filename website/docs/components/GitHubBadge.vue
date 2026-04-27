<script setup lang="ts">
const props = withDefaults(defineProps<{ repo?: string }>(), { repo: 'cbassuarez/praetorius' })
</script>

<template>
  <a class="prae-brand-callout prae-brand-callout--github" :href="`https://github.com/${props.repo}`" target="_blank" rel="noopener noreferrer" aria-label="Praetorius GitHub repository">
    <span class="prae-brand-callout-label">GitHub</span>
    <span class="prae-brand-callout-hint">{{ props.repo }}</span>
  </a>
</template>
