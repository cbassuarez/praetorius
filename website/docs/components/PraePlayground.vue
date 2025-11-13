<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

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
}>(), {
  initialPage: 1,
  fallbackPdf: undefined,
  fallbackAudio: undefined
})

type Skin = 'typefolio' | 'console' | 'vitebreeze'

const skin = ref<Skin>('vitebreeze')
const canvasEl = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const rendering = ref(false)
const error = ref<string | null>(null)
const pageCount = ref(0)
const currentPage = ref(Math.max(1, props.initialPage || 1))
const scale = ref(1.2)
const audioSource = ref<string>('')

let pdfDoc: any = null
let renderTask: any = null
let destroyed = false
let pdfjsCache: any = null

const canPrev = computed(() => currentPage.value > 1)
const canNext = computed(() => pageCount.value > 0 && currentPage.value < pageCount.value)

async function ensurePdfJs() {
  if (pdfjsCache) return pdfjsCache
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.js?url').catch(() =>
      import('pdfjs-dist/build/pdf.worker.js?url')
    )
  ])
  const pdfModule = pdfjs as any
  const lib =
    typeof pdfModule?.getDocument === 'function'
      ? pdfModule
      : typeof pdfModule?.default?.getDocument === 'function'
        ? pdfModule.default
        : pdfModule?.default || pdfModule

  if (!lib || typeof lib.getDocument !== 'function') {
    throw new Error('Failed to load pdfjs-dist')
  }

  const workerSrc = (worker as any)?.default ?? worker
  if (typeof workerSrc === 'string') {
    const globalOptions =
      lib.GlobalWorkerOptions ||
      pdfModule.GlobalWorkerOptions ||
      (pdfModule.GlobalWorkerOptions = lib.GlobalWorkerOptions = {})
    globalOptions.workerSrc = workerSrc
  } else if (workerSrc) {
    console.warn('Unexpected pdf.js worker source:', workerSrc)
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

function resolveAsset(value?: string) {
  if (!value) return ''
  if (/^(?:[a-z]+:)?\/\//i.test(value)) return value
  const normalized = value.startsWith('/') ? value : `/${value}`
  return withBase(normalized)
}

async function renderPage(pageNumber: number) {
  if (!pdfDoc || destroyed) return
  const canvas = canvasEl.value
  if (!canvas) throw new Error('Canvas element not ready')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to get 2D context from canvas')

  rendering.value = true
  try {
    if (renderTask?.cancel) renderTask.cancel()
    const page = await pdfDoc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: scale.value })
    canvas.height = viewport.height
    canvas.width = viewport.width
    renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    if (!destroyed) currentPage.value = pageNumber
  } finally {
    renderTask = null
    rendering.value = false
  }
}

function onAudioError() {
  if (!props.fallbackAudio) return
  const fallback = resolveAsset(props.fallbackAudio)
  if (!fallback || audioSource.value === fallback) return
  audioSource.value = fallback
}

function resetAudioSource() {
  const primary = resolveAsset(props.audio)
  const fallback = resolveAsset(props.fallbackAudio)
  audioSource.value = primary || fallback || ''
}

async function bootstrap() {
  if (destroyed) return
  loading.value = true
  error.value = null
  pageCount.value = 0
  try {
    if (pdfDoc?.destroy) {
      try { pdfDoc.destroy() } catch {}
    }
    pdfDoc = await loadPdfDocument({ primary: props.pdf, fallback: props.fallbackPdf })
    pageCount.value = pdfDoc.numPages || 0
    const initial = Math.min(Math.max(1, props.initialPage || 1), pageCount.value || 1)
    currentPage.value = initial
    await nextTick()
    await renderPage(initial)
  } catch (err: any) {
    error.value = err?.message ? String(err.message) : 'Failed to load PDF document'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  resetAudioSource()
  await bootstrap()
})

onUnmounted(() => {
  destroyed = true
  if (renderTask?.cancel) {
    try { renderTask.cancel() } catch {}
  }
  pdfDoc?.destroy?.()
  pdfDoc = null
})

watch(scale, async () => {
  if (!pdfDoc || destroyed || loading.value || error.value) return
  await renderPage(currentPage.value)
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

function goPrev() {
  if (!canPrev.value) return
  const target = Math.max(1, currentPage.value - 1)
  void renderPage(target)
}

function goNext() {
  if (!canNext.value) return
  const target = Math.min(pageCount.value, currentPage.value + 1)
  void renderPage(target)
}

function copyDeepLink() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('page', String(currentPage.value))
    navigator.clipboard.writeText(url.toString())
  } catch {}
}

</script>

<template>
  <div :class="['prae-playground', 'prae-skin-' + skin]">
    <div v-if="error" class="prae-playground__error">
      <p>We couldn't load the PDF demo.</p>
      <p class="prae-playground__error-details">{{ error }}</p>
    </div>
    <div v-else>
      <div class="prae-playground__viewer" :class="{ 'is-loading': loading }">
        <canvas ref="canvasEl" class="prae-playground__canvas" role="img" :aria-busy="loading" />
        <div v-if="loading" class="prae-playground__loading">Loading playground…</div>
      </div>
      <div class="prae-playground__toolbar" aria-live="polite">
        <div class="prae-playground__pager">
          <button type="button" @click="goPrev" :disabled="!canPrev">Prev</button>
          <span class="prae-playground__page-indicator">Page {{ currentPage }} / {{ pageCount }}</span>
          <button type="button" @click="goNext" :disabled="!canNext">Next</button>
        </div>
        <label class="prae-playground__skin">
          Skin
          <select v-model="skin" aria-label="Skin">
            <option value="typefolio">Typefolio</option>
            <option value="console">Console</option>
            <option value="vitebreeze">Vite-Breeze</option>
          </select>
        </label>
        <label class="prae-playground__zoom">
          Zoom
          <input
            type="range"
            min="0.6"
            max="2"
            step="0.1"
            v-model.number="scale"
            :disabled="loading || rendering"
            aria-label="Zoom"
          />
        </label>
        <button type="button" class="prae-playground__copy" @click="copyDeepLink">Copy deep link</button>
      </div>
      <div class="prae-playground__audio">
        <audio
          :src="audioSource"
          controls
          preload="none"
          @error="onAudioError"
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prae-playground {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.prae-playground__viewer {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.prae-playground__viewer.is-loading {
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.04),
    rgba(0, 0, 0, 0.04) 10px,
    rgba(0, 0, 0, 0.08) 10px,
    rgba(0, 0, 0, 0.08) 20px
  );
}

.prae-playground__canvas {
  max-width: 100%;
  height: auto;
}

.prae-playground__loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.9);
  color: var(--vp-c-text-1);
  padding: 0.75rem 1rem;
  border-radius: 999px;
  font-weight: 500;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.prae-playground__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.prae-playground__skin {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.prae-playground__skin select {
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.prae-playground__pager {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.prae-playground__page-indicator {
  font-variant-numeric: tabular-nums;
  font-size: 0.95rem;
}

.prae-playground__pager button {
  appearance: none;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.prae-playground__pager button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prae-playground__pager button:not(:disabled):hover {
  background: var(--vp-c-bg-soft);
}

.prae-playground__zoom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.prae-playground__copy {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.prae-playground__copy:hover {
  background: var(--vp-c-bg-soft);
}

.prae-playground__audio audio {
  width: 100%;
}

.prae-playground__error {
  border: 1px solid rgba(255, 0, 0, 0.2);
  background: rgba(255, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 12px;
}

.prae-playground__error-details {
  font-family: var(--vp-font-family-mono);
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.65);
}

/* map existing tokens to playground scope */
.prae-skin-typefolio .prae-playground__viewer {
  background: rgba(240, 236, 228, 0.35);
}

.prae-skin-console .prae-playground__viewer {
  background: radial-gradient(circle at 20% -20%, rgba(16, 185, 129, 0.18), transparent 60%);
}

.prae-skin-vitebreeze .prae-playground__viewer {
  background: rgba(100, 108, 255, 0.08);
  backdrop-filter: blur(10px);
}
</style>
