import {
  forceSimulation,
  forceCollide,
  forceLink,
  forceManyBody,
  forceX,
  forceY
} from 'https://cdn.skypack.dev/d3-force@3?min';

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

const HASH_WORK_KEY = 'work';
const SESSION_HINT_KEY = 'ts-hint-shown';
const MODULE_PADDING = 12;
const CLUSTER_FORCE = 0.08;

const state = {
  field: null,
  footer: null,
  footerNowPlaying: null,
  footerInfo: null,
  resetBtn: null,
  worksById: new Map(),
  activeWorkId: null,
  modules: [],
  nodes: [],
  nodesById: new Map(),
  clusterCenters: new Map(),
  positions: new Map(),
  links: [],
  simulation: null,
  dragging: null,
  fieldSize: { width: 0, height: 0 },
  isHoverCapable: typeof window.matchMedia === 'function' ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : false,
  prefersReducedMotion: typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  description: { popover: null, sheet: null, currentWork: null, interactive: false },
  pdf: { pane: null, frame: null, title: null, close: null, backdrop: null, viewerReady: false, pendingGoto: null, currentSlug: null, restoreFocus: null, followAudio: null, followHandler: null, followSlug: null, lastPrinted: null },
  timers: new Map(),
  hintShown: false
};

try {
  state.hintShown = sessionStorage.getItem(SESSION_HINT_KEY) === '1';
} catch (_) {
  state.hintShown = false;
}

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

function getAudioSourceFor(work) {
  return work?.audioUrl || work?.audio || '';
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

function ensureAudioSrc(audio, work) {
  const src = normalizeSrc(getAudioSourceFor(work));
  if (!src) return false;
  if (!audio.src || audio.src !== src) audio.src = src;
  return true;
}

function markPlaying(workId, playing) {
  state.modules.forEach((module) => {
    if (module.work.id !== workId) return;
    module.el.classList.toggle('is-playing', !!playing);
    if (playing) {
      module.el.classList.add('is-active');
    } else if (state.activeWorkId !== workId) {
      module.el.classList.remove('is-active');
    }
    if (module.kind === 'action') {
      const btn = module.el.querySelector('[data-role="play-toggle"]');
      if (btn) btn.textContent = playing ? 'Pause' : 'Play';
    }
  });
  if (!playing) stopTimer(workId);
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
        <button type="button" class="ts-pdf-close" aria-label="Close score">close</button>
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

function hidePdfPane() {
  const { pane, backdrop, restoreFocus } = state.pdf;
  if (pane) {
    pane.setAttribute('hidden', '');
    pane.setAttribute('aria-hidden', 'true');
  }
  backdrop?.setAttribute('hidden', '');
  document.body.classList.remove('ts-pdf-open');
  document.body.classList.remove('ts-reader-open');
  detachPageFollow();
  if (restoreFocus) {
    restoreFocus.focus?.();
    state.pdf.restoreFocus = null;
  }
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
  if (title) title.textContent = `${work.title || work.slug || 'Work'} — score`;
  frame.src = viewerUrl;
  frame.addEventListener('load', () => { state.pdf.viewerReady = true; }, { once: true });
  if (state.pdf.currentSlug && state.pdf.followSlug !== state.pdf.currentSlug) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) attachPageFollow(state.pdf.currentSlug, audio);
  }
}

function playAt(id, atSeconds) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const src = normalizeSrc(getAudioSourceFor(work));
  if (!src) return;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  ensureAudioSrc(audio, work);
  audio.currentTime = Math.max(0, atSeconds || 0);
  audio.play().catch(() => {});
  markPlaying(work.id, true);
  bindAudioEvents(work.id, audio);
  attachPageFollow(work.slug, audio);
}

function togglePlayFor(id) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return false;
  const src = normalizeSrc(getAudioSourceFor(work));
  if (!src) return false;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return false;
  ensureAudioSrc(audio, work);
  if (audio.paused || audio.ended) {
    audio.play().catch(() => {});
    markPlaying(work.id, true);
    bindAudioEvents(work.id, audio);
    attachPageFollow(work.slug, audio);
    return true;
  }
  audio.pause();
  markPlaying(work.id, false);
  updateNowPlaying(null);
  return true;
}

function stopTimer(workId) {
  const info = state.timers.get(workId);
  if (info) {
    cancelAnimationFrame(info.raf);
    state.timers.delete(workId);
  }
}

function scheduleTimer(workId) {
  const record = findWorkById(workId);
  const audio = document.getElementById('wc-a' + workId) || record?.audio;
  if (!audio) return;
  stopTimer(workId);
  const tick = () => {
    updateTimer(workId, audio);
    const info = state.timers.get(workId);
    if (info) info.raf = requestAnimationFrame(tick);
  };
  state.timers.set(workId, { raf: requestAnimationFrame(tick), audio });
}

function updateTimer(workId, audio) {
  const module = state.modules.find((item) => item.work.id === workId && item.kind === 'action');
  const timerEl = module?.el.querySelector('[data-role="timer"]');
  if (timerEl) timerEl.textContent = formatTime(audio?.currentTime || 0);
}

function bindAudioEvents(id, audio) {
  if (!audio) return;
  if (audio.dataset.tsBound === '1') return;
  audio.dataset.tsBound = '1';
  audio.addEventListener('play', () => {
    markPlaying(id, true);
    scheduleTimer(id);
    updateNowPlaying({ id, audio });
  });
  audio.addEventListener('pause', () => {
    markPlaying(id, false);
    updateNowPlaying(audio.paused ? null : { id, audio });
  });
  audio.addEventListener('ended', () => {
    markPlaying(id, false);
    updateNowPlaying(null);
  });
  audio.addEventListener('timeupdate', () => {
    scheduleTimer(id);
    if (!audio.paused) updateNowPlaying({ id, audio });
  });
  audio.addEventListener('loadedmetadata', () => {
    scheduleTimer(id);
    if (!audio.paused) updateNowPlaying({ id, audio });
  });
}

function updateNowPlaying(payload) {
  const now = state.footerNowPlaying;
  const footer = state.footer;
  if (!footer || !now) return;
  if (!payload) {
    footer.classList.remove('has-now-playing');
    now.innerHTML = '';
    now.removeAttribute('data-work');
    return;
  }
  const record = findWorkById(payload.id);
  const work = record?.data;
  if (!work) return;
  const total = payload.audio?.duration ? formatTime(payload.audio.duration) : '--:--';
  const current = payload.audio?.currentTime ? formatTime(payload.audio.currentTime) : '0:00';
  now.innerHTML = `<span aria-hidden="true" class="ts-now-icon">⏸</span>Now playing: ${work.title || work.slug || 'Work'} — ${current} / ${total}`;
  now.dataset.work = String(work.id);
  footer.classList.add('has-now-playing');
}

function ensureAudioTags() {
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
}

function ensureFooter() {
  if (state.footer) return;
  const footer = document.querySelector('.ts-footer');
  if (!footer) return;
  state.footer = footer;
  state.footerNowPlaying = footer.querySelector('[data-now-playing]');
  state.footerInfo = footer.querySelector('[data-footer-info]');
  if (state.footerNowPlaying) state.footerNowPlaying.setAttribute('aria-live', 'polite');
}
function computeMetaChips(work) {
  const chips = [];
  if (work.year) chips.push({ label: String(work.year), key: 'year' });
  if (work.medium) chips.push({ label: String(work.medium), key: 'medium' });
  if (work.duration) chips.push({ label: String(work.duration), key: 'duration' });
  if (Array.isArray(work.tags)) {
    work.tags.forEach((tag, idx) => {
      chips.push({ label: String(tag), key: `tag-${idx}` });
    });
  }
  if (!chips.length && work.slug) {
    chips.push({ label: `#${work.slug}`, key: 'slug' });
  }
  return chips;
}

function getWorkDescription(work) {
  const body = Array.isArray(work.openNote) ? work.openNote.join('\n\n') : String(work.one || '');
  return body.trim();
}

function createModule(work, kind, options = {}) {
  const el = document.createElement('div');
  el.className = `ts-module ts-module--${kind}`;
  el.dataset.workId = work.id != null ? String(work.id) : '';
  el.dataset.moduleKind = kind;
  el.tabIndex = 0;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `${work.title || work.slug || 'Work'} — ${kind}`);
  el.setAttribute('aria-keyshortcuts', 'ArrowKeys,Shift+Arrow');
  const handle = document.createElement('span');
  handle.className = 'ts-module-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.textContent = '⋮⋮';
  el.appendChild(handle);
  if (kind === 'title') {
    const title = document.createElement('h2');
    title.className = 'ts-title';
    title.textContent = work.title || work.slug || 'Untitled';
    title.setAttribute('data-role', 'title-text');
    el.appendChild(title);
    const teaser = document.createElement('p');
    teaser.className = 'ts-teaser';
    teaser.textContent = getWorkDescription(work);
    teaser.setAttribute('aria-hidden', 'true');
    el.appendChild(teaser);
    el.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      event.preventDefault();
      toggleDescription(work, el, { interactive: !state.isHoverCapable });
    });
    el.addEventListener('focus', () => toggleDescription(work, el, { interactive: true }));
    if (state.isHoverCapable) {
      el.addEventListener('mouseenter', () => toggleDescription(work, el, { hover: true }));
      el.addEventListener('mouseleave', () => hideDescriptionIfHover(work));
    }
  } else if (kind === 'teaser') {
    const teaser = document.createElement('p');
    teaser.className = 'ts-teaser';
    teaser.textContent = getWorkDescription(work);
    el.appendChild(teaser);
  } else if (kind === 'meta') {
    const chip = document.createElement('span');
    chip.className = 'ts-chip';
    chip.textContent = options.label || '';
    el.appendChild(chip);
  } else if (kind === 'action') {
    el.setAttribute('role', 'toolbar');
    const buttons = buildActionButtons(work);
    buttons.forEach((btn) => el.appendChild(btn));
    const timer = document.createElement('span');
    timer.className = 'ts-action-timer';
    timer.dataset.role = 'timer';
    timer.textContent = '0:00';
    el.appendChild(timer);
  }
  el.addEventListener('pointerdown', (event) => beginDrag(event, el));
  el.addEventListener('keydown', (event) => handleModuleKeydown(event, el));
  el.addEventListener('focus', () => setActiveWork(work.id));
  el.addEventListener('focusin', () => setActiveWork(work.id));
  el.addEventListener('focusout', (event) => {
    if (!el.contains(event.relatedTarget)) clearActiveWork(work.id);
  });
  if (state.isHoverCapable) {
    el.addEventListener('mouseenter', () => setActiveWork(work.id));
    el.addEventListener('mouseleave', (event) => {
      if (!el.contains(event.relatedTarget)) clearActiveWork(work.id);
    });
  }
  const module = { work, el, kind, id: `${work.id}-${options.key || kind}-${state.modules.length}` };
  el.dataset.moduleId = module.id;
  state.modules.push(module);
  el.addEventListener('focus', onModuleFocus);
  return module;
}

function buildActionButtons(work) {
  const buttons = [];
  const audioSrc = normalizeSrc(getAudioSourceFor(work));
  if (audioSrc) {
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'ts-btn';
    play.textContent = 'Play';
    play.dataset.role = 'play-toggle';
    play.setAttribute('aria-label', `Play or pause ${work.title}`);
    play.addEventListener('click', (event) => {
      event.preventDefault();
      const toggled = togglePlayFor(work.id);
      if (!toggled) showFeedback('Audio unavailable');
    });
    buttons.push(play);
    const cue = Array.isArray(work.cues) ? work.cues[0] : null;
    const startAt = cue ? cueTime(cue.at) : (typeof work.start_at === 'number' ? work.start_at : null);
    if (startAt != null && Number.isFinite(startAt)) {
      const playAtBtn = document.createElement('button');
      playAtBtn.type = 'button';
      playAtBtn.className = 'ts-btn';
      playAtBtn.textContent = 'Play @';
      playAtBtn.setAttribute('aria-label', `Play ${work.title} at cue`);
      playAtBtn.addEventListener('click', (event) => {
        event.preventDefault();
        playAt(work.id, startAt);
      });
      buttons.push(playAtBtn);
    }
  }
  const scoreUrl = normalizePdfUrl(work.pdfUrl || work.pdf);
  if (scoreUrl) {
    const scoreBtn = document.createElement('button');
    scoreBtn.type = 'button';
    scoreBtn.className = 'ts-btn';
    scoreBtn.textContent = 'Score';
    scoreBtn.setAttribute('aria-label', `Open score for ${work.title}`);
    scoreBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openPdfFor(work.id);
    });
    buttons.push(scoreBtn);
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'ts-btn';
    pdfBtn.textContent = 'PDF';
    pdfBtn.setAttribute('aria-label', `Open PDF for ${work.title}`);
    pdfBtn.addEventListener('click', (event) => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('wc:pdf-open', { detail: { slug: work.slug } }));
      openPdfFor(work.id);
    });
    buttons.push(pdfBtn);
  }
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'ts-btn';
  openBtn.textContent = 'Open';
  openBtn.setAttribute('aria-label', `Open detail page for ${work.title}`);
  openBtn.addEventListener('click', () => openWorkPage(work));
  buttons.push(openBtn);
  return buttons;
}

function openWorkPage(work) {
  const slug = work?.slug;
  if (!slug) return;
  const base = PRAE.config?.site?.workRoot || '/works/';
  const url = typeof PRAE.routes?.work === 'function' ? PRAE.routes.work(work) : `${base}${slug}`;
  try {
    window.location.href = url;
  } catch (_) {
    window.open(url, '_blank', 'noopener');
  }
}

function showFeedback(text) {
  if (!text) return;
  const toast = document.createElement('div');
  toast.className = 'ts-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 280);
  }, 1600);
}

function moduleToNode(module, options = {}) {
  const center = options.center || { x: 0, y: 0 };
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const node = {
    id: module.id,
    work: module.work,
    kind: module.kind,
    el: module.el,
    x: options.x ?? center.x + offsetX,
    y: options.y ?? center.y + offsetY,
    targetX: center.x + offsetX,
    targetY: center.y + offsetY,
    offsetX,
    offsetY,
    fx: null,
    fy: null,
    isDragging: false
  };
  measureNode(node);
  return node;
}

function measureNode(node) {
  node.width = node.el.offsetWidth;
  node.height = node.el.offsetHeight;
  node.radius = Math.max(node.width, node.height) / 2 + MODULE_PADDING;
}

function computeFieldSize() {
  const rect = state.field?.getBoundingClientRect();
  const width = rect?.width || window.innerWidth || 1024;
  const height = rect?.height || window.innerHeight || 768;
  state.fieldSize = { width, height };
}

function computeSeeds(count) {
  computeFieldSize();
  const width = state.fieldSize.width;
  const height = state.fieldSize.height;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const seeds = [];
  let row = 0;
  let col = 0;
  for (let i = 0; i < count; i += 1) {
    const x = (col + 0.5) * cellWidth;
    const y = (row + 0.5) * cellHeight;
    const jitterX = Math.min(cellWidth / 3, 40);
    const jitterY = Math.min(cellHeight / 3, 40);
    const rand = createSeededRandom(`seed-${i}`);
    seeds.push({
      x: x + (rand() - 0.5) * jitterX,
      y: y + (rand() - 0.5) * jitterY
    });
    col += 1;
    if (col >= cols) {
      col = 0;
      row += 1;
    }
  }
  return seeds;
}

function setActiveWork(workId) {
  if (state.activeWorkId === workId) return;
  state.activeWorkId = workId;
  state.modules.forEach((module) => {
    if (module.work.id === workId) {
      module.el.classList.add('is-active');
    } else if (!module.el.classList.contains('is-playing')) {
      module.el.classList.remove('is-active');
    }
  });
  persistSelection(workId);
}

function clearActiveWork(workId) {
  if (state.activeWorkId !== workId) return;
  const stillHover = state.modules.some((module) => module.work.id === workId && module.el.matches(':hover, :focus-within'));
  if (stillHover) return;
  state.activeWorkId = null;
  state.modules.forEach((module) => {
    if (module.work.id === workId && !module.el.classList.contains('is-playing')) {
      module.el.classList.remove('is-active');
    }
  });
}

function toggleDescription(work, anchor, opts = {}) {
  if (!work) return;
  if (!state.isHoverCapable) {
    showSheet(work);
    return;
  }
  if (opts.hover) {
    openPopover(work, anchor, { interactive: false });
    return;
  }
  const interactive = opts.interactive !== false;
  if (state.description.currentWork === work.id && state.description.interactive === interactive) {
    hideDescription();
    return;
  }
  openPopover(work, anchor, { interactive });
}

function hideDescriptionIfHover(work) {
  if (state.description.interactive) return;
  if (state.description.currentWork !== work.id) return;
  hideDescription();
}
function ensurePopover() {
  if (state.description.popover) return state.description.popover;
  const pop = document.createElement('div');
  pop.className = 'ts-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'false');
  pop.setAttribute('hidden', '');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ts-popover-close ts-btn';
  close.textContent = 'Close';
  const body = document.createElement('div');
  body.className = 'ts-popover-body';
  pop.append(close, body);
  document.body.appendChild(pop);
  close.addEventListener('click', hideDescription);
  pop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideDescription();
    }
  });
  state.description.popover = { root: pop, body, close };
  return state.description.popover;
}

function ensureSheet() {
  if (state.description.sheet) return state.description.sheet;
  const sheet = document.createElement('div');
  sheet.className = 'ts-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('tabindex', '-1');
  sheet.setAttribute('hidden', '');
  sheet.innerHTML = `
    <div class="ts-sheet-content">
      <header class="ts-sheet-header">
        <h3 data-role="title"></h3>
        <button type="button" data-role="close" class="ts-btn" aria-label="Close description">Close</button>
      </header>
      <div class="ts-sheet-body"></div>
    </div>`;
  document.body.appendChild(sheet);
  const close = sheet.querySelector('[data-role="close"]');
  close?.addEventListener('click', hideSheet);
  sheet.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideSheet();
    }
  });
  state.description.sheet = {
    root: sheet,
    title: sheet.querySelector('[data-role="title"]'),
    body: sheet.querySelector('.ts-sheet-body')
  };
  return state.description.sheet;
}

function openPopover(work, anchor, { interactive }) {
  const pop = ensurePopover();
  if (!pop?.root || !anchor) return;
  const description = getWorkDescription(work);
  pop.body.textContent = description;
  pop.root.removeAttribute('hidden');
  pop.root.dataset.workId = String(work.id);
  pop.root.dataset.interactive = interactive ? '1' : '0';
  state.description.currentWork = work.id;
  state.description.interactive = interactive;
  const rect = anchor.getBoundingClientRect();
  const popRect = pop.root.getBoundingClientRect();
  const top = Math.max(16, rect.bottom + 12 + window.scrollY);
  const left = clamp(rect.left + rect.width / 2 - popRect.width / 2, 16, window.innerWidth - popRect.width - 16);
  pop.root.style.left = `${left}px`;
  pop.root.style.top = `${top}px`;
  if (interactive) {
    trapFocus(pop.root);
    pop.close?.focus({ preventScroll: true });
  } else {
    releaseFocus(pop.root);
  }
}

function hideDescription() {
  const pop = state.description.popover;
  if (pop?.root) {
    pop.root.setAttribute('hidden', '');
    releaseFocus(pop.root);
  }
  hideSheet();
  state.description.currentWork = null;
  state.description.interactive = false;
}

function showSheet(work) {
  const sheet = ensureSheet();
  if (!sheet?.root) return;
  const description = getWorkDescription(work);
  sheet.title.textContent = work.title || work.slug || 'Work';
  sheet.body.textContent = description;
  sheet.root.removeAttribute('hidden');
  sheet.root.classList.add('is-open');
  sheet.root.focus({ preventScroll: true });
  trapFocus(sheet.root);
  state.description.currentWork = work.id;
  state.description.interactive = true;
}

function hideSheet() {
  const sheet = state.description.sheet;
  if (!sheet?.root) return;
  sheet.root.setAttribute('hidden', '');
  sheet.root.classList.remove('is-open');
  releaseFocus(sheet.root);
}

function trapFocus(root) {
  if (!root) return;
  const focusable = root.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const handler = (event) => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  root.__trapHandler = handler;
  root.addEventListener('keydown', handler);
}

function releaseFocus(root) {
  if (!root?.__trapHandler) return;
  root.removeEventListener('keydown', root.__trapHandler);
  delete root.__trapHandler;
}

function beginDrag(event, el) {
  if (event.button !== 0) return;
  event.preventDefault();
  const node = state.nodes.find((item) => item.el === el);
  if (!node) return;
  const rect = state.field.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  node.fx = offsetX;
  node.fy = offsetY;
  node.isDragging = true;
  el.setPointerCapture(event.pointerId);
  el.classList.add('is-dragging');
  state.dragging = { node, pointerId: event.pointerId };
  if (state.simulation) state.simulation.alphaTarget(0.3).restart();
  el.addEventListener('pointermove', dragMove);
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
}

function dragMove(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const rect = state.field.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const { node } = drag;
  const bounds = clampNode(node, x, y);
  node.fx = bounds.x;
  node.fy = bounds.y;
  if (state.simulation) state.simulation.alpha(0.16);
  updateNodeTransform(node);
}

function endDrag(event) {
  const drag = state.dragging;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const { node } = drag;
  node.isDragging = false;
  node.el.classList.remove('is-dragging');
  node.x = node.fx;
  node.y = node.fy;
  persistNodePosition(node);
  state.dragging = null;
  event.currentTarget.removeEventListener('pointermove', dragMove);
  event.currentTarget.removeEventListener('pointerup', endDrag);
  event.currentTarget.removeEventListener('pointercancel', endDrag);
  if (state.simulation) state.simulation.alphaTarget(0);
}

function handleModuleKeydown(event, el) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const node = state.nodes.find((item) => item.el === el);
  if (!node) return;
  event.preventDefault();
  const step = event.shiftKey ? 16 : 4;
  let x = node.fx ?? node.x ?? 0;
  let y = node.fy ?? node.y ?? 0;
  switch (event.key) {
    case 'ArrowUp':
      y -= step;
      break;
    case 'ArrowDown':
      y += step;
      break;
    case 'ArrowLeft':
      x -= step;
      break;
    case 'ArrowRight':
      x += step;
      break;
    default:
      break;
  }
  const bounds = clampNode(node, x, y);
  node.fx = bounds.x;
  node.fy = bounds.y;
  node.x = bounds.x;
  node.y = bounds.y;
  persistNodePosition(node);
  if (state.simulation) state.simulation.alpha(0.12).restart();
  updateNodeTransform(node);
}

function clampNode(node, x, y) {
  const width = node.width || node.el.offsetWidth;
  const height = node.height || node.el.offsetHeight;
  const minX = width / 2 + 16;
  const maxX = state.fieldSize.width - width / 2 - 16;
  const minY = height / 2 + 16;
  const maxY = state.fieldSize.height - height / 2 - 16;
  return {
    x: clamp(x, minX, Math.max(minX, maxX)),
    y: clamp(y, minY, Math.max(minY, maxY))
  };
}

function persistNodePosition(node) {
  const key = node.id;
  if (!key) return;
  state.positions.set(key, { x: node.x, y: node.y });
}

function updateNodeTransform(node) {
  if (!node.el) return;
  const width = node.width || node.el.offsetWidth;
  const height = node.height || node.el.offsetHeight;
  const x = (node.fx != null ? node.fx : node.x) - width / 2;
  const y = (node.fy != null ? node.fy : node.y) - height / 2;
  node.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}
function initializeSimulation() {
  if (state.simulation) state.simulation.stop();
  state.nodes.forEach((node) => {
    measureNode(node);
    const stored = state.positions.get(node.id);
    if (stored) {
      node.x = stored.x;
      node.y = stored.y;
    }
  });
  const links = [];
  const titleNodes = new Map();
  state.nodes.forEach((node) => {
    if (node.kind === 'title') titleNodes.set(node.work.id, node);
  });
  state.nodes.forEach((node) => {
    if (node.kind !== 'title') {
      const target = titleNodes.get(node.work.id);
      if (target) {
        links.push({ source: node, target, distance: Math.max(80, target.radius + node.radius) });
      }
    }
  });
  state.links = links;
  const simulation = forceSimulation(state.nodes)
    .force('collide', forceCollide().radius((d) => d.radius).iterations(2))
    .force('charge', forceManyBody().strength(-8))
    .force('link', forceLink(links).distance((d) => d.distance).strength(CLUSTER_FORCE))
    .force('x', forceX((d) => d.targetX).strength(CLUSTER_FORCE))
    .force('y', forceY((d) => d.targetY).strength(CLUSTER_FORCE))
    .alphaDecay(state.prefersReducedMotion ? 0.08 : 0.05)
    .on('tick', () => {
      state.nodes.forEach((node) => {
        if (node.isDragging) return;
        const bounds = clampNode(node, node.x, node.y);
        node.x = bounds.x;
        node.y = bounds.y;
        updateNodeTransform(node);
      });
    });
  state.simulation = simulation;
  setTimeout(() => simulation.alphaTarget(0), 600);
}

function resetLayout() {
  state.positions.clear();
  const seeds = computeSeeds(works.length);
  works.forEach((work, index) => {
    const center = seeds[index] || { x: state.fieldSize.width / 2, y: state.fieldSize.height / 2 };
    state.clusterCenters.set(work.id, center);
    state.nodes.forEach((node) => {
      if (node.work.id !== work.id) return;
      node.targetX = center.x + node.offsetX;
      node.targetY = center.y + node.offsetY;
      node.x = node.targetX;
      node.y = node.targetY;
      node.fx = null;
      node.fy = null;
      updateNodeTransform(node);
    });
  });
  if (state.simulation) {
    state.simulation.alpha(0.4).restart();
    setTimeout(() => state.simulation.alphaTarget(0), 800);
  }
}

function showHint() {
  if (state.hintShown) return;
  if (!state.modules.length) return;
  const module = state.modules[0];
  const badge = document.createElement('div');
  badge.className = 'ts-hint';
  badge.textContent = 'Drag modules to arrange';
  state.field.appendChild(badge);
  const fieldRect = state.field.getBoundingClientRect();
  const rect = module.el.getBoundingClientRect();
  const left = rect.left - fieldRect.left + rect.width / 2;
  const top = rect.top - fieldRect.top - 32;
  badge.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  requestAnimationFrame(() => badge.classList.add('is-visible'));
  setTimeout(() => {
    badge.classList.remove('is-visible');
    setTimeout(() => badge.remove(), 240);
  }, 3200);
  state.hintShown = true;
  try { sessionStorage.setItem(SESSION_HINT_KEY, '1'); } catch (_) {}
}

function renderWorks() {
  const field = state.field;
  if (!field) return;
  field.innerHTML = '';
  state.modules = [];
  state.nodes = [];
  state.nodesById.clear();
  state.clusterCenters.clear();
  const seeds = computeSeeds(works.length);
  works.forEach((work, index) => {
    const center = seeds[index] || { x: 180 + index * 40, y: 180 + index * 40 };
    state.clusterCenters.set(work.id, center);
    const titleModule = createModule(work, 'title');
    field.appendChild(titleModule.el);
    const titleNode = moduleToNode(titleModule, { center });
    state.nodes.push(titleNode);
    state.nodesById.set(titleNode.id, titleNode);
    const chips = computeMetaChips(work);
    chips.forEach((chip, chipIndex) => {
      const metaModule = createModule(work, 'meta', { label: chip.label, key: chip.key || `meta-${chipIndex}` });
      field.appendChild(metaModule.el);
      const angle = (chipIndex / Math.max(1, chips.length)) * Math.PI * 2;
      const offsetX = Math.cos(angle) * 96;
      const offsetY = Math.sin(angle) * 72;
      const node = moduleToNode(metaModule, { center, offsetX, offsetY });
      state.nodes.push(node);
      state.nodesById.set(node.id, node);
    });
    const actionModule = createModule(work, 'action');
    field.appendChild(actionModule.el);
    const actionNode = moduleToNode(actionModule, { center, offsetX: 110, offsetY: 40 });
    state.nodes.push(actionNode);
    state.nodesById.set(actionNode.id, actionNode);
    const teaserModule = createModule(work, 'teaser');
    field.appendChild(teaserModule.el);
    const teaserNode = moduleToNode(teaserModule, { center, offsetX: -100, offsetY: 60 });
    state.nodes.push(teaserNode);
    state.nodesById.set(teaserNode.id, teaserNode);
  });
  initializeSimulation();
  requestAnimationFrame(() => showHint());
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
        a.className = 'ts-nav-link';
        nav.appendChild(a);
      });
    }
  }
  const footerInfo = document.querySelector('[data-footer-info]');
  if (footerInfo) {
    const year = new Date().getFullYear();
    const artist = site.fullName || site.copyrightName || 'Artist';
    const brand = site.brand || site.title || PRAE.config?.meta?.title || 'Praetorius';
    footerInfo.textContent = `© ${year} ${artist} · ${brand} · `;
    const link = document.createElement('a');
    link.href = PRAE.config?.site?.praetoriusHome || 'https://praetorius.club';
    link.textContent = 'Praetorius';
    link.className = 'ts-footer-badge';
    footerInfo.appendChild(link);
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

function handleResize() {
  computeFieldSize();
  if (state.simulation) {
    state.simulation.alpha(0.2).restart();
    setTimeout(() => state.simulation.alphaTarget(0), 500);
  }
}

function hydrateFromHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const workVal = params.get(HASH_WORK_KEY);
  const workId = workVal != null ? Number(workVal) : null;
  if (workId != null && !Number.isNaN(workId)) {
    const module = state.modules.find((item) => Number(item.work.id) === Number(workId));
    module?.el.focus({ preventScroll: true });
  }
}

function persistSelection(workId) {
  const params = new URLSearchParams();
  if (workId != null) params.set(HASH_WORK_KEY, String(workId));
  const hash = params.toString();
  history.replaceState(null, '', hash ? `#${hash}` : '#');
}

function onModuleFocus(event) {
  const workId = Number(event.target?.dataset?.workId);
  if (!Number.isNaN(workId)) persistSelection(workId);
}

ready(() => {
  state.field = document.getElementById('ts-field');
  state.resetBtn = document.getElementById('ts-reset');
  ensureFooter();
  setupSiteBrand();
  initThemeToggle();
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  computeFieldSize();
  renderWorks();
  hydrateFromHash();
  ensureAudioTags();
  state.resetBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    resetLayout();
  });
  window.addEventListener('resize', handleResize);
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  media?.addEventListener('change', (event) => {
    state.prefersReducedMotion = !!event.matches;
    if (state.simulation) {
      state.simulation.alpha(0.2).restart();
      setTimeout(() => state.simulation.alphaTarget(0), 400);
    }
  });
});

window.addEventListener('hashchange', hydrateFromHash);
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
