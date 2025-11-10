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
    btn.textContent = eff === 'dark' ? 'Theme: Dark' : 'Theme: Light';
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

function normalizePdfUrl(url) {
  if (!url) return '';
  const str = String(url);
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) {
    return `https://drive.google.com/file/d/${match[1]}/view?usp=drivesdk`;
  }
  return str;
}

function choosePdfViewer(url) {
  const str = String(url || '');
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : str;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

const PRAE = (window.PRAE = window.PRAE || {});
const works = Array.isArray(PRAE.works) ? PRAE.works : [];
const pageFollowMaps = (() => {
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

const state = {
  book: null,
  flow: null,
  header: null,
  currentTitleEl: null,
  pageNowEl: null,
  pageTotalEl: null,
  hudEl: null,
  themeLink: null,
  reduceMotion: false,
  sections: [],
  observer: null,
  pageIndex: 0,
  totalPages: 1,
  updatingHash: false,
  hudState: { last: { id: works[0]?.id ?? null, at: 0 } },
  currentAudioId: null,
  pdf: {
    root: null,
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
  }
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
  return work?.audioUrl || work?.audio || '';
}

function ensureAudioFor(work) {
  if (!work || work.id == null) return null;
  let el = document.getElementById('wc-a' + work.id);
  if (!el) {
    el = document.createElement('audio');
    el.id = 'wc-a' + work.id;
    el.preload = 'none';
    el.playsInline = true;
    const src = getAudioSourceFor(work);
    if (src) el.setAttribute('data-audio', src);
    document.body.appendChild(el);
  }
  return el;
}

function pauseAllAudio(exceptId) {
  for (const work of works) {
    if (!work || work.id == null) continue;
    if (Number(work.id) === Number(exceptId)) continue;
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) audio.pause();
  }
}

function updateHud(id, audio) {
  if (!state.hudEl) return;
  if (!audio || audio.paused || audio.ended) {
    state.hudEl.textContent = '';
    state.hudEl.hidden = true;
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
  const audio = document.getElementById('wc-a' + work.id) || ensureAudioFor(work);
  if (!audio) return;
  pauseAllAudio(work.id);
  state.hudState.last = { id: work.id, at: seconds || 0 };
  bindAudioToHud(work.id, audio);
  if (!audio.src) {
    const src = normalizeSrc(getAudioSourceFor(work));
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
  if (state.pdf.root) return state.pdf;
  const root = document.createElement('div');
  root.className = 'tf-pdf-root';
  root.setAttribute('hidden', '');
  const backdrop = document.createElement('div');
  backdrop.className = 'tf-pdf-backdrop';
  const pane = document.createElement('div');
  pane.className = 'tf-pdf-overlay';
  pane.setAttribute('role', 'dialog');
  pane.setAttribute('aria-modal', 'true');
  pane.setAttribute('aria-hidden', 'true');
  pane.setAttribute('tabindex', '-1');
  const bar = document.createElement('div');
  bar.className = 'tf-pdf-bar';
  const title = document.createElement('span');
  title.className = 'tf-pdf-title';
  const close = document.createElement('a');
  close.href = '#';
  close.className = 'tf-pdf-close';
  close.textContent = 'Close';
  bar.append(title, close);
  const frame = document.createElement('iframe');
  frame.className = 'tf-pdf-frame';
  frame.title = 'Score PDF';
  frame.loading = 'lazy';
  frame.allow = 'autoplay; fullscreen';
  frame.referrerPolicy = 'no-referrer';
  pane.append(bar, frame);
  root.append(backdrop, pane);
  document.body.appendChild(root);
  close.addEventListener('click', (event) => {
    event.preventDefault();
    hidePdfPane();
  });
  backdrop.addEventListener('click', () => hidePdfPane());
  frame.addEventListener('load', () => {
    state.pdf.viewerReady = true;
    const pending = state.pdf.pendingGoto;
    if (pending && (!pending.slug || pending.slug === state.pdf.currentSlug)) {
      gotoPdfPage(pending.pdfPage);
      state.pdf.pendingGoto = null;
    }
  });
  state.pdf.root = root;
  state.pdf.pane = pane;
  state.pdf.frame = frame;
  state.pdf.title = title;
  state.pdf.close = close;
  state.pdf.backdrop = backdrop;
  return state.pdf;
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
  audio.addEventListener('timeupdate', handler, { passive: true });
  audio.addEventListener('seeking', handler, { passive: true });
  handler();
}

function openPdfFor(workOrId) {
  const work = typeof workOrId === 'object' && workOrId
    ? workOrId
    : findWorkById(workOrId)?.data;
  if (!work) return;
  const raw = normalizePdfUrl(work.pdfUrl || work.pdf);
  if (!raw) return;
  const viewerUrl = choosePdfViewer(raw);
  const pdf = ensurePdfDom();
  if (!pdf.pane) {
    window.open(viewerUrl, '_blank', 'noopener');
    return;
  }
  pdf.root?.removeAttribute('hidden');
  pdf.root?.setAttribute('aria-hidden', 'false');
  pdf.pane.setAttribute('aria-hidden', 'false');
  pdf.pane.focus?.({ preventScroll: true });
  document.body.classList.add('tf-pdf-open');
  if (pdf.title) pdf.title.textContent = String(work.title || 'Score');
  pdf.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  pdf.currentSlug = work.slug || null;
  pdf.viewerReady = false;
  pdf.frame.src = 'about:blank';
  requestAnimationFrame(() => {
    pdf.frame.src = viewerUrl;
    pdf.pendingGoto = null;
  });
  if (work.slug) {
    const audio = document.getElementById('wc-a' + work.id);
    if (audio) attachPageFollow(work.slug, audio);
  }
}

function hidePdfPane() {
  const pdf = ensurePdfDom();
  pdf.pane?.setAttribute('aria-hidden', 'true');
  pdf.root?.setAttribute('hidden', '');
  pdf.root?.setAttribute('aria-hidden', 'true');
  if (pdf.frame) pdf.frame.src = 'about:blank';
  document.body.classList.remove('tf-pdf-open');
  pdf.viewerReady = false;
  pdf.pendingGoto = null;
  pdf.currentSlug = null;
  detachPageFollow();
  const restore = pdf.restoreFocus;
  pdf.restoreFocus = null;
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

function applySiteInfo() {
  const site = PRAE.config?.site || {};
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

function createWorkSection(work, index) {
  const section = document.createElement('section');
  section.className = 'tf-work';
  const slugKey = work.slug ? String(work.slug) : `work-${work.id || index + 1}`;
  section.id = `work-${slugKey}`.replace(/[^a-z0-9\-]+/gi, '-');
  if (work.id != null) section.dataset.workId = String(work.id);
  if (work.title) section.dataset.workTitle = String(work.title);
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
  if (work.pdfUrl || work.pdf) {
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
  const leadText = work.one || work.lead || '';
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
  const desc = Array.isArray(work.description) ? work.description : (work.description ? [work.description] : []);
  const paragraphs = [...notes, ...desc];
  paragraphs.forEach((block) => {
    const text = String(block ?? '').trim();
    if (!text) return;
    const p = document.createElement('p');
    p.textContent = text;
    section.appendChild(p);
  });
  return { section, heading: title };
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
    const { section, heading } = createWorkSection(work, index);
    state.flow.appendChild(section);
    state.sections.push({ work, section, heading });
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
      updateHeaderCurrent(owner?.work?.title || owner?.work?.slug || null);
    } else {
      updateHeaderCurrent(null);
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

function updatePagination() {
  if (!state.book || !state.flow) return;
  const pageSize = state.book.clientHeight || 1;
  const total = Math.max(1, Math.ceil(state.flow.scrollHeight / pageSize));
  state.totalPages = total;
  state.pageTotalEl && (state.pageTotalEl.textContent = String(total));
  updatePageFromScroll();
}

function updatePageFromScroll() {
  if (!state.book) return;
  const pageSize = state.book.clientHeight || 1;
  const rawIndex = Math.round(state.book.scrollTop / Math.max(1, pageSize));
  const index = Math.min(state.totalPages - 1, Math.max(0, rawIndex));
  state.pageIndex = index;
  if (state.pageNowEl) state.pageNowEl.textContent = String(index + 1);
  if (!state.updatingHash) updateHash();
}

function scrollToPage(index) {
  if (!state.book) return;
  const pageSize = state.book.clientHeight || 1;
  const clamped = Math.min(state.totalPages - 1, Math.max(0, index));
  const top = clamped * pageSize;
  state.updatingHash = true;
  state.book.scrollTo({
    top,
    behavior: state.reduceMotion ? 'auto' : 'smooth'
  });
  setTimeout(() => { state.updatingHash = false; updatePageFromScroll(); }, state.reduceMotion ? 0 : 300);
}

function turnPage(delta) {
  const next = state.pageIndex + delta;
  scrollToPage(next);
}

function updateHash() {
  const params = new URLSearchParams();
  params.set('p', String(state.pageIndex + 1));
  const next = `#${params.toString()}`;
  if (location.hash !== next) {
    history.replaceState(null, '', next);
  }
}

function hydrateFromHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) {
    scrollToPage(0);
    return;
  }
  if (!hash.includes('=')) {
    return;
  }
  const params = new URLSearchParams(hash);
  const pageVal = params.get('p');
  const pageNum = pageVal ? Number(pageVal) : 1;
  if (!Number.isNaN(pageNum)) {
    scrollToPage(Math.max(0, pageNum - 1));
  }
}

function onBookScroll() {
  if (state.updatingHash) return;
  updatePageFromScroll();
}

function onKeydown(event) {
  if (event.defaultPrevented) return;
  if (event.key === 'Escape') {
    const pdfOpen = state.pdf.root && !state.pdf.root.hasAttribute('hidden');
    if (pdfOpen) {
      hidePdfPane();
      event.preventDefault();
      return;
    }
  }
  if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    turnPage(1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    turnPage(-1);
  }
}

function onBookClick(event) {
  if (!state.book) return;
  const link = event.target.closest('a');
  if (link) return;
  const rect = state.book.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const pct = x / Math.max(1, rect.width);
  if (pct <= 0.1) {
    turnPage(-1);
  } else if (pct >= 0.9) {
    turnPage(1);
  }
}

function bindEvents() {
  if (state.book) {
    state.book.addEventListener('scroll', onBookScroll, { passive: true });
    state.book.addEventListener('click', onBookClick);
  }
  window.addEventListener('resize', () => updatePagination(), { passive: true });
  window.addEventListener('hashchange', () => hydrateFromHash());
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
  applySiteInfo();
  ensureAudioTags();
  renderBook();
  observeCurrentWork();
  updatePagination();
  hydrateFromHash();
  bindEvents();
  updateHeaderCurrent(state.sections[0]?.work?.title || null);
  praeApplyTheme(praeCurrentTheme(), { persist: false });
  state.themeLink?.addEventListener('click', (event) => {
    event.preventDefault();
    praeCycleTheme();
  });
}

ready(init);

export { praeApplyTheme, praeCurrentTheme, praeCycleTheme };
