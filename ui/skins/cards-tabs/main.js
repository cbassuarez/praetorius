(function(){
  const works = (window.PRAE && window.PRAE.works) || [];
  if (window.PRAE && typeof window.PRAE.ensureAudioTags==='function') window.PRAE.ensureAudioTags();

  // metrics
  const m = document.getElementById('metrics');
  const metrics = [
    {label:'Works', value:String(works.length)},
    {label:'With Audio', value:String(works.filter(w=>!!w.audio).length)},
    {label:'With Scores', value:String(works.filter(w=>!!w.pdf).length)},
    {label:'Updated', value:(window.PRAE?.config?.site?.updated?.mode==='manual'
      ? (window.PRAE?.config?.site?.updated?.value||'—') : new Date().toLocaleDateString())}
  ];
  metrics.forEach(x=>{
    const el=document.createElement('div'); el.className='metric';
    el.innerHTML=`<div class="label">${esc(x.label)}</div><div class="value">${esc(x.value)}</div>`;
    m.appendChild(el);
  });

  // activity/feed = works list
  const feed = document.getElementById('feed');
  works.forEach(w=>{
    const el=document.createElement('article'); el.className='card';
    el.innerHTML = `<h3>${esc(w.title)} <span class="muted">(${esc(w.slug)})</span></h3>
      <p>${esc(w.one||'')}</p>
      <div class="actions">
        ${w.audio? `<button data-id="${w.id}" data-act="play">Play</button>`:''}
        ${w.pdf? `<a href="${esc(w.pdf)}" target="_blank" rel="noopener"><button>Score</button></a>`:''}
      </div>`;
    feed.appendChild(el);
  });

  feed.addEventListener('click',(e)=>{
    const b=e.target.closest('button[data-id]'); if(!b) return;
    const a=document.getElementById('wc-a'+b.getAttribute('data-id')); if(a){ a.src=a.getAttribute('data-audio')||a.src; a.play(); }
  });

  // tabs
  document.querySelectorAll('.db-tabs .tabs button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.db-tabs .tabs button').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.db-tabs .pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      const id='tab-'+btn.getAttribute('data-tab');
      document.getElementById(id)?.classList.add('active');
    });
  });

  function esc(s){return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
})();
