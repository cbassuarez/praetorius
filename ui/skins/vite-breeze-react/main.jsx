import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { buildOpenDetailLines } from '../../lib/work-detail-lines.js';
import { normalizeWork } from '../../lib/work-normalize.js';

const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light';
}

function readStoredTheme() {
  try {
    const docTheme = document.documentElement?.getAttribute('data-theme');
    if (docTheme === 'light' || docTheme === 'dark') return docTheme;
    const bodyTheme = document.body?.getAttribute('data-theme');
    if (bodyTheme === 'light' || bodyTheme === 'dark') return bodyTheme;
  } catch (_) {}
  try {
    let saved = localStorage.getItem(PRAE_THEME_STORAGE_KEY);
    if (!saved) return 'light';
    if (saved.trim().charAt(0) === '{') {
      const parsed = JSON.parse(saved);
      saved = parsed?.mode || 'light';
    }
    return normalizeTheme(saved);
  } catch (_) {
    return 'light';
  }
}

function syncThemeOnDom(mode) {
  const eff = normalizeTheme(mode);
  const host = document.getElementById('works-console');
  const body = document.body;
  const doc = document.documentElement;

  if (doc) {
    doc.setAttribute('data-theme', eff);
    if (doc.style) doc.style.colorScheme = eff;
  }
  if (host) {
    host.classList.remove(...PRAE_THEME_CLASSNAMES);
    host.classList.add(eff === 'dark' ? PRAE_THEME_CLASSNAMES[1] : PRAE_THEME_CLASSNAMES[0]);
    host.setAttribute('data-theme', eff);
  }
  if (body) {
    body.classList.remove(...PRAE_THEME_CLASSNAMES);
    body.classList.add(eff === 'dark' ? PRAE_THEME_CLASSNAMES[1] : PRAE_THEME_CLASSNAMES[0]);
    body.setAttribute('data-theme', eff);
  }
  return eff;
}

function applyTheme(mode, opts = {}) {
  const eff = syncThemeOnDom(mode);
  try {
    if (window.PRAE && typeof window.PRAE.applyAppearanceMode === 'function') {
      window.PRAE.applyAppearanceMode(eff, { persist: false });
    }
  } catch (_) {}
  if (opts.persist !== false) {
    try {
      localStorage.setItem(PRAE_THEME_STORAGE_KEY, eff);
    } catch (_) {}
  }
  return eff;
}

function currentTheme() {
  const attr = document.body?.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return readStoredTheme();
}

function formatTime(sec) {
  const value = Math.max(0, Math.floor(Number(sec) || 0));
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function cueLabel(value, label) {
  if (label && /^@?\d+:\d{2}$/.test(label)) return String(label).replace(/^@?/, '@');
  return `@${formatTime(value)}`;
}

function normalizeSrc(url) {
  if (!url) return '';
  const str = String(url);
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return str;
}

function normalizePdfUrl(url) {
  if (!url) return '';
  const str = String(url);
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  if (match) return `https://drive.google.com/file/d/${match[1]}/view?usp=drivesdk`;
  return str;
}

function normalizeCoverUrl(work) {
  const raw = work && typeof work === 'object' ? (work.cover ?? work.coverUrl ?? '') : '';
  if (!raw) return '';
  const media = window.PRAE && window.PRAE.media ? window.PRAE.media : null;
  if (media && typeof media.normalizeCoverUrl === 'function') {
    try { return String(media.normalizeCoverUrl(raw) || '').trim(); } catch (_) {}
  }
  return normalizeSrc(raw);
}

function choosePdfViewer(url) {
  const str = String(url || '');
  const match = str.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : str;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

function resolveScorePdfMode(work) {
  const media = window.PRAE && window.PRAE.media ? window.PRAE.media : null;
  if (media && typeof media.resolveScorePdfMode === 'function') {
    try { return media.resolveScorePdfMode(work || {}); } catch (_) {}
  }
  return 'interactive';
}

function IconBase({ children, className = 'vbx-icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function IconPlay(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M7.5 5.75A1.75 1.75 0 0 1 10.16 4.3l8.25 5.78a1.75 1.75 0 0 1 0 2.86l-8.25 5.78A1.75 1.75 0 0 1 7.5 17.25V5.75Z" />
    </IconBase>
  );
}

function IconPause(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M9 5.25v13.5M15 5.25v13.5" />
    </IconBase>
  );
}

function IconSun(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m14.864 6.364-1.06-1.06M7.196 7.196l-1.06-1.06m12.728 0-1.06 1.06M7.196 16.804l-1.06 1.06" />
      <circle cx="12" cy="12" r="3.2" />
    </IconBase>
  );
}

function IconMoon(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M20.25 14.9A8.25 8.25 0 1 1 9.1 3.75a7.1 7.1 0 0 0 11.15 11.15Z" />
    </IconBase>
  );
}

function IconEye(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M2.1 12s3.65-6.25 9.9-6.25 9.9 6.25 9.9 6.25-3.65 6.25-9.9 6.25S2.1 12 2.1 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </IconBase>
  );
}

function IconLink(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M13.8 8.2a4.5 4.5 0 0 1 0 6.36l-1.45 1.45a4.5 4.5 0 1 1-6.36-6.36l1.45-1.45" />
      <path d="M10.2 15.8a4.5 4.5 0 0 1 0-6.36l1.45-1.45a4.5 4.5 0 1 1 6.36 6.36l-1.45 1.45" />
    </IconBase>
  );
}

function IconDocument(props = {}) {
  return (
    <IconBase {...props}>
      <path d="M14.25 3.75H7.5A2.25 2.25 0 0 0 5.25 6v12A2.25 2.25 0 0 0 7.5 20.25h9A2.25 2.25 0 0 0 18.75 18V8.25L14.25 3.75Z" />
      <path d="M14.25 3.75V8.25h4.5" />
      <path d="M9 12.75h6m-6 3h4.5" />
    </IconBase>
  );
}

function IconX(props = {}) {
  return (
    <IconBase {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconBase>
  );
}

function timeToSec(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const match = str.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function printedPageForTime(cfg, tSec) {
  const elapsed = (tSec || 0) + (cfg.mediaOffsetSec || 0);
  let current = cfg.pageMap?.[0]?.page ?? 1;
  for (const row of cfg.pageMap || []) {
    const at = typeof row.at === 'number' ? row.at : timeToSec(row.at);
    if (elapsed >= at) current = row.page;
    else break;
  }
  return current;
}

function computePdfPage(cfg, tSec) {
  const printed = printedPageForTime(cfg, tSec || 0);
  return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
}

function workUrl(id) {
  return `${location.origin}${location.pathname}#work-${encodeURIComponent(String(id))}`;
}

function getPraeData() {
  const PRAE = (window.PRAE = window.PRAE || {});
  const payload = window.__PRAE_DATA__ || {};
  const rawWorks = Array.isArray(payload.works)
    ? payload.works
    : (Array.isArray(PRAE.works) ? PRAE.works : []);
  const works = rawWorks.map((work) => normalizeWork(work));
  const site = (PRAE.config && PRAE.config.site) || payload.config?.site || {};
  const pageFollowMaps = payload.pageFollowMaps || PRAE.pageFollowMaps || {};
  return { PRAE, works, site, pageFollowMaps };
}

function App() {
  const reduceMotion = useReducedMotion();
  const { works, site, pageFollowMaps } = useMemo(() => getPraeData(), []);

  const [theme, setTheme] = useState(() => readStoredTheme());
  const [expanded, setExpanded] = useState({});
  const [hud, setHud] = useState({
    id: null,
    title: '—',
    current: 0,
    duration: 0,
    ratio: 0,
    playing: false
  });
  const [lastPlay, setLastPlay] = useState({ id: works[0]?.id ?? null, at: 0 });
  const [pdf, setPdf] = useState({ open: false, slug: null, title: '', src: 'about:blank', mode: 'interactive' });
  const [flashById, setFlashById] = useState({});
  const [coverFailures, setCoverFailures] = useState({});

  const frameRef = useRef(null);
  const audioListenersRef = useRef(new Map());
  const viewerReadyRef = useRef(false);
  const pendingPdfGotoRef = useRef(null);
  const pdfRef = useRef(pdf);
  const pageFollowRef = useRef({ audio: null, slug: null, cfg: null, onTick: null, lastPrinted: null });
  const footerRef = useRef(null);

  useEffect(() => {
    applyTheme(theme, { persist: false });
  }, [theme]);

  useEffect(() => {
    pdfRef.current = pdf;
  }, [pdf]);

  useEffect(() => {
    const mode = currentTheme();
    setTheme(mode);
    applyTheme(mode, { persist: false });
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.altKey || event.metaKey) && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        setTheme((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          return next;
        });
      }
      if (event.key === 'Escape' && pdfRef.current.open) {
        closePdfPane();
      }
    };
    document.addEventListener('keydown', onKey, { passive: false });
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const onLoad = () => {
      viewerReadyRef.current = true;
      const pending = pendingPdfGotoRef.current;
      if (!pending || !pdfRef.current.open) return;
      if (pending.slug && pending.slug !== pdfRef.current.slug) return;
      gotoPdfPage(pending.pdfPage);
      pendingPdfGotoRef.current = null;
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }, [pdf.open]);

  const workById = (id) => works.find((work) => Number(work.id) === Number(id)) || null;

  const getAudio = (work) => {
    const id = work.audioId || `wc-a${work.id}`;
    let audio = document.getElementById(id);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = id;
      audio.preload = 'none';
      audio.playsInline = true;
      document.body.appendChild(audio);
    }
    const source = work.audioUrl || work.audio || '';
    if (source) audio.setAttribute('data-audio', source);
    return audio;
  };

  const updateHud = (id, audio) => {
    const work = workById(id);
    const duration = Number.isFinite(audio?.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio?.currentTime) ? audio.currentTime : 0;
    const ratio = duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0;
    setHud({
      id,
      title: work?.title || '—',
      current,
      duration,
      ratio,
      playing: !!(audio && !audio.paused)
    });
  };

  const bindAudio = (id, audio) => {
    if (!audio || audioListenersRef.current.has(id)) return;
    const refresh = () => updateHud(id, audio);
    audio.addEventListener('timeupdate', refresh, { passive: true });
    audio.addEventListener('ratechange', refresh, { passive: true });
    audio.addEventListener('volumechange', refresh, { passive: true });
    audio.addEventListener('loadedmetadata', refresh, { passive: true });
    audio.addEventListener('play', refresh, { passive: true });
    audio.addEventListener('pause', refresh, { passive: true });
    audio.addEventListener('ended', refresh, { passive: true });
    audioListenersRef.current.set(id, refresh);
  };

  const stopOtherAudios = (exceptId) => {
    for (const work of works) {
      if (Number(work.id) === Number(exceptId)) continue;
      const id = work.audioId || `wc-a${work.id}`;
      const audio = document.getElementById(id);
      if (audio && !audio.paused) audio.pause();
    }
  };

  const detachPageFollow = () => {
    const ref = pageFollowRef.current;
    if (ref.audio && ref.onTick) {
      ref.audio.removeEventListener('timeupdate', ref.onTick);
      ref.audio.removeEventListener('seeking', ref.onTick);
    }
    pageFollowRef.current = { audio: null, slug: null, cfg: null, onTick: null, lastPrinted: null };
  };

  useEffect(() => () => detachPageFollow(), []);

  useEffect(() => {
    const root = footerRef.current;
    const branding = (window.PRAE && window.PRAE.config && window.PRAE.config.branding) || {};
    if (root && window.PRAE && window.PRAE.branding && typeof window.PRAE.branding.renderFooter === 'function') {
      window.PRAE.branding.renderFooter(root, { site, branding });
    }
  }, [site, theme]);

  const gotoPdfPage = (pageNum) => {
    const frame = frameRef.current;
    if (!frame || !frame.src || !/\/viewer\.html/i.test(frame.src)) return;
    const url = new URL(frame.src, location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const current = Number(hash.get('page') || '1');
    const next = Number(pageNum || 1);
    if (current === next) return;
    hash.set('page', String(next));
    if (!hash.has('zoom')) hash.set('zoom', 'page-width');
    if (!hash.has('sidebar')) hash.set('sidebar', '0');
    viewerReadyRef.current = false;
    url.hash = `#${hash.toString()}`;
    frame.src = url.toString();
  };

  const attachPageFollow = (work, audio) => {
    detachPageFollow();
    if (!work?.slug || !audio) return;
    const cfg = pageFollowMaps[work.slug];
    if (!cfg) return;

    const onTick = () => {
      const printed = printedPageForTime(cfg, audio.currentTime || 0);
      if (printed === pageFollowRef.current.lastPrinted) return;
      pageFollowRef.current.lastPrinted = printed;
      const pdfPage = computePdfPage(cfg, audio.currentTime || 0);
      const openPdf = pdfRef.current;
      if (!openPdf.open || openPdf.slug !== work.slug || !viewerReadyRef.current) {
        pendingPdfGotoRef.current = { slug: work.slug, pdfPage };
        return;
      }
      gotoPdfPage(pdfPage);
    };

    pageFollowRef.current = { audio, slug: work.slug, cfg, onTick, lastPrinted: null };
    audio.addEventListener('timeupdate', onTick, { passive: true });
    audio.addEventListener('seeking', onTick, { passive: true });
    onTick();
  };

  const playAt = (id, startAt = 0) => {
    const work = workById(id);
    if (!work) return;
    const audio = getAudio(work);
    if (!audio) return;
    bindAudio(work.id, audio);

    if (!audio.src) {
      const raw = audio.getAttribute('data-audio') || work.audio || work.audioUrl || '';
      const normalized = normalizeSrc(raw);
      if (normalized) {
        audio.src = normalized;
        audio.load();
      }
    }

    const playNow = () => {
      try {
        if (window.PRAE && typeof window.PRAE.pauseAllAudio === 'function') {
          window.PRAE.pauseAllAudio(work.id);
        }
      } catch (_) {}
      stopOtherAudios(work.id);
      try {
        audio.currentTime = Math.max(0, Number(startAt) || 0);
      } catch (_) {}
      const run = audio.play();
      if (run && typeof run.catch === 'function') {
        run.catch(() => {});
      }
      setLastPlay({ id: work.id, at: audio.currentTime || 0 });
      updateHud(work.id, audio);
      attachPageFollow(work, audio);
    };

    if (audio.readyState >= 1) playNow();
    else audio.addEventListener('loadedmetadata', playNow, { once: true });
  };

  const toggleHudPlayback = () => {
    let active = null;
    for (const work of works) {
      const id = work.audioId || `wc-a${work.id}`;
      const audio = document.getElementById(id);
      if (audio && !audio.paused && !audio.ended) {
        active = { work, audio };
        break;
      }
    }
    if (active) {
      setLastPlay({ id: active.work.id, at: active.audio.currentTime || 0 });
      active.audio.pause();
      updateHud(active.work.id, active.audio);
      return;
    }
    const nextId = lastPlay.id || works[0]?.id;
    if (nextId != null) playAt(nextId, lastPlay.at || 0);
  };

  const openPdfFor = (id) => {
    const work = workById(id);
    if (!work || !work.pdf) return;
    const raw = normalizePdfUrl(work.pdf);
    const viewer = choosePdfViewer(raw);
    const base = viewer.split('#')[0];
    const mode = resolveScorePdfMode(work) === 'clean' ? 'clean' : 'interactive';

    let initPage = 1;
    const follow = pageFollowRef.current;
    if (follow.slug && follow.slug === work.slug && follow.audio) {
      initPage = computePdfPage(follow.cfg, follow.audio.currentTime || 0);
    } else if (work.slug && pageFollowMaps[work.slug]) {
      initPage = computePdfPage(pageFollowMaps[work.slug], 0);
    }

    setPdf({ open: true, slug: work.slug || null, title: work.title || 'Score', src: 'about:blank', mode });
    requestAnimationFrame(() => {
      viewerReadyRef.current = false;
      setPdf({
        open: true,
        slug: work.slug || null,
        title: work.title || 'Score',
        src: `${base}#page=${Math.max(1, initPage)}&zoom=page-width&toolbar=0&sidebar=0`,
        mode
      });
    });
  };

  const closePdfPane = () => {
    setPdf({ open: false, slug: null, title: '', src: 'about:blank', mode: 'interactive' });
    viewerReadyRef.current = false;
    pendingPdfGotoRef.current = null;
  };

  const flash = (id, text) => {
    setFlashById((prev) => ({ ...prev, [id]: text }));
    window.setTimeout(() => {
      setFlashById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 1500);
  };

  const copyDeepLink = (id) => {
    const url = workUrl(id);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => flash(id, 'Copied')).catch(() => flash(id, 'Copy failed'));
      return;
    }
    flash(id, url);
  };

  const links = Array.isArray(site.links) ? site.links.filter((item) => item && item.label) : [];
  const displayName = site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ').trim() || 'Your Name';
  const subtitle = site.subtitle || 'Selected works';

  const updateCardSheen = (event) => {
    if (reduceMotion) return;
    const card = event.currentTarget;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    card.style.setProperty('--shine-x', `${Math.max(0, Math.min(100, x)).toFixed(2)}%`);
    card.style.setProperty('--shine-y', `${Math.max(0, Math.min(100, y)).toFixed(2)}%`);
  };

  const clearCardSheen = (event) => {
    const card = event.currentTarget;
    if (!card) return;
    card.style.removeProperty('--shine-x');
    card.style.removeProperty('--shine-y');
  };

  return (
    <div className="vbx-app" data-theme={theme}>
      <header className="vbx-header" role="banner">
        <div className="vbx-brand">
          <h1 className="vbx-title">{displayName}</h1>
          <p className="vbx-subtitle">{subtitle}</p>
        </div>

        <nav className="vbx-nav" id="prae-nav" aria-label="Site links">
          {links.map((item) => (
            <a
              key={`${item.label}-${item.href}`}
              href={item.href || '#'}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          id="wc-theme-toggle"
          className="vbx-theme-toggle"
          type="button"
          role="switch"
          aria-checked={theme === 'dark' ? 'true' : 'false'}
          aria-label="Toggle theme"
          title={`Toggle theme (Alt/Opt+D) · current: ${theme}`}
          onClick={() => {
            setTheme((prev) => {
              const next = prev === 'dark' ? 'light' : 'dark';
              applyTheme(next);
              return next;
            });
          }}
        >
          {theme === 'dark' ? <IconMoon /> : <IconSun />}
        </button>
      </header>

      <main className={`vbx-shell ${pdf.open ? 'has-pdf' : ''}`} role="main">
        <section className="vbx-maincol">
          <div id="wc-hud" className="vbx-hud" data-component="prae-hud">
            <div className="vbx-hud-meta">
              <strong>Now playing — {hud.title}</strong>
              <small>
                {formatTime(hud.current)} / {hud.duration > 0 ? formatTime(hud.duration) : '--:--'}
              </small>
            </div>
            <div className="vbx-hud-meter" data-part="meter">
              <span style={{ width: `${hud.ratio * 100}%` }} />
            </div>
            <button
              className="vbx-hud-toggle"
              type="button"
              data-hud="toggle"
              aria-label={hud.playing ? 'Pause' : 'Play'}
              onClick={toggleHudPlayback}
            >
              {hud.playing ? <IconPause /> : <IconPlay />}
              <span>{hud.playing ? 'Pause' : 'Play'}</span>
            </button>
          </div>

          <section id="works-console" className="vbx-list" aria-label="Works list">
            {works.length === 0 ? (
              <article className="vbx-empty">
                <h2>No works yet</h2>
                <p>Run <code>prae add</code> and regenerate to populate this view.</p>
              </article>
            ) : null}

            {works.map((work, index) => {
              const cues = Array.isArray(work.cues) ? work.cues : [];
              const tags = Array.isArray(work.tags) ? work.tags : [];
              const detailLines = buildOpenDetailLines(work);
              const isExpanded = !!expanded[work.id];
              const hasPdf = !!work.pdf;
              const coverUrl = normalizeCoverUrl(work);
              const showCover = !!coverUrl && !coverFailures[work.id];

              return (
                <motion.article
                  key={work.id}
                  className="vbx-card work"
                  initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={reduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 160, damping: 18, mass: 0.8, delay: index * 0.05 }}
                  whileHover={reduceMotion ? undefined : { y: -8, scale: 1.006, rotateX: 1.1 }}
                  onPointerEnter={updateCardSheen}
                  onPointerMove={updateCardSheen}
                  onPointerLeave={clearCardSheen}
                >
                  <div className="vbx-card-head">
                    <div>
                      <h2>{work.title}</h2>
                      <p className="vbx-slug">{work.slug}</p>
                    </div>
                    {showCover ? (
                      <figure className="vbx-cover" aria-label={`${work.title} cover`}>
                        <img
                          src={coverUrl}
                          alt=""
                          loading="lazy"
                          onError={() => setCoverFailures((prev) => (prev[work.id] ? prev : { ...prev, [work.id]: true }))}
                        />
                      </figure>
                    ) : (
                      <div className="vbx-cover vbx-cover-fallback" aria-label="Cover unavailable">Cover unavailable</div>
                    )}
                  </div>

                  <p className="vbx-oneliner">{work.onelinerEffective || work.one || ''}</p>

                  {tags.length ? (
                    <ul className="vbx-tags" aria-label="Tags">
                      {tags.map((tag) => (
                        <li key={`${work.id}-${tag}`}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}

                  {cues.length ? (
                    <ul className="vbx-cues" aria-label={`Cue points for ${work.title}`}>
                      {cues.map((cue) => {
                        const at = Number(cue.t) || 0;
                        return (
                          <li key={`${work.id}-${cue.label}-${at}`}>
                            <button
                              type="button"
                              onClick={() => playAt(work.id, at)}
                              aria-label={`Play ${cueLabel(at, cue.label)}`}
                            >
                              <IconPlay />
                              <span>Play {cueLabel(at, cue.label)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  <div className="vbx-actions">
                    <button
                      className={`vbx-action-btn ${isExpanded ? 'is-open' : ''}`}
                      type="button"
                      onClick={() => {
                        setExpanded((prev) => ({ ...prev, [work.id]: !prev[work.id] }));
                      }}
                    >
                      <IconEye />
                      <span>{isExpanded ? 'Close' : 'Open'}</span>
                    </button>
                    <button className="vbx-action-btn" type="button" onClick={() => copyDeepLink(work.id)}>
                      <IconLink />
                      <span>Copy URL</span>
                    </button>
                    <button className="vbx-action-btn" type="button" onClick={() => openPdfFor(work.id)} disabled={!hasPdf}>
                      <IconDocument />
                      <span>{hasPdf ? 'PDF' : 'No PDF'}</span>
                    </button>
                    {flashById[work.id] ? <span className="vbx-flash">{flashById[work.id]}</span> : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        className="vbx-note"
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {detailLines.length ? detailLines.map((line, lineIndex) => (
                          <p key={`${work.id}-${lineIndex}`} className={line.className || undefined}>{line.text}</p>
                        )) : <p className="one">No detail text available.</p>}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </section>
        </section>

        <AnimatePresence>
          {pdf.open ? (
            <motion.aside
              className="vbx-pdfpane vb-pdfpane"
              aria-label="Score PDF"
              aria-hidden={pdf.open ? 'false' : 'true'}
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: 20 }}
              transition={{ duration: 0.24 }}
            >
              <header className="vbx-pdfbar">
                <div className="vbx-pdf-title">{pdf.title}</div>
                <button type="button" className="vbx-pdf-close" onClick={closePdfPane} aria-label="Close PDF">
                  <IconX />
                  <span>Close</span>
                </button>
              </header>
              {pdf.mode === 'clean' ? (
                <p className="vbx-pdf-note">Clean mode: viewer is locked; page changes follow cues/playback.</p>
              ) : null}
              <iframe
                ref={frameRef}
                className="vbx-pdf-frame"
                title="Score PDF"
                loading="lazy"
                referrerPolicy="no-referrer"
                allow="autoplay; fullscreen"
                data-prae-score-pdf-mode={pdf.mode}
                tabIndex={pdf.mode === 'clean' ? -1 : undefined}
                style={pdf.mode === 'clean' ? { pointerEvents: 'none' } : undefined}
                src={pdf.src}
              />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </main>

      <footer ref={footerRef} className="vbx-footer" id="prae-footer" role="contentinfo" />
    </div>
  );
}

(function boot() {
  const rootNode = document.getElementById('vb-react-root') || document.body;
  const root = createRoot(rootNode);
  root.render(<App />);
})();
