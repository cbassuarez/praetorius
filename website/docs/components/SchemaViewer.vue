<script setup lang="ts">
import { onMounted, ref } from 'vue'
const props = defineProps<{ src: string }>()
const json = ref<any>(null)
onMounted(async ()=>{ try{ const r=await fetch(props.src); json.value = await r.json() }catch{ json.value = { error:'Schema unavailable' } } })
</script>

<template>
  <div class="prae-card" style="padding:12px;">
    <pre v-if="json"><code>{{ JSON.stringify(json, null, 2) }}</code></pre>
  </div>
</template>
