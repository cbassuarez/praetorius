const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];
const OPERATOR_STORAGE_KEY = 'prae.kiosk.operator.v1';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const ATTRACT_DEFAULTS = Object.freeze({
  attractMode: 'visual-only',
  density: 'balanced',
  motion: 'standard'
});
const ATTRACT_MODES = new Set(['off', 'visual-only', 'visual-muted', 'full-autoplay']);
const DENSITY_PRESETS = new Set(['comfort', 'balanced', 'dense']);
const MOTION_PRESETS = new Set(['low', 'standard', 'high']);

const HEROICONS_BASE = './lib/heroicons/24/outline';
const HEROICON_FILE_MAP = Object.freeze({
  sun: 'sun',
  moon: 'moon',
  play: 'play',
  pause: 'pause',
  link: 'link',
  document: 'document-text',
  eye: 'eye',
  arrowUpRight: 'arrow-up-right',
  arrowsPointingOut: 'arrows-pointing-out',
  arrowsPointingIn: 'arrows-pointing-in',
  arrowPath: 'arrow-path',
  sparkles: 'sparkles',
  xMark: 'x-mark'
});

function icon(name, className = 'k-icon') {
  const file = HEROICON_FILE_MAP[name] || HEROICON_FILE_MAP.sparkles;
  return `<img class="${className}" src="${HEROICONS_BASE}/${file}.svg" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch (_) {
    return false;
  }
}

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
  try {
    if (window.PRAE && typeof window.PRAE.applyAppearanceMode === 'function') {
      window.PRAE.applyAppearanceMode(eff, { persist: false });
    }
  } catch (_) {}
  if (!opts || opts.persist !== false) {
    try { localStorage.setItem(PRAE_THEME_STORAGE_KEY, eff); } catch (_) {}
  }
  const btn = document.getElementById('wc-theme-toggle');
  if (btn) {
    btn.setAttribute('aria-checked', String(eff === 'dark'));
    btn.dataset.mode = eff;
    btn.innerHTML = eff === 'dark' ? icon('sun') : icon('moon');
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
  controls: null,
  modeChip: null,
  operator: {
    menu: null,
    body: null,
    hotspot: null,
    open: false,
    touchTimer: null,
    settings: { ...ATTRACT_DEFAULTS }
  },
  attractPreview: { id: null, audio: null, cleanupTimer: null }
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

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCoverUrl(work) {
  const raw = work && typeof work === 'object' ? (work.cover ?? work.coverUrl ?? null) : null;
  if (raw == null) return '';
  return String(raw).trim();
}

function coverMarkup(work, className = 'kiosk-cover') {
  const cover = normalizeCoverUrl(work);
  if (cover) {
    return `<figure class="${className}"><img src="${esc(cover)}" alt="${esc((work?.title || 'Work') + ' cover')}" loading="lazy" decoding="async"></figure>`;
  }
  return '';
}

function buttonMarkup(iconName, label) {
  return `${icon(iconName)}<span>${esc(label)}</span>`;
}

function normalizeOperatorSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const attractMode = ATTRACT_MODES.has(input.attractMode) ? input.attractMode : ATTRACT_DEFAULTS.attractMode;
  const density = DENSITY_PRESETS.has(input.density) ? input.density : ATTRACT_DEFAULTS.density;
  const motion = MOTION_PRESETS.has(input.motion) ? input.motion : ATTRACT_DEFAULTS.motion;
  return { attractMode, density, motion };
}

function readOperatorSettings() {
  try {
    const raw = localStorage.getItem(OPERATOR_STORAGE_KEY);
    if (!raw) return { ...ATTRACT_DEFAULTS };
    const parsed = JSON.parse(raw);
    return normalizeOperatorSettings(parsed);
  } catch (_) {
    return { ...ATTRACT_DEFAULTS };
  }
}

function saveOperatorSettings(settings) {
  try {
    localStorage.setItem(OPERATOR_STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
}

function stopAttractPreview() {
  const preview = state.attractPreview;
  if (!preview) return;
  if (preview.id != null) {
    markTileState(preview.id, { playing: false });
  }
  if (preview.audio) {
    try {
      preview.audio.pause();
      preview.audio.currentTime = 0;
      preview.audio.muted = false;
      preview.audio.volume = 1;
    } catch (_) {}
  }
  if (preview.cleanupTimer) {
    clearTimeout(preview.cleanupTimer);
    preview.cleanupTimer = null;
  }
  preview.id = null;
  preview.audio = null;
}

function updateModeChip() {
  const modeChip = state.modeChip || document.getElementById('kiosk-mode-chip');
  if (!modeChip) return;
  state.modeChip = modeChip;
  const settings = state.operator.settings;
  const modeLabel = {
    off: 'Attract Off',
    'visual-only': 'Attract Visual',
    'visual-muted': 'Attract Muted',
    'full-autoplay': 'Attract Autoplay'
  }[settings.attractMode] || 'Attract Visual';
  const densityLabel = {
    comfort: 'Comfort',
    balanced: 'Balanced',
    dense: 'Dense'
  }[settings.density] || 'Balanced';
  const motionLabel = {
    low: 'Low Motion',
    standard: 'Standard Motion',
    high: 'High Motion'
  }[settings.motion] || 'Standard Motion';
  modeChip.textContent = `${modeLabel} · ${densityLabel} · ${motionLabel}`;
}

function applyOperatorSettings(next, opts = {}) {
  const normalized = normalizeOperatorSettings(next);
  state.operator.settings = normalized;
  const body = document.body;
  if (body) {
    body.dataset.attractMode = normalized.attractMode;
    body.dataset.density = normalized.density;
    body.dataset.motion = normalized.motion;
  }
  updateModeChip();
  if (opts.persist !== false) {
    saveOperatorSettings(normalized);
  }
  if (normalized.attractMode === 'off') {
    stopAttract();
    clearTimeout(state.attract.timer);
  } else if (opts.resetAttract !== false) {
    resetAttract();
  }
}

function applyTilePointerMotion(tile) {
  if (!tile || prefersReducedMotion()) return;
  let raf = 0;
  let sweepTimer = null;
  const triggerSheen = () => {
    tile.style.setProperty('--tile-sheen', '-40%');
    requestAnimationFrame(() => {
      tile.style.setProperty('--tile-sheen', '132%');
    });
  };
  tile.addEventListener('mouseenter', () => {
    clearTimeout(sweepTimer);
    triggerSheen();
    sweepTimer = setTimeout(triggerSheen, 380);
  });
  tile.addEventListener('focusin', triggerSheen);
  tile.addEventListener('mouseleave', () => {
    clearTimeout(sweepTimer);
    tile.style.removeProperty('--tile-x');
    tile.style.removeProperty('--tile-y');
  });
  tile.addEventListener('pointermove', (event) => {
    if (raf) cancelAnimationFrame(raf);
    const rect = tile.getBoundingClientRect();
    raf = requestAnimationFrame(() => {
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      tile.style.setProperty('--tile-x', `${Math.max(0, Math.min(100, x))}%`);
      tile.style.setProperty('--tile-y', `${Math.max(0, Math.min(100, y))}%`);
    });
  });
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
  const slot = document.getElementById('kiosk-hud-slot');
  let root = document.getElementById('wc-hud');
  if (!root) {
    root = document.createElement('div');
    root.id = 'wc-hud';
    root.className = 'wc-hud';
    if (slot) slot.appendChild(root);
    else document.body.prepend(root);
  } else {
    root.id = 'wc-hud';
    root.classList.add('wc-hud');
    if (slot && root.parentNode !== slot) {
      slot.appendChild(root);
    }
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
      <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play" data-icon="play">
        ${icon('play', 'k-icon icon-play')}
        ${icon('pause', 'k-icon icon-pause')}
      </button>
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
  stopAttractPreview();
  const work = meta.data;
  if (state.selectedId !== work.id) {
    showDetail(work.id);
  }
  const audio = ensureAudioFor(work);
  if (!audio) return;
  try {
    if (window.PRAE && typeof window.PRAE.pauseAllAudio === 'function') {
      window.PRAE.pauseAllAudio(work.id);
    }
  } catch (_) {}
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
  const tags = normalizeTagList(work.tags).slice(0, 8);
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
  const tagsHtml = tags.length
    ? `<div class="kiosk-tags">${tags.map((tag) => `<span class="kiosk-tag">${esc(tag)}</span>`).join('')}</div>`
    : '';
  detail.innerHTML = `
    <header class="kiosk-detail-head">
      <div>
        <span class="kiosk-detail-slug">${esc(work.slug || '')}</span>
        <h1>${esc(work.title || 'Untitled work')}</h1>
        <p class="kiosk-detail-one">${esc(work.descriptionEffective || work.onelinerEffective || '')}</p>
      </div>
      ${coverMarkup(work, 'kiosk-cover')}
    </header>
    ${tagsHtml}
    ${cueHtml}
    <div class="kiosk-detail-progress" data-role="progress">Now playing 0:00 / 0:00</div>
    <div class="kiosk-detail-actions">
      <button type="button" class="kiosk-btn" data-act="toggle-play" data-id="${work.id}">${buttonMarkup('play', 'Play')}</button>
      <button type="button" class="kiosk-btn" data-act="pdf" data-id="${work.id}" ${pdfDisabled ? 'disabled aria-disabled="true"' : ''}>${buttonMarkup('document', pdfLabel)}</button>
      <button type="button" class="kiosk-btn" data-act="copy" data-id="${work.id}">${buttonMarkup('link', 'Copy URL')}</button>
      <button type="button" class="kiosk-btn" data-act="open-window" data-id="${work.id}">${buttonMarkup('arrowUpRight', 'Open in New Tab')}</button>
    </div>
    <footer>
      <button type="button" class="kiosk-btn" data-act="back">${buttonMarkup('eye', 'Back to Works')}</button>
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
    btn.innerHTML = buttonMarkup(playing ? 'pause' : 'play', playing ? 'Pause' : 'Play');
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
  btn.innerHTML = active
    ? buttonMarkup('arrowsPointingIn', 'Exit Fullscreen')
    : buttonMarkup('arrowsPointingOut', 'Fullscreen');
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
    <button type="button" data-act="theme">${buttonMarkup('sparkles', 'Theme')}</button>
    <button type="button" data-act="fullscreen" aria-pressed="false">${buttonMarkup('arrowsPointingOut', 'Fullscreen')}</button>
    <button type="button" data-act="reset">${buttonMarkup('arrowPath', 'Reset')}</button>`;
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
      hideDetail();
      hidePdfPane();
      stopAttractPreview();
      if (document.fullscreenElement) document.exitFullscreen?.();
      const first = state.tiles[0];
      first?.focus();
      announce('Kiosk reset');
    }
  });
  state.controls = {
    root: ctl,
    fullscreen: ctl.querySelector('[data-act="fullscreen"]')
  };
  updateFullscreenButton();
}

function optionSectionMarkup({ title, name, current, options }) {
  const rows = options.map((option) => {
    const id = `kiosk-operator-${name}-${option.value}`;
    return `<div class="kiosk-operator-option">
      <input id="${id}" type="radio" name="${name}" value="${option.value}" ${current === option.value ? 'checked' : ''}>
      <div>
        <label for="${id}">${esc(option.label)}</label>
        <p class="kiosk-operator-note">${esc(option.note)}</p>
      </div>
    </div>`;
  }).join('');
  return `<section class="kiosk-operator-section">
    <h3>${esc(title)}</h3>
    <div class="kiosk-operator-options">${rows}</div>
  </section>`;
}

function renderOperatorMenu() {
  const menuBody = state.operator.body;
  if (!menuBody) return;
  const settings = state.operator.settings;
  menuBody.innerHTML = [
    optionSectionMarkup({
      title: 'Attract Mode',
      name: 'attractMode',
      current: settings.attractMode,
      options: [
        { value: 'off', label: 'Off', note: 'Disables attract cycling and auto previews.' },
        { value: 'visual-only', label: 'Visual-only', note: 'Highlights tiles with no audio playback.' },
        { value: 'visual-muted', label: 'Visual + Muted Preview', note: 'Cycles highlights and short muted previews.' },
        { value: 'full-autoplay', label: 'Full Autoplay', note: 'Cycles highlights and audible auto preview playback.' },
      ],
    }),
    optionSectionMarkup({
      title: 'Density Preset',
      name: 'density',
      current: settings.density,
      options: [
        { value: 'comfort', label: 'Comfort', note: 'Largest tiles and wider spacing for distance reading.' },
        { value: 'balanced', label: 'Balanced', note: 'Default blend of readability and count.' },
        { value: 'dense', label: 'Dense', note: 'Smaller tiles for more works per view.' },
      ],
    }),
    optionSectionMarkup({
      title: 'Motion Preset',
      name: 'motion',
      current: settings.motion,
      options: [
        { value: 'low', label: 'Low', note: 'Reduced movement and shorter transitions.' },
        { value: 'standard', label: 'Standard', note: 'Default motion profile for kiosks.' },
        { value: 'high', label: 'High', note: 'Extended transitions and more kinetic feel.' },
      ],
    }),
  ].join('');
}

function openOperatorMenu() {
  const menu = state.operator.menu;
  if (!menu) return;
  state.operator.open = true;
  menu.hidden = false;
  menu.setAttribute('aria-hidden', 'false');
  renderOperatorMenu();
  const firstInput = menu.querySelector('input');
  if (firstInput && typeof firstInput.focus === 'function') {
    requestAnimationFrame(() => firstInput.focus({ preventScroll: true }));
  }
}

function closeOperatorMenu() {
  const menu = state.operator.menu;
  if (!menu) return;
  state.operator.open = false;
  menu.hidden = true;
  menu.setAttribute('aria-hidden', 'true');
}

function toggleOperatorMenu() {
  if (state.operator.open) closeOperatorMenu();
  else openOperatorMenu();
}

function bindOperatorMenu() {
  const menu = document.getElementById('kiosk-operator');
  const body = document.getElementById('kiosk-operator-body');
  const hotspot = document.getElementById('kiosk-operator-hotspot');
  if (!menu || !body || !hotspot) return;
  const closeButton = menu.querySelector('[data-operator-close]');
  if (closeButton) {
    closeButton.innerHTML = icon('xMark');
  }
  state.operator.menu = menu;
  state.operator.body = body;
  state.operator.hotspot = hotspot;
  state.operator.settings = readOperatorSettings();
  applyOperatorSettings(state.operator.settings, { persist: false, resetAttract: false });
  renderOperatorMenu();

  hotspot.addEventListener('click', () => {
    toggleOperatorMenu();
    resetAttract();
  });
  hotspot.addEventListener('touchstart', () => {
    state.operator.touchTimer = setTimeout(() => {
      openOperatorMenu();
      resetAttract();
    }, 480);
  }, { passive: true });
  ['touchend', 'touchcancel', 'pointerup', 'pointercancel'].forEach((type) => {
    hotspot.addEventListener(type, () => {
      if (state.operator.touchTimer) {
        clearTimeout(state.operator.touchTimer);
        state.operator.touchTimer = null;
      }
    }, { passive: true });
  });

  menu.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('[data-operator-close]');
    if (closeBtn) {
      event.preventDefault();
      closeOperatorMenu();
      return;
    }
  });

  menu.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const name = target.name;
    const value = target.value;
    const next = { ...state.operator.settings };
    if (name === 'attractMode') next.attractMode = value;
    if (name === 'density') next.density = value;
    if (name === 'motion') next.motion = value;
    applyOperatorSettings(next, { persist: true, resetAttract: true });
    resetAttract();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!state.operator.open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menu.contains(target) || hotspot.contains(target)) return;
    closeOperatorMenu();
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    const openCombo = (event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'o' || event.key === 'O');
    if (openCombo) {
      event.preventDefault();
      toggleOperatorMenu();
      return;
    }
    if (event.key === 'Escape' && state.operator.open) {
      event.preventDefault();
      closeOperatorMenu();
    }
  });
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
  works.forEach((work, index) => {
    const tile = document.createElement('article');
    tile.className = 'kiosk-tile';
    tile.tabIndex = 0;
    tile.style.setProperty('--tile-index', String(index));
    tile.dataset.workId = work.id;
    tile.setAttribute('role', 'button');
    const ariaLabelBase = work.title || work.slug || 'work';
    const ariaLabel = work.onelinerEffective
      ? `Open ${ariaLabelBase} — ${work.onelinerEffective}`
      : `Open ${ariaLabelBase} details`;
    tile.setAttribute('aria-label', ariaLabel);
    applyTilePointerMotion(tile);
    const cues = Array.isArray(work.cues) ? work.cues : [];
    const tags = normalizeTagList(work.tags).slice(0, 4);
    const tagsHtml = tags.length
      ? `<div class="kiosk-tags">${tags.map((tag) => `<span class="kiosk-tag">${esc(tag)}</span>`).join('')}</div>`
      : '';
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
      ${coverMarkup(work, 'kiosk-cover')}
      <p class="kiosk-one">${esc(work.onelinerEffective || '')}</p>
      ${tagsHtml}
      ${cueHtml}
      <div class="kiosk-actions">
        <button type="button" class="kiosk-btn" data-act="play" data-id="${work.id}">${buttonMarkup('play', 'Play')}</button>
        <button type="button" class="kiosk-btn" data-act="pdf" data-id="${work.id}" ${work.pdf ? '' : 'disabled aria-disabled="true"'}>${buttonMarkup('document', 'Open Score')}</button>
        <button type="button" class="kiosk-btn" data-act="copy" data-id="${work.id}">${buttonMarkup('link', 'Copy URL')}</button>
        <button type="button" class="kiosk-btn" data-act="detail" data-id="${work.id}">${buttonMarkup('eye', 'Open')}</button>
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

function attractIntervalMs() {
  const motion = state.operator.settings.motion;
  if (motion === 'low') return 8200;
  if (motion === 'high') return 4200;
  return ATTRACT_INTERVAL;
}

function attractDelayMs() {
  const motion = state.operator.settings.motion;
  if (motion === 'low') return ATTRACT_DELAY + 18000;
  if (motion === 'high') return 36000;
  return ATTRACT_DELAY;
}

function playAttractPreview(id, muted) {
  const meta = findWorkById(id);
  const work = meta?.data;
  if (!work || !work.audio) {
    stopAttractPreview();
    return;
  }
  if (state.attractPreview.id === id && state.attractPreview.audio && !state.attractPreview.audio.paused) {
    return;
  }
  stopAttractPreview();
  const audio = ensureAudioFor(work);
  if (!audio) return;
  const raw = audio.getAttribute('data-audio') || work.audio || '';
  const src = normalizeSrc(raw);
  if (src && audio.src !== src) {
    audio.src = src;
  }
  pauseOthers(work.id);
  const start = () => {
    try { audio.currentTime = 0; } catch (_) {}
    audio.muted = !!muted;
    if (!muted) audio.volume = 1;
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {});
    }
    markTileState(work.id, { playing: true });
    state.attractPreview.id = work.id;
    state.attractPreview.audio = audio;
    if (muted) {
      state.attractPreview.cleanupTimer = setTimeout(() => {
        if (state.attractPreview.id === work.id) {
          stopAttractPreview();
        }
      }, 6800);
    }
  };
  if (audio.readyState >= 1) start();
  else {
    audio.addEventListener('loadedmetadata', start, { once: true });
    audio.load();
  }
}

function startAttract() {
  if (state.operator.settings.attractMode === 'off') return;
  if (state.detail.container && !state.detail.container.hasAttribute('hidden')) return;
  if (state.pdf.pane && state.pdf.pane.getAttribute('aria-hidden') === 'false') return;
  if (!state.tiles.length || state.attract.active) return;
  state.attract.active = true;
  document.body.classList.add('is-attract');
  state.attract.index = 0;
  highlightAttractTile();
  state.attract.loop = setInterval(() => {
    state.attract.index = (state.attract.index + 1) % state.tiles.length;
    highlightAttractTile();
  }, attractIntervalMs());
}

function highlightAttractTile() {
  const mode = state.operator.settings.attractMode;
  state.tiles.forEach((tile, idx) => {
    tile.classList.toggle('is-highlight', idx === state.attract.index);
  });
  const activeTile = state.tiles[state.attract.index];
  const activeId = Number(activeTile?.dataset.workId || 0);
  if (!activeId || mode === 'off' || mode === 'visual-only') {
    stopAttractPreview();
    return;
  }
  if (mode === 'visual-muted') {
    playAttractPreview(activeId, true);
    return;
  }
  if (mode === 'full-autoplay') {
    playAttractPreview(activeId, false);
  }
}

function stopAttract() {
  if (!state.attract.active) {
    stopAttractPreview();
    return;
  }
  state.attract.active = false;
  document.body.classList.remove('is-attract');
  clearInterval(state.attract.loop);
  state.attract.loop = null;
  state.tiles.forEach((tile) => tile.classList.remove('is-highlight'));
  stopAttractPreview();
}

function resetAttract() {
  stopAttract();
  clearTimeout(state.attract.timer);
  if (state.operator.settings.attractMode === 'off') return;
  state.attract.timer = setTimeout(startAttract, attractDelayMs());
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
    subtitle.textContent = site.subtitle || site.description || 'Touch Wall Mode';
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
  const branding = (PRAE.config && PRAE.config.branding) || {};
  const footer = document.getElementById('prae-footer');
  if (!footer) return;
  if (PRAE.branding && typeof PRAE.branding.renderFooter === 'function') {
    PRAE.branding.renderFooter(footer, { site, branding });
  }
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
      if (state.operator.open) {
        closeOperatorMenu();
      }
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
  if (close) {
    close.innerHTML = icon('xMark');
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
  state.modeChip = document.getElementById('kiosk-mode-chip');
  bindOperatorMenu();
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
