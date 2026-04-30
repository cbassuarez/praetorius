// HUD logic + Vite Breeze skin glue.
// Edit HUD logic in: ui/skins/vite-breeze/main.js → emitted to dist/app.js

const PRAE_THEME_STORAGE_KEY = 'wc.theme';
const PRAE_THEME_CLASSNAMES = ['prae-theme-light', 'prae-theme-dark'];

function praeNormalizeTheme(value){
  return value === 'dark' ? 'dark' : 'light';
}

function praeReadStoredTheme(){
  try {
    var docTheme = document.documentElement && document.documentElement.getAttribute('data-theme');
    if (docTheme === 'light' || docTheme === 'dark') return docTheme;
    var bodyTheme = document.body && document.body.getAttribute('data-theme');
    if (bodyTheme === 'light' || bodyTheme === 'dark') return bodyTheme;
  } catch (_) {}
  try {
    var saved = localStorage.getItem(PRAE_THEME_STORAGE_KEY);
    if (saved && saved.trim().charAt(0) === '{') {
      try { saved = (JSON.parse(saved) || {}).mode || 'light'; } catch (_) { saved = 'light'; }
    }
    return praeNormalizeTheme(saved);
  } catch (_) {
    return 'light';
  }
}

function praeSyncThemeOnDom(mode){
  var eff = praeNormalizeTheme(mode);
  var host = document.getElementById('works-console');
  var body = document.body;
  var doc = document.documentElement;
  try {
    if (doc) doc.setAttribute('data-theme', eff);
    if (host) {
      host.classList.remove('prae-theme-light', 'prae-theme-dark');
      host.classList.add(eff === 'light' ? PRAE_THEME_CLASSNAMES[0] : PRAE_THEME_CLASSNAMES[1]);
      host.removeAttribute('data-theme-mode');
      host.setAttribute('data-theme', eff);
    }
    if (body) {
      body.classList.remove('prae-theme-light', 'prae-theme-dark');
      body.classList.add(eff === 'light' ? PRAE_THEME_CLASSNAMES[0] : PRAE_THEME_CLASSNAMES[1]);
      body.setAttribute('data-theme', eff);
    }
  } catch (_) {}
  if (doc && doc.style) doc.style.colorScheme = (eff === 'dark' ? 'dark' : 'light');
  return eff;
}

function praeApplyTheme(mode, opts){
  var eff = praeSyncThemeOnDom(mode);
  try {
    if (window.PRAE && typeof window.PRAE.applyAppearanceMode === 'function') {
      window.PRAE.applyAppearanceMode(eff, { persist: false });
    }
  } catch (_) {}
  if (!opts || opts.persist !== false) {
    try { localStorage.setItem(PRAE_THEME_STORAGE_KEY, eff); } catch (_) {}
  }
  try {
    var btn = document.getElementById('wc-theme-toggle');
    if (btn) {
      btn.setAttribute('aria-checked', String(eff === 'dark'));
      btn.setAttribute('data-mode', eff);
      btn.classList.remove('is-light', 'is-dark');
      btn.classList.add(eff === 'dark' ? 'is-dark' : 'is-light');
      btn.setAttribute('title', 'Toggle theme (Alt/Opt+D) · current: ' + eff);
    }
  } catch (_) {}
  return eff;
}

function praeCurrentTheme(){
  var body = document.body;
  if (body) {
    var attr = body.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  return praeReadStoredTheme();
}

// -------- Theme preboot (aligns with console) ----------
(function bootTheme(){
  function run(){
    var eff = praeReadStoredTheme();
    if (document.body) {
      praeApplyTheme(eff, { persist:false });
    } else {
      praeSyncThemeOnDom(eff);
      document.addEventListener('DOMContentLoaded', function(){
        praeApplyTheme(eff, { persist:false });
      }, { once:true });
    }
  }
  run();
})();

;(function(){
    // Run AFTER DOM is parsed to avoid no-op clicks when script loads in <head>
  function ready(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once:true });
    } else {
      fn();
    }
  }
  ready(function(){ praeApplyTheme(praeCurrentTheme(), { persist:false }); });

  function cycleTheme(){
    var next = praeCurrentTheme() === 'dark' ? 'light' : 'dark';
    praeApplyTheme(next);
  }

  ready(function bindThemeToggle(){
    var btn = document.getElementById('wc-theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function(){
      cycleTheme();
    }, { passive:true });
    btn.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        cycleTheme();
      }
    });
  });

  document.addEventListener('keydown', function(e){
    if ((e.altKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      cycleTheme();
    }
  }, { passive:false });

  // ---------------- Data + chrome ----------------
  const qs = new URLSearchParams(location.search);
  const urlSkin = qs.get('skin');
  if (urlSkin) document.documentElement.setAttribute('data-skin', urlSkin);

  const PRAE  = (window.PRAE = window.PRAE || {});
  const PRAE_DATA = window.__PRAE_DATA__ || {};
  // --- HUD bootstrap: create immediately so it always exists
const HUD_ID = 'wc-hud';
let hudBox = null;
function ensureHudRoot(){
  let root = document.getElementById(HUD_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = HUD_ID;
    root.className = 'wc-hud';
    document.body.prepend(root);           // visible even before shell binds
  } else {
    root.id = HUD_ID;
    root.classList.add('wc-hud');
  }
  root.setAttribute('data-component', 'prae-hud');
  hudBox = root;
  return root;
}
ensureHudRoot();

  const works = Array.isArray(PRAE_DATA.works)
    ? PRAE_DATA.works
    : (Array.isArray(PRAE.works) ? PRAE.works : []);
  const praeMedia = PRAE && PRAE.media ? PRAE.media : null;
  function setEmbedFrameMode(frame, mode){
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
  const site  = (PRAE.config && PRAE.config.site) || {};
  const pfMap = PRAE_DATA.pageFollowMaps || PRAE.pageFollowMaps || {};
  const prefersReducedMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---- Shared state (hoisted to avoid TDZ in mount / listeners) ----
  let currentPdfSlug = null;
  let pdfViewerReady = false;
  let pendingPdfGoto = null;
  let pageFollow = { audio:null, slug:null, lastPrinted:null, _on:null, token:null, sourceKind:'audio' };
  let youtubeController = null;
  let youtubeWorkId = null;
  if (typeof PRAE.ensureAudioTags === 'function') PRAE.ensureAudioTags();

  // DOM refs are bound inside mount() so they exist when used
  let host, headerNav, footer, shell, pdfPane, pdfTitle, pdfClose, pdfFrame;
  let hudRefs = null;
  /* HUD_SOURCE:app.js */
  function ensureHudDom(){
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
        <button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play" data-icon="play"></button>
      </div>`;
    const title = root.querySelector('[data-part="title"]');
    const sub   = root.querySelector('[data-part="subtitle"]');
    const meter = root.querySelector('[data-part="meter"]');
    const fill  = meter?.querySelector('span') || null;
    const btn   = root.querySelector('[data-part="toggle"]');
    hudRefs = { title, sub, fill, btn, meter, root };
    root.dataset.hudBound = '1';
    return hudRefs;
  }
  function hudSetSubtitle(text){ const r = ensureHudDom(); if (r?.sub) r.sub.textContent = String(text ?? ''); }
  function hudSetPlaying(on){
    const r = ensureHudDom();
    if (!r?.btn) return;
    r.btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    r.btn.dataset.icon = on ? 'pause' : 'play';
  }
  function hudSetProgress(ratio){
    const r = ensureHudDom();
    if (!r?.fill) return;
    const pct = Math.max(0, Math.min(1, Number(ratio) || 0));
    r.fill.style.width = `${pct * 100}%`;
  }
  function hudEnsure(){ const refs = ensureHudDom(); return refs?.root || ensureHudRoot(); }
  function hudGetRoot(){ ensureHudRoot(); return hudBox; }
  const hudApi = {
    ensure: hudEnsure,
    setSubtitle: hudSetSubtitle,
    setPlaying: hudSetPlaying,
    setProgress: hudSetProgress,
    getRoot: hudGetRoot
  };
  PRAE.hud = Object.assign({}, PRAE.hud || {}, hudApi);
  PRAE.hud.ensure();
  hudBox = PRAE.hud.getRoot();
  const hudState = { last: { id:null, at:0 } };
  function bindDom(){
    host      = document.querySelector('#works-console');
    headerNav = document.getElementById('prae-nav');
    footer    = document.getElementById('prae-footer');
    shell     = document.querySelector('.vb-shell');
    pdfPane   = document.querySelector('.vb-pdfpane');
    pdfTitle  = document.querySelector('.vb-pdf-title');
    pdfClose  = document.querySelector('.vb-pdf-close');
    pdfFrame  = document.querySelector('.vb-pdf-frame');
  }

  ready(mount);
  function mount(){
    bindDom();
    // Move HUD into the grid when the shell exists
if (shell && hudBox.parentNode !== shell) {
  shell.insertBefore(hudBox, shell.firstChild);
}

    // Bind PDF.js load once the iframe node actually exists
if (pdfFrame && !pdfFrame.dataset.bound) {
  pdfFrame.addEventListener('load', () => {
    pdfViewerReady = true;
    if (pendingPdfGoto && (!pendingPdfGoto.slug || pendingPdfGoto.slug === currentPdfSlug)) {
      gotoPdfPage(pendingPdfGoto.pdfPage);
      pendingPdfGoto = null;
    }
  });
  pdfFrame.dataset.bound = '1';
}
    if (!host) { console.warn('[prae] #works-console not found'); return; }
// Nav / Footer from config (kept minimal)
  if (headerNav && Array.isArray(site.links)) {
    headerNav.innerHTML = site.links
      .filter(l => (l && l.label))
      .map(l => `<a href="${esc(l.href||'#')}" ${l.external?'target="_blank" rel="noopener"':''}>${esc(l.label)}</a>`)
      .join('');
  }
  if (footer) {
    const branding = (PRAE.config && PRAE.config.branding) || {};
    if (PRAE.branding && typeof PRAE.branding.renderFooter === 'function') {
      PRAE.branding.renderFooter(footer, { site, branding });
    }
  }

// Brand (header) from config: Your Name / subtitle
  (function brandFromConfig(){
    const nameEl = document.querySelector('[data-site-title]');
    const subEl  = document.querySelector('[data-site-subtitle]');
    const full   = site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ').trim() || '';
    const sub    = site.subtitle || '';
    if (nameEl && full) nameEl.textContent = full;
    if (subEl)  subEl.textContent = sub || 'Selected works';
  })();

  // ---------------- Works list with console-aligned actions ----------------
  host.innerHTML = '';
  // Create HUD as a SIBLING before #works-console so list renders never remove it
  // HUD already exists from early bootstrap; just ensure internals + styles
  PRAE.hud.ensure();

  const icon = (name) => {
    const start = '<svg class="vb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
    if (name === 'play') {
      return `${start}<path d="M7.5 5.75A1.75 1.75 0 0 1 10.16 4.3l8.25 5.78a1.75 1.75 0 0 1 0 2.86l-8.25 5.78A1.75 1.75 0 0 1 7.5 17.25V5.75Z"/></svg>`;
    }
    if (name === 'eye') {
      return `${start}<path d="M2.1 12s3.65-6.25 9.9-6.25 9.9 6.25 9.9 6.25-3.65 6.25-9.9 6.25S2.1 12 2.1 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>`;
    }
    if (name === 'link') {
      return `${start}<path d="M13.8 8.2a4.5 4.5 0 0 1 0 6.36l-1.45 1.45a4.5 4.5 0 1 1-6.36-6.36l1.45-1.45"/><path d="M10.2 15.8a4.5 4.5 0 0 1 0-6.36l1.45-1.45a4.5 4.5 0 1 1 6.36 6.36l-1.45 1.45"/></svg>`;
    }
    if (name === 'document') {
      return `${start}<path d="M14.25 3.75H7.5A2.25 2.25 0 0 0 5.25 6v12A2.25 2.25 0 0 0 7.5 20.25h9A2.25 2.25 0 0 0 18.75 18V8.25L14.25 3.75Z"/><path d="M14.25 3.75V8.25h4.5"/><path d="M9 12.75h6m-6 3h4.5"/></svg>`;
    }
    if (name === 'x') {
      return `${start}<path d="m7 7 10 10M17 7 7 17"/></svg>`;
    }
    return `${start}</svg>`;
  };

  function bindCardSheen(card){
    if (!card || prefersReducedMotion) return;
    const update = (ev) => {
      const rect = card.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      const y = ((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
      const xClamped = Math.max(0, Math.min(100, x)).toFixed(2);
      const yClamped = Math.max(0, Math.min(100, y)).toFixed(2);
      card.style.setProperty('--shine-x', `${xClamped}%`);
      card.style.setProperty('--shine-y', `${yClamped}%`);
    };
    const clear = () => {
      card.style.removeProperty('--shine-x');
      card.style.removeProperty('--shine-y');
    };
    card.addEventListener('pointerenter', update, { passive:true });
    card.addEventListener('pointermove', update, { passive:true });
    card.addEventListener('pointerleave', clear, { passive:true });
    card.addEventListener('pointercancel', clear, { passive:true });
  }

  works.forEach(w => {
    const cues = Array.isArray(w.cues) ? w.cues : [];
    const tags = Array.isArray(w.tags)
      ? w.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : [];
    const el = document.createElement('article');
    el.className = 'work';
    el.id = 'work-' + (w.slug || w.id);

    // cue chips => "Play @MM:SS"
    const cueHtml = cues.length
      ? `<ul class="cues">${cues.map(c => {
          const t = Number(c.t) || 0;
          return `<li><button class="chip" type="button" data-act="play" data-id="${w.id}" data-t="${t}" aria-label="Play at ${formatTime(t)}">
                    ${icon('play')}
                    <span>Play ${esc(labelFor(t, c.label))}</span>
                  </button></li>`;
        }).join('')}</ul>`
      : '';
    const coverUrl = normalizeCoverUrl(w);
    const coverHtml = coverUrl
      ? `<figure class="work-cover"><img src="${esc(coverUrl)}" alt="" loading="lazy" onerror="this.style.display='none';var fb=this.nextElementSibling;if(fb)fb.hidden=false;"><span class="work-cover-fallback" hidden>Cover unavailable</span></figure>`
      : `<div class="work-cover work-cover-fallback" aria-hidden="true"></div>`;
    const tagHtml = tags.length
      ? `<ul class="work-tags">${tags.map((tag) => `<li class="work-tag">${esc(tag)}</li>`).join('')}</ul>`
      : '';

    el.innerHTML = `
      <header class="work-head">
        <div class="work-head-copy">
          <h2><span class="work-title">${esc(w.title)}</span></h2>
          <p class="muted">${esc(w.slug)}</p>
        </div>
        ${coverHtml}
      </header>
      <p class="one">${esc(w.onelinerEffective || '')}</p>
      ${tagHtml}
      ${cueHtml}
      <div class="actions">
        <button class="btn" type="button" data-act="open" data-id="${w.id}">${icon('eye')}<span>Open</span></button>
        <button class="btn" type="button" data-act="copy" data-id="${w.id}">${icon('link')}<span>Copy URL</span></button>
        ${w.pdf ? `<button class="btn" type="button" data-act="pdf" data-id="${w.id}">${icon('document')}<span>PDF</span></button>` : ''}
      </div>
      <div class="note" hidden></div>`;
    host.appendChild(el);
    bindCardSheen(el);

    // Ensure a matching <audio> exists (id = wc-a<ID>)
    ensureAudioFor(w);
  });

  // ---------------- Interactions ----------------
  // HUD toggle
  if (hudBox) hudBox.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-hud="toggle"]'); if (!btn) return;
    const now = getActiveAudioInfo();
    if (now.source === 'youtube' && youtubeController && typeof youtubeController.pause === 'function') {
      hudState.last = { id: now.id, at: getPageFollowSeconds() || 0 };
      youtubeController.pause();
      hudSetPlaying(false);
      return;
    }
    if (now.audio && !now.audio.paused){
      hudState.last = { id: now.id, at: now.audio.currentTime||0 };
      now.audio.pause();
      hudUpdate(now.id, now.audio);
      return;
    }
    const id = hudState.last.id || (works[0] && works[0].id); if (!id) return;
    playAt(id, hudState.last.at||0);
  });
  host.addEventListener('click', (e)=>{
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (!act) return;                // allow normal <a> links (none used now)
    e.preventDefault();

    if (act === 'open') {
      const id = Number(btn.getAttribute('data-id')||0);
      const w  = findWorkById(id)?.data; if (!w) return;
      const card = document.getElementById('work-'+(w.slug||w.id));
      const note = card?.querySelector('.note');
      if (!note) return;
      if (note.hasChildNodes()) {
        const isHidden = note.hasAttribute('hidden');
        note.toggleAttribute('hidden', !isHidden);
        const nextOpen = isHidden;
        btn.classList.toggle('is-open', nextOpen);
        const label = btn.querySelector('span:last-child');
        if (label) label.textContent = nextOpen ? 'Close' : 'Open';
      } else {
        const paras = [];
        if (w.descriptionEffective) paras.push(w.descriptionEffective);
        else if (w.onelinerEffective) paras.push(w.onelinerEffective);
        if (Array.isArray(w.openNote)) paras.push(...w.openNote);
        else if (w.openNote) paras.push(String(w.openNote));
        paras.forEach(p=>{
          const d = document.createElement('p');
          d.textContent = String(p||'');
          note.appendChild(d);
        });
        note.removeAttribute('hidden');
        btn.classList.add('is-open');
        const label = btn.querySelector('span:last-child');
        if (label) label.textContent = 'Close';
      }
    }

    if (act === 'play') {
      const id = Number(btn.getAttribute('data-id')||0);
      const t  = Number(btn.getAttribute('data-t')||0);
      playAt(id, t);
    }

    if (act === 'copy') {
      const id  = Number(btn.getAttribute('data-id')||0);
      const url = deepUrl(id);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(()=> flash(btn, 'copied'));
      } else {
        flash(btn, url);
      }
    }
    if (act === 'pdf') {
      const id = Number(btn.getAttribute('data-id')||0);
      openPdfFor(id);
    }
  });
  
  // PDF close + Esc
  pdfClose?.addEventListener('click', hidePdfPane);
  if (pdfClose && !pdfClose.dataset.iconized) {
    pdfClose.innerHTML = `${icon('x')}<span>Close</span>`;
    pdfClose.dataset.iconized = '1';
  }
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && shell?.classList.contains('has-pdf')) hidePdfPane();
  }, { passive:true });
  }

  // ---------------- Helpers ----------------
  function resolveWorkMedia(work){
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

  function ensureAudioFor(w){
    let a = document.getElementById('wc-a'+w.id);
    if (!a) {
      a = document.createElement('audio');
      a.id = 'wc-a'+w.id;
      a.preload = 'none';
      a.playsInline = true;
      if (w.audio) a.setAttribute('data-audio', w.audio);
      document.body.appendChild(a);
    }
    return a;
  }

  async function playYouTubeAt(work, id, t, media){
    if (!praeMedia || typeof praeMedia.mountYouTubePlayer !== 'function') {
      flash(null, 'YouTube runtime unavailable; opening tab and disabling sync');
      detachPageFollow();
      if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
        praeMedia.openYouTubeTab(work);
      }
      return;
    }
    if (window.PRAE && typeof window.PRAE.pauseAllAudio === 'function') {
      window.PRAE.pauseAllAudio(id);
    }
    showYouTubePane(work, media);
    try {
      const controller = await praeMedia.mountYouTubePlayer(pdfFrame, work, {
        onError: function(err){
          const code = Number(err?.code);
          flash(null, `YouTube embed blocked${Number.isFinite(code) ? ` (error ${code})` : ''}; opening tab`);
          detachPageFollow();
          if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
            praeMedia.openYouTubeTab(work);
          }
        }
      });
      youtubeController = controller;
      youtubeWorkId = id;
      const seek = Number.isFinite(Number(t)) ? Number(t) : Number(media.startAtSec || 0);
      if (typeof controller.seekTo === 'function') controller.seekTo(Math.max(0, seek));
      if (typeof controller.play === 'function') controller.play();
      hudState.last = { id: id, at: Math.max(0, seek) };
      if (praeMedia && typeof praeMedia.attachPageFollow === 'function') {
        detachPageFollow();
        pageFollow.token = praeMedia.attachPageFollow(work, { kind: 'youtube', controller });
        pageFollow.slug = work.slug || null;
        pageFollow.sourceKind = 'youtube';
      }
      hudSetTitle('Now playing — ' + String(work.title || work.slug || ('Work ' + id)));
      hudSetSubtitle('YouTube stream');
      hudSetPlaying(true);
    } catch (_) {
      flash(null, 'YouTube blocked; opening tab');
      detachPageFollow();
      if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
        praeMedia.openYouTubeTab(work);
      }
    }
  }

  function playAt(id, t){
    const meta = findWorkById(id);
    if (!meta) return;
    const media = resolveWorkMedia(meta.data);
    if (media.kind === 'youtube') {
      playYouTubeAt(meta.data, id, t, media);
      return;
    }
    const a = document.getElementById('wc-a'+id) || ensureAudioFor(meta.data);
    // lazy source
    if (!a.src) {
      const raw = a.getAttribute('data-audio') || meta.data.audio || '';
      const src = normalizeSrc(raw);
      if (src) { a.src = src; a.load(); }
    }
    const seekAndPlay = ()=>{
      try {
        if (window.PRAE && typeof window.PRAE.pauseAllAudio === 'function') {
          window.PRAE.pauseAllAudio(id);
        }
      } catch (_) {}
      try { a.currentTime = Math.max(0, t|0); } catch(_){}
      const p = a.play();
      if (p && typeof p.catch === 'function'){
        p.catch(err=>{
          if (err && err.name === 'NotAllowedError') flash(null, 'Autoplay blocked — click again');
        });
      }
      markPlaying(id, true);
      // Keep HUD in sync
      bindAudio(id);
      requestAnimationFrame(()=> hudUpdate(id, a));
      // NEW: enable page-follow for this work
      const meta = findWorkById(id);
      if (meta?.data?.slug) attachPageFollow(meta.data.slug, a);
    };
    if (a.readyState >= 1) seekAndPlay();
    else a.addEventListener('loadedmetadata', ()=> seekAndPlay(), { once:true });
  }
  
  function openPdfFor(id){
    const meta = findWorkById(id);
    if (!meta) return;
    const w = meta.data;
    if (!w.pdf) return;
    const raw = normalizePdfUrl(w.pdf);
    const src = choosePdfViewer(raw);
// choosePdfViewer() always returns an absolute URL
    const abs = src;
          
          // If split-pane elements are missing (older markup), fall back to new tab (same behavior as before)
    if (!shell || !pdfPane || !pdfFrame) {
      window.open(abs, '_blank', 'noopener');
      return;
    }

    // Decide initial page: use page-follow map if available
    let initPage = 1;
     currentPdfSlug = w.slug || null;
    try {
      // If we’re already following THIS work’s audio, start at the current page
      if (pageFollow.slug && pageFollow.slug === currentPdfSlug) {
        initPage = computePdfPage(pageFollow.slug, getPageFollowSeconds());
      } else if (pfMap[currentPdfSlug]) {
        initPage = computePdfPage(currentPdfSlug, 0);
      }
    } catch(_){}
    // Set up UI and load
    if (pdfTitle) pdfTitle.textContent = String(w.title || 'Score');
    shell?.classList.add('has-pdf');
    if (pdfPane) pdfPane.removeAttribute('aria-hidden');
    setEmbedFrameMode(pdfFrame, 'pdf');
    // Reset viewer (avoid stale hash race)
    const isPdfJs = /\/viewer\.html/i.test(abs);
    const base    = abs.split('#')[0];
    pdfFrame.src  = 'about:blank';
    // Next tick load the intended URL
    requestAnimationFrame(()=> {
pdfViewerReady = false;
      pdfFrame.src = `${base}#page=${Math.max(1, initPage)}&zoom=page-width&toolbar=0&sidebar=0`;
    });
  }

  function showYouTubePane(work, media){
    if (!shell || !pdfPane || !pdfFrame) {
      detachPageFollow();
      if (praeMedia && typeof praeMedia.openYouTubeTab === 'function') {
        praeMedia.openYouTubeTab(work);
      }
      return;
    }
    currentPdfSlug = work.slug || null;
    if (pdfTitle) pdfTitle.textContent = String(work.title || 'YouTube');
    shell.classList.add('has-pdf');
    pdfPane.removeAttribute('aria-hidden');
    pdfViewerReady = false;
    setEmbedFrameMode(pdfFrame, 'youtube');
    const src = media?.youtubeEmbedUrl || media?.youtubeUrl || 'about:blank';
    pdfFrame.src = src;
  }

  function getPageFollowSeconds(){
    if (pageFollow.sourceKind === 'youtube' && youtubeController && typeof youtubeController.getCurrentTime === 'function') {
      try { return Number(youtubeController.getCurrentTime() || 0); } catch (_) { return 0; }
    }
    return Number(pageFollow.audio?.currentTime || 0);
  }
  function hidePdfPane(){
    if (youtubeController && typeof youtubeController.pause === 'function') {
      try { youtubeController.pause(); } catch (_) {}
    }
    shell?.classList.remove('has-pdf');
    pdfPane?.setAttribute('aria-hidden','true');
    pdfFrame.src = 'about:blank';
    currentPdfSlug = null;
    pdfViewerReady = false;
    youtubeController = null;
    youtubeWorkId = null;
  }

  function markPlaying(id, on){
    const w = findWorkById(id);
    if (!w) return;
    w.el?.classList.toggle('playing', !!on);
    const a = document.getElementById('wc-a'+id);
    if (!a) return;
    const off = ()=> { w.el?.classList.remove('playing'); a.removeEventListener('pause', off); a.removeEventListener('ended', off); };
    a.addEventListener('pause', off, { once:true });
    a.addEventListener('ended', off, { once:true });
  }

  function deepUrl(id){
    const w = findWorkById(id)?.data;
    if (!w) return location.href;
    return `${location.origin}${location.pathname}#work-${w.id}`;
  }

  function findWorkById(id){
    const num = Number(id);
    for (const w of works){
      if (Number(w.id) === num) return { data: w, el: document.getElementById('work-' + (w.slug || w.id)) };
    }
    return null;
  }

  function labelFor(t, label){
    if (label && /^@?\d+:\d{2}$/.test(label)) return label.replace(/^@?/, '@');
    return '@' + formatTime(t);
  }
  function formatTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    const m = Math.floor(sec/60), s = (sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }
  function normalizeSrc(u){
    if(!u) return '';
    const m = u.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
    if(m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    return u;
  }
  function normalizePdfUrl(u){
    if (praeMedia && typeof praeMedia.normalizePdfUrl === 'function') {
      try { return praeMedia.normalizePdfUrl(u); } catch (_) {}
    }
    if(!u) return '';
    const m = u.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
    if(m) return `https://drive.google.com/file/d/${m[1]}/view?usp=drivesdk`;
    return u;
  }
  function normalizeCoverUrl(work){
    const raw = work && typeof work === 'object' ? (work.cover ?? work.coverUrl ?? null) : null;
    if (raw == null) return '';
    if (praeMedia && typeof praeMedia.normalizeCoverUrl === 'function') {
      try { return String(praeMedia.normalizeCoverUrl(raw) || '').trim(); } catch (_) {}
    }
    return String(raw).trim();
  }
  
  function choosePdfViewer(url){
  if (praeMedia && typeof praeMedia.choosePdfViewer === 'function') {
    try {
      const chosen = praeMedia.choosePdfViewer(url);
      if (chosen) return chosen;
    } catch (_) {}
  }
  const m = url.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

  
  
  // Minimal printed→PDF page support (if pageFollowMaps exists)
  function computePdfPage(slug, tSec){
    const cfg = pfMap[slug]; if (!cfg) return 1;
    if (praeMedia && typeof praeMedia.computePdfPage === 'function') {
      try { return praeMedia.computePdfPage(cfg, tSec || 0); } catch (_) {}
    }
    const printed = printedPageForTime(cfg, tSec||0);
    return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
  }
  function printedPageForTime(cfg, tSec){
    if (praeMedia && typeof praeMedia.printedPageForTime === 'function') {
      try { return praeMedia.printedPageForTime(cfg, tSec || 0); } catch (_) {}
    }
    const T = (tSec || 0) + (cfg.mediaOffsetSec || 0);
    let current = cfg.pageMap?.[0]?.page ?? 1;
    for(const row of (cfg.pageMap || [])){
      const at = (typeof row.at === 'number') ? row.at : time(row.at);
      if(T >= at) current = row.page; else break;
    }
    return current;
  }
  function time(s){
    if(typeof s === 'number') return s;
    if(!s) return 0;
    if(/^\d+$/.test(s)) return parseInt(s,10);
    const m = String(s).match(/^(\d+):([0-5]?\d)$/);
    if(!m) return 0;
    return parseInt(m[1],10)*60 + parseInt(m[2],10);
  }
  

  function gotoPdfPage(pageNum){
    if (!pdfFrame || !pdfFrame.src) return;
    // Only handle Mozilla PDF.js viewer
    if (!/\/viewer\.html/i.test(pdfFrame.src)) return;
    const url  = new URL(pdfFrame.src, location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const cur  = Number(hash.get('page') || '1');
    const next = Number(pageNum || 1);
    if (cur === next) return;
    hash.set('page', String(next));
    if (!hash.has('zoom'))    hash.set('zoom','page-width');
    if (!hash.has('sidebar')) hash.set('sidebar','0');
    url.hash = '#' + hash.toString();
    pdfFrame.src = url.toString();
  }

  

  // Accept ticks from the audio side
  window.addEventListener('wc:pdf-goto', (e) => {
    const { slug, pdfPage } = (e && e.detail) || {};
    if (!pdfViewerReady || !shell?.classList.contains('has-pdf') || (slug && slug !== currentPdfSlug)) {
      pendingPdfGoto = { slug, pdfPage };
      return;
    }
    gotoPdfPage(pdfPage);
  });
  function detachPageFollow(){
    if (pageFollow.token && typeof pageFollow.token.detach === 'function') {
      try { pageFollow.token.detach(); } catch (_) {}
    }
    if (pageFollow.audio && pageFollow._on){
      pageFollow.audio.removeEventListener('timeupdate', pageFollow._on);
      pageFollow.audio.removeEventListener('seeking', pageFollow._on);
    }
    pageFollow = { audio:null, slug:null, lastPrinted:null, _on:null, token:null, sourceKind:'audio' };
  }
  function attachPageFollow(slug, audio){
    detachPageFollow();
    if (!slug || !audio) return;
    const work = works.find((w) => w && w.slug === slug) || null;
    if (praeMedia && typeof praeMedia.attachPageFollow === 'function' && work) {
      pageFollow = {
        audio,
        slug,
        lastPrinted:null,
        _on:null,
        token: praeMedia.attachPageFollow(work, { kind: 'audio', audio }),
        sourceKind:'audio'
      };
      if (pageFollow.token && typeof pageFollow.token.tick === 'function') {
        try { pageFollow.token.tick(); } catch (_) {}
      }
      return;
    }
    const cfg = pfMap[slug];
    if (!cfg) return;
    const onTick = ()=>{
      const printed = printedPageForTime(cfg, audio.currentTime || 0);
      if (printed !== pageFollow.lastPrinted){
        pageFollow.lastPrinted = printed;
        const pdfPage = computePdfPage(slug, audio.currentTime || 0);
        window.dispatchEvent(new CustomEvent('wc:pdf-goto', {
          detail: { slug, printedPage: printed, pdfPage }
        }));
      }
    };
    pageFollow = { audio, slug, lastPrinted:null, _on:onTick, token:null, sourceKind:'audio' };
    audio.addEventListener('timeupdate', onTick, { passive:true });
    audio.addEventListener('seeking', onTick, { passive:true });
    onTick();
  }
    // ---- HUD helpers ----
  function getActiveAudioInfo(){
    if (youtubeController && youtubeWorkId != null && typeof youtubeController.isPlaying === 'function') {
      try {
        if (youtubeController.isPlaying()) return { id: youtubeWorkId, audio: null, source:'youtube' };
      } catch (_) {}
    }
    for (const w of works){
      const a = document.getElementById('wc-a'+w.id);
      if (a && !a.paused && !a.ended) return { id:w.id, audio:a, source:'audio' };
    }
    return { id:null, audio:null, source:null };
  }

  function hudUpdate(id, a){
    const r = ensureHudDom(); if (!r) return;
    const w   = findWorkById(id)?.data;
    const name= w ? w.title : '—';
    const dur = (a && Number.isFinite(a.duration)) ? formatTime(a.duration|0) : '--:--';
    const cur = (a && Number.isFinite(a.currentTime)) ? formatTime(a.currentTime|0) : '0:00';
    const ratio = (a && a.duration) ? Math.max(0, Math.min(1, (a.currentTime||0) / Math.max(1, a.duration))) : 0;
    r.title.textContent = `Now playing — ${name}`;
    hudSetSubtitle(`${cur} / ${dur} · vol:${Math.round(((a ? a.volume : 1)*100))} · speed:${(a ? a.playbackRate : 1).toFixed(2)}x`);
    hudSetProgress(ratio);
    hudSetPlaying(!!(a && !a.paused));
  }

  function bindAudio(id){
    const a = document.getElementById('wc-a'+id); if (!a) return;
    if (!a.dataset.hud){
      a.addEventListener('timeupdate',    ()=> hudUpdate(id,a), { passive:true });
      a.addEventListener('ratechange',    ()=> hudUpdate(id,a), { passive:true });
      a.addEventListener('volumechange',  ()=> hudUpdate(id,a), { passive:true });
      a.addEventListener('loadedmetadata',()=> hudUpdate(id,a), { once:true, passive:true });
      a.addEventListener('ended',         ()=> hudUpdate(id,a), { passive:true });
      a.dataset.hud = '1';
    }
  }
  // Ensure HUD is visible even if skin CSS omits it
  function injectHudCssOnce(){
    if (document.getElementById('prae-hud-css')) return;
    const css = `
      #wc-hud{display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;
        border:1px solid var(--line,#2a2a2a);border-radius:12px;
        background:var(--panel,rgba(255,255,255,.03));margin:0 0 12px}
      #wc-hud .meter{flex:1;height:4px;background:var(--line,#2a2a2a);
        border-radius:999px;overflow:hidden}
      #wc-hud .meter>span{display:block;height:100%;inset:0 100% 0 0;background:var(--fg,#fff)}
      #wc-hud .tag,#wc-hud .hud-time,#wc-hud .soft{font:inherit;opacity:.85}
      #wc-hud .hud-actions .hud-btn{cursor:pointer}
    `;
    const s = document.createElement('style');
    s.id = 'prae-hud-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  
  function flash(el, text){
    try{
      const n = document.createElement('span');
      n.className = 'flash';
      n.textContent = text;
      (el?.parentElement || host).appendChild(n);
      requestAnimationFrame(()=> n.classList.add('in'));
      setTimeout(()=> n.classList.remove('in'), 1400);
      setTimeout(()=> n.remove(), 1700);
    }catch(_){}
  }
  function esc(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();


;(function enhanceHudIcons(){
  if (typeof document === 'undefined') return;
  const SELECTOR = '#vb-hud .hud-actions .hud-btn, #wc-hud .hud-actions .hud-btn';

  const createIcon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-hud-icon', name);

    if (name === 'pause') {
      const left = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      left.setAttribute('x', '7');
      left.setAttribute('y', '5');
      left.setAttribute('width', '4');
      left.setAttribute('height', '14');
      left.setAttribute('rx', '1.4');
      left.setAttribute('fill', 'currentColor');
      const right = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      right.setAttribute('x', '13');
      right.setAttribute('y', '5');
      right.setAttribute('width', '4');
      right.setAttribute('height', '14');
      right.setAttribute('rx', '1.4');
      right.setAttribute('fill', 'currentColor');
      svg.append(left, right);
    } else {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M9 5.75a.75.75 0 0 1 1.14-.63l7.5 5.25a.75.75 0 0 1 0 1.26l-7.5 5.25A.75.75 0 0 1 9 16.89V5.75Z');
      path.setAttribute('fill', 'currentColor');
      svg.append(path);
    }
    return svg;
  };

  const resolveIconName = (btn) => {
    const attr = (btn.getAttribute('data-icon') || '').toLowerCase();
    if (attr === 'pause' || attr === 'play') return attr;
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('pause')) return 'pause';
    return 'play';
  };

  const resolveLabel = (btn, icon) => {
    const label = btn.getAttribute('aria-label');
    if (label && label.trim().length) return label;
    return icon === 'pause' ? 'Pause' : 'Play';
  };

  const updateButton = (btn) => {
    const icon = resolveIconName(btn);
    const label = resolveLabel(btn, icon);

    let sr = btn.querySelector('.hud-sr');
    if (!sr) {
      sr = document.createElement('span');
      sr.className = 'hud-sr';
      btn.prepend(sr);
    }
    sr.textContent = label;

    const next = createIcon(icon);
    const current = btn.querySelector('svg[data-hud-icon]');
    if (current) {
      current.replaceWith(next);
    } else {
      btn.append(next);
    }
  };

  const enhanceButton = (btn) => {
    if (!btn || btn.dataset.hudIconReady === '1') {
      if (btn) updateButton(btn);
      return;
    }
    btn.dataset.hudIconReady = '1';
    updateButton(btn);
    const observer = new MutationObserver(() => updateButton(btn));
    observer.observe(btn, { attributes: true, attributeFilter: ['aria-label', 'data-icon'] });
    btn.__hudIconObserver = observer;
  };

  const applyAll = () => {
    const buttons = document.querySelectorAll(SELECTOR);
    if (!buttons.length) return false;
    buttons.forEach(enhanceButton);
    return true;
  };

  const boot = () => {
    if (applyAll()) return;
    const target = document.body || document.documentElement;
    const watcher = new MutationObserver(() => {
      if (applyAll()) watcher.disconnect();
    });
    watcher.observe(target, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
