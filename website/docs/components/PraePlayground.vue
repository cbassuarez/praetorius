<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
// Defer PDF.js to the browser; SSR lacks DOMMatrix.
let getDocument: any
let GlobalWorkerOptions: any
type PDFDocumentProxy = any

const props = defineProps<{
  pdf: string
  audio: string
  fallbackPdf?: string
  fallbackAudio?: string
}>()

type Skin = 'typefolio' | 'console' | 'vite-breeze'
const skin = ref<Skin>('typefolio')
const pageFollow = ref(true)
const currentPage = ref(1)
const totalPages = ref(0)
const duration = ref(0)
const audioRef = ref<HTMLAudioElement|null>(null)
const container = ref<HTMLDivElement|null>(null)
let pdfDoc: PDFDocumentProxy | null = null
let io: IntersectionObserver | null = null

function fmtTime(t: number){ const m=Math.floor(t/60); const s=Math.floor(t%60); return `${m}:${String(s).padStart(2,'0')}` }
function computePageFor(time:number, dur:number, pages:number){
  if (!dur || !pages) return 1
  const idx = Math.max(0, Math.min(pages-1, Math.floor((time/dur)*pages)))
  return idx+1
}
function linkFromState(){
  const url = new URL(window.location.href)
  url.searchParams.set('page', String(currentPage.value))
  const t = audioRef.value?.currentTime ?? 0
  url.searchParams.set('time', fmtTime(t))
  return url.toString()
}
async function tryGetDocument(src: string){
  try { return await getDocument(src).promise } 
  catch { return null }
}
async function renderPdf(){
  if (!container.value) return
  container.value.innerHTML = ''
  pdfDoc = await tryGetDocument(props.pdf) || (props.fallbackPdf ? await tryGetDocument(props.fallbackPdf) : null)
  if (!pdfDoc) { container.value.textContent = 'Unable to load PDF.'; return }
  totalPages.value = pdfDoc.numPages
  for (let i=1;i<=pdfDoc.numPages;i++){
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.dataset.page = String(i)
    container.value.appendChild(canvas)
    await page.render({ canvasContext: ctx, viewport }).promise
  }
  if (io) io.disconnect()
  io = new IntersectionObserver((entries)=>{
    const vis = entries.filter(e=>e.isIntersecting)
      .sort((a,b)=>b.intersectionRatio - a.intersectionRatio)[0]
    if (vis?.target){
      const p = Number((vis.target as HTMLCanvasElement).dataset.page)
      if (p) currentPage.value = p
    }
  }, { root: container.value?.parentElement ?? null, threshold: [0.25,0.5,0.75] })
  container.value.querySelectorAll('canvas').forEach(c=>io!.observe(c))
}
function scrollToPage(p:number){
  const el = container.value?.querySelector(`canvas[data-page="${p}"]`) as HTMLCanvasElement|undefined
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function copyDeepLink(){ navigator.clipboard.writeText(linkFromState()) }

onMounted(async ()=>{
  // Load PDF.js only in the browser
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker?worker')
  ])
  getDocument = pdfjs.getDocument
  GlobalWorkerOptions = pdfjs.GlobalWorkerOptions
  GlobalWorkerOptions.workerSrc = (worker as any).default

  await renderPdf()
  await nextTick()
  const audio = audioRef.value!
  const primary = props.audio
  const fallback = props.fallbackAudio
  audio.src = primary
  audio.addEventListener('error', ()=>{
    if (fallback && audio.src !== fallback) audio.src = fallback
  }, { once: true })
  audio.addEventListener('loadedmetadata', ()=> duration.value = audio.duration || 0)

  const url = new URL(window.location.href)
  const qPage = Number(url.searchParams.get('page') || '0') || 0
  const qTime = url.searchParams.get('time')
  if (qTime){
    const [m='0', s='0'] = qTime.split(':')
    audio.currentTime = (Number(m)||0)*60 + (Number(s)||0)
  }
  if (qPage) { currentPage.value = Math.max(1, Math.min(totalPages.value, qPage)); scrollToPage(currentPage.value) }

  audio.addEventListener('timeupdate', ()=>{
    if (!pageFollow.value) return
    const p = computePageFor(audio.currentTime, duration.value, totalPages.value)
    if (p !== currentPage.value){ currentPage.value = p; scrollToPage(p) }
  })
})

watch(skin, ()=> document.documentElement.setAttribute('data-prae-skin', skin.value))
</script>

<template>
  <div class="prae">
    <div class="toolbar">
      <label>Skin
        <select v-model="skin" aria-label="Skin">
          <option value="typefolio">Typefolio</option>
          <option value="console">Console</option>
          <option value="vite-breeze">Vite-Breeze</option>
        </select>
      </label>
      <label><input type="checkbox" v-model="pageFollow" /> Page-follow</label>
      <button @click="copyDeepLink">Copy deep link</button>
      <span class="state">Page {{ currentPage }} / {{ totalPages }}</span>
    </div>
    <div class="pane">
      <div class="pdfwrap" aria-label="PDF viewer">
        <div ref="container" class="pdf"></div>
      </div>
      <div class="audio">
        <audio ref="audioRef" controls preload="metadata"></audio>
        <small><a :href="pdf" target="_blank" rel="noreferrer">Download PDF</a></small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prae{display:grid;gap:12px}
.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.pane{display:grid;grid-template-columns: 1fr; gap:12px}
.pdfwrap{max-height:60vh; overflow:auto; border:1px solid var(--vp-c-divider); border-radius:12px}
.pdf{display:grid;gap:8px;padding:8px;background:var(--vp-c-bg-alt)}
.audio{display:flex;flex-direction:column;gap:6px}
:global([data-prae-skin="console"]) .pdfwrap{background:#000}
:global([data-prae-skin="console"]) .pdf{background:#111}
:global([data-prae-skin="vite-breeze"]) .pdfwrap{backdrop-filter: blur(12px); background: color-mix(in oklab, var(--vp-c-bg), transparent 70%)}
</style>
