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
const SAFE_MARGIN = 64;
const COLLISION_PADDING = 24;
const MAX_ROTATION = 2; // degrees

const state = {
  field: null,
  worksById: new Map(),
  items: [],
  itemById: new Map(),
  positions: new Map(),
  activeWorkId: null,
  dragging: null,
  reduceMotion: false,
  layoutQueued: false,
  layoutToken: 0,
  footer: {
    root: null,
    copy: null,
    badge: null,
    title: null,
    pdfBtn: null,
    playBtn: null,
    cuesBtn: null,
    cueList: null,
    live: null
  },
  ariaLive: null,
  hint: null,
  hintShown: false,
  pdf: {
    pane: null,
    frame: null,
    title: null,
    close: null,
    backdrop: null,
    viewerReady: false,
    pendingGoto: null,
    currentSlug: null,
    restoreFocus: null,
    followAudio: null,
    followHandler: null,
    followSlug: null,
    lastPrinted: null
  },
  timers: new Map(),
  footerActiveTitle: '',
  cuesOpen: false,
  resizeHandle: null,
  lastSeed: ''
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
    updateFooterPlaybackState();
    const info = state.timers.get(workId);
    if (info) info.raf = requestAnimationFrame(tick);
  };
  state.timers.set(workId, { raf: requestAnimationFrame(tick), audio });
}

function bindAudioEvents(id, audio) {
  if (!audio) return;
  if (audio.dataset.tsBound === '1') return;
  audio.dataset.tsBound = '1';
  audio.addEventListener('play', () => {
    markPlaying(id, true);
    scheduleTimer(id);
    updateFooterPlaybackState();
    attachPageFollow(findWorkById(id)?.data?.slug, audio);
  });
  audio.addEventListener('pause', () => {
    markPlaying(id, false);
    updateFooterPlaybackState();
  });
  audio.addEventListener('ended', () => {
    markPlaying(id, false);
    updateFooterPlaybackState();
  });
  audio.addEventListener('timeupdate', () => {
    scheduleTimer(id);
  });
  audio.addEventListener('loadedmetadata', () => {
    scheduleTimer(id);
    updateFooterPlaybackState();
  });
}

function markPlaying(workId, playing) {
  state.items.forEach((item) => {
    if (item.work.id !== workId) return;
    item.el.classList.toggle('is-playing', !!playing);
    if (!playing && state.activeWorkId !== workId) {
      item.el.classList.remove('is-active');
    }
  });
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
  pauseAllExcept(work.id);
  audio.currentTime = Math.max(0, atSeconds || 0);
  audio.play().catch(() => {});
  markPlaying(work.id, true);
  bindAudioEvents(work.id, audio);
  attachPageFollow(work.slug, audio);
  state.activeWorkId = work.id;
  setActiveItem(work.id);
  updateFooterPlaybackState();
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
    pauseAllExcept(work.id);
    audio.play().catch(() => {});
    markPlaying(work.id, true);
    bindAudioEvents(work.id, audio);
    attachPageFollow(work.slug, audio);
    state.activeWorkId = work.id;
    setActiveItem(work.id);
    updateFooterPlaybackState();
    return true;
  }
  audio.pause();
  markPlaying(work.id, false);
  updateFooterPlaybackState();
  return true;
}

function pauseAllExcept(id) {
  state.items.forEach((item) => {
    if (item.work.id === id) return;
    const audio = document.getElementById('wc-a' + item.work.id);
    if (audio && !audio.paused) audio.pause();
  });
}

function ensureAudioTags() {
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
}

function applySiteInfo() {
  const site = PRAE.config?.site || {};
  const titleParts = [site.fullName, [site.firstName, site.lastName].filter(Boolean).join(' ')].filter(Boolean);
  const fallbackName = titleParts[0] || titleParts[1] || site.title || site.copyrightName || 'Praetorius';
  const subtitle = site.subtitle ? String(site.subtitle) : '';
  const title = String(fallbackName || '').trim();
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
        if (link.external) {
          a.target = '_blank';
          a.rel = 'noopener';
        }
        nav.appendChild(a);
      });
    }
  }
  const copyName = site.copyrightName || title;
  if (state.footer.copy) {
    const year = new Date().getFullYear();
    const pieces = [];
    if (copyName) pieces.push(`© ${year} ${copyName}`); else pieces.push(`© ${year}`);
    state.footer.copy.textContent = pieces.join(' · ');
  }
}

function buildPraeBadge() {
  if (!state.footer.badge) return;
  state.footer.badge.innerHTML = `
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.65 5.36 5.91.86-4.28 4.17 1.01 5.89L12 15.98l-5.29 2.8 1.01-5.89-4.28-4.17 5.91-.86z"/></svg>
    <span>Powered by Praetorius</span>`;
}

function getStackModules(work) {
  const modules = [];
  const oneliner = work.oneliner || work.one || '';
  const descriptionParts = [];
  if (Array.isArray(work.openNote)) descriptionParts.push(work.openNote.join('\n\n'));
  if (work.description) descriptionParts.push(String(work.description));
  const description = descriptionParts.join('\n\n');
  if (oneliner) modules.push({ kind: 'oneliner', text: String(oneliner) });
  if (description && description.trim() && description.trim() !== oneliner.trim()) {
    modules.push({ kind: 'description', text: description.trim() });
  }
  const detailBits = [];
  if (work.year) detailBits.push(String(work.year));
  if (work.duration) detailBits.push(String(work.duration));
  if (work.medium) detailBits.push(String(work.medium));
  if (Array.isArray(work.tags) && work.tags.length) {
    const tags = work.tags.map((tag) => `#${String(tag).replace(/^#/, '')}`);
    detailBits.push(tags.join(' '));
  }
  if (detailBits.length) {
    modules.push({ kind: 'details', text: detailBits.join(' · ') });
  }
  if (!modules.length && work.slug) {
    modules.push({ kind: 'details', text: `#${work.slug}` });
  }
  return modules;
}

function normalizeCues(work) {
  const cues = [];
  if (Array.isArray(work.cues)) {
    work.cues.forEach((cue, index) => {
      if (cue == null) return;
      if (typeof cue === 'object') {
        const seconds = cueTime(cue.t ?? cue.time ?? cue.at ?? cue.start ?? cue.seconds ?? cue.index);
        const label = typeof cue.label === 'string' && cue.label.trim() ? cue.label.trim() : `@${formatTime(seconds)}`;
        cues.push({ seconds, label: label.startsWith('@') ? label : `@${label}` });
      } else {
        const seconds = cueTime(cue);
        cues.push({ seconds, label: `@${formatTime(seconds)}` });
      }
    });
  }
  if (!cues.length) {
    const startAt = typeof work.start_at === 'number' ? work.start_at : null;
    if (startAt != null && Number.isFinite(startAt)) cues.push({ seconds: startAt, label: `@${formatTime(startAt)}` });
  }
  const seen = new Set();
  return cues.filter((cue) => {
    const key = `${cue.seconds}-${cue.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Number.isFinite(cue.seconds);
  });
}

function createItem(work, random) {
  const article = document.createElement('article');
  article.className = 'ts-item';
  article.dataset.workId = String(work.id);
  article.setAttribute('role', 'group');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ts-item-title';
  button.textContent = work.title || work.slug || 'Untitled';
  button.setAttribute('data-role', 'title');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `ts-stack-${work.id}`);
  button.addEventListener('click', () => toggleSelection(work.id));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSelection(work.id);
    }
  });

  const stack = document.createElement('div');
  stack.className = 'ts-item-stack';
  stack.id = `ts-stack-${work.id}`;
  stack.hidden = true;
  const modules = getStackModules(work);
  if (modules.length) {
    modules.forEach((module, index) => {
      const line = document.createElement('p');
      line.className = `ts-stack-line ts-stack-line--${module.kind}`;
      line.textContent = module.text;
      line.style.setProperty('--ts-stack-index', String(index));
      stack.appendChild(line);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'ts-stack-line ts-stack-line--empty';
    empty.textContent = 'No additional details available yet.';
    stack.appendChild(empty);
  }

  article.append(button, stack);
  article.addEventListener('pointerdown', (event) => beginDrag(event, article));
  article.addEventListener('focusin', () => setActiveItem(work.id));
  article.addEventListener('mouseenter', () => setActiveItem(work.id));

  const rotationSeed = (random() - 0.5) * MAX_ROTATION * 2;
  const jitterSeed = (random() - 0.5) * 0.06;
  const effectiveRotation = state.reduceMotion ? 0 : rotationSeed;
  const effectiveJitter = state.reduceMotion ? 0 : jitterSeed;
  button.style.setProperty('--ts-tilt', `${effectiveRotation.toFixed(3)}deg`);
  button.style.setProperty('--ts-letter-jitter', `${effectiveJitter.toFixed(3)}em`);

  state.field.appendChild(article);
  const item = {
    work,
    el: article,
    button,
    stack,
    rotation: rotationSeed,
    letterJitter: jitterSeed,
    width: 0,
    height: 0
  };
  measureItem(item);
  return item;
}

function measureItem(item) {
  const rect = item.button.getBoundingClientRect();
  item.width = rect.width || 160;
  item.height = rect.height || 48;
}

function renderWorks() {
  if (!state.field) return;
  state.items = [];
  state.itemById.clear();
  state.field.innerHTML = '';
  const data = works.slice().sort((a, b) => {
    const aKey = (a.title || a.slug || '').toLowerCase();
    const bKey = (b.title || b.slug || '').toLowerCase();
    return aKey.localeCompare(bKey);
  });
  if (!data.length) {
    const empty = document.createElement('p');
    empty.className = 'ts-empty';
    empty.textContent = 'No works available yet.';
    state.field.appendChild(empty);
    return;
  }
  const seedBase = data.map((work) => work.slug || work.title || work.id).join('|');
  const random = createSeededRandom(seedBase || 'typescatter');
  data.forEach((work) => {
    const item = createItem(work, random);
    state.items.push(item);
    state.itemById.set(Number(work.id), item);
  });
}

function computeFieldBox() {
  const rect = state.field?.getBoundingClientRect();
  const width = rect?.width || window.innerWidth || 1024;
  const height = rect?.height || window.innerHeight || 768;
  return { width, height };
}

function jitteredGridLayout(items, size, random) {
  const width = Math.max(1, size.width - SAFE_MARGIN * 2);
  const height = Math.max(1, size.height - SAFE_MARGIN * 2);
  const count = Math.max(1, items.length);
  const aspect = width / height;
  const rows = Math.max(1, Math.round(Math.sqrt(count / aspect)));
  const cols = Math.max(1, Math.ceil(count / rows));
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const jitterX = cellWidth * 0.35;
  const jitterY = cellHeight * 0.35;
  const positions = new Map();
  items.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const halfW = item.width / 2;
    const halfH = item.height / 2;
    const xBase = SAFE_MARGIN + (col + 0.5) * cellWidth;
    const yBase = SAFE_MARGIN + (row + 0.5) * cellHeight;
    const x = clamp(xBase + (random() - 0.5) * jitterX, SAFE_MARGIN + halfW, size.width - SAFE_MARGIN - halfW);
    const y = clamp(yBase + (random() - 0.5) * jitterY, SAFE_MARGIN + halfH, size.height - SAFE_MARGIN - halfH);
    positions.set(item.work.id, { x, y });
  });
  return positions;
}

function resolveCollisions(items, positions, size, random) {
  const iterations = 8;
  const width = size.width;
  const height = size.height;
  for (let iter = 0; iter < iterations; iter += 1) {
    let adjusted = false;
    for (let i = 0; i < items.length; i += 1) {
      const a = items[i];
      const posA = positions.get(a.work.id);
      if (!posA) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        const b = items[j];
        const posB = positions.get(b.work.id);
        if (!posB) continue;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const overlapX = (a.width + b.width) / 2 + COLLISION_PADDING - Math.abs(dx);
        const overlapY = (a.height + b.height) / 2 + COLLISION_PADDING - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          adjusted = true;
          const angle = Math.atan2(dy || (random() - 0.5), dx || (random() - 0.5));
          const push = Math.min(overlapX, overlapY);
          const pushX = Math.cos(angle) * push * 0.6;
          const pushY = Math.sin(angle) * push * 0.6;
          posA.x = clamp(posA.x - pushX, SAFE_MARGIN + a.width / 2, width - SAFE_MARGIN - a.width / 2);
          posA.y = clamp(posA.y - pushY, SAFE_MARGIN + a.height / 2, height - SAFE_MARGIN - a.height / 2);
          posB.x = clamp(posB.x + pushX, SAFE_MARGIN + b.width / 2, width - SAFE_MARGIN - b.width / 2);
          posB.y = clamp(posB.y + pushY, SAFE_MARGIN + b.height / 2, height - SAFE_MARGIN - b.height / 2);
        }
      }
    }
    if (!adjusted) break;
  }
}

function applyPositions(positions) {
  positions.forEach((pos, id) => {
    const item = state.itemById.get(Number(id));
    if (!item) return;
    const tx = pos.x - item.width / 2;
    const ty = pos.y - item.height / 2;
    item.el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  });
}

function layoutScatter(options = {}) {
  if (!state.field || !state.items.length) return;
  state.layoutQueued = false;
  state.layoutToken += 1;
  const token = state.layoutToken;
  const size = computeFieldBox();
  const seed = `${size.width.toFixed(0)}x${size.height.toFixed(0)}::${state.items.map((item) => item.work.slug || item.work.title || item.work.id).join('|')}`;
  if (state.lastSeed !== seed || options.force) {
    state.items.forEach((item) => measureItem(item));
    const random = createSeededRandom(seed);
    const positions = jitteredGridLayout(state.items, size, random);
    resolveCollisions(state.items, positions, size, random);
    if (token === state.layoutToken) {
      state.positions = positions;
      applyPositions(positions);
    }
    state.lastSeed = seed;
  } else {
    applyPositions(state.positions);
  }
}

function queueLayout(options = {}) {
  if (state.layoutQueued) return;
  state.layoutQueued = true;
  requestAnimationFrame(() => layoutScatter(options));
}

function beginDrag(event, target) {
  if (!(event instanceof PointerEvent)) return;
  if (!target.classList.contains('ts-item')) return;
  const workId = Number(target.dataset.workId);
  if (Number.isNaN(workId)) return;
  const item = state.itemById.get(workId);
  if (!item) return;
  target.setPointerCapture(event.pointerId);
  target.classList.add('is-dragging');
  const pos = state.positions.get(workId) || { x: 0, y: 0 };
  state.dragging = {
    id: workId,
    offsetX: event.clientX - pos.x,
    offsetY: event.clientY - pos.y
  };
  target.addEventListener('pointermove', onDragMove);
  target.addEventListener('pointerup', onDragEnd, { once: true });
  target.addEventListener('pointercancel', onDragEnd, { once: true });
}

function onDragMove(event) {
  if (!state.dragging) return;
  const workId = state.dragging.id;
  const item = state.itemById.get(workId);
  if (!item) return;
  const size = computeFieldBox();
  const x = clamp(event.clientX - state.dragging.offsetX, SAFE_MARGIN + item.width / 2, size.width - SAFE_MARGIN - item.width / 2);
  const y = clamp(event.clientY - state.dragging.offsetY, SAFE_MARGIN + item.height / 2, size.height - SAFE_MARGIN - item.height / 2);
  state.positions.set(workId, { x, y });
  applyPositions(state.positions);
}

function onDragEnd(event) {
  if (!state.dragging) return;
  const workId = state.dragging.id;
  const item = state.itemById.get(workId);
  if (item) {
    item.el.classList.remove('is-dragging');
  }
  state.dragging = null;
  event.currentTarget?.removeEventListener('pointermove', onDragMove);
}

function toggleSelection(workId) {
  if (state.activeWorkId === workId) {
    clearSelection();
  } else {
    pauseAllExcept(workId);
    setActiveItem(workId, { announce: true });
  }
}

function setActiveItem(workId, options = {}) {
  if (!state.itemById.has(Number(workId))) return;
  closeCuePopover();
  state.activeWorkId = workId;
  state.items.forEach((item) => {
    const isActive = item.work.id === workId;
    item.el.classList.toggle('is-active', isActive);
    item.button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    if (isActive) {
      item.stack.hidden = false;
    } else {
      item.stack.hidden = true;
    }
  });
  updateFooterControls();
  persistSelection(workId);
  if (options.announce) announceSelection(workId);
}

function clearSelection(options = {}) {
  state.activeWorkId = null;
  state.items.forEach((item) => {
    item.el.classList.remove('is-active');
    item.button.setAttribute('aria-expanded', 'false');
    item.stack.hidden = true;
  });
  closeCuePopover();
  updateFooterControls();
  persistSelection(null);
  if (options.announce) announceSelection(null);
}

function announceSelection(workId) {
  if (!state.ariaLive) return;
  if (workId == null) {
    state.ariaLive.textContent = 'Selection cleared.';
    return;
  }
  const work = findWorkById(workId)?.data;
  if (!work) return;
  state.ariaLive.textContent = `${work.title || work.slug || 'Work'} selected.`;
}

function persistSelection(workId) {
  const params = new URLSearchParams();
  if (workId != null) params.set(HASH_WORK_KEY, String(workId));
  const hash = params.toString();
  history.replaceState(null, '', hash ? `#${hash}` : '#');
}

function hydrateFromHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const workVal = params.get(HASH_WORK_KEY);
  const workId = workVal != null ? Number(workVal) : null;
  if (workId != null && !Number.isNaN(workId)) {
    if (state.itemById.has(workId)) {
      setActiveItem(workId, { announce: false });
      const item = state.itemById.get(workId);
      item?.button.focus({ preventScroll: true });
    }
  }
}

function updateFooterControls() {
  const work = state.activeWorkId != null ? findWorkById(state.activeWorkId)?.data : null;
  const title = work?.title || work?.slug || '';
  state.footerActiveTitle = title;
  if (state.footer.title) {
    state.footer.title.textContent = title || '';
    state.footer.title.title = title || '';
    state.footer.title.dataset.empty = title ? '0' : '1';
  }
  const pdfUrl = work ? normalizePdfUrl(work.pdfUrl || work.pdf) : '';
  if (state.footer.pdfBtn) {
    state.footer.pdfBtn.disabled = !pdfUrl;
    state.footer.pdfBtn.setAttribute('aria-disabled', state.footer.pdfBtn.disabled ? 'true' : 'false');
  }
  const audioSrc = work ? normalizeSrc(getAudioSourceFor(work)) : '';
  const audioEl = work ? document.getElementById('wc-a' + work.id) : null;
  const isPlaying = !!audioEl && !audioEl.paused && !audioEl.ended;
  if (state.footer.playBtn) {
    state.footer.playBtn.disabled = !audioSrc;
    state.footer.playBtn.setAttribute('aria-disabled', state.footer.playBtn.disabled ? 'true' : 'false');
    state.footer.playBtn.textContent = isPlaying ? 'Pause Ⅱ' : 'Play ▷';
    state.footer.playBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  }
  const cues = work ? normalizeCues(work) : [];
  if (state.footer.cuesBtn) {
    state.footer.cuesBtn.disabled = !cues.length;
    state.footer.cuesBtn.setAttribute('aria-disabled', state.footer.cuesBtn.disabled ? 'true' : 'false');
    state.footer.cuesBtn.setAttribute('aria-expanded', (!state.footer.cuesBtn.disabled && state.cuesOpen) ? 'true' : 'false');
  }
  if (state.footer.cueList) {
    state.footer.cueList.innerHTML = '';
    state.footer.cueList.setAttribute('hidden', '');
    if (cues.length) {
      cues.forEach((cue, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ts-cue-btn';
        btn.textContent = cue.label || `@${formatTime(cue.seconds)}`;
        btn.dataset.index = String(index);
        btn.addEventListener('click', () => {
          playAt(work.id, cue.seconds);
          closeCuePopover();
        });
        state.footer.cueList.appendChild(btn);
      });
    } else {
      const empty = document.createElement('span');
      empty.className = 'ts-cue-empty';
      empty.textContent = 'No cue points';
      state.footer.cueList.appendChild(empty);
    }
  }
  updateFooterPlaybackState();
}

function updateFooterPlaybackState() {
  const work = state.activeWorkId != null ? findWorkById(state.activeWorkId)?.data : null;
  const audio = work ? document.getElementById('wc-a' + work.id) : null;
  const playing = !!audio && !audio.paused && !audio.ended;
  if (state.footer.playBtn && !state.footer.playBtn.disabled) {
    state.footer.playBtn.textContent = playing ? 'Pause Ⅱ' : 'Play ▷';
    state.footer.playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  if (state.footer.live) {
    if (!work) {
      state.footer.live.textContent = 'Controls unavailable.';
    } else if (!normalizeSrc(getAudioSourceFor(work))) {
      state.footer.live.textContent = `${work.title || work.slug || 'Work'} selected. Audio unavailable.`;
    } else if (playing) {
      state.footer.live.textContent = `${work.title || work.slug || 'Work'} playing.`;
    } else {
      state.footer.live.textContent = `${work.title || work.slug || 'Work'} ready.`;
    }
  }
}

function toggleCuePopover() {
  if (state.footer.cuesBtn?.disabled) return;
  if (!state.footer.cueList) return;
  state.cuesOpen = !state.cuesOpen;
  if (state.cuesOpen) {
    state.footer.cueList.removeAttribute('hidden');
  } else {
    state.footer.cueList.setAttribute('hidden', '');
  }
  if (state.footer.cuesBtn) {
    state.footer.cuesBtn.setAttribute('aria-expanded', state.cuesOpen ? 'true' : 'false');
  }
}

function closeCuePopover() {
  state.cuesOpen = false;
  if (state.footer.cueList) state.footer.cueList.setAttribute('hidden', '');
  if (state.footer.cuesBtn) state.footer.cuesBtn.setAttribute('aria-expanded', 'false');
}

function handleFooterClicks() {
  if (state.footer.pdfBtn && !state.footer.pdfBtn.dataset.bound) {
    state.footer.pdfBtn.dataset.bound = '1';
    state.footer.pdfBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.activeWorkId == null) return;
      const work = findWorkById(state.activeWorkId)?.data;
      if (!work) return;
      const url = normalizePdfUrl(work.pdfUrl || work.pdf);
      if (!url) return;
      window.dispatchEvent(new CustomEvent('wc:pdf-open', { detail: { slug: work.slug } }));
      openPdfFor(work.id);
    });
  }
  if (state.footer.playBtn && !state.footer.playBtn.dataset.bound) {
    state.footer.playBtn.dataset.bound = '1';
    state.footer.playBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.activeWorkId == null) return;
      pauseAllExcept(state.activeWorkId);
      const toggled = togglePlayFor(state.activeWorkId);
      if (!toggled) {
        if (state.footer.live) state.footer.live.textContent = 'Audio unavailable for this work.';
      }
    });
  }
  if (state.footer.cuesBtn && !state.footer.cuesBtn.dataset.bound) {
    state.footer.cuesBtn.dataset.bound = '1';
    state.footer.cuesBtn.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.activeWorkId == null) return;
      if (state.footer.cuesBtn.disabled) return;
      toggleCuePopover();
    });
  }
}

function handleDocumentClick(event) {
  if (state.cuesOpen) {
    const controls = state.footer.root;
    if (controls && !controls.contains(event.target)) {
      closeCuePopover();
    }
  }
  const footerRoot = state.footer.root;
  if (state.field && !state.field.contains(event.target) && (!footerRoot || !footerRoot.contains(event.target))) {
    clearSelection({ announce: true });
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeCuePopover();
    clearSelection({ announce: true });
  }
}

function handleResize() {
  queueLayout({ force: true });
}

function showHint() {
  if (state.hintShown || !state.hint) return;
  state.hint.removeAttribute('hidden');
  state.hintShown = true;
  try { sessionStorage.setItem(SESSION_HINT_KEY, '1'); } catch (_) {}
}

function initHint() {
  const hint = document.querySelector('[data-hint]');
  if (!hint) return;
  state.hint = hint;
  const dismiss = hint.querySelector('[data-hint-dismiss]');
  if (dismiss) {
    dismiss.addEventListener('click', (event) => {
      event.preventDefault();
      hint.setAttribute('hidden', '');
    });
  }
  if (!state.hintShown) {
    setTimeout(() => showHint(), 800);
  }
}

function initThemeToggle() {
  const toggle = document.getElementById('wc-theme-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    praeCycleTheme();
    queueLayout({ force: true });
  });
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      praeCycleTheme();
      queueLayout({ force: true });
    }
  });
}

function setupFooter() {
  const root = document.getElementById('ts-footer');
  if (!root) return;
  state.footer.root = root;
  state.footer.copy = root.querySelector('[data-footer-copy]');
  state.footer.badge = root.querySelector('[data-footer-badge]');
  state.footer.title = root.querySelector('[data-footer-title]');
  state.footer.pdfBtn = root.querySelector('[data-role="pdf"]');
  state.footer.playBtn = root.querySelector('[data-role="play"]');
  state.footer.cuesBtn = root.querySelector('[data-role="cues"]');
  state.footer.cueList = root.querySelector('[data-cue-list]');
  state.footer.live = root.querySelector('[data-footer-live]');
  buildPraeBadge();
  handleFooterClicks();
}

function init() {
  document.documentElement.dataset.skin = 'typescatter';
  state.reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.field = document.getElementById('ts-field');
  state.ariaLive = document.querySelector('[data-live]');
  setupFooter();
  applySiteInfo();
  renderWorks();
  state.field?.addEventListener('click', (event) => {
    if (event.target === state.field) {
      clearSelection({ announce: true });
    }
  });
  ensureAudioTags();
  queueLayout({ force: true });
  hydrateFromHash();
  initHint();
  initThemeToggle();
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  window.addEventListener('resize', () => {
    clearTimeout(state.resizeHandle);
    state.resizeHandle = setTimeout(handleResize, 120);
  });
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleDocumentClick);
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  media?.addEventListener('change', (event) => {
    state.reduceMotion = !!event.matches;
    state.items.forEach((item) => {
      const tilt = state.reduceMotion ? 0 : item.rotation;
      const jitter = state.reduceMotion ? 0 : item.letterJitter;
      item.button.style.setProperty('--ts-tilt', `${tilt.toFixed(3)}deg`);
      item.button.style.setProperty('--ts-letter-jitter', `${jitter.toFixed(3)}em`);
    });
    queueLayout({ force: true });
  });
  updateFooterControls();
}

ready(init);

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

window.addEventListener('wc:pdf-goto', (event) => {
  const detail = event?.detail || {};
  ensurePdfDom();
  if (!state.pdf.viewerReady || (detail.slug && detail.slug !== state.pdf.currentSlug)) {
    state.pdf.pendingGoto = detail;
    return;
  }
  if (detail.pdfPage) gotoPdfPage(detail.pdfPage);
});

export { praeApplyTheme, praeCurrentTheme, praeCycleTheme };
