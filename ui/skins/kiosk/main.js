const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function praeNormalizeTheme(value) {
  return value === 'light' ? 'light' : 'dark';
}

function praeReadStoredTheme() {
  try {
    const saved = localStorage.getItem(PRAE_THEME_STORAGE_KEY);
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

const HASH_KEY = 'work';
const ATTRACT_DELAY = 70000;
const ATTRACT_INTERVAL = 6000;

const state = {
  worksById: new Map(),
  selectedId: works[0]?.id ?? null,
  tiles: [],
  lastFocusedTile: null,
  hud: null,
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  pdf: {
    shell: null,
    pane: null,
    title: null,
    close: null,
    frame: null,
    backdrop: null,
    viewerReady: false,
    pendingGoto: null,
    currentSlug: null,
    restoreFocus: null
  },
  pageFollow: { audio: null, slug: null, lastPrinted: null, on: null },
  detail: { container: null, progress: null, play: null, pdf: null },
  live: null,
  attract: { timer: null, loop: null, index: 0, active: false },
  controls: null
};

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

function findWorkById(id) {
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  if (state.worksById.has(num)) return state.worksById.get(num);
  const data = works.find((item) => Number(item.id) === num) || null;
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

function hudUpdate(id, audio) {
  const work = findWorkById(id)?.data;
  const name = work ? work.title : '—';
  const duration = audio && Number.isFinite(audio.duration) ? formatTime(audio.duration) : '--:--';
  const current = audio && Number.isFinite(audio.currentTime) ? formatTime(audio.currentTime) : '0:00';
  const ratio = audio && audio.duration ? Math.max(0, Math.min(1, (audio.currentTime || 0) / Math.max(1, audio.duration))) : 0;
  hudSetTitle(`Now playing — ${name}`);
  hudSetSubtitle(`${current} / ${duration}`);
  hudSetProgress(ratio);
  hudSetPlaying(!!(audio && !audio.paused));
  updateDetailPlayback(id, audio);
}

function bindAudio(id, audio) {
  if (!audio || audio.dataset.kioskBound === '1') return;
  const update = () => hudUpdate(id, audio);
  audio.addEventListener('timeupdate', update, { passive: true });
  audio.addEventListener('play', () => {
    update();
    markTileState(id, { playing: true });
  }, { passive: true });
  audio.addEventListener('pause', () => {
    update();
    markTileState(id, { playing: false });
  }, { passive: true });
  audio.addEventListener('ended', () => {
    update();
    markTileState(id, { playing: false });
  }, { passive: true });
  audio.addEventListener('loadedmetadata', update, { passive: true, once: true });
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) {
      audio.dataset.duration = String(audio.duration);
    }
  }, { passive: true });
  audio.dataset.kioskBound = '1';
}

function markTileState(id, opts = {}) {
  const tile = state.tiles.find((item) => Number(item.dataset.workId) === Number(id));
  if (!tile) return;
  if (opts.playing !== undefined) {
    tile.classList.toggle('playing', !!opts.playing);
  }
  if (opts.selected !== undefined) {
    tile.classList.toggle('selected', !!opts.selected);
  }
}

function pauseOthers(exceptId) {
  works.forEach((w) => {
    if (Number(w.id) === Number(exceptId)) return;
    const audio = document.getElementById('wc-a' + w.id);
    if (audio && !audio.paused) {
      audio.pause();
    }
  });
}

function playAt(id, t = 0) {
  const meta = findWorkById(id);
  if (!meta) return;
  const work = meta.data;
  if (state.selectedId !== work.id) {
    showDetail(work.id);
  }
  const audio = ensureAudioFor(work);
  if (!audio) return;
  pauseOthers(work.id);
  hudSetTitle(`Now playing — ${work.title || work.slug || 'Work'}`);
  const raw = audio.getAttribute('data-audio') || work.audio || '';
  const src = normalizeSrc(raw);
  if (src && audio.src !== src) {
    audio.src = src;
  }
  state.hudState.last = { id: work.id, at: t || 0 };
  const seekAndPlay = () => {
    try { audio.currentTime = Math.max(0, Number(t) || 0); } catch (_) {}
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
    markTileState(work.id, { playing: true });
    bindAudio(work.id, audio);
    requestAnimationFrame(() => hudUpdate(work.id, audio));
    if (work.slug) attachPageFollow(work.slug, audio);
  };
  if (audio.readyState >= 1) {
    seekAndPlay();
  } else {
    audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
    audio.load();
  }
}

function togglePlay(id) {
  const audio = document.getElementById('wc-a' + id) || ensureAudioFor(findWorkById(id)?.data);
  if (!audio) return;
  if (audio.paused || audio.ended) {
    const at = audio.ended ? 0 : audio.currentTime || state.hudState.last.at || 0;
    playAt(id, at);
  } else {
    state.hudState.last = { id, at: audio.currentTime || 0 };
    audio.pause();
    markTileState(id, { playing: false });
    hudUpdate(id, audio);
  }
}

function makeWorkUrl(id) {
  const base = `${location.origin}${location.pathname}`;
  if (!id) return base;
  return `${base}#${HASH_KEY}=${encodeURIComponent(id)}`;
}

async function copyUrl(id) {
  const url = makeWorkUrl(id);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      announce('Link copied to clipboard');
      return true;
    }
  } catch (_) {}
  const temp = document.createElement('input');
  temp.value = url;
  temp.setAttribute('readonly', '');
  temp.style.position = 'absolute';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);
  temp.select();
  try {
    document.execCommand('copy');
    announce('Link copied to clipboard');
    return true;
  } catch (err) {
    console.warn('Copy failed', err);
    return false;
  } finally {
    temp.remove();
  }
}

function showDetail(id) {
  const record = findWorkById(id);
  if (!record) return;
  const work = record.data;
  resetAttract();
  state.selectedId = work.id;
  updateHash(work.id);
  state.tiles.forEach((tile) => tile.classList.toggle('selected', Number(tile.dataset.workId) === Number(work.id)));
  const detail = state.detail.container;
  if (!detail) return;
  const cues = Array.isArray(work.cues) ? work.cues : [];
  const cueHtml = cues.length
    ? `<div class="kiosk-cues">${cues
        .map((cue) => {
          const t = Number(cue.t) || 0;
          return `<button type="button" class="kiosk-cue" data-act="play" data-id="${work.id}" data-t="${t}" aria-label="Play ${esc(labelForCue(t, cue.label))}">${esc(labelForCue(t, cue.label))}</button>`;
        })
        .join('')}</div>`
    : '';
  const pdfDisabled = !work.pdf;
  const pdfLabel = work.pdf ? 'Open Score' : 'Score unavailable';
  detail.innerHTML = `
    <header class="kiosk-detail-head">
      <span class="kiosk-detail-slug">${esc(work.slug || '')}</span>
      <h1>${esc(work.title || 'Untitled work')}</h1>
      <p class="kiosk-detail-one">${esc(work.one || '')}</p>
    </header>
    ${cueHtml}
    <div class="kiosk-detail-progress" data-role="progress">Now playing 0:00 / 0:00</div>
    <div class="kiosk-detail-actions">
      <button type="button" class="kiosk-btn" data-act="toggle-play" data-id="${work.id}">Play</button>
      <button type="button" class="kiosk-btn" data-act="pdf" data-id="${work.id}" ${pdfDisabled ? 'disabled aria-disabled="true"' : ''}>${esc(pdfLabel)}</button>
      <button type="button" class="kiosk-btn" data-act="copy" data-id="${work.id}">Copy URL</button>
      <button type="button" class="kiosk-btn" data-act="open-window" data-id="${work.id}">Open in new tab</button>
    </div>
    <footer>
      <button type="button" class="kiosk-btn" data-act="back">Back to works</button>
    </footer>`;
  detail.removeAttribute('hidden');
  document.body.classList.add('kiosk-detail-open');
  const playBtn = detail.querySelector('[data-act="toggle-play"]');
  const progress = detail.querySelector('[data-role="progress"]');
  const pdfBtn = detail.querySelector('[data-act="pdf"]');
  state.detail.play = playBtn;
  state.detail.progress = progress;
  state.detail.pdf = pdfBtn;
  const tile = state.tiles.find((node) => Number(node.dataset.workId) === Number(work.id));
  state.lastFocusedTile = document.activeElement instanceof HTMLElement ? document.activeElement : tile || null;
  requestAnimationFrame(() => {
    playBtn?.focus({ preventScroll: true });
  });
  updateDetailPlayback(work.id, document.getElementById('wc-a' + work.id));
}

function hideDetail() {
  const detail = state.detail.container;
  if (!detail) return;
  detail.setAttribute('hidden', '');
  document.body.classList.remove('kiosk-detail-open');
  state.detail.play = null;
  state.detail.progress = null;
  state.detail.pdf = null;
  updateHash(null);
  if (state.lastFocusedTile && typeof state.lastFocusedTile.focus === 'function') {
    requestAnimationFrame(() => state.lastFocusedTile?.focus({ preventScroll: true }));
  }
}

function updateDetailPlayback(id, audio) {
  if (!state.detail.container || state.detail.container.hasAttribute('hidden')) return;
  if (state.selectedId && Number(state.selectedId) !== Number(id)) return;
  const work = findWorkById(id)?.data;
  if (!work) return;
  const btn = state.detail.play;
  const progress = state.detail.progress;
  if (btn) {
    const playing = audio ? (!audio.paused && !audio.ended) : false;
    btn.textContent = playing ? 'Pause' : 'Play';
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  if (progress) {
    const now = audio && Number.isFinite(audio.currentTime) ? formatTime(audio.currentTime) : '0:00';
    const total = audio && Number.isFinite(audio.duration) ? formatTime(audio.duration) : '--:--';
    progress.textContent = `Now playing ${now} / ${total}`;
  }
  if (state.detail.pdf) {
    state.detail.pdf.disabled = !work.pdf;
    if (work.pdf) {
      state.detail.pdf.removeAttribute('aria-disabled');
    } else {
      state.detail.pdf.setAttribute('aria-disabled', 'true');
    }
  }
}

function updateHash(id) {
  const base = `${location.origin}${location.pathname}`;
  try {
    if (!id) {
      history.replaceState(null, '', base);
      return;
    }
    history.replaceState(null, '', `${base}#${HASH_KEY}=${encodeURIComponent(id)}`);
  } catch (err) {
    if (!id) {
      location.hash = '';
    } else {
      location.hash = `${HASH_KEY}=${encodeURIComponent(id)}`;
    }
  }
}

function hydrateFromHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const parts = new URLSearchParams(hash.includes('=') ? hash : `${HASH_KEY}=${hash}`);
  const work = parts.get(HASH_KEY);
  if (work) {
    const id = Number(work);
    if (!Number.isNaN(id)) {
      requestAnimationFrame(() => showDetail(id));
    }
  }
}

function detachPageFollow() {
  if (state.pageFollow.audio && state.pageFollow.on) {
    state.pageFollow.audio.removeEventListener('timeupdate', state.pageFollow.on);
    state.pageFollow.audio.removeEventListener('seeking', state.pageFollow.on);
  }
  state.pageFollow = { audio: null, slug: null, lastPrinted: null, on: null };
}

function cueTime(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  if (/^\d+$/.test(String(value))) return parseInt(value, 10);
  const match = String(value).match(/^(\d+):([0-5]?\d)$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
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
  const cfg = pfMap[slug];
  if (!cfg) return 1;
  const printed = printedPageForTime(cfg, tSec || 0);
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
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

function gotoPdfPage(pageNum) {
  const frame = state.pdf.frame;
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
  if (!meta) return;
  const work = meta.data;
  if (!work.pdf) return;
  const raw = normalizePdfUrl(work.pdf);
  const viewerUrl = choosePdfViewer(raw);
  const { pane, frame, title, backdrop } = state.pdf;
  if (!pane || !frame) {
    window.open(viewerUrl, '_blank', 'noopener');
    return;
  }
  state.pdf.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.pdf.currentSlug = work.slug || null;
  if (pane) {
    pane.removeAttribute('hidden');
    pane.setAttribute('aria-hidden', 'false');
  }
  backdrop?.removeAttribute('hidden');
  pane.classList.add('is-open');
  pane.focus?.({ preventScroll: true });
  if (title) title.textContent = String(work.title || 'Score');
  frame.src = 'about:blank';
  state.pdf.viewerReady = false;
  requestAnimationFrame(() => {
    frame.src = viewerUrl;
    state.pdf.pendingGoto = null;
  });
}

function hidePdfPane() {
  const { pane, frame, backdrop } = state.pdf;
  pane?.setAttribute('aria-hidden', 'true');
  pane?.classList.remove('is-open');
  pane?.setAttribute('hidden', '');
  backdrop?.setAttribute('hidden', '');
  if (frame) frame.src = 'about:blank';
  state.pdf.currentSlug = null;
  state.pdf.viewerReady = false;
  state.pdf.pendingGoto = null;
  const restore = state.pdf.restoreFocus;
  state.pdf.restoreFocus = null;
  if (restore && typeof restore.focus === 'function') {
    requestAnimationFrame(() => restore.focus());
  }
}

function updateFullscreenButton() {
  const btn = state.controls?.fullscreen || null;
  if (!btn) return;
  const active = !!document.fullscreenElement;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.textContent = active ? 'Exit fullscreen' : 'Enter fullscreen';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const root = document.documentElement;
    root.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

function ensureControls() {
  const ctl = document.getElementById('kiosk-ctl');
  if (!ctl) return;
  ctl.innerHTML = `
    <button type="button" data-act="theme">Theme</button>
    <button type="button" data-act="fullscreen" aria-pressed="false">Enter fullscreen</button>
    <button type="button" data-act="reset">Reset</button>
    <button type="button" data-act="contrast" aria-pressed="${document.body.classList.contains('kiosk-contrast') ? 'true' : 'false'}">High contrast</button>`;
  const buttons = ctl.querySelectorAll('button');
  buttons.forEach((btn) => {
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        btn.click();
      }
    });
  });
  ctl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    resetAttract();
    if (act === 'theme') {
      window.praeCycleTheme?.();
    }
    if (act === 'fullscreen') {
      toggleFullscreen();
      setTimeout(() => updateFullscreenButton(), 200);
    }
    if (act === 'reset') {
      document.body.classList.remove('kiosk-contrast');
      hideDetail();
      hidePdfPane();
      if (document.fullscreenElement) document.exitFullscreen?.();
      const first = state.tiles[0];
      first?.focus();
      const contrastBtn = state.controls?.root?.querySelector('[data-act="contrast"]');
      contrastBtn?.setAttribute('aria-pressed', 'false');
    }
    if (act === 'contrast') {
      const on = !document.body.classList.contains('kiosk-contrast');
      document.body.classList.toggle('kiosk-contrast', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  });
  state.controls = {
    root: ctl,
    fullscreen: ctl.querySelector('[data-act="fullscreen"]')
  };
  updateFullscreenButton();
}

function renderGrid() {
  const grid = document.getElementById('kiosk-grid');
  if (!grid) return;
  state.tiles = [];
  grid.innerHTML = '';
  if (!works.length) {
    const empty = document.createElement('div');
    empty.className = 'kiosk-empty';
    empty.textContent = 'No works available yet. Add works to begin.';
    grid.appendChild(empty);
    return;
  }
  works.forEach((work) => {
    const tile = document.createElement('article');
    tile.className = 'kiosk-tile';
    tile.tabIndex = 0;
    tile.dataset.workId = work.id;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `Open ${work.title || work.slug || 'work'} details`);
    const cues = Array.isArray(work.cues) ? work.cues : [];
    const cueHtml = cues.length
      ? `<div class="kiosk-cues">${cues
          .map((cue) => {
            const t = Number(cue.t) || 0;
            return `<button type="button" class="kiosk-cue" data-act="play" data-id="${work.id}" data-t="${t}" aria-label="Play ${esc(labelForCue(t, cue.label))}">${esc(labelForCue(t, cue.label))}</button>`;
          })
          .join('')}</div>`
      : '';
    tile.innerHTML = `
      <div>
        <span class="kiosk-slug">${esc(work.slug || '')}</span>
        <h2>${esc(work.title || 'Untitled work')}</h2>
      </div>
      <p class="kiosk-one">${esc(work.one || '')}</p>
      ${cueHtml}
      <div class="kiosk-actions">
        <button type="button" class="kiosk-btn" data-act="play" data-id="${work.id}">Play</button>
        <button type="button" class="kiosk-btn" data-act="pdf" data-id="${work.id}" ${work.pdf ? '' : 'disabled aria-disabled="true"'}>Open Score</button>
        <button type="button" class="kiosk-btn" data-act="copy" data-id="${work.id}">Copy URL</button>
        <button type="button" class="kiosk-btn" data-act="detail" data-id="${work.id}">Open</button>
      </div>`;
    grid.appendChild(tile);
    ensureAudioFor(work);
    const record = findWorkById(work.id);
    if (record) record.el = tile;
    state.tiles.push(tile);
  });
  state.tiles.forEach((tile) => {
    tile.addEventListener('focus', resetAttract);
  });
  if (state.selectedId) {
    markTileState(state.selectedId, { selected: true });
  }
}

function announce(message) {
  if (!state.live) {
    const live = document.createElement('div');
    live.id = 'kiosk-live';
    live.className = 'kiosk-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    live.hidden = true;
    document.body.appendChild(live);
    state.live = live;
  }
  state.live.textContent = String(message || '');
  state.live.hidden = false;
  clearTimeout(state.live._hideTimer);
  state.live._hideTimer = setTimeout(() => {
    state.live.hidden = true;
  }, 1500);
}

function bindGridEvents() {
  const grid = document.getElementById('kiosk-grid');
  if (!grid) return;
  grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    const tile = ev.target.closest('.kiosk-tile');
    if (btn) {
      ev.preventDefault();
      const act = btn.getAttribute('data-act');
      const id = Number(btn.getAttribute('data-id') || tile?.dataset.workId || 0);
      const t = Number(btn.getAttribute('data-t') || 0);
      handleAction(act, id, t);
      resetAttract();
      return;
    }
    if (tile) {
      const id = Number(tile.dataset.workId || 0);
      if (!Number.isNaN(id)) {
        showDetail(id);
        resetAttract();
      }
    }
  });
  grid.addEventListener('keydown', (ev) => {
    const tile = ev.target.closest('.kiosk-tile');
    if (!tile) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const id = Number(tile.dataset.workId || 0);
      if (!Number.isNaN(id)) showDetail(id);
      return;
    }
    if (['ArrowLeft', 'ArrowUp'].includes(ev.key)) {
      ev.preventDefault();
      moveFocus(tile, -1);
    }
    if (['ArrowRight', 'ArrowDown'].includes(ev.key)) {
      ev.preventDefault();
      moveFocus(tile, 1);
    }
  });
}

function moveFocus(tile, delta) {
  const idx = state.tiles.indexOf(tile);
  if (idx === -1) return;
  const next = Math.max(0, Math.min(state.tiles.length - 1, idx + delta));
  const target = state.tiles[next];
  if (target) target.focus();
}

function bindDetailEvents() {
  const detail = state.detail.container;
  if (!detail) return;
  detail.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'back') {
      hideDetail();
      resetAttract();
      return;
    }
    const id = Number(btn.getAttribute('data-id') || state.selectedId || 0);
    const t = Number(btn.getAttribute('data-t') || 0);
    handleAction(act, id, t);
    resetAttract();
  });
}

function handleAction(act, id, t) {
  if (!id) return;
  if (act === 'play') {
    playAt(id, t || 0);
  }
  if (act === 'toggle-play') {
    togglePlay(id);
  }
  if (act === 'pdf') {
    openPdfFor(id);
  }
  if (act === 'copy') {
    copyUrl(id);
  }
  if (act === 'detail') {
    showDetail(id);
  }
  if (act === 'open-window') {
    window.open(makeWorkUrl(id), '_blank', 'noopener');
  }
}

function bindHudToggle() {
  const refs = ensureHudDom();
  refs?.btn?.addEventListener('click', () => {
    const now = getActiveAudioInfo();
    if (now.audio && !now.audio.paused) {
      state.hudState.last = { id: now.id, at: now.audio.currentTime || 0 };
      now.audio.pause();
      return;
    }
    const id = state.hudState.last.id || works[0]?.id;
    if (!id) return;
    playAt(id, state.hudState.last.at || 0);
  });
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

function startAttract() {
  if (!state.tiles.length || state.attract.active) return;
  state.attract.active = true;
  document.body.classList.add('is-attract');
  state.attract.index = 0;
  highlightAttractTile();
  state.attract.loop = setInterval(() => {
    state.attract.index = (state.attract.index + 1) % state.tiles.length;
    highlightAttractTile();
  }, ATTRACT_INTERVAL);
}

function highlightAttractTile() {
  state.tiles.forEach((tile, idx) => {
    tile.classList.toggle('is-highlight', idx === state.attract.index);
  });
}

function stopAttract() {
  if (!state.attract.active) return;
  state.attract.active = false;
  document.body.classList.remove('is-attract');
  clearInterval(state.attract.loop);
  state.attract.loop = null;
  state.tiles.forEach((tile) => tile.classList.remove('is-highlight'));
}

function resetAttract() {
  stopAttract();
  clearTimeout(state.attract.timer);
  state.attract.timer = setTimeout(startAttract, ATTRACT_DELAY);
}

function bindAttractListeners() {
  ['pointerdown', 'touchstart', 'mousemove'].forEach((type) => {
    window.addEventListener(type, resetAttract, { passive: true });
  });
  window.addEventListener('keydown', resetAttract);
  resetAttract();
}

function initBrand() {
  const site = (PRAE.config && PRAE.config.site) || {};
  const nav = document.getElementById('prae-nav');
  const title = document.querySelector('[data-site-title]');
  const subtitle = document.querySelector('[data-site-subtitle]');
  if (title) {
    const full = site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ').trim() || site.title || 'Praetorius';
    title.textContent = full;
  }
  if (subtitle) {
    subtitle.textContent = site.subtitle || site.description || 'Works presentation';
  }
  if (nav) {
    const links = Array.isArray(site.links) ? site.links : [];
    nav.innerHTML = links
      .filter((link) => link && link.label)
      .map((link) => `<a href="${esc(link.href || '#')}" ${link.external ? 'target="_blank" rel="noopener"' : ''}>${esc(link.label)}</a>`)
      .join('');
  }
}

function initFooter() {
  const site = (PRAE.config && PRAE.config.site) || {};
  const footer = document.getElementById('prae-footer');
  if (!footer) return;
  const name = site.copyrightName || site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ') || 'Praetorius';
  const updated = site.updated?.mode === 'manual' ? site.updated.value : '';
  const links = Array.isArray(site.links) ? site.links : [];
  footer.innerHTML = `
    <div>© ${esc(name)}${updated ? ` · Updated ${esc(String(updated))}` : ''}</div>
    <div>${links
      .map((link) => `<a href="${esc(link.href || '#')}" ${link.external ? 'target="_blank" rel="noopener"' : ''}>${esc(link.label || 'Link')}</a>`)
      .join('')}</div>`;
}

function bindThemeToggle() {
  const btn = document.getElementById('wc-theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.praeCycleTheme?.();
  });
  btn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      window.praeCycleTheme?.();
    }
  });
}

function bindGlobalEvents() {
  window.addEventListener('hashchange', hydrateFromHash);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!state.detail.container?.hasAttribute('hidden')) {
        hideDetail();
      }
      if (state.pdf.pane && state.pdf.pane.getAttribute('aria-hidden') === 'false') {
        hidePdfPane();
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      resetAttract();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton();
  });
  window.addEventListener('wc:pdf-goto', (ev) => {
    const detail = ev.detail || {};
    if (!detail.slug) return;
    if (state.pdf.currentSlug && state.pdf.currentSlug === detail.slug) {
      if (!state.pdf.viewerReady) {
        state.pdf.pendingGoto = detail;
      } else {
        gotoPdfPage(detail.pdfPage);
      }
    }
  });
}

function initPdfShell() {
  const pane = document.querySelector('.kiosk-pdfpane');
  const title = document.querySelector('.kiosk-pdf-title');
  const close = document.querySelector('.kiosk-pdf-close');
  const frame = document.querySelector('.kiosk-pdf-frame');
  const backdrop = document.querySelector('[data-pdf-backdrop]');
  state.pdf = { ...state.pdf, pane, title, close, frame, backdrop, shell: document.querySelector('.kiosk-shell'), viewerReady: false };
  if (pane && !pane.hasAttribute('tabindex')) {
    pane.setAttribute('tabindex', '-1');
  }
  close?.addEventListener('click', () => {
    hidePdfPane();
    resetAttract();
  });
  backdrop?.addEventListener('click', () => {
    hidePdfPane();
    resetAttract();
  });
  frame?.addEventListener('load', () => {
    state.pdf.viewerReady = true;
    if (state.pdf.pendingGoto) {
      gotoPdfPage(state.pdf.pendingGoto.pdfPage);
      state.pdf.pendingGoto = null;
    }
  });
}

function primeHudApi() {
  const api = {
    ensure: () => ensureHudDom()?.root ?? ensureHudRoot(),
    setTitle: hudSetTitle,
    setSubtitle: hudSetSubtitle,
    setPlaying: hudSetPlaying,
    setProgress: hudSetProgress,
    getRoot: ensureHudRoot
  };
  PRAE.hud = Object.assign({}, PRAE.hud || {}, api);
  PRAE.hud.ensure();
}

ready(() => {
  document.documentElement.dataset.skin = 'kiosk';
  window.praeApplyTheme?.(window.praeCurrentTheme?.(), { persist: false });
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
  PRAE.worksById = works.reduce((acc, work) => {
    acc[work.id] = work;
    return acc;
  }, {});
  primeHudApi();
  bindHudToggle();
  initBrand();
  initFooter();
  ensureControls();
  bindThemeToggle();
  const detail = document.getElementById('kiosk-detail');
  state.detail.container = detail;
  bindDetailEvents();
  renderGrid();
  bindGridEvents();
  bindGlobalEvents();
  initPdfShell();
  bindAttractListeners();
  hydrateFromHash();
});
