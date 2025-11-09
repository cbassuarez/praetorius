(function(){
  // Simple docs from PRAE.config + works => demo pages
  const nav = document.getElementById('dr-nav');
  const art = document.getElementById('dr-article');
  const toc = document.getElementById('dr-toc');

  const pages = [
    { id:'install', title:'Install', html: `
      <h1>Install</h1>
      <pre><code>npm i -g praetorius</code></pre>`},
    { id:'first-run', title:'First Run', html: `
      <h1>First Run</h1>
      <pre><code>prae init -o prae-out
prae add
prae generate -o dist --minify
prae preview</code></pre>`},
    { id:'ui-modes', title:'UI Modes', html: `
      <h1>UI Modes</h1>
      <p>Skins available: <code>console</code>, <code>vite-breeze</code>, <code>cards-tabs</code>, <code>docs-reader</code>.</p>
      <pre><code>prae generate --skin vite-breeze</code></pre>`}
  ];

  pages.forEach(p=>{
    const a=document.createElement('a');
    a.textContent=p.title; a.href='#'+p.id;
    nav.appendChild(a);
  });

  function render(hash){
    const id=(hash||location.hash||'#install').replace('#','');
    document.querySelectorAll('#dr-nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')==='#'+id));
    const pg=pages.find(x=>x.id===id) || pages[0];
    art.innerHTML = pg.html + '<button class="copy">Copy</button>';
    buildToc();
    wireCopy();
  }

  function buildToc(){
    toc.innerHTML='';
    art.querySelectorAll('h1,h2,h3').forEach(h=>{
      const a=document.createElement('a'); a.textContent=h.textContent; a.href='#'+(h.id||(h.id=slug(h.textContent)));
      toc.appendChild(a);
    });
  }

  function wireCopy(){
    const btn=art.querySelector('.copy');
    if(!btn) return;
    btn.addEventListener('click',()=>{
      const code=art.querySelector('pre code'); if(code){ navigator.clipboard.writeText(code.innerText||''); btn.textContent='Copied'; setTimeout(()=>btn.textContent='Copy',1200); }
    });
  }

  function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
  window.addEventListener('hashchange',()=>render());
  render();
})();
