<script setup lang="ts">
// EAGER real PRAE runtime + robust pdf.js workerSrc (string URL)
import { onMounted, ref } from 'vue'

// IMPORTANT: use a URL string, not a Worker object → fixes "Invalid workerSrc type"
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// CDN for the UMD build (global window.PRAE). Latest per your preference.
const PRAE_UMD = 'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.umd.js'
// Optional: CSS from the package if your UMD does not inject styles.
const PRAE_CSS = 'https://cdn.jsdelivr.net/npm/praetorius@latest/dist/praetorius.css'

// Works data (robust: lives under docs/public/samples/)
const BASE = (import.meta as any).env?.BASE_URL || '/'
const WORKS_URL = new URL('samples/works.playground.json', new URL(BASE, location.href)).toString()

type Skin = 'typefolio' | 'console' | 'vite-breeze'
const skin = ref<Skin>('typefolio')
const pageFollow = ref(true)

let praeInstance: any = null

function parseTime(q: string | null) {
  if (!q) return 0
  if (/^\d+(\.\d+)?$/.test(q)) return Number(q)
  const m = q.split(':').map(Number)
  if (m.length === 2) return (m[0] || 0) * 60 + (m[1] || 0)
  if (m.length === 3) return (m[0] || 0) * 3600 + (m[1] || 0) * 60 + (m[2] || 0)
  return 0
}
function buildLink() {
  const url = new URL(location.href)
  const state = (praeInstance?.getState?.() ?? {}) as { page?: number; time?: number; work?: string }
  if (state.page) url.searchParams.set('page', String(state.page))
  if (typeof state.time === 'number') url.searchParams.set('time', String(Math.round(state.time)))
  if (state.work) url.searchParams.set('work', state.work)
  navigator.clipboard.writeText(url.toString())
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(el)
  })
}
function ensureCss(href: string) {
  if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some(l => l.href.includes(href))) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

async function mountPrae() {
  // Use docs’ pdfjs worker as a string URL (robust across VitePress/GH Pages)
  ;(window as any).PDFJS_GLOBAL_WORKER_OPTIONS = { workerSrc: pdfWorkerUrl }

  // Initial deep-link
  const qs = new URLSearchParams(location.search)
  const initial = {
    work: qs.get('work') || undefined,
    page: Math.max(1, Number(qs.get('page') || 0) || 1),
    time: parseTime(qs.get('time')),
  }

  const host = document.getElementById('prae-host')!

  // Two init strategies to be robust to API surface differences:
  const PRAE = (window as any).PRAE
  const opts = {
    worksUrl: WORKS_URL,
    skin: skin.value,
    pageFollow: pageFollow.value,
    pdfWorkerSrc: pdfWorkerUrl,     // preferred explicit wire-up
    deepLinking: true,
    initial,
    basePath: BASE                  // helps with subpath deployments (/praetorius/)
  }

  if (typeof PRAE?.mount === 'function') {
    praeInstance = await PRAE.mount(host, opts)
  } else if (typeof PRAE?.init === 'function') {
    praeInstance = await PRAE.init(host, opts)
  } else if (PRAE?.App) {
    praeInstance = new PRAE.App(opts)
    await praeInstance.mount?.(host)
  } else {
    throw new Error('PRAE UMD API not found on window.PRAE')
  }
}

async function remountWith(options: Partial<{ skin: Skin; pageFollow: boolean }>) {
  // Prefer live updates if exposed; otherwise fall back to re-mount
  if (praeInstance?.setOption) {
    if (options.skin !== undefined) praeInstance.setOption('skin', options.skin)
    if (options.pageFollow !== undefined) praeInstance.setOption('pageFollow', options.pageFollow)
    return
  }
  if (praeInstance?.setSkin && options.skin !== undefined) {
    praeInstance.setSkin(options.skin)
  } else {
    // Full re-mount for maximum compatibility
    if (options.skin !== undefined) skin.value = options.skin
    if (options.pageFollow !== undefined) pageFollow.value = options.pageFollow
    const host = document.getElementById('prae-host')!
    host.innerHTML = ''
    await mountPrae()
  }
}

onMounted(async () => {
  ensureCss(PRAE_CSS) // harmless if UMD already styles itself
  await loadScript(PRAE_UMD)
  await mountPrae()
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

      <label class="pf">
        <input type="checkbox" v-model="pageFollow" @change="remountWith({ pageFollow })" />
        Page-follow
      </label>

      <button class="link" @click="buildLink">Copy deep link</button>
    </div>

    <div id="prae-host" class="host" aria-label="Praetorius viewer host"></div>
  </div>
</template>

<style scoped>
.runtime{ display:grid; gap:12px }
.toolbar{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.host{ min-height: 420px; border:1px solid var(--vp-c-divider); border-radius:12px; overflow:hidden }
</style>
