<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Always pass a STRING URL to pdf.js worker (fixes "Invalid workerSrc type")
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// UMD + CSS candidates
const UMD_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.umd.js',
  'https://unpkg.com/praetorius@latest/dist/praetorius.umd.js'
]
const CSS_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.css',
  'https://unpkg.com/praetorius@latest/dist/praetorius.css'
]

// Works JSON (served from docs/public/samples/)
const WORKS_URL = 'samples/works.playground.json'

type Skin = 'typefolio' | 'console' | 'vite-breeze'
const skin = ref<Skin>('typefolio')
const pageFollow = ref(true)
let prae: any = null

const loading = ref(true)
const err = ref<string | null>(null)

function addCssWithFallback(urls: string[]) {
  if (document.getElementById('prae-css')) return
  const link = document.createElement('link')
  link.id = 'prae-css'
  link.rel = 'stylesheet'
  link.href = urls[0]
  link.crossOrigin = 'anonymous'
  link.onerror = () => {
    if (urls[1]) link.href = urls[1]
  }
  document.head.appendChild(link)
}
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(s)
  })
}
async function loadFirst(urls: string[]) {
  let last: any
  for (const u of urls) { try { await loadScript(u); return u } catch (e) { last = e } }
  throw last || new Error('All script candidates failed')
}
function parseTime(q: string | null) {
  if (!q) return 0
  if (/^\d+(\.\d+)?$/.test(q)) return Number(q)
  const m = q.split(':').map(Number)
  if (m.length === 2) return (m[0]||0)*60 + (m[1]||0)
  if (m.length === 3) return (m[0]||0)*3600 + (m[1]||0)*60 + (m[2]||0)
  return 0
}

async function mountPrae() {
  // Robust worker wiring
  ;(window as any).PDFJS_GLOBAL_WORKER_OPTIONS = { workerSrc: pdfWorkerUrl }

  // Preflight JSON with GET (HEAD can be flaky on static hosts)
  const probe = await fetch(WORKS_URL, { method: 'GET', cache: 'no-store' })
  if (!probe.ok) throw new Error(`works JSON not found at ${new URL(WORKS_URL, location.href)} (${probe.status})`)

  // Ensure CSS without touching existing link.href
  addCssWithFallback(CSS_CANDIDATES)

  // Load UMD → window.PRAE
  const used = await loadFirst(UMD_CANDIDATES)
  // console.debug('PRAE UMD loaded from', used)

  const PRAE = (window as any).PRAE
  if (!PRAE) throw new Error('window.PRAE not found after UMD load')

  const qs = new URLSearchParams(location.search)
  const initial = {
    work: qs.get('work') || undefined,
    page: Math.max(1, Number(qs.get('page') || 0) || 1),
    time: parseTime(qs.get('time'))
  }

  const host = document.getElementById('prae-host')!
  const opts = {
    worksUrl: WORKS_URL,
    skin: skin.value,
    pageFollow: pageFollow.value,
    pdfWorkerSrc: pdfWorkerUrl,
    deepLinking: true,
    initial
  }

  if (typeof PRAE.mount === 'function') {
    prae = await PRAE.mount(host, opts)
  } else if (typeof PRAE.init === 'function') {
    prae = await PRAE.init(host, opts)
  } else if (PRAE?.App) {
    prae = new PRAE.App(opts); await prae.mount?.(host)
  } else {
    throw new Error('Unsupported PRAE UMD API surface (no mount/init/App)')
  }
}

async function remountWith(next: Partial<{ skin: Skin; pageFollow: boolean }>) {
  try {
    if (prae?.setOption) {
      if (next.skin !== undefined) prae.setOption('skin', next.skin)
      if (next.pageFollow !== undefined) prae.setOption('pageFollow', next.pageFollow)
      return
    }
    if (prae?.setSkin && next.skin !== undefined) { prae.setSkin(next.skin); return }
    // hard remount if APIs aren’t present
    const host = document.getElementById('prae-host')!
    host.innerHTML = ''
    if (next.skin !== undefined) skin.value = next.skin
    if (next.pageFollow !== undefined) pageFollow.value = next.pageFollow
    await mountPrae()
  } catch (e:any) { err.value = String(e?.message || e) }
}

onMounted(async () => {
  try { await mountPrae() }
  catch (e:any) { err.value = String(e?.message || e) }
  finally { loading.value = false }
})
</script>

<template>
  <div class="runtime">
    <div class="toolbar">
      <label>Skin
        <select v-model="skin" @change="remountWith({ skin })" aria-label="Skin">
          <option value="typefolio">Typefolio</option>
          <option value="console">Console</option>
          <option value="vite-breeze">Vite-Breeze</option>
        </select>
      </label>
      <label class="pf"><input type="checkbox" v-model="pageFollow" @change="remountWith({ pageFollow })" /> Page-follow</label>
      <span v-if="loading" class="muted">Loading…</span>
      <span v-else-if="!err" class="muted">Ready</span>
      <span v-else class="error">Error: {{ err }}</span>
    </div>

    <div id="prae-host" class="host" aria-label="Praetorius viewer host"></div>

    <div v-if="err" class="overlay">
      <strong>Playground failed to mount.</strong>
      <div>{{ err }}</div>
      <div style="margin-top:.5rem;">Resolved URL: <code>{{ new URL('samples/works.playground.json', location.href).toString() }}</code></div>
      <ol>
        <li>Confirm <code>docs/public/samples/works.playground.json</code> exists and is valid JSON.</li>
        <li>DevTools → Network: ensure one <code>praetorius.umd.js</code> loads (200).</li>
        <li>Audio/PDF come from public-domain hosts; they may require a click to start.</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.runtime{ display:grid; gap:12px }
.toolbar{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.muted{ opacity:.7 }
.error{ color:#b00020 }
.host{ min-height:520px; border:1px solid var(--vp-c-divider); border-radius:12px; overflow:hidden; background:var(--vp-c-bg-alt) }
.overlay{
  margin-top:8px; padding:10px; border:1px solid var(--vp-c-divider);
  border-radius:12px; background: color-mix(in oklab, var(--vp-c-bg), transparent 70%);
}
</style>
