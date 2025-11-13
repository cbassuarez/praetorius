<script setup lang="ts">
import { onMounted, ref } from 'vue'
// Show a NEW badge if the page's "since" version is newer than the user's last seen
const props = defineProps<{ since: string }>()
const show = ref(false)
const KEY = 'prae:lastSeenRelease'
function parseTag(t:string){ return t.replace(/^v/,'').split('.').map(n=>+n||0) }
function compare(a:string,b:string){ const A=parseTag(a), B=parseTag(b); for (let i=0;i<3;i++){ if ((A[i]??0)!==(B[i]??0)) return (A[i]??0)>(B[i]??0)?1:-1 } return 0 }
onMounted(async ()=>{
  try{
    const r = await fetch('https://api.github.com/repos/cbassuarez/praetorius/releases/latest')
    const j = await r.json()
    const latest = j.tag_name || 'v0.0.0'
    const seen = localStorage.getItem(KEY) || 'v0.0.0'
    show.value = compare(latest, seen) > 0 && compare(props.since, seen) > 0
    // record latest when user visits Changelog page
    if (location.pathname.endsWith('/changelog')) localStorage.setItem(KEY, latest)
  }catch{}
})
</script>

<template>
  <span v-if="show" style="display:inline-block;margin-left:.5rem;padding:.1rem .4rem;border-radius:8px;border:1px solid var(--vp-c-divider);font-size:.85em;">NEW</span>
</template>
