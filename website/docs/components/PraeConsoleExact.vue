<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { createDefaultProjectState, hydrateProjectState, runFolioCommand } from '../../../src/web/folio-runtime.js'

const { isDark } = useData()
const themeMode = computed(() => (isDark.value ? 'dark' : 'light'))

const PRAE_API_ORIGIN = String(import.meta.env.VITE_PRAE_BUILDER_API || '').trim().replace(/\/+$/, '')
function builderApi(path: string): string {
  return PRAE_API_ORIGIN ? `${PRAE_API_ORIGIN}${path}` : withBase(path)
}

type SkinKey =
  | 'console'
  | 'vite-breeze'
  | 'cards-tabs'
  | 'kiosk'
  | 'docs-reader'
  | 'typefolio'
  | 'typescatter'

type PaletteKey =
  | 'ryb-tricolor'
  | 'mono-bw'
  | 'mono-one'
  | 'gem-diamond'
  | 'orange-blue-white-silver'

const skin = ref<SkinKey>('console')
const palette = ref<PaletteKey>('ryb-tricolor')
const previewSrc = ref('')
const previewSrcdoc = ref('')
const loading = ref(false)
const loadError = ref('')
const activeSession = ref('')

const REACT_SUPPORTED_SKINS = new Set<SkinKey>(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader'])

const skinOptions: Array<{ value: SkinKey; label: string }> = [
  { value: 'console', label: 'Console' },
  { value: 'cards-tabs', label: 'Cards-Tabs' },
  { value: 'vite-breeze', label: 'Vite-Breeze' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'docs-reader', label: 'Docs-Reader' },
  { value: 'typefolio', label: 'Typefolio' },
  { value: 'typescatter', label: 'Typescatter' },
]

const paletteOptions: Array<{ value: PaletteKey; label: string }> = [
  { value: 'ryb-tricolor', label: 'RYB tricolor' },
  { value: 'mono-bw', label: 'Monochrome B/W' },
  { value: 'mono-one', label: 'Monochrome one-color' },
  { value: 'gem-diamond', label: 'Gem / Diamond' },
  { value: 'orange-blue-white-silver', label: 'Orange / Blue / White / Silver' },
]

const stockWorks = [
  {
    id: 1,
    slug: 'satie-gnossienne-no-1',
    title: 'Gnossienne No. 1 — Erik Satie',
    oneliner:
      'A sparse piano line with transparent rhythm and breathing room for score-follow and cue sync.',
    description:
      'A minimalist piano texture that keeps notation readable while exposing page-follow and audio sync behavior.',
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
    oneliner:
      'A transparent chorale texture that is ideal for verifying score-follow timing and clean playback transitions.',
    description:
      'Praetorius material is included as a second stock piece so playground behavior mirrors real generated output workflows.',
    cues: [{ label: '@0:00', t: 0 }],
    audio: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/Anonymous/es_ist_ein_ros/es_ist_ein_ros-a4.pdf',
    cover: null,
    tags: ['praetorius', 'chorale', 'audio+pdf'],
  },
]

const hasPreview = computed(() => !!previewSrc.value || !!previewSrcdoc.value)

function buildProjectState() {
  const state = hydrateProjectState(createDefaultProjectState())
  state.config = {
    ...state.config,
    theme: themeMode.value,
    ui: {
      ...state.config.ui,
      skin: skin.value,
      appearance: {
        ...(state.config.ui?.appearance || {}),
        theme: {
          ...(state.config.ui?.appearance?.theme || {}),
          palette: palette.value,
        },
      },
    },
    site: {
      ...state.config.site,
      fullName: 'Praetorius Stock Demo',
      subtitle: 'Satie + Praetorius',
      listLabel: 'Works List',
    },
  }
  state.worksDb = {
    version: 1,
    works: stockWorks,
  }
  return state
}

async function closeActiveSession() {
  if (!activeSession.value) return
  const token = activeSession.value
  activeSession.value = ''
  try {
    await fetch(builderApi(`/__prae_builder/close/${token}`), {
      method: 'POST',
      keepalive: true,
    })
  } catch {
    // ignore close failures
  }
}

async function generateViaCliBridge(state: any) {
  const uiRuntime = REACT_SUPPORTED_SKINS.has(skin.value) ? 'react' : 'vanilla'
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
        skin: skin.value,
        uiRuntime,
        embed: false,
        noUi: false,
        noCss: false,
        minify: false,
      },
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok || !payload?.previewUrl) {
    throw new Error(
      String(payload?.error || payload?.output || `CLI bridge failed (HTTP ${response.status})`).trim()
    )
  }
  await closeActiveSession()
  activeSession.value = String(payload.token || '')
  previewSrc.value = builderApi(String(payload.previewUrl))
  previewSrcdoc.value = ''
}

function generateLocalFallback(state: any) {
  const uiRuntime = REACT_SUPPORTED_SKINS.has(skin.value) ? 'react' : 'vanilla'
  const configured = runFolioCommand(state, [
    'config',
    '--payload',
    JSON.stringify({
      theme: themeMode.value,
      ui: {
        skin: skin.value,
        appearance: {
          theme: { palette: palette.value },
        },
      },
    }),
  ])
  const fromState = configured?.state || state
  const generated = runFolioCommand(fromState, [
    'generate',
    '--skin',
    skin.value,
    '--ui-runtime',
    uiRuntime,
  ])
  const previewHtml = String(generated?.artifacts?.previewHtml || '').trim()
  if (!previewHtml) throw new Error('Fallback preview generation failed.')
  previewSrc.value = ''
  previewSrcdoc.value = previewHtml
}

async function refreshPreview() {
  loading.value = true
  loadError.value = ''
  try {
    const state = buildProjectState()
    try {
      await generateViaCliBridge(state)
    } catch {
      generateLocalFallback(state)
    }
  } catch (error: any) {
    loadError.value = String(error?.message || error || 'Preview failed.')
    previewSrc.value = ''
    previewSrcdoc.value = ''
  } finally {
    loading.value = false
  }
}

watch([skin, palette, themeMode], () => {
  void refreshPreview()
})

onMounted(() => {
  void refreshPreview()
})

onBeforeUnmount(() => {
  void closeActiveSession()
})
</script>

<template>
  <section class="prae-playground-shell">
    <header class="prae-playground-shell__head">
      <div>
        <p class="prae-playground-shell__kicker">Playground</p>
        <h2>Stock Demo Set</h2>
        <p>Includes Erik Satie + Michael Praetorius stock works, each with live audio and score PDF.</p>
      </div>
      <div class="prae-playground-shell__controls">
        <label>
          Skin
          <select v-model="skin">
            <option v-for="option in skinOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          Palette
          <select v-model="palette">
            <option v-for="option in paletteOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <div class="prae-playground-shell__chips" aria-hidden="true">
      <span>Satie</span>
      <span>Praetorius</span>
      <span>Audio + PDF</span>
      <span>{{ skin }}</span>
    </div>

    <div class="prae-embed">
      <div v-if="loading || !hasPreview" class="prae-embed__loading">
        {{ loading ? 'Generating live preview…' : 'Preview unavailable.' }}
      </div>
      <iframe
        v-else-if="previewSrc"
        :src="previewSrc"
        title="Praetorius Playground"
        loading="lazy"
        allow="autoplay; fullscreen"
        referrerpolicy="no-referrer"
      />
      <iframe
        v-else-if="previewSrcdoc"
        :srcdoc="previewSrcdoc"
        title="Praetorius Playground"
        loading="lazy"
        allow="autoplay; fullscreen"
        referrerpolicy="no-referrer"
      />
    </div>
    <p v-if="loadError" class="prae-playground-shell__error">{{ loadError }}</p>
  </section>
</template>

<style scoped>
.prae-playground-shell {
  display: grid;
  gap: 12px;
}

.prae-playground-shell__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
}

.prae-playground-shell__kicker {
  margin: 0;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.prae-playground-shell__head h2 {
  margin: 4px 0 6px;
  font: 700 28px/1.05 "IBM Plex Mono", ui-monospace, monospace;
}

.prae-playground-shell__head p {
  margin: 0;
  max-width: 72ch;
  font: 500 14px/1.35 "Space Grotesk", ui-sans-serif, sans-serif;
  opacity: 0.88;
}

.prae-playground-shell__controls {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.prae-playground-shell__controls label {
  display: grid;
  gap: 6px;
  min-width: 180px;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.prae-playground-shell__controls select {
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  padding: 8px;
  font: 600 13px/1.2 "Space Grotesk", ui-sans-serif, sans-serif;
}

.prae-playground-shell__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.prae-playground-shell__chips span {
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
  background: var(--prae-card-bg, var(--vp-c-bg));
  color: var(--vp-c-text-1);
  padding: 6px 9px;
  font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.prae-embed {
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
  background: var(--prae-card-bg, var(--vp-c-bg));
  box-shadow: 6px 6px 0 color-mix(in srgb, #2c6bff 30%, transparent);
  overflow: hidden;
}

.prae-embed iframe {
  display: block;
  width: 100%;
  height: min(920px, 76vh);
  border: 0;
  background: var(--prae-card-bg, var(--vp-c-bg));
}

.prae-embed__loading {
  min-height: 340px;
  display: grid;
  place-items: center;
  color: var(--vp-c-text-1);
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.prae-playground-shell__error {
  margin: 0;
  padding: 10px;
  border: 2px solid var(--vp-c-text-1);
  background: var(--prae-card-bg, var(--vp-c-bg));
  color: var(--vp-c-text-1);
  border-radius: 2px;
  font: 700 12px/1.3 "IBM Plex Mono", ui-monospace, monospace;
}

@media (max-width: 1080px) {
  .prae-playground-shell__head {
    flex-direction: column;
    align-items: stretch;
  }

  .prae-playground-shell__controls {
    grid-template-columns: 1fr;
  }

  .prae-playground-shell__controls label {
    min-width: 0;
  }
}
</style>
