<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

type Skin = 'typefolio' | 'console' | 'vite-breeze'

type PageFollowMap = {
  pdfStartPage: number
  mediaOffsetSec: number
  pdfDelta?: number
  pageMap: { at: string | number; page: number }[]
}

type Work = {
  id: number | string
  slug: string
  title: string
  oneliner: string
  description?: string
  cues: { label?: string; t?: number; at?: string | number; seconds?: number }[]
  audio?: string
  audioUrl?: string
  audioId?: string
  pdf?: string
  pdfUrl?: string
  cover?: string
  duration?: number
  meta?: Record<string, unknown>
  openNote?: Array<string>
  pageFollow?: PageFollowMap
}

type PraePayload = {
  works: Work[]
  pageFollowMaps?: Record<string, PageFollowMap>
  config?: {
    theme?: 'light' | 'dark'
    site?: Record<string, unknown>
    ui?: Record<string, unknown>
  }
  ui?: {
    pageFollow?: boolean
    deepLinks?: boolean
  }
  source?: string
  seeded?: boolean
  count?: number
  schemaVersion?: string
  warnings?: string[]
}

const PRIMARY_PDF =
  'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf'
const PRIMARY_AUDIO =
  'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3'

const BASE_WORKS: readonly Work[] = Object.freeze([
  {
    id: 1,
    slug: 'demo-soundnoisemusic',
    title: 'STRING QUARTET NO. 2 — _soundnoisemusic_',
    oneliner: 'Through-composed quartet alternating fixed score, structured mischief, and noise permissions.',
    description:
      'Seb Suarez’s console demo pairs the “soundnoisemusic” quartet with an embedded PDF preview so you can try the list, open, play, and PDF commands.',
    cues: [
      { label: '@0:00', t: 0 },
      { label: '@2:10', t: 130 },
      { label: '@5:10', t: 310 }
    ],
    audio: PRIMARY_AUDIO,
    audioUrl: PRIMARY_AUDIO,
    audioId: 'wc-a1',
    pdf: PRIMARY_PDF,
    pdfUrl: PRIMARY_PDF,
    duration: 0,
    openNote: [
      'Praetorius demo work seeded from the CLI “generate” output.',
      'Use `list`, `open 1`, `play 1`, `pdf 1`, or `theme light` to explore the runtime.'
    ],
    pageFollow: {
      pdfStartPage: 1,
      mediaOffsetSec: 0,
      pageMap: [
        { at: '0:00', page: 1 },
        { at: '1:00', page: 2 },
        { at: '2:00', page: 3 },
        { at: '3:00', page: 4 },
        { at: '4:30', page: 5 }
      ]
    }
  }
])

const BASE_MODEL: Readonly<PraePayload> = Object.freeze({
  works: BASE_WORKS as Work[],
  pageFollowMaps: Object.freeze({
    'demo-soundnoisemusic': BASE_WORKS[0]?.pageFollow || {
      pdfStartPage: 1,
      mediaOffsetSec: 0,
      pageMap: []
    }
  }),
  config: Object.freeze({
    theme: 'dark',
    site: {
      fullName: 'Seb Suarez',
      listLabel: 'Seb Suarez, Works List',
      subtitle: 'Selected works with cues & notes',
      updated: { mode: 'manual', value: 'Nov 3' },
      links: [
        { label: 'More info', href: 'https://cbassuarez.com', external: true },
        { label: 'dex', href: 'https://dexdsl.org', external: true },
        { label: 'Stage Devices', href: 'https://stagedevices.com', external: true }
      ]
    }
  }),
  ui: Object.freeze({ pageFollow: true, deepLinks: true }),
  source: 'docs',
  seeded: false,
  count: BASE_WORKS.length,
  schemaVersion: '0.2.5',
  warnings: []
})

const skin = ref<Skin>('typefolio')

let moduleApi: any = null
let activeInstance: any = null
let cssChecked = false
let currentAudioIds: string[] = []
let mountCycle = 0

function resolveAsset(path: string) {
  const base = withBase('/')
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

async function ensureCss() {
  if (cssChecked || typeof document === 'undefined') return
  cssChecked = true
  const candidates = ['/prae-lib/praetorius.css', '/prae-lib/style.css']
  for (const candidate of candidates) {
    const href = resolveAsset(candidate)
    const already = Array.from(document.styleSheets).some((sheet) => {
      try {
        const sheetHref = (sheet as CSSStyleSheet).href
        return !!sheetHref && sheetHref.endsWith(candidate)
      } catch {
        return false
      }
    })
    if (already) return
    try {
      const res = await fetch(href, { method: 'HEAD' })
      if (!res.ok) continue
    } catch {
      continue
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onerror = () => link.remove()
    document.head.appendChild(link)
    return
  }
}

function unwrapApi(candidate: any): any | null {
  if (!candidate) return null
  if (typeof candidate.mount === 'function' || typeof candidate.init === 'function' || candidate.App) {
    return candidate
  }
  if (candidate.default) {
    return unwrapApi(candidate.default)
  }
  return null
}

async function loadLibrary() {
  if (moduleApi) return moduleApi
  const esmUrl = resolveAsset('/prae-lib/praetorius.es.js')
  try {
    moduleApi = await import(/* @vite-ignore */ esmUrl)
    return moduleApi
  } catch {
    moduleApi = null
  }
  const umdUrl = resolveAsset('/prae-lib/praetorius.umd.js')
  moduleApi = await loadUmd(umdUrl)
  return moduleApi
}

function loadUmd(src: string) {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('UMD load attempted during SSR'))
      return
    }
    const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script')).find((tag) => tag.src === src)
    if (existing) {
      const globalApi = (window as any).PRAE || (window as any).Praetorius || null
      if (globalApi) {
        resolve(globalApi)
        return
      }
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      const globalApi = (window as any).PRAE || (window as any).Praetorius || (window as any).Prae || null
      if (globalApi) {
        resolve(globalApi)
      } else {
        reject(new Error('UMD global not found after load'))
      }
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

function applySkinAttributes(targetSkin: Skin) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-skin', targetSkin)
  document.body?.setAttribute('data-skin', targetSkin)
  if (typeof window !== 'undefined' && (window as any).PRAE?.config) {
    const cfg = (window as any).PRAE.config
    cfg.ui = { ...(cfg.ui || {}), skin: targetSkin }
  }
}

function resetPraeState() {
  if (typeof window === 'undefined') return
  try {
    delete (window as any).__PRAE_INITED
  } catch {
    (window as any).__PRAE_INITED = undefined
  }
}

function cleanupAudioElements() {
  if (typeof document === 'undefined') return
  currentAudioIds.forEach((id) => {
    const el = document.getElementById(id)
    if (el?.parentElement) {
      el.parentElement.removeChild(el)
    }
  })
  currentAudioIds = []
}

function teardownHost(host: HTMLElement | null) {
  if (!host) return
  host.innerHTML = ''
}

function clonePayload(selectedSkin: Skin): PraePayload {
  const payload: PraePayload = JSON.parse(JSON.stringify(BASE_MODEL))
  payload.config = payload.config || { theme: 'dark', site: {} }
  payload.config.theme = payload.config.theme === 'light' ? 'light' : 'dark'
  payload.config.site = { ...(payload.config.site || {}) }
  payload.config.ui = { ...(payload.config.ui || {}), skin: selectedSkin }
  payload.ui = { pageFollow: true, deepLinks: true }
  payload.source = payload.source || 'docs'
  payload.seeded = !!payload.seeded
  payload.schemaVersion = payload.schemaVersion || '0.2.5'
  const works = Array.isArray(payload.works) ? payload.works.map((work, index) => {
    const clone: Work = { ...work }
    const numericId = Number.isFinite(Number(clone.id)) ? Number(clone.id) : index + 1
    clone.id = numericId
    clone.slug = (clone.slug && String(clone.slug).trim()) || `work-${numericId}`
    if (!Array.isArray(clone.cues)) clone.cues = []
    clone.audioId = clone.audioId || `wc-a${numericId}`
    const audioSrc = clone.audioUrl || clone.audio || ''
    if (audioSrc) {
      clone.audioUrl = audioSrc
      clone.audio = audioSrc
    }
    const pdfSrc = clone.pdfUrl || clone.pdf || ''
    if (pdfSrc) {
      clone.pdfUrl = pdfSrc
      clone.pdf = pdfSrc
    }
    if (clone.pageFollow && !Array.isArray(clone.pageFollow.pageMap)) {
      clone.pageFollow.pageMap = []
    }
    return clone
  }) : []
  const pageFollowMaps: Record<string, PageFollowMap> = {}
  works.forEach((work) => {
    if (work.slug && work.pageFollow) {
      pageFollowMaps[work.slug] = work.pageFollow
    }
  })
  if (payload.pageFollowMaps) {
    for (const [slug, map] of Object.entries(payload.pageFollowMaps)) {
      if (!pageFollowMaps[slug]) {
        pageFollowMaps[slug] = map
      }
    }
  }
  payload.works = works
  payload.pageFollowMaps = pageFollowMaps
  payload.count = works.length
  return payload
}

function primeWorkModel(selectedSkin: Skin) {
  if (typeof window === 'undefined') return null
  const payload = clonePayload(selectedSkin)
  const works = payload.works || []
  const worksById: Record<string | number, Work> = {}
  const audioIds: string[] = []
  const ensureAudioTags = () => {
    if (typeof document === 'undefined') return
    const container = document.querySelector('#works-console') || document.body
    if (!container) return
    for (const work of works) {
      const id = work.audioId || `wc-a${work.id}`
      const src = work.audioUrl || work.audio || ''
      if (!id || !src) continue
      let audio = document.getElementById(id) as HTMLAudioElement | null
      if (!audio) {
        audio = document.createElement('audio')
        audio.id = id
        audio.preload = 'none'
        audio.setAttribute('playsinline', '')
        audio.dataset.audio = src
        container.appendChild(audio)
      } else {
        audio.dataset.audio = src
      }
    }
  }
  works.forEach((work) => {
    worksById[work.id] = work
    audioIds.push(work.audioId || `wc-a${work.id}`)
  })
  currentAudioIds = audioIds
  const g = window as any
  g.__PRAE_DATA__ = payload
  g.PRAE = g.PRAE || {}
  g.PRAE.works = works
  g.PRAE.worksById = worksById
  g.PRAE.pageFollowMaps = payload.pageFollowMaps || {}
  g.PRAE.ensureAudioTags = ensureAudioTags
  g.PRAE.config = g.PRAE.config || {}
  g.PRAE.config.theme = payload.config?.theme || 'dark'
  g.PRAE.config.site = payload.config?.site || {}
  g.PRAE.config.ui = { ...(g.PRAE.config.ui || {}), skin: selectedSkin }
  g.PRAE.ui = { pageFollow: payload.ui?.pageFollow !== false, deepLinks: payload.ui?.deepLinks !== false }
  g.PRAE.warnings = Array.isArray(payload.warnings) ? payload.warnings.slice() : []
  return { payload, works }
}

async function mountConsole() {
  if (typeof window === 'undefined') return
  const host = document.getElementById('prae-host')
  if (!host) return
  const cycle = ++mountCycle
  cleanupAudioElements()
  teardownHost(host)
  resetPraeState()
  primeWorkModel(skin.value)
  await ensureCss()
  const mod = await loadLibrary()
  const api = unwrapApi(mod)
  if (!api) {
    throw new Error('Praetorius library mount function not found')
  }
  const mountFn = typeof api.mount === 'function' ? api.mount : null
  const initFn = !mountFn && typeof api.init === 'function' ? api.init : null
  const AppCtor = !mountFn && !initFn ? api.App : null
  activeInstance = null
  if (mountFn) {
    await mountFn(host, { skin: skin.value })
  } else if (initFn) {
    await initFn(host, { skin: skin.value })
  } else if (typeof AppCtor === 'function') {
    const app = new AppCtor({ skin: skin.value })
    if (typeof app?.mount === 'function') {
      await app.mount(host)
    }
    activeInstance = app
  } else {
    throw new Error('Praetorius mount API unavailable')
  }
  applySkinAttributes(skin.value)
  try {
    (window as any).PRAE?.ensureAudioTags?.()
  } catch {}
  if (document.readyState !== 'loading') {
    document.dispatchEvent(new Event('DOMContentLoaded'))
  }
  if (cycle !== mountCycle) {
    return
  }
}

async function remountForSkin() {
  if (typeof window === 'undefined') return
  try {
    const mod = await loadLibrary()
    const api = unwrapApi(mod)
    if (api?.setSkin && activeInstance) {
      try {
        api.setSkin(activeInstance, skin.value)
        applySkinAttributes(skin.value)
        return
      } catch {
        /* noop – fall through to full remount */
      }
    }
  } catch {
    /* ignore and fallback to full remount */
  }
  await mountConsole()
}

onMounted(async () => {
  await nextTick()
  try {
    await mountConsole()
  } catch (err) {
    console.error('[PraeConsoleExact] mount failed', err)
  }
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  const host = document.getElementById('prae-host')
  cleanupAudioElements()
  teardownHost(host)
  resetPraeState()
})

watch(skin, () => {
  void remountForSkin()
})
</script>

<template>
  <div class="prae-exact">
    <div class="toolbar">
      <label>Skin
        <select v-model="skin" aria-label="Skin">
          <option value="typefolio">Typefolio</option>
          <option value="console">Console</option>
          <option value="vite-breeze">Vite-Breeze</option>
        </select>
      </label>
    </div>
    <div id="prae-host" class="prae-host" />
  </div>
</template>

<style scoped>
.prae-exact {
  display: grid;
  gap: 12px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.prae-host {
  min-height: 60vh;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
</style>
