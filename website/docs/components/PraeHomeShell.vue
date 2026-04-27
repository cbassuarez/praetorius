<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { createDefaultProjectState, hydrateProjectState, runFolioCommand } from '../../../src/web/folio-runtime.js'

const { isDark } = useData()
const themeMode = computed(() => (isDark.value ? 'dark' : 'light'))

const PRAE_API_DEFAULT = 'https://praetorius.onrender.com'
const PRAE_API_ENV = String(import.meta.env.VITE_PRAE_BUILDER_API || '').trim().replace(/\/+$/, '')
const PRAE_API_ORIGIN = PRAE_API_ENV || (import.meta.env.PROD ? PRAE_API_DEFAULT : '')
function builderApi(path: string): string {
  return PRAE_API_ORIGIN ? `${PRAE_API_ORIGIN}${path}` : withBase(path)
}

const previewSrc = ref('')
const previewSrcdoc = ref('')
const loading = ref(true)
const error = ref('')
const activeSession = ref('')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeHeight = ref<number>(520)

let frameResizeObserver: ResizeObserver | null = null
let frameMutationObserver: MutationObserver | null = null
let measureRaf = 0

function measureIframeHeight() {
  measureRaf = 0
  const frame = iframeRef.value
  if (!frame) return
  try {
    const doc = frame.contentDocument
    if (!doc) return
    const html = doc.documentElement
    const body = doc.body
    if (html) html.style.minHeight = '0'
    if (body) {
      body.style.minHeight = '0'
      body.style.margin = '0'
    }
    const next = Math.max(
      Number(html?.scrollHeight || 0),
      Number(html?.offsetHeight || 0),
      Number(body?.scrollHeight || 0),
      Number(body?.offsetHeight || 0),
      420,
    )
    iframeHeight.value = Math.min(2400, Math.ceil(next))
  } catch {
    // ignore cross-origin failures
  }
}

function queueMeasure() {
  if (measureRaf) cancelAnimationFrame(measureRaf)
  measureRaf = requestAnimationFrame(measureIframeHeight)
}

function disconnectObservers() {
  if (frameResizeObserver) {
    frameResizeObserver.disconnect()
    frameResizeObserver = null
  }
  if (frameMutationObserver) {
    frameMutationObserver.disconnect()
    frameMutationObserver = null
  }
  if (measureRaf) {
    cancelAnimationFrame(measureRaf)
    measureRaf = 0
  }
}

function bindObservers() {
  disconnectObservers()
  const frame = iframeRef.value
  if (!frame || typeof window === 'undefined') return
  try {
    const doc = frame.contentDocument
    if (!doc) return
    const html = doc.documentElement
    const body = doc.body
    if (window.ResizeObserver && html) {
      frameResizeObserver = new window.ResizeObserver(() => queueMeasure())
      frameResizeObserver.observe(html)
      if (body) frameResizeObserver.observe(body)
    }
    if (window.MutationObserver && html) {
      frameMutationObserver = new window.MutationObserver(() => queueMeasure())
      frameMutationObserver.observe(html, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      })
    }
    queueMeasure()
    setTimeout(queueMeasure, 160)
    setTimeout(queueMeasure, 520)
  } catch {
    // ignore cross-origin failures
  }
}

function onIframeLoad() {
  queueMeasure()
  bindObservers()
}

const stockWorks = [
  {
    id: 1,
    slug: 'satie-gnossienne-no-1',
    title: 'Gnossienne No. 1 — Erik Satie',
    oneliner: 'A sparse piano line with transparent rhythm and breathing room for score-follow.',
    description:
      'A minimalist piano texture that keeps notation readable and demonstrates page-follow timing with clean dynamics.',
    cues: [{ label: '@0:00', t: 0 }],
    audio: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf',
    cover: null,
    tags: ['satie', 'demo', 'audio+pdf'],
  },
  {
    id: 2,
    slug: 'lo-how-a-rose-praetorius',
    title: 'Lo, How a Rose — Michael Praetorius',
    oneliner: 'A chorale texture ideal for testing cue timing and score readability.',
    description:
      'A balanced chorale flow for validating synchronization, deep-link copy, and PDF pane behavior in a second work.',
    cues: [{ label: '@0:00', t: 0 }],
    audio: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/Anonymous/es_ist_ein_ros/es_ist_ein_ros-a4.pdf',
    cover: null,
    tags: ['praetorius', 'chorale', 'audio+pdf'],
  },
]

function buildProjectState() {
  const state = hydrateProjectState(createDefaultProjectState())
  state.config = {
    ...state.config,
    theme: themeMode.value,
    site: {
      ...state.config.site,
      fullName: 'Praetorius CLI Session',
      subtitle: 'Stock demo · Satie + Praetorius',
      listLabel: 'Works List',
    },
    ui: {
      ...(state.config.ui || {}),
      skin: 'console',
      uiRuntime: 'react',
      appearance: {
        ...(state.config.ui?.appearance || {}),
        theme: {
          ...(state.config.ui?.appearance?.theme || {}),
          palette: 'mono-bw',
        },
        cursor: { preset: 'system' },
        effects: { hover: 'balanced-neo', button: 'balanced-neo' },
      },
    },
  }
  state.worksDb = {
    version: 1,
    works: stockWorks,
  }
  return state
}

function buildPreviewFallback() {
  const state = buildProjectState()
  const result = runFolioCommand(state, [
    'generate',
    '--skin',
    'console',
    '--ui-runtime',
    'react',
    '--palette',
    'mono-bw',
    '--theme',
    themeMode.value,
  ])

  const html = String(result?.artifacts?.previewHtml || '').trim()
  if (!html) throw new Error('Unable to generate console preview.')
  previewSrc.value = ''
  previewSrcdoc.value = html
}

async function closeActiveSession() {
  const token = String(activeSession.value || '').trim()
  if (!token) return
  activeSession.value = ''
  try {
    await fetch(builderApi(`/__prae_builder/close/${encodeURIComponent(token)}`), {
      method: 'POST',
      keepalive: true,
    })
  } catch {
    // ignore close failures
  }
}

async function buildPreviewBridge() {
  const state = buildProjectState()
  const response = await fetch(builderApi('/__prae_builder/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: {
        config: state.config,
        worksDb: state.worksDb,
        docsConfig: state.docsConfig,
        docsPages: state.docsPages,
      },
      generate: {
        skin: 'console',
        uiRuntime: 'react',
        embed: false,
        noUi: false,
        noCss: false,
        minify: false,
      },
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok || !payload?.previewUrl) {
    throw new Error(String(payload?.error || payload?.output || `Bridge failed (HTTP ${response.status})`).trim())
  }
  await closeActiveSession()
  activeSession.value = String(payload.token || '').trim()
  previewSrc.value = builderApi(String(payload.previewUrl))
  previewSrcdoc.value = ''
}

async function rebuildPreview() {
  loading.value = true
  error.value = ''
  try {
    try {
      await buildPreviewBridge()
    } catch {
      buildPreviewFallback()
    }
  } catch (err: any) {
    error.value = String(err?.message || err || 'Preview unavailable.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void rebuildPreview()
})

watch(themeMode, () => {
  void rebuildPreview()
})

onBeforeUnmount(() => {
  disconnectObservers()
  void closeActiveSession()
})
</script>

<template>
  <section class="prae-home-shell-card">
    <header class="prae-home-shell-card__head">
      <div class="prae-home-shell-card__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <code>prae generate --skin console --ui-runtime react --palette mono-bw</code>
    </header>
    <div class="prae-home-shell-card__body">
      <p v-if="loading" class="prae-home-shell-card__status">Building live console preview…</p>
      <p v-else-if="error" class="prae-home-shell-card__status">{{ error }}</p>
      <iframe
        v-else-if="previewSrc"
        ref="iframeRef"
        :src="previewSrc"
        title="Praetorius console hero preview"
        loading="lazy"
        allow="autoplay"
        referrerpolicy="no-referrer"
        scrolling="no"
        :style="{ height: `${iframeHeight}px` }"
        @load="onIframeLoad"
      />
      <iframe
        v-else-if="previewSrcdoc"
        ref="iframeRef"
        :srcdoc="previewSrcdoc"
        title="Praetorius console hero preview"
        loading="lazy"
        allow="autoplay"
        referrerpolicy="no-referrer"
        scrolling="no"
        :style="{ height: `${iframeHeight}px` }"
        @load="onIframeLoad"
      />
    </div>
  </section>
</template>

<style scoped>
.prae-home-shell-card {
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
  background: var(--prae-card-bg, var(--vp-c-bg));
  color: var(--vp-c-text-1);
  box-shadow: 6px 6px 0 color-mix(in srgb, #2c6bff 28%, transparent);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.prae-home-shell-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid var(--vp-c-text-1);
  padding: 10px 12px;
  background: var(--prae-card-bg-elev, var(--vp-c-bg-soft));
}

.prae-home-shell-card__head code {
  font: 700 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.prae-home-shell-card__dots {
  display: inline-flex;
  gap: 6px;
}

.prae-home-shell-card__dots span {
  width: 10px;
  height: 10px;
  border: 2px solid var(--vp-c-text-1);
  border-radius: 50%;
  background: var(--prae-card-bg, var(--vp-c-bg));
}

.prae-home-shell-card__body {
  background: var(--prae-card-bg, var(--vp-c-bg));
  flex: 1;
  display: flex;
  flex-direction: column;
}

.prae-home-shell-card iframe {
  width: 100%;
  border: 0;
  display: block;
  background: var(--prae-card-bg, var(--vp-c-bg));
}

.prae-home-shell-card__status {
  margin: 0;
  min-height: 420px;
  display: grid;
  place-items: center;
  padding: 16px;
  font: 700 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

@media (max-width: 960px) {
  .prae-home-shell-card__status {
    min-height: 320px;
  }
}
</style>
