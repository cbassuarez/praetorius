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
  const works = Array.isArray(PRAE.works) ? PRAE.works : [];
  const site  = (PRAE.config && PRAE.config.site) || {};
  const pfMap = PRAE.pageFollowMaps || {}; // <— FIX: was missing
  if (typeof PRAE.ensureAudioTags === 'function') PRAE.ensureAudioTags();

  // DOM refs are bound inside mount() so they exist when used
  let host, headerNav, footer, shell, pdfPane, pdfTitle, pdfClose, pdfFrame;
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
                    : (typeof w.openNote === 'string' && w.openNote.trim()) ? [w.openNote]
                    : (w.note && String(w.note).trim()) ? [w.note]
                    : (w.description && String(w.description).trim()) ? [w.description]
                    : (w.one && String(w.one).trim()) ? [w.one]
                    : ['No description yet.'];
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
    if (pfMap[w.slug]) {
      try { initPage = computePdfPage(w.slug, 0); } catch(_) {}
    }
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
      pdfFrame.src = isPdfJs
        ? `${base}#page=${Math.max(1, initPage)}&zoom=page-width&toolbar=0`
        : abs; // Drive preview or raw PDF
    });
  }
  function hidePdfPane(){
    shell?.classList.remove('has-pdf');
    pdfPane?.setAttribute('aria-hidden','true');
    pdfFrame.src = 'about:blank';
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
    // 1) Google Drive → use its embed (no CORS/XHR)
    const m = url.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;

    // 2) Same-origin / friendly CDNs → Mozilla’s hosted PDF.js viewer
    const sameOrigin = url.startsWith(location.origin);
    const corsOk = /^(https?:\/\/)?([^/]+\.)?(githubusercontent\.com|unpkg\.com|cloudflare-ipfs\.com|cbassuarez\.com|stagedevices\.com|dexdsl\.org)\//i.test(url);
    if (sameOrigin || corsOk){
      return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}#page=1&zoom=page-width&toolbar=0`;
    }

    // 3) Otherwise, fall back to the raw URL (browser PDF plugin)
    return url;
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