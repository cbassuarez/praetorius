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
  const host = document.getElementById('works-console');
  if (doc) {
    doc.setAttribute('data-theme', eff);
    doc.style.colorScheme = eff === 'dark' ? 'dark' : 'light';
  }
  if (body) {
    body.classList.remove(...PRAE_THEME_CLASSNAMES);
    body.classList.add(eff === 'light' ? PRAE_THEME_CLASSNAMES[0] : PRAE_THEME_CLASSNAMES[1]);
    body.setAttribute('data-theme', eff);
  }
  if (host) {
    host.classList.remove(...PRAE_THEME_CLASSNAMES);
    host.classList.add(eff === 'light' ? PRAE_THEME_CLASSNAMES[0] : PRAE_THEME_CLASSNAMES[1]);
    host.setAttribute('data-theme', eff);
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
    btn.setAttribute('aria-checked', String(eff === 'dark'));
    btn.dataset.mode = eff;
    btn.textContent = eff === 'dark' ? 'Theme: Dark' : 'Theme: Light';
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

const SCALE_STEPS = [0.9, 0.96, 1, 1.08, 1.18];
const MEASURE_MIN = 58;
const MEASURE_MAX = 78;
const MEASURE_STEP = 4;
const HASH_WORK_KEY = 'work';
const HASH_MODE_KEY = 'mode';

const state = {
  field: null,
  controls: null,
  reader: null,
  footer: null,
  tiles: new Map(),
  worksById: new Map(),
  layoutMode: 'loose',
  scaleIndex: 2,
  baseMeasure: 66,
  currentMeasure: 66,
  dragging: null,
  overlay: { id: null, restore: null },
  pdf: { pane: null, frame: null, title: null, close: null, backdrop: null, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null, followAudio: null, followHandler: null, followSlug: null, lastPrinted: null },
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  updatingHash: false,
  prefersReducedMotion: typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  zCounter: 10
};

function findWorkById(id) {
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
    pane.setAttribute('role', 'dialog');
    pane.setAttribute('aria-modal', 'true');
    pane.setAttribute('aria-hidden', 'true');
    pane.setAttribute('tabindex', '-1');
    pane.setAttribute('hidden', '');
    pane.innerHTML = `
      <header class="ts-pdfbar">
        <div class="ts-pdf-title" aria-live="polite"></div>
        <button type="button" class="ts-pdf-close">Close</button>
      </header>
      <iframe class="ts-pdf-frame" title="Score PDF" loading="lazy" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>`;
    document.body.append(backdrop, pane);
  }
  const frame = pane.querySelector('.ts-pdf-frame');
  const title = pane.querySelector('.ts-pdf-title');
  const close = pane.querySelector('.ts-pdf-close');
  state.pdf = Object.assign(state.pdf, { pane, frame, title, close, backdrop, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null });
  if (backdrop && backdrop.dataset.tsPdf !== '1') {
    backdrop.addEventListener('click', hidePdfPane);
    backdrop.dataset.tsPdf = '1';
  }
  if (close && close.dataset.tsPdf !== '1') {
    close.addEventListener('click', hidePdfPane);
    close.dataset.tsPdf = '1';
  }
  if (frame && frame.dataset.tsPdf !== '1') {
    frame.addEventListener('load', () => {
      state.pdf.viewerReady = true;
      const pending = state.pdf.pendingGoto;
      if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
        gotoPdfPage(pending.pdfPage);
        state.pdf.pendingGoto = null;
      }
    });
    frame.dataset.tsPdf = '1';
  }
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

function getActiveAudioInfo() {
  if (!works.length) return { id: null, audio: null };
  for (const work of works) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio && !audio.paused && !audio.ended) {
      return { id: work.id, audio };
    }
  }
  return { id: null, audio: null };
}

function markPlaying(id, on) {
  const tile = state.tiles.get(Number(id));
  if (tile?.el) {
    tile.el.dataset.playing = on ? '1' : '0';
  }
  hudSetPlaying(on);
}

function ensureAudioTags() {
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
}

function getAudioSourceFor(work) {
  return work?.audioUrl || work?.audio || '';
}

function playAt(id, t = 0) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  state.hudState.last = { id: work.id, at: t || 0 };
  if (!audio.src) {
    const src = normalizeSrc(getAudioSourceFor(work));
    if (src) {
      audio.src = src;
      audio.load();
    }
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
  if (!work) return;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  bindAudioToHud(work.id, audio);
  if (audio.paused || audio.ended) {
    playAt(work.id, 0);
  } else {
    audio.pause();
    markPlaying(work.id, false);
    hudUpdate(work.id, audio);
  }
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

function updateHash({ workId }) {
  state.updatingHash = true;
  const params = new URLSearchParams();
  if (workId != null) params.set(HASH_WORK_KEY, String(workId));
  if (state.layoutMode) params.set(HASH_MODE_KEY, state.layoutMode);
  const next = params.toString();
  const hash = next ? `#${next}` : '#';
  history.replaceState(null, '', hash);
  setTimeout(() => { state.updatingHash = false; }, 60);
}

function hydrateFromHash() {
  if (state.updatingHash) return;
  const { workId, mode } = parseHash();
  if (mode) {
    state.layoutMode = mode;
    updateModeLabel();
    applyLayout();
  }
  if (workId != null) {
    const tile = state.tiles.get(workId);
    if (tile?.el) {
      openReaderFor(workId, tile.el);
    }
  } else {
    closeReader();
  }
}

function applyTypeScale() {
  const scale = SCALE_STEPS[clamp(state.scaleIndex, 0, SCALE_STEPS.length - 1)] || 1;
  document.documentElement.style.setProperty('--ts-scale', scale.toFixed(3));
  document.documentElement.style.setProperty('--measure', `${state.currentMeasure}ch`);
}

function updateControlsState() {
  if (!state.controls) return;
  const modeBtn = state.controls.querySelector('[data-control="mode"]');
  if (modeBtn) {
    const next = state.layoutMode === 'loose' ? 'Neat' : 'Loose';
    modeBtn.textContent = `Switch to ${next}`;
    modeBtn.setAttribute('aria-pressed', state.layoutMode === 'neat' ? 'true' : 'false');
  }
  const sizeDown = state.controls.querySelector('[data-control="size-dec"]');
  const sizeUp = state.controls.querySelector('[data-control="size-inc"]');
  const sizeDownDisabled = state.scaleIndex <= 0;
  const sizeUpDisabled = state.scaleIndex >= SCALE_STEPS.length - 1;
  if (sizeDown) {
    sizeDown.setAttribute('aria-disabled', sizeDownDisabled ? 'true' : 'false');
    sizeDown.disabled = sizeDownDisabled;
  }
  if (sizeUp) {
    sizeUp.setAttribute('aria-disabled', sizeUpDisabled ? 'true' : 'false');
    sizeUp.disabled = sizeUpDisabled;
  }
  const measureDown = state.controls.querySelector('[data-control="measure-dec"]');
  const measureUp = state.controls.querySelector('[data-control="measure-inc"]');
  const measureDownDisabled = state.currentMeasure <= MEASURE_MIN;
  const measureUpDisabled = state.currentMeasure >= MEASURE_MAX;
  if (measureDown) {
    measureDown.setAttribute('aria-disabled', measureDownDisabled ? 'true' : 'false');
    measureDown.disabled = measureDownDisabled;
  }
  if (measureUp) {
    measureUp.setAttribute('aria-disabled', measureUpDisabled ? 'true' : 'false');
    measureUp.disabled = measureUpDisabled;
  }
  updateFullscreenButton();
}

function renderControls(container) {
  if (!container) return;
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'ts-control-panel';
  panel.innerHTML = `
    <button type="button" data-control="mode" aria-pressed="false">Switch to Neat</button>
    <button type="button" data-control="size-dec" aria-label="Decrease type size">A−</button>
    <button type="button" data-control="size-inc" aria-label="Increase type size">A+</button>
    <button type="button" data-control="measure-dec" aria-label="Narrow measure">Measure −</button>
    <button type="button" data-control="measure-inc" aria-label="Widen measure">Measure +</button>
    <button type="button" data-control="fullscreen" aria-pressed="false">Enter fullscreen</button>
    <button type="button" data-control="reset">Reset</button>`;
  container.appendChild(panel);
  container.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-control]');
    if (!btn) return;
    const control = btn.getAttribute('data-control');
    handleControl(control, btn);
  });
  container.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        btn.click();
      }
    });
  });
  updateControlsState();
}

function handleControl(control, button) {
  switch (control) {
    case 'mode':
      state.layoutMode = state.layoutMode === 'loose' ? 'neat' : 'loose';
      updateModeLabel();
      applyLayout();
      updateHash({ workId: state.overlay.id });
      break;
    case 'size-dec':
      if (state.scaleIndex > 0) {
        state.scaleIndex -= 1;
        applyTypeScale();
        scheduleLayout();
      }
      break;
    case 'size-inc':
      if (state.scaleIndex < SCALE_STEPS.length - 1) {
        state.scaleIndex += 1;
        applyTypeScale();
        scheduleLayout();
      }
      break;
    case 'measure-dec':
      if (state.currentMeasure > MEASURE_MIN) {
        state.currentMeasure = Math.max(MEASURE_MIN, state.currentMeasure - MEASURE_STEP);
        applyTypeScale();
        scheduleLayout();
      }
      break;
    case 'measure-inc':
      if (state.currentMeasure < MEASURE_MAX) {
        state.currentMeasure = Math.min(MEASURE_MAX, state.currentMeasure + MEASURE_STEP);
        applyTypeScale();
        scheduleLayout();
      }
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'reset':
      resetLayout();
      break;
    default:
      break;
  }
  updateControlsState();
}

function resetLayout() {
  state.layoutMode = 'loose';
  state.scaleIndex = 2;
  state.currentMeasure = state.baseMeasure;
  state.tiles.forEach((tile) => {
    tile.dragX = 0;
    tile.dragY = 0;
    tile.el.style.zIndex = '';
    tile.el.classList.remove('is-dragging');
  });
  applyTypeScale();
  updateModeLabel();
  applyLayout();
  updateHash({ workId: state.overlay.id });
}

function updateModeLabel() {
  const root = document.documentElement;
  root.dataset.layout = state.layoutMode;
}

let layoutTimer = null;

function scheduleLayout() {
  if (layoutTimer) cancelAnimationFrame(layoutTimer);
  layoutTimer = requestAnimationFrame(() => {
    layoutTimer = null;
    applyLayout();
  });
}

function parseRotateToken() {
  const style = getComputedStyle(document.documentElement);
  const raw = style.getPropertyValue('--tile-rotate-max').trim();
  if (!raw) return 5;
  const match = raw.match(/(-?\d+(?:\.\d+)?)deg/);
  if (match) return parseFloat(match[1]);
  const num = parseFloat(raw);
  return Number.isNaN(num) ? 5 : num;
}

function applyLayout() {
  const field = state.field;
  if (!field || !state.tiles.size) return;
  const rect = field.getBoundingClientRect();
  const width = rect.width || window.innerWidth || 1024;
  const controlsBox = state.controls?.getBoundingClientRect();
  const safeTop = controlsBox ? Math.max(0, controlsBox.bottom - rect.top) + 24 : 24;
  const gap = 48;
  const tiles = Array.from(state.tiles.values());
  let avgWidth = 0;
  tiles.forEach((tile) => { avgWidth += tile.el.offsetWidth; });
  avgWidth = tiles.length ? avgWidth / tiles.length : 320;
  const targetWidth = clamp(avgWidth, 280, 420);
  const columns = clamp(Math.floor(width / (targetWidth + gap / 2)) || 1, 1, 4);
  const columnWidth = width / columns;
  const heights = new Array(columns).fill(safeTop);
  const rotateMax = parseRotateToken();
  tiles.forEach((tile, index) => {
    const col = heights.indexOf(Math.min(...heights));
    const tileWidth = tile.el.offsetWidth;
    const tileHeight = tile.el.offsetHeight;
    const baseX = (col * columnWidth) + Math.max(16, (columnWidth - tileWidth) / 2);
    const baseY = heights[col];
    heights[col] += tileHeight + gap;
    tile.baseX = baseX;
    tile.baseY = baseY;
    if (!tile.scatter) {
      const seed = `${tile.data.id}-${tile.data.slug || ''}-${index}`;
      const rand = createSeededRandom(seed);
      const jitterMagX = Math.min(180, columnWidth * 0.45);
      const jitterMagY = Math.min(120, tileHeight * 0.35 + 40);
      tile.scatter = {
        x: (rand() - 0.5) * jitterMagX,
        y: (rand() - 0.5) * jitterMagY,
        r: (rand() - 0.5) * 2 * rotateMax
      };
    }
    updateTileTransform(tile);
  });
  const maxHeight = Math.max(...heights);
  field.style.height = `${Math.max(maxHeight + 120, window.innerHeight * 0.6)}px`;
}

function updateTileTransform(tile) {
  const mode = state.layoutMode;
  const baseX = tile.baseX ?? 0;
  const baseY = tile.baseY ?? 0;
  const scatter = tile.scatter || { x: 0, y: 0, r: 0 };
  const dragX = tile.dragX || 0;
  const dragY = tile.dragY || 0;
  const x = baseX + dragX + (mode === 'loose' ? scatter.x : 0);
  const y = baseY + dragY + (mode === 'loose' ? scatter.y : 0);
  const rotation = mode === 'loose' ? scatter.r : 0;
  tile.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`;
}

function bindTileDrag(tile) {
  tile.el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    tile.el.setPointerCapture(event.pointerId);
    tile.el.classList.add('is-dragging');
    tile.el.style.zIndex = String(state.zCounter += 1);
    state.dragging = {
      id: tile.data.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: tile.dragX || 0,
      originY: tile.dragY || 0
    };
  });
  tile.el.addEventListener('pointermove', (event) => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.dragging.startX;
    const dy = event.clientY - state.dragging.startY;
    tile.dragX = state.dragging.originX + dx;
    tile.dragY = state.dragging.originY + dy;
    updateTileTransform(tile);
  });
  const release = () => {
    if (!state.dragging) return;
    tile.el.classList.remove('is-dragging');
    tile.el.releasePointerCapture?.(state.dragging.pointerId);
    state.dragging = null;
  };
  tile.el.addEventListener('pointerup', release);
  tile.el.addEventListener('pointercancel', release);
}

function createTile(work, index) {
  const el = document.createElement('article');
  el.className = 'ts-tile';
  el.dataset.id = String(work.id);
  el.setAttribute('role', 'group');
  el.setAttribute('tabindex', '0');

  const content = document.createElement('div');
  content.className = 'ts-tile-content';

  const titleBtn = document.createElement('button');
  titleBtn.type = 'button';
  titleBtn.className = 'ts-tile-title';
  titleBtn.dataset.action = 'open';
  titleBtn.textContent = work.title || work.slug || `Work ${index + 1}`;

  const slug = document.createElement('p');
  slug.className = 'ts-tile-slug';
  slug.textContent = (work.slug || '').toUpperCase();

  const one = document.createElement('p');
  one.className = 'ts-tile-one';
  one.textContent = work.one || '';

  content.append(titleBtn, slug, one);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'ts-tile-actions';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'ts-action';
  openBtn.dataset.action = 'open';
  openBtn.textContent = 'Open';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'ts-action';
  playBtn.dataset.action = 'play';
  playBtn.textContent = 'Play';

  const scoreBtn = document.createElement('button');
  scoreBtn.type = 'button';
  scoreBtn.className = 'ts-action';
  scoreBtn.dataset.action = 'score';
  scoreBtn.textContent = 'Open Score';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ts-action';
  copyBtn.dataset.action = 'copy';
  copyBtn.textContent = 'Copy URL';

  actionsWrap.append(openBtn, playBtn, scoreBtn, copyBtn);

  el.append(content, actionsWrap);

  const actions = actionsWrap.querySelectorAll('.ts-action[data-action="score"], .ts-action[data-action="play"]');
  actions.forEach((btn) => {
    const action = btn.getAttribute('data-action');
    if (action === 'score' && !(work.pdfUrl || work.pdf)) {
      btn.setAttribute('aria-disabled', 'true');
      btn.disabled = true;
    }
    if (action === 'play' && !(work.audioUrl || work.audio)) {
      btn.setAttribute('aria-disabled', 'true');
      btn.disabled = true;
    }
  });
  const cues = Array.isArray(work.cues) ? work.cues : [];
  if (cues.length) {
    const wrap = document.createElement('p');
    wrap.className = 'ts-tile-cues';
    for (const cue of cues) {
      const label = cue.label || `@${formatTime(cueTime(cue.at))}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ts-cue';
      btn.dataset.action = 'cue';
      btn.dataset.at = String(cueTime(cue.at));
      btn.textContent = label;
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
  }
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openReaderFor(work.id, el);
    }
  });
  const tile = { el, data: work, baseX: 0, baseY: 0, dragX: 0, dragY: 0, scatter: null };
  state.tiles.set(Number(work.id), tile);
  bindTileDrag(tile);
  return el;
}

function renderTiles(field) {
  if (!field) return;
  field.innerHTML = '';
  state.tiles.clear();
  if (!works.length) {
    const empty = document.createElement('div');
    empty.className = 'ts-empty-state';
    empty.textContent = 'No works available yet — update PRAE.works to begin.';
    field.appendChild(empty);
    return;
  }
  works.forEach((work, index) => {
    const tile = createTile(work, index);
    field.appendChild(tile);
  });
  scheduleLayout();
}

function updateFullscreenButton() {
  const btn = state.controls?.querySelector('[data-control="fullscreen"]');
  if (!btn) return;
  const active = !!document.fullscreenElement;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.textContent = active ? 'Exit fullscreen' : 'Enter fullscreen';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

document.addEventListener('fullscreenchange', updateFullscreenButton, { passive: true });

function handleFieldClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) {
    const tileEl = event.target.closest('.ts-tile');
    if (tileEl) {
      const id = Number(tileEl.dataset.id);
      openReaderFor(id, tileEl);
    }
    return;
  }
  const tileEl = actionEl.closest('.ts-tile');
  const id = tileEl ? Number(tileEl.dataset.id) : null;
  if (!id) return;
  const action = actionEl.getAttribute('data-action');
  if (actionEl.getAttribute('aria-disabled') === 'true') return;
  switch (action) {
    case 'open':
      openReaderFor(id, actionEl);
      break;
    case 'play':
      togglePlayFor(id);
      break;
    case 'score':
      openPdfFor(id);
      break;
    case 'copy':
      copyDeepLink(id);
      break;
    case 'cue':
      playAt(id, Number(actionEl.dataset.at || 0));
      break;
    default:
      break;
  }
}

async function copyDeepLink(id) {
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(id));
  params.set(HASH_MODE_KEY, state.layoutMode);
  const url = new URL(location.href);
  url.hash = params.toString();
  await copyToClipboard(url.toString());
}

function renderReaderContent(id) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work || !state.reader) return;
  state.reader.innerHTML = '';
  state.reader.setAttribute('role', 'dialog');
  state.reader.setAttribute('aria-modal', 'true');
  state.reader.tabIndex = -1;
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = work.title || work.slug || `Work ${id}`;
  const slug = document.createElement('p');
  slug.className = 'ts-reader-slug';
  slug.textContent = (work.slug || '').toUpperCase();
  const summary = document.createElement('p');
  summary.className = 'ts-reader-summary';
  summary.textContent = work.one || '';
  header.append(title, slug, summary);
  const actions = document.createElement('div');
  actions.className = 'ts-reader-actions';
  actions.innerHTML = `
    <button type="button" data-action="play">Play</button>
    <button type="button" data-action="score">Open Score</button>
    <button type="button" data-action="copy">Copy URL</button>
    <button type="button" data-action="back">Back</button>`;
  if (!(work.audioUrl || work.audio)) {
    const playBtn = actions.querySelector('[data-action="play"]');
    if (playBtn) {
      playBtn.setAttribute('aria-disabled', 'true');
      playBtn.disabled = true;
    }
  }
  if (!(work.pdfUrl || work.pdf)) {
    const scoreBtn = actions.querySelector('[data-action="score"]');
    if (scoreBtn) {
      scoreBtn.setAttribute('aria-disabled', 'true');
      scoreBtn.disabled = true;
    }
  }
  const body = document.createElement('div');
  body.className = 'ts-reader-body';
  const note = Array.isArray(work.openNote) ? work.openNote : (work.openNote ? [work.openNote] : []);
  const description = Array.isArray(work.description) ? work.description : (work.description ? [work.description] : []);
  const extra = [...note, ...description];
  extra.forEach((line) => {
    const content = String(line || '').trim();
    if (!content) return;
    const p = document.createElement('p');
    p.textContent = content;
    body.appendChild(p);
  });
  state.reader.append(header, actions, body);
  actions.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    const act = btn.getAttribute('data-action');
    switch (act) {
      case 'play':
        togglePlayFor(id);
        break;
      case 'score':
        openPdfFor(id);
        break;
      case 'copy':
        copyDeepLink(id);
        break;
      case 'back':
        closeReader();
        break;
      default:
        break;
    }
  });
}

function openReaderFor(id, trigger) {
  const record = findWorkById(id);
  if (!record || !state.reader) return;
  state.overlay.id = id;
  state.overlay.restore = trigger instanceof HTMLElement ? trigger : null;
  state.tiles.forEach((tile) => {
    if (tile.data.id === id) tile.el.classList.add('is-selected');
    else tile.el.classList.remove('is-selected');
  });
  renderReaderContent(id);
  state.reader.hidden = false;
  state.reader.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ts-reader-open');
  requestAnimationFrame(() => state.reader?.focus({ preventScroll: true }));
  updateHash({ workId: id });
}

function closeReader() {
  if (!state.reader) return;
  state.tiles.forEach((tile) => tile.el.classList.remove('is-selected'));
  state.reader.setAttribute('aria-hidden', 'true');
  state.reader.hidden = true;
  document.body.classList.remove('ts-reader-open');
  const restore = state.overlay.restore;
  state.overlay = { id: null, restore: null };
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus());
  }
  updateHash({ workId: null });
}

function bindReaderClose() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }
      if (!state.reader?.hidden) {
        closeReader();
      } else {
        hidePdfPane();
      }
    }
  });
}

function bindThemeToggle() {
  const btn = document.getElementById('wc-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    praeCycleTheme();
  });
  btn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      praeCycleTheme();
    }
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.target && event.target !== document.body && event.target !== document.documentElement) {
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
    }
    switch (event.key) {
      case 'l':
      case 'L':
        event.preventDefault();
        state.layoutMode = state.layoutMode === 'loose' ? 'neat' : 'loose';
        updateModeLabel();
        applyLayout();
        updateHash({ workId: state.overlay.id });
        break;
      case '[':
        if (state.scaleIndex > 0) {
          event.preventDefault();
          state.scaleIndex -= 1;
          applyTypeScale();
          scheduleLayout();
          updateControlsState();
        }
        break;
      case ']':
        if (state.scaleIndex < SCALE_STEPS.length - 1) {
          event.preventDefault();
          state.scaleIndex += 1;
          applyTypeScale();
          scheduleLayout();
          updateControlsState();
        }
        break;
      case ',':
        if (state.currentMeasure > MEASURE_MIN) {
          event.preventDefault();
          state.currentMeasure = Math.max(MEASURE_MIN, state.currentMeasure - MEASURE_STEP);
          applyTypeScale();
          scheduleLayout();
          updateControlsState();
        }
        break;
      case '.':
        if (state.currentMeasure < MEASURE_MAX) {
          event.preventDefault();
          state.currentMeasure = Math.min(MEASURE_MAX, state.currentMeasure + MEASURE_STEP);
          applyTypeScale();
          scheduleLayout();
          updateControlsState();
        }
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        toggleFullscreen();
        break;
      default:
        break;
    }
  });
}

function bindHashChange() {
  window.addEventListener('hashchange', hydrateFromHash);
}

function initSiteMeta() {
  const footer = document.getElementById('prae-footer');
  const nav = document.getElementById('prae-nav');
  const site = (PRAE.config && PRAE.config.site) || {};
  if (nav && Array.isArray(site.links)) {
    nav.innerHTML = '';
    site.links.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href || '#';
      a.textContent = link.label || link.href || 'Link';
      if (link.external) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      nav.appendChild(a);
    });
  }
  if (footer) {
    footer.textContent = site.copyrightName ? `© ${new Date().getFullYear()} ${site.copyrightName}` : '';
  }
}

ready(() => {
  document.documentElement.dataset.skin = 'typescatter';
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  bindThemeToggle();
  ensureAudioTags();
  state.field = document.getElementById('ts-field');
  state.controls = document.getElementById('ts-controls');
  state.reader = document.getElementById('ts-reader');
  state.footer = document.getElementById('prae-footer');
  const styleMeasure = getComputedStyle(document.documentElement).getPropertyValue('--measure');
  const numericMeasure = parseFloat(styleMeasure);
  if (!Number.isNaN(numericMeasure)) {
    state.baseMeasure = clamp(Math.round(numericMeasure), MEASURE_MIN, MEASURE_MAX);
    state.currentMeasure = state.baseMeasure;
  }
  applyTypeScale();
  renderTiles(state.field);
  renderControls(state.controls);
  state.field?.addEventListener('click', handleFieldClick);
  bindReaderClose();
  bindKeyboardShortcuts();
  bindHashChange();
  initSiteMeta();
  window.addEventListener('resize', () => scheduleLayout(), { passive: true });
  hydrateFromHash();
  if (!state.overlay.id && works[0]) {
    updateHash({ workId: null });
  }
});

export {};
