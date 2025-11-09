;(function(){
  const qs = new URLSearchParams(location.search)
  const urlSkin = qs.get('skin')
  if (urlSkin) document.documentElement.setAttribute('data-skin', urlSkin)

  const PRAE = (window.PRAE = window.PRAE || {})
  const works = Array.isArray(PRAE.works) ? PRAE.works : []
  const pfMap = PRAE.pageFollowMaps || {}
  const site  = (PRAE.config && PRAE.config.site) || {}

  if (typeof PRAE.ensureAudioTags === 'function') PRAE.ensureAudioTags()

  const host = document.querySelector('#works-console')
  const headerNav = document.getElementById('prae-nav')
  const footer = document.getElementById('prae-footer')
  if (!host) return

  // ---------- header nav from .prae/config.json ----------
  if (headerNav && Array.isArray(site.links)) {
    headerNav.innerHTML = site.links
      .filter(l => (l && l.label))
      .map(l => `<a href="${esc(l.href||'#')}" ${l.external?'target="_blank" rel="noopener"':''}>${esc(l.label)}</a>`)
      .join('')
  }

  // ---------- footer to mirror console data ----------
  if (footer) {
    const name = site.copyrightName || site.fullName || [site.firstName, site.lastName].filter(Boolean).join(' ') || '—'
    const updated = (site.updated && site.updated.mode === 'manual')
      ? (site.updated.value || '')
      : new Date().toLocaleDateString()
    const links = Array.isArray(site.links) ? site.links : []
    footer.innerHTML = `
      <div class="left">© ${esc(String(name))}${updated ? ` · Updated ${esc(String(updated))}` : ''}</div>
      <div class="links">
        ${links.map(l => `<a href="${esc(l.href||'#')}" ${l.external?'target="_blank" rel="noopener"':''}>${esc(l.label||'Link')}</a>`).join('')}
      </div>
    `
  }

  // ---------- works renderer (one-column, console content parity) ----------
  host.innerHTML = ''
  works.forEach(w => {
    const el = document.createElement('article')
    el.className = 'work'
    el.id = 'work-' + (w.slug || w.id)

    const cues = Array.isArray(w.cues) ? w.cues : []
    const cueHtml = cues.length
      ? `<ul class="cues">${cues.map(c => `
            <li><button class="chip" type="button" data-act="seek" data-id="${w.id}" data-t="${Number(c.t)||0}" aria-label="Seek to ${esc(c.label||'cue')}">
              <span>${esc(c.label || ('@'+(Number(c.t)||0)))}</span>
            </button></li>`).join('')}
         </ul>`
      : ''

    const hasScore = !!w.pdf
    const hasAudio = !!w.audio
    const followable = !!pfMap[w.slug]

    el.innerHTML = `
      <h2><span class="work-title">${esc(w.title)}</span> <span class="muted">(${esc(w.slug)})</span></h2>
      <p class="one">${esc(w.one || '')}</p>
      <div class="meta">
        ${hasAudio ? 'Audio' : ''}${hasAudio && hasScore ? ' · ' : ''}${hasScore ? 'Score PDF' : ''}
      </div>
      ${cueHtml}
      <div class="actions">
        ${hasAudio ? `<button class="btn primary" type="button" data-act="play" data-id="${w.id}">Play/Pause</button>` : ''}
        ${hasScore ? `<a class="btn" href="${esc(w.pdf)}" target="_blank" rel="noopener">Open Score</a>` : ''}
        ${followable ? `<button class="btn" type="button" data-act="follow" data-slug="${esc(w.slug)}" aria-pressed="false">Follow Score</button>` : ''}
      </div>
    `
    host.appendChild(el)
  })

  // ---------- interactions ----------
  host.addEventListener('click', e => {
    const btn = e.target.closest('button, a')
    if (!btn) return
    const act = btn.getAttribute('data-act')
    if (!act) return
    e.preventDefault()

    if (act === 'play') {
      const id = btn.getAttribute('data-id')
      const a  = document.getElementById('wc-a' + id)
      if (!a) return
      if (a.paused) {
        a.src = a.getAttribute('data-audio') || a.src
        a.play().catch(()=>{})
        markPlaying(id, true)
      } else {
        a.pause()
        markPlaying(id, false)
      }
    }

    if (act === 'seek') {
      const id = btn.getAttribute('data-id')
      const t  = Number(btn.getAttribute('data-t')||0)
      const a  = document.getElementById('wc-a' + id)
      if (!a) return
      try {
        a.src = a.getAttribute('data-audio') || a.src
        a.currentTime = t
        a.play().catch(()=>{})
        markPlaying(id, true)
      } catch {}
    }

    if (act === 'follow') {
      const slug = btn.getAttribute('data-slug') || ''
      const on = btn.getAttribute('aria-pressed') === 'true'
      const next = !on
      btn.setAttribute('aria-pressed', String(next))
      // Dispatch a pair of light-weight hooks other code can listen to
      if (next) {
        const detail = { slug, map: pfMap[slug] }
        window.dispatchEvent(new CustomEvent('prae:pagefollow:start', { detail }))
      } else {
        const detail = { slug }
        window.dispatchEvent(new CustomEvent('prae:pagefollow:stop', { detail }))
      }
    }
  })

  // Highlight currently playing work
  function markPlaying(id, on){
    const w = findWorkById(id)
    if (!w) return
    w.el.classList.toggle('playing', !!on)
    if (on && w.audio) {
      const a = document.getElementById('wc-a' + id)
      if (a) {
        const off = () => { w.el.classList.remove('playing'); a.removeEventListener('pause', off); a.removeEventListener('ended', off) }
        a.addEventListener('pause', off)
        a.addEventListener('ended', off)
      }
    }
  }

  function findWorkById(id){
    const num = Number(id)
    for (const w of works){
      if (Number(w.id) === num) return { data: w, el: document.getElementById('work-' + (w.slug || w.id)) }
    }
    return null
  }

  function esc(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  }
})()