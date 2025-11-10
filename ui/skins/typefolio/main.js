const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function praeNormalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

function praeReadStoredTheme() {
  try {
    let saved = localStorage.getItem(PRAE_THEME_STORAGE_KEY);
    if (!saved) return 'dark';
    if (saved.trim().charAt(0) === '{') {
      const parsed = JSON.parse(saved);
      return praeNormalizeTheme(parsed?.mode);
    }
    return praeNormalizeTheme(saved);
  } catch (_) {
    return 'dark';
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
    btn.textContent = eff === 'dark' ? '🌙' : '☀️';
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
  praeApplyTheme(praeCurrentTheme() === 'dark' ? 'light' : 'dark');
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

const PRAE = (window.PRAE = window.PRAE || {});
const works = Array.isArray(PRAE.works) ? PRAE.works : [];
const pfMap = PRAE.pageFollowMaps || {};

const FONT_STEPS = [0.92, 1, 1.08, 1.18, 1.28];
const MEASURE_STEPS = [56, 60, 66, 72, 80];
const HASH_WORK_KEY = 'work';
const HASH_VIEW_KEY = 'view';
const HASH_TYPE_KEY = 't';
const HASH_CONTRAST_KEY = 'c';

const state = {
  selectedId: works[0]?.id ?? null,
  typeface: 'serif',
  contrast: false,
  sizeIndex: 1,
  measureIndex: 2,
  worksById: new Map(),
  readerEl: null,
  indexEl: null,
  controlsEl: null,
  hudRefs: null,
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  actionButtons: new Map(),
  pdf: {
    pane: null,
    title: null,
    close: null,
    frame: null,
    backdrop: null,
    viewerReady: false,
    currentSlug: null,
    pendingGoto: null,
    restoreFocus: null
  }
};

let hudBox = null;
let pageFollow = { audio: null, slug: null, lastPrinted: null, handler: null };

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function excerpt(text, length = 140) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.length <= length) return trimmed;
  const slice = trimmed.slice(0, length);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
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

function formatTime(sec) {
  const clamped = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(clamped / 60);
  const s = String(clamped % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function findWorkById(id) {
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  if (state.worksById.has(num)) return state.worksById.get(num);
  const data = works.find((item) => Number(item.id) === num);
  if (!data) return null;
  const record = { data, el: null };
  state.worksById.set(num, record);
  return record;
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
  hudBox = root;
  return root;
}

function ensureHudDom() {
  const root = ensureHudRoot();
  if (!root) return null;
  if (root.dataset.hudBound === '1' && state.hudRefs) return state.hudRefs;
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-title" data-part="title"></div>
      <div class="hud-sub" data-part="subtitle"></div>
    </div>
    <div class="hud-meter" data-part="meter"><span></span></div>
    <div class="hud-actions">
      <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play" data-icon="play"></button>
    </div>`;
  const title = root.querySelector('[data-part="title"]');
  const sub = root.querySelector('[data-part="subtitle"]');
  const meter = root.querySelector('[data-part="meter"]');
  const fill = meter?.querySelector('span') || null;
  const btn = root.querySelector('[data-part="toggle"]');
  state.hudRefs = { title, sub, meter, fill, btn, root };
  root.dataset.hudBound = '1';
  return state.hudRefs;
}

function hudSetSubtitle(text) {
  const refs = ensureHudDom();
  if (refs?.sub) refs.sub.textContent = String(text ?? '');
}

function hudSetPlaying(on) {
  const refs = ensureHudDom();
  if (!refs?.btn) return;
  refs.btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  refs.btn.dataset.icon = on ? 'pause' : 'play';
}

function hudSetProgress(ratio) {
  const refs = ensureHudDom();
  if (!refs?.fill) return;
  const pct = Math.max(0, Math.min(1, Number(ratio) || 0));
  refs.fill.style.width = `${pct * 100}%`;
}

function hudEnsure() {
  const refs = ensureHudDom();
  return refs?.root || ensureHudRoot();
}

function hudGetRoot() {
  ensureHudRoot();
  return hudBox;
}

function hudSetTitle(text) {
  const refs = ensureHudDom();
  if (refs?.title) refs.title.textContent = text;
}

function getActiveAudioInfo() {
  for (const work of works) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio && !audio.paused && !audio.ended) {
      return { id: work.id, audio };
    }
  }
  return { id: null, audio: null };
}

function hudUpdate(id, audio) {
  const refs = ensureHudDom();
  if (!refs) return;
  const work = findWorkById(id)?.data;
  const name = work ? work.title : '—';
  const duration = audio && Number.isFinite(audio.duration) ? formatTime(audio.duration | 0) : '--:--';
  const current = audio && Number.isFinite(audio.currentTime) ? formatTime(audio.currentTime | 0) : '0:00';
  const ratio = audio && audio.duration ? Math.max(0, Math.min(1, (audio.currentTime || 0) / Math.max(1, audio.duration))) : 0;
  hudSetTitle(`Now playing — ${name}`);
  hudSetSubtitle(`${current} / ${duration}`);
  hudSetProgress(ratio);
  hudSetPlaying(!!(audio && !audio.paused));
}

function ensureAudioFor(work) {
  if (!work) return null;
  let el = document.getElementById('wc-a' + work.id);
  if (!el) {
    el = document.createElement('audio');
    el.id = 'wc-a' + work.id;
    el.preload = 'none';
    el.playsInline = true;
    if (work.audio) el.setAttribute('data-audio', work.audio);
    document.body.appendChild(el);
  }
  return el;
}

function bindAudio(id) {
  const audio = document.getElementById('wc-a' + id);
  if (!audio || audio.dataset.typefolioBound === '1') return;
  const update = () => {
    hudUpdate(id, audio);
    updatePlayButton(id);
    markPlaying(id, !audio.paused && !audio.ended);
  };
  audio.addEventListener('timeupdate', update, { passive: true });
  audio.addEventListener('ratechange', update, { passive: true });
  audio.addEventListener('volumechange', update, { passive: true });
  audio.addEventListener('loadedmetadata', update, { once: true, passive: true });
  audio.addEventListener('pause', update, { passive: true });
  audio.addEventListener('ended', update, { passive: true });
  audio.dataset.typefolioBound = '1';
}

function detachPageFollow() {
  if (pageFollow.audio && pageFollow.handler) {
    pageFollow.audio.removeEventListener('timeupdate', pageFollow.handler);
    pageFollow.audio.removeEventListener('seeking', pageFollow.handler);
  }
  pageFollow = { audio: null, slug: null, lastPrinted: null, handler: null };
}

function printedPageForTime(cfg, sec) {
  if (!cfg || !Array.isArray(cfg.pageMap)) return null;
  const time = Math.max(0, Number(sec) || 0);
  let current = cfg.pageMap[0]?.page ?? null;
  for (const entry of cfg.pageMap) {
    const t = Number(entry.at || 0);
    if (time >= t) current = entry.page;
    else break;
  }
  return current;
}

function computePdfPage(slug, time) {
  const cfg = pfMap[slug];
  if (!cfg) return 1;
  const printed = printedPageForTime(cfg, time);
  if (printed == null) return cfg.pdfStartPage || 1;
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
}

function attachPageFollow(slug, audio) {
  detachPageFollow();
  if (!slug || !audio) return;
  const cfg = pfMap[slug];
  if (!cfg) return;
  const onTick = () => {
    const printed = printedPageForTime(cfg, audio.currentTime || 0);
    if (printed !== pageFollow.lastPrinted) {
      pageFollow.lastPrinted = printed;
      const pdfPage = computePdfPage(slug, audio.currentTime || 0);
      window.dispatchEvent(new CustomEvent('wc:pdf-goto', {
        detail: { slug, printedPage: printed, pdfPage }
      }));
    }
  };
  pageFollow = { audio, slug, lastPrinted: null, handler: onTick };
  audio.addEventListener('timeupdate', onTick, { passive: true });
  audio.addEventListener('seeking', onTick, { passive: true });
  onTick();
}

function markPlaying(id, on) {
  const record = findWorkById(id);
  if (record?.el) record.el.classList.toggle('is-playing', !!on);
}

function playAt(id, t = 0) {
  const record = findWorkById(id);
  if (!record) return;
  const work = record.data;
  const audio = document.getElementById('wc-a' + id) || ensureAudioFor(work);
  if (!audio) return;
  if (!audio.src) {
    const raw = audio.getAttribute('data-audio') || work.audio || '';
    const src = normalizeSrc(raw);
    if (src) {
      audio.src = src;
      audio.load();
    }
  }
  const seekAndPlay = () => {
    try { audio.currentTime = Math.max(0, Number(t) || 0); } catch (_) {}
    const prom = audio.play();
    if (prom && typeof prom.catch === 'function') {
      prom.catch((err) => {
        if (err && err.name === 'NotAllowedError') flashMessage('Autoplay blocked — press play again.');
      });
    }
    markPlaying(id, true);
    bindAudio(id);
    hudUpdate(id, audio);
    if (work.slug) attachPageFollow(work.slug, audio);
  };
  if (audio.readyState >= 1) seekAndPlay();
  else audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
}

function pauseWork(id) {
  const audio = document.getElementById('wc-a' + id);
  if (!audio) return;
  audio.pause();
}

function togglePlay(work) {
  if (!work || !work.id) return;
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  if (!audio.paused && !audio.ended) {
    state.hudState.last = { id: work.id, at: audio.currentTime || 0 };
    audio.pause();
    hudUpdate(work.id, audio);
  } else {
    playAt(work.id, audio.currentTime || 0);
  }
}

function deepUrl(id) {
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(id));
  params.set(HASH_VIEW_KEY, 'read');
  if (state.typeface === 'sans') params.set(HASH_TYPE_KEY, 'sans');
  if (state.contrast) params.set(HASH_CONTRAST_KEY, 'hc');
  return `${location.origin}${location.pathname}#${params.toString()}`;
}

function openPdfFor(id) {
  const record = findWorkById(id);
  if (!record) return;
  const work = record.data;
  if (!work.pdf) return;
  const raw = normalizePdfUrl(work.pdf);
  const viewerUrl = choosePdfViewer(raw);
  const pane = state.pdf.pane;
  const frame = state.pdf.frame;
  const backdrop = state.pdf.backdrop;
  const title = state.pdf.title;
  if (!pane || !frame) {
    window.open(viewerUrl, '_blank', 'noopener');
    return;
  }
  state.pdf.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.pdf.currentSlug = work.slug || null;
  let initPage = 1;
  try {
    if (pageFollow.slug && pageFollow.slug === state.pdf.currentSlug) {
      initPage = computePdfPage(pageFollow.slug, pageFollow.audio?.currentTime || 0);
    } else if (work.slug && pfMap[work.slug]) {
      initPage = computePdfPage(work.slug, 0);
    }
  } catch (_) {}
  if (title) title.textContent = String(work.title || 'Score');
  pane.setAttribute('aria-hidden', 'false');
  pane.removeAttribute('hidden');
  frame.src = 'about:blank';
  document.body.classList.add('tf-pdf-open');
  backdrop?.removeAttribute('hidden');
  requestAnimationFrame(() => {
    state.pdf.viewerReady = false;
    const base = viewerUrl.split('#')[0];
    frame.src = `${base}#page=${Math.max(1, initPage)}&zoom=page-width&toolbar=0&sidebar=0`;
    state.pdf.close?.focus({ preventScroll: true });
  });
}

function hidePdfPane() {
  state.pdf.pane?.setAttribute('aria-hidden', 'true');
  state.pdf.pane?.setAttribute('hidden', '');
  state.pdf.frame?.setAttribute('src', 'about:blank');
  state.pdf.backdrop?.setAttribute('hidden', '');
  document.body.classList.remove('tf-pdf-open');
  state.pdf.viewerReady = false;
  state.pdf.currentSlug = null;
  const restore = state.pdf.restoreFocus;
  state.pdf.restoreFocus = null;
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus({ preventScroll: true }));
  }
}

function flashMessage(message) {
  const live = document.getElementById('tf-live') || (() => {
    const el = document.createElement('div');
    el.id = 'tf-live';
    el.className = 'sr-only';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  })();
  live.textContent = String(message || '');
}

function flashButton(btn, text, revert) {
  if (!btn) return;
  const original = revert ?? btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1600);
}

function copyUrl(id, btn) {
  const url = deepUrl(id);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      flashButton(btn, 'Copied', 'Copy URL');
      flashMessage('Copied work URL to clipboard.');
    }).catch(() => {
      flashButton(btn, url, 'Copy URL');
    });
  } else {
    flashButton(btn, url, 'Copy URL');
  }
}

function parseHash() {
  const raw = String(location.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const workId = Number(params.get(HASH_WORK_KEY) || '0') || null;
  const view = params.get(HASH_VIEW_KEY) || '';
  const type = params.get(HASH_TYPE_KEY) || '';
  const contrast = params.get(HASH_CONTRAST_KEY) || '';
  return { workId, view, type, contrast };
}

function syncHash() {
  if (!state.selectedId) return;
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(state.selectedId));
  params.set(HASH_VIEW_KEY, 'read');
  if (state.typeface === 'sans') params.set(HASH_TYPE_KEY, 'sans');
  if (state.contrast) params.set(HASH_CONTRAST_KEY, 'hc');
  const next = `#${params.toString()}`;
  const target = `${location.pathname}${location.search}${next}`;
  if (location.hash !== next) history.replaceState(null, '', target);
}

function hydrateFromHash() {
  const { workId, type, contrast } = parseHash();
  state.typeface = type === 'sans' ? 'sans' : 'serif';
  state.contrast = contrast === 'hc';
  if (workId && findWorkById(workId)) {
    selectWork(workId, { skipHash: true, focusIndex: false });
  } else if (works[0]) {
    selectWork(works[0].id, { skipHash: true, focusIndex: false });
  } else {
    state.selectedId = null;
    renderReader(null);
  }
  updateReaderTokens();
  updateControlsState();
  focusIndex();
}

function selectWork(id, opts = {}) {
  const record = findWorkById(id);
  if (!record) return;
  state.selectedId = record.data.id;
  state.hudState.last.id = record.data.id;
  updateIndexSelection(record.data.id);
  renderReader(record.data);
  if (!opts.skipHash) syncHash();
  if (opts.focusReader) focusReader();
}

function updateIndexSelection(id) {
  const buttons = state.indexEl?.querySelectorAll('.tf-index-item');
  if (!buttons) return;
  buttons.forEach((btn) => {
    const isActive = Number(btn.dataset.id) === Number(id);
    btn.setAttribute('aria-current', String(isActive));
    btn.classList.toggle('is-active', isActive);
  });
}

function renderIndex() {
  const host = state.indexEl;
  if (!host) return;
  host.innerHTML = '';
  if (!works.length) {
    const empty = document.createElement('p');
    empty.className = 'tf-index-empty';
    empty.textContent = 'No works yet. Run “prae add” to begin your catalogue.';
    host.appendChild(empty);
    return;
  }
  const list = document.createElement('ol');
  list.className = 'tf-index-list';
  works.forEach((work) => {
    const item = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-index-item';
    btn.dataset.id = String(work.id);
    const slug = work.slug ? work.slug : '—';
    const summary = excerpt(work.one || '');
    const detail = summary ? `${slug} — ${summary}` : slug;
    btn.innerHTML = `<strong>${esc(work.title || 'Untitled work')}</strong><span>${esc(detail)}</span>`;
    btn.addEventListener('click', () => selectWork(work.id, { focusReader: true }));
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectWork(work.id, { focusReader: true });
      }
    });
    item.appendChild(btn);
    list.appendChild(item);
    const record = findWorkById(work.id);
    if (record) record.el = btn;
    if (work.audio) ensureAudioFor(work);
  });
  host.appendChild(list);
  updateIndexSelection(state.selectedId);
}

function buildBodyParagraphs(work) {
  const body = document.createElement('div');
  body.className = 'tf-body';
  const notes = Array.isArray(work.openNote)
    ? work.openNote
    : work.openNote
    ? [work.openNote]
    : Array.isArray(work.description)
    ? work.description
    : work.description
    ? [work.description]
    : [];
  notes.forEach((entry) => {
    if (!entry) return;
    const p = document.createElement('p');
    p.textContent = String(entry);
    body.appendChild(p);
  });
  return body;
}

function renderReader(work) {
  const host = state.readerEl;
  if (!host) return;
  host.innerHTML = '';
  state.actionButtons.clear();
  if (!work) {
    host.dataset.state = 'empty';
    return;
  }
  host.dataset.state = 'ready';
  const article = document.createElement('article');
  const slug = document.createElement('p');
  slug.className = 'tf-slug';
  slug.textContent = work.slug || '';
  if (slug.textContent) article.appendChild(slug);
  const heading = document.createElement('h1');
  heading.textContent = work.title || 'Untitled work';
  heading.tabIndex = -1;
  const lede = document.createElement('p');
  lede.className = 'tf-lede';
  lede.textContent = work.one || '';
  article.append(heading, lede);
  const cues = Array.isArray(work.cues) ? work.cues : [];
  if (cues.length) {
    const cueWrap = document.createElement('div');
    cueWrap.className = 'tf-cues';
    cues.forEach((cue) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tf-cue';
      btn.dataset.id = String(work.id);
      btn.dataset.t = String(Number(cue.t) || 0);
      const label = cue.label && /^@?\d+:\d{2}$/.test(cue.label)
        ? cue.label.replace(/^@?/, '@')
        : `@${formatTime(Number(cue.t) || 0)}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        selectWork(work.id, { skipHash: false });
        playAt(work.id, Number(cue.t) || 0);
      });
      cueWrap.appendChild(btn);
    });
    article.appendChild(cueWrap);
  }
  const body = buildBodyParagraphs(work);
  if (body.childElementCount) article.appendChild(body);
  const actions = document.createElement('div');
  actions.className = 'tf-actions';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'tf-action';
  playBtn.dataset.action = 'play';
  if (!work.audio) {
    playBtn.textContent = 'Play unavailable';
    playBtn.setAttribute('aria-disabled', 'true');
    playBtn.disabled = true;
  } else {
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => togglePlay(work));
  }

  const pdfBtn = document.createElement('button');
  pdfBtn.type = 'button';
  pdfBtn.className = 'tf-action';
  pdfBtn.dataset.action = 'pdf';
  if (!work.pdf) {
    pdfBtn.textContent = 'Score unavailable';
    pdfBtn.setAttribute('aria-disabled', 'true');
    pdfBtn.disabled = true;
  } else {
    pdfBtn.textContent = 'Open Score';
    pdfBtn.addEventListener('click', () => openPdfFor(work.id));
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'tf-action';
  copyBtn.dataset.action = 'copy';
  copyBtn.textContent = 'Copy URL';
  copyBtn.addEventListener('click', () => copyUrl(work.id, copyBtn));

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'tf-action';
  openBtn.dataset.action = 'open';
  openBtn.textContent = 'Open';
  openBtn.addEventListener('click', () => focusReader());

  actions.append(playBtn, pdfBtn, copyBtn, openBtn);
  article.appendChild(actions);
  host.appendChild(article);
  state.actionButtons.set(work.id, { playBtn, pdfBtn, copyBtn, openBtn, heading });
  updatePlayButton(work.id);
  updateReaderTokens();
}

function updatePlayButton(id) {
  const record = state.actionButtons.get(id);
  if (!record?.playBtn) return;
  if (record.playBtn.hasAttribute('aria-disabled')) return;
  const audio = document.getElementById('wc-a' + id);
  if (!audio || audio.paused || audio.ended) {
    record.playBtn.textContent = 'Play';
  } else {
    record.playBtn.textContent = 'Pause';
  }
}

function renderControls() {
  const host = state.controlsEl;
  if (!host) return;
  host.innerHTML = '';
  host.setAttribute('role', 'toolbar');
  const controls = [
    { id: 'face', label: 'Serif / Sans', action: 'typeface', toggle: true },
    { id: 'size-dec', label: 'A−', action: 'size-dec' },
    { id: 'size-inc', label: 'A+', action: 'size-inc' },
    { id: 'measure-dec', label: 'Measure −', action: 'measure-dec' },
    { id: 'measure-inc', label: 'Measure +', action: 'measure-inc' },
    { id: 'contrast', label: 'Contrast', action: 'contrast', toggle: true },
    { id: 'print', label: 'Print', action: 'print' }
  ];
  controls.forEach((meta) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-control';
    btn.dataset.action = meta.action;
    btn.textContent = meta.label;
    if (meta.toggle) {
      btn.setAttribute('aria-pressed', 'false');
    }
    btn.setAttribute('title', shortcutHint(meta.action));
    host.appendChild(btn);
  });
  host.addEventListener('click', (event) => {
    const btn = event.target.closest('button.tf-control');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'typeface') toggleTypeface();
    if (act === 'size-dec') adjustFont(-1);
    if (act === 'size-inc') adjustFont(1);
    if (act === 'measure-dec') adjustMeasure(-1);
    if (act === 'measure-inc') adjustMeasure(1);
    if (act === 'contrast') toggleContrast();
    if (act === 'print') window.print();
    updateControlsState();
    syncHash();
  });
  updateControlsState();
}

function shortcutHint(action) {
  switch (action) {
    case 'typeface': return 'Toggle serif/sans (S)';
    case 'size-dec': return 'Decrease size ([)';
    case 'size-inc': return 'Increase size (])';
    case 'measure-dec': return 'Tighter measure (,)';
    case 'measure-inc': return 'Wider measure (.)';
    case 'contrast': return 'Toggle high contrast (C)';
    case 'print': return 'Print reader';
    default: return '';
  }
}

function updateControlsState() {
  const controls = state.controlsEl?.querySelectorAll('.tf-control') || [];
  controls.forEach((btn) => {
    const act = btn.dataset.action;
    if (act === 'typeface') {
      btn.setAttribute('aria-pressed', String(state.typeface === 'sans'));
    }
    if (act === 'contrast') {
      btn.setAttribute('aria-pressed', String(state.contrast));
    }
    if (act === 'size-dec') {
      btn.disabled = state.sizeIndex <= 0;
    }
    if (act === 'size-inc') {
      btn.disabled = state.sizeIndex >= FONT_STEPS.length - 1;
    }
    if (act === 'measure-dec') {
      btn.disabled = state.measureIndex <= 0;
    }
    if (act === 'measure-inc') {
      btn.disabled = state.measureIndex >= MEASURE_STEPS.length - 1;
    }
  });
}

function updateReaderTokens() {
  const host = state.readerEl;
  if (!host) return;
  const scale = FONT_STEPS[state.sizeIndex] || 1;
  const measure = MEASURE_STEPS[state.measureIndex] || 66;
  host.style.setProperty('--tf-scale', String(scale));
  host.style.setProperty('--tf-measure', `${measure}ch`);
  if (state.typeface === 'sans') host.setAttribute('data-face', 'sans');
  else host.removeAttribute('data-face');
  if (state.contrast) host.setAttribute('data-contrast', 'high');
  else host.removeAttribute('data-contrast');
}

function toggleTypeface() {
  state.typeface = state.typeface === 'serif' ? 'sans' : 'serif';
  updateReaderTokens();
}

function toggleContrast() {
  state.contrast = !state.contrast;
  updateReaderTokens();
}

function adjustFont(delta) {
  const next = Math.min(FONT_STEPS.length - 1, Math.max(0, state.sizeIndex + delta));
  state.sizeIndex = next;
  updateReaderTokens();
}

function adjustMeasure(delta) {
  const next = Math.min(MEASURE_STEPS.length - 1, Math.max(0, state.measureIndex + delta));
  state.measureIndex = next;
  updateReaderTokens();
}

function focusReader() {
  const record = state.actionButtons.get(state.selectedId);
  if (!record?.heading) return;
  const prefersReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  record.heading.focus({ preventScroll: false });
  record.heading.scrollIntoView({ behavior: prefersReduce ? 'auto' : 'smooth', block: 'start' });
}

function focusIndex() {
  const active = state.indexEl?.querySelector('.tf-index-item[aria-current="true"]');
  if (active) active.focus({ preventScroll: false });
}

function applySiteChrome(site = {}) {
  const nameEl = document.querySelector('[data-site-title]');
  const subEl = document.querySelector('[data-site-subtitle]');
  const navEl = document.getElementById('prae-nav');
  const footer = document.getElementById('prae-footer');
  const fullName = site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ');
  if (nameEl && fullName) nameEl.textContent = fullName;
  if (subEl) subEl.textContent = site.subtitle || 'Selected works';
  if (navEl) {
    if (Array.isArray(site.links)) {
      navEl.innerHTML = site.links
        .filter((link) => link && link.label)
        .map((link) => {
          const href = link.href || '#';
          const target = link.external ? ' target="_blank" rel="noopener"' : '';
          return `<a href="${esc(href)}"${target}>${esc(link.label)}</a>`;
        }).join('');
    } else {
      navEl.innerHTML = '';
    }
  }
  if (footer) {
    const year = new Date().getFullYear();
    const holder = site.copyrightName || fullName || '—';
    const updated = site.updated && site.updated.mode === 'manual' ? site.updated.value : '';
    const links = Array.isArray(site.links) ? site.links : [];
    footer.innerHTML = `
      <span>© ${esc(holder)} ${year}</span>
      <span>${updated ? `Updated ${esc(updated)}` : ''}</span>
      <span>
        ${links.map((link) => `<a href="${esc(link.href || '#')}"${link.external ? ' target="_blank" rel="noopener"' : ''}>${esc(link.label || '')}</a>`).join(' ')}
      </span>`;
  }
}

function bindThemeToggle() {
  const btn = document.getElementById('wc-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => window.praeCycleTheme?.());
  btn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.praeCycleTheme?.();
    }
  });
}

function bindHudToggle() {
  const root = hudEnsure();
  root?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-hud="toggle"]');
    if (!btn) return;
    const { id, audio } = getActiveAudioInfo();
    if (audio && !audio.paused) {
      state.hudState.last = { id, at: audio.currentTime || 0 };
      audio.pause();
      hudUpdate(id, audio);
      return;
    }
    const resumeId = state.hudState.last.id || works[0]?.id;
    if (resumeId) playAt(resumeId, state.hudState.last.at || 0);
  });
}

function bindPdfEvents() {
  state.pdf.close?.addEventListener('click', hidePdfPane);
  state.pdf.backdrop?.addEventListener('click', hidePdfPane);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.pdf.pane && state.pdf.pane.getAttribute('aria-hidden') === 'false') {
        hidePdfPane();
      } else if (document.activeElement && state.readerEl?.contains(document.activeElement)) {
        focusIndex();
      }
    }
  }, { passive: true });
  state.pdf.frame?.addEventListener('load', () => {
    state.pdf.viewerReady = true;
    const pending = state.pdf.pendingGoto;
    if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
      gotoPdfPage(pending.pdfPage);
      state.pdf.pendingGoto = null;
    }
  });
  window.addEventListener('wc:pdf-goto', (event) => {
    const detail = event?.detail || {};
    if (!state.pdf.viewerReady || (detail.slug && detail.slug !== state.pdf.currentSlug)) {
      state.pdf.pendingGoto = detail;
      return;
    }
    gotoPdfPage(detail.pdfPage);
  });
}

function gotoPdfPage(pageNum) {
  const frame = state.pdf.frame;
  if (!frame || !frame.contentWindow) return;
  try {
    const url = new URL(frame.src, location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const current = Number(hash.get('page') || '1');
    const next = Number(pageNum || 1);
    if (current === next) return;
    hash.set('page', String(next));
    if (!hash.has('zoom')) hash.set('zoom', 'page-width');
    if (!hash.has('sidebar')) hash.set('sidebar', '0');
    url.hash = `#${hash.toString()}`;
    frame.src = url.toString();
  } catch (_) {}
}

function bindGlobalKeys() {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === '[') {
      event.preventDefault();
      adjustFont(-1);
      updateControlsState();
      syncHash();
    }
    if (event.key === ']') {
      event.preventDefault();
      adjustFont(1);
      updateControlsState();
      syncHash();
    }
    if (event.key === ',') {
      event.preventDefault();
      adjustMeasure(-1);
      updateControlsState();
      syncHash();
    }
    if (event.key === '.') {
      event.preventDefault();
      adjustMeasure(1);
      updateControlsState();
      syncHash();
    }
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      toggleTypeface();
      updateControlsState();
      syncHash();
    }
    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      toggleContrast();
      updateControlsState();
      syncHash();
    }
  });
}

function bindHashChange() {
  window.addEventListener('hashchange', () => hydrateFromHash());
}

ready(() => {
  document.documentElement.dataset.skin = 'typefolio';
  window.praeApplyTheme?.(window.praeCurrentTheme?.() ?? 'dark', { persist: false });
  bindThemeToggle();
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
  ensureHudRoot();
  const site = (PRAE.config && PRAE.config.site) || {};
  applySiteChrome(site);
  PRAE.worksById = works.reduce((acc, work) => {
    if (work && work.id != null) acc[work.id] = work;
    return acc;
  }, {});
  state.readerEl = document.getElementById('tf-reader');
  state.indexEl = document.getElementById('tf-index');
  state.controlsEl = document.getElementById('tf-controls');
  state.pdf.pane = document.querySelector('.tf-pdfpane');
  state.pdf.title = document.querySelector('.tf-pdf-title');
  state.pdf.close = document.querySelector('.tf-pdf-close');
  state.pdf.frame = document.querySelector('.tf-pdf-frame');
  state.pdf.backdrop = document.querySelector('.tf-backdrop');
  if (state.pdf.pane) state.pdf.pane.setAttribute('hidden', '');
  PRAE.hud = Object.assign({}, PRAE.hud || {}, {
    ensure: hudEnsure,
    setSubtitle: hudSetSubtitle,
    setPlaying: hudSetPlaying,
    setProgress: hudSetProgress,
    getRoot: hudGetRoot
  });
  PRAE.hud.ensure();
  bindHudToggle();
  renderIndex();
  renderControls();
  bindPdfEvents();
  bindGlobalKeys();
  bindHashChange();
  hydrateFromHash();
});
