;(function(){
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
  if (typeof PRAE.ensureAudioTags === 'function') PRAE.ensureAudioTags();

  const host      = document.querySelector('#works-console');
  const headerNav = document.getElementById('prae-nav');
  const footer    = document.getElementById('prae-footer');
  if (!host) return;

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
        ${w.pdf ? `<a class="btn" href="${esc(w.pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}
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
    if (!act) return;
    if (btn.tagName === 'A') return; // PDF links pass through
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
        (w.openNote || []).forEach(p=>{
          const d = document.createElement('p'); d.textContent = String(p||'');
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
  });

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