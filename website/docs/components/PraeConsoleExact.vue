<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'

type Skin = 'typefolio' | 'console' | 'vite-breeze'

const PRIMARY_PDF =
  'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf'
const PRIMARY_AUDIO =
  'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3'

const WORKS = [
  {
    id: 'demo',
    title: 'STRING QUARTET NO. 2 — _soundnoisemusic_',
    pdf: PRIMARY_PDF,
    audio: PRIMARY_AUDIO
  }
] as const

const SKIN_CLASS_MAP: Record<Skin, string> = {
  typefolio: 'typefolio',
  console: 'console',
  'vite-breeze': 'vitebreeze'
}

const skin = ref<Skin>('typefolio')

let moduleApi: any = null
let instance: any = null
let cssReady = false
let mountCycle = 0

function resolveAsset(path: string) {
  const base = withBase('/')
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedBase && normalizedPath.startsWith(normalizedBase)) {
    return normalizedPath
  }
  return `${normalizedBase}${normalizedPath}`
}

async function ensureCss() {
  if (typeof document === 'undefined' || cssReady) return
  const candidates = ['/prae-lib/praetorius.css', '/prae-lib/style.css']
  for (const candidate of candidates) {
    const already = (
      Array.from(document.styleSheets).some((sheet) => {
        try {
          const href = (sheet as CSSStyleSheet).href
          return typeof href === 'string' && href.endsWith(candidate)
        } catch {
          return false
        }
      }) ||
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some((link) =>
        link.href.endsWith(candidate)
      )
    )
    if (already) {
      cssReady = true
      return
    }
    const loaded = await new Promise<boolean>((resolve) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = resolveAsset(candidate)
      link.onload = () => {
        cssReady = true
        resolve(true)
      }
      link.onerror = () => {
        link.remove()
        resolve(false)
      }
      document.head.appendChild(link)
    })
    if (loaded) return
  }
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

function resolveMountFn(api: any): ((el: HTMLElement, options?: any) => any) | null {
  if (!api) return null
  const candidates = [api.mountPraetorius, api.mountWorksConsole, api.createWorksConsole, api.mount]
  for (const candidate of candidates) {
    if (typeof candidate === 'function') return candidate
  }
  if (typeof api === 'function') return api
  if (api.default && api.default !== api) {
    return resolveMountFn(api.default)
  }
  return null
}

async function mountConsole() {
  if (typeof document === 'undefined') return
  const host = document.getElementById('prae-host')
  if (!host) return
  const cycle = ++mountCycle
  host.innerHTML = ''
  await ensureCss()
  const mod = await loadLibrary()
  const mountFn = resolveMountFn(mod)
  if (!mountFn) {
    console.error('[PraeConsoleExact] Unable to resolve Praetorius mount function')
    return
  }

  const options = {
    works: WORKS,
    ui: { pageFollow: true, deepLinks: true },
    skin: skin.value,
    embed: true,
    mode: 'embed'
  }

  try {
    const result = mountFn(host, options)
    instance = result instanceof Promise ? await result : result
  } catch (err) {
    console.error('[PraeConsoleExact] mount failed', err)
    instance = null
  }

  document.documentElement.style.overflow = ''
  if (document.body) {
    document.body.style.overflow = ''
    document.body.classList.remove('prae-no-scroll', 'prae-takeover')
  }

  if (cycle !== mountCycle) return
  applySkin(skin.value, host)
}

function applySkin(s: Skin, host: HTMLElement) {
  if (typeof moduleApi?.setSkin === 'function' && instance) {
    try {
      moduleApi.setSkin(instance, s)
      return
    } catch {
      /* fall through */
    }
  }
  if (typeof instance?.setSkin === 'function') {
    try {
      instance.setSkin(s)
      return
    } catch {
      /* fall through */
    }
  }

  host.setAttribute('data-prae-skin', s)
  document.documentElement.setAttribute('data-prae-skin', s)
  document.body?.setAttribute('data-prae-skin', s)

  const allClasses = Object.values(SKIN_CLASS_MAP)
  for (const cls of allClasses) {
    host.classList.remove(`prae-skin-${cls}`)
  }
  const mapped = SKIN_CLASS_MAP[s] ?? s
  host.classList.add(`prae-skin-${mapped}`)
}

onMounted(() => {
  void mountConsole()
})

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return
  const host = document.getElementById('prae-host')
  if (host) {
    host.innerHTML = ''
  }
  instance = null
  document.body?.classList.remove('prae-no-scroll', 'prae-takeover')
})

watch(skin, (value) => {
  if (typeof document === 'undefined') return
  const host = document.getElementById('prae-host')
  if (host) {
    applySkin(value, host)
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
  background: var(--vp-c-bg-soft);
}
</style>
