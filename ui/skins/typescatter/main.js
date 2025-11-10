const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function praeNormalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

function praeReadStoredTheme() {
  try {
    const saved = localStorage.getItem(PRAE_THEME_STORAGE_KEY);
    if (!saved) return 'light';
    if (saved.trim().charAt(0) === '{') {
      const parsed = JSON.parse(saved);
      return praeNormalizeTheme(parsed?.mode);
    }
    return praeNormalizeTheme(saved);
  } catch (_) {
    return 'light';
  }
}

function praeSyncThemeOnDom(mode) {
  const eff = praeNormalizeTheme(mode);
  const doc = document.documentElement;
  const body = document.body;
  if (doc) {
    doc.setAttribute('data-theme', eff);
    doc.style.colorScheme = eff === 'dark' ? 'dark' : 'light';
  }
  if (body) {
    body.classList.remove(...PRAE_THEME_CLASSNAMES);
    body.classList.add(eff === 'light' ? PRAE_THEME_CLASSNAMES[0] : PRAE_THEME_CLASSNAMES[1]);
    body.setAttribute('data-theme', eff);
  }
  return eff;
}

function praeApplyTheme(mode, opts) {
  const eff = praeSyncThemeOnDom(mode);
  if (!opts || opts.persist !== false) {
    try { localStorage.setItem(PRAE_THEME_STORAGE_KEY, eff); } catch (_) {}
  }
  const btn = document.getElementById('wc-theme-toggle');
  if (btn) {
    btn.setAttribute('aria-checked', eff === 'dark' ? 'true' : 'false');
    btn.dataset.mode = eff;
    btn.textContent = eff === 'dark' ? 'Dark' : 'Light';
    btn.title = eff === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
  return eff;
}

function praeCurrentTheme() {
  const attr = document.body?.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return praeReadStoredTheme();
}

function praeCycleTheme() {
  const next = praeCurrentTheme() === 'dark' ? 'light' : 'dark';
  praeApplyTheme(next);
}

if (typeof window.praeApplyTheme !== 'function') window.praeApplyTheme = praeApplyTheme;
if (typeof window.praeCurrentTheme !== 'function') window.praeCurrentTheme = praeCurrentTheme;
if (typeof window.praeCycleTheme !== 'function') window.praeCycleTheme = praeCycleTheme;

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function formatTime(sec) {
  const clamped = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(clamped / 60);
  const s = (clamped % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function cueTime(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  if (/^\d+$/.test(String(value))) return parseInt(value, 10);
  const match = String(value).match(/^(\d+):([0-5]?\d)$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function normalizeSrc(url) {
  if (!url) return '';
  const match = String(url).match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
}

function normalizePdfUrl(url) {
  if (!url) return '';
  const match = String(url).match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) return `https://drive.google.com/file/d/${match[1]}/view?usp=drivesdk`;
  return url;
}

function choosePdfViewer(url) {
  const match = String(url).match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : url;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

function createSeededRandom(seed) {
  let h = 2166136261 >>> 0;
  const str = String(seed ?? 'seed');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function next() {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const PRAE = (window.PRAE = window.PRAE || {});
const works = Array.isArray(PRAE.works) ? PRAE.works : [];
const pfMap = (() => {
  const provided = PRAE.pageFollowMaps || {};
  if (Object.keys(provided).length) return provided;
  const map = {};
  for (const work of works) {
    if (work?.slug && work.pageFollow) {
      map[work.slug] = work.pageFollow;
    }
  }
  return map;
})();

const SCALE_STEPS = [0.85, 0.92, 1, 1.08, 1.18];
const MEASURE_MIN = 48;
const MEASURE_MAX = 88;
const MEASURE_STEP = 4;
const HASH_WORK_KEY = 'work';
const HASH_MODE_KEY = 'mode';

const state = {
  field: null,
  helpLink: null,
  helpOverlay: null,
  layoutMode: 'loose',
  scaleIndex: 2,
  measure: 66,
  blocks: [],
  blockMap: new Map(),
  worksById: new Map(),
  selectedIndex: -1,
  cuesVisibleFor: null,
  drag: null,
  updatingHash: false,
  prefersReducedMotion: typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  fieldSize: { width: 0, height: 0 },
  helpArea: { width: 0, height: 0 },
  zCounter: 20,
  pdf: { pane: null, frame: null, title: null, close: null, backdrop: null, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null, followAudio: null, followHandler: null, followSlug: null, lastPrinted: null },
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } }
};

function findWorkById(id) {
  if (id && typeof id === 'object') {
    const record = { data: id, audio: null };
    if (id.id != null) state.worksById.set(Number(id.id), record);
    return record;
  }
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  if (state.worksById.has(num)) return state.worksById.get(num);
  const data = works.find((item) => Number(item.id) === num);
  if (!data) return null;
  const record = { data, audio: null };
  state.worksById.set(num, record);
  return record;
}

function ensureAudioFor(work) {
  if (!work) return null;
  let el = document.getElementById('wc-a' + work.id);
  if (!el) {
    el = document.createElement('audio');
    el.id = 'wc-a' + work.id;
    el.preload = 'none';
    el.playsInline = true;
    const src = work.audioUrl || work.audio || '';
    if (src) el.setAttribute('data-audio', src);
    document.body.appendChild(el);
  }
  return el;
}

function ensureHudRoot() {
  let root = document.getElementById('wc-hud');
  if (!root) {
    root = document.createElement('div');
    root.id = 'wc-hud';
    root.className = 'wc-hud';
    document.body.prepend(root);
  } else {
    root.id = 'wc-hud';
    root.classList.add('wc-hud');
  }
  root.setAttribute('data-component', 'prae-hud');
  return root;
}

let hudRefs = null;

function ensureHudDom() {
  const root = ensureHudRoot();
  if (!root) return null;
  if (root.dataset.tsHud === '1' && hudRefs) return hudRefs;
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-title" data-part="title"></div>
      <div class="hud-sub" data-part="subtitle"></div>
    </div>
    <div class="hud-meter" data-part="meter"><span></span></div>
    <div class="hud-actions">
      <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play">Play</button>
    </div>`;
  const title = root.querySelector('[data-part="title"]');
  const sub = root.querySelector('[data-part="subtitle"]');
  const meter = root.querySelector('[data-part="meter"]');
  const fill = meter?.querySelector('span') || null;
  const btn = root.querySelector('[data-hud="toggle"]');
  hudRefs = { root, title, sub, meter, fill, btn };
  root.dataset.tsHud = '1';
  return hudRefs;
}

function hudSetTitle(text) {
  const refs = ensureHudDom();
  if (refs?.title) refs.title.textContent = String(text ?? '');
}

function hudSetSubtitle(text) {
  const refs = ensureHudDom();
  if (refs?.sub) refs.sub.textContent = String(text ?? '');
}

function hudSetPlaying(on) {
  const refs = ensureHudDom();
  if (refs?.btn) {
    refs.btn.textContent = on ? 'Pause' : 'Play';
    refs.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function hudSetProgress(ratio) {
  const refs = ensureHudDom();
  if (refs?.fill) {
    const clampedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    refs.fill.style.width = `${clampedRatio * 100}%`;
  }
}

function hudEnsure() {
  const refs = ensureHudDom();
  return refs?.root || ensureHudRoot();
}

function hudGetRoot() {
  ensureHudDom();
  return hudRefs?.root || ensureHudRoot();
}

function hudUpdate(id, audio) {
  const record = findWorkById(id);
  const work = record?.data;
  const name = work?.title || work?.slug || 'Work';
  const duration = audio && Number.isFinite(audio.duration) ? formatTime(audio.duration | 0) : '--:--';
  const current = audio && Number.isFinite(audio.currentTime) ? formatTime(audio.currentTime | 0) : '0:00';
  const ratio = audio && audio.duration ? Math.max(0, Math.min(1, (audio.currentTime || 0) / Math.max(1, audio.duration))) : 0;
  hudSetTitle(`Now playing — ${name}`);
  hudSetSubtitle(`${current} / ${duration}`);
  hudSetProgress(ratio);
  hudSetPlaying(!!(audio && !audio.paused));
}

function bindAudioToHud(id, audio) {
  if (!audio || audio.dataset.tsHud === '1') return;
  const update = () => hudUpdate(id, audio);
  audio.addEventListener('timeupdate', update, { passive: true });
  audio.addEventListener('ratechange', update, { passive: true });
  audio.addEventListener('volumechange', update, { passive: true });
  audio.addEventListener('loadedmetadata', update, { once: true, passive: true });
  audio.addEventListener('pause', update, { passive: true });
  audio.addEventListener('ended', update, { passive: true });
  audio.dataset.tsHud = '1';
}

function detachPageFollow() {
  if (state.pdf.followAudio && state.pdf.followHandler) {
    state.pdf.followAudio.removeEventListener('timeupdate', state.pdf.followHandler);
    state.pdf.followAudio.removeEventListener('seeking', state.pdf.followHandler);
  }
  state.pdf.followAudio = null;
  state.pdf.followHandler = null;
  state.pdf.followSlug = null;
  state.pdf.lastPrinted = null;
}

function printedPageForTime(cfg, tSec) {
  const time = (tSec || 0) + (cfg.mediaOffsetSec || 0);
  let current = cfg.pageMap?.[0]?.page ?? 1;
  for (const row of cfg.pageMap || []) {
    const at = typeof row.at === 'number' ? row.at : cueTime(row.at);
    if (time >= at) current = row.page; else break;
  }
  return current;
}

function computePdfPage(slug, tSec) {
  const cfg = pfMap?.[slug];
  if (!cfg) return 1;
  const printed = printedPageForTime(cfg, tSec || 0);
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
}

function attachPageFollow(slug, audio) {
  detachPageFollow();
  if (!slug || !audio) return;
  const cfg = pfMap?.[slug];
  if (!cfg) return;
  const handler = () => {
    const printed = printedPageForTime(cfg, audio.currentTime || 0);
    if (printed !== state.pdf.lastPrinted) {
      state.pdf.lastPrinted = printed;
      const pdfPage = computePdfPage(slug, audio.currentTime || 0);
      window.dispatchEvent(new CustomEvent('wc:pdf-goto', {
        detail: { slug, printedPage: printed, pdfPage }
      }));
    }
  };
  state.pdf.followAudio = audio;
  state.pdf.followHandler = handler;
  state.pdf.followSlug = slug;
  state.pdf.lastPrinted = null;
  audio.addEventListener('timeupdate', handler, { passive: true });
  audio.addEventListener('seeking', handler, { passive: true });
  handler();
}

function ensurePdfDom() {
  if (state.pdf.pane) return state.pdf;
  let pane = document.querySelector('.ts-pdfpane');
  let backdrop = document.querySelector('.ts-pdf-backdrop');
  if (!pane) {
    backdrop = document.createElement('div');
    backdrop.className = 'ts-pdf-backdrop';
    backdrop.setAttribute('hidden', '');
    pane = document.createElement('aside');
    pane.className = 'ts-pdfpane';
    pane.setAttribute('aria-hidden', 'true');
    pane.setAttribute('tabindex', '-1');
    pane.setAttribute('hidden', '');
    pane.innerHTML = `
      <header class="ts-pdfbar">
        <p class="ts-pdf-title" aria-live="polite"></p>
        <a href="#" class="ts-pdf-close" role="button">close</a>
      </header>
      <iframe class="ts-pdf-frame" title="Score PDF" loading="lazy" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>`;
    document.body.append(backdrop, pane);
  }
  const frame = pane.querySelector('.ts-pdf-frame');
  const title = pane.querySelector('.ts-pdf-title');
  const close = pane.querySelector('.ts-pdf-close');
  if (close && !close.dataset.bound) {
    close.dataset.bound = '1';
    close.addEventListener('click', (event) => {
      event.preventDefault();
      hidePdfPane();
    });
  }
  if (backdrop && !backdrop.dataset.bound) {
    backdrop.dataset.bound = '1';
    backdrop.addEventListener('click', hidePdfPane);
  }
  state.pdf.pane = pane;
  state.pdf.frame = frame;
  state.pdf.title = title;
  state.pdf.close = close;
  state.pdf.backdrop = backdrop;
  return state.pdf;
}

function gotoPdfPage(pageNum) {
  const { frame } = state.pdf;
  if (!frame || !frame.src) return;
  if (!/\/viewer\.html/i.test(frame.src)) return;
  try {
    const url = new URL(frame.src, location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const current = Number(hash.get('page') || '1');
    const next = Number(pageNum || 1);
    if (current === next) return;
    hash.set('page', String(next));
    if (!hash.has('zoom')) hash.set('zoom', 'page-width');
    if (!hash.has('sidebar')) hash.set('sidebar', '0');
    url.hash = '#' + hash.toString();
    state.pdf.viewerReady = false;
    frame.src = url.toString();
  } catch (err) {
    console.warn('Failed to navigate PDF', err);
  }
}

function openPdfFor(id) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const raw = normalizePdfUrl(work.pdfUrl || work.pdf);
  if (!raw) return;
  const viewerUrl = choosePdfViewer(raw);
  const { pane, frame, title, backdrop } = ensurePdfDom();
  if (!pane || !frame) {
    window.open(viewerUrl, '_blank', 'noopener');
    return;
  }
  state.pdf.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.pdf.currentSlug = work.slug || null;
  pane.removeAttribute('hidden');
  pane.setAttribute('aria-hidden', 'false');
  pane.focus?.({ preventScroll: true });
  backdrop?.removeAttribute('hidden');
  document.body.classList.add('ts-pdf-open');
  document.body.classList.add('ts-reader-open');
  if (title) title.textContent = String(work.title || 'Score');
  frame.src = 'about:blank';
  state.pdf.viewerReady = false;
  requestAnimationFrame(() => {
    frame.src = viewerUrl;
    state.pdf.pendingGoto = null;
  });
  if (work.slug) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) attachPageFollow(work.slug, audio);
  }
}

function hidePdfPane() {
  const { pane, frame, backdrop } = ensurePdfDom();
  pane?.setAttribute('aria-hidden', 'true');
  pane?.setAttribute('hidden', '');
  backdrop?.setAttribute('hidden', '');
  document.body.classList.remove('ts-pdf-open');
  document.body.classList.remove('ts-reader-open');
  if (frame) frame.src = 'about:blank';
  state.pdf.viewerReady = false;
  state.pdf.pendingGoto = null;
  state.pdf.currentSlug = null;
  detachPageFollow();
  const restore = state.pdf.restoreFocus;
  state.pdf.restoreFocus = null;
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus());
  }
}

window.addEventListener('wc:pdf-goto', (event) => {
  const detail = event?.detail || {};
  ensurePdfDom();
  if (!state.pdf.viewerReady || (detail.slug && detail.slug !== state.pdf.currentSlug)) {
    state.pdf.pendingGoto = detail;
    return;
  }
  if (detail.pdfPage) gotoPdfPage(detail.pdfPage);
});

function getAudioSourceFor(work) {
  return work?.audioUrl || work?.audio || '';
}

function ensureAudioTags() {
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
}

function markPlaying(id, on) {
  const block = state.blockMap.get(Number(id));
  if (block?.el) {
    block.el.dataset.playing = on ? '1' : '0';
  }
  hudSetPlaying(on);
}

function playAt(id, t = 0) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const src = normalizeSrc(getAudioSourceFor(work));
  if (!src) return;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  state.hudState.last = { id: work.id, at: t || 0 };
  if (!audio.src) {
    audio.src = src;
    audio.load();
  }
  const seekAndPlay = () => {
    try { audio.currentTime = Math.max(0, Number(t) || 0); } catch (_) {}
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    markPlaying(work.id, true);
    bindAudioToHud(work.id, audio);
    requestAnimationFrame(() => hudUpdate(work.id, audio));
    if (work.slug) attachPageFollow(work.slug, audio);
  };
  if (audio.readyState >= 1) {
    seekAndPlay();
  } else {
    audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
  }
}

function togglePlayFor(id) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return false;
  const src = normalizeSrc(getAudioSourceFor(work));
  if (!src) return false;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return false;
  bindAudioToHud(work.id, audio);
  if (audio.paused || audio.ended) {
    playAt(work.id, 0);
    return true;
  }
  audio.pause();
  markPlaying(work.id, false);
  hudUpdate(work.id, audio);
  return true;
}

const hudApi = {
  ensure: hudEnsure,
  setSubtitle: hudSetSubtitle,
  setPlaying: hudSetPlaying,
  setProgress: hudSetProgress,
  getRoot: hudGetRoot,
  setTitle: hudSetTitle
};

PRAE.hud = Object.assign({}, PRAE.hud || {}, hudApi);
PRAE.hud.ensure();

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'absolute';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
  document.body.removeChild(temp);
  return ok;
}

function parseHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return { workId: null, mode: null };
  const params = new URLSearchParams(hash);
  const workVal = params.get(HASH_WORK_KEY);
  const modeVal = params.get(HASH_MODE_KEY);
  const workId = workVal != null ? Number(workVal) : null;
  const mode = modeVal === 'neat' ? 'neat' : (modeVal === 'loose' ? 'loose' : null);
  return { workId: Number.isNaN(workId) ? null : workId, mode };
}

function updateHash() {
  if (state.updatingHash) return;
  const params = new URLSearchParams();
  const block = state.blocks[state.selectedIndex];
  if (block?.work?.id != null) params.set(HASH_WORK_KEY, String(block.work.id));
  if (state.layoutMode) params.set(HASH_MODE_KEY, state.layoutMode);
  const next = params.toString();
  const hash = next ? `#${next}` : '#';
  state.updatingHash = true;
  history.replaceState(null, '', hash);
  setTimeout(() => { state.updatingHash = false; }, 80);
}

function hydrateFromHash() {
  if (state.updatingHash) return;
  const { workId, mode } = parseHash();
  if (mode && mode !== state.layoutMode) {
    state.layoutMode = mode;
    applyLayout();
  }
  if (workId != null) {
    const index = state.blocks.findIndex((block) => Number(block.work.id) === Number(workId));
    if (index >= 0) selectBlock(index, { focus: false, updateHash: false });
  }
}

function applyTypeSettings() {
  const scale = SCALE_STEPS[clamp(state.scaleIndex, 0, SCALE_STEPS.length - 1)] || 1;
  document.documentElement.style.setProperty('--ts-scale', scale.toFixed(3));
  document.documentElement.style.setProperty('--measure', `${state.measure}ch`);
}

function parseNumericVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = parseFloat(value);
  if (Number.isFinite(parsed)) return parsed;
  return fallback;
}

function computeHelpArea() {
  const link = state.helpLink;
  if (!link) {
    state.helpArea = { width: 0, height: 0 };
    return;
  }
  state.helpArea = {
    width: link.offsetWidth + 32,
    height: link.offsetHeight + 32
  };
}

function clampBlockPosition(block, x, y) {
  const fieldWidth = state.fieldSize.width || state.field?.clientWidth || window.innerWidth;
  const fieldHeight = state.fieldSize.height || state.field?.clientHeight || window.innerHeight;
  const margin = 24;
  const width = block.width || block.el.offsetWidth;
  const height = block.height || block.el.offsetHeight;
  const minX = margin;
  const maxX = Math.max(minX, fieldWidth - width - margin);
  const minY = margin;
  const maxY = Math.max(minY, fieldHeight - height - margin);
  let clampedX = clamp(x, minX, maxX);
  let clampedY = clamp(y, minY, maxY);
  if (state.helpLink) {
    const safeTop = fieldHeight - state.helpArea.height;
    const limitY = Math.max(minY, safeTop - height);
    if (clampedY > limitY) clampedY = limitY;
    if (clampedY + height > safeTop) {
      const minSafeX = Math.max(minX, state.helpArea.width);
      if (clampedX < minSafeX) clampedX = Math.min(maxX, minSafeX);
    }
  }
  return { x: clampedX, y: clampedY };
}

function updateBlockTransform(block) {
  const mode = state.layoutMode;
  const scatter = mode === 'loose' ? (block.scatter || { x: 0, y: 0, r: 0 }) : { x: 0, y: 0, r: 0 };
  const baseX = block.baseX ?? 0;
  const baseY = block.baseY ?? 0;
  const dragX = block.dragX || 0;
  const dragY = block.dragY || 0;
  const rawX = baseX + dragX + scatter.x;
  const rawY = baseY + dragY + scatter.y;
  const { x, y } = clampBlockPosition(block, rawX, rawY);
  block.positionX = x;
  block.positionY = y;
  const rotation = mode === 'loose' ? scatter.r : 0;
  block.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
}

function applyLayout() {
  const field = state.field;
  if (!field) return;
  computeHelpArea();
  const header = document.querySelector('.ts-header');
  const headerHeight = header?.offsetHeight || 0;
  const rect = field.getBoundingClientRect();
  const fieldWidth = rect.width || window.innerWidth || 1024;
  const marginTop = 40;
  const gapY = 72;
  const blocks = state.blocks;
  const jitterX = state.prefersReducedMotion ? 0 : parseNumericVar('--jitter-x', 120);
  const jitterY = state.prefersReducedMotion ? 0 : parseNumericVar('--jitter-y', 80);
  const rotateMax = state.prefersReducedMotion ? 0 : parseNumericVar('--rotate-max', 5);
  blocks.forEach((block) => {
    block.el.style.transform = 'translate3d(0, 0, 0)';
    block.width = block.el.offsetWidth;
    block.height = block.el.offsetHeight;
  });
  const avgWidth = blocks.reduce((acc, block) => acc + (block.width || 320), 0) / (blocks.length || 1);
  const targetWidth = clamp(avgWidth, 280, 480);
  const columns = clamp(Math.floor(fieldWidth / (targetWidth + 60)) || 1, 1, 4);
  const columnWidth = fieldWidth / columns;
  const columnHeights = new Array(columns).fill(marginTop);
  blocks.forEach((block, index) => {
    const columnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    const xBase = (columnWidth * columnIndex) + Math.max(24, (columnWidth - block.width) / 2);
    const yBase = columnHeights[columnIndex];
    columnHeights[columnIndex] += block.height + gapY;
    block.baseX = xBase;
    block.baseY = yBase;
    if (!block.scatter || state.prefersReducedMotion) {
      const seed = `${block.work.id || index}-${block.work.slug || index}`;
      const rand = createSeededRandom(seed);
      block.scatter = {
        x: state.prefersReducedMotion ? 0 : (rand() - 0.5) * 2 * jitterX,
        y: state.prefersReducedMotion ? 0 : (rand() - 0.5) * 2 * jitterY,
        r: state.prefersReducedMotion ? 0 : (rand() - 0.5) * 2 * rotateMax
      };
    }
    updateBlockTransform(block);
  });
  const contentHeight = Math.max(...columnHeights, marginTop + 320) + state.helpArea.height;
  const minHeight = Math.max(window.innerHeight - headerHeight, contentHeight);
  field.style.height = `${Math.ceil(minHeight)}px`;
  state.fieldSize = { width: fieldWidth, height: minHeight };
  blocks.forEach((block, idx) => {
    block.el.style.zIndex = String(20 + idx);
  });
  if (state.cuesVisibleFor) {
    const target = state.blockMap.get(Number(state.cuesVisibleFor));
    if (target?.cuesEl && target.cuesVisible) target.cuesEl.hidden = false;
  }
}

function beginDrag(block, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  block.el.setPointerCapture(event.pointerId);
  block.el.classList.add('is-dragging');
  block.el.style.zIndex = String(state.zCounter += 1);
  state.drag = {
    block,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: block.dragX || 0,
    originY: block.dragY || 0
  };
}

function moveDrag(event) {
  const drag = state.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  drag.block.dragX = drag.originX + dx;
  drag.block.dragY = drag.originY + dy;
  updateBlockTransform(drag.block);
}

function endDrag(event) {
  const drag = state.drag;
  if (!drag || (event && drag.pointerId !== event.pointerId)) return;
  drag.block.el.classList.remove('is-dragging');
  drag.block.el.releasePointerCapture?.(drag.pointerId);
  state.drag = null;
}

function showFeedback(block, text) {
  if (!block.feedbackEl) return;
  block.feedbackEl.textContent = text;
  block.feedbackEl.classList.add('is-visible');
  clearTimeout(block.feedbackTimer);
  block.feedbackTimer = setTimeout(() => {
    block.feedbackEl.classList.remove('is-visible');
  }, 1600);
}

function hideAllCues() {
  state.blocks.forEach((block) => {
    if (block.cuesEl) {
      block.cuesEl.hidden = true;
      block.cuesVisible = false;
    }
  });
  state.cuesVisibleFor = null;
}

function toggleCuesForSelected() {
  const block = state.blocks[state.selectedIndex];
  if (!block) return;
  if (!block.cuesEl || !block.cuesEl.childElementCount) {
    showFeedback(block, 'no timecodes');
    return;
  }
  const key = block.work.id != null ? block.work.id : `idx-${block.index}`;
  const shouldShow = state.cuesVisibleFor !== key;
  hideAllCues();
  if (shouldShow) {
    block.cuesEl.hidden = false;
    block.cuesVisible = true;
    state.cuesVisibleFor = key;
  }
}

function selectBlock(index, opts = {}) {
  const { focus = true, updateHash: doUpdate = true } = opts;
  if (index < 0 || index >= state.blocks.length) {
    if (state.selectedIndex !== -1) {
      const prev = state.blocks[state.selectedIndex];
      prev?.el.classList.remove('is-selected');
    }
    hideAllCues();
    state.selectedIndex = -1;
    if (doUpdate) updateHash();
    return;
  }
  if (state.selectedIndex !== -1 && state.selectedIndex !== index) {
    const prev = state.blocks[state.selectedIndex];
    prev?.el.classList.remove('is-selected');
    if (prev && state.cuesVisibleFor === prev.work.id) {
      hideAllCues();
    }
  }
  const block = state.blocks[index];
  state.selectedIndex = index;
  block.el.classList.add('is-selected');
  if (focus) block.el.focus({ preventScroll: true });
  if (doUpdate) updateHash();
}

function selectNext(delta) {
  if (!state.blocks.length) return;
  const next = state.selectedIndex < 0 ? 0 : clamp(state.selectedIndex + delta, 0, state.blocks.length - 1);
  selectBlock(next, { focus: true, updateHash: true });
}

function toggleLayoutMode() {
  state.layoutMode = state.layoutMode === 'loose' ? 'neat' : 'loose';
  applyLayout();
  updateHash();
}

function resetDragPositions() {
  state.blocks.forEach((block) => {
    block.dragX = 0;
    block.dragY = 0;
    updateBlockTransform(block);
  });
}

function adjustScale(delta) {
  state.scaleIndex = clamp(state.scaleIndex + delta, 0, SCALE_STEPS.length - 1);
  applyTypeSettings();
  applyLayout();
}

function adjustMeasure(delta) {
  state.measure = clamp(state.measure + delta, MEASURE_MIN, MEASURE_MAX);
  applyTypeSettings();
  applyLayout();
}

function copyDeepLink(block) {
  if (!block?.work?.id) return;
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(block.work.id));
  params.set(HASH_MODE_KEY, state.layoutMode);
  const url = new URL(location.href);
  url.hash = params.toString();
  copyToClipboard(url.toString()).then((ok) => {
    showFeedback(block, ok ? 'link copied' : url.toString());
  }).catch(() => {
    showFeedback(block, url.toString());
  });
}

function attemptPlay(block) {
  if (!block?.work) return;
  const hasAudio = !!normalizeSrc(getAudioSourceFor(block.work));
  if (!hasAudio) {
    showFeedback(block, 'no audio');
    return;
  }
  const played = togglePlayFor(block.work.id);
  if (!played) {
    showFeedback(block, 'audio unavailable');
  }
}

function attemptOpenPdf(block) {
  if (!block?.work) return;
  const hasPdf = !!normalizePdfUrl(block.work.pdfUrl || block.work.pdf);
  if (!hasPdf) {
    showFeedback(block, 'no score');
    return;
  }
  openPdfFor(block.work.id);
}

function handleKeydown(event) {
  const activeTag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
  if ((event.key === 'd' || event.key === 'D') && (event.altKey || event.metaKey)) {
    event.preventDefault();
    praeCycleTheme();
    return;
  }
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      selectNext(1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      selectNext(-1);
      break;
    case ' ': // Space
      if (state.selectedIndex >= 0) {
        event.preventDefault();
        attemptPlay(state.blocks[state.selectedIndex]);
      }
      break;
    case 'S':
    case 's':
      if (state.selectedIndex >= 0) {
        event.preventDefault();
        attemptOpenPdf(state.blocks[state.selectedIndex]);
      }
      break;
    case 'C':
    case 'c':
      if (state.selectedIndex >= 0) {
        event.preventDefault();
        copyDeepLink(state.blocks[state.selectedIndex]);
      }
      break;
    case '@':
      event.preventDefault();
      toggleCuesForSelected();
      break;
    case 'L':
    case 'l':
      event.preventDefault();
      toggleLayoutMode();
      break;
    case 'R':
    case 'r':
      event.preventDefault();
      resetDragPositions();
      break;
    case '[':
      event.preventDefault();
      adjustScale(-1);
      break;
    case ']':
      event.preventDefault();
      adjustScale(1);
      break;
    case ',':
      event.preventDefault();
      adjustMeasure(-MEASURE_STEP);
      break;
    case '.':
      event.preventDefault();
      adjustMeasure(MEASURE_STEP);
      break;
    case '?':
      event.preventDefault();
      toggleHelpOverlay();
      break;
    case 'Escape':
      if (!hideHelpOverlayIfVisible()) {
        hidePdfPane();
      }
      break;
    default:
      break;
  }
}

function toggleHelpOverlay(force) {
  const overlay = state.helpOverlay;
  if (!overlay) return;
  const show = force != null ? force : overlay.hasAttribute('hidden');
  if (show) {
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  } else {
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function hideHelpOverlayIfVisible() {
  const overlay = state.helpOverlay;
  if (overlay && !overlay.hasAttribute('hidden')) {
    toggleHelpOverlay(false);
    return true;
  }
  return false;
}

function buildBlock(work, index) {
  const el = document.createElement('article');
  el.className = 'ts-block';
  el.dataset.workId = work.id != null ? String(work.id) : '';
  el.dataset.slug = work.slug || '';
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'group');

  const title = document.createElement('h2');
  title.className = 'ts-block-title';
  title.textContent = work.title || work.slug || `Work ${index + 1}`;

  const slug = document.createElement('p');
  slug.className = 'ts-block-slug';
  slug.textContent = (work.slug || '').toUpperCase();

  const one = document.createElement('p');
  one.className = 'ts-block-one';
  one.textContent = work.one || '';

  el.append(title, slug, one);

  const block = {
    el,
    work,
    index,
    cuesEl: null,
    feedbackEl: null,
    feedbackTimer: null,
    dragX: 0,
    dragY: 0,
    scatter: null,
    cuesVisible: false
  };

  const cuesEl = document.createElement('div');
  cuesEl.className = 'ts-block-cues';
  cuesEl.setAttribute('hidden', '');
  const cues = Array.isArray(work.cues) ? work.cues : [];
  cues.forEach((cue) => {
    const raw = typeof cue === 'object' ? (cue.label || cue.at || cue.time || cue.t) : cue;
    const seconds = typeof cue === 'object' ? cueTime(cue.at ?? cue.time ?? cue.t ?? cue.label) : cueTime(cue);
    if (!raw && !seconds) return;
    const label = raw ? String(raw) : formatTime(seconds);
    const text = label.startsWith('@') ? label : `@${label}`;
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'ts-block-cue';
    link.textContent = text;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (work.id != null) {
        if (normalizeSrc(getAudioSourceFor(work))) {
          playAt(work.id, seconds || 0);
        } else {
          showFeedback(block, 'no audio');
        }
      }
    });
    cuesEl.appendChild(link);
  });
  if (cuesEl.childElementCount) {
    el.appendChild(cuesEl);
    block.cuesEl = cuesEl;
  }

  const feedback = document.createElement('p');
  feedback.className = 'ts-feedback';
  el.appendChild(feedback);
  block.feedbackEl = feedback;

  el.addEventListener('pointerdown', (event) => beginDrag(block, event));
  el.addEventListener('pointermove', moveDrag);
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('click', () => {
    const idx = state.blocks.indexOf(block);
    selectBlock(idx, { focus: true, updateHash: true });
  });
  el.addEventListener('dblclick', (event) => {
    event.preventDefault();
    selectBlock(state.blocks.indexOf(block), { focus: true, updateHash: true });
    attemptPlay(block);
  });
  el.addEventListener('focus', () => {
    const idx = state.blocks.indexOf(block);
    if (idx >= 0 && state.selectedIndex !== idx) {
      selectBlock(idx, { focus: false, updateHash: true });
    }
  });

  return block;
}

function renderWorks() {
  const field = state.field;
  if (!field) return;
  field.innerHTML = '';
  state.blocks = [];
  state.blockMap.clear();
  if (!works.length) {
    const empty = document.createElement('p');
    empty.className = 'ts-field-empty';
    empty.textContent = 'No works yet.';
    field.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  works.forEach((work, index) => {
    const block = buildBlock(work, index);
    state.blocks.push(block);
    if (work.id != null) state.blockMap.set(Number(work.id), block);
    fragment.appendChild(block.el);
  });
  field.appendChild(fragment);
  requestAnimationFrame(() => applyLayout());
}

function setupSiteBrand() {
  const site = PRAE.config?.site || {};
  const nameParts = [site.fullName, [site.firstName, site.lastName].filter(Boolean).join(' ')].filter(Boolean);
  const fallbackName = nameParts[0] || nameParts[1] || site.title || site.copyrightName || 'Praetorius';
  const title = String(fallbackName || '').trim();
  const subtitle = site.subtitle ? String(site.subtitle) : '';
  document.querySelectorAll('[data-site-title]').forEach((el) => { el.textContent = title; });
  document.querySelectorAll('[data-site-subtitle]').forEach((el) => { el.textContent = subtitle; });
  const nav = document.getElementById('prae-nav');
  if (nav) {
    const links = Array.isArray(site.links) ? site.links.filter((link) => link?.href && link?.label) : [];
    nav.innerHTML = '';
    if (!links.length) {
      nav.setAttribute('hidden', '');
    } else {
      nav.removeAttribute('hidden');
      links.forEach((link) => {
        const a = document.createElement('a');
        a.href = link.href;
        a.textContent = link.label;
        nav.appendChild(a);
      });
    }
  }
}

function initThemeToggle() {
  const toggle = document.getElementById('wc-theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    praeCycleTheme();
  });
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      praeCycleTheme();
    }
  });
}

function bindHelp() {
  if (state.helpLink) {
    state.helpLink.addEventListener('click', (event) => {
      event.preventDefault();
      toggleHelpOverlay();
    });
  }
}

function handleResize() {
  applyLayout();
}

function hydrateInitialSettings() {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', (event) => {
      state.prefersReducedMotion = !!event.matches;
      state.blocks.forEach((block) => {
        if (event.matches) {
          block.scatter = { x: 0, y: 0, r: 0 };
        } else {
          block.scatter = null;
        }
      });
      applyLayout();
    });
  }
  const computedMeasure = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--measure'));
  if (Number.isFinite(computedMeasure)) state.measure = computedMeasure;
  applyTypeSettings();
}

ready(() => {
  state.field = document.getElementById('ts-field');
  state.helpLink = document.getElementById('ts-help-toggle');
  state.helpOverlay = document.getElementById('ts-help-overlay');
  setupSiteBrand();
  initThemeToggle();
  bindHelp();
  hydrateInitialSettings();
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  renderWorks();
  hydrateFromHash();
  ensureAudioTags();
  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('hashchange', hydrateFromHash);
});

window.addEventListener('message', (event) => {
  if (!event?.data || typeof event.data !== 'object') return;
  if (event.data.type === 'wc:pdf-ready') {
    state.pdf.viewerReady = true;
    const pending = state.pdf.pendingGoto;
    if (pending?.pdfPage) {
      gotoPdfPage(pending.pdfPage);
      state.pdf.pendingGoto = null;
    }
  }
});
