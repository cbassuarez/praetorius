const TAB_KEYS = ['details', 'cues', 'playback', 'score'];
const HASH_WORK_KEY = 'work';
const HASH_TAB_KEY = 'tab';
const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

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
  const next = praeCurrentTheme() === 'dark' ? 'light' : 'dark';
  praeApplyTheme(next);
}

if (typeof window.praeApplyTheme !== 'function') {
  window.praeApplyTheme = praeApplyTheme;
}
if (typeof window.praeCurrentTheme !== 'function') {
  window.praeCurrentTheme = praeCurrentTheme;
}
if (typeof window.praeCycleTheme !== 'function') {
  window.praeCycleTheme = praeCycleTheme;
}

const PRAE = (window.PRAE = window.PRAE || {});
const PRAE_DATA = window.__PRAE_DATA__ || {};
const works = Array.isArray(PRAE_DATA.works)
  ? PRAE_DATA.works
  : (Array.isArray(PRAE.works) ? PRAE.works : []);

const pfMap = PRAE_DATA.pageFollowMaps || PRAE.pageFollowMaps || {};

let selectedId = works[0]?.id ?? null;
let activeTab = 'details';
const hudState = { last: { id: selectedId, at: 0 } };

const state = {
  worksById: new Map(),
  audioDurations: new Map(),
  playbackContext: new Map(),
  durationTotal: 0,
  tablist: null,
  tabIndicator: null,
  hud: null,
  pdf: {
    shell: null,
    pane: null,
    title: null,
    close: null,
    frame: null,
    currentSlug: null,
    viewerReady: false,
    pendingGoto: null,
    backdrop: null,
    focusHandler: null,
    restoreFocus: null,
  },
  pageFollow: { audio: null, slug: null, lastPrinted: null, on: null }
};

function ensureHudRoot() {
  const HUD_ID = 'wc-hud';
  let root = document.getElementById(HUD_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = HUD_ID;
    root.className = 'wc-hud';
    document.body.prepend(root);
  } else {
    root.id = HUD_ID;
    root.classList.add('wc-hud');
  }
  root.setAttribute('data-component', 'prae-hud');
  return root;
}

function ensureHudDom() {
  const root = ensureHudRoot();
  if (root.dataset.hudBound === '1' && state.hud) return state.hud;
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-title" data-part="title"></div>
      <div class="hud-sub" data-part="subtitle"></div>
    </div>
    <div class="hud-meter" data-part="meter"><span></span></div>
    <div class="hud-actions">
      <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play" data-icon="play"></button>
    </div>`;
  const refs = {
    root,
    title: root.querySelector('[data-part="title"]'),
    sub: root.querySelector('[data-part="subtitle"]'),
    meter: root.querySelector('[data-part="meter"]'),
    fill: root.querySelector('[data-part="meter"] span'),
    btn: root.querySelector('[data-part="toggle"]')
  };
  state.hud = refs;
  root.dataset.hudBound = '1';
  return refs;
}

function hudSetSubtitle(text) {
  const refs = ensureHudDom();
  if (refs?.sub) refs.sub.textContent = String(text ?? '');
}

function hudSetTitle(text) {
  const refs = ensureHudDom();
  if (refs?.title) refs.title.textContent = String(text ?? '');
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

function injectHudCssOnce() {
  if (document.getElementById('prae-hud-css')) return;
  const css = `
    #wc-hud{display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;border:1px solid var(--line,#2a2a2a);border-radius:12px;background:var(--panel,rgba(255,255,255,.03));margin:0 0 12px}
    #wc-hud .hud-left{display:flex;flex-direction:column;gap:.25rem;min-width:0}
    #wc-hud .hud-title{font-weight:600;font-size:0.95rem}
    #wc-hud .hud-sub{font-size:0.8rem;opacity:.8}
    #wc-hud .hud-meter{flex:1;height:4px;background:var(--line,#2a2a2a);border-radius:999px;overflow:hidden}
    #wc-hud .hud-meter>span{display:block;height:100%;background:var(--fg,#fff);transition:width .12s ease-out}
    #wc-hud .hud-actions .hud-btn{min-width:44px;min-height:44px;border:0;border-radius:999px;background:rgba(255,255,255,0.08);color:inherit;cursor:pointer}
  `;
  const s = document.createElement('style');
  s.id = 'prae-hud-css';
  s.textContent = css;
  document.head.appendChild(s);
}

function formatTime(sec) {
  const clamped = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(clamped / 60);
  const s = (clamped % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function labelForCue(t, label) {
  if (label && /^@?\d+:\d{2}$/.test(label)) return label.replace(/^@?/, '@');
  return `@${formatTime(t)}`;
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

function ensureAudioFor(work) {
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

function findWorkById(id) {
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  if (state.worksById.has(num)) return state.worksById.get(num);
  const data = works.find((item) => Number(item.id) === num) || null;
  if (!data) return null;
  const record = { data, el: document.querySelector(`[data-work-id="${data.id}"]`) };
  state.worksById.set(num, record);
  return record;
}

function deepUrl(id) {
  const w = findWorkById(id)?.data;
  if (!w) return location.href;
  const base = `${location.origin}${location.pathname}`;
  return `${base}#${HASH_WORK_KEY}=${encodeURIComponent(w.id)}&${HASH_TAB_KEY}=${encodeURIComponent(activeTab)}`;
}

function markPlaying(id, on) {
  const record = findWorkById(id);
  if (!record) return;
  record.el?.classList.toggle('playing', !!on);
  const audio = document.getElementById('wc-a' + id);
  if (!audio) return;
  const off = () => {
    record.el?.classList.remove('playing');
    audio.removeEventListener('pause', off);
    audio.removeEventListener('ended', off);
  };
  audio.addEventListener('pause', off, { once: true });
  audio.addEventListener('ended', off, { once: true });
}

function flash(element, text) {
  if (!element) return;
  try {
    const span = document.createElement('span');
    span.className = 'ct-flash';
    span.textContent = text;
    element.appendChild(span);
    requestAnimationFrame(() => span.classList.add('is-visible'));
    setTimeout(() => span.classList.remove('is-visible'), 1400);
    setTimeout(() => span.remove(), 1700);
  } catch (_) {}
}

function computePdfPage(slug, tSec) {
  const cfg = pfMap[slug];
  if (!cfg) return 1;
  const printed = printedPageForTime(cfg, tSec || 0);
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
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

function cueTime(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  if (/^\d+$/.test(String(value))) return parseInt(value, 10);
  const match = String(value).match(/^(\d+):([0-5]?\d)$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function gotoPdfPage(pageNum) {
  const frame = state.pdf.frame;
  if (!frame || !frame.src) return;
  if (!/\/viewer\.html/i.test(frame.src)) return;
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
}

function detachPageFollow() {
  if (state.pageFollow.audio && state.pageFollow.on) {
    state.pageFollow.audio.removeEventListener('timeupdate', state.pageFollow.on);
    state.pageFollow.audio.removeEventListener('seeking', state.pageFollow.on);
  }
  state.pageFollow = { audio: null, slug: null, lastPrinted: null, on: null };
}

function attachPageFollow(slug, audio) {
  detachPageFollow();
  if (!slug || !audio) return;
  const cfg = pfMap[slug];
  if (!cfg) return;
  const onTick = () => {
    const printed = printedPageForTime(cfg, audio.currentTime || 0);
    if (printed !== state.pageFollow.lastPrinted) {
      state.pageFollow.lastPrinted = printed;
      const pdfPage = computePdfPage(slug, audio.currentTime || 0);
      window.dispatchEvent(new CustomEvent('wc:pdf-goto', {
        detail: { slug, printedPage: printed, pdfPage }
      }));
    }
  };
  state.pageFollow = { audio, slug, lastPrinted: null, on: onTick };
  audio.addEventListener('timeupdate', onTick, { passive: true });
  audio.addEventListener('seeking', onTick, { passive: true });
  onTick();
}

function playAt(id, t = 0) {
  const meta = findWorkById(id);
  if (!meta) return;
  const work = meta.data;
  if (selectedId !== work.id) {
    selectWork(work.id);
  }
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  hudState.last = { id: work.id, at: t || 0 };
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
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        if (err && err.name === 'NotAllowedError') flash(meta.el, 'Tap to enable audio');
      });
    }
    markPlaying(work.id, true);
    bindAudio(work.id);
    requestAnimationFrame(() => hudUpdate(work.id, audio));
    if (work.slug) attachPageFollow(work.slug, audio);
  };
  if (audio.readyState >= 1) {
    seekAndPlay();
  } else {
    audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
  }
}

function openPdfFor(id) {
  const meta = findWorkById(id);
  if (!meta) return;
  const work = meta.data;
  if (!work.pdf) return;
  const raw = normalizePdfUrl(work.pdf);
  const viewerUrl = choosePdfViewer(raw);
  const shell = state.pdf.shell;
  const pane = state.pdf.pane;
  const title = state.pdf.title;
  const frame = state.pdf.frame;
  if (!shell || !pane || !frame) {
    window.open(viewerUrl, '_blank', 'noopener');
    return;
  }
  state.pdf.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.pdf.currentSlug = work.slug || null;
  let initPage = 1;
  try {
    if (state.pageFollow.slug && state.pageFollow.slug === state.pdf.currentSlug) {
      initPage = computePdfPage(state.pdf.currentSlug, state.pageFollow.audio?.currentTime || 0);
    } else if (pfMap[state.pdf.currentSlug]) {
      initPage = computePdfPage(state.pdf.currentSlug, 0);
    }
  } catch (_) {}
  if (title) title.textContent = String(work.title || 'Score');
  shell?.classList.add('has-pdf');
  pane.setAttribute('aria-hidden', 'false');
  state.pdf.backdrop?.removeAttribute('hidden');
  document.documentElement.classList.add('ct-scroll-lock');
  frame.src = 'about:blank';
  requestAnimationFrame(() => {
    state.pdf.viewerReady = false;
    frame.src = `${viewerUrl.split('#')[0]}#page=${Math.max(1, initPage)}&zoom=page-width&toolbar=0&sidebar=0`;
    state.pdf.close?.focus({ preventScroll: true });
  });
}

function hidePdfPane() {
  const { shell, pane, frame } = state.pdf;
  shell?.classList.remove('has-pdf');
  pane?.setAttribute('aria-hidden', 'true');
  state.pdf.backdrop?.setAttribute('hidden', '');
  document.documentElement.classList.remove('ct-scroll-lock');
  if (frame) frame.src = 'about:blank';
  state.pdf.currentSlug = null;
  state.pdf.viewerReady = false;
  const restore = state.pdf.restoreFocus;
  state.pdf.restoreFocus = null;
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus());
  }
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

function bindAudio(id) {
  const audio = document.getElementById('wc-a' + id);
  if (!audio || audio.dataset.hudBound === '1') return;
  audio.addEventListener('timeupdate', () => hudUpdate(id, audio), { passive: true });
  audio.addEventListener('ratechange', () => hudUpdate(id, audio), { passive: true });
  audio.addEventListener('volumechange', () => hudUpdate(id, audio), { passive: true });
  audio.addEventListener('loadedmetadata', () => {
    hudUpdate(id, audio);
    if (Number.isFinite(audio.duration)) {
      state.audioDurations.set(id, audio.duration);
      recomputeDurationTotal();
    }
  }, { once: true, passive: true });
  audio.addEventListener('ended', () => hudUpdate(id, audio), { passive: true });
  audio.dataset.hudBound = '1';
}

function bindPlaybackListeners(id) {
  const audio = document.getElementById('wc-a' + id);
  if (!audio) return;
  if (audio.dataset.cardsTabsPlayback === '1') return;
  const handler = () => updatePlaybackContext(id);
  audio.addEventListener('timeupdate', handler, { passive: true });
  audio.addEventListener('play', handler, { passive: true });
  audio.addEventListener('pause', handler, { passive: true });
  audio.addEventListener('ended', handler, { passive: true });
  audio.addEventListener('loadedmetadata', handler, { passive: true });
  audio.dataset.cardsTabsPlayback = '1';
}

function updatePlaybackContext(id) {
  const ctx = state.playbackContext.get(id);
  if (!ctx) return;
  const audio = document.getElementById('wc-a' + id);
  if (!audio) return;
  const isPlaying = !audio.paused && !audio.ended;
  if (ctx.status) {
    const current = formatTime(Math.floor(audio.currentTime || 0));
    const total = audio.duration ? formatTime(Math.floor(audio.duration)) : '--:--';
    ctx.status.textContent = `${isPlaying ? 'Playing' : 'Paused'} · ${current} / ${total}`;
  }
  if (ctx.playBtn) {
    const work = findWorkById(id)?.data;
    const label = isPlaying ? 'Pause' : 'Play';
    const titleSuffix = work?.title ? ` ${work.title}` : '';
    ctx.playBtn.dataset.icon = isPlaying ? 'pause' : 'play';
    ctx.playBtn.setAttribute('aria-label', `${label}${titleSuffix}`.trim());
    if (ctx.sr) ctx.sr.textContent = `${label}${titleSuffix}`.trim();
    if (ctx.text) ctx.text.textContent = label;
  }
}

function recomputeDurationTotal() {
  let total = 0;
  for (const value of state.audioDurations.values()) {
    if (Number.isFinite(value)) total += value;
  }
  state.durationTotal = total;
  updateSummaryDuration();
}

function updateSummaryDuration() {
  const container = document.getElementById('ct-summary');
  if (!container) return;
  const cardEl = container.querySelector('[data-summary="duration"]');
  const strong = cardEl?.querySelector('strong');
  if (!state.durationTotal || state.durationTotal <= 0) {
    cardEl?.remove();
    return;
  }
  if (!strong) {
    const article = document.createElement('article');
    article.className = 'ct-summary-card';
    article.dataset.summary = 'duration';
    const heading = document.createElement('h3');
    heading.textContent = 'Known Duration';
    const value = document.createElement('strong');
    value.textContent = formatTime(Math.floor(state.durationTotal));
    article.append(heading, value);
    container.appendChild(article);
    return;
  }
  strong.textContent = formatTime(Math.floor(state.durationTotal));
}

function parseHash() {
  const hash = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const id = params.get(HASH_WORK_KEY);
  const tab = params.get(HASH_TAB_KEY);
  const parsed = { id: null, tab: null };
  if (id && !Number.isNaN(Number(id))) parsed.id = Number(id);
  if (tab && TAB_KEYS.includes(tab)) parsed.tab = tab;
  return parsed;
}

function syncHash() {
  if (!selectedId) return;
  const params = new URLSearchParams();
  params.set(HASH_WORK_KEY, String(selectedId));
  params.set(HASH_TAB_KEY, activeTab);
  const next = `#${params.toString()}`;
  if (location.hash !== next) {
    history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }
}

function updateTabIndicator() {
  if (!state.tablist) {
    state.tablist = document.querySelector('.ct-tablist');
  }
  const list = state.tablist;
  if (!list) return;
  if (!state.tabIndicator) {
    state.tabIndicator = list.querySelector('.ct-tab-indicator');
  }
  const indicator = state.tabIndicator;
  const activeBtn = list.querySelector(`[data-tab="${activeTab}"]`);
  if (!indicator || !activeBtn) {
    list.dataset.active = '';
    return;
  }
  const width = activeBtn.getBoundingClientRect().width;
  const offset = activeBtn.offsetLeft - list.scrollLeft;
  indicator.style.width = `${width}px`;
  indicator.style.transform = `translateX(${Math.max(0, offset)}px)`;
  list.dataset.active = 'true';
}

function setActiveTab(key, opts = {}) {
  if (!TAB_KEYS.includes(key)) return;
  activeTab = key;
  const tabButtons = document.querySelectorAll('#ct-tabs [role="tab"]');
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === key;
    btn.setAttribute('aria-selected', String(isActive));
    btn.tabIndex = isActive ? 0 : -1;
  });
  const panels = document.querySelectorAll('#ct-tabs [role="tabpanel"]');
  panels.forEach((panel) => {
    const controls = panel.getAttribute('aria-labelledby');
    const btn = controls ? document.getElementById(controls) : null;
    const isActive = btn?.dataset.tab === key;
    panel.toggleAttribute('hidden', !isActive);
    panel.tabIndex = isActive ? 0 : -1;
  });
  if (!opts.skipHash) syncHash();
  renderPanels();
  requestAnimationFrame(() => {
    updateTabIndicator();
    focusActivePanelHeading();
  });
}

function selectWork(id, opts = {}) {
  if (!id || Number.isNaN(Number(id))) return;
  const record = findWorkById(id);
  if (!record) return;
  selectedId = record.data.id;
  document.querySelectorAll('.work').forEach((item) => {
    item.classList.toggle('is-selected', Number(item.dataset.workId) === selectedId);
  });
  if (!opts.skipHash) syncHash();
  renderPanels();
}

function renderPanels() {
  const work = selectedId ? findWorkById(selectedId)?.data : null;
  const detailsPanel = document.getElementById('ct-panel-details');
  const cuesPanel = document.getElementById('ct-panel-cues');
  const playbackPanel = document.getElementById('ct-panel-playback');
  const scorePanel = document.getElementById('ct-panel-score');
  state.playbackContext.clear();

  if (detailsPanel) {
    if (!work) {
      detailsPanel.innerHTML = `<div class="ct-empty">Select a work to view details.</div>`;
    } else {
      detailsPanel.innerHTML = '';
      const header = document.createElement('header');
      const heading = document.createElement('h2');
      heading.dataset.panelHeading = 'true';
      heading.tabIndex = -1;
      heading.textContent = work.title || 'Untitled work';
      header.appendChild(heading);
      const slugLine = document.createElement('p');
      slugLine.className = 'ct-muted';
      slugLine.textContent = work.slug ? `Slug · ${work.slug}` : 'Slug · —';
      header.appendChild(slugLine);
      detailsPanel.appendChild(header);
      const detailText = work.descriptionEffective || work.onelinerEffective;
      if (detailText) {
        const summary = document.createElement('p');
        summary.textContent = detailText;
        detailsPanel.appendChild(summary);
      }
    }
  }

  if (cuesPanel) {
    if (!work) {
      cuesPanel.innerHTML = `<div class="ct-empty">Select a work to view cues.</div>`;
    } else if (!Array.isArray(work.cues) || work.cues.length === 0) {
      cuesPanel.innerHTML = `<div class="ct-empty">No cues for this work.</div>`;
    } else {
      cuesPanel.innerHTML = '';
      const header = document.createElement('header');
      const heading = document.createElement('h2');
      heading.dataset.panelHeading = 'true';
      heading.tabIndex = -1;
      heading.textContent = 'Cues';
      header.appendChild(heading);
      cuesPanel.appendChild(header);
      const cloud = document.createElement('div');
      cloud.className = 'ct-cues-cloud';
      work.cues.forEach((cue) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'work-cue';
        btn.dataset.id = String(work.id);
        btn.dataset.t = String(cue.t || 0);
        btn.dataset.act = 'play';
        btn.textContent = cue.label ? String(cue.label) : labelForCue(cue.t || 0, cue.label);
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          selectWork(work.id);
          playAt(work.id, cue.t || 0);
        });
        cloud.appendChild(btn);
      });
      cuesPanel.appendChild(cloud);
    }
  }

  if (playbackPanel) {
    if (!work) {
      playbackPanel.innerHTML = `<div class="ct-empty">Select a work to control playback.</div>`;
    } else if (!work.audio) {
      playbackPanel.innerHTML = `<div class="ct-empty">No playback available.</div>`;
    } else {
      const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
      bindAudio(work.id);
      bindPlaybackListeners(work.id);
      playbackPanel.innerHTML = '';
      const header = document.createElement('header');
      const heading = document.createElement('h2');
      heading.dataset.panelHeading = 'true';
      heading.tabIndex = -1;
      heading.textContent = 'Playback';
      header.appendChild(heading);
      playbackPanel.appendChild(header);
      const statusEl = document.createElement('div');
      statusEl.className = 'ct-playback-status';
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
      playbackPanel.appendChild(statusEl);
      const controls = document.createElement('div');
      controls.className = 'ct-playback-controls';
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'ct-playback-button';
      playBtn.dataset.icon = 'play';
      playBtn.innerHTML = `
        <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h3v14H8zm5 0h3v14h-3z" fill="currentColor"/></svg>
        <span class="sr-only">Play</span>
        <span class="ct-btn-text" aria-hidden="true">Play</span>
      `;
      playBtn.addEventListener('click', () => {
        if (!audio) return;
        if (audio.paused || audio.ended) {
          playAt(work.id, audio.currentTime || 0);
        } else {
          hudState.last = { id: work.id, at: audio.currentTime || 0 };
          audio.pause();
        }
        updatePlaybackContext(work.id);
      });
      controls.appendChild(playBtn);
      playbackPanel.appendChild(controls);
      state.playbackContext.set(work.id, {
        status: statusEl,
        playBtn,
        sr: playBtn.querySelector('.sr-only'),
        text: playBtn.querySelector('.ct-btn-text')
      });
      updatePlaybackContext(work.id);
    }
  }

  if (scorePanel) {
    if (!work) {
      scorePanel.innerHTML = `<div class="ct-empty">Select a work to view scores.</div>`;
    } else if (!work.pdf) {
      scorePanel.innerHTML = `<div class="ct-empty">No score available.</div>`;
    } else {
      scorePanel.innerHTML = '';
      const header = document.createElement('header');
      const heading = document.createElement('h2');
      heading.dataset.panelHeading = 'true';
      heading.tabIndex = -1;
      heading.textContent = 'Score';
      header.appendChild(heading);
      scorePanel.appendChild(header);
      const wrapper = document.createElement('div');
      wrapper.className = 'ct-score-actions';
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'work-action';
      openBtn.textContent = 'Open PDF';
      openBtn.addEventListener('click', () => {
        openPdfFor(work.id);
      });
      wrapper.appendChild(openBtn);
      scorePanel.appendChild(wrapper);
    }
  }
}

function focusActivePanelHeading() {
  const panel = document.querySelector(`#ct-panel-${activeTab}`);
  if (!panel || panel.hasAttribute('hidden')) return;
  const heading = panel.querySelector('[data-panel-heading]');
  if (heading && typeof heading.focus === 'function') {
    heading.focus({ preventScroll: false });
  }
}

function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readDurationSeconds(work) {
  if (!work || typeof work !== 'object') return null;
  const meta = work.meta || {};
  const candidates = [
    work.duration,
    work.durationSec,
    work.durationSeconds,
    meta.duration,
    meta.durationSec,
    meta.durationSeconds
  ];
  for (const value of candidates) {
    if (value == null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed);
      }
      const match = trimmed.match(/^(\d+):(\d{1,2})$/);
      if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
    }
  }
  return null;
}

function renderSummary() {
  const container = document.getElementById('ct-summary');
  if (!container) return;
  container.innerHTML = '';
  const cards = [
    { key: 'total', title: 'Total Works', value: String(works.length) },
    { key: 'audio', title: 'Playable', value: String(works.filter((w) => !!w.audio).length) },
    { key: 'pdf', title: 'With Scores', value: String(works.filter((w) => !!w.pdf).length) }
  ];
  let durationSum = 0;
  for (const work of works) {
    const secs = readDurationSeconds(work);
    if (Number.isFinite(secs) && secs > 0) {
      durationSum += secs;
    }
  }
  state.durationTotal = durationSum;
  if (durationSum > 0) {
    cards.push({ key: 'duration', title: 'Known Duration', value: formatTime(Math.floor(durationSum)) });
  }
  cards.forEach((card) => {
    const box = document.createElement('article');
    box.className = 'ct-summary-card';
    box.dataset.summary = card.key;
    const heading = document.createElement('h3');
    heading.textContent = card.title;
    const value = document.createElement('strong');
    value.textContent = card.value;
    box.append(heading, value);
    container.appendChild(box);
  });
}

function renderWorksList() {
  const container = document.getElementById('works-console');
  if (!container) return;
  state.worksById.clear();
  container.innerHTML = '';
  if (works.length === 0) {
    state.playbackContext.clear();
    const empty = document.createElement('div');
    empty.className = 'ct-works-empty';
    empty.textContent = 'No works available.';
    container.appendChild(empty);
    return;
  }
  works.forEach((work) => {
    const card = document.createElement('article');
    card.className = 'work';
    card.dataset.workId = String(work.id);
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="work-header">
        <div class="work-title">${escapeHtml(work.title ?? '')}</div>
        <div class="work-slug">${escapeHtml(work.slug ?? '')}</div>
      </div>
      <p class="work-one">${escapeHtml(work.onelinerEffective ?? '')}</p>
    `;
    const cues = Array.isArray(work.cues) ? work.cues : [];
    if (cues.length) {
      const cueWrap = document.createElement('div');
      cueWrap.className = 'work-cues';
      cues.forEach((cue) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'work-cue';
        btn.dataset.id = String(work.id);
        btn.dataset.t = String(cue.t || 0);
        btn.dataset.act = 'play';
        btn.textContent = cue.label ? cue.label : labelForCue(cue.t || 0, cue.label);
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          selectWork(work.id);
          playAt(work.id, cue.t || 0);
        });
        cueWrap.appendChild(btn);
      });
      card.appendChild(cueWrap);
    }
    const actions = document.createElement('div');
    actions.className = 'work-actions';
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'work-action';
    playBtn.textContent = 'Play';
    playBtn.dataset.act = 'play';
    playBtn.dataset.id = String(work.id);
    if (!work.audio) playBtn.disabled = true;
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'work-action';
    copyBtn.textContent = 'Copy URL';
    copyBtn.dataset.act = 'copy';
    copyBtn.dataset.id = String(work.id);
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'work-action';
    pdfBtn.textContent = 'PDF';
    pdfBtn.dataset.act = 'pdf';
    pdfBtn.dataset.id = String(work.id);
    if (!work.pdf) pdfBtn.disabled = true;
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'work-action';
    openBtn.textContent = 'Open';
    openBtn.dataset.act = 'open';
    openBtn.dataset.id = String(work.id);
    actions.append(playBtn, copyBtn, pdfBtn, openBtn);
    card.appendChild(actions);
    card.addEventListener('click', (event) => {
      if (event.target.closest('.work-actions') || event.target.closest('.work-cues')) return;
      selectWork(work.id);
    });
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selectWork(work.id);
      }
    });
    container.appendChild(card);
    state.worksById.set(Number(work.id), { data: work, el: card });
    if (work.audio) ensureAudioFor(work);
  });
  selectWork(selectedId, { skipHash: true });
}

function handleWorksActions() {
  const container = document.getElementById('works-console');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !button.dataset.act) return;
    const act = button.dataset.act;
    const id = Number(button.dataset.id || selectedId || 0);
    if (!id) return;
    if (act === 'play') {
      event.preventDefault();
      selectWork(id);
      playAt(id, 0);
    }
    if (act === 'copy') {
      event.preventDefault();
      const url = deepUrl(id);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => flash(button, 'Copied'));
      } else {
        flash(button, url);
      }
    }
    if (act === 'pdf') {
      event.preventDefault();
      selectWork(id);
      openPdfFor(id);
    }
    if (act === 'open') {
      event.preventDefault();
      selectWork(id);
      setActiveTab('details');
      document.getElementById('ct-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function renderFooter() {
  const footer = document.getElementById('prae-footer');
  if (!footer) return;
  const site = (PRAE.config && PRAE.config.site) || {};
  const year = new Date().getFullYear();
  const name = site.copyrightName || site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ') || '';
  footer.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'ct-footer-left';
  const copyright = document.createElement('span');
  copyright.textContent = name ? `${name} © ${year}` : `© ${year}`;
  info.appendChild(copyright);
  if (site.tagline) {
    const tagline = document.createElement('span');
    tagline.textContent = site.tagline;
    info.appendChild(tagline);
  }
  const badge = document.createElement('a');
  badge.className = 'prae-badge';
  badge.href = 'https://www.npmjs.com/package/praetorius';
  badge.target = '_blank';
  badge.rel = 'noopener';
  badge.innerHTML = `
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.65 5.36 5.91.86-4.28 4.17 1.01 5.89L12 15.98l-5.29 2.8 1.01-5.89-4.28-4.17 5.91-.86z"/></svg>
    <span>Powered by Praetorius</span>
  `;
  const linksWrap = document.createElement('nav');
  linksWrap.className = 'ct-footer-links';
  linksWrap.setAttribute('aria-label', 'Site links');
  const links = Array.isArray(site.links) ? site.links : [];
  links.forEach((link) => {
    if (!link || !link.href) return;
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.title || link.label || link.href;
    if (link.external) {
      anchor.target = '_blank';
      anchor.rel = 'noopener';
    }
    linksWrap.appendChild(anchor);
  });
  if (linksWrap.childElementCount > 0) {
    footer.append(info, badge, linksWrap);
  } else {
    footer.append(info, badge);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('#ct-tabs [role="tab"]');
  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab || 'details');
    });
    btn.addEventListener('keydown', (ev) => {
      const currentIndex = TAB_KEYS.indexOf(btn.dataset.tab || 'details');
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        const next = TAB_KEYS[(currentIndex + 1) % TAB_KEYS.length];
        setActiveTab(next);
        const nextBtn = document.querySelector(`[data-tab="${next}"]`);
        nextBtn?.focus();
      }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        const prev = TAB_KEYS[(currentIndex - 1 + TAB_KEYS.length) % TAB_KEYS.length];
        setActiveTab(prev);
        const prevBtn = document.querySelector(`[data-tab="${prev}"]`);
        prevBtn?.focus();
      }
      if (ev.key === 'Home') {
        ev.preventDefault();
        setActiveTab(TAB_KEYS[0]);
        document.querySelector(`[data-tab="${TAB_KEYS[0]}"]`)?.focus();
      }
      if (ev.key === 'End') {
        ev.preventDefault();
        setActiveTab(TAB_KEYS[TAB_KEYS.length - 1]);
        document.querySelector(`[data-tab="${TAB_KEYS[TAB_KEYS.length - 1]}"]`)?.focus();
      }
    });
  });
  if (!state.tablist) {
    state.tablist = document.querySelector('.ct-tablist');
    state.tabIndicator = state.tablist?.querySelector('.ct-tab-indicator') || null;
  }
  state.tablist?.addEventListener('scroll', () => updateTabIndicator(), { passive: true });
}

function hydrateFromHash() {
  const parsed = parseHash();
  if (parsed.id) {
    selectedId = parsed.id;
  }
  if (parsed.tab) {
    activeTab = parsed.tab;
  }
  if (!selectedId && works.length) {
    selectedId = works[0].id;
  }
  selectWork(selectedId, { skipHash: true });
  setActiveTab(activeTab, { skipHash: true });
}

function bindThemeToggle() {
  const btn = document.getElementById('wc-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.praeCycleTheme();
    window.praeApplyTheme(window.praeCurrentTheme());
  });
  btn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      window.praeCycleTheme();
      window.praeApplyTheme(window.praeCurrentTheme());
    }
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.altKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) {
      ev.preventDefault();
      window.praeCycleTheme();
      window.praeApplyTheme(window.praeCurrentTheme());
    }
  }, { passive: false });
}

function bindPdfEvents() {
  state.pdf.shell = document.querySelector('.ct-shell');
  state.pdf.pane = document.querySelector('.ct-pdfpane');
  state.pdf.title = document.querySelector('.ct-pdf-title');
  state.pdf.close = document.querySelector('.ct-pdf-close');
  state.pdf.frame = document.querySelector('.ct-pdf-frame');
  state.pdf.backdrop = document.querySelector('[data-pdf-backdrop]');
  state.pdf.close?.addEventListener('click', hidePdfPane);
  state.pdf.backdrop?.addEventListener('click', hidePdfPane);
  if (state.pdf.pane) {
    state.pdf.focusHandler = (event) => {
      if (event.key !== 'Tab' || state.pdf.pane?.getAttribute('aria-hidden') === 'true') return;
      const selectors = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(state.pdf.pane.querySelectorAll(selectors)).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    state.pdf.pane.addEventListener('keydown', state.pdf.focusHandler);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hidePdfPane();
  }, { passive: true });
  if (state.pdf.frame) {
    state.pdf.frame.addEventListener('load', () => {
      state.pdf.viewerReady = true;
      if (state.pdf.pendingGoto) {
        gotoPdfPage(state.pdf.pendingGoto.pdfPage);
        state.pdf.pendingGoto = null;
      }
    });
  }
  window.addEventListener('wc:pdf-goto', (event) => {
    const detail = event?.detail || {};
    if (!state.pdf.viewerReady || !state.pdf.pane || state.pdf.pane.getAttribute('aria-hidden') === 'true' || (detail.slug && detail.slug !== state.pdf.currentSlug)) {
      state.pdf.pendingGoto = detail;
      return;
    }
    gotoPdfPage(detail.pdfPage);
  });
}

function bindHudToggle() {
  const refs = ensureHudDom();
  const root = refs?.root;
  if (!root) return;
  root.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-hud="toggle"]');
    if (!btn) return;
    const now = getActiveAudioInfo();
    if (now.audio && !now.audio.paused) {
      hudState.last = { id: now.id, at: now.audio.currentTime || 0 };
      now.audio.pause();
      hudUpdate(now.id, now.audio);
      return;
    }
    const id = hudState.last.id || (works[0] && works[0].id);
    if (!id) return;
    playAt(id, hudState.last.at || 0);
  });
}

ready(() => {
  document.documentElement.dataset.skin = 'cards-tabs';
  injectHudCssOnce();
  ensureHudDom();
  bindHudToggle();
  window.praeApplyTheme(window.praeCurrentTheme(), { persist: false });
  bindThemeToggle();
  renderSummary();
  renderWorksList();
  renderFooter();
  handleWorksActions();
  initTabs();
  bindPdfEvents();
  hydrateFromHash();
  renderPanels();
  updateTabIndicator();
  window.addEventListener('hashchange', hydrateFromHash);
  window.addEventListener('resize', () => updateTabIndicator(), { passive: true });
});

export {};
