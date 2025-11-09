(function(){
  const qs = new URLSearchParams(location.search);
  const urlSkin = qs.get('skin');
  if (urlSkin) document.documentElement.setAttribute('data-skin', urlSkin);

  const works = (window.PRAE && window.PRAE.works) || [];
  if (window.PRAE && typeof window.PRAE.ensureAudioTags==='function') window.PRAE.ensureAudioTags();

  const host = document.querySelector('#works-console');
  host.innerHTML = '';
  works.forEach(w => {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <h3>${esc(w.title)} <span class="muted">(${esc(w.slug)})</span></h3>
      <p>${esc(w.one||'')}</p>
      <div class="actions">
        ${w.audio? `<button class="primary" data-id="${w.id}" data-act="play">Play/Pause</button>`:''}
        ${w.pdf? `<a class="btn" href="${esc(w.pdf)}" target="_blank" rel="noopener"><button>Open Score</button></a>`:''}
      </div>`;
    host.appendChild(el);
  });

  host.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const id = b.getAttribute('data-id');
    const a  = document.getElementById('wc-a'+id);
    if (a){ if (a.paused){ a.src=a.getAttribute('data-audio')||a.src; a.play(); } else { a.pause(); } }
  });

  function esc(s){return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
})();
