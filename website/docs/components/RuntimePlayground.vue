<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Use a STRING URL for the pdf.js worker (fixes "Invalid workerSrc type")
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// UMD candidates (loads first that succeeds)
const UMD_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.umd.js',
  'https://unpkg.com/praetorius@latest/dist/praetorius.umd.js'
]
const CSS_CANDIDATES = [
  'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.css',
  'https://unpkg.com/praetorius@latest/dist/praetorius.css'
]

// Works JSON — resolve RELATIVE to the current page so /praetorius/ subpath always works
 const WORKS_URL = 'samples/works.playground.json'
 const RESOLVED = new URL(WORKS_URL, location.href).toString()

type Skin = 'typefolio' | 'console' | 'vite-breeze'
const skin = ref<Skin>('typefolio')
const pageFollow = ref(true)
let prae: any = null

// simple UI state + error surface
const loading = ref(true)
const err = ref<string | null>(null)
const log = (...a: any[]) => { try{ console.debug('[playground]', ...a) }catch{} }

function ensureCss(href: string) {
  if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some(l => l.href.includes('praetorius'))) return
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link)
}
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src; s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(s)
  })
}
async function tryLoadAny(urls: string[]) {
  let lastErr: any
  for (const url of urls) {
    try { await loadScript(url); return url } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('All candidates failed to load')
}

function parseTime(q: string | null) {
  if (!q) return 0
  if (/^\d+(\.\d+)?$/.test(q)) return Number(q)
  const m = q.split(':').map(Number)
  if (m.length === 2) return (m[0] || 0) * 60 + (m[1] || 0)
  if (m.length === 3) return (m[0] || 0) * 3600 + (m[1] || 0) * 60 + (m[2] || 0)
  return 0
}

async function mountPrae() {
  // pdf.js worker (string URL)
  ;(window as any).PDFJS_GLOBAL_WORKER_OPTIONS = { workerSrc: pdfWorkerUrl }

  // preflight with GET (HEAD can be quirky on some static hosts)
  const probe = await fetch(WORKS_URL, { method: 'GET', cache: 'no-store' })
  if (!probe.ok) throw new Error(`works JSON not found at ${RESOLVED} (${probe.status})`)

  // deep-link state
  const qs = new URLSearchParams(location.search)
  const initial = {
    work: qs.get('work') || undefined,
    page: Math.max(1, Number(qs.get('page') || 0) || 1),
    time: parseTime(qs.get('time')),
  }

  // ensure CSS (harmless if bundle already styles itself)
  try { await tryLoadAny(CSS_CANDIDATES) } catch {}

  // load UMD → window.PRAE
  const used = await tryLoadAny(UMD_CANDIDATES)
  log('PRAE UMD loaded from', used)
  const PRAE = (window as any).PRAE
  if (!PRAE) throw new Error('window.PRAE not found after UMD load')

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
    // hard remount
    const host = document.getElementById('prae-host')!
    host.innerHTML = ''
    if (next.skin !== undefined) skin.value = next.skin
    if (next.pageFollow !== undefined) pageFollow.value = next.pageFollow
    await mountPrae()
  } catch (e:any) { err.value = String(e?.message || e); log(e) }
}

onMounted(async () => {
  try {
    await mountPrae()
  } catch (e:any) {
    err.value = String(e?.message || e)
    log('mount error', e)
  } finally {
    loading.value = false
  }
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
        <li>Ensure <code>docs/public/samples/works.playground.json</code> exists and is valid JSON.</li>
        <li>Open DevTools → Network: verify <code>praetorius.umd.js</code> loads (200).</li>
        <li>(Optional) Verify <code>base</code> in <code>config.ts</code> is <code>/praetorius/</code> for other assets.</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.runtime{ display:grid; gap:12px }
.toolbar{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.muted{ opacity:.7 }
.error{ color: #b00020 }
.host{ min-height: 520px; border:1px solid var(--vp-c-divider); border-radius:12px; overflow:hidden; background: var(--vp-c-bg-alt) }
.overlay{
  margin-top:8px; padding:10px; border:1px solid var(--vp-c-divider);
  border-radius:12px; background: color-mix(in oklab, var(--vp-c-bg), transparent 70%);
}
</style>
