// -------- Theme preboot (aligns with console) ----------
(function bootTheme(){
  function setThemeClasses(eff){
    var host = document.getElementById('works-console');
    try {
      host?.classList.remove('prae-theme-light','prae-theme-dark');
      host?.classList.add(eff === 'light' ? 'prae-theme-light' : 'prae-theme-dark');
    } catch(_) {}
  }
  function run(){
    try{
      var saved = localStorage.getItem('wc.theme');
      if (saved && saved.trim().charAt(0)==='{'){
        try { saved = (JSON.parse(saved)||{}).mode || 'dark'; } catch(_){ saved = 'dark'; }
      }
      var eff = (saved === 'light') ? 'light' : 'dark';
      document.getElementById('works-console')?.setAttribute('data-theme', eff);
      setThemeClasses(eff);
      document.documentElement.style.colorScheme = (eff === 'dark' ? 'dark' : 'light');
    }catch(e){}
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
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
  // ---------------- Theme preboot (console-compatible) ----------------
  (function bootTheme(){
    function setThemeClasses(eff){
      var host = document.getElementById('works-console');
      try {
        host?.classList.remove('prae-theme-light','prae-theme-dark');
        host?.classList.add(eff === 'light' ? 'prae-theme-light' : 'prae-theme-dark');
      } catch(_){}
    }
    function run(){
      try{
        var con   = document.getElementById('works-console');
        var saved = localStorage.getItem('wc.theme');
        if (saved && saved.trim().charAt(0)==='{'){
          try { saved = (JSON.parse(saved)||{}).mode || 'dark'; } catch(_){ saved = 'dark'; }
        }
        var eff = (saved === 'light') ? 'light' : 'dark';
        if (con){
          con.removeAttribute('data-theme-mode');
          con.setAttribute('data-theme', eff);
        }
        setThemeClasses(eff);
        document.documentElement.style.colorScheme = (eff === 'dark' ? 'dark' : 'light');
      } catch(e){}
    }
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', run, { once:true });
    } else {
      run();
    }
  })();

  // ---------------- Data + chrome ----------------
  const qs = new URLSearchParams(location.search);
  const urlSkin = qs.get('skin');
  if (urlSkin) document.documentElement.setAttribute('data-skin', urlSkin);

  const PRAE  = (window.PRAE = window.PRAE || {});
  // --- HUD bootstrap: create immediately so it always exists
const HUD_ID = 'wc-hud';
let hudBox = document.getElementById(HUD_ID);
if (!hudBox) {
  hudBox = document.createElement('div');
  hudBox.id = HUD_ID;
  hudBox.className = 'wc-hud';
  document.body.prepend(hudBox);           // visible even before shell binds
}

  const works = Array.isArray(PRAE.works) ? PRAE.works : [];
  const site  = (PRAE.config && PRAE.config.site) || {};
  const pfMap = PRAE.pageFollowMaps || {}; // <— FIX: was missing
  // ---- Shared state (hoisted to avoid TDZ in mount / listeners) ----
  let currentPdfSlug = null;
  let pdfViewerReady = false;
  let pendingPdfGoto = null;
  let pageFollow = { audio:null, slug:null, lastPrinted:null, _on:null };
  if (typeof PRAE.ensureAudioTags === 'function') PRAE.ensureAudioTags();

  // DOM refs are bound inside mount() so they exist when used
  let host, headerNav, footer, shell, pdfPane, pdfTitle, pdfClose, pdfFrame;
  let hudRefs = null;
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
    const name    = site.copyrightName || site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ') || '—';
    const updated = (site.updated && site.updated.mode === 'manual') ? (site.updated.value || '') : new Date().toLocaleDateString();
    const links   = Array.isArray(site.links) ? site.links : [];
    footer.innerHTML = `
      <div class="left">© ${esc(String(name))}${updated ? ` · Updated ${esc(String(updated))}` : ''}</div>
      <div class="links">
        ${links.map(l => `<a href="${esc(l.href||'#')}" ${l.external?'target="_blank" rel="noopener"':''}>${esc(l.label||'Link')}</a>`).join('')}
      </div>`;
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
ensureHudDom();

  works.forEach(w => {
    const cues = Array.isArray(w.cues) ? w.cues : [];
    const el = document.createElement('article');
    el.className = 'work';
    el.id = 'work-' + (w.slug || w.id);

    // cue chips => "Play @MM:SS"
    const cueHtml = cues.length
      ? `<ul class="cues">${cues.map(c => {
          const t = Number(c.t) || 0;
          return `<li><button class="chip" type="button" data-act="play" data-id="${w.id}" data-t="${t}" aria-label="Play at ${formatTime(t)}">
                    <span>Play ${esc(labelFor(t, c.label))}</span>
                  </button></li>`;
        }).join('')}</ul>`
      : '';

    el.innerHTML = `
      <h2><span class="work-title">${esc(w.title)}</span> <span class="muted">(${esc(w.slug)})</span></h2>
      <p class="one">${esc(w.one || '')}</p>
      ${cueHtml}
      <div class="actions">
        <button class="btn" type="button" data-act="open" data-id="${w.id}">Open</button>
        <button class="btn" type="button" data-act="copy" data-id="${w.id}">Copy URL</button>
        ${w.pdf ? `<button class="btn" type="button" data-act="pdf" data-id="${w.id}">PDF</button>` : ''}
      </div>
      <div class="note" hidden></div>`;
    host.appendChild(el);

    // Ensure a matching <audio> exists (id = wc-a<ID>)
    ensureAudioFor(w);
  });

  // ---------------- Interactions ----------------
  // HUD toggle
  hudBox.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-hud="toggle"]'); if (!btn) return;
    const now = getActiveAudioInfo();
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
      } else {
        // Accept array or string; fallback to other fields
        const paras = Array.isArray(w.openNote) ? w.openNote
                    : (w.openNote ? [w.openNote]
                    : (w.description ? [w.description]
                   : (w.one ? [w.one] : [])));
        paras.forEach(p=>{
          const d = document.createElement('p');
          d.textContent = String(p||'');
          note.appendChild(d);
        });
        note.removeAttribute('hidden');
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
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && shell?.classList.contains('has-pdf')) hidePdfPane();
  }, { passive:true });
  }

  // ---------------- Helpers ----------------
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

  function playAt(id, t){
    const meta = findWorkById(id);
    if (!meta) return;
    const a = document.getElementById('wc-a'+id) || ensureAudioFor(meta.data);
    // lazy source
    if (!a.src) {
      const raw = a.getAttribute('data-audio') || meta.data.audio || '';
      const src = normalizeSrc(raw);
      if (src) { a.src = src; a.load(); }
    }
    const seekAndPlay = ()=>{
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
        initPage = computePdfPage(pageFollow.slug, pageFollow.audio?.currentTime || 0);
      } else if (pfMap[currentPdfSlug]) {
        initPage = computePdfPage(currentPdfSlug, 0);
      }
    } catch(_){}
    // Set up UI and load
    if (pdfTitle) pdfTitle.textContent = String(w.title || 'Score');
    shell?.classList.add('has-pdf');
    if (pdfPane) pdfPane.removeAttribute('aria-hidden');
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
  function hidePdfPane(){
    shell?.classList.remove('has-pdf');
    pdfPane?.setAttribute('aria-hidden','true');
    pdfFrame.src = 'about:blank';
    currentPdfSlug = null;
    pdfViewerReady = false;
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
    if(!u) return '';
    const m = u.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
    if(m) return `https://drive.google.com/file/d/${m[1]}/view?usp=drivesdk`;
    return u;
  }
  
  function choosePdfViewer(url){
  const m = url.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
  const file = m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(file)}#page=1&zoom=page-width&toolbar=0&sidebar=0`;
}

  
  
  // Minimal printed→PDF page support (if pageFollowMaps exists)
  function computePdfPage(slug, tSec){
    const cfg = pfMap[slug]; if (!cfg) return 1;
    const printed = printedPageForTime(cfg, tSec||0);
    return (cfg.pdfStartPage || 1) + (printed - 1) + (cfg.pdfDelta ?? 0);
  }
  function printedPageForTime(cfg, tSec){
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
    if (pageFollow.audio && pageFollow._on){
      pageFollow.audio.removeEventListener('timeupdate', pageFollow._on);
      pageFollow.audio.removeEventListener('seeking', pageFollow._on);
    }
    pageFollow = { audio:null, slug:null, lastPrinted:null, _on:null };
  }
  function attachPageFollow(slug, audio){
    detachPageFollow();
    if (!slug || !audio) return;
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
    pageFollow = { audio, slug, lastPrinted:null, _on:onTick };
    audio.addEventListener('timeupdate', onTick, { passive:true });
    audio.addEventListener('seeking', onTick, { passive:true });
    onTick();
  }
    // ---- HUD helpers ----
  function getActiveAudioInfo(){
    for (const w of works){
      const a = document.getElementById('wc-a'+w.id);
      if (a && !a.paused && !a.ended) return { id:w.id, audio:a };
    }
    return { id:null, audio:null };
  }

  function ensureHudDom(){
    if (!hudBox) return null;
    if (hudRefs) return hudRefs;
    hudBox.innerHTML = `
      <div class="hud-left">
        <div class="hud-title"></div>
        <div class="hud-sub"></div>
      </div>
      <div class="hud-meter"><span></span></div>
      <div class="hud-actions">
        <button class="hud-btn" type="button" data-hud="toggle" aria-label="Play" data-icon="play"></button>
      </div>`;
    const title = hudBox.querySelector('.hud-title');
    const sub   = hudBox.querySelector('.hud-sub');
    const fill  = hudBox.querySelector('.hud-meter > span');
    const btn   = hudBox.querySelector('.hud-btn');
    hudRefs = { title, sub, fill, btn };
    return hudRefs;
  }

  function hudUpdate(id, a){
    const r = ensureHudDom(); if (!r) return;
    const w   = findWorkById(id)?.data;
    const name= w ? w.title : '—';
    const dur = (a && Number.isFinite(a.duration)) ? formatTime(a.duration|0) : '--:--';
    const cur = (a && Number.isFinite(a.currentTime)) ? formatTime(a.currentTime|0) : '0:00';
    const pct = (a && a.duration) ? Math.max(0, Math.min(100, (a.currentTime/a.duration)*100)) : 0;
    r.title.textContent = `Now playing — ${name}`;
    r.sub.textContent   = `${cur} / ${dur} · vol:${Math.round(((a ? a.volume : 1)*100))} · speed:${(a ? a.playbackRate : 1).toFixed(2)}x`;
    r.fill.style.width  = `${pct}%`;
    const playing = (a && !a.paused);
    r.btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    r.btn.dataset.icon = playing ? 'pause' : 'play';
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

