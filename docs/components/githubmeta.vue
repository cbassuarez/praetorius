<script setup lang="ts">
import { onMounted, ref } from 'vue'
const props = defineProps<{ repo: string }>()
const stars = ref<number|null>(null)
const latest = ref<string|null>(null)
onMounted(async () => {
  try { const r = await fetch(`https://api.github.com/repos/${props.repo}`); const j = await r.json(); stars.value = j.stargazers_count ?? null } catch{}
  try { const r = await fetch(`https://api.github.com/repos/${props.repo}/releases/latest`); const j = await r.json(); latest.value = j.tag_name ?? null } catch{}
})
</script>

<template>
  <div style="display:flex;gap:.75rem;opacity:.9">
    <span v-if="stars!==null">⭐️ {{ stars.toLocaleString() }}</span>
    <span v-if="latest">Latest: {{ latest }}</span>
  </div>
</template>
