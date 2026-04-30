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
    if (doc.style) doc.style.colorScheme = eff === 'dark' ? 'dark' : 'light';
  }
  if (body) {
    body.classList.remove(...PRAE_THEME_CLASSNAMES);
    body.classList.add(eff === 'dark' ? PRAE_THEME_CLASSNAMES[1] : PRAE_THEME_CLASSNAMES[0]);
    body.setAttribute('data-theme', eff);
  }
  if (host) {
    host.classList.remove(...PRAE_THEME_CLASSNAMES);
    host.classList.add(eff === 'dark' ? PRAE_THEME_CLASSNAMES[1] : PRAE_THEME_CLASSNAMES[0]);
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
    btn.dataset.mode = eff;
    const icon = eff === 'dark' ? '☾' : '☀︎';
    const iconEl = btn.querySelector('.tf-theme-icon');
    if (iconEl) {
      iconEl.textContent = icon;
    } else {
      btn.textContent = icon;
    }
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.setAttribute('aria-pressed', eff === 'dark' ? 'true' : 'false');
    btn.setAttribute('title', eff === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  return eff;
}

function praeCurrentTheme() {
  const attr = document.body?.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
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

function formatClock(sec) {
  const value = Math.max(0, Math.floor(Number(sec) || 0));
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function cueTime(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const match = str.match(/^(\d+):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function normalizeSrc(url) {
  if (!url) return '';
  const str = String(url);
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return str;
}

function resolveWorkMedia(work) {
  if (praeMedia && typeof praeMedia.resolveWorkMedia === 'function') {
    try { return praeMedia.resolveWorkMedia(work || {}); } catch (_) {}
  }
  return {
    kind: 'score',
    audioUrl: work?.audioUrl || work?.audio || '',
    pdfUrl: work?.pdfUrl || work?.pdf || '',
    pageFollow: work?.pageFollow || work?.score || null,
    startAtSec: 0
  };
}

function normalizePdfUrl(url) {
  if (praeMedia && typeof praeMedia.normalizePdfUrl === 'function') {
    try { return praeMedia.normalizePdfUrl(url); } catch (_) {}
  }
  if (!url) return '';
  const str = String(url);
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) {
    return `https://drive.google.com/file/d/${match[1]}/view?usp=drivesdk`;
  }
  return str;
}

function choosePdfViewer(url) {
  if (praeMedia && typeof praeMedia.choosePdfViewer === 'function') {
    try {
      const chosen = praeMedia.choosePdfViewer(url);
      if (chosen) return chosen;
    } catch (_) {}
  }
  const str = String(url || '');
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : str;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

function setEmbedFrameMode(frame, mode) {
  if (!frame || typeof frame.setAttribute !== 'function') return;
  if (praeMedia && typeof praeMedia.setEmbedFrameMode === 'function') {
    try {
      praeMedia.setEmbedFrameMode(frame, mode);
      return;
    } catch (_) {}
  }
  frame.setAttribute('referrerpolicy', String(mode || '').toLowerCase() === 'youtube'
    ? 'strict-origin-when-cross-origin'
    : 'no-referrer');
}

const PDF_FIELD_CANDIDATES = [
  'pdfUrl', 'pdfURL', 'pdf', 'pdf_url', 'scorePdf', 'scorePDF', 'score_url', 'scoreUrl', 'score'
];

function getPdfSourceFrom(work) {
  if (!work || typeof work !== 'object') return '';
  for (const key of PDF_FIELD_CANDIDATES) {
    if (work[key]) return work[key];
  }
  const media = work.media || {};
  if (media.pdfUrl || media.pdfURL) return media.pdfUrl || media.pdfURL;
  if (media.pdf) return media.pdf;
  const files = work.files || {};
  if (files.pdfUrl || files.pdfURL) return files.pdfUrl || files.pdfURL;
  if (files.pdf) return files.pdf;
  const resources = Array.isArray(work.resources) ? work.resources : [];
  for (const item of resources) {
    if (!item) continue;
    const type = String(item.type || '').toLowerCase();
    if (type === 'pdf' && item.href) return item.href;
  }
  const links = Array.isArray(work.links) ? work.links : [];
  for (const link of links) {
    if (link?.href && /pdf/i.test(String(link.label || ''))) {
      return link.href;
    }
  }
  return '';
}

function getWorkExternalUrl(work) {
  if (!work || typeof work !== 'object') return '';
  const direct = work.externalUrl || work.externalURL || work.url || work.href || work.website;
  if (direct) return direct;
  if (work.meta?.href) return work.meta.href;
  const links = Array.isArray(work.links) ? work.links : [];
  for (const link of links) {
    if (link?.href) return link.href;
  }
  return '';
}

function workKey(work) {
  if (!work || typeof work !== 'object') return null;
  if (work.slug) return String(work.slug);
  if (work.id != null) return `id-${work.id}`;
  return null;
}

function isDrawerMode() {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 900px)').matches;
}

const PRAE = (window.PRAE = window.PRAE || {});
const PRAE_DATA = window.__PRAE_DATA__ || {};
const works = Array.isArray(PRAE_DATA.works)
  ? PRAE_DATA.works
  : (Array.isArray(PRAE.works) ? PRAE.works : []);
const praeMedia = PRAE && PRAE.media ? PRAE.media : null;
const pageFollowMaps = (() => {
  const provided = PRAE_DATA.pageFollowMaps || PRAE.pageFollowMaps || {};
  if (Object.keys(provided).length) return provided;
  const map = {};
  for (const work of works) {
    if (work?.slug && work.pageFollow) {
      map[work.slug] = work.pageFollow;
    }
  }
  return map;
})();

const state = {
  book: null,
  flow: null,
  header: null,
  currentTitleEl: null,
  pageNowEl: null,
  pageTotalEl: null,
  hudEl: null,
  themeLink: null,
  footerPlayEl: null,
  reduceMotion: false,
  sections: [],
  observer: null,
  activeWorkIndex: works.length ? 0 : -1,
  activeWorkKey: null,
  activeHasPdf: false,
  activeHasAudio: false,
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  currentAudioId: null,
  pdf: {
    root: null,
    frame: null,
    slot: null,
    fixedHeight: null,
    title: null,
    note: null,
    empty: null,
    openLink: null,
    live: null,
    toggle: null,
    close: null,
    viewerReady: false,
    pendingGoto: null,
    currentSlug: null,
    followAudio: null,
    followHandler: null,
    followSlug: null,
    lastPrinted: null,
    followToken: null,
    followSourceKind: 'audio',
    drawerOpen: false
  },
  youtube: { controller: null, workId: null, workSlug: null }
};

PRAE.hud = Object.assign({}, PRAE.hud || {}, {
  ensure: () => state.hudEl,
  setTitle: () => {},
  setSubtitle: () => {},
  setPlaying: (on) => {
    if (!on && state.hudEl) {
      state.hudEl.textContent = '';
      state.hudEl.hidden = true;
    }
  },
  setProgress: () => {},
  getRoot: () => state.hudEl
});

const worksById = new Map();

function findWorkById(id) {
  const num = Number(id);
  if (Number.isNaN(num)) return null;
  if (worksById.has(num)) return worksById.get(num);
  const data = works.find((item) => Number(item?.id) === num);
  if (!data) return null;
  const record = { data, audio: null };
  worksById.set(num, record);
  return record;
}

function ensureAudioTags() {
  if (typeof PRAE.ensureAudioTags === 'function') {
    try { PRAE.ensureAudioTags(); } catch (_) {}
  }
}

function getAudioSourceFor(work) {
  return resolveWorkMedia(work).audioUrl || '';
}

function ensureAudioFor(work) {
  if (!work || work.id == null) return null;
  let el = document.getElementById('wc-a' + work.id);
  if (!el) {
    el = document.createElement('audio');
    el.id = 'wc-a' + work.id;
    el.preload = 'none';
    el.playsInline = true;
    const src = resolveWorkMedia(work).audioUrl || getAudioSourceFor(work);
    if (src) el.setAttribute('data-audio', src);
    document.body.appendChild(el);
  }
  return el;
}

function pauseAllAudio(exceptId) {
  if (state.youtube.controller && state.youtube.workId != null && Number(state.youtube.workId) !== Number(exceptId)) {
    try { state.youtube.controller.pause(); } catch (_) {}
  }
  for (const work of works) {
    if (!work || work.id == null) continue;
    if (Number(work.id) === Number(exceptId)) continue;
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) audio.pause();
  }
  const active = getActiveWork();
  if (active && (exceptId == null || Number(active.id) !== Number(exceptId))) {
    updateFooterAudioControl();
  }
}

function updateHud(id, audio) {
  if (!state.hudEl) return;
  if (!audio || audio.paused || audio.ended) {
    state.hudEl.textContent = '';
    state.hudEl.hidden = true;
    updateFooterAudioControl(audio);
    return;
  }
  const record = findWorkById(id);
  const work = record?.data;
  const title = work?.title || work?.slug || `Work ${id}`;
  const current = formatClock(audio.currentTime || 0);
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? formatClock(audio.duration) : '--:--';
  const volume = Math.round((audio.volume ?? 1) * 100);
  const rate = (audio.playbackRate || 1).toFixed(2);
  state.hudEl.textContent = `Now playing — ${title} ${current} / ${duration} · vol ${volume}% · ${rate}x`;
  state.hudEl.hidden = false;
  updateFooterAudioControl(audio);
}

function updateHudYouTube(id, controller) {
  if (!state.hudEl) return;
  const record = findWorkById(id);
  const work = record?.data;
  const title = work?.title || work?.slug || `Work ${id}`;
  const current = controller && typeof controller.getCurrentTime === 'function'
    ? formatClock(controller.getCurrentTime() || 0)
    : '0:00';
  state.hudEl.textContent = `Now playing — ${title} ${current} / YouTube`;
  state.hudEl.hidden = false;
  updateFooterAudioControl();
}

function bindAudioToHud(id, audio) {
  if (!audio || audio.dataset.tfBound === '1') return;
  const update = () => updateHud(id, audio);
  const onPlay = () => {
    state.currentAudioId = id;
    state.hudState.last = { id, at: audio.currentTime || 0 };
    updateHud(id, audio);
    const record = findWorkById(id);
    const work = record?.data;
    if (work?.slug) attachPageFollow(work.slug, audio);
  };
  const onPause = () => {
    updateHud(id, audio);
    if (state.pdf.followAudio === audio) detachPageFollow();
  };
  const onEnded = () => {
    updateHud(id, audio);
    if (state.currentAudioId === id) {
      state.currentAudioId = null;
    }
    if (state.pdf.followAudio === audio) detachPageFollow();
  };
  audio.addEventListener('timeupdate', update, { passive: true });
  audio.addEventListener('ratechange', update, { passive: true });
  audio.addEventListener('volumechange', update, { passive: true });
  audio.addEventListener('loadedmetadata', update, { once: true });
  audio.addEventListener('play', onPlay, { passive: true });
  audio.addEventListener('pause', onPause, { passive: true });
  audio.addEventListener('ended', onEnded, { passive: true });
  audio.dataset.tfBound = '1';
}

function playAt(id, seconds = 0) {
  const record = findWorkById(id);
  const work = record?.data;
  if (!work) return;
  const media = resolveWorkMedia(work);
  const index = works.indexOf(work);
  if (index >= 0) {
    setActiveWork(index, { announce: false, scroll: false, updatePreview: false });
  }
  if (media.kind === 'youtube') {
    playYouTubeAt(work, seconds || media.startAtSec || 0, media);
    return;
  }
  syncPdfForWork(work, { seconds });
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  pauseAllAudio(work.id);
  state.hudState.last = { id: work.id, at: seconds || 0 };
  bindAudioToHud(work.id, audio);
  if (!audio.src) {
    const src = normalizeSrc(media.audioUrl || getAudioSourceFor(work));
    if (src) {
      audio.src = src;
      audio.load();
    }
  }
  const seekAndPlay = () => {
    try { audio.currentTime = Math.max(0, Number(seconds) || 0); } catch (_) {}
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };
  if (audio.readyState >= 1) {
    seekAndPlay();
  } else {
    audio.addEventListener('loadedmetadata', () => seekAndPlay(), { once: true });
  }
}

async function playYouTubeAt(work, seconds = 0, media = resolveWorkMedia(work)) {
  if (!work) return;
  if (!praeMedia || typeof praeMedia.mountYouTubePlayer !== 'function') {
    detachPageFollow();
    console.warn('YouTube runtime unavailable; opening tab and disabling score-follow sync');
    if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
      praeMedia.openYouTubeTab(work);
    }
    return;
  }
  pauseAllAudio(work.id);
  const normalized = normalizePdfUrl(getPdfSourceFrom(work));
  if (normalized) {
    showPdfForWork(work, { openDrawer: true, announce: false });
  } else {
    showNoPdfForWork(work, { announce: false });
  }
  const frame = ensurePreviewFrame(work.slug || workKey(work) || `work-${work.id}`, work, media.youtubeEmbedUrl || media.youtubeUrl || 'about:blank', 'youtube');
  if (!frame) {
    detachPageFollow();
    console.warn('YouTube preview frame unavailable; opening tab and disabling score-follow sync');
    if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
      praeMedia.openYouTubeTab(work);
    }
    return;
  }
  try {
    const controller = await praeMedia.mountYouTubePlayer(frame, work, {
      onError: (err) => {
        const code = Number(err?.code);
        console.warn(`YouTube embed blocked${Number.isFinite(code) ? ` (error ${code})` : ''}`);
        detachPageFollow();
        if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
          praeMedia.openYouTubeTab(work);
        }
      }
    });
    state.youtube.controller = controller;
    state.youtube.workId = work.id;
    state.youtube.workSlug = work.slug || null;
    const seek = Number.isFinite(Number(seconds)) ? Number(seconds) : Number(media.startAtSec || 0);
    if (typeof controller.seekTo === 'function') controller.seekTo(Math.max(0, seek));
    if (typeof controller.play === 'function') controller.play();
    state.hudState.last = { id: work.id, at: Math.max(0, seek) };
    attachYouTubePageFollow(work, controller);
    updateHudYouTube(work.id, controller);
  } catch (_) {
    detachPageFollow();
    console.warn('YouTube embed unavailable; opening tab and disabling score-follow sync');
    if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
      praeMedia.openYouTubeTab(work);
    }
  }
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    const value = String(text || '');
    if (!value) {
      resolve(false);
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => resolve(true)).catch(() => resolve(false));
      return;
    }
    const temp = document.createElement('textarea');
    temp.value = value;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(temp);
    resolve(ok);
  });
}


function ensurePdfDom() {
  if (state.pdf.root) {
    applyFixedPdfHeight();
    return state.pdf;
  }
  const root = document.getElementById('tf-preview');
  if (!root) return state.pdf;
  state.pdf.root = root;
  state.pdf.slot = root.querySelector('[data-preview-slot]');
  state.pdf.title = document.getElementById('tf-preview-title');
  state.pdf.note = document.getElementById('tf-preview-note');
  state.pdf.empty = document.getElementById('tf-preview-empty');
  state.pdf.openLink = document.getElementById('tf-preview-open');
  state.pdf.live = document.getElementById('tf-preview-live');
  state.pdf.toggle = document.getElementById('tf-preview-drawer-toggle');
  state.pdf.close = document.getElementById('tf-preview-close');
  if (state.pdf.toggle && state.pdf.toggle.dataset.bound !== '1') {
    state.pdf.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      const open = !document.body.classList.contains('tf-preview-open');
      setPreviewDrawer(open);
    });
    state.pdf.toggle.dataset.bound = '1';
  }
  if (state.pdf.close && state.pdf.close.dataset.bound !== '1') {
    state.pdf.close.addEventListener('click', (event) => {
      event.preventDefault();
      setPreviewDrawer(false);
      state.pdf.toggle?.focus?.();
    });
    state.pdf.close.dataset.bound = '1';
  }
  applyFixedPdfHeight();
  return state.pdf;
}

function markPreviewEmpty(isEmpty) {
  const pdf = ensurePdfDom();
  if (pdf.root) pdf.root.dataset.empty = isEmpty ? '1' : '0';
}

function setPreviewTitle(text) {
  const pdf = ensurePdfDom();
  if (pdf.title) pdf.title.textContent = text ? String(text) : 'Document preview';
}

function setPreviewNote(text) {
  const pdf = ensurePdfDom();
  if (!pdf.note) return;
  if (text) {
    pdf.note.textContent = String(text);
    pdf.note.hidden = false;
  } else {
    pdf.note.textContent = '';
    pdf.note.hidden = true;
  }
}

function setPreviewLink(url, label) {
  const pdf = ensurePdfDom();
  const link = pdf.openLink;
  if (!link) return;
  if (url) {
    link.href = url;
    link.textContent = label || 'Open PDF';
    link.hidden = false;
  } else {
    link.hidden = true;
  }
}

function applyFixedPdfHeight() {
  const { slot, fixedHeight } = state.pdf;
  if (!slot) return;
  if (typeof fixedHeight === 'number') {
    slot.style.minHeight = `${fixedHeight}px`;
  }
}

function lockPdfFrameSize() {
  const pdf = ensurePdfDom();
  const { slot, fixedHeight } = pdf;
  if (!slot || typeof fixedHeight === 'number') return;
  const rect = slot.getBoundingClientRect();
  const height = Math.round(rect.height || 0);
  if (height > 0) {
    pdf.fixedHeight = height;
    applyFixedPdfHeight();
  }
}

function announcePreview(text) {
  const pdf = ensurePdfDom();
  if (!pdf.live) return;
  pdf.live.textContent = '';
  if (text) pdf.live.textContent = String(text);
}

function setPreviewDrawer(open) {
  const pdf = ensurePdfDom();
  if (!pdf.root) return;
  const body = document.body;
  if (!isDrawerMode()) {
    body?.classList.remove('tf-preview-open');
    pdf.root.setAttribute('aria-hidden', 'false');
    pdf.drawerOpen = false;
    if (pdf.toggle) pdf.toggle.setAttribute('aria-expanded', 'false');
    return;
  }
  const next = !!open;
  pdf.drawerOpen = next;
  if (next) {
    body?.classList.add('tf-preview-open');
  } else {
    body?.classList.remove('tf-preview-open');
  }
  if (pdf.toggle) pdf.toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
  pdf.root.setAttribute('aria-hidden', next ? 'false' : 'true');
}

function syncPreviewForViewport() {
  const pdf = ensurePdfDom();
  if (!pdf.root) return;
  if (isDrawerMode()) {
    const open = document.body.classList.contains('tf-preview-open');
    pdf.root.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (pdf.toggle) pdf.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  } else {
    pdf.root.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('tf-preview-open');
    if (pdf.toggle) pdf.toggle.setAttribute('aria-expanded', 'false');
  }
}

function ensurePreviewFrame(slug, work, viewerUrl, mode = 'pdf') {
  const pdf = ensurePdfDom();
  if (!pdf.slot) return null;
  let frame = state.pdf.frame;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.className = 'tf-preview-frame';
    frame.loading = 'lazy';
    frame.allow = 'autoplay; fullscreen';
    frame.referrerPolicy = 'no-referrer';
    frame.addEventListener('load', () => {
      if (state.pdf.frame !== frame) return;
      state.pdf.viewerReady = true;
      const pending = state.pdf.pendingGoto;
      if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
        gotoPdfPage(pending.pdfPage);
        state.pdf.pendingGoto = null;
      }
      lockPdfFrameSize();
    });
    pdf.slot.appendChild(frame);
    state.pdf.frame = frame;
    if (typeof state.pdf.fixedHeight !== 'number') {
      requestAnimationFrame(() => lockPdfFrameSize());
    } else {
      applyFixedPdfHeight();
    }
  }
  frame.dataset.slug = slug;
  frame.title = `${work.title || work.slug || 'Score'} (PDF)`;
  setEmbedFrameMode(frame, mode);
  frame.removeAttribute('hidden');
  const currentSrc = frame.getAttribute('src') || '';
  if (currentSrc !== viewerUrl) {
    state.pdf.viewerReady = false;
    frame.src = viewerUrl;
  } else if (state.pdf.viewerReady) {
    const pending = state.pdf.pendingGoto;
    if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
      gotoPdfPage(pending.pdfPage);
      state.pdf.pendingGoto = null;
    }
    if (typeof state.pdf.fixedHeight !== 'number') {
      requestAnimationFrame(() => lockPdfFrameSize());
    }
  }
  return frame;
}

function showPdfForWork(work, { openDrawer = false, announce = true } = {}) {
  const pdf = ensurePdfDom();
  if (!work || !pdf.root) return;
  const normalized = normalizePdfUrl(getPdfSourceFrom(work));
  if (!normalized) {
    showNoPdfForWork(work);
    return;
  }
  markPreviewEmpty(false);
  if (pdf.empty) pdf.empty.hidden = true;
  setPreviewNote('');
  setPreviewTitle(work.title || work.slug || 'Score');
  setPreviewLink(normalized, 'Open PDF');
  const slug = workKey(work) || `work-${work.id ?? Date.now()}`;
  const viewerUrl = choosePdfViewer(normalized);
  ensurePreviewFrame(slug, work, viewerUrl);
  state.pdf.currentSlug = work.slug || slug;
  state.pdf.pendingGoto = null;
  detachPageFollow();
  if (work.slug && state.youtube.controller && state.youtube.workId === work.id && typeof state.youtube.controller.getCurrentTime === 'function') {
    attachYouTubePageFollow(work, state.youtube.controller);
  } else if (work.slug) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) attachPageFollow(work.slug, audio);
  }
  if (announce) {
    announcePreview(`Now viewing: ${work.title || work.slug || 'score'} PDF`);
  }
  if (openDrawer && isDrawerMode()) {
    setPreviewDrawer(true);
  }
}

function showNoPdfForWork(work, { announce = true } = {}) {
  if (state.youtube.controller && (!work || state.youtube.workId !== work.id) && typeof state.youtube.controller.pause === 'function') {
    try { state.youtube.controller.pause(); } catch (_) {}
    state.youtube.controller = null;
    state.youtube.workId = null;
    state.youtube.workSlug = null;
  }
  const pdf = ensurePdfDom();
  if (!pdf.root) return;
  const title = work?.title || work?.slug || 'this work';
  markPreviewEmpty(true);
  if (pdf.empty) {
    pdf.empty.textContent = 'No PDF available.';
    pdf.empty.hidden = false;
  }
  setPreviewTitle(title || 'Document preview');
  setPreviewNote(`No PDF for “${title}”.`);
  const external = getWorkExternalUrl(work);
  if (external) {
    setPreviewLink(external, 'View work');
  } else {
    setPreviewLink('', '');
  }
  if (state.pdf.frame) {
    state.pdf.frame.setAttribute('hidden', '');
  }
  state.pdf.viewerReady = false;
  state.pdf.currentSlug = null;
  state.pdf.pendingGoto = null;
  detachPageFollow();
  if (announce) {
    announcePreview(`Now viewing: ${title}. No PDF available.`);
  }
}

function showPreviewPlaceholder() {
  if (state.youtube.controller && typeof state.youtube.controller.pause === 'function') {
    try { state.youtube.controller.pause(); } catch (_) {}
    state.youtube.controller = null;
    state.youtube.workId = null;
    state.youtube.workSlug = null;
  }
  const pdf = ensurePdfDom();
  if (!pdf.root) return;
  markPreviewEmpty(true);
  setPreviewTitle('Document preview');
  setPreviewNote('');
  if (pdf.empty) {
    pdf.empty.textContent = 'No PDFs available.';
    pdf.empty.hidden = false;
  }
  setPreviewLink('', '');
  if (state.pdf.frame) {
    state.pdf.frame.setAttribute('hidden', '');
  }
  state.pdf.currentSlug = null;
  state.pdf.viewerReady = false;
  state.pdf.pendingGoto = null;
  detachPageFollow();
  announcePreview('Now viewing: Document preview. No PDF available.');
}

function initializePreview() {
  if (!works.length) {
    state.activeWorkIndex = -1;
    state.activeWorkKey = null;
    state.activeHasPdf = false;
    state.activeHasAudio = false;
    showPreviewPlaceholder();
    updateFooterCounter();
    updateFooterAudioControl();
    updateHeaderCurrent(null);
    return;
  }
  setActiveWork(0, { force: true, announce: false });
}

function updatePreviewForWork(work, options = {}) {
  if (!work) {
    showPreviewPlaceholder();
    return;
  }
  const key = workKey(work);
  const normalized = normalizePdfUrl(getPdfSourceFrom(work));
  if (normalized) {
    const slug = work.slug || key;
    if (state.pdf.currentSlug === slug && state.pdf.frame) {
      setPreviewNote('');
      markPreviewEmpty(false);
      return;
    }
    showPdfForWork(work, options);
  } else {
    showNoPdfForWork(work, options);
  }
}

function gotoPdfPage(pageNum) {
  const frame = state.pdf.frame;
  if (!frame || !frame.src) return;
  if (!/\/viewer\.html/i.test(frame.src)) return;
  try {
    const url = new URL(frame.src, location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const next = Number(pageNum || 1);
    const current = Number(hash.get('page') || '1');
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
  if (praeMedia && typeof praeMedia.printedPageForTime === 'function') {
    try { return praeMedia.printedPageForTime(cfg, tSec || 0); } catch (_) {}
  }
  const time = (tSec || 0) + (cfg.mediaOffsetSec || 0);
  let current = cfg.pageMap?.[0]?.page ?? 1;
  for (const row of cfg.pageMap || []) {
    const at = typeof row.at === 'number' ? row.at : cueTime(row.at);
    if (time >= at) current = row.page;
    else break;
  }
  return current;
}

function computePdfPage(slug, tSec) {
  const cfg = pageFollowMaps?.[slug];
  if (!cfg) return 1;
  if (praeMedia && typeof praeMedia.computePdfPage === 'function') {
    try { return praeMedia.computePdfPage(cfg, tSec || 0); } catch (_) {}
  }
  const printed = printedPageForTime(cfg, tSec || 0);
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
}

function detachPageFollow() {
  if (state.pdf.followToken && typeof state.pdf.followToken.detach === 'function') {
    try { state.pdf.followToken.detach(); } catch (_) {}
  }
  if (state.pdf.followAudio && state.pdf.followHandler) {
    state.pdf.followAudio.removeEventListener('timeupdate', state.pdf.followHandler);
    state.pdf.followAudio.removeEventListener('seeking', state.pdf.followHandler);
  }
  state.pdf.followAudio = null;
  state.pdf.followHandler = null;
  state.pdf.followSlug = null;
  state.pdf.lastPrinted = null;
  state.pdf.followToken = null;
  state.pdf.followSourceKind = 'audio';
}

function attachPageFollow(slug, audio) {
  detachPageFollow();
  if (!slug || !audio) return;
  const work = works.find((w) => w && w.slug === slug) || null;
  if (praeMedia && typeof praeMedia.attachPageFollow === 'function' && work) {
    state.pdf.followAudio = audio;
    state.pdf.followSlug = slug;
    state.pdf.followToken = praeMedia.attachPageFollow(work, { kind: 'audio', audio });
    state.pdf.followSourceKind = 'audio';
    if (state.pdf.followToken && typeof state.pdf.followToken.tick === 'function') {
      try { state.pdf.followToken.tick(); } catch (_) {}
    }
    return;
  }
  const cfg = pageFollowMaps?.[slug];
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
  state.pdf.followToken = null;
  state.pdf.followSourceKind = 'audio';
  audio.addEventListener('timeupdate', handler, { passive: true });
  audio.addEventListener('seeking', handler, { passive: true });
  handler();
}

function attachYouTubePageFollow(work, controller) {
  detachPageFollow();
  if (!work || !controller || !praeMedia || typeof praeMedia.attachPageFollow !== 'function') return;
  state.pdf.followSlug = work.slug || null;
  state.pdf.followToken = praeMedia.attachPageFollow(work, { kind: 'youtube', controller });
  state.pdf.followSourceKind = 'youtube';
  if (state.pdf.followToken && typeof state.pdf.followToken.tick === 'function') {
    try { state.pdf.followToken.tick(); } catch (_) {}
  }
}

function getPageFollowSeconds() {
  if (state.pdf.followSourceKind === 'youtube' && state.youtube.controller && typeof state.youtube.controller.getCurrentTime === 'function') {
    try { return Number(state.youtube.controller.getCurrentTime() || 0); } catch (_) { return 0; }
  }
  return Number(state.pdf.followAudio?.currentTime || 0);
}

function openPdfFor(workOrId) {
  const work = typeof workOrId === 'object' && workOrId
    ? workOrId
    : findWorkById(workOrId)?.data;
  if (!work) return;
  const key = workKey(work);
  const index = works.findIndex((item, idx) => {
    if (item === work) return true;
    const itemKey = workKey(item);
    return itemKey && key && itemKey === key;
  });
  if (index >= 0) {
    setActiveWork(index, { force: true, announce: true, openDrawer: true, scroll: true, updatePreview: true });
  } else {
    showPdfForWork(work, { openDrawer: true, announce: true });
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


function applySiteInfo() {
  const site = PRAE.config?.site || {};
  const branding = PRAE.config?.branding || {};
  const nameParts = [site.fullName, [site.firstName, site.lastName].filter(Boolean).join(' ')].filter(Boolean);
  const fallbackName = nameParts[0] || nameParts[1] || site.title || site.copyrightName || 'Praetorius';
  const title = fallbackName.trim();
  document.querySelectorAll('[data-site-title]').forEach((el) => {
    el.textContent = title;
  });
  const foot = document.querySelector('[data-site-footnote]');
  if (foot) {
    const year = new Date().getFullYear();
    const copyName = site.copyrightName || title;
    let text = copyName ? `© ${year} ${copyName}` : `© ${year}`;
    if (site.updated) {
      if (site.updated.mode === 'manual' && site.updated.value) {
        text += ` · Updated ${site.updated.value}`;
      } else if (site.updated.mode === 'auto') {
        text += ` · Updated ${new Date().toLocaleDateString()}`;
      }
    }
    foot.textContent = text;
  }
  const brandSlot = document.getElementById('tf-foot-brand');
  if (brandSlot) {
    brandSlot.innerHTML = '';
    const attributionEnabled = !(branding.attribution && branding.attribution.enabled === false);
    if (attributionEnabled) {
      const powered = document.createElement('a');
      powered.className = 'prae-brand-powered';
      powered.href = 'https://www.npmjs.com/package/praetorius';
      powered.target = '_blank';
      powered.rel = 'noopener noreferrer';
      const prefix = document.createElement('span');
      prefix.className = 'prae-brand-powered-prefix';
      prefix.textContent = 'Powered by';
      const lockup = document.createElement('span');
      lockup.className = 'prae-brand-lockup';
      const markSvg = PRAE.branding?.markSvg ? PRAE.branding.markSvg() : '';
      lockup.innerHTML = `${markSvg}<span class="prae-brand-wordmark">Praetorius</span>`;
      powered.append(prefix, lockup);
      brandSlot.append(powered);
    }
  }
}

function createCueLink(work, cue) {
  const link = document.createElement('a');
  link.href = '#';
  const seconds = cueTime(typeof cue === 'object' ? (cue.t ?? cue.time ?? cue.at ?? cue.label) : cue);
  const label = typeof cue === 'object' && cue.label ? cue.label : `@${formatClock(seconds)}`;
  link.textContent = label.startsWith('@') ? label : `@${label}`;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    playAt(work.id, seconds || 0);
  });
  return link;
}

function getWorkTimestamp(work) {
  if (!work || typeof work !== 'object') return '';
  const meta = work.meta || {};
  const candidates = [
    work.timestamp,
    work.time,
    work.date,
    work.year,
    meta.timestamp,
    meta.time,
    meta.date
  ];
  for (const value of candidates) {
    if (value) return String(value);
  }
  return '';
}

function createWorkSection(work, index) {
  const section = document.createElement('section');
  section.className = 'tf-work';
  const slugKey = work.slug ? String(work.slug) : `work-${work.id || index + 1}`;
  section.id = `work-${slugKey}`.replace(/[^a-z0-9\-]+/gi, '-');
  if (work.id != null) section.dataset.workId = String(work.id);
  if (work.title) section.dataset.workTitle = String(work.title);
  const pdfCandidate = normalizePdfUrl(getPdfSourceFrom(work));
  const timestampText = getWorkTimestamp(work);
  let activationTrigger = null;
  const title = document.createElement('h1');
  title.className = 'tf-title';
  title.textContent = work.title || work.slug || `Work ${index + 1}`;
  section.appendChild(title);
  if (work.slug) {
    const slug = document.createElement('p');
    slug.className = 'tf-slug';
    slug.textContent = String(work.slug);
    section.appendChild(slug);
  }
  const metaItems = [];
  if (timestampText) {
    const stamp = document.createElement('button');
    stamp.type = 'button';
    stamp.className = 'tf-timestamp';
    stamp.textContent = timestampText;
    stamp.setAttribute('data-timestamp', '1');
    const label = work.title || work.slug || `Work ${index + 1}`;
    stamp.setAttribute('aria-label', `Activate ${label} (${timestampText})`);
    activationTrigger = stamp;
    metaItems.push(stamp);
  }
  if (pdfCandidate) {
    const score = document.createElement('a');
    score.href = '#';
    score.textContent = 'Score';
    score.addEventListener('click', (event) => {
      event.preventDefault();
      openPdfFor(work);
    });
    metaItems.push(score);
  }
  const allowCopy = !!(work.id != null);
  if (allowCopy) {
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.textContent = 'Link';
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const url = new URL(location.href);
      url.hash = section.id ? `#${section.id}` : '';
      const ok = await copyToClipboard(url.toString());
      if (!ok) {
        let fallback = section.querySelector('.tf-copy-fallback');
        if (!fallback) {
          fallback = document.createElement('small');
          fallback.className = 'tf-copy-fallback';
          section.appendChild(fallback);
        }
        fallback.textContent = url.toString();
      }
    });
    metaItems.push(link);
  }
  if (metaItems.length) {
    const meta = document.createElement('p');
    meta.className = 'tf-meta';
    metaItems.forEach((node, idx) => {
      if (idx > 0) meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(node);
    });
    section.appendChild(meta);
  }
  const leadText = work.onelinerEffective || work.lead || '';
  if (leadText) {
    const lead = document.createElement('p');
    lead.className = 'tf-lead';
    lead.textContent = String(leadText);
    section.appendChild(lead);
  }
  const cues = Array.isArray(work.cues) ? work.cues : [];
  if (cues.length) {
    const cuesRow = document.createElement('p');
    cuesRow.className = 'tf-cues';
    cues.forEach((cue, idx) => {
      if (idx > 0) cuesRow.appendChild(document.createTextNode(' '));
      cuesRow.appendChild(createCueLink(work, cue));
    });
    section.appendChild(cuesRow);
  }
  const notes = [];
  if (Array.isArray(work.openNote)) {
    notes.push(...work.openNote);
  } else if (work.openNote) {
    notes.push(work.openNote);
  }
  const desc = work.descriptionEffective ? [work.descriptionEffective] : [];
  const paragraphs = [...notes, ...desc];
  paragraphs.forEach((block) => {
    const text = String(block ?? '').trim();
    if (!text) return;
    const p = document.createElement('p');
    p.textContent = text;
    section.appendChild(p);
  });
  return { section, heading: title, activationTrigger };
}

function bindSectionActivation(section, index) {
  if (!section) return;
  section.dataset.activatable = '1';
  section.dataset.active = section.dataset.active || '0';
  if (!section.hasAttribute('tabindex')) section.tabIndex = 0;
  section.setAttribute('role', 'button');
  section.setAttribute('aria-pressed', 'false');
  const isInteractiveTarget = (target) => {
    return !!target.closest('a, button, audio, video, input, textarea, select, label');
  };
  section.addEventListener('click', (event) => {
    if (isInteractiveTarget(event.target) && event.target !== section) return;
    setActiveWork(index, { announce: true, updatePreview: false });
  });
  section.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (isInteractiveTarget(event.target) && event.target !== section) return;
      event.preventDefault();
      setActiveWork(index, { announce: true, updatePreview: false });
    }
  });
}

function getActiveWork() {
  if (state.activeWorkIndex < 0) return null;
  return works[state.activeWorkIndex] || null;
}

function updateFooterCounter() {
  const total = works.length;
  if (state.pageTotalEl) state.pageTotalEl.textContent = String(total);
  const current = state.activeWorkIndex >= 0 ? state.activeWorkIndex + 1 : 0;
  if (state.pageNowEl) state.pageNowEl.textContent = String(current);
}

function updateActiveSectionHighlight() {
  state.sections.forEach(({ section, trigger }, idx) => {
    const active = idx === state.activeWorkIndex;
    if (section) {
      section.dataset.active = active ? '1' : '0';
      if (section.dataset.activatable === '1') {
        section.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }
    if (trigger) {
      trigger.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  });
}

function previewMatchesWork(work) {
  if (!work) return false;
  const slug = work.slug || workKey(work);
  if (!slug) return false;
  return state.pdf.currentSlug === slug;
}

function syncPdfForWork(work, { seconds = 0, openDrawer = false } = {}) {
  if (!work) return;
  const normalized = normalizePdfUrl(getPdfSourceFrom(work));
  if (!normalized) return;
  if (!previewMatchesWork(work)) {
    updatePreviewForWork(work, { openDrawer, announce: false });
  }
  const slug = work.slug || workKey(work);
  if (!slug) return;
  const rawTime = Number(seconds);
  const time = Number.isFinite(rawTime) ? rawTime : 0;
  const pdfPage = computePdfPage(slug, time);
  if (!Number.isFinite(pdfPage)) return;
  const detail = { slug, pdfPage };
  const follow = pageFollowMaps?.[slug];
  if (follow) {
    detail.printedPage = printedPageForTime(follow, time);
  }
  window.dispatchEvent(new CustomEvent('wc:pdf-goto', { detail }));
}

function announceActiveWork(work) {
  if (!work) {
    announcePreview('No work selected.');
    return;
  }
  const label = work.title || work.slug || `Work ${state.activeWorkIndex + 1}`;
  if (state.activeHasPdf) {
    if (previewMatchesWork(work)) {
      announcePreview(`Now viewing: ${label} PDF`);
    } else {
      announcePreview(`Selected ${label}. PDF preview unchanged.`);
    }
  } else {
    announcePreview(`Selected ${label}. No PDF available.`);
  }
}

function updateFooterAudioControl(activeAudio) {
  const btn = state.footerPlayEl;
  if (!btn) return;
  const work = getActiveWork();
  if (!work) {
    btn.hidden = true;
    btn.disabled = true;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = 'Play ▷';
    return;
  }
  const label = work.title || work.slug || `Work ${state.activeWorkIndex + 1}`;
  const media = resolveWorkMedia(work);
  const playable = media.kind === 'youtube' || !!getAudioSourceFor(work);
  state.activeHasAudio = playable;
  if (!playable) {
    btn.hidden = false;
    btn.disabled = true;
    btn.classList.add('tf-foot-play--disabled');
    btn.textContent = 'Play ▷';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `Audio not available for ${label}`);
    return;
  }
  const audio = activeAudio || document.getElementById('wc-a' + work.id) || null;
  const playing = (media.kind === 'youtube' && state.youtube.controller && state.youtube.workId === work.id
    && typeof state.youtube.controller.isPlaying === 'function' && state.youtube.controller.isPlaying())
    || (audio ? !audio.paused && !audio.ended : false);
  btn.hidden = false;
  btn.disabled = false;
  btn.classList.toggle('tf-foot-play--disabled', false);
  btn.textContent = playing ? 'Pause Ⅱ' : (media.kind === 'youtube' ? 'Play YouTube ▷' : 'Play ▷');
  btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  const noun = media.kind === 'youtube' ? 'YouTube' : 'audio';
  btn.setAttribute('aria-label', playing ? `Pause ${noun} for ${label}` : `Play ${noun} for ${label}`);
}

function toggleActiveAudio() {
  const work = getActiveWork();
  if (!work) return;
  const media = resolveWorkMedia(work);
  if (media.kind === 'youtube') {
    const controller = state.youtube.controller;
    if (controller && state.youtube.workId === work.id && typeof controller.isPlaying === 'function' && controller.isPlaying()) {
      try { controller.pause(); } catch (_) {}
    } else {
      playYouTubeAt(work, getPageFollowSeconds() || media.startAtSec || 0, media);
    }
    updateFooterAudioControl();
    return;
  }
  const src = media.audioUrl || getAudioSourceFor(work);
  if (!src) {
    updateFooterAudioControl();
    return;
  }
  let audio = document.getElementById('wc-a' + work.id);
  if (!audio) audio = ensureAudioFor(work);
  if (!audio) return;
  if (!audio.src) {
    const normalized = normalizeSrc(src);
    if (normalized) {
      audio.src = normalized;
      audio.load();
    }
  }
  if (audio.paused || audio.ended) {
    const resumeAt = audio.currentTime || (state.hudState.last?.id === work.id ? state.hudState.last.at : 0) || 0;
    playAt(work.id, resumeAt);
  } else {
    audio.pause();
  }
  updateFooterAudioControl(audio);
}

function setActiveWork(index, { force = false, scroll = false, announce = true, openDrawer = false, updatePreview = true } = {}) {
  if (!works.length) return;
  const clamped = Math.min(works.length - 1, Math.max(0, index));
  if (!force && state.activeWorkIndex === clamped) {
    if (openDrawer && updatePreview && state.activeHasPdf && isDrawerMode()) {
      setPreviewDrawer(true);
    }
    updateFooterAudioControl();
    return;
  }
  state.activeWorkIndex = clamped;
  const work = works[clamped];
  state.activeWorkKey = workKey(work);
  const media = resolveWorkMedia(work);
  state.activeHasPdf = !!normalizePdfUrl(getPdfSourceFrom(work));
  state.activeHasAudio = media.kind === 'youtube' || !!getAudioSourceFor(work);
  updateActiveSectionHighlight();
  updateHeaderCurrent(work?.title || work?.slug || null);
  updateFooterCounter();
  updateFooterAudioControl();
  if (updatePreview) {
    updatePreviewForWork(work, { openDrawer, announce: false });
  }
  if (announce) announceActiveWork(work);
  if (scroll && state.sections[clamped]?.section) {
    const target = state.sections[clamped].section;
    const behavior = state.reduceMotion ? 'auto' : 'smooth';
    target.scrollIntoView({ behavior, block: 'start' });
  }
}

function renderBook() {
  if (!state.flow) return;
  state.flow.innerHTML = '';
  state.sections = [];
  if (!works.length) {
    const p = document.createElement('p');
    p.textContent = 'No works available.';
    state.flow.appendChild(p);
    return;
  }
  works.forEach((work, index) => {
    const { section, heading, activationTrigger } = createWorkSection(work, index);
    section.dataset.active = '0';
    state.flow.appendChild(section);
    if (activationTrigger) {
      activationTrigger.dataset.index = String(index);
      activationTrigger.setAttribute('aria-pressed', 'false');
      activationTrigger.addEventListener('click', () => {
        setActiveWork(index, { announce: true, updatePreview: false });
        syncPdfForWork(work, { seconds: 0 });
      });
    } else {
      bindSectionActivation(section, index);
    }
    state.sections.push({ work, section, heading, trigger: activationTrigger });
  });
}

function updateHeaderCurrent(title) {
  if (!state.header || !state.currentTitleEl) return;
  if (title) {
    state.currentTitleEl.textContent = title;
    state.header.dataset.hasCurrent = '1';
  } else {
    state.currentTitleEl.textContent = '';
    state.header.dataset.hasCurrent = '0';
  }
}

function observeCurrentWork() {
  if (!state.book || !state.sections.length) return;
  if (state.observer) {
    state.observer.disconnect();
  }
  const callback = (entries) => {
    let candidate = null;
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        candidate = entry.target;
        break;
      }
    }
    if (!candidate) {
      const visible = state.sections.find(({ heading }) => {
        const rect = heading.getBoundingClientRect();
        const parent = state.book.getBoundingClientRect();
        return rect.top >= parent.top && rect.bottom <= parent.bottom;
      });
      if (visible) candidate = visible.heading;
    }
    if (candidate) {
      const owner = state.sections.find((item) => item.heading === candidate);
      const index = owner ? state.sections.indexOf(owner) : -1;
      if (index >= 0) {
        setActiveWork(index, { announce: false, updatePreview: false });
      }
    }
  };
  state.observer = new IntersectionObserver(callback, {
    root: state.book,
    threshold: [0.5]
  });
  state.sections.forEach(({ heading }) => {
    if (heading) state.observer.observe(heading);
  });
}

function onKeydown(event) {
  if (event.defaultPrevented) return;
  if (event.key === 'Escape') {
    if (isDrawerMode() && document.body.classList.contains('tf-preview-open')) {
      setPreviewDrawer(false);
      event.preventDefault();
      return;
    }
  }
  if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    setActiveWork(state.activeWorkIndex + 1, { scroll: true, announce: true, updatePreview: false });
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    setActiveWork(state.activeWorkIndex - 1, { scroll: true, announce: true, updatePreview: false });
  }
}

function bindEvents() {
  window.addEventListener('resize', () => {
    syncPreviewForViewport();
  }, { passive: true });
  document.addEventListener('keydown', onKeydown);
}

function init() {
  document.documentElement.dataset.skin = 'typefolio';
  state.reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.book = document.getElementById('tf-book');
  state.flow = document.getElementById('tf-flow');
  state.header = document.getElementById('tf-head');
  state.currentTitleEl = document.getElementById('tf-current-title');
  state.pageNowEl = document.getElementById('tf-page-now');
  state.pageTotalEl = document.getElementById('tf-page-total');
  state.hudEl = document.getElementById('tf-hud');
  state.themeLink = document.getElementById('wc-theme-toggle');
  state.footerPlayEl = document.getElementById('tf-foot-play');
  applySiteInfo();
  ensureAudioTags();
  renderBook();
  ensurePdfDom();
  initializePreview();
  observeCurrentWork();
  syncPreviewForViewport();
  bindEvents();
  updateFooterCounter();
  updateActiveSectionHighlight();
  if (state.footerPlayEl && !state.footerPlayEl.dataset.bound) {
    state.footerPlayEl.addEventListener('click', (event) => {
      event.preventDefault();
      toggleActiveAudio();
    });
    state.footerPlayEl.dataset.bound = '1';
  }
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  state.themeLink?.addEventListener('click', (event) => {
    event.preventDefault();
    praeCycleTheme();
  });
}

ready(init);

export { praeApplyTheme, praeCurrentTheme, praeCycleTheme };
