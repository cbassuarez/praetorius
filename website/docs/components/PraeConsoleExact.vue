<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

type Skin = 'typefolio' | 'console' | 'vite-breeze'

const pdf = 'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf'
const audio = 'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3'
const fallbackPdf = '/samples/demo.pdf'
const fallbackAudio = '/samples/demo.mp3'

const skin = ref<Skin>('typefolio')
const mounting = ref(false)

let moduleApi: any | null = null
let wrapperEl: HTMLElement | null = null

function resolveLibPath(file: string) {
  const base = withBase('/')
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}${file.startsWith('/') ? file : `/${file}`}`
}

async function loadLibrary() {
  if (moduleApi) return moduleApi
  const esmUrl = resolveLibPath('/prae-lib/praetorius.es.js')
  try {
    moduleApi = await import(/* @vite-ignore */ esmUrl)
    return moduleApi
  } catch (err) {
    const umdUrl = resolveLibPath('/prae-lib/praetorius.umd.js')
    moduleApi = await loadUmd(umdUrl)
    return moduleApi
  }
}

function loadUmd(src: string) {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('UMD load attempted during SSR'))
      return
    }
    const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script')).find((tag) => tag.src === src)
    if (existing && (window as any).PRAE) {
      resolve((window as any).PRAE)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      const globalApi = (window as any).PRAE || (window as any).Praetorius || null
      if (globalApi) {
        resolve(globalApi)
      } else {
        reject(new Error('UMD global not found after load'))
      }
    }
    script.onerror = () => {
      reject(new Error(`Failed to load ${src}`))
    }
    document.head.appendChild(script)
  })
}

function applySkin(targetSkin: Skin) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-skin', targetSkin)
  document.body?.setAttribute('data-skin', targetSkin)
}

function resetLibraryState() {
  if (typeof window !== 'undefined' && '__PRAE_INITED' in window) {
    try {
      delete (window as any).__PRAE_INITED
    } catch {
      (window as any).__PRAE_INITED = undefined
    }
  }
}

function destroyInstance(host: HTMLElement | null) {
  if (!host) return
  if (wrapperEl && wrapperEl.parentNode === host) {
    host.removeChild(wrapperEl)
  }
  wrapperEl = null
}

async function mountConsole() {
  if (typeof window === 'undefined') return
  const host = document.getElementById('prae-host')
  if (!host || mounting.value) return
  mounting.value = true
  try {
    destroyInstance(host)
    resetLibraryState()
    host.innerHTML = ''
    const mod = await loadLibrary()
    const mountCandidate = mod?.mount || mod?.init || mod?.default?.mount || null
    const AppCtor = mod?.App || mod?.default?.App || null
    const options = {
      pdf,
      audio,
      fallbackPdf,
      fallbackAudio,
      skin: skin.value,
      enablePageFollow: true,
      enableDeepLinks: true
    }
    if (typeof mountCandidate === 'function') {
      await mountCandidate(host, options)
    } else if (typeof AppCtor === 'function') {
      const appInstance = new AppCtor(options)
      await appInstance.mount(host)
    } else {
      throw new Error('Praetorius library mount function not found')
    }
    wrapperEl = host.firstElementChild as HTMLElement | null
    applySkin(skin.value)
  } finally {
    mounting.value = false
  }
}

async function remount() {
  if (typeof window === 'undefined') return
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
  const host = typeof document !== 'undefined' ? document.getElementById('prae-host') : null
  destroyInstance(host)
  resetLibraryState()
})

watch(skin, async () => {
  try {
    await remount()
  } catch (err) {
    console.error('[PraeConsoleExact] remount failed', err)
  }
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
}
</style>
