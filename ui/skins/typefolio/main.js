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
  const body = document.body;
  const doc = document.documentElement;
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

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const match = String(value).match(/^(\d+):(\d{2})$/);
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

const SIZE_STEPS = [0.92, 1, 1.08, 1.18, 1.32];
const MEASURE_STEPS = [52, 58, 66, 74, 82];
const LEADING_STEPS = [1.42, 1.52, 1.62, 1.72, 1.82];
const HASH_WORK_KEY = 'work';
const HASH_PAGE_KEY = 'p';

const state = {
  reader: null,
  toc: null,
  controls: null,
  actions: null,
  footer: null,
  currentTitleEl: null,
  pageLabel: null,
  totalLabel: null,
  tocList: null,
  tocPanel: null,
  tocClose: null,
  tocRestore: null,
  columns: 2,
  orientation: 'horizontal',
  selectedId: works[0]?.id ?? null,
  pageIndex: 0,
  totalPages: 1,
  prefs: { size: 1, measure: 2, leading: 2, contrast: false },
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  worksById: new Map(),
  pdf: { pane: null, frame: null, title: null, close: null, backdrop: null, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null, followAudio: null, followHandler: null, followSlug: null, lastPrinted: null },
  scrollTimer: null,
  resizeTimer: null,
  ignoreHash: false,
  prefersReducedMotion: typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  edgePrev: null,
  edgeNext: null
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
  if (root.dataset.hudBound === '1' && hudRefs) return hudRefs;
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-title" data-part="title"></div>
      <div class="hud-sub" data-part="subtitle"></div>
    </div>
    <div class="hud-meter" data-part="meter"><span></span></div>
    <div class="hud-actions">
      <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play/Pause">Play</button>
    </div>`;
  const title = root.querySelector('[data-part="title"]');
  const sub = root.querySelector('[data-part="subtitle"]');
  const meter = root.querySelector('[data-part="meter"]');
  const fill = meter?.querySelector('span');
  const btn = root.querySelector('button[data-hud="toggle"]');
  hudRefs = { title, sub, meter, fill, btn, root };
  root.dataset.hudBound = '1';
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
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    refs.fill.style.width = `${clamped * 100}%`;
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
  const playBtn = state.actions?.querySelector('[data-action="play"]');
  if (playBtn) {
    playBtn.textContent = audio && !audio.paused ? 'Pause' : 'Play';
  }
}

function bindAudioToHud(id, audio) {
  if (!audio || audio.dataset.typefolioHud === '1') return;
  const update = () => hudUpdate(id, audio);
  audio.addEventListener('timeupdate', update, { passive: true });
  audio.addEventListener('ratechange', update, { passive: true });
  audio.addEventListener('volumechange', update, { passive: true });
  audio.addEventListener('loadedmetadata', update, { once: true, passive: true });
  audio.addEventListener('pause', update, { passive: true });
  audio.addEventListener('ended', update, { passive: true });
  audio.dataset.typefolioHud = '1';
}

function getAudioSourceFor(work) {
  return work?.audioUrl || work?.audio || '';
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
  let pane = document.querySelector('.tf-pdfpane');
  let backdrop = document.querySelector('.tf-pdf-backdrop');
  if (!pane) {
    backdrop = document.createElement('div');
    backdrop.className = 'tf-pdf-backdrop';
    backdrop.setAttribute('hidden', '');
    pane = document.createElement('aside');
    pane.className = 'tf-pdfpane';
    pane.setAttribute('role', 'dialog');
    pane.setAttribute('aria-modal', 'true');
    pane.setAttribute('aria-hidden', 'true');
    pane.setAttribute('tabindex', '-1');
    pane.setAttribute('hidden', '');
    pane.innerHTML = `
      <header class="tf-pdfbar">
        <div class="tf-pdf-title" aria-live="polite"></div>
        <button type="button" class="tf-pdf-close">Close</button>
      </header>
      <iframe class="tf-pdf-frame" title="Score PDF" loading="lazy" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>`;
    document.body.append(backdrop, pane);
  }
  const frame = pane.querySelector('.tf-pdf-frame');
  const title = pane.querySelector('.tf-pdf-title');
  const close = pane.querySelector('.tf-pdf-close');
  state.pdf = Object.assign(state.pdf, { pane, frame, title, close, backdrop, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null });
  if (backdrop && backdrop.dataset.typefolioPdf !== '1') {
    backdrop.addEventListener('click', hidePdfPane);
    backdrop.dataset.typefolioPdf = '1';
  }
  if (close && close.dataset.typefolioPdf !== '1') {
    close.addEventListener('click', hidePdfPane);
    close.dataset.typefolioPdf = '1';
  }
  if (frame && frame.dataset.typefolioPdf !== '1') {
    frame.addEventListener('load', () => {
      state.pdf.viewerReady = true;
      const pending = state.pdf.pendingGoto;
      if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
        gotoPdfPage(pending.pdfPage);
        state.pdf.pendingGoto = null;
      }
    });
    frame.dataset.typefolioPdf = '1';
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
  const meta = findWorkById(id);
  const work = meta?.data;
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
  document.body.classList.add('tf-pdf-open');
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
  document.body.classList.remove('tf-pdf-open');
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

function ensureHudBehaviour() {
  const refs = ensureHudDom();
  if (!refs?.root) return;
  refs.root.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-hud="toggle"]');
    if (!btn) return;
    const now = getActiveAudioInfo();
    if (now.audio && !now.audio.paused) {
      state.hudState.last = { id: now.id, at: now.audio.currentTime || 0 };
      now.audio.pause();
      hudUpdate(now.id, now.audio);
    } else {
      const id = state.hudState.last.id || state.selectedId || works[0]?.id;
      if (id != null) playAt(id, state.hudState.last.at || 0);
    }
  });
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

function updateHash() {
  if (state.ignoreHash) return;
  const id = state.selectedId;
  if (id == null) return;
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(id));
  params.set(HASH_PAGE_KEY, String(state.pageIndex));
  const hash = `#${params.toString()}`;
  state.ignoreHash = true;
  history.replaceState(null, '', hash);
  setTimeout(() => { state.ignoreHash = false; }, 60);
}

function hydrateFromHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const workVal = params.get(HASH_WORK_KEY);
  const pageVal = params.get(HASH_PAGE_KEY);
  const id = Number(workVal);
  const page = Number(pageVal);
  if (!Number.isNaN(id)) state.selectedId = id;
  if (!Number.isNaN(page)) state.pageIndex = Math.max(0, page);
}

function getColumnCount() {
  if (!state.reader) return 1;
  const style = getComputedStyle(state.reader);
  const count = parseInt(style.columnCount || '1', 10);
  return Number.isNaN(count) || count < 1 ? 1 : count;
}

function measurePages() {
  if (!state.reader) return;
  state.columns = getColumnCount();
  const horizontal = state.reader.scrollWidth > state.reader.clientWidth + 1;
  state.orientation = horizontal ? 'horizontal' : 'vertical';
  let total = 1;
  if (horizontal) {
    total = Math.max(1, Math.ceil(state.reader.scrollWidth / Math.max(1, state.reader.clientWidth)));
  } else {
    total = Math.max(1, Math.ceil(state.reader.scrollHeight / Math.max(1, state.reader.clientHeight)));
  }
  state.totalPages = total;
  state.reader.dataset.pages = String(total);
  updateFooter();
  updateEdgeZones();
}

function setPage(index, options = {}) {
  if (!state.reader) return;
  const total = Math.max(1, state.totalPages);
  const target = Math.max(0, Math.min(total - 1, index));
  state.pageIndex = target;
  state.reader.dataset.index = String(target);
  const behavior = options.behavior || (state.prefersReducedMotion ? 'auto' : 'smooth');
  if (state.orientation === 'horizontal') {
    const x = target * state.reader.clientWidth;
    state.reader.scrollTo({ left: x, top: 0, behavior });
  } else {
    const y = target * state.reader.clientHeight;
    state.reader.scrollTo({ top: y, left: 0, behavior });
  }
  updateFooter();
  updateHash();
}

function updateFromScroll() {
  if (!state.reader) return;
  if (state.orientation === 'horizontal') {
    const width = Math.max(1, state.reader.clientWidth);
    const next = Math.round(state.reader.scrollLeft / width);
    if (next !== state.pageIndex) {
      state.pageIndex = Math.max(0, Math.min(state.totalPages - 1, next));
      state.reader.dataset.index = String(state.pageIndex);
      updateFooter();
      updateHash();
    }
  } else {
    const height = Math.max(1, state.reader.clientHeight);
    const next = Math.round(state.reader.scrollTop / height);
    if (next !== state.pageIndex) {
      state.pageIndex = Math.max(0, Math.min(state.totalPages - 1, next));
      state.reader.dataset.index = String(state.pageIndex);
      updateFooter();
      updateHash();
    }
  }
}

function scheduleMeasure() {
  clearTimeout(state.resizeTimer);
  state.resizeTimer = setTimeout(() => {
    measurePages();
    setPage(state.pageIndex, { behavior: 'auto' });
  }, 80);
}

function handleReaderScroll() {
  clearTimeout(state.scrollTimer);
  state.scrollTimer = setTimeout(() => updateFromScroll(), 80);
}

function updateHeaderTitle(work) {
  if (!state.currentTitleEl) return;
  if (!work) {
    state.currentTitleEl.textContent = 'No works available yet';
  } else {
    state.currentTitleEl.textContent = work.title || work.slug || `Work ${work.id}`;
  }
}

function updateFooter() {
  if (state.pageLabel) state.pageLabel.textContent = String(state.pageIndex + 1);
  if (state.totalLabel) state.totalLabel.textContent = String(state.totalPages);
  if (state.footer) {
    const prevPage = state.footer.querySelector('[data-action="page-prev"]');
    const nextPage = state.footer.querySelector('[data-action="page-next"]');
    const prevWork = state.footer.querySelector('[data-action="work-prev"]');
    const nextWork = state.footer.querySelector('[data-action="work-next"]');
    const atStart = state.pageIndex <= 0;
    const atEnd = state.pageIndex >= state.totalPages - 1;
    if (prevPage) {
      prevPage.disabled = atStart;
      prevPage.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    }
    if (nextPage) {
      nextPage.disabled = atEnd;
      nextPage.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
    }
    const soloWork = works.length <= 1;
    if (prevWork) {
      prevWork.disabled = soloWork;
      prevWork.setAttribute('aria-disabled', soloWork ? 'true' : 'false');
    }
    if (nextWork) {
      nextWork.disabled = soloWork;
      nextWork.setAttribute('aria-disabled', soloWork ? 'true' : 'false');
    }
  }
}

function updateEdgeZones() {
  if (!state.edgePrev || !state.edgeNext) return;
  if (state.columns <= 1) {
    state.edgePrev.setAttribute('hidden', '');
    state.edgeNext.setAttribute('hidden', '');
  } else {
    state.edgePrev.removeAttribute('hidden');
    state.edgeNext.removeAttribute('hidden');
  }
}

function getWorkFlow(work) {
  const article = document.createElement('article');
  article.className = 'tf-article';
  const title = document.createElement('h1');
  title.className = 'tf-title';
  title.textContent = work.title || work.slug || `Work ${work.id}`;
  article.appendChild(title);
  if (work.slug) {
    const slug = document.createElement('p');
    slug.className = 'tf-slug';
    slug.textContent = work.slug;
    article.appendChild(slug);
  }
  if (work.one) {
    const lead = document.createElement('p');
    lead.className = 'tf-lead';
    lead.textContent = work.one;
    article.appendChild(lead);
  }
  const body = document.createElement('div');
  body.className = 'tf-body';
  const open = Array.isArray(work.openNote) ? work.openNote : (work.openNote ? [work.openNote] : []);
  for (const raw of open) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) continue;
    const p = document.createElement('p');
    p.textContent = text;
    body.appendChild(p);
  }
  if (!open.length) {
    const p = document.createElement('p');
    p.textContent = 'This work has no additional notes yet. Use the controls below to explore audio, score, and sharing options.';
    body.appendChild(p);
  }
  article.appendChild(body);
  if (Array.isArray(work.cues) && work.cues.length) {
    const cues = document.createElement('div');
    cues.className = 'tf-cues';
    cues.setAttribute('aria-label', 'Audio cues');
    for (const cue of work.cues) {
      const t = cueTime(cue.at || cue.t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.time = String(t);
      const label = cue.label && /^@?\d+:\d{2}$/.test(cue.label)
        ? cue.label.replace(/^@?/, '@')
        : `@${formatTime(t)}`;
      btn.textContent = label;
      btn.addEventListener('click', () => playAt(work.id, t));
      cues.appendChild(btn);
    }
    article.appendChild(cues);
  }
  return article;
}

function renderReader(work) {
  if (!state.reader) return;
  state.reader.innerHTML = '';
  if (state.edgePrev) state.reader.appendChild(state.edgePrev);
  if (state.edgeNext) state.reader.appendChild(state.edgeNext);
  if (!work) {
    const empty = document.createElement('article');
    empty.className = 'tf-article';
    const title = document.createElement('h1');
    title.className = 'tf-title';
    title.textContent = 'Awaiting works';
    const p = document.createElement('p');
    p.textContent = 'Add works to PRAE.works to begin. The reader will paginate your selected piece here.';
    empty.append(title, p);
    state.reader.appendChild(empty);
    state.totalPages = 1;
    state.reader.dataset.pages = '1';
    state.reader.dataset.index = '0';
    updateFooter();
    updateEdgeZones();
    return;
  }
  const flow = getWorkFlow(work);
  if (state.edgeNext && state.edgeNext.parentNode === state.reader) {
    state.reader.insertBefore(flow, state.edgeNext);
  } else {
    state.reader.appendChild(flow);
  }
  requestAnimationFrame(() => {
    measurePages();
    setPage(state.pageIndex, { behavior: 'auto' });
  });
}

function renderTOCList() {
  if (!state.tocList) return;
  state.tocList.innerHTML = '';
  if (!works.length) {
    const item = document.createElement('li');
    const msg = document.createElement('div');
    msg.textContent = 'No works available yet.';
    msg.setAttribute('aria-live', 'polite');
    item.appendChild(msg);
    state.tocList.appendChild(item);
    return;
  }
  for (const work of works) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.workId = String(work.id);
    btn.innerHTML = `<span class="tf-toc-title">${esc(work.title || work.slug || `Work ${work.id}`)}</span><span class="tf-toc-slug">${esc(work.slug || '')}</span>`;
    if (Number(work.id) === Number(state.selectedId)) {
      btn.setAttribute('aria-current', 'true');
    }
    btn.addEventListener('click', () => {
      closeToc();
      selectWork(work.id, { pageIndex: 0, updateHash: true, focusReader: true });
    });
    li.appendChild(btn);
    state.tocList.appendChild(li);
  }
}

function openToc() {
  if (!state.toc) return;
  renderTOCList();
  state.toc.removeAttribute('hidden');
  state.toc.setAttribute('aria-hidden', 'false');
  const first = state.tocList?.querySelector('button');
  if (first) first.focus({ preventScroll: true });
  else state.tocPanel?.focus({ preventScroll: true });
  state.tocOpen = true;
}

function closeToc() {
  if (!state.toc) return;
  state.toc.setAttribute('aria-hidden', 'true');
  state.toc.setAttribute('hidden', '');
  state.tocOpen = false;
  const toggle = document.querySelector('.tf-toc-toggle');
  toggle?.setAttribute('aria-expanded', 'false');
  const restore = state.tocRestore;
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus());
  }
}

function toggleToc(fromButton) {
  if (!state.toc) return;
  if (state.tocOpen) {
    closeToc();
    const toggle = document.querySelector('.tf-toc-toggle');
    toggle?.setAttribute('aria-expanded', 'false');
  } else {
    state.tocRestore = fromButton || document.activeElement;
    openToc();
    const toggle = document.querySelector('.tf-toc-toggle');
    toggle?.setAttribute('aria-expanded', 'true');
  }
}

function applyPrefs() {
  const size = SIZE_STEPS[state.prefs.size] || SIZE_STEPS[1];
  const measure = MEASURE_STEPS[state.prefs.measure] || MEASURE_STEPS[2];
  const leading = LEADING_STEPS[state.prefs.leading] || LEADING_STEPS[2];
  document.documentElement.style.setProperty('--fs-base', `${size}rem`);
  document.documentElement.style.setProperty('--measure', `${measure}ch`);
  document.documentElement.style.setProperty('--max-width', `min(95vw, ${measure + 20}ch)`);
  document.documentElement.style.setProperty('--lh-body', String(leading));
  document.body.classList.toggle('tf-contrast', !!state.prefs.contrast);
  requestAnimationFrame(() => {
    measurePages();
    setPage(state.pageIndex, { behavior: 'auto' });
  });
}

function adjustPref(key, delta) {
  if (key === 'size') {
    state.prefs.size = Math.max(0, Math.min(SIZE_STEPS.length - 1, state.prefs.size + delta));
  }
  if (key === 'measure') {
    state.prefs.measure = Math.max(0, Math.min(MEASURE_STEPS.length - 1, state.prefs.measure + delta));
  }
  if (key === 'leading') {
    state.prefs.leading = Math.max(0, Math.min(LEADING_STEPS.length - 1, state.prefs.leading + delta));
  }
  applyPrefs();
}

function toggleContrast() {
  state.prefs.contrast = !state.prefs.contrast;
  applyPrefs();
  updateContrastButton();
}

function updateContrastButton() {
  const btn = state.controls?.contrast;
  if (!btn) return;
  const on = !!state.prefs.contrast;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.textContent = on ? 'Contrast: On' : 'Contrast';
}

function updateFullscreenButton() {
  const btn = state.controls?.fullscreen;
  if (!btn) return;
  const active = !!document.fullscreenElement;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
  setTimeout(updateFullscreenButton, 200);
}

function buildControls() {
  const host = document.getElementById('tf-controls');
  if (!host) return;
  host.innerHTML = '';
  const controls = [
    { label: 'A−', action: 'size-dec', handler: () => adjustPref('size', -1) },
    { label: 'A+', action: 'size-inc', handler: () => adjustPref('size', 1) },
    { label: 'Measure −', action: 'measure-dec', handler: () => adjustPref('measure', -1) },
    { label: 'Measure +', action: 'measure-inc', handler: () => adjustPref('measure', 1) },
    { label: 'Leading −', action: 'leading-dec', handler: () => adjustPref('leading', -1) },
    { label: 'Leading +', action: 'leading-inc', handler: () => adjustPref('leading', 1) },
    { label: 'Contrast', action: 'contrast', handler: toggleContrast },
    { label: 'Fullscreen', action: 'fullscreen', handler: toggleFullscreen },
    { label: 'Print', action: 'print', handler: () => window.print() }
  ];
  const refs = {};
  for (const ctl of controls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = ctl.action;
    btn.textContent = ctl.label;
    btn.addEventListener('click', ctl.handler);
    host.appendChild(btn);
    if (ctl.action === 'contrast') refs.contrast = btn;
    if (ctl.action === 'fullscreen') refs.fullscreen = btn;
  }
  state.controls = refs;
  updateContrastButton();
  updateFullscreenButton();
}

function updateActionButtons(work) {
  if (!state.actions) return;
  const playBtn = state.actions.querySelector('[data-action="play"]');
  const pdfBtn = state.actions.querySelector('[data-action="pdf"]');
  const copyBtn = state.actions.querySelector('[data-action="copy"]');
  const openBtn = state.actions.querySelector('[data-action="open"]');
  const tocBtn = state.actions.querySelector('[data-action="toc"]');
  if (playBtn) {
    playBtn.disabled = !work || !getAudioSourceFor(work);
    playBtn.setAttribute('aria-disabled', playBtn.disabled ? 'true' : 'false');
    playBtn.textContent = 'Play';
  }
  if (pdfBtn) {
    const hasPdf = !!(work && (work.pdfUrl || work.pdf));
    pdfBtn.disabled = !hasPdf;
    pdfBtn.setAttribute('aria-disabled', hasPdf ? 'false' : 'true');
  }
  if (copyBtn) {
    copyBtn.disabled = !work;
    copyBtn.setAttribute('aria-disabled', copyBtn.disabled ? 'true' : 'false');
    copyBtn.textContent = 'Copy URL';
  }
  if (openBtn) {
    const url = work?.url || work?.href || work?.link;
    if (url) {
      openBtn.disabled = false;
      openBtn.setAttribute('aria-disabled', 'false');
      openBtn.textContent = 'Open';
    } else {
      openBtn.disabled = true;
      openBtn.setAttribute('aria-disabled', 'true');
      openBtn.textContent = 'Open';
    }
  }
  if (tocBtn) {
    const disabled = works.length === 0;
    tocBtn.disabled = disabled;
    tocBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }
}

function buildActions() {
  const host = document.getElementById('tf-actions');
  if (!host) return;
  host.innerHTML = '';
  const buttons = [
    { label: 'Play', action: 'play' },
    { label: 'Open Score', action: 'pdf' },
    { label: 'Copy URL', action: 'copy' },
    { label: 'Open', action: 'open' },
    { label: 'Back to TOC', action: 'toc' }
  ];
  for (const meta of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = meta.action;
    btn.textContent = meta.label;
    host.appendChild(btn);
  }
  host.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const record = findWorkById(state.selectedId);
    const work = record?.data || null;
    if (act === 'play') {
      if (!work) return;
      togglePlay(work, btn);
    }
    if (act === 'pdf') {
      if (!work) return;
      openPdfFor(work.id);
    }
    if (act === 'copy') {
      if (!work) return;
      const url = new URL(location.href);
      url.hash = `#${HASH_WORK_KEY}=${encodeURIComponent(work.id)}&${HASH_PAGE_KEY}=${state.pageIndex}`;
      const ok = await copyToClipboard(url.toString());
      btn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => {
        btn.textContent = 'Copy URL';
      }, 1800);
    }
    if (act === 'open') {
      if (!work) return;
      const url = work.url || work.href || work.link;
      if (url) window.open(url, '_blank', 'noopener');
    }
    if (act === 'toc') {
      state.tocRestore = btn;
      toggleToc(btn);
    }
  });
  state.actions = host;
  updateActionButtons(findWorkById(state.selectedId)?.data || null);
}

function buildFooter() {
  const host = document.getElementById('tf-footer');
  if (!host) return;
  host.innerHTML = '';
  const meta = document.createElement('div');
  meta.className = 'tf-footer-meta';
  meta.innerHTML = `<strong>Page <span data-current-page>1</span> of <span data-total-pages>1</span></strong>`;
  const controls = document.createElement('div');
  controls.className = 'tf-footer-actions';
  const prevPage = document.createElement('button');
  prevPage.type = 'button';
  prevPage.dataset.action = 'page-prev';
  prevPage.textContent = 'Prev Page';
  const nextPage = document.createElement('button');
  nextPage.type = 'button';
  nextPage.dataset.action = 'page-next';
  nextPage.textContent = 'Next Page';
  const prevWork = document.createElement('button');
  prevWork.type = 'button';
  prevWork.dataset.action = 'work-prev';
  prevWork.textContent = 'Prev Work';
  const nextWork = document.createElement('button');
  nextWork.type = 'button';
  nextWork.dataset.action = 'work-next';
  nextWork.textContent = 'Next Work';
  controls.append(prevPage, nextPage, prevWork, nextWork);
  const copyright = document.createElement('small');
  const year = new Date().getFullYear();
  copyright.innerHTML = `© <span data-site-title>Praetorius</span> ${year}`;
  host.append(meta, controls, copyright);
  host.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'page-prev') turnPage(-1);
    if (act === 'page-next') turnPage(1);
    if (act === 'work-prev') cycleWork(-1);
    if (act === 'work-next') cycleWork(1);
  });
  state.footer = host;
  state.pageLabel = host.querySelector('[data-current-page]');
  state.totalLabel = host.querySelector('[data-total-pages]');
  updateFooter();
}

function cycleWork(delta) {
  if (!works.length) return;
  const idx = works.findIndex((w) => Number(w.id) === Number(state.selectedId));
  const next = (idx + delta + works.length) % works.length;
  const id = works[next].id;
  selectWork(id, { pageIndex: 0, updateHash: true, focusReader: true });
}

function turnPage(delta) {
  setPage(state.pageIndex + delta);
}

function togglePlay(work, btn) {
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  const src = audio.getAttribute('data-audio') || getAudioSourceFor(work);
  if (!audio.src && !src) return;
  if (!audio.src && src) {
    audio.src = normalizeSrc(src);
    audio.load();
  }
  if (audio.paused || audio.ended) {
    playAt(work.id, audio.ended ? 0 : audio.currentTime || 0, btn);
  } else {
    audio.pause();
    btn.textContent = 'Play';
    hudUpdate(work.id, audio);
  }
}

function playAt(id, seconds, btn) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const audio = document.getElementById('wc-a' + id) || ensureAudioFor(work);
  if (!audio) return;
  const src = audio.getAttribute('data-audio') || getAudioSourceFor(work);
  if (!audio.src && !src) return;
  if (!audio.src && src) {
    audio.src = normalizeSrc(src);
    audio.load();
  }
  const seekAndPlay = () => {
    try { audio.currentTime = Math.max(0, Number(seconds) || 0); } catch (_) {}
    const prom = audio.play();
    if (prom && typeof prom.catch === 'function') {
      prom.catch(() => {});
    }
    state.hudState.last = { id: work.id, at: audio.currentTime || 0 };
    hudUpdate(work.id, audio);
    if (btn) btn.textContent = 'Pause';
    else {
      const playBtn = state.actions?.querySelector('[data-action="play"]');
      if (playBtn) playBtn.textContent = 'Pause';
    }
    bindAudioToHud(work.id, audio);
    if (work.slug) attachPageFollow(work.slug, audio);
  };
  if (audio.readyState >= 1) seekAndPlay();
  else audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
}

function pauseAllAudio() {
  for (const work of works) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio && !audio.paused) {
      state.hudState.last = { id: work.id, at: audio.currentTime || 0 };
      audio.pause();
      hudUpdate(work.id, audio);
    }
  }
}

function buildReader() {
  state.reader = document.getElementById('tf-reader');
  if (!state.reader) return;
  state.reader.setAttribute('tabindex', '0');
  const leftZone = document.createElement('div');
  leftZone.className = 'tf-edge-zone tf-edge-zone--left';
  const leftBtn = document.createElement('button');
  leftBtn.type = 'button';
  leftBtn.textContent = 'Previous Page';
  leftBtn.addEventListener('click', () => turnPage(-1));
  leftZone.appendChild(leftBtn);
  const rightZone = document.createElement('div');
  rightZone.className = 'tf-edge-zone tf-edge-zone--right';
  const rightBtn = document.createElement('button');
  rightBtn.type = 'button';
  rightBtn.textContent = 'Next Page';
  rightBtn.addEventListener('click', () => turnPage(1));
  rightZone.appendChild(rightBtn);
  state.reader.append(leftZone, rightZone);
  state.edgePrev = leftZone;
  state.edgeNext = rightZone;
  state.reader.addEventListener('scroll', handleReaderScroll, { passive: true });
  state.reader.addEventListener('click', (event) => {
    const sel = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (sel && String(sel).trim()) return;
    if (event.target.closest('button, a')) return;
    const rect = state.reader.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pct = x / Math.max(1, rect.width);
    if (pct < 0.15) {
      turnPage(-1);
    } else if (pct > 0.85) {
      turnPage(1);
    }
  });
}

function buildToc() {
  const aside = document.getElementById('tf-toc');
  if (!aside) return;
  aside.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'tf-toc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('tabindex', '-1');
  const header = document.createElement('div');
  header.className = 'tf-toc-header';
  const heading = document.createElement('h2');
  heading.textContent = 'Table of Contents';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tf-toc-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => closeToc());
  header.append(heading, close);
  const list = document.createElement('ul');
  list.className = 'tf-toc-list';
  panel.append(header, list);
  aside.appendChild(panel);
  state.toc = aside;
  state.tocPanel = panel;
  state.tocList = list;
  state.tocClose = close;
}

function selectWork(id, opts = {}) {
  if (Number(id) !== Number(state.selectedId)) {
    pauseAllAudio();
  }
  const record = findWorkById(id);
  if (!record) {
    if (works.length && id !== works[0].id) {
      selectWork(works[0].id, opts);
      return;
    }
    state.selectedId = null;
    renderReader(null);
    updateHeaderTitle(null);
    updateActionButtons(null);
    return;
  }
  state.selectedId = record.data.id;
  state.pageIndex = Math.max(0, Number(opts.pageIndex) || 0);
  updateHeaderTitle(record.data);
  renderReader(record.data);
  updateActionButtons(record.data);
  if (opts.focusReader) {
    requestAnimationFrame(() => state.reader?.focus({ preventScroll: true }));
  }
  if (opts.updateHash) updateHash();
  renderTOCList();
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    if (state.pdf.pane && state.pdf.pane.getAttribute('aria-hidden') === 'false') {
      event.preventDefault();
      hidePdfPane();
      return;
    }
  }
  if (state.tocOpen && event.key === 'Escape') {
    event.preventDefault();
    closeToc();
    return;
  }
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    turnPage(1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    turnPage(-1);
  }
  if (event.key === '[') {
    event.preventDefault();
    adjustPref('size', -1);
  }
  if (event.key === ']') {
    event.preventDefault();
    adjustPref('size', 1);
  }
  if (event.key === ',') {
    event.preventDefault();
    adjustPref('measure', -1);
  }
  if (event.key === '.') {
    event.preventDefault();
    adjustPref('measure', 1);
  }
  if (event.key === ';') {
    event.preventDefault();
    adjustPref('leading', -1);
  }
  if (event.key === "'") {
    event.preventDefault();
    adjustPref('leading', 1);
  }
  if (event.key === 't' || event.key === 'T') {
    event.preventDefault();
    toggleToc();
  }
}

ready(() => {
  document.documentElement.dataset.skin = 'typefolio';
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  document.getElementById('wc-theme-toggle')?.addEventListener('click', () => {
    state.tocRestore = document.getElementById('wc-theme-toggle');
    praeCycleTheme();
  });
  state.currentTitleEl = document.querySelector('[data-current-work]');
  buildToc();
  buildControls();
  buildActions();
  buildFooter();
  buildReader();
  applyPrefs();
  ensureHudBehaviour();
  hydrateFromHash();
  selectWork(state.selectedId ?? works[0]?.id ?? null, { pageIndex: state.pageIndex, updateHash: true });
  window.addEventListener('resize', scheduleMeasure, { passive: true });
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  const tocBtn = document.querySelector('.tf-toc-toggle');
  tocBtn?.addEventListener('click', () => {
    state.tocRestore = tocBtn;
    toggleToc(tocBtn);
  });
  window.addEventListener('hashchange', () => {
    if (state.ignoreHash) return;
    hydrateFromHash();
    selectWork(state.selectedId ?? works[0]?.id ?? null, { pageIndex: state.pageIndex, updateHash: false });
  });
});

export { praeApplyTheme, praeCurrentTheme, praeCycleTheme };
