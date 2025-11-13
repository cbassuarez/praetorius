<script setup lang="ts">
import { onMounted, ref } from 'vue'
const props = withDefaults(defineProps<{ repo: string; mode?: 'highlights' | 'full' }>(), { mode: 'highlights' })
type Rel = { tag_name:string; name:string; body:string; published_at:string }
const releases = ref<Rel[]>([])
onMounted(async ()=>{
  try{
    const r = await fetch(`https://api.github.com/repos/${props.repo}/releases`)
    const j = await r.json()
    releases.value = (Array.isArray(j)? j: []).slice(0, props.mode==='highlights'? 5: 20)
  }catch{}
})
function summary(body:string){ const first = body?.split('\n').find(l=>l.trim()) || ''; return first.length>180 ? first.slice(0,177)+'…' : first }
</script>

<template>
  <div class="changelog">
    <article v-for="rel in releases" :key="rel.tag_name" class="prae-card" style="padding:12px;margin-bottom:12px;">
      <h3>{{ rel.name || rel.tag_name }}</h3>
      <p style="opacity:.9">{{ summary(rel.body || '') }}</p>
      <a :href="`https://github.com/${repo}/releases/tag/${rel.tag_name}`" target="_blank" rel="noreferrer">Full notes →</a>
    </article>
  </div>
</template>
