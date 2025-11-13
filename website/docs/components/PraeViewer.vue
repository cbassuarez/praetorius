<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

import type { Skin } from '../skins/registry'
import { SKINS } from '../skins/registry'

type SrcPair = {
  primary: string
  fallback?: string
}

const props = withDefaults(defineProps<{
  pdf: string
  audio: string
  fallbackPdf?: string
  fallbackAudio?: string
  initialPage?: number
  initialSkin?: Skin
}>(), {
  initialPage: 1,
  fallbackPdf: undefined,
  fallbackAudio: undefined,
  initialSkin: 'typefolio'
})

const viewerRoot = ref<HTMLElement | null>(null)
const hudSlot = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)

const loading = ref(true)
const rendering = ref(false)
const ready = ref(false)
const error = ref<string | null>(null)
const pageCount = ref(0)
const currentPage = ref(Math.max(1, props.initialPage || 1))
const audioSource = ref('')
const audioDuration = ref(0)
const audioTime = ref(0)
const isPlaying = ref(false)
const pageFollowEnabled = ref(false)
const selectedSkin = ref<Skin>(props.initialSkin)
const usingLibraryHud = ref(false)
const copyFeedback = ref('')

const audioTimeRounded = computed(() => Math.max(0, Math.round(audioTime.value)))
const formattedElapsed = computed(() => formatTime(audioTime.value))
const formattedRemaining = computed(() => formatTime(Math.max(0, audioDuration.value - audioTime.value)))
const canPrev = computed(() => currentPage.value > 1)
const canNext = computed(() => pageCount.value > 0 && currentPage.value < pageCount.value)

let pdfDoc: any = null
let renderTask: any = null
let destroyed = false
let pdfjsCache: any = null
let hudCleanup: (() => void) | null = null
let copyTimeout: ReturnType<typeof setTimeout> | null = null
let lastFollowPage = 0
let queryReady = false
let lastQueryTime = -1

const skinEntries = Object.entries(SKINS) as [Skin, typeof SKINS[Skin]][]

function resolveAsset(value?: string) {
  if (!value) return ''
  if (/^(?:[a-z]+:)?\/\//i.test(value)) return value
  const normalized = value.startsWith('/') ? value : `/${value}`
  return withBase(normalized)
}

async function ensurePdfJs() {
  if (pdfjsCache) return pdfjsCache
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker?worker')
  ])
  const pdfModule = pdfjs as any
  const lib = typeof pdfModule?.getDocument === 'function'
    ? pdfModule
    : typeof pdfModule?.default?.getDocument === 'function'
      ? pdfModule.default
      : pdfModule?.default || pdfModule

  if (!lib || typeof lib.getDocument !== 'function') {
    throw new Error('Failed to load pdfjs-dist')
  }

  const workerSrc = (worker as any)?.default
  if (workerSrc) {
    const globalOptions = lib.GlobalWorkerOptions || pdfModule.GlobalWorkerOptions
    if (globalOptions) {
      if (typeof workerSrc === 'string') {
        globalOptions.workerSrc = workerSrc
      } else if (typeof Worker !== 'undefined') {
        try {
          const workerInstance = workerSrc instanceof Worker ? workerSrc : new workerSrc()
          if (workerInstance) {
            globalOptions.workerPort = workerInstance
          }
        } catch (err) {
          console.warn('Unable to instantiate pdf.js worker', err)
        }
      }
    }
  }

  pdfjsCache = lib
  return lib
}

async function loadPdfDocument(src: SrcPair) {
  const pdfjs = await ensurePdfJs()
  const attempts = [src.primary]
  if (src.fallback && src.fallback !== src.primary) attempts.push(src.fallback)
  let lastError: unknown = null

  for (const candidate of attempts) {
    if (!candidate) continue
    try {
      const url = resolveAsset(candidate)
      const task = pdfjs.getDocument(url)
      const doc = await task.promise
      return doc
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Unable to load PDF document')
}

async function renderPage(pageNumber: number) {
  if (!pdfDoc || destroyed) return
  const canvas = canvasEl.value
  if (!canvas) throw new Error('Canvas element not ready')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to get 2D context from canvas')

  const target = Math.min(Math.max(1, Math.floor(pageNumber)), pageCount.value || 1)
  if (currentPage.value === target && !rendering.value && !renderTask) return

  rendering.value = true
  try {
    if (renderTask?.cancel) renderTask.cancel()
    const page = await pdfDoc.getPage(target)
    const viewport = page.getViewport({ scale: 1.2 })
    canvas.height = viewport.height
    canvas.width = viewport.width
    renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    if (!destroyed) {
      currentPage.value = target
      ready.value = true
    }
  } finally {
    renderTask = null
    rendering.value = false
  }
}

function resetAudioSource() {
  const primary = resolveAsset(props.audio)
  const fallback = resolveAsset(props.fallbackAudio)
  audioSource.value = primary || fallback || ''
}

function onAudioError() {
  if (!props.fallbackAudio) return
  const fallback = resolveAsset(props.fallbackAudio)
  if (!fallback || audioSource.value === fallback) return
  audioSource.value = fallback
}

function attachAudioListeners(audio: HTMLAudioElement | null) {
  detachAudioListeners()
  if (!audio) return

  const onLoaded = () => {
    audioDuration.value = Number.isFinite(audio.duration) ? Math.max(audio.duration, 0) : 0
  }
  const onTime = () => {
    audioTime.value = Math.max(0, audio.currentTime || 0)
    if (pageFollowEnabled.value) {
      void syncPageToAudio()
    }
  }
  const onPlay = () => { isPlaying.value = true }
  const onPause = () => { isPlaying.value = false }
  const onEnd = () => { isPlaying.value = false }

  audio.addEventListener('loadedmetadata', onLoaded)
  audio.addEventListener('durationchange', onLoaded)
  audio.addEventListener('timeupdate', onTime)
  audio.addEventListener('seeking', onTime)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('ended', onEnd)

  audioListeners = [
    ['loadedmetadata', onLoaded],
    ['durationchange', onLoaded],
    ['timeupdate', onTime],
    ['seeking', onTime],
    ['play', onPlay],
    ['pause', onPause],
    ['ended', onEnd]
  ]

  if (audio.readyState >= 1) onLoaded()
  if (!audio.paused) onPlay()
}

let audioListeners: [keyof HTMLMediaElementEventMap, EventListener][] = []

function detachAudioListeners() {
  const audio = audioEl.value
  if (audio && audioListeners.length) {
    for (const [event, handler] of audioListeners) {
      audio.removeEventListener(event, handler)
    }
  }
  audioListeners = []
}

async function bootstrap(initialPage?: number) {
  if (destroyed) return
  loading.value = true
  error.value = null
  pageCount.value = 0
  ready.value = false

  try {
    if (pdfDoc?.destroy) {
      try { pdfDoc.destroy() } catch { /* noop */ }
    }

    pdfDoc = await loadPdfDocument({ primary: props.pdf, fallback: props.fallbackPdf })
    pageCount.value = pdfDoc.numPages || 0
    const initial = Math.min(Math.max(1, initialPage || props.initialPage || 1), pageCount.value || 1)
    currentPage.value = initial
    await nextTick()
    await renderPage(initial)
  } catch (err: any) {
    error.value = err?.message ? String(err.message) : 'Failed to load PDF document'
  } finally {
    loading.value = false
  }
}

function togglePlayback() {
  const audio = audioEl.value
  if (!audio) return
  if (audio.paused) {
    void audio.play().catch((err) => console.warn('Unable to start audio playback', err))
  } else {
    audio.pause()
  }
}

function onScrubInput(event: Event) {
  const audio = audioEl.value
  if (!audio) return
  const target = event.target as HTMLInputElement | null
  if (!target) return
  const value = Number.parseFloat(target.value)
  if (Number.isFinite(value)) {
    audio.currentTime = Math.max(0, value)
  }
}

function goPrev() {
  if (!canPrev.value) return
  void renderPage(currentPage.value - 1)
}

function goNext() {
  if (!canNext.value) return
  void renderPage(currentPage.value + 1)
}

function togglePageFollow() {
  pageFollowEnabled.value = !pageFollowEnabled.value
  if (!pageFollowEnabled.value) {
    lastFollowPage = 0
  } else {
    void syncPageToAudio(true)
  }
}

async function syncPageToAudio(force = false) {
  if (!pageFollowEnabled.value || !pdfDoc || !pageCount.value) return
  const duration = audioDuration.value
  if (!duration || !Number.isFinite(duration)) return
  const ratio = Math.max(0, Math.min(1, duration > 0 ? audioTime.value / duration : 0))
  const candidate = Math.min(pageCount.value, Math.max(1, Math.round(ratio * pageCount.value) || 1))
  if (!force && candidate === lastFollowPage) return
  lastFollowPage = candidate
  if (candidate !== currentPage.value) {
    await renderPage(candidate)
  }
}

function applySkin(skin: Skin) {
  const entry = SKINS[skin]
  const viewer = viewerRoot.value
  if (viewer) {
    viewer.setAttribute('data-prae-skin', skin)
    for (const [, def] of skinEntries) {
      viewer.classList.remove(def.rootClass)
    }
    if (entry?.rootClass) viewer.classList.add(entry.rootClass)
  }
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-prae-skin', skin)
    for (const [, def] of skinEntries) {
      root.classList.remove(def.rootClass)
    }
    if (entry?.rootClass) root.classList.add(entry.rootClass)
  }
}

function readInitialQuery() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const pageParam = url.searchParams.get('page')
  const timeParam = url.searchParams.get('time')
  const skinParam = url.searchParams.get('skin') as Skin | null

  if (pageParam) {
    const parsed = Number.parseInt(pageParam, 10)
    if (!Number.isNaN(parsed)) {
      currentPage.value = Math.max(1, parsed)
    }
  }

  if (timeParam) {
    const parsed = parseTime(timeParam)
    if (parsed !== null) {
      audioTime.value = parsed
      const audio = audioEl.value
      if (audio) {
        try {
          audio.currentTime = parsed
        } catch (err) {
          console.warn('Unable to set initial audio time', err)
        }
      }
    }
  }

  if (skinParam && SKINS[skinParam]) {
    selectedSkin.value = skinParam
  }
}

function writeQuery() {
  if (typeof window === 'undefined' || !queryReady) return
  const url = new URL(window.location.href)
  const page = Math.max(1, Math.min(pageCount.value || 1, currentPage.value))
  if (page > 1) {
    url.searchParams.set('page', String(page))
  } else {
    url.searchParams.delete('page')
  }
  if (audioTimeRounded.value > 0) {
    url.searchParams.set('time', formatTimeForQuery(audioTimeRounded.value))
  } else {
    url.searchParams.delete('time')
  }
  if (selectedSkin.value !== props.initialSkin) {
    url.searchParams.set('skin', selectedSkin.value)
  } else {
    url.searchParams.delete('skin')
  }
  window.history.replaceState({}, '', url.toString())
}

function parseTime(value: string) {
  if (!value) return null
  if (/^\d+$/.test(value)) {
    const numeric = Number.parseInt(value, 10)
    return Number.isNaN(numeric) ? null : numeric
  }
  const parts = value.split(':').map((segment) => Number.parseInt(segment, 10))
  if (parts.some((n) => Number.isNaN(n))) return null
  while (parts.length < 3) parts.unshift(0)
  const [hours, minutes, seconds] = parts
  return hours * 3600 + minutes * 60 + seconds
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTimeForQuery(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function copyDeepLink() {
  if (typeof window === 'undefined') return
  writeQuery()
  const url = window.location.href
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      throw new Error('Clipboard API unavailable')
    }
    setCopyFeedback('Copied!')
  } catch (err) {
    setCopyFeedback('Copy manually')
    try {
      window.prompt('Copy this link', url)
    } catch {
      /* noop */
    }
  }
}

function setCopyFeedback(message: string) {
  copyFeedback.value = message
  if (copyTimeout) clearTimeout(copyTimeout)
  copyTimeout = setTimeout(() => {
    copyFeedback.value = ''
    copyTimeout = null
  }, 2000)
}

async function tryHydrateLibraryHud() {
  if (usingLibraryHud.value) return
  if (typeof window === 'undefined') return
  const mountTarget = hudSlot.value
  const audio = audioEl.value
  const canvas = canvasEl.value
  if (!mountTarget || !audio || !canvas) return
  let PraeHUD: any = null
  try {
    const baseHref = typeof document !== 'undefined' ? document.baseURI : '/'
    const baseUrl = new URL('./', baseHref)
    const hudUrl = new URL('dist/praetorius.es.js', baseUrl)
    const mod = await import(/* @vite-ignore */ hudUrl.pathname)
    PraeHUD = mod?.PraeHUD ?? mod?.default ?? null
  } catch {
    PraeHUD = null
  }
  if (!PraeHUD) return

  try {
    let cleanup: (() => void) | null = null
    if (typeof PraeHUD === 'function') {
      const result = PraeHUD(mountTarget, { audio, canvas })
      if (typeof result === 'function') cleanup = result
      else if (result && typeof result.destroy === 'function') cleanup = () => result.destroy()
    } else if (typeof PraeHUD?.mount === 'function') {
      const result = PraeHUD.mount(mountTarget, { audio, canvas })
      if (typeof result === 'function') cleanup = result
      else if (result && typeof result.destroy === 'function') cleanup = () => result.destroy()
    }
    if (cleanup) {
      hudCleanup = cleanup
    }
    usingLibraryHud.value = true
  } catch (err) {
    console.warn('Unable to mount PraeHUD from library build', err)
  }
}

watch(selectedSkin, (skin) => {
  applySkin(skin)
  if (queryReady) writeQuery()
})

watch(currentPage, () => {
  if (!queryReady) return
  writeQuery()
})

watch(audioTimeRounded, (value) => {
  if (!queryReady) return
  if (value === lastQueryTime) return
  lastQueryTime = value
  writeQuery()
})

watch(() => props.pdf, async (next, prev) => {
  if (next === prev) return
  await bootstrap()
})

watch(() => props.fallbackPdf, async (next, prev) => {
  if (next === prev) return
  await bootstrap()
})

watch(() => props.audio, () => {
  resetAudioSource()
})

watch(() => props.fallbackAudio, () => {
  resetAudioSource()
})

onMounted(async () => {
  resetAudioSource()
  await nextTick()
  attachAudioListeners(audioEl.value)
  readInitialQuery()
  applySkin(selectedSkin.value)
  await bootstrap(currentPage.value)
  queryReady = true
  lastQueryTime = audioTimeRounded.value
  writeQuery()
  await nextTick()
  void tryHydrateLibraryHud()
})

onUnmounted(() => {
  destroyed = true
  detachAudioListeners()
  if (renderTask?.cancel) {
    try { renderTask.cancel() } catch { /* noop */ }
  }
  if (pdfDoc?.destroy) {
    try { pdfDoc.destroy() } catch { /* noop */ }
  }
  pdfDoc = null
  if (hudCleanup) {
    try { hudCleanup() } catch { /* noop */ }
    hudCleanup = null
  }
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.removeAttribute('data-prae-skin')
    for (const [, def] of skinEntries) {
      root.classList.remove(def.rootClass)
    }
  }
  if (copyTimeout) clearTimeout(copyTimeout)
})
</script>

<template>
  <div ref="viewerRoot" class="prae-viewer" :data-ready="ready" :aria-busy="loading">
    <div class="prae-viewer__hud">
      <div ref="hudSlot" class="prae-viewer__hud-slot" v-show="usingLibraryHud"></div>
      <template v-if="!usingLibraryHud">
        <div class="prae-viewer__transport">
          <button type="button" @click="togglePlayback">
            {{ isPlaying ? 'Pause' : 'Play' }}
          </button>
          <div class="prae-viewer__scrub">
            <input
              type="range"
              min="0"
              :max="Math.max(audioDuration, 0.0001)"
              step="0.1"
              :value="audioTime"
              :disabled="!audioDuration"
              @input="onScrubInput"
              aria-label="Seek"
            />
          </div>
          <div class="prae-viewer__time" aria-live="polite">
            <span>{{ formattedElapsed }}</span>
            <span>· –{{ formattedRemaining }}</span>
          </div>
        </div>
        <div class="prae-viewer__meta">
          <div class="prae-viewer__actions" role="group" aria-label="Page navigation">
            <button type="button" data-variant="ghost" @click="goPrev" :disabled="!canPrev">Prev</button>
            <span>Page {{ currentPage }} / {{ pageCount }}</span>
            <button type="button" data-variant="ghost" @click="goNext" :disabled="!canNext">Next</button>
          </div>
          <button
            type="button"
            data-variant="ghost"
            :aria-pressed="pageFollowEnabled"
            @click="togglePageFollow"
          >
            {{ pageFollowEnabled ? 'Following pages' : 'Enable page follow' }}
          </button>
          <button type="button" data-variant="ghost" @click="copyDeepLink">
            {{ copyFeedback || 'Copy deep link' }}
          </button>
          <label class="prae-viewer__skin">
            <span class="sr-only">Skin</span>
            <select v-model="selectedSkin" aria-label="Choose skin">
              <option v-for="[skin] in skinEntries" :key="skin" :value="skin">{{ skin }}</option>
            </select>
          </label>
        </div>
      </template>
    </div>

    <div class="prae-viewer__canvas">
      <canvas ref="canvasEl" class="prae-viewer__page" role="img" :aria-busy="loading" />
      <div v-if="loading" class="prae-viewer__loading" aria-live="polite">Loading score…</div>
      <p v-if="error" class="prae-viewer__error" role="alert">{{ error }}</p>
    </div>

    <audio
      ref="audioEl"
      class="prae-viewer__audio"
      :src="audioSource"
      preload="metadata"
      @error="onAudioError"
      hidden
    />
  </div>
</template>

<style scoped>
.prae-viewer__hud-slot { min-height: 120px; }
.prae-viewer__loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: .75rem 1rem; border-radius: 999px; background: rgba(255,255,255,.9); color: var(--vp-c-text-1); box-shadow: 0 0 0 1px rgba(0,0,0,.04); font-weight: 500; }
.prae-viewer__error { margin: 0; padding: .75rem 1rem; border-radius: .75rem; background: rgba(239,68,68,.12); color: #7f1d1d; border: 1px solid rgba(239,68,68,.25); }
.prae-viewer__audio { width: 100%; }
.prae-viewer__skin select { text-transform: capitalize; }
.sr-only{ position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
