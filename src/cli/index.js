#!/usr/bin/env node
// Praetorius CLI — wizard + generate (with PDF page-follow support)

import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import pkg from 'enquirer';
const { prompt } = pkg;
import Ajv from 'ajv';
import updateNotifier from 'update-notifier';
import { normalizeWork, collectWorkWarnings } from '../work-model.js';

/* ------------------ templates FIRST (avoid TDZ) ------------------ */
const APPEARANCE_CSS = `/* Praetorius — global appearance tokens + presets */
:root{
  --prae-bg:#0f1728;
  --prae-surface:#eef2f8;
  --prae-surface-2:#d8e1ee;
  --prae-text:#112745;
  --prae-muted:#536b86;
  --prae-border:#4a6588;
  --prae-border-strong:#2f4a70;
  --prae-accent:#ff8f2f;
  --prae-accent-2:#2f7df0;
  --prae-hover-card-x:-2px;
  --prae-hover-card-y:-3px;
  --prae-hover-card-shadow:11px 11px 0 rgba(7,26,48,.28);
  --prae-hover-sheen-opacity:.52;
  --prae-hover-spot-opacity:.32;
  --prae-button-hover-x:-1px;
  --prae-button-hover-y:-1px;
  --prae-button-hover-shadow:4px 4px 0 rgba(7,26,48,.2);
}
body[data-hover-effect='minimal']{
  --prae-hover-card-x:0px;
  --prae-hover-card-y:0px;
  --prae-hover-card-shadow:var(--ct-shadow-hard, var(--k-shadow-hard, var(--vb-shadow, 8px 8px 0 rgba(7,26,48,.2))));
  --prae-hover-sheen-opacity:.12;
  --prae-hover-spot-opacity:.08;
}
body[data-hover-effect='high-drama']{
  --prae-hover-card-x:-4px;
  --prae-hover-card-y:-6px;
  --prae-hover-card-shadow:16px 16px 0 rgba(7,26,48,.34);
  --prae-hover-sheen-opacity:.78;
  --prae-hover-spot-opacity:.56;
}
body[data-button-effect='minimal']{
  --prae-button-hover-x:0px;
  --prae-button-hover-y:0px;
  --prae-button-hover-shadow:none;
}
body[data-button-effect='high-drama']{
  --prae-button-hover-x:-2px;
  --prae-button-hover-y:-2px;
  --prae-button-hover-shadow:7px 7px 0 rgba(7,26,48,.28);
}
body[data-cursor='block-square'],
body[data-cursor='block-square'] *{
  cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Crect x='4' y='4' width='12' height='12' fill='%23061018'/%3E%3C/svg%3E") 2 2, auto;
}
body[data-cursor='ring'],
body[data-cursor='ring'] *{
  cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='6' fill='none' stroke='%23061018' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='1.2' fill='%23ffffff'/%3E%3C/svg%3E") 12 12, auto;
}
body[data-cursor='prism-diamond'],
body[data-cursor='prism-diamond'] *{
  cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 3.8L20.2 12 12 20.2 3.8 12 12 3.8Z' fill='none' stroke='%23040d1b' stroke-width='2'/%3E%3Cpath d='M12 7.2 16.8 12 12 16.8 7.2 12 12 7.2Z' fill='none' stroke='%238ec3ff' stroke-width='1.1'/%3E%3Crect x='11.2' y='11.2' width='1.6' height='1.6' fill='%23ffffff'/%3E%3C/svg%3E") 12 12, auto;
}
@media (pointer: coarse){
  body[data-cursor],
  body[data-cursor] *{ cursor:auto !important; }
}
`;
// Theme tokens (light/dark only; no auto)
const THEME_CSS = `/* Praetorius — theme tokens */
#works-console.prae-theme-dark,
body.prae-theme-dark,
body[data-theme='dark']{
  --bg:var(--prae-bg,#0f1728);
  --fg:color-mix(in srgb, var(--prae-surface,#eef2f8) 90%, white);
  --dim:color-mix(in srgb, var(--prae-surface-2,#d8e1ee) 76%, var(--prae-muted,#64748b));
  --line:color-mix(in srgb, var(--prae-border,#4a6588) 40%, transparent);
}
#works-console.prae-theme-light,
body.prae-theme-light,
body[data-theme='light']{
  --bg:var(--prae-bg,#ffffff);
  --fg:var(--prae-text,#10213b);
  --dim:var(--prae-muted,#536b86);
  --line:color-mix(in srgb, var(--prae-border,#4a6588) 50%, transparent);
}
`;
const STARTER_CSS = `/* Praetorius Works Console — minimal CSS seed (merge with your global/page CSS) */
#works-console{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:var(--fg,#111);background:var(--bg,transparent);padding:.5rem}
#works-console a{color:inherit;text-decoration:underline}
#works-console .btn{padding:.4rem .7rem;border:1px solid var(--line,rgba(255,255,255,.18));border-radius:.6rem;background:transparent;cursor:pointer}#works-console .line{opacity:.92;transition:opacity .2s}
#works-console .line.muted{opacity:.62}
#works-console .actions{display:flex;gap:.6rem;margin:.25rem 0 .6rem}
#works-console .toast{position:sticky;bottom:.5rem;align-self:flex-end;padding:.5rem .7rem;border-radius:.6rem;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)}
`;
// Edit HUD in embed: generated from CLI; look for EMBED_RENDER block.
const HUD_EMBED_CSS = `#wc-hud[data-component="prae-hud"]{outline:1px solid transparent; /* HUD_SOURCE:embed */ display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;border:1px solid var(--line,rgba(255,255,255,.18));border-radius:12px;background:var(--panel,rgba(0,0,0,.35));-webkit-backdrop-filter:saturate(120%) blur(10px);backdrop-filter:saturate(120%) blur(10px);margin:0 0 12px;}
#wc-hud[data-component="prae-hud"] [data-part="title"]{font-weight:600;}
#wc-hud[data-component="prae-hud"] [data-part="meter"]{flex:1;height:4px;background:var(--line,rgba(255,255,255,.18));border-radius:999px;overflow:hidden;}
#wc-hud[data-component="prae-hud"] [data-part="meter"]>span{display:block;height:100%;width:0;background:var(--accent,#fff);transition:width .2s linear;}
#wc-hud[data-component="prae-hud"] [data-part="toggle"]{padding:6px 10px;border-radius:8px;border:1px solid var(--chip-bd,rgba(255,255,255,.16));background:var(--chip-bg,rgba(255,255,255,.06));color:inherit;cursor:pointer;}
#wc-hud[data-component="prae-hud"] [data-part="toggle"]:hover{background:var(--chip-bg-h,rgba(255,255,255,.1));}
#wc-hud[data-component="prae-hud"]:empty{display:none!important;}
`;
// Minimal renderer injected only for --embed so the snippet is self-contained.
const EMBED_RENDER = `(function(){
  /* HUD_SOURCE:embed (mirrors vite-breeze HUD API) */
  function ensureHudRoot(){
    var root = document.getElementById('wc-hud');
    if(!root){
      root = document.createElement('div');
      root.id = 'wc-hud';
      root.className = 'wc-hud';
      if(document.body.firstChild){ document.body.insertBefore(root, document.body.firstChild); }
      else { document.body.appendChild(root); }
    } else {
      root.id = 'wc-hud';
      if(!root.classList.contains('wc-hud')) root.classList.add('wc-hud');
    }
    root.setAttribute('data-component','prae-hud');
    return root;
  }
  function ensureHudDom(){
    var root = ensureHudRoot();
    if(!root) return null;
    if(root.dataset.hudBound === '1' && root.__praeHudRefs) return root.__praeHudRefs;
    root.innerHTML = ''+
      '<div class="hud-left">'+
        '<div class="hud-title" data-part="title"></div>'+
        '<div class="hud-sub" data-part="subtitle"></div>'+
      '</div>'+ 
      '<div class="hud-meter" data-part="meter"><span></span></div>'+ 
      '<div class="hud-actions">'+
        '<button class="hud-btn" type="button" data-part="toggle" data-hud="toggle" aria-label="Play" data-icon="play"></button>'+
      '</div>';
    var refs = {
      root: root,
      title: root.querySelector('[data-part="title"]'),
      sub: root.querySelector('[data-part="subtitle"]'),
      meter: root.querySelector('[data-part="meter"]'),
      fill: root.querySelector('[data-part="meter"] > span'),
      btn: root.querySelector('[data-part="toggle"]')
    };
    root.dataset.hudBound = '1';
    root.__praeHudRefs = refs;
    return refs;
  }
  function hudSetSubtitle(text){
    var refs = ensureHudDom();
    if(refs && refs.sub){ refs.sub.textContent = text == null ? '' : String(text); }
  }
  function hudSetPlaying(on){
    var refs = ensureHudDom();
    if(!refs || !refs.btn) return;
    refs.btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    refs.btn.setAttribute('data-icon', on ? 'pause' : 'play');
  }
  function hudSetProgress(ratio){
    var refs = ensureHudDom();
    if(!refs || !refs.fill) return;
    var pct = Math.max(0, Math.min(1, Number(ratio) || 0));
    refs.fill.style.width = (pct * 100) + '%';
  }
  function hudEnsure(){
    var refs = ensureHudDom();
    return refs ? refs.root : ensureHudRoot();
  }
  function hudGetRoot(){ return ensureHudRoot(); }
  function hudApplyApi(){
    var PRAE = window.PRAE = window.PRAE || {};
    var api = {
      ensure: hudEnsure,
      setSubtitle: hudSetSubtitle,
      setPlaying: hudSetPlaying,
      setProgress: hudSetProgress,
      getRoot: hudGetRoot
    };
    PRAE.hud = Object.assign({}, PRAE.hud || {}, api);
    return PRAE.hud;
  }
  function hudFormat(sec){
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60);
    var s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
  }
  function hudUpdate(id, audio){
    var refs = ensureHudDom();
    if(!refs) return;
    var worksById = (window.PRAE && window.PRAE.worksById) || {};
    var work = worksById && worksById[id];
    var title = work && work.title ? work.title : '—';
    var dur = (audio && isFinite(audio.duration)) ? hudFormat(audio.duration) : '--:--';
    var cur = (audio && isFinite(audio.currentTime)) ? hudFormat(audio.currentTime) : '0:00';
    refs.title.textContent = 'Now playing — ' + title;
    var vol = Math.round(((audio ? audio.volume : 1) * 100));
    var rate = (audio ? audio.playbackRate : 1).toFixed(2);
    hudSetSubtitle(cur + ' / ' + dur + ' · vol:' + vol + ' · speed:' + rate + 'x');
    var ratio = (audio && audio.duration) ? Math.max(0, Math.min(1, (audio.currentTime || 0) / Math.max(1, audio.duration))) : 0;
    hudSetProgress(ratio);
    hudSetPlaying(!!(audio && !audio.paused));
  }
  function bindAudio(id){
    var audio = document.getElementById('wc-a' + id);
    if(!audio || audio.dataset.hud === '1') return;
    var update = function(){ hudUpdate(id, audio); };
    audio.addEventListener('timeupdate', update, { passive:true });
    audio.addEventListener('ratechange', update, { passive:true });
    audio.addEventListener('volumechange', update, { passive:true });
    audio.addEventListener('loadedmetadata', update, { once:true });
    audio.addEventListener('play', update, { passive:true });
    audio.addEventListener('pause', update, { passive:true });
    audio.addEventListener('ended', update, { passive:true });
    audio.dataset.hud = '1';
  }
  function render(){
    try{
      var PRAE = window.PRAE = window.PRAE || {};
      var data = PRAE.works || [];
      console.log('[prae embed] works:', data.length);
      hudApplyApi().ensure();
      var refs = ensureHudDom();
      if(refs){
        refs.title.textContent = 'Now playing — —';
        hudSetSubtitle('');
        hudSetProgress(0);
        hudSetPlaying(false);
      }
      // Ensure a host exists
      var host = document.querySelector('#works-console');
      if(!host){ host=document.createElement('section'); host.id='works-console'; document.body.appendChild(host); }
      host.innerHTML = '';
      var list = document.createElement('div');
      function esc(s){return String(s||'').replace(/[&<>\\"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]); });}
      data.forEach(function(w){
        var line=document.createElement('div'); line.className='line';
        var html = '<div class="title"><strong>'+esc(w.title)+'</strong> <span class="muted">('+esc(w.slug||'')+')</span></div>'
                 + '<div class="one">'+esc(w.onelinerEffective||w.one||'')+'</div>';
        if(w.pdf){ html += '<div>score: <a href="'+esc(w.pdf)+'" target="_blank" rel="noopener">PDF</a></div>'; }
        if(w.audio){ html += '<div class="actions"><button class="btn" data-id="'+w.id+'">Play/Pause</button></div>'; }
        line.innerHTML = html;
        list.appendChild(line);
      });
      host.appendChild(list);
      if(PRAE && typeof PRAE.ensureAudioTags==='function'){ PRAE.ensureAudioTags(); }
      data.forEach(function(w){ bindAudio(w.id); });
      if(!host.dataset.hudClick){
        host.addEventListener('click', function(e){
          var b=e.target.closest('button[data-id]'); if(!b) return;
          var id=b.getAttribute('data-id');
          var a=document.getElementById('wc-a'+id); if(!a) return;
          bindAudio(id);
          if(a.paused){ a.src=a.getAttribute('data-audio')||a.src; a.play(); }
          else { a.pause(); }
          hudUpdate(id, a);
        });
        host.dataset.hudClick = '1';
      }
    }catch(err){ console.error('[prae embed]', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();`;
function buildCssBundle(){ return APPEARANCE_CSS + '\n' + THEME_CSS + '\n' + STARTER_CSS + '\n' + HUD_EMBED_CSS; }
const STARTER_JS_NOTE = `/** Praetorius Works Console — starter v0
 * This is a seed file. The wizard-driven flow uses:
 *   - .prae/works.json  (your data)
 *   - praetorius generate  (to emit dist/script.js from data)
 */`;

const STARTER_JS = `${STARTER_JS_NOTE}
(function(){
  const works = [
    {
      id: 1,
      slug: 'soundnoisemusic',
      title: 'WORK 1 — String Quartet No. 2 “SOUNDNOISEMUSIC”',
      oneliner: 'A through-composed/indeterminate quartet...',
      cues: [{ label: '@10:30', t: 630 }],
      audio: 'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3',
      pdf:   'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf'
    }
  ];
  window.PRAE = window.PRAE || {};
  window.PRAE.works = works;
  console.log('[prae] starter loaded: 1 work (edit script.js or use "praetorius add" + "praetorius generate").');
})();
`;

const STARTER_README = `Praetorius CLI starter
======================

Quick paths:

1) Old-school (manual)
   - Use "praetorius init" to get a seed script.js/styles.css
   - Paste script.js in a Squarespace Code block
   - Paste styles.css into Page/Site CSS

2) Wizard (recommended)
   - Run "praetorius add" to enter works interactively (stores in .prae/works.json)
   - Run "praetorius generate" to emit dist/script.js + dist/styles.css
   - Paste dist/script.js into your Code block; add dist/styles.css to page/site CSS
`;

/* --- script generator template (turns DB into paste-ready JS) --- */
function normalizeCueRow(row) {
  if (!row) return { label: '', at: '' };
  if (typeof row === 'string') return { label: row, at: row };
  const label = row.label || row.name || row.title || '';
  const at = row.at ?? row.t ?? row.time ?? row.start ?? label ?? '';
  return { label, at };
}

function coalesceUrl(work, primary, fallbacks = []) {
  for (const key of [primary, ...fallbacks]) {
    if (!key) continue;
    const value = work[key];
    if (value) return String(value);
  }
  const media = work.media || {};
  for (const key of [primary, ...fallbacks]) {
    if (media[key]) return String(media[key]);
  }
  const files = work.files || {};
  for (const key of [primary, ...fallbacks]) {
    if (files[key]) return String(files[key]);
  }
  return null;
}

function normalizePageFollowConfig(work) {
  const source = work.pageFollow || work.score || null;
  if (!source) return null;
  const pageMapRaw = Array.isArray(source.pageMap) ? source.pageMap : [];
  const pageMap = pageMapRaw.map((row) => ({
    at: row.at ?? row.t ?? row.time ?? row.label ?? '',
    page: Number.isFinite(Number(row.page)) ? Number(row.page) : 1
  }));
  const cfg = {
    pdfStartPage: Number.isFinite(Number(source.pdfStartPage)) ? Number(source.pdfStartPage) : 1,
    mediaOffsetSec: Number.isFinite(Number(source.mediaOffsetSec)) ? Number(source.mediaOffsetSec) : 0,
    pageMap
  };
  if (Number.isFinite(Number(source.pdfDelta))) {
    cfg.pdfDelta = Number(source.pdfDelta);
  }
  return cfg;
}

function buildRuntimeWorks(rawWorks = []) {
  const works = Array.isArray(rawWorks) ? rawWorks : [];
  return works.map((item, idx) => {
    const work = JSON.parse(JSON.stringify(item || {}));
    const numericId = Number.isFinite(Number(work.id)) ? Number(work.id) : idx + 1;
    work.id = numericId;
    const slug = (work.slug && String(work.slug).trim()) || slugify(work.title || `work-${numericId}`);
    work.slug = slug;
    if (!Array.isArray(work.cues)) {
      work.cues = [];
    }
    work.cues = work.cues.map(normalizeCueRow);
    if (work.openNote && !Array.isArray(work.openNote)) {
      work.openNote = [String(work.openNote)];
    }
    const audio = coalesceUrl(work, 'audioUrl', ['audio', 'audioURL', 'audio_url']);
    if (audio) {
      work.audioUrl = audio;
      if (!work.audio) work.audio = audio;
    }
    const pdf = coalesceUrl(work, 'pdfUrl', ['pdf', 'pdfURL', 'scorePdf', 'scorePDF', 'score_url']);
    if (pdf) {
      work.pdfUrl = pdf;
      if (!work.pdf) work.pdf = pdf;
    }
    const cover = coalesceUrl(work, 'cover', ['coverUrl', 'coverURL', 'image', 'thumbnail', 'poster']);
    if (cover) {
      work.cover = cover;
      work.coverUrl = cover;
    }
    if (Array.isArray(work.tags)) {
      work.tags = work.tags
        .map((tag) => String(tag ?? '').trim())
        .filter(Boolean);
    } else if (typeof work.tags === 'string') {
      work.tags = work.tags
        .split(',')
        .map((tag) => String(tag || '').trim())
        .filter(Boolean);
    }
    work.audioId = work.audioId || `wc-a${numericId}`;
    const pageFollow = normalizePageFollowConfig(work);
    if (pageFollow) {
      work.pageFollow = pageFollow;
    }
    return normalizeWork(work);
  });
}

function buildPageFollowMaps(works = []) {
  const maps = {};
  for (const work of works) {
    if (work.slug && work.pageFollow) {
      maps[work.slug] = work.pageFollow;
    }
  }
  return maps;
}

function createRuntimePayload(db, opts = {}) {
  const rawWorks = Array.isArray(opts.worksOverride) ? opts.worksOverride : (db.works || []);
  const works = buildRuntimeWorks(rawWorks);
  const pageFollowMaps = buildPageFollowMaps(works);
  const theme = opts.theme === 'light' ? 'light' : 'dark';
  const site = opts.site || {};
  const appearance = normalizeAppearance(opts.appearance || {}, { strict: false });
  const branding = normalizeBranding(opts.branding || {}, { strict: false });
  const warnings = Array.isArray(opts.warnings) ? opts.warnings.slice() : [];
  for (const work of works) {
    const workWarnings = collectWorkWarnings(work);
    for (const msg of workWarnings) {
      const label = work.title ? `${work.title} (#${work.id})` : `#${work.id}`;
      warnings.push(`Work ${label}: ${msg}`);
    }
  }
  return {
    works,
    pageFollowMaps,
    config: { theme, site, appearance, branding },
    source: opts.source || 'user',
    seeded: !!opts.seeded,
    count: Number.isInteger(opts.count) ? opts.count : works.length,
    schemaVersion: opts.schemaVersion || String(db.version || ''),
    warnings
  };
}

function renderScriptFromDb(db, opts = {}) {
  const min = !!opts.minify;
  const payload = createRuntimePayload(db, {
    worksOverride: opts.worksOverride,
    theme: opts.theme,
    appearance: opts.appearance,
    branding: opts.branding,
    site: opts.site,
    source: opts.source,
    seeded: opts.seeded,
    count: opts.count,
    warnings: opts.warnings,
    schemaVersion: opts.schemaVersion
  });
  const serializedPayload = JSON.stringify(payload, null, min ? 0 : 2).replace(/</g, '\\u003c');

  return `/** AUTO-GENERATED by praetorius generate
 * Paste into a Squarespace Code block, or host as an external JS file.
 * Source data: .prae/works.json
 */
(function(){
  var fallback = ${serializedPayload};
  var hasWindow = typeof window !== 'undefined';
  var data = (hasWindow && window.__PRAE_DATA__ && Array.isArray(window.__PRAE_DATA__.works))
    ? window.__PRAE_DATA__
    : fallback;
  if (hasWindow && !window.__PRAE_DATA__) {
    window.__PRAE_DATA__ = data;
  }
  if (!hasWindow) return;
  var works = Array.isArray(data.works) ? data.works : [];
  var pageFollowMaps = data.pageFollowMaps || {};

  function ensureAudioTags() {
    works.forEach(function(w){
      var src = w.audioUrl || w.audio || '';
      if(!src) return;
      var id = w.audioId || ('wc-a' + String(w.id||'').trim());
      if(!id) return;
      var a = document.getElementById(id);
      if(!a){
        a = document.createElement('audio');
        a.id = id;
        a.preload = 'none';
        a.setAttribute('playsinline','');
        a.setAttribute('data-audio', src);
        var host = document.querySelector('#works-console') || document.body;
        host.appendChild(a);
      } else {
        a.setAttribute('data-audio', src);
      }
    });
  }

  var worksById = {};
  works.forEach(function(w){ worksById[w.id] = w; });

  window.PRAE = window.PRAE || {};
  window.PRAE.works = works;
  window.PRAE.worksById = worksById;
  window.PRAE.pageFollowMaps = pageFollowMaps;
  window.PRAE.ensureAudioTags = ensureAudioTags;
  window.PRAE.pauseAllAudio = function(exceptId){
    var keep = exceptId == null ? null : String(exceptId);
    var audios = Array.prototype.slice.call(document.querySelectorAll('audio[id^="wc-a"]'));
    audios.forEach(function(audio){
      if (!audio) return;
      var id = String(audio.id || '');
      var workId = id.indexOf('wc-a') === 0 ? id.slice(4) : '';
      if (keep != null && workId === keep) return;
      try {
        if (!audio.paused) audio.pause();
      } catch (_) {}
    });
  };
  window.PRAE.config = window.PRAE.config || {};
  window.PRAE.config.theme = data.config ? data.config.theme : ${JSON.stringify(opts.theme === 'light' ? 'light' : 'dark')};
  window.PRAE.config.site  = data.config ? data.config.site  : ${JSON.stringify(opts.site || {})};
  window.PRAE.config.appearance = data.config ? data.config.appearance : ${JSON.stringify(DEFAULT_APPEARANCE)};
  window.PRAE.config.branding = data.config ? data.config.branding : ${JSON.stringify(DEFAULT_BRANDING)};
  window.PRAE.warnings = Array.isArray(data.warnings) ? data.warnings : [];

  function praeNormalizeBranding(input){
    var src = input && typeof input === 'object' ? input : {};
    var attribution = src.attribution && typeof src.attribution === 'object' ? src.attribution : {};
    return {
      attribution: { enabled: attribution.enabled !== false }
    };
  }

  function praeBrandSvgMark(){
    return '<svg class=\"prae-brand-mark\" viewBox=\"0 0 64 64\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\">'+
      '<g stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">'+
        '<circle cx=\"32\" cy=\"32\" r=\"21\"></circle>'+
        '<circle cx=\"32\" cy=\"32\" r=\"5\" fill=\"currentColor\"></circle>'+
        '<path d=\"M32 12c7 6 12 12 14 20\"></path>'+
        '<path d=\"M32 12c7 6 12 12 14 20\" transform=\"rotate(60 32 32)\"></path>'+
        '<path d=\"M32 12c7 6 12 12 14 20\" transform=\"rotate(120 32 32)\"></path>'+
        '<path d=\"M32 12c7 6 12 12 14 20\" transform=\"rotate(180 32 32)\"></path>'+
        '<path d=\"M32 12c7 6 12 12 14 20\" transform=\"rotate(240 32 32)\"></path>'+
        '<path d=\"M32 12c7 6 12 12 14 20\" transform=\"rotate(300 32 32)\"></path>'+
      '</g>'+
    '</svg>';
  }

  function praeSafeHref(value){
    var raw = String(value || '').trim();
    if (!raw) return '#';
    if (/^javascript:/i.test(raw)) return '#';
    return raw;
  }

  function praeResolveBrandModel(siteCfg, brandingCfg){
    var site = siteCfg && typeof siteCfg === 'object' ? siteCfg : {};
    var branding = praeNormalizeBranding(brandingCfg || {});
    var fullName = String(site.fullName || '').trim();
    if (!fullName) {
      fullName = [site.firstName, site.lastName].filter(Boolean).join(' ').trim();
    }
    var ownerName = String(site.copyrightName || '').trim() || fullName || 'Praetorius';
    var links = Array.isArray(site.links) ? site.links.filter(function(link){
      return link && (link.label || link.title) && link.href;
    }).map(function(link){
      return {
        label: String(link.label || link.title || '').trim(),
        href: praeSafeHref(link.href || '#'),
        external: !!link.external
      };
    }) : [];
    var updated = '';
    if (site.updated && site.updated.mode === 'manual' && site.updated.value) {
      updated = String(site.updated.value);
    } else {
      try {
        updated = new Date().toLocaleDateString();
      } catch (_) {
        updated = '';
      }
    }
    return {
      ownerName: ownerName,
      updated: updated,
      links: links,
      attributionEnabled: branding.attribution.enabled !== false,
      npmHref: 'https://www.npmjs.com/package/praetorius',
      githubHref: 'https://github.com/cbassuarez/praetorius',
      year: new Date().getFullYear()
    };
  }

  function praeBrandCallout(type, href, hint){
    var a = document.createElement('a');
    a.className = 'prae-brand-callout prae-brand-callout--' + type;
    a.href = praeSafeHref(href);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    var label = document.createElement('span');
    label.className = 'prae-brand-callout-label';
    label.textContent = type === 'npm' ? 'npm' : 'GitHub';
    var hintEl = document.createElement('span');
    hintEl.className = 'prae-brand-callout-hint';
    hintEl.textContent = hint || '';
    a.append(label, hintEl);
    return a;
  }

  function praeRenderBrandFooter(root, options){
    if (!root) return null;
    var site = options && options.site ? options.site : (window.PRAE.config ? window.PRAE.config.site : {});
    var branding = options && options.branding ? options.branding : (window.PRAE.config ? window.PRAE.config.branding : {});
    var model = praeResolveBrandModel(site, branding);
    root.innerHTML = '';
    root.setAttribute('data-prae-brand-footer', '1');
    root.setAttribute('data-brand-system', '${BRAND_SYSTEM_VERSION}');
    root.setAttribute('data-brand-attribution', model.attributionEnabled ? 'on' : 'off');

    var shell = document.createElement('div');
    shell.className = 'prae-brand-footer';

    var main = document.createElement('div');
    main.className = 'prae-brand-footer-main';

    var ownerRow = document.createElement('div');
    ownerRow.className = 'prae-brand-owner-row';
    var owner = document.createElement('span');
    owner.className = 'prae-brand-owner';
    owner.textContent = '© ' + model.ownerName + ' ' + model.year;
    ownerRow.append(owner);
    if (model.updated) {
      var updated = document.createElement('span');
      updated.className = 'prae-brand-updated';
      updated.textContent = 'Updated ' + model.updated;
      ownerRow.append(updated);
    }

    var links = document.createElement('nav');
    links.className = 'prae-brand-links';
    links.setAttribute('aria-label', 'Site links');
    model.links.forEach(function(link){
      var a = document.createElement('a');
      a.className = 'prae-brand-link';
      a.href = praeSafeHref(link.href);
      a.textContent = link.label || 'Link';
      if (link.external) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      links.append(a);
    });
    main.append(ownerRow);
    if (model.links.length) {
      main.append(links);
    }

    var meta = document.createElement('div');
    meta.className = 'prae-brand-footer-meta';
    if (model.attributionEnabled) {
      var powered = document.createElement('a');
      powered.className = 'prae-brand-powered';
      powered.href = model.npmHref;
      powered.target = '_blank';
      powered.rel = 'noopener noreferrer';
      var prefix = document.createElement('span');
      prefix.className = 'prae-brand-powered-prefix';
      prefix.textContent = 'Powered by';
      var lockup = document.createElement('span');
      lockup.className = 'prae-brand-lockup';
      lockup.innerHTML = praeBrandSvgMark() + '<span class=\"prae-brand-wordmark\">Praetorius</span>';
      powered.append(prefix, lockup);
      meta.append(powered);
    }
    var callouts = document.createElement('div');
    callouts.className = 'prae-brand-callouts';
    callouts.append(
      praeBrandCallout('npm', model.npmHref, 'package'),
      praeBrandCallout('github', model.githubHref, 'source')
    );
    meta.append(callouts);

    shell.append(main, meta);
    root.append(shell);
    return { root: root, model: model };
  }

  window.PRAE.config.branding = praeNormalizeBranding(window.PRAE.config.branding || {});
  window.PRAE.branding = Object.assign({}, window.PRAE.branding || {}, {
    version: '${BRAND_SYSTEM_VERSION}',
    normalize: praeNormalizeBranding,
    resolveModel: praeResolveBrandModel,
    renderFooter: praeRenderBrandFooter,
    markSvg: praeBrandSvgMark
  });

  function praeNormalizeAppearance(input){
    var src = input && typeof input === 'object' ? input : {};
    var theme = src.theme && typeof src.theme === 'object' ? src.theme : {};
    var cursor = src.cursor && typeof src.cursor === 'object' ? src.cursor : {};
    var effects = src.effects && typeof src.effects === 'object' ? src.effects : {};
    var palettes = ${JSON.stringify(APPEARANCE_PALETTES)};
    var cursors = ${JSON.stringify(CURSOR_PRESETS)};
    var fx = ${JSON.stringify(EFFECT_PRESETS)};
    var palette = String(theme.palette || '${DEFAULT_APPEARANCE.theme.palette}').toLowerCase();
    if (palettes.indexOf(palette) < 0) palette = '${DEFAULT_APPEARANCE.theme.palette}';
    var preset = String(cursor.preset || '${DEFAULT_APPEARANCE.cursor.preset}').toLowerCase();
    if (cursors.indexOf(preset) < 0) preset = '${DEFAULT_APPEARANCE.cursor.preset}';
    var hover = String(effects.hover || '${DEFAULT_APPEARANCE.effects.hover}').toLowerCase();
    if (fx.indexOf(hover) < 0) hover = '${DEFAULT_APPEARANCE.effects.hover}';
    var button = String(effects.button || '${DEFAULT_APPEARANCE.effects.button}').toLowerCase();
    if (fx.indexOf(button) < 0) button = '${DEFAULT_APPEARANCE.effects.button}';
    var mono = String(theme.monoBaseOklch || '${DEFAULT_MONO_BASE_OKLCH}').trim();
    return {
      theme: { palette: palette, monoBaseOklch: mono || '${DEFAULT_MONO_BASE_OKLCH}' },
      cursor: { preset: preset },
      effects: { hover: hover, button: button }
    };
  }

  function praeNormalizeHue(v){
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    return ((n % 360) + 360) % 360;
  }

  function praeFmt(v, d){
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    var out = n.toFixed(d || 3);
    return out.replace(/\\.?0+$/, '');
  }

  function praeClamp(v, min, max){
    return Math.min(max, Math.max(min, Number(v)));
  }

  function praeParseOklch(input){
    var raw = String(input || '').trim();
    var m = raw.match(/^oklch\\(\\s*([0-9]*\\.?[0-9]+%?)\\s+([0-9]*\\.?[0-9]+)\\s+([0-9]*\\.?[0-9]+)(?:deg)?(?:\\s*\\/\\s*[0-9]*\\.?[0-9]+%?)?\\s*\\)$/i);
    if (!m) return null;
    var lRaw = m[1];
    var l = Number(lRaw.replace('%', ''));
    if (!isFinite(l)) return null;
    if (/%/.test(lRaw)) l = l / 100;
    var c = Number(m[2]);
    var h = Number(m[3]);
    if (!isFinite(c) || !isFinite(h)) return null;
    return { l: praeClamp(l, 0, 1), c: praeClamp(c, 0, 0.6), h: praeNormalizeHue(h) };
  }

  function praeOklch(l, c, h){
    return 'oklch(' + praeFmt(praeClamp(l, 0, 1), 3) + ' ' + praeFmt(praeClamp(c, 0, 0.6), 3) + ' ' + praeFmt(praeNormalizeHue(h), 1) + ')';
  }

  function praeHexToRgb(input){
    var raw = String(input || '').trim();
    var m = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!m) return null;
    var hex = m[1];
    if (hex.length === 3) {
      hex = hex.split('').map(function(ch){ return ch + ch; }).join('');
    }
    if (hex.length === 8) hex = hex.slice(0, 6);
    var n = parseInt(hex, 16);
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255
    };
  }

  function praeLinearToSrgb(v){
    if (v <= 0.0031308) return 12.92 * v;
    return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }

  function praeSrgbToLinear(v){
    if (v <= 0.04045) return v / 12.92;
    return Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function praeOklchToRgb(input){
    var parsed = praeParseOklch(input);
    if (!parsed) return null;
    var hr = parsed.h * Math.PI / 180;
    var a = parsed.c * Math.cos(hr);
    var b = parsed.c * Math.sin(hr);

    var l_ = parsed.l + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = parsed.l - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = parsed.l - 0.0894841775 * a - 1.2914855480 * b;

    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;

    var lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    var lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    var lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return {
      r: praeClamp(praeLinearToSrgb(lr), 0, 1),
      g: praeClamp(praeLinearToSrgb(lg), 0, 1),
      b: praeClamp(praeLinearToSrgb(lb), 0, 1)
    };
  }

  function praeColorToRgb(input){
    return praeHexToRgb(input) || praeOklchToRgb(input);
  }

  function praeRelativeLuminance(rgb){
    if (!rgb) return 0;
    var r = praeSrgbToLinear(praeClamp(rgb.r, 0, 1));
    var g = praeSrgbToLinear(praeClamp(rgb.g, 0, 1));
    var b = praeSrgbToLinear(praeClamp(rgb.b, 0, 1));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function praeContrastRatio(a, b){
    var rgbA = praeColorToRgb(a);
    var rgbB = praeColorToRgb(b);
    if (!rgbA || !rgbB) return 1;
    var la = praeRelativeLuminance(rgbA);
    var lb = praeRelativeLuminance(rgbB);
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function praeMinContrast(color, backgrounds){
    var list = Array.isArray(backgrounds) ? backgrounds : [];
    if (!list.length) return 1;
    var min = Infinity;
    list.forEach(function(bg){
      var ratio = praeContrastRatio(color, bg);
      if (ratio < min) min = ratio;
    });
    return isFinite(min) ? min : 1;
  }

  function praePickColorForContrast(preferred, backgrounds, candidates, target){
    var seen = {};
    var pool = [];
    function add(value){
      var key = String(value || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      pool.push(key);
    }
    add(preferred);
    (candidates || []).forEach(add);

    var want = Number(target) > 0 ? Number(target) : 4.5;
    var best = pool[0] || '#0b1f38';
    var bestScore = -1;

    for (var i = 0; i < pool.length; i += 1) {
      var cand = pool[i];
      var score = praeMinContrast(cand, backgrounds);
      if (score >= want) return cand;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return best;
  }

  function praeEnsureAaText(tokens){
    var next = Object.assign({}, tokens || {});
    var backgrounds = [next.surface, next.surface2].filter(Boolean);
    next.text = praePickColorForContrast(
      next.text,
      backgrounds,
      ['#081a32', '#102746', '#1a1a1a', '#f4f8ff', '#ffffff'],
      4.5
    );
    var textRgb = praeColorToRgb(next.text);
    var textLum = praeRelativeLuminance(textRgb);
    var usesDarkText = textLum < 0.45;
    var mutedCandidates = usesDarkText
      ? [next.muted, '#425a77', '#4d6785', '#587291', next.text]
      : [next.muted, '#d8e2f1', '#c8d5e8', '#bacade', next.text];
    next.muted = praePickColorForContrast(next.muted, backgrounds, mutedCandidates, 4.5);
    return next;
  }

  function praePaletteTokens(palette, mode, monoBase){
    var key = mode === 'light' ? 'light' : 'dark';
    var table = {
      'orange-blue-white-silver': {
        dark: { bg:'#0f1728', surface:'#eef2f8', surface2:'#d8e1ee', text:'#112745', muted:'#536b86', border:'#4a6588', borderStrong:'#2f4a70', accent:'#ff8f2f', accent2:'#2f7df0' },
        light:{ bg:'#e8eff8', surface:'#ffffff', surface2:'#f2f5fa', text:'#132845', muted:'#5d728d', border:'#8fa3be', borderStrong:'#6d86a8', accent:'#d36a0a', accent2:'#1f63ca' }
      },
      'gem-diamond': {
        dark: { bg:'#071523', surface:'#d8ebff', surface2:'#c0dbfb', text:'#081b34', muted:'#33577f', border:'#0d3767', borderStrong:'#062a50', accent:'#2f80ff', accent2:'#18b1c6' },
        light:{ bg:'#d9ecff', surface:'#f6fbff', surface2:'#e8f2ff', text:'#10284d', muted:'#4d6b8f', border:'#2b598e', borderStrong:'#214f84', accent:'#005ee6', accent2:'#0a94af' }
      },
      'ryb-tricolor': {
        dark: { bg:'#1a1420', surface:'#f4efe6', surface2:'#eadfcd', text:'#2a1a12', muted:'#6b5444', border:'#8a3c2d', borderStrong:'#63241a', accent:'#df3427', accent2:'#2157d0' },
        light:{ bg:'#f8f1e3', surface:'#fffdf7', surface2:'#f5ebd4', text:'#2f230f', muted:'#6e5b3b', border:'#a77a33', borderStrong:'#8c6424', accent:'#cc2d21', accent2:'#1c4ab8' }
      },
      'mono-bw': {
        dark: { bg:'#111111', surface:'#ececec', surface2:'#d8d8d8', text:'#111111', muted:'#525252', border:'#666666', borderStrong:'#3a3a3a', accent:'#141414', accent2:'#5b5b5b' },
        light:{ bg:'#f1f1f1', surface:'#ffffff', surface2:'#f3f3f3', text:'#1a1a1a', muted:'#666666', border:'#9a9a9a', borderStrong:'#7a7a7a', accent:'#141414', accent2:'#575757' }
      }
    };
    if (palette === 'mono-one') {
      var parsed = praeParseOklch(monoBase) || { l: 0.62, c: 0.09, h: 250 };
      var l = parsed.l, c = parsed.c, h = parsed.h;
      if (key === 'dark') {
        return {
          bg: praeOklch(l - 0.52, c * 0.2, h),
          surface: praeOklch(l + 0.27, c * 0.18, h),
          surface2: praeOklch(l + 0.18, c * 0.16, h),
          text: praeOklch(l - 0.4, c * 0.22, h),
          muted: praeOklch(l - 0.23, c * 0.12, h),
          border: praeOklch(l - 0.11, c * 0.14, h),
          borderStrong: praeOklch(l - 0.2, c * 0.12, h),
          accent: praeOklch(l, Math.max(c, 0.03), h),
          accent2: praeOklch(l, Math.max(c * 0.82, 0.025), h + 28)
        };
      }
      return {
        bg: praeOklch(l + 0.34, c * 0.08, h),
        surface: praeOklch(l + 0.4, c * 0.07, h),
        surface2: praeOklch(l + 0.3, c * 0.07, h),
        text: praeOklch(l - 0.46, c * 0.2, h),
        muted: praeOklch(l - 0.29, c * 0.11, h),
        border: praeOklch(l - 0.19, c * 0.11, h),
        borderStrong: praeOklch(l - 0.28, c * 0.11, h),
        accent: praeOklch(l - 0.12, Math.max(c, 0.03), h),
        accent2: praeOklch(l - 0.1, Math.max(c * 0.82, 0.025), h + 28)
      };
    }
    return (table[palette] && table[palette][key]) || table['orange-blue-white-silver'][key];
  }

  function praeApplyAppearance(cfg){
    var appearance = praeNormalizeAppearance((cfg && cfg.appearance) || {});
    var mode = (cfg && cfg.theme) === 'light' ? 'light' : 'dark';
    var doc = document.documentElement;
    var body = document.body;
    var host = document.getElementById('works-console');
    var tokens = praeEnsureAaText(
      praePaletteTokens(appearance.theme.palette, mode, appearance.theme.monoBaseOklch)
    );
    if (doc && doc.style) {
      Object.keys(tokens).forEach(function(key){
        doc.style.setProperty('--prae-' + key, tokens[key]);
      });
      doc.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
    }
    [doc, body, host].forEach(function(node){
      if (!node) return;
      node.setAttribute('data-theme', mode);
      node.setAttribute('data-palette', appearance.theme.palette);
      node.setAttribute('data-cursor', appearance.cursor.preset);
      node.setAttribute('data-hover-effect', appearance.effects.hover);
      node.setAttribute('data-button-effect', appearance.effects.button);
      node.classList.remove('prae-theme-light', 'prae-theme-dark');
      node.classList.add(mode === 'light' ? 'prae-theme-light' : 'prae-theme-dark');
    });
    try {
      if (window.localStorage && !window.localStorage.getItem('wc.theme')) {
        window.localStorage.setItem('wc.theme', mode);
      }
    } catch (_) {}
    window.PRAE.config.appearance = appearance;
    return appearance;
  }

  function praeApplyAppearanceMode(mode, opts){
    var eff = mode === 'light' ? 'light' : 'dark';
    window.PRAE = window.PRAE || {};
    window.PRAE.config = window.PRAE.config || {};
    window.PRAE.config.theme = eff;
    if (!window.PRAE.config.appearance && data && data.config) {
      window.PRAE.config.appearance = data.config.appearance || {};
    }
    var appearance = praeApplyAppearance(window.PRAE.config);
    if (!opts || opts.persist !== false) {
      try {
        if (window.localStorage) {
          window.localStorage.setItem('wc.theme', eff);
        }
      } catch (_) {}
    }
    return { mode: eff, appearance: appearance };
  }

  window.PRAE.applyAppearanceMode = praeApplyAppearanceMode;

  try { praeApplyAppearance(data.config || {}); } catch(_) {}

  try { ensureAudioTags(); } catch(_) {}
  try { console.info('[prae] data:', data.source || 'unknown', 'count:', data.count != null ? data.count : works.length); } catch(_) {}

  if (data && data.source === 'user') {
    var fingerprints = ['Gymnopédie', 'Es ist ein Ros', 'DEMO — Placeholder'];
    var haystack = JSON.stringify(works).toLowerCase();
    var hit = fingerprints.find(function(fp){ return haystack.indexOf(fp.toLowerCase()) >= 0; });
    if (hit) {
      var msg = 'Praetorius detected starter content while source=user (' + hit + '). Clean dist/ and rebuild.';
      console.error(msg);
      if (typeof document !== 'undefined') {
        var banner = document.createElement('div');
        banner.style.position = 'fixed';
        banner.style.top = '0';
        banner.style.left = '0';
        banner.style.right = '0';
        banner.style.padding = '16px';
        banner.style.background = '#b91c1c';
        banner.style.color = '#fff';
        banner.style.fontFamily = 'system-ui, sans-serif';
        banner.style.zIndex = '2147483647';
        banner.style.textAlign = 'center';
        banner.textContent = msg;
        document.body.appendChild(banner);
      }
      throw new Error(msg);
    }
  }

  if (window.PRAE.warnings && window.PRAE.warnings.length) {
    try {
      document.querySelectorAll('.prae-warning-banner').forEach(function(node){ node.remove(); });
    } catch (_) {}
    var warnHost = document.createElement('div');
    warnHost.className = 'prae-warning-banner';
    warnHost.setAttribute('role', 'status');
    warnHost.setAttribute('aria-live', 'polite');
    warnHost.style.position = 'relative';
    warnHost.style.display = 'block';
    warnHost.style.padding = '0.75rem 1rem';
    warnHost.style.margin = '0';
    warnHost.style.background = '#f97316';
    warnHost.style.color = '#000';
    warnHost.style.fontFamily = 'system-ui, sans-serif';
    warnHost.style.fontSize = '0.95rem';
    warnHost.style.fontWeight = '600';
    warnHost.textContent = window.PRAE.warnings.join(' ');
    var target = document.querySelector('[data-prae-banner]') || document.body;
    if (target && typeof target.prepend === 'function') {
      target.prepend(warnHost);
    }
  }
})();
`;
}

/* ------------------ schema + helpers ------------------ */
const APPEARANCE_PALETTES = Object.freeze([
  'ryb-tricolor',
  'mono-bw',
  'mono-one',
  'gem-diamond',
  'orange-blue-white-silver'
]);
const CURSOR_PRESETS = Object.freeze(['system', 'block-square', 'ring', 'prism-diamond']);
const EFFECT_PRESETS = Object.freeze(['minimal', 'balanced-neo', 'high-drama']);
const DEFAULT_MONO_BASE_OKLCH = 'oklch(0.62 0.09 250)';
const BRAND_SYSTEM_VERSION = 'praetorius-v1';

const DEFAULT_APPEARANCE = Object.freeze({
  theme: {
    palette: 'orange-blue-white-silver',
    monoBaseOklch: DEFAULT_MONO_BASE_OKLCH
  },
  cursor: { preset: 'system' },
  effects: {
    hover: 'balanced-neo',
    button: 'balanced-neo'
  }
});

const DEFAULT_BRANDING = Object.freeze({
  attribution: { enabled: true }
});

// Config schema (light) – theme + output flags
const DEFAULT_CONFIG = Object.freeze({
  theme: 'dark',
  output: { minify: false, embed: false },
  ui: {
    skin: 'console',          // 'console' (current), 'vite-breeze', 'cards-tabs', 'docs-reader', 'kiosk', 'typefolio', 'typescatter'
    allowUrlOverride: true,   // ?skin=vite-breeze in preview/index.html
    appearance: DEFAULT_APPEARANCE,
    branding: DEFAULT_BRANDING
  },
  site: {
    firstName: '',
    lastName:  '',
    fullName:  '',
    copyrightName: '',
    listLabel: 'Works List',
    subtitle:  '',
    updated: { mode: 'auto', value: '' },  // mode: 'auto' | 'manual'
    links: [
      { label:'Home',     href:'#', external:false },
      { label:'Projects', href:'#', external:false },
      { label:'Contact',  href:'#', external:false }
    ]
  }
});

const BUILTIN_SKINS = Object.freeze({
  'console':      { label: 'Console (default)', aliases: [] },
  'vite-breeze':  { label: 'Vite Breeze', aliases: [] },
  'cards-tabs':   { label: 'Cards & Tabs', aliases: ['dashboard'] },
  'docs-reader':  { label: 'Docs Reader', aliases: ['docs'] },
  'kiosk':        { label: 'Kiosk / Presentation', aliases: ['presentation'] },
  'typefolio':    { label: 'Typefolio', aliases: ['typography'] },
  'typescatter':  { label: 'TypeScatter', aliases: ['posterboard'] }
});

const UI_RUNTIMES = Object.freeze(['vanilla', 'react']);

const GENERIC_STARTER_WORKS = Object.freeze([
  {
    id: 1,
    slug: 'demo-satie-gymnopedie-1',
    title: 'Gymnopédies — Satie',
    oneliner: 'Three calm piano miniatures with floating melody, soft harmonic drift, and spacious pacing that showcase clear notation, pedaling detail, and page-follow.',
    description: 'Composed in 1888, Satie’s Gymnopédies distill piano writing down to its essentials: a single, cantabile line supported by simple, gently rocking chords. Each piece unfolds at a very slow tempo, with wide registral spacing and unresolved sonorities that feel more like open questions than cadences. The music invites the listener into a quiet, interior space, where small changes in voicing, touch, and pedaling become expressive events. For a demo site, Gymnopédies are perfect for showing off legible score rendering, expressive playback, and page-follow in a calm, non-dense texture that works beautifully on any device.',
    cues: [{ label: '@0:00', t: 0 }],
    cover: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Erik_Satie_by_Santiago_Rusi%C3%B1ol.jpg',
    audio: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf'
  },
  {
    id: 2,
    slug: 'es-ist-ein-praetorius',
    title: 'Es ist ein Ros entsprungen – Praetorius',
    oneliner: 'A warm four-part chorale with smooth voice-leading and luminous cadences, ideal for showing clear SATB engraving and synchronized score-follow playback.',
    description: 'Praetorius’s Es ist ein Ros entsprungen (early 1600s) takes a simple Christmas chorale tune and surrounds it with balanced SATB counterpoint. The voices move mostly stepwise, with careful spacing and occasional suspensions that bloom into consonance, creating an atmosphere that is both devotional and surprisingly modern in its clarity. Because the texture is transparent and the ranges are comfortable, the piece translates well across ensembles—choir, small vocal consort, or even instrumental quartet. On a demo site, it’s an excellent work for showcasing choral engraving, lyric alignment, transpositions or alternate voicings, and synchronized score-follow playback that lets users visually track each voice as the harmony blossoms.',
    cues: [{ label: '@0:00', t: 0 }],
    audio: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/Anonymous/es_ist_ein_ros/es_ist_ein_ros-a4.pdf'
  }
]);

const GENERIC_STARTER_ASSETS = Object.freeze([
  { file: 'starter/audio/demo-satie.ogg.url', url: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg' },
  { file: 'starter/pdf/demo-satie.pdf.url', url: 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf' },
  { file: 'starter/audio/demo-army-band.ogg.url', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg' },
  { file: 'starter/pdf/demo-army-band.pdf.url', url: 'https://www.mutopiaproject.org/ftp/Anonymous/es_ist_ein_ros/es_ist_ein_ros-a4.pdf' }
]);

const DEFAULT_DOCS_CONFIG = Object.freeze({
  site: { title: '', subtitle: '', description: '', accent: '' },
  sources: { globs: ['docs/**/*.md'], includeReadme: true },
  ia: [],
  frontMatter: { addIfMissing: true, tocDepth: 2, autoSummary: true },
  codeTabs: { enabled: false, strategy: 'fence', order: ['js', 'ts', 'bash'] },
  assets: { optimize: false, sizes: ['1x', '2x', 'webp'], altPolicy: 'warn' },
  search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'], excludeSections: [] },
  works: { includeInNav: false, includeOnHome: false, linkMode: 'auto' },
  paths: { root: 'docs/', homepage: '' }
});

const SKIN_ALIAS_LOOKUP = (() => {
  const map = new Map();
  for (const [key, meta] of Object.entries(BUILTIN_SKINS)) {
    map.set(key, key);
    for (const alias of meta.aliases || []) {
      map.set(alias, key);
    }
  }
  return map;
})();

function resolveBuiltinSkinKey(input) {
  if (!input) return null;
  const key = String(input).trim().toLowerCase();
  if (!key) return null;
  return SKIN_ALIAS_LOOKUP.get(key) || null;
}

function normalizeUiRuntime(input) {
  const raw = String(input ?? 'vanilla').trim().toLowerCase();
  return UI_RUNTIMES.includes(raw) ? raw : null;
}

function resolveUiRuntimeForSkin(skinKey, runtime) {
  const requested = normalizeUiRuntime(runtime) || 'vanilla';
  const reactSupportedSkins = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);
  if (requested === 'react' && reactSupportedSkins.has(skinKey)) {
    return { runtime: 'react', warned: false };
  }
  if (requested === 'react') {
    return { runtime: 'vanilla', warned: true };
  }
  return { runtime: 'vanilla', warned: false };
}

function resolveSkinUiVariant(skinKey, runtime) {
  if (skinKey === 'vite-breeze' && runtime === 'react') return 'vite-breeze-react';
  if (skinKey === 'cards-tabs' && runtime === 'react') return 'cards-tabs-react';
  if (skinKey === 'kiosk' && runtime === 'react') return 'kiosk-react';
  if (skinKey === 'docs-reader' && runtime === 'react') return 'docs-reader-react';
  return skinKey;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFixedTrim(value, digits = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const fixed = num.toFixed(digits);
  return fixed.replace(/\.?0+$/, '');
}

function normalizeHue(value) {
  let hue = Number(value);
  if (!Number.isFinite(hue)) hue = 0;
  hue = ((hue % 360) + 360) % 360;
  return hue;
}

function parseHexColor(input) {
  const raw = String(input ?? '').trim();
  const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex.split('').map((ch) => ch + ch).join('');
  }
  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  const int = parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function srgbToLinear(u8) {
  const v = clamp(Number(u8) / 255, 0, 1);
  if (v <= 0.04045) return v / 12.92;
  return Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToOklchString(input) {
  const rgb = parseHexColor(input);
  if (!rgb) return null;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lCube = Math.cbrt(Math.max(l, 0));
  const mCube = Math.cbrt(Math.max(m, 0));
  const sCube = Math.cbrt(Math.max(s, 0));

  const L = 0.2104542553 * lCube + 0.793617785 * mCube - 0.0040720468 * sCube;
  const a = 1.9779984951 * lCube - 2.428592205 * mCube + 0.4505937099 * sCube;
  const bVal = 0.0259040371 * lCube + 0.7827717662 * mCube - 0.808675766 * sCube;
  const C = Math.sqrt(a * a + bVal * bVal);
  const h = normalizeHue(Math.atan2(bVal, a) * (180 / Math.PI));

  return `oklch(${toFixedTrim(clamp(L, 0, 1), 3)} ${toFixedTrim(clamp(C, 0, 0.6), 3)} ${toFixedTrim(h, 1)})`;
}

function parseOklchString(input) {
  const raw = String(input ?? '').trim();
  const match = raw.match(/^oklch\(\s*([0-9]*\.?[0-9]+%?)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:deg)?(?:\s*\/\s*([0-9]*\.?[0-9]+%?))?\s*\)$/i);
  if (!match) return null;
  let l = Number(match[1].replace('%', ''));
  if (!Number.isFinite(l)) return null;
  if (match[1].includes('%')) l = l / 100;
  let c = Number(match[2]);
  let h = Number(match[3]);
  if (!Number.isFinite(c) || !Number.isFinite(h)) return null;
  l = clamp(l, 0, 1);
  c = clamp(c, 0, 0.6);
  h = normalizeHue(h);
  return { l, c, h };
}

function formatOklch({ l, c, h }) {
  return `oklch(${toFixedTrim(clamp(l, 0, 1), 3)} ${toFixedTrim(clamp(c, 0, 0.6), 3)} ${toFixedTrim(normalizeHue(h), 1)})`;
}

function normalizeMonoBaseOklch(input, opts = {}) {
  const fallback = opts.fallback || DEFAULT_MONO_BASE_OKLCH;
  const raw = String(input ?? '').trim();
  if (!raw) return fallback;
  const parsed = parseOklchString(raw);
  if (parsed) return formatOklch(parsed);
  const fromHex = hexToOklchString(raw);
  if (fromHex) return fromHex;
  if (opts.throwOnError) {
    throw new Error(`Invalid mono color "${raw}". Use HEX (#RRGGBB) or oklch(L C H).`);
  }
  return fallback;
}

function normalizeAppearance(input, opts = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const strict = !!opts.strict;
  const fail = (msg) => {
    if (strict) throw new Error(msg);
  };
  const themeInput = source.theme && typeof source.theme === 'object' ? source.theme : {};
  const cursorInput = source.cursor && typeof source.cursor === 'object' ? source.cursor : {};
  const effectsInput = source.effects && typeof source.effects === 'object' ? source.effects : {};

  const paletteRaw = String(themeInput.palette ?? '').trim().toLowerCase();
  let palette = paletteRaw || DEFAULT_APPEARANCE.theme.palette;
  if (!APPEARANCE_PALETTES.includes(palette)) {
    fail(`Invalid palette "${paletteRaw}".`);
    palette = DEFAULT_APPEARANCE.theme.palette;
  }

  const cursorRaw = String(cursorInput.preset ?? '').trim().toLowerCase();
  let cursorPreset = cursorRaw || DEFAULT_APPEARANCE.cursor.preset;
  if (!CURSOR_PRESETS.includes(cursorPreset)) {
    fail(`Invalid cursor preset "${cursorRaw}".`);
    cursorPreset = DEFAULT_APPEARANCE.cursor.preset;
  }

  const hoverRaw = String(effectsInput.hover ?? '').trim().toLowerCase();
  let hoverEffect = hoverRaw || DEFAULT_APPEARANCE.effects.hover;
  if (!EFFECT_PRESETS.includes(hoverEffect)) {
    fail(`Invalid hover effect "${hoverRaw}".`);
    hoverEffect = DEFAULT_APPEARANCE.effects.hover;
  }

  const buttonRaw = String(effectsInput.button ?? '').trim().toLowerCase();
  let buttonEffect = buttonRaw || DEFAULT_APPEARANCE.effects.button;
  if (!EFFECT_PRESETS.includes(buttonEffect)) {
    fail(`Invalid button effect "${buttonRaw}".`);
    buttonEffect = DEFAULT_APPEARANCE.effects.button;
  }

  const monoBaseOklch = normalizeMonoBaseOklch(themeInput.monoBaseOklch, { fallback: DEFAULT_MONO_BASE_OKLCH, throwOnError: strict });
  return {
    theme: { palette, monoBaseOklch },
    cursor: { preset: cursorPreset },
    effects: { hover: hoverEffect, button: buttonEffect }
  };
}

function normalizeBranding(input, opts = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const strict = !!opts.strict;
  const fail = (msg) => {
    if (strict) throw new Error(msg);
  };
  const attribution = source.attribution && typeof source.attribution === 'object' ? source.attribution : {};
  const enabledRaw = attribution.enabled;
  let enabled = true;
  if (enabledRaw === undefined || enabledRaw === null) {
    enabled = true;
  } else if (typeof enabledRaw === 'boolean') {
    enabled = enabledRaw;
  } else {
    fail('Invalid branding attribution.enabled value.');
    enabled = true;
  }
  return {
    attribution: { enabled }
  };
}

function resolveAppearanceForGenerate(baseAppearance, overrides = {}) {
  const merged = JSON.parse(JSON.stringify(normalizeAppearance(baseAppearance || {}, { strict: false })));
  if (overrides.palette != null) {
    merged.theme.palette = String(overrides.palette).trim().toLowerCase();
  }
  if (overrides.cursor != null) {
    merged.cursor.preset = String(overrides.cursor).trim().toLowerCase();
  }
  if (overrides.hoverEffect != null) {
    merged.effects.hover = String(overrides.hoverEffect).trim().toLowerCase();
  }
  if (overrides.buttonEffect != null) {
    merged.effects.button = String(overrides.buttonEffect).trim().toLowerCase();
  }
  if (overrides.monoColor != null && String(overrides.monoColor).trim()) {
    merged.theme.monoBaseOklch = normalizeMonoBaseOklch(overrides.monoColor, { throwOnError: true });
  }
  return normalizeAppearance(merged, { strict: true });
}

const WORK_FILE_REGEX = /\.work\.(json|ya?ml|md)$/i;

function resolveWorksContentDir({ contentDir, config } = {}) {
  const root = process.cwd();
  const raw = [];
  const cfgDir = config && typeof config.contentDir === 'string' ? config.contentDir.trim() : '';
  if (cfgDir) raw.push(cfgDir);
  if (typeof contentDir === 'string' && contentDir.trim()) raw.push(contentDir.trim());
  raw.push('.prae');
  raw.push('works');
  raw.push(path.join('content', 'works'));
  const seen = new Set();
  const resolved = [];
  for (const candidate of raw) {
    const abs = path.isAbsolute(candidate) ? path.normalize(candidate) : path.resolve(root, candidate);
    if (seen.has(abs)) continue;
    seen.add(abs);
    resolved.push(abs);
  }
  const resolvedDir = resolved[0] || path.resolve(root, '.prae');
  return { resolvedDir, candidates: resolved };
}

async function countWorkFiles(dir) {
  const stack = [dir];
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (WORK_FILE_REGEX.test(entry.name)) count += 1;
    }
  }
  return count;
}

async function detectWorksState({ skin, contentDir, config } = {}) {
  const skinKey = resolveBuiltinSkinKey(skin) || (skin ? String(skin).trim().toLowerCase() : '');
  const { resolvedDir } = resolveWorksContentDir({ contentDir, config });
  const displayDir = cwdRel(resolvedDir);
  if (skinKey === 'docs-reader') {
    const exists = fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory();
    return {
      decision: 'never',
      worksCount: 0,
      fileCount: 0,
      manifestCount: 0,
      manifestParseError: false,
      resolvedDir,
      displayDir,
      dirExists: exists
    };
  }
  let fileCount = 0;
  let dirExists = false;
  try {
    dirExists = fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory();
  } catch (_) {
    dirExists = false;
  }
  if (dirExists) {
    try {
      fileCount = await countWorkFiles(resolvedDir);
    } catch (_) {
      fileCount = 0;
    }
  }
  let manifestCount = 0;
  let manifestParseError = false;
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (Array.isArray(data?.works)) {
        manifestCount = data.works.length;
      }
    } catch (_) {
      manifestParseError = true;
    }
  }
  const totalWorks = manifestParseError ? 1 : Math.max(manifestCount, fileCount);
  const decision = manifestParseError ? 'auto:skip' : (totalWorks > 0 ? 'auto:skip' : 'auto:seed');
  return {
    decision,
    worksCount: totalWorks,
    fileCount,
    manifestCount,
    manifestParseError,
    resolvedDir,
    displayDir,
    dirExists
  };
}

async function shouldSeed({ skin, contentDir, config }) {
  const state = await detectWorksState({ skin, contentDir, config });
  return state.decision === 'never' ? 'never' : state.decision;
}

async function runGenericStarterSeed({ targetDirs = {}, assets = {}, skin, config } = {}) {
  const manifestPath = targetDirs.manifestPath
    ? path.resolve(targetDirs.manifestPath)
    : DB_PATH;
  const worksDir = path.dirname(manifestPath);
  const assetsDir = targetDirs.assetsDir ? path.resolve(targetDirs.assetsDir) : null;

  fs.mkdirSync(worksDir, { recursive: true });
  let existing = null;
  if (fs.existsSync(manifestPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (_) {
      return; // safety: do not overwrite uncertain manifests
    }
  }
  const existingWorks = Array.isArray(existing?.works) ? existing.works : [];
  if (existingWorks.length > 0) return;
  const payload = {
    version: existing?.version ?? 1,
    works: GENERIC_STARTER_WORKS.map((entry, idx) => ({
      ...entry,
      id: entry.id,
      cues: (entry.cues || []).map(c => ({ label: c.label, t: c.t }))
    }))
  };
  fs.writeFileSync(manifestPath, JSON.stringify(payload, null, 2));

  if (assetsDir) {
    for (const asset of GENERIC_STARTER_ASSETS) {
      const dest = path.join(assetsDir, asset.file);
      if (fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, `${asset.url}\n`, 'utf8');
    }
  }
}

function builtinSkinList() {
  const blurbs = {
    'vite-breeze': 'Liquid Glass portfolio shell (split layout + PDF pane)',
    'docs-reader': 'spacious docs UI (left nav, right outline, copy-on-code)',
    'cards-tabs': 'portfolio dashboard (cards + tabs from works list)',
    'kiosk': 'touch-first tiles for demos/galleries (oversized controls)',
    'console': 'console view used for debugging + starter scaffolds',
    'typefolio': 'web-book reader (two-page spread, Caslon-style typography)',
    'typescatter': 'type-only poster wall (scatter to grid; draggable)'
  };
  return Object.entries(BUILTIN_SKINS).map(([key, meta]) => {
    const aliases = (meta.aliases && meta.aliases.length)
      ? ` (alias: ${meta.aliases.join(', ')})`
      : '';
    const purpose = blurbs[key] ? ` — ${blurbs[key]}` : (meta.label ? ` — ${meta.label}` : '');
    return `${key}${aliases}${purpose}`;
  });
}

const WORKS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'works'],
  properties: {
    version: { type: 'integer' },
    works: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        anyOf: [
          { required: ['oneliner'] },
          { required: ['one'] }
        ],
        required: ['id','slug','title'],
        properties: {
          id:    { type: 'integer', minimum: 1 },
          slug:  { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          one:   {
            type: 'string',
            minLength: 1,
            maxLength: 240,
            pattern: '^[^\\n]*$'
          },
          oneliner: {
            type: 'string',
            minLength: 1,
            maxLength: 240,
            pattern: '^[^\\n]*$'
          },
          description: { anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
            { type: 'null' }
          ] },
          desc: { anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
            { type: 'null' }
          ] },
          audio: { type: ['string','null'] },
          pdf:   { type: ['string','null'] },
          cover: { type: ['string','null'] },
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1 }
          },
          cues: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label','t'],
              properties: {
                label: { type: 'string' },
                t:     { type: 'integer', minimum: 0 }
              }
            }
          },
          // NEW: score/page-follow block (optional)
          score: {
            type: 'object',
            additionalProperties: false,
            required: [],
            properties: {
              pdfStartPage:   { type: 'integer', minimum: 1 },
              mediaOffsetSec: { type: 'integer' },                // can be negative
              pdfDelta:       { type: 'integer' },                // optional tweak your console supports
              pageMap: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['at','page'],
                  properties: {
                    // allow both "mm:ss" strings and integer seconds
                    at: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'integer', minimum: 0 }] },
                    page: { type: 'integer', minimum: 1 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PKG_ROOT   = path.resolve(__dirname, '../../'); // package root (for <pkg>/ui fallback)

function cwdRel(p) { return path.relative(process.cwd(), p) || '.'; }
function slugify(s) {
  return (s||'').toLowerCase()
    .replace(/[“”"]/g,'')
    .replace(/[’']/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .replace(/--+/g,'-') || 'work';
}
function parseTimeToSec(input) {
  if (!input) return 0;
  const s = String(input).trim();
  if (/^\d+$/.test(s)) return parseInt(s,10);
  const m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return parseInt(m[1],10)*60 + parseInt(m[2],10);
  return 0;
}
// strict human time → seconds parser for Score commands
function parseTimeToSecStrict(input) {
  const s = String(input ?? '').trim();
  if (!s) return NaN;
  if (/^\d+$/.test(s)) return Number(s);                 // "90"
  const hms = s.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/); // "m:ss" or "h:mm:ss"
  if (!hms) return NaN;
  const h = hms[3] !== undefined ? Number(hms[1]) : 0;
  const m = hms[3] !== undefined ? Number(hms[2]) : Number(hms[1]);
  const sec = hms[3] !== undefined ? Number(hms[3]) : Number(hms[2]);
  return (h*3600) + (m*60) + sec;
}
function secToHuman(sec) {
  const n = Math.max(0, Number(sec|0));
  const h = Math.floor(n/3600);
  const m = Math.floor((n%3600)/60);
  const s = n%60;
  const mm = (h>0 ? String(m).padStart(2,'0') : String(m));
  const ss = String(s).padStart(2,'0');
  return h>0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ---------- score normalize + validation ----------
function normalizeScore(score) {
  if (!score) return null;
  const pdfStartPage   = Number(score.pdfStartPage) >= 1 ? Number(score.pdfStartPage) : 1;
  const mediaOffsetSec = Number.isFinite(Number(score.mediaOffsetSec)) ? Number(score.mediaOffsetSec) : 0;
  const pdfDelta       = (score.pdfDelta !== undefined && Number.isFinite(Number(score.pdfDelta))) ? Number(score.pdfDelta) : undefined;
  const pageMap = Array.isArray(score.pageMap) ? score.pageMap.map((row)=> {
    const t = typeof row.at === 'number' ? row.at : parseTimeToSecStrict(row.at);
    return { at: Number(t), page: Number(row.page) };
  }).filter(r => Number.isFinite(r.at) && Number.isFinite(r.page)) : [];
  // sort by time
  pageMap.sort((a,b)=> a.at - b.at);
  const out = { pdfStartPage, mediaOffsetSec, pageMap };
  if (pdfDelta !== undefined) out.pdfDelta = pdfDelta;
  return out;
}
function validateScore(score) {
  const errors = [];
  if (!score) { errors.push('score missing'); return errors; }
  if (!(Number(score.pdfStartPage) >= 1)) errors.push('pdfStartPage must be ≥ 1');
  if (!Array.isArray(score.pageMap) || score.pageMap.length === 0) {
    errors.push('pageMap must be a non-empty array');
  } else {
    let lastT = -1;
    let lastP =  0;
    score.pageMap.forEach((row, i) => {
      const where = `row ${i+1}`;
      if (!Number.isInteger(row.at) || row.at < 0) errors.push(`${where}: time must be integer seconds ≥ 0`);
      if (!Number.isInteger(row.page) || row.page < 1) errors.push(`${where}: page must be integer ≥ 1`);
      if (row.at <= lastT) errors.push(`${where}: times must be strictly increasing`);
      if (row.page < lastP) errors.push(`${where}: pages must be monotonic (non-decreasing)`);
      lastT = row.at;
      lastP = row.page;
    });
  }
  return errors;
}
function actualPdfPageOf(printedPage, pdfStartPage, pdfDelta=0) {
  return pdfStartPage + (printedPage - 1) + (pdfDelta||0);
}
function printScorePreview(sc) {
  console.log(pc.bold('Preview (printed → actual PDF page):'));
  console.log(pc.gray(' idx  time   printed  actual '));
  sc.pageMap.forEach((r, i) => {
    const act = actualPdfPageOf(r.page, sc.pdfStartPage, sc.pdfDelta);
    console.log(`${String(i+1).padStart(3,' ')}  ${secToHuman(r.at).padStart(6,' ')}  ${String(r.page).padStart(7,' ')}  ${String(act).padStart(6,' ')}`);
  });
}
// ---- Migrations ----
const LATEST_SCHEMA_VERSION = 2;

function migrate_v1_to_v2(db) {
  // Ensure unique integer ids, normalized cues/score, tidy strings/slug.
  const srcWorks = Array.isArray(db.works) ? db.works : [];
  // Seed seen ids + next id from valid ints
  const validIds = srcWorks.map(w => Number(w?.id)).filter(n => Number.isInteger(n) && n >= 1);
  const seen = new Set(validIds);
  let nextIdVal = validIds.length ? Math.max(...validIds) + 1 : 1;
  const allocId = () => { while (seen.has(nextIdVal)) nextIdVal++; const id = nextIdVal++; seen.add(id); return id; };

  const out = { version: 2, works: [] };
  for (const w0 of srcWorks) {
    const w = { ...w0 };
    // id → int
    let idNum = Number(w.id);
    if (!Number.isInteger(idNum) || idNum < 1 || seen.has(idNum)) idNum = allocId();
    else seen.add(idNum);

    // strings trimmed
    w.title = String(w.title ?? '').trim();
    // slug normalized
    w.slug  = slugify(w.slug || w.title || '');
    const sanitizedMigration = sanitizeNarrativeFields(w);
    Object.assign(w, sanitizedMigration.sanitized);
    if (w.cover != null) {
      const cover = String(w.cover).trim();
      w.cover = cover || null;
    }
    if (w.tags != null) {
      w.tags = parseTagsInput(w.tags);
    }

    // cues normalized (try to infer t from label/time if missing)
    if (Array.isArray(w.cues)) {
      w.cues = w.cues.map(c => {
        let t = Number(c?.t);
        if (!Number.isInteger(t)) {
          const hint = String((c && (c.time ?? c.label)) ?? '').replace(/^@/, '');
          const p = parseTimeToSecStrict(hint);
          t = Number.isFinite(p) ? p : 0;
        }
        const label = String(c?.label ?? (Number.isFinite(t) ? '@' + secToHuman(t) : '')).trim();
        return { label, t };
      }).filter(c => Number.isInteger(c.t) && c.t >= 0);
    } else {
      w.cues = [];
   }

    // score normalized or synthesized if PDF exists
    if (w.score) w.score = normalizeScore(w.score);
    else if (w.pdf) w.score = { pdfStartPage: 1, mediaOffsetSec: 0 };

    w.id = idNum;
    out.works.push(w);
  }
  return out;
}

function migrateDb(db) {
  let current = Number(db?.version ?? 1);
  let next = { ...db };
  if (current < 1) current = 1;
  if (current === 1) {
    next = migrate_v1_to_v2(next);
    current = 2;
  }
  // (Future) add v2→v3 here
  return next;
}

/* ------------------ UI Bundling Helpers ------------------ */
// ---- UI bundle helpers ----
function existsFile(p){ try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; } }
function resolveUiMainEntry(rootDir) {
  const candidates = ['main.js', 'main.jsx', 'main.ts', 'main.tsx'];
  for (const name of candidates) {
    const candidate = path.join(rootDir, name);
    if (existsFile(candidate)) return candidate;
  }
  return null;
}
function uiPaths(cwd){
  const SRC_DIR = path.resolve(cwd, 'ui'); // default project UI dir
  return {
    dir:   SRC_DIR,
    tpl:   path.join(SRC_DIR, 'template.html'),
    boot:  path.join(SRC_DIR, 'boot.js'),
    main:  path.join(SRC_DIR, 'main.js'),
    style: path.join(SRC_DIR, 'style.css'),
  };
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
function copyDirSync(from, to) {
  ensureDir(to);
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, ent.name);
    const dst = path.join(to, ent.name);
    if (ent.isDirectory()) copyDirSync(src, dst);
    else fs.copyFileSync(src, dst);
  }
}
function upsertBodyTheme(html, theme) {
  return html.replace(/<body(\s[^>]*)?>/i, (m, attrs='') => {
    const clsRe = /class=(["'])(.*?)\1/i;
    if (clsRe.test(attrs)) {
      return `<body${attrs.replace(clsRe, (mm,q,val)=>`class=${q}${val} prae-theme-${theme}${q}`)}>`;
    }
    return `<body class="prae-theme-${theme}"${attrs}>`;
  });
}
function injectHead(html, lines) {
  return html.replace(/<\/head>/i, (m) => `  ${lines.join('\n  ')}\n${m}`);
}
function injectBeforeBodyEnd(html, lines) {
  return html.replace(/<\/body>/i, (m) => `  ${lines.join('\n  ')}\n${m}`);
}
function extractBodyInnerHtml(html) {
  const match = String(html || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1].trim();
  return String(html || '').trim();
}
function findBrandRoot(uiSrcDir, pkgUiDir) {
  const roots = [
    path.join(uiSrcDir, 'brand'),
    path.join(pkgUiDir, 'brand')
  ];
  return roots.find((dir) => existsFile(path.join(dir, 'brand.css'))) || null;
}
function readBrandCss(brandRoot, { embed = false } = {}) {
  if (!brandRoot) return '';
  const cssPath = path.join(brandRoot, 'brand.css');
  if (!existsFile(cssPath)) return '';
  const css = fs.readFileSync(cssPath, 'utf8');
  if (!embed) return css;
  return css.replace(/@font-face\s*{[^}]*}\s*/g, '');
}
function buildIndexHtml({ templatePath, outPath, theme }) {
  if (!existsFile(templatePath)) return false;
  let html = fs.readFileSync(templatePath, 'utf8');
  html = upsertBodyTheme(html, theme);
  // Head: add tokens + app CSS if not already linked
  const wantHead = [];
  if (!/href=.*styles\.css/i.test(html)) wantHead.push('<link rel="stylesheet" href="/styles.css"/>');
  if (!/href=.*app\.css/i.test(html) && existsFile(path.join(path.dirname(outPath), 'app.css')))
    wantHead.push('<link rel="stylesheet" href="/app.css"/>');
  if (wantHead.length) html = injectHead(html, wantHead);
  // Body: ensure host + scripts
  if (!/id=["']works-console["']/.test(html)) {
    html = injectBeforeBodyEnd(html, ['<section id="works-console"></section>']);
  }
  const wantBody = [];
  if (!/src=.*script\.js/i.test(html)) wantBody.push('<script src="/script.js"></script>');
  if (!/src=.*app\.js/i.test(html))    wantBody.push('<script type="module" src="/app.js"></script>');
  if (wantBody.length) html = injectBeforeBodyEnd(html, wantBody);
  atomicWriteFile(outPath, html);
  return true;
}

/* ------------------ DB I/O ------------------ */
const DB_DIR  = path.resolve(process.cwd(), '.prae');
const DB_PATH = path.join(DB_DIR, 'works.json');
const CONFIG_DIR  = DB_DIR; // colocate
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DOCS_CONFIG_PATH = path.join(DB_DIR, 'docs.json');
// ---- History (.prae/history) ----
const HISTORY_DIR = path.join(DB_DIR, 'history');
function ensureHistoryDir() { fs.mkdirSync(HISTORY_DIR, { recursive: true }); return HISTORY_DIR; }
function historyStamp() { return new Date().toISOString().replace(/[:.]/g,'-'); }
function writeHistorySnapshot(label='auto') {
  ensureHistoryDir();
  const stamp = historyStamp();
  const src = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : JSON.stringify({ version: 1, works: [] }, null, 2);
  const file = path.join(HISTORY_DIR, `${stamp}--${label}.json`);
  fs.writeFileSync(file, src, 'utf8');
  return file;
}
function listHistory() {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();
}
function latestSnapshotFile() {
  const files = listHistory();
  return files[files.length - 1] || null;
}
function loadHistorySnapshot(filename) {
  const p = path.join(HISTORY_DIR, filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---- Lightweight JSON "preview diff" (added/removed/modified works) ----
function shallowWorkDiff(a, b) {
  const fields = ['title','slug','one','oneliner','description','audio','pdf','cover'];
  const changed = [];
  for (const k of fields) if (String(a?.[k] ?? '') !== String(b?.[k] ?? '')) changed.push(k);
  if (JSON.stringify(a?.tags ?? []) !== JSON.stringify(b?.tags ?? [])) changed.push('tags');
  if (JSON.stringify(a?.cues ?? [])  !== JSON.stringify(b?.cues ?? []))  changed.push('cues');
  if (JSON.stringify(a?.score ?? null) !== JSON.stringify(b?.score ?? null)) changed.push('score');
  return changed;
}
function summarizeDiff(fromDb, toDb) {
  const out = { added: [], removed: [], modified: [] };
  const from = new Map((fromDb.works || []).map(w => [String(w.slug), w]));
  const to   = new Map((toDb.works   || []).map(w => [String(w.slug), w]));
  for (const [slug, w] of to) {
    if (!from.has(slug)) out.added.push(w);
    else {
      const a = from.get(slug);
      const ch = shallowWorkDiff(a, w);
      if (ch.length) out.modified.push({ work: w, changed: ch });
   }
  }
  for (const [slug, w] of from) if (!to.has(slug)) out.removed.push(w);
  return out;
}
function printSummaryDiff(diff) {
  const f = (w)=>`#${w.id} ${w.title} (${w.slug})`;
  diff.added.forEach(w => console.log(pc.green('+ ') + f(w)));
  diff.removed.forEach(w => console.log(pc.red('- ') + f(w)));
  diff.modified.forEach(({work, changed}) => console.log(pc.yellow('~ ') + f(work) + pc.gray(' [' + changed.join(', ') + ']')));
  if (!diff.added.length && !diff.removed.length && !diff.modified.length) console.log(pc.gray('No changes.'));
}


function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

// Atomic write with .bak (POSIX rename is atomic within same dir)
function atomicWriteFile(filePath, contents) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  // backup existing
  if (fs.existsSync(filePath)) {
    try { fs.copyFileSync(filePath, `${filePath}.bak`); } catch {}
  }
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return { version: 1, works: [] };
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return raw;
  } catch {
    return { version: 1, works: [] };
  }
}
function saveDb(db) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  atomicWriteFile(DB_PATH, JSON.stringify(db, null, 2));
}
function nextId(db) {
  const ids = (db.works||[]).map(w=>w.id||0);
  return (ids.length ? Math.max(...ids) : 0) + 1;
}
/* ------------------ helpers: lookup/move/flatten ------------------ */
function findById(db, id) {
  const idx = (db.works||[]).findIndex(w => Number(w.id) === Number(id));
  return { idx, work: idx >= 0 ? db.works[idx] : null };
}
function moveInArray(arr, fromIdx, toIdx) {
  if (fromIdx === toIdx) return arr;
  const a = arr.slice();
  const [item] = a.splice(fromIdx, 1);
  a.splice(toIdx, 0, item);
  return a;
}
function ensureRequired(row) {
  if (!row) return false;
 // Required authoring fields for import; id is optional (assigned later)
  const hasTitle = !!(row.title && String(row.title).trim());
  const hasSlug  = !!(row.slug  && String(row.slug).trim());
  const hasOne   = !!(row.one   && String(row.one).trim());
  const hasOneliner = !!(row.oneliner && String(row.oneliner).trim());
  const rawDescription = row.description ?? row.desc;
  const hasDescription = !!(rawDescription && String(rawDescription).trim());
  return hasTitle && hasSlug && (hasOne || hasOneliner || hasDescription);
}
function parseMaybeJSON(s) {
  if (!s || typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch { return null; }
}
function parseTagsInput(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag ?? '').trim()).filter(Boolean);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const asJson = parseMaybeJSON(raw);
  if (Array.isArray(asJson)) {
    return asJson.map((tag) => String(tag ?? '').trim()).filter(Boolean);
  }
  return raw.split(',').map((tag) => tag.trim()).filter(Boolean);
}
function sanitizeNarrativeFields(work) {
  const normalized = normalizeWork(work);
  const sanitized = { ...work };
  const explicitSource = String(work.oneliner ?? work.one ?? '').trim();
  delete sanitized.desc;
  if (normalized.oneliner) sanitized.oneliner = normalized.oneliner;
  else if (explicitSource) sanitized.oneliner = normalized.onelinerEffective || '';
  else delete sanitized.oneliner;
  if (normalized.description !== undefined) {
    if (normalized.description !== null) sanitized.description = normalized.description;
    else if ('description' in sanitized) sanitized.description = null;
  }
  if ('one' in work) sanitized.one = normalized.one;
  else if ('one' in sanitized) delete sanitized.one;
  if ('cover' in sanitized) {
    const cover = sanitized.cover == null ? null : String(sanitized.cover).trim();
    sanitized.cover = cover || null;
  }
  if ('tags' in sanitized) {
    sanitized.tags = parseTagsInput(sanitized.tags);
  }
  return { sanitized, normalized };
}
function normalizeImportedWork(row) {
  // Accept flexible shapes from CSV/YAML/JSON rows
  // id: blank/missing → null; numeric strings → Number; reject < 1
  let id = null;
  if (row?.id !== undefined && row?.id !== null && String(row.id).trim() !== '') {
    const n = Number(String(row.id).trim());
    if (Number.isFinite(n) && n >= 1) id = n;
  }
  const slug = (row.slug && String(row.slug).trim()) || slugify(row.title);
  const base = {
    id: id ?? null,
    slug,
    title: String(row.title || '').trim(),
    audio: row.audio ? String(row.audio).trim() : null,
    pdf: row.pdf ? String(row.pdf).trim() : null,
    cover: row.cover ? String(row.cover).trim() : null,
    tags: parseTagsInput(row.tags ?? row.tags_csv),
    cues: Array.isArray(row.cues) ? row.cues
         : parseMaybeJSON(row.cues_json) || []
  };
  const narrativeSource = {
    ...base,
    oneliner: row.oneliner ?? row.one ?? '',
    description: row.description ?? row.desc ?? null
  };
  const { sanitized } = sanitizeNarrativeFields(narrativeSource);
  const output = { ...sanitized };
  // score block via JSON or flat columns
  const scoreJSON = parseMaybeJSON(row.score_json);
  if (scoreJSON) output.score = scoreJSON;
  else if (row.pdfStartPage || row.mediaOffsetSec || row.pdfDelta || row.pageMap) {
    output.score = {
      pdfStartPage: Number(row.pdfStartPage) || 1,
      mediaOffsetSec: Number(row.mediaOffsetSec) || 0,
      ...(row.pdfDelta !== undefined ? { pdfDelta: Number(row.pdfDelta) } : {}),
      pageMap: Array.isArray(row.pageMap) ? row.pageMap : parseMaybeJSON(row.pageMap) || []
    };
  }
  return output;
}

/* ------------------ lazy external loaders ------------------ */
async function lazyCsvParse() {
  try {
    const mod = await import('csv-parse/sync');
    return mod.parse;
  } catch (e) {
    console.log(pc.red('Missing dependency "csv-parse".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i csv-parse'));
    process.exit(1);
  }
}
async function lazyYaml() {
  try {
    const mod = await import('yaml');
    return mod.default || mod; // ESM default export
  } catch (e) {
    console.log(pc.red('Missing dependency "yaml".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i yaml'));
    process.exit(1);
  }
}
async function lazyMarked() {
  try {
    const mod = await import('marked');
    return mod;
  } catch (e) {
    console.log(pc.red('Missing dependency "marked".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i marked'));
    process.exit(1);
  }
}
async function lazyEsbuild() {
  try {
    // Use runtime esbuild so we can minify without bundling.
    const mod = await import('esbuild');
    return mod;
  } catch (e) {
    console.log(pc.red('Missing dependency "esbuild".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i esbuild'));
    process.exit(1);
  }
}
async function lazyOpen() {
  try {
    const mod = await import('open');
    return mod.default || mod;
  } catch (e) {
    console.log(pc.red('Missing dependency "open".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i open'));
    process.exit(1);
  }
}
async function lazyChokidar() {
  try {
    const mod = await import('chokidar');
    return mod.default || mod;
  } catch (e) {
    console.log(pc.red('Missing dependency "chokidar".'));
    console.log(pc.gray('Install it with: ') + pc.cyan('npm i chokidar'));
    process.exit(1);
  }
}
/* ------------------ Config I/O ------------------ */
function loadConfig() {
  const raw = readJsonSafe(CONFIG_PATH, {});
  const theme = raw.theme === 'light' ? 'light' : 'dark';
  const out = raw.output || {};
  const appearance = normalizeAppearance(raw.ui?.appearance || {}, { strict: false });
  const hasBrandingConfig = !!(raw.ui && Object.prototype.hasOwnProperty.call(raw.ui, 'branding'));
  const legacyBadgeDisabled = raw.site?.showBadge === false;
  const branding = normalizeBranding(
    hasBrandingConfig
      ? (raw.ui?.branding || {})
      : (legacyBadgeDisabled ? { attribution: { enabled: false } } : {}),
    { strict: false }
  );
  return {
    ...DEFAULT_CONFIG,
    theme,
    output: {
      ...DEFAULT_CONFIG.output,
      minify: !!out.minify,
      embed: !!out.embed
    },
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(raw.ui || {}),
      skin: raw.ui?.skin ?? DEFAULT_CONFIG.ui.skin,
      appearance,
      branding
    },
    site: {
      ...DEFAULT_CONFIG.site,
      ...(raw.site || {}),
      updated: { ...DEFAULT_CONFIG.site.updated, ...(raw.site?.updated || {}) },
      links: Array.isArray(raw.site?.links) ? raw.site.links : DEFAULT_CONFIG.site.links
    }
  };
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const appearance = normalizeAppearance(cfg?.ui?.appearance || {}, { strict: false });
  const branding = normalizeBranding(cfg?.ui?.branding || {}, { strict: false });
  const normalized = {
    theme: (cfg.theme === 'light') ? 'light' : 'dark',
    output: {
      minify: !!cfg.output?.minify,
      embed:  !!cfg.output?.embed
    },
    ui: {
      skin: String(cfg.ui?.skin || 'console'),
      allowUrlOverride: cfg.ui?.allowUrlOverride !== false,
      appearance,
      branding
    },
    site: {
      firstName: String(cfg.site?.firstName || ''),
      lastName:  String(cfg.site?.lastName  || ''),
      fullName:  String(cfg.site?.fullName  || ''),
      copyrightName: String(cfg.site?.copyrightName || ''),
      listLabel: String(cfg.site?.listLabel || 'Works List'),
      subtitle:  String(cfg.site?.subtitle  || ''),
      updated: {
        mode: (cfg.site?.updated?.mode === 'manual') ? 'manual' : 'auto',
        value: String(cfg.site?.updated?.value || '')
      },
      links: (Array.isArray(cfg.site?.links) ? cfg.site.links : []).map(l => ({
        label: String(l.label || ''), href: String(l.href || ''), external: !!l.external
      }))
    }
  };

  atomicWriteFile(CONFIG_PATH, JSON.stringify(normalized, null, 2));
}

function loadDocsConfig() {
  const raw = readJsonSafe(DOCS_CONFIG_PATH, null);
  if (!raw) {
    return JSON.parse(JSON.stringify(DEFAULT_DOCS_CONFIG));
  }
  return {
    ...JSON.parse(JSON.stringify(DEFAULT_DOCS_CONFIG)),
    ...raw,
    site: { ...DEFAULT_DOCS_CONFIG.site, ...(raw.site || {}) },
    sources: { ...DEFAULT_DOCS_CONFIG.sources, ...(raw.sources || {}) },
    ia: Array.isArray(raw.ia) ? raw.ia.map((section, idx) => ({
      id: section?.id || `section-${idx + 1}`,
      title: section?.title || `Section ${idx + 1}`,
      order: Number.isFinite(section?.order) ? section.order : idx,
      hidden: !!section?.hidden,
      pages: Array.isArray(section?.pages) ? section.pages.map(page => ({
        source: page?.source || '',
        title: page?.title || '',
        slug: page?.slug || slugify(page?.title || ''),
        summary: page?.summary || '',
        tags: Array.isArray(page?.tags) ? page.tags : [],
        hidden: !!page?.hidden
      })) : []
    })) : [],
    frontMatter: { ...DEFAULT_DOCS_CONFIG.frontMatter, ...(raw.frontMatter || {}) },
    codeTabs: {
      ...DEFAULT_DOCS_CONFIG.codeTabs,
      ...(raw.codeTabs || {}),
      order: Array.isArray(raw.codeTabs?.order) ? raw.codeTabs.order : DEFAULT_DOCS_CONFIG.codeTabs.order
    },
    assets: {
      ...DEFAULT_DOCS_CONFIG.assets,
      ...(raw.assets || {}),
      sizes: Array.isArray(raw.assets?.sizes) ? raw.assets.sizes : DEFAULT_DOCS_CONFIG.assets.sizes
    },
    search: {
      ...DEFAULT_DOCS_CONFIG.search,
      ...(raw.search || {}),
      engine: raw.search?.engine === 'fuse'
        ? 'fuse'
        : (raw.search?.engine === 'none' ? 'none' : (raw.search?.engine === 'auto' ? 'auto' : 'light')),
      fields: Array.isArray(raw.search?.fields) ? raw.search.fields : DEFAULT_DOCS_CONFIG.search.fields,
      excludeSections: Array.isArray(raw.search?.excludeSections) ? raw.search.excludeSections : []
    },
    works: { ...DEFAULT_DOCS_CONFIG.works, ...(raw.works || {}) },
    paths: { ...DEFAULT_DOCS_CONFIG.paths, ...(raw.paths || {}) }
  };
}

function saveDocsConfig(cfg) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const normalized = {
    site: {
      title: String(cfg.site?.title || ''),
      subtitle: String(cfg.site?.subtitle || ''),
      description: String(cfg.site?.description || ''),
      accent: String(cfg.site?.accent || '')
    },
    sources: {
      globs: Array.isArray(cfg.sources?.globs) ? cfg.sources.globs.map(String) : [],
      includeReadme: !!cfg.sources?.includeReadme
    },
    ia: Array.isArray(cfg.ia) ? cfg.ia.map((section, idx) => ({
      id: section?.id || `section-${idx + 1}`,
      title: section?.title || `Section ${idx + 1}`,
      order: Number.isFinite(section?.order) ? section.order : idx,
      hidden: !!section?.hidden,
      pages: Array.isArray(section?.pages) ? section.pages.map(page => ({
        source: page?.source || '',
        title: page?.title || '',
        slug: page?.slug || slugify(page?.title || ''),
        summary: page?.summary || '',
        tags: Array.isArray(page?.tags) ? page.tags.map(String) : [],
        hidden: !!page?.hidden
      })) : []
    })) : [],
    frontMatter: {
      addIfMissing: !!cfg.frontMatter?.addIfMissing,
      tocDepth: Number.isFinite(cfg.frontMatter?.tocDepth) ? cfg.frontMatter.tocDepth : DEFAULT_DOCS_CONFIG.frontMatter.tocDepth,
      autoSummary: !!cfg.frontMatter?.autoSummary
    },
    codeTabs: {
      enabled: !!cfg.codeTabs?.enabled,
      strategy: cfg.codeTabs?.strategy === 'snippets' ? 'snippets' : 'fence',
      order: Array.isArray(cfg.codeTabs?.order) ? cfg.codeTabs.order.map(String) : DEFAULT_DOCS_CONFIG.codeTabs.order
    },
    assets: {
      optimize: !!cfg.assets?.optimize,
      sizes: Array.isArray(cfg.assets?.sizes) ? cfg.assets.sizes.map(String) : DEFAULT_DOCS_CONFIG.assets.sizes,
      altPolicy: ['require', 'warn', 'auto'].includes(cfg.assets?.altPolicy) ? cfg.assets.altPolicy : 'warn'
    },
    search: {
      enabled: !!cfg.search?.enabled,
      engine: cfg.search?.engine === 'fuse'
        ? 'fuse'
        : (cfg.search?.engine === 'none' ? 'none' : (cfg.search?.engine === 'auto' ? 'auto' : 'light')),
      fields: Array.isArray(cfg.search?.fields) ? cfg.search.fields.map(String) : DEFAULT_DOCS_CONFIG.search.fields,
      excludeSections: Array.isArray(cfg.search?.excludeSections) ? cfg.search.excludeSections.map(String) : []
    },
    works: {
      includeInNav: !!cfg.works?.includeInNav,
      includeOnHome: !!cfg.works?.includeOnHome,
      linkMode: ['internal', 'external', 'auto'].includes(cfg.works?.linkMode) ? cfg.works.linkMode : 'auto'
    },
    paths: {
      root: String(cfg.paths?.root || 'docs/'),
      homepage: String(cfg.paths?.homepage || '')
    }
  };
  atomicWriteFile(DOCS_CONFIG_PATH, JSON.stringify(normalized, null, 2));
}

const DOCS_SKIP_DIRS = new Set([
  '.git','node_modules','.prae','dist','build','.next','.nuxt','.svelte-kit','.vercel','.output','.cache','.idea','.vscode','coverage','tmp'
]);

const DOCS_GLOB_CACHE = new Map();

function globToRegex(pattern) {
  const key = pattern || '';
  if (DOCS_GLOB_CACHE.has(key)) return DOCS_GLOB_CACHE.get(key);
  const normalized = String(pattern || '').split('\\').join('/');
  let source = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (ch === '*') {
      const next = normalized[i + 1];
      if (next === '*') {
        const after = normalized[i + 2];
        if (after === '/') {
          source += '(?:.*/)?';
          i += 2; // skip the next '*' and the '/'
        } else {
          source += '.*';
          i += 1; // skip the next '*'
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      continue;
    }
    const needsEscape = /[.+^${}()|[\]\\]/.test(ch);
    source += needsEscape ? `\\${ch}` : ch;
  }
  const compiled = new RegExp(`^${source}$`, 'i');
  DOCS_GLOB_CACHE.set(key, compiled);
  return compiled;
}

function matchesGlob(pattern, target) {
  if (!pattern) return false;
  const rx = globToRegex(pattern);
  return rx.test(target.split('\\').join('/'));
}

function toPosix(p) { return p.split(path.sep).join('/'); }

function globBase(pattern) {
  const normalized = String(pattern || '').split('\\').join('/');
  const parts = normalized.split('/');
  const base = [];
  for (const part of parts) {
    if (!part) continue;
    if (/[\[*?]/.test(part)) break;
    base.push(part);
  }
  if (!base.length) return '.';
  return base.join('/');
}

function ensureDocsRoot(input) {
  const normalized = (input || 'docs').split('\\').join('/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); }
  catch { return ''; }
}

function markdownFirstHeading(src) {
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+/.test(trimmed)) {
      return trimmed.replace(/^#{1,6}\s+/, '').trim();
    }
  }
  return '';
}

function markdownFirstParagraph(src) {
  const lines = src.split(/\r?\n/);
  const buf = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (buf.length) break;
      continue;
    }
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (buf.length) break;
      continue;
    }
    buf.push(line.trim());
    if (buf.join(' ').length > 160) break;
  }
  return buf.join(' ');
}

function stripInlineMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\(([^)]*)\)/g, (_, label) => label)
    .replace(/[*_~]+/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveSummaryFromMarkdown(markdown) {
  if (!markdown) return '';
  const lines = String(markdown).split(/\r?\n/);
  const buf = [];
  let collecting = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!collecting) {
      if (!trimmed) continue;
      if (/^#{1,6}\s+/.test(trimmed)) continue;
      collecting = true;
    }
    if (collecting) {
      if (!trimmed) break;
      if (/^#{1,6}\s+/.test(trimmed)) break;
      buf.push(trimmed);
    }
    if (buf.join(' ').length > 220) break;
  }
  const paragraph = stripInlineMarkdown(buf.join(' '));
  if (!paragraph) return '';
  if (paragraph.length <= 200) return paragraph;
  return `${paragraph.slice(0, 197).trimEnd()}…`;
}

function walkMarkdownFiles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let ents = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch { continue; }
    for (const ent of ents) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(rootDir, abs);
      if (ent.isDirectory()) {
        if (DOCS_SKIP_DIRS.has(ent.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!abs.toLowerCase().endsWith('.md')) continue;
      out.push({ abs, rel: toPosix(rel) });
    }
  }
  return out;
}

function collectMarkdownSources({ projectRoot, globs, docsRoot }) {
  const patterns = Array.isArray(globs) && globs.length ? globs.map(g => String(g || '').trim()).filter(Boolean) : [];
  const normalizedPatterns = patterns.length ? patterns : ['docs/**/*.md'];
  const docsRootNorm = ensureDocsRoot(docsRoot || 'docs/');
  const docsAssetsDir = `${docsRootNorm.replace(/\/$/, '')}/assets`;
  const skipDirs = new Set(['node_modules', 'dist', 'build', 'coverage']);
  const dedup = new Map();
  const bases = new Set();
  normalizedPatterns.forEach(pattern => {
    const base = globBase(pattern) || '.';
    bases.add(base);
  });

  const ensureMatch = (rel) => normalizedPatterns.some(pattern => matchesGlob(pattern, rel));

  const visitDir = (absBase) => {
    const stack = [absBase];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const entry of entries) {
        if (!entry) continue;
        const name = entry.name;
        if (!name) continue;
        if (name.startsWith('.')) continue;
        if (entry.isDirectory()) {
          if (skipDirs.has(name)) continue;
          const childAbs = path.join(dir, name);
          const rel = toPosix(path.relative(projectRoot, childAbs));
          const relLower = rel.toLowerCase();
          if (relLower === docsAssetsDir.toLowerCase()) continue;
          if (relLower.startsWith(`${docsAssetsDir.toLowerCase()}/`)) continue;
          stack.push(childAbs);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!name.toLowerCase().endsWith('.md')) continue;
        const abs = path.join(dir, name);
        const rel = toPosix(path.relative(projectRoot, abs));
        if (rel.startsWith('.')) {
          const trimmed = rel.replace(/^\.\/+/, '');
          if (!ensureMatch(trimmed)) continue;
        }
        if (!ensureMatch(rel)) continue;
        const relLower = rel.toLowerCase();
        if (relLower === docsAssetsDir.toLowerCase()) continue;
        if (relLower.startsWith(`${docsAssetsDir.toLowerCase()}/`)) continue;
        dedup.set(rel, abs);
      }
    }
  };

  for (const base of bases) {
    const absBase = path.resolve(projectRoot, base);
    let stat;
    try {
      stat = fs.statSync(absBase);
    } catch (_) {
      continue;
    }
    if (stat.isFile()) {
      const rel = toPosix(path.relative(projectRoot, absBase));
      if (ensureMatch(rel)) {
        const relLower = rel.toLowerCase();
        if (relLower === docsAssetsDir.toLowerCase()) continue;
        if (relLower.startsWith(`${docsAssetsDir.toLowerCase()}/`)) continue;
        dedup.set(rel, absBase);
      }
      continue;
    }
    if (stat.isDirectory()) {
      visitDir(absBase);
    }
  }

  return Array.from(dedup.entries())
    .map(([rel, abs]) => ({ rel: rel.replace(/^\.\/+/, ''), abs }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

function parseReadmeSections(readmePath) {
  const contents = readFileSafe(readmePath);
  if (!contents) return [];
  const lines = contents.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^#{1}\s+/.test(line) && !sections.length) {
      // README title; skip storing
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      const title = line.replace(/^##\s+/, '').trim();
      current = { title, slug: slugify(title), lines: [] };
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.map((section, idx) => {
    const text = section.lines.join('\n');
    return {
      id: section.slug || `readme-${idx + 1}`,
      title: section.title,
      slug: section.slug || `readme-${idx + 1}`,
      snippet: markdownFirstParagraph(text)
    };
  });
}

function detectDocsEnvironment({ root = process.cwd(), docsRoot = 'docs/' } = {}) {
  const projectRoot = path.resolve(root);
  const normalizedRoot = ensureDocsRoot(docsRoot);
  const docsDir = path.resolve(projectRoot, normalizedRoot);
  const docsExists = fs.existsSync(docsDir);
  const docsFiles = docsExists ? walkMarkdownFiles(docsDir).map(({ abs, rel }) => {
    const relWithin = toPosix(rel);
    const src = readFileSafe(abs);
    const title = markdownFirstHeading(src) || path.basename(relWithin, path.extname(relWithin)).replace(/[-_]/g, ' ');
    const sectionSegment = relWithin.includes('/') ? relWithin.split('/')[0] : '';
    return {
      abs,
      rel: toPosix(path.join(normalizedRoot.replace(/\/$/, ''), relWithin)),
      relWithin,
      section: sectionSegment,
      title: title ? title.trim() : path.basename(relWithin),
      snippet: markdownFirstParagraph(src)
    };
  }) : [];

  const readmePath = path.join(projectRoot, 'README.md');
  const readmeExists = fs.existsSync(readmePath);
  const readmeSections = readmeExists ? parseReadmeSections(readmePath) : [];

  const projectMarkdown = walkMarkdownFiles(projectRoot).filter(({ abs }) => {
    if (docsExists && abs.startsWith(docsDir + path.sep)) return false;
    if (readmeExists && abs === readmePath) return false;
    return true;
  }).map(({ abs, rel }) => {
    const src = readFileSafe(abs);
    const title = markdownFirstHeading(src) || path.basename(rel, path.extname(rel)).replace(/[-_]/g, ' ');
    return {
      abs,
      rel: toPosix(rel),
      title: title ? title.trim() : path.basename(rel),
      snippet: markdownFirstParagraph(src)
    };
  });

  const assetDirs = ['images', 'image', 'assets', 'static', 'public']
    .map(name => ({ name, abs: path.join(projectRoot, name) }))
    .filter(entry => fs.existsSync(entry.abs) && fs.statSync(entry.abs).isDirectory())
    .map(entry => entry.name);

  const worksDb = loadDb();
  const worksCount = Array.isArray(worksDb.works) ? worksDb.works.length : 0;

  return {
    projectRoot,
    docsRoot: normalizedRoot,
    docsDir,
    docsExists,
    docsFiles,
    readme: { path: readmePath, exists: readmeExists, sections: readmeSections },
    otherMarkdown: projectMarkdown,
    assetDirs,
    works: { count: worksCount, titles: (worksDb.works || []).map(w => w.title).slice(0, 8) }
  };
}

function scaffoldDocsSkeleton(docsDir) {
  const starters = [
    { file: 'getting-started.md', title: 'Getting Started', body: '# Getting Started\n\nWelcome to your new documentation hub. Outline the fastest way to begin here.\n' },
    { file: 'concepts.md', title: 'Core Concepts', body: '# Core Concepts\n\nExplain the foundational ideas a reader must know before diving deeper.\n' },
    { file: 'tutorials.md', title: 'Tutorials', body: '# Tutorials\n\nLay out step-by-step guides. Link to longer walk-throughs here.\n' },
    { file: 'api.md', title: 'API Reference', body: '# API Reference\n\nDocument endpoints, functions, and options. Use code blocks liberally.\n' },
    { file: 'faq.md', title: 'FAQ', body: '# Frequently Asked Questions\n\nAnswer common concerns to reduce support pings.\n' },
    { file: 'changelog.md', title: 'Changelog', body: '# Changelog\n\nTrack noteworthy changes release by release.\n' }
  ];
  fs.mkdirSync(docsDir, { recursive: true });
  const created = [];
  for (const entry of starters) {
    const target = path.join(docsDir, entry.file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, `${entry.body}\n`, 'utf8');
      created.push(target);
    }
  }
  const assetsDir = path.join(docsDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, '.gitkeep'), '', 'utf8');
    created.push(assetsDir);
  }
  return created;
}

function extractFrontMatter(src, YAML) {
  if (!src || typeof src !== 'string') return { body: src, data: {} };
  const trimmed = src.trimStart();
  if (!trimmed.startsWith('---')) return { body: src, data: {} };
  const lines = src.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { body: src, data: {} };
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return { body: src, data: {} };
  const yamlText = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');
  let data = {};
  try {
    data = YAML.parse(yamlText) || {};
  } catch (_) {
    data = {};
  }
  return { body, data };
}

function htmlToPlainText(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function readReadmeSection(projectRoot, slug) {
  const readmePath = path.join(projectRoot, 'README.md');
  if (!fs.existsSync(readmePath)) return { title: '', body: '' };
  const contents = readFileSafe(readmePath);
  const lines = contents.split(/\r?\n/);
  let collecting = false;
  let title = '';
  const buf = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#{1}\s+/.test(line) && !collecting) {
      continue; // skip README title
    }
    if (/^##\s+/.test(line)) {
      const currentSlug = slugify(line.replace(/^##\s+/, '').trim());
      if (collecting) break;
      if (currentSlug === slug) {
        collecting = true;
        title = line.replace(/^##\s+/, '').trim();
        continue;
      }
    }
    if (collecting) {
      buf.push(line);
    }
  }
  return { title, body: buf.join('\n') };
}

function renderWorksList(works, { linkMode = 'auto' } = {}) {
  if (!works.length) {
    return '<p>No works found yet. Run <code>prae add</code> to add repertoire.</p>';
  }
  const items = works.map((work) => {
    const view = normalizeWork(work);
    const slug = slugify(view.slug || view.title || 'work');
    const href = linkMode === 'external' && work.href
      ? work.href
      : `#works-${slug}`;
    const label = view.title || view.slug || 'Untitled';
    const summary = view.onelinerEffective || '';
    const anchor = linkMode === 'external' && work.href
      ? `<a href="${work.href}" target="_blank" rel="noopener">${label}</a>`
      : `<a href="${href}">${label}</a>`;
    return `<li><h3>${anchor}</h3>${summary ? `<p>${summary}</p>` : ''}</li>`;
  }).join('');
  return `<div class="docs-works-list"><ul>${items}</ul></div>`;
}

async function buildDocsPayload({ config, projectRoot, worksDb }) {
  const sectionsConfig = Array.isArray(config.ia) ? config.ia.slice() : [];
  sectionsConfig.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const docsRoot = ensureDocsRoot(config.paths?.root || 'docs/');
  const docsRootNoSlash = docsRoot.replace(/\/$/, '');
  const works = Array.isArray(worksDb?.works) ? worksDb.works : [];
  const YAML = await lazyYaml();
  const markedLib = await lazyMarked();
  const warnings = [];
  const markdownSources = collectMarkdownSources({
    projectRoot,
    globs: config.sources?.globs,
    docsRoot
  });

  const docs = [];
  const docLookup = new Map();

  const registerDoc = (doc) => {
    if (!doc || !doc.id) return;
    const keys = [doc.id, doc.path, doc.url, doc.path.replace(/\.md$/i, '')]
      .map(key => key && key.toLowerCase())
      .filter(Boolean);
    keys.forEach(key => {
      if (!key) return;
      if (!docLookup.has(key)) docLookup.set(key, doc);
    });
  };

  const renderMarkdown = (markdown) => {
    const renderer = new markedLib.Renderer();
    const headings = [];
    const headingCounts = new Map();
    renderer.heading = function headingRenderer(token) {
      const depth = Number.isFinite(token?.depth) ? token.depth : 2;
      const rawHtml = this.parser && token?.tokens ? this.parser.parseInline(token.tokens) : (token?.text ?? '');
      const sourceText = typeof token?.text === 'string' ? token.text : stripInlineMarkdown(rawHtml);
      let safe = slugify(sourceText || `section-${headings.length + 1}`);
      if (!safe) safe = `section-${headings.length + 1}`;
      const seen = headingCounts.get(safe) || 0;
      headingCounts.set(safe, seen + 1);
      const id = seen ? `${safe}-${seen + 1}` : safe;
      const plain = stripInlineMarkdown(sourceText || rawHtml || id);
      headings.push({ id, depth, text: plain || id });
      return `<h${depth} id="${id}">${rawHtml}</h${depth}>`;
    };
    const parser = new markedLib.Marked({
      renderer,
      gfm: true,
      breaks: false,
      smartypants: true,
      mangle: false,
      headerIds: false
    });
    const html = parser.parse(markdown || '');
    return { html, headings };
  };

  const titleFromFilename = (relPath) => {
    const name = path.basename(relPath, path.extname(relPath));
    return sectionLabelFromSegment(name);
  };

  const ensureString = (value, fallback = '') => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : fallback;
    }
    return fallback;
  };

  const ensureArrayStrings = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  };

  const normalizeDocBreadcrumbs = (relPath) => {
    if (!relPath) return [];
    let within = relPath;
    const docsRootPrefix = `${docsRootNoSlash}/`;
    if (within.startsWith(docsRootPrefix)) within = within.slice(docsRootPrefix.length);
    const segments = within.split('/').filter(Boolean);
    const crumbs = [];
    let accumulated = '';
    segments.forEach((segment, idx) => {
      const isLast = idx === segments.length - 1;
      let raw = segment;
      if (isLast) raw = raw.replace(/\.md$/i, '');
      if (!raw || raw.toLowerCase() === 'index') return;
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      crumbs.push({
        id: slugify(raw) || `crumb-${idx + 1}`,
        label: sectionLabelFromSegment(raw),
        path: accumulated
      });
    });
    return crumbs;
  };

  const normalizeHeroConfig = (hero, docId) => {
    if (!hero || typeof hero !== 'object') return null;
    const normalized = {};
    const kicker = ensureString(hero.kicker);
    const title = ensureString(hero.title);
    const lede = ensureString(hero.lede);
    if (kicker) normalized.kicker = kicker;
    if (title) normalized.title = title;
    if (lede) normalized.lede = lede;
    if (Array.isArray(hero.works) && hero.works.length) {
      normalized.works = hero.works.map((work, idx) => {
        if (!work || typeof work !== 'object') return null;
        const workTitle = ensureString(work.title, 'Untitled');
        const workSummary = ensureString(work.summary || work.snippet);
        const workId = ensureString(work.id, slugify(workTitle || `work-${idx + 1}`));
        return {
          id: workId || `work-${idx + 1}`,
          title: workTitle || `Work ${idx + 1}`,
          summary: workSummary
        };
      }).filter(Boolean);
      if (!normalized.works.length) delete normalized.works;
    }
    if (!Object.keys(normalized).length) return null;
    return normalized;
  };

  const parseCueTime = (value) => {
    if (Number.isFinite(Number(value))) return Number(value);
    const asString = String(value ?? '').trim();
    if (!asString) return null;
    if (/^\d+:\d{2}(?::\d{2})?$/.test(asString)) {
      const parts = asString.split(':').map((part) => Number(part));
      if (parts.length === 2) return (parts[0] * 60) + parts[1];
      if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return null;
  };

  const normalizeModuleMediaItems = (items, { docId, basePath }) => {
    if (!Array.isArray(items)) return [];
    return items.map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const src = ensureString(item.src || item.url);
      if (!src) {
        warnings.push(`Doc "${docId}" media module item ${idx + 1} is missing src.`);
        return null;
      }
      const alt = ensureString(item.alt);
      if (!alt) {
        warnings.push(`Doc "${docId}" media module item ${idx + 1} is missing alt text.`);
      }
      const caption = ensureString(item.caption);
      const explicitType = ensureString(item.type).toLowerCase();
      const inferredType = /\.(mp4|webm|ogg|mov|m4v)$/i.test(src) ? 'video' : 'image';
      const type = explicitType === 'video' ? 'video' : (explicitType === 'image' ? 'image' : inferredType);
      return {
        src,
        alt,
        caption,
        type,
        path: basePath ? `${basePath}.items[${idx}]` : ''
      };
    }).filter(Boolean);
  };

  const normalizeModules = (input, { docId }) => {
    if (!Array.isArray(input)) return [];
    const normalized = [];
    input.forEach((module, idx) => {
      if (!module || typeof module !== 'object') return;
      const type = ensureString(module.type).toLowerCase();
      const title = ensureString(module.title);
      const keyBase = `modules[${idx}]`;
      if (!type) {
        warnings.push(`Doc "${docId}" ${keyBase} is missing required "type".`);
        return;
      }

      if (type === 'score') {
        const pdf = ensureString(module.pdf);
        if (!pdf) {
          warnings.push(`Doc "${docId}" ${keyBase} (score) is missing required "pdf".`);
          return;
        }
        const audio = ensureString(module.audio);
        const cues = Array.isArray(module.cues) ? module.cues.map((cue, cueIdx) => {
          if (!cue || typeof cue !== 'object') return null;
          const label = ensureString(cue.label, `Cue ${cueIdx + 1}`);
          const t = parseCueTime(cue.t ?? cue.time ?? cue.at);
          if (t == null) {
            warnings.push(`Doc "${docId}" ${keyBase}.cues[${cueIdx}] has invalid time.`);
            return null;
          }
          const pageRaw = cue.page ?? cue.pdfPage;
          const page = Number.isFinite(Number(pageRaw)) && Number(pageRaw) >= 1 ? Number(pageRaw) : null;
          return { label, t, page };
        }).filter(Boolean) : [];
        normalized.push({
          type,
          title: title || 'Score',
          pdf,
          audio: audio || '',
          pageFollow: module.pageFollow !== false,
          cues
        });
        return;
      }

      if (type === 'media') {
        const layout = ensureString(module.layout).toLowerCase();
        const items = normalizeModuleMediaItems(module.items, { docId, basePath: keyBase });
        if (!items.length) {
          warnings.push(`Doc "${docId}" ${keyBase} (media) has no valid items.`);
          return;
        }
        normalized.push({
          type,
          title: title || 'Media',
          layout: layout === 'masonry' ? 'masonry' : 'grid',
          items
        });
        return;
      }

      if (type === 'process') {
        const steps = Array.isArray(module.steps) ? module.steps.map((step, stepIdx) => {
          if (!step || typeof step !== 'object') return null;
          const stepTitle = ensureString(step.title, `Step ${stepIdx + 1}`);
          const bodyRaw = ensureString(step.body);
          const body = bodyRaw ? renderMarkdown(bodyRaw).html : '';
          const media = normalizeModuleMediaItems(step.media, { docId, basePath: `${keyBase}.steps[${stepIdx}].media` });
          return { title: stepTitle, body, media };
        }).filter(Boolean) : [];
        if (!steps.length) {
          warnings.push(`Doc "${docId}" ${keyBase} (process) has no valid steps.`);
          return;
        }
        normalized.push({
          type,
          title: title || 'Process',
          steps
        });
        return;
      }

      if (type === 'credits') {
        const roles = Array.isArray(module.roles) ? module.roles.map((role, roleIdx) => {
          if (!role || typeof role !== 'object') return null;
          const roleLabel = ensureString(role.role, `Role ${roleIdx + 1}`);
          const people = ensureArrayStrings(role.people);
          if (!people.length) {
            warnings.push(`Doc "${docId}" ${keyBase}.roles[${roleIdx}] has no people.`);
            return null;
          }
          return { role: roleLabel, people };
        }).filter(Boolean) : [];
        if (!roles.length) {
          warnings.push(`Doc "${docId}" ${keyBase} (credits) has no valid roles.`);
          return;
        }
        normalized.push({
          type,
          title: title || 'Credits',
          roles
        });
        return;
      }

      warnings.push(`Doc "${docId}" ${keyBase} uses unsupported module type "${type}" and was skipped.`);
    });
    return normalized;
  };

  markdownSources.forEach(({ rel, abs }) => {
    const relPosix = rel.split('\\').join('/');
    const raw = readFileSafe(abs);
    const fm = extractFrontMatter(raw, YAML);
    const fmData = (fm.data && typeof fm.data === 'object') ? fm.data : {};
    const body = fm.body || '';
    const headingTitle = markdownFirstHeading(body);
    let title = typeof fmData.title === 'string' && fmData.title.trim()
      ? fmData.title.trim()
      : (headingTitle ? headingTitle.trim() : titleFromFilename(relPosix));
    if (!title) title = titleFromFilename(relPosix);
    const subtitle = typeof fmData.subtitle === 'string' && fmData.subtitle.trim()
      ? fmData.subtitle.trim()
      : undefined;
    let summary = typeof fmData.summary === 'string' && fmData.summary.trim()
      ? fmData.summary.trim()
      : deriveSummaryFromMarkdown(body);
    if (!summary) summary = '';
    const rendered = renderMarkdown(body);
    const id = relPosix.replace(/\.md$/i, '');
    const url = `#/${id}`;
    const status = ensureString(fmData.status).toLowerCase();
    const updated = ensureString(fmData.updated);
    const isNew = fmData.new === true || status === 'new';
    const isUpdated = status === 'updated' || (!!updated && !isNew);
    const tags = ensureArrayStrings(fmData.tags);
    const modules = normalizeModules(fmData.modules, { docId: id });
    const hero = normalizeHeroConfig(fmData.hero, id);
    const breadcrumbs = normalizeDocBreadcrumbs(relPosix);
    const doc = {
      id,
      path: relPosix,
      url,
      title,
      subtitle,
      summary,
      headings: rendered.headings,
      html: rendered.html,
      breadcrumbs,
      tags,
      hero,
      modules,
      meta: {
        status: isNew ? 'new' : (isUpdated ? 'updated' : ''),
        updated
      },
      fm: fmData
    };
    docs.push(doc);
    registerDoc(doc);
  });

  const worksConfig = config.works || {};
  const worksIncludeInNav = !!worksConfig.includeInNav;
  const worksIncludeOnHome = !!worksConfig.includeOnHome;
  const worksLinkMode = worksConfig.linkMode || 'auto';
  const worksHighlights = [];
  let worksDoc = null;

  if (worksIncludeInNav || worksIncludeOnHome) {
    const worksHtml = renderWorksList(works, { linkMode: worksLinkMode });
    if (worksIncludeInNav) {
      worksDoc = {
        id: 'works',
        path: 'works::auto',
        url: '#/works',
        title: 'Works',
        subtitle: undefined,
        summary: works.length ? 'Browse the works catalogue.' : 'Auto-generated works listing.',
        headings: [],
        html: worksHtml,
        breadcrumbs: [],
        tags: [],
        hero: null,
        modules: [],
        meta: { status: '', updated: '' },
        fm: {}
      };
      docs.push(worksDoc);
      registerDoc(worksDoc);
    }
    if (worksIncludeOnHome) {
      const highlights = works.slice(0, 4).map(work => {
        const view = normalizeWork(work);
        const label = view.title || view.slug || 'Untitled';
        const text = view.onelinerEffective || stripInlineMarkdown(view.descriptionEffective || '').slice(0, 180);
        return {
          id: slugify(view.slug || label || 'work'),
          title: label,
          summary: text ? (text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text) : ''
        };
      }).filter(Boolean);
      highlights.forEach(item => {
        if (!item.title) item.title = 'Untitled';
      });
      worksHighlights.push(...highlights);
    }
  }

  const normalizeSourcePath = (source) => {
    if (!source) return '';
    const raw = String(source || '').trim();
    if (!raw) return '';
    const normalized = raw.split('\\').join('/');
    if (normalized.startsWith('/')) {
      let trimmed = normalized;
      while (trimmed.startsWith('/')) trimmed = trimmed.slice(1);
      return trimmed;
    }
    if (normalized.startsWith('./')) {
      let trimmed = normalized;
      while (trimmed.startsWith('./')) trimmed = trimmed.slice(2);
      return trimmed;
    }
    if (!normalized.startsWith(docsRoot)) {
      let joined = `${docsRootNoSlash}/${normalized}`;
      while (joined.includes('//')) joined = joined.replace('//', '/');
      return joined;
    }
    return normalized;
  };
  const findDocForSource = (source, slug) => {
    const normalized = normalizeSourcePath(source);
    const keys = [];
    if (normalized) {
      const lower = normalized.toLowerCase();
      keys.push(lower);
      if (lower.endsWith('.md')) {
        keys.push(lower.replace(/\.md$/, ''));
      } else {
        keys.push(`${lower}.md`);
      }
    }
    if (slug) keys.push(String(slug).toLowerCase());
    for (const key of keys) {
      if (docLookup.has(key)) return docLookup.get(key);
    }
    if (slug) {
      const slugLower = String(slug).toLowerCase();
      for (const doc of docs) {
        if (doc.id.toLowerCase().endsWith(`/${slugLower}`)) return doc;
      }
    }
    return null;
  };

  const nav = [];
  const usedDocIds = new Set();
  const docSearchGroup = new Map();
  const docSearchGroupId = new Map();

  sectionsConfig.forEach((section) => {
    if (!section || section.hidden) return;
    const group = {
      id: section.id || slugify(section.title || 'section'),
      label: section.title || 'Section',
      items: []
    };
    const pages = Array.isArray(section.pages) ? section.pages.slice() : [];
    pages.forEach((page) => {
      if (!page || page.hidden) return;
      const source = (page.source || '').split('\\').join('/');
      if (source.startsWith('works::')) {
        if (worksDoc) {
          const label = (page.title && page.title.trim()) || worksDoc.title;
          const snippet = (page.summary && page.summary.trim()) || worksDoc.summary || 'Works catalogue';
          group.items.push({
            id: worksDoc.id,
            label,
            href: worksDoc.url,
            snippet,
            docId: worksDoc.id,
            meta: { status: '', updated: '' }
          });
          usedDocIds.add(worksDoc.id);
          docSearchGroup.set(worksDoc.id, group.label);
          docSearchGroupId.set(worksDoc.id, group.id);
        }
        return;
      }
      const doc = findDocForSource(source, page.slug);
      if (!doc) {
        if (source) warnings.push(`Docs source not found: ${source}`);
        return;
      }
      usedDocIds.add(doc.id);
      docSearchGroup.set(doc.id, group.label);
      docSearchGroupId.set(doc.id, group.id);
      const label = (page.title && page.title.trim()) || doc.title;
      const snippet = (page.summary && page.summary.trim()) || doc.summary || htmlToPlainText(doc.html).slice(0, 200);
      group.items.push({
        id: doc.id,
        label,
        href: doc.url,
        snippet,
        docId: doc.id,
        meta: doc.meta || { status: '', updated: '' }
      });
    });
    if (group.items.length) nav.push(group);
  });

  const docsRootPrefix = `${docsRootNoSlash}/`;
  const autoGroups = new Map();
  docs.forEach((doc) => {
    if (!doc || usedDocIds.has(doc.id)) return;
    if (doc.path === 'works::auto') return;
    if (!doc.path.toLowerCase().endsWith('.md')) return;
    let within = doc.path;
    if (within.startsWith(docsRootPrefix)) {
      within = within.slice(docsRootPrefix.length);
    }
    const segment = within.includes('/') ? within.split('/')[0] : '';
    const groupId = segment ? `auto-${slugify(segment)}` : 'auto-other';
    const groupLabel = segment ? sectionLabelFromSegment(segment) : 'Other';
    if (!autoGroups.has(groupId)) {
      autoGroups.set(groupId, { id: groupId, label: groupLabel, items: [] });
    }
    const snippet = doc.summary || htmlToPlainText(doc.html).slice(0, 200);
    autoGroups.get(groupId).items.push({
      id: doc.id,
      label: doc.title,
      href: doc.url,
      snippet,
      docId: doc.id,
      meta: doc.meta || { status: '', updated: '' }
    });
    docSearchGroup.set(doc.id, groupLabel);
    docSearchGroupId.set(doc.id, groupId);
  });

  Array.from(autoGroups.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((group) => {
      group.items.sort((a, b) => a.label.localeCompare(b.label));
      nav.push(group);
    });

  if (worksDoc && !usedDocIds.has(worksDoc.id) && worksIncludeInNav) {
    const groupId = 'works';
    const group = { id: groupId, label: 'Works', items: [{
      id: worksDoc.id,
      label: worksDoc.title,
      href: worksDoc.url,
      snippet: worksDoc.summary || 'Works catalogue',
      docId: worksDoc.id,
      meta: { status: '', updated: '' }
    }] };
    nav.push(group);
    docSearchGroup.set(worksDoc.id, group.label);
    docSearchGroupId.set(worksDoc.id, groupId);
  }

  const homepageSource = (config.paths?.homepage || '').split('\\').join('/');
  let homepageDoc = findDocForSource(homepageSource, null);
  if (!homepageDoc) {
    const defaultIndex = `${docsRootNoSlash}/index.md`.toLowerCase();
    homepageDoc = docLookup.get(defaultIndex) || docLookup.get(defaultIndex.replace(/\.md$/, '')) || null;
  }
  if (!homepageDoc) {
    homepageDoc = docs.find(doc => doc.path.toLowerCase().endsWith('index.md')) || null;
  }
  if (!homepageDoc) {
    homepageDoc = docs.find(doc => doc.path.toLowerCase().endsWith('.md')) || null;
  }
  if (homepageDoc && homepageDoc.path === 'works::auto') {
    homepageDoc = docs.find(doc => doc.path !== 'works::auto');
  }

  const siteTitle = config.site?.title?.trim() || 'Praetorius Docs';
  const siteSubtitle = config.site?.subtitle?.trim() || '';
  const siteDescription = config.site?.description?.trim() || '';
  const siteAccent = config.site?.accent?.trim() || '';

  const searchSettings = config.search || {};
  const requestedEngineRaw = ensureString(searchSettings.engine, 'auto').toLowerCase();
  const requestedEngine = ['auto', 'light', 'fuse', 'none'].includes(requestedEngineRaw) ? requestedEngineRaw : 'auto';
  const searchEnabled = searchSettings.enabled !== false && requestedEngine !== 'none';
  const searchFields = Array.isArray(searchSettings.fields) && searchSettings.fields.length
    ? searchSettings.fields.map((field) => String(field || '').toLowerCase()).filter(Boolean)
    : ['title', 'headings', 'body', 'summary'];
  const excludedSections = new Set(
    Array.isArray(searchSettings.excludeSections)
      ? searchSettings.excludeSections.map((id) => String(id || '').trim()).filter(Boolean)
      : []
  );

  const aggregateSearchBytes = docs.reduce((sum, doc) => {
    if (!doc) return sum;
    const text = `${doc.title || ''} ${doc.summary || ''} ${htmlToPlainText(doc.html || '')}`;
    return sum + Buffer.byteLength(text, 'utf8');
  }, 0);
  const docCountForSearch = docs.filter((doc) => doc && doc.path !== 'works::auto').length;
  const AUTO_DOC_THRESHOLD = 40;
  const AUTO_BYTES_THRESHOLD = 250 * 1024;
  let effectiveSearchEngine = requestedEngine;
  if (!searchEnabled) {
    effectiveSearchEngine = 'none';
  } else if (requestedEngine === 'auto') {
    effectiveSearchEngine = (docCountForSearch > AUTO_DOC_THRESHOLD || aggregateSearchBytes > AUTO_BYTES_THRESHOLD)
      ? 'fuse'
      : 'light';
  } else if (!['light', 'fuse'].includes(requestedEngine)) {
    effectiveSearchEngine = 'light';
  }

  const searchIndex = [];
  if (effectiveSearchEngine !== 'none') {
    docs.forEach((doc) => {
      if (!doc) return;
      const groupId = docSearchGroupId.get(doc.id) || '';
      if (groupId && excludedSections.has(groupId)) return;
      const group = docSearchGroup.get(doc.id) || 'Docs';
      const snippet = doc.summary || htmlToPlainText(doc.html).slice(0, 220);
      const bodyText = htmlToPlainText(doc.html);
      const headingText = Array.isArray(doc.headings) ? doc.headings.map((h) => h.text).join(' ') : '';
      const tokens = [];
      if (searchFields.includes('title')) tokens.push(doc.title || '');
      if (searchFields.includes('summary')) tokens.push(doc.summary || '');
      if (searchFields.includes('body')) tokens.push(bodyText);
      if (searchFields.includes('headings')) tokens.push(headingText);
      if (searchFields.includes('tags') && Array.isArray(doc.tags)) tokens.push(doc.tags.join(' '));
      const haystack = tokens.join(' ').trim();
      if (!haystack) return;
      searchIndex.push({
        title: doc.title,
        url: doc.url,
        snippet,
        group,
        groupId,
        docId: doc.id,
        kind: 'doc',
        headingId: '',
        tokens: haystack
      });
      if (searchFields.includes('headings') && Array.isArray(doc.headings)) {
        doc.headings.forEach((heading) => {
          if (!heading || !heading.id || !heading.text) return;
          searchIndex.push({
            title: heading.text,
            url: `${doc.url}?h=${encodeURIComponent(heading.id)}`,
            snippet: doc.title,
            group,
            groupId,
            docId: doc.id,
            kind: 'heading',
            headingId: heading.id,
            tokens: `${heading.text} ${doc.title || ''} ${snippet || ''}`
          });
        });
      }
    });
  }

  const heroData = (() => {
    const base = {
      title: ensureString(homepageDoc?.title, siteTitle) || siteTitle || 'Documentation',
      lede: ensureString(homepageDoc?.summary, siteDescription) || siteDescription || '',
      kicker: ensureString(homepageDoc?.subtitle, siteSubtitle)
    };
    const fmHero = homepageDoc?.fm && typeof homepageDoc.fm.hero === 'object' ? homepageDoc.fm.hero : null;
    if (fmHero) {
      if (typeof fmHero.title === 'string' && fmHero.title.trim()) base.title = fmHero.title.trim();
      if (typeof fmHero.lede === 'string' && fmHero.lede.trim()) base.lede = fmHero.lede.trim();
      if (typeof fmHero.kicker === 'string' && fmHero.kicker.trim()) base.kicker = fmHero.kicker.trim();
    }
    if (!base.lede) base.lede = siteDescription || '';
    if (!base.kicker) base.kicker = siteSubtitle || '';
    if (worksIncludeOnHome && worksHighlights.length) {
      base.works = worksHighlights.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary
      }));
    }
    return base;
  })();

  const homepageSections = (() => {
    const sections = [];
    const fmSections = Array.isArray(homepageDoc?.fm?.sections) ? homepageDoc.fm.sections : [];
    const normalizeItems = (items) => {
      if (!Array.isArray(items)) return [];
      return items
        .map((entry) => {
          if (typeof entry === 'string') {
            const label = entry.trim();
            if (!label) return null;
            return { title: label, href: '', snippet: '', docId: '' };
          }
          if (!entry || typeof entry !== 'object') return null;
          const title = ensureString(entry.title, ensureString(entry.label));
          const href = ensureString(entry.href, ensureString(entry.url));
          const snippet = ensureString(entry.snippet, ensureString(entry.summary));
          const docId = ensureString(entry.docId, ensureString(entry.id));
          if (!title && !href && !snippet && !docId) return null;
          return { title, href, snippet, docId };
        })
        .filter(Boolean);
    };

    const pickMarkdown = (section) => {
      const candidates = [section.markdown, section.body, section.content, section.md];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate;
        }
      }
      return '';
    };

    fmSections.forEach((section, idx) => {
      if (!section || typeof section !== 'object') return;
      const title = ensureString(section.title);
      const kicker = ensureString(section.kicker);
      const lede = ensureString(section.lede, ensureString(section.summary));
      const idSource = ensureString(section.id, ensureString(section.slug, title || `section-${idx + 1}`));
      const id = slugify(idSource || `section-${idx + 1}`) || `section-${idx + 1}`;
      let html = '';
      if (typeof section.html === 'string' && section.html.trim()) {
        html = section.html;
      } else {
        const md = pickMarkdown(section);
        if (md) {
          html = renderMarkdown(md).html;
        }
      }
      const items = normalizeItems(section.items);
      sections.push({ id, title, kicker, lede, html, items });
    });

    if (sections.length) return sections;

    return nav.map((group) => ({
      id: group.id,
      title: group.label,
      kicker: '',
      lede: '',
      html: '',
      items: group.items.map((item) => ({
        title: item.label,
        href: item.href,
        snippet: item.snippet || '',
        docId: item.docId || ''
      }))
    }));
  })();

  return {
    data: {
      site: { title: siteTitle, subtitle: siteSubtitle, description: siteDescription, accent: siteAccent },
      nav,
      search: searchIndex,
      searchConfig: {
        enabled: effectiveSearchEngine !== 'none',
        requestedEngine,
        engine: effectiveSearchEngine,
        fields: searchFields,
        thresholds: { docs: AUTO_DOC_THRESHOLD, bytes: AUTO_BYTES_THRESHOLD },
        stats: { docCount: docCountForSearch, bytes: aggregateSearchBytes }
      },
      docs,
      homepage: homepageDoc ? homepageDoc.id : '',
      homepageMissing: !homepageDoc,
      hero: heroData,
      sections: homepageSections,
      works: {
        includeInNav: worksIncludeInNav,
        includeOnHome: worksIncludeOnHome,
        linkMode: worksLinkMode,
        docId: worksDoc ? worksDoc.id : '',
        highlights: worksHighlights
      }
    },
    warnings
  };
}

function sectionLabelFromSegment(segment) {
  if (!segment) return 'General';
  return segment
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* ------------------ CLI setup ------------------ */
const pkgJson = (() => {
  try {
    const p = path.resolve(__dirname, '../../package.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { name: 'praetorius', version: '0.0.0' };
  }
})();

const program = new Command();
program
  .name('praetorius')
  .alias('prae')
  .description('Praetorius — portfolio-first SPA generator. Works list drives UI.')
  .version(pkgJson.version || '0.0.0');

// Non-blocking update hint (industry standard)
try {
  updateNotifier({
    pkg: { name: pkgJson.name || 'praetorius', version: pkgJson.version || '0.0.0' }
  }).notify();
} catch {}

// Rich, example-driven help footer
program.addHelpText('after', `
Praetorius — portfolio-first SPA generator. Render your PRAE.works list, pick a skin, ship.
All skins render your PRAE.works list. No mock data; no jobs/queues.

Supported skins:
  • vite-breeze — Liquid Glass portfolio shell (split layout + PDF pane).
  • docs-reader (alias: docs) — spacious docs UI (left nav, right outline, copy-on-code).
  • cards-tabs (alias: dashboard) — portfolio dashboard (cards + tabs from your works list).
  • kiosk (alias: presentation) — touch-first tiles for demos/galleries (oversized controls).
  • typefolio (alias: typography) — web-book reader: light header/footer, two-page spread, Caslon-style typography; portfolio actions intact.
  • typescatter (alias: posterboard) — type-only poster wall with draggable tiles; scatter → editorial grid toggle.
Theme: light/dark via the built-in #wc-theme-toggle.
UI runtime:
  • --ui-runtime vanilla (default)
  • --ui-runtime react (vite-breeze, cards-tabs, kiosk, docs-reader; unsupported skins auto-fallback)
  • --embed always uses vanilla fallback for CMS-friendly snippets.

Narrative fields:
  • oneliner — optional single-line (~160 char) summary for tiles/lists. Markdown is stripped; newlines collapse.
  • description — optional Markdown body for detail views (paragraphs, headings, links allowed).
  • cover — optional image URL used by visual skins.
  • tags — optional string[] labels used by visual skins.
    Legacy projects without an oneliner keep working: compact views auto-derive from description/title.

Validation:
  • prae validate — schema check + narrative warnings (long/newline oneliners; collapse notice).

Examples:
  # Generate with default skin
  $ prae generate

  # Generate with a specific skin
  $ prae generate --skin vite-breeze
  $ prae generate --skin docs-reader
  $ prae generate --skin cards-tabs
  $ prae generate --skin kiosk
  $ prae generate --skin typefolio
  $ prae generate --skin typescatter
  $ prae generate --skin vite-breeze --ui-runtime react

  # Deep link the second spread of work ID 7:
  # (0-based pageIndex if you used p)
  …/#work=7&p=1

  # Tip: deep-link a work or tab in supported skins by URL hash
  # (actual hash keys depend on the skin; see README)

Quick start:
  $ prae init -o prae-out
  $ prae add
  $ prae generate -o dist --minify
  $ prae preview --no-open --port 5173

Import / Export:
  # JSON / CSV / YAML (csv/yaml loaders are lazy)
  $ prae import works.csv --assume-new-id --assume-new-slug
  $ prae export --format=csv > works.csv

Score / Page-Follow:
  $ prae score add 3
  $ prae score list 3
  $ prae score validate 3

Squarespace single-embed:
  $ prae generate --embed -o paste
  # Paste paste/embed.html into a Code block.

UI bundle (template.html + main.js + style.css → dist/):
  $ prae generate --ui-src ui --html template.html --app-js app.js --app-css app.css

Troubleshooting:
  • CSV imports need "csv-parse"   → npm i csv-parse
  • YAML imports need "yaml"       → npm i yaml
  • Minification needs "esbuild"   → npm i esbuild
  • URL checks (doctor): add src/cli/doctor.js exporting "doctor(argv)", or run with --offline

Testing internals (without running the CLI):
  $ PRAE_TEST_EXPORTS=1 node -e "import('./src/cli/index.js'); console.log(!!globalThis.__PRAE_TEST__)"
`);

const skinCmd = program.command('skin').description('Skin utilities');
skinCmd
  .command('list')
  .description('List built-in UI skins and aliases')
  .action(() => {
    console.log(pc.bold('Built-in skins (all render PRAE.works):'));
    builtinSkinList().forEach(entry => console.log('  - ' + entry));
    console.log(pc.gray('Skins never fabricate projects; everything derives from PRAE.works.'));
    console.log(pc.gray('Theme: light/dark via #wc-theme-toggle (no WAAPI).'));
  });

/* ------------------ preview (tiny static server) ------------------ */
function contentTypeFor(p) {
  const ext = path.extname(p).toLowerCase();
  return ({
    '.html':'text/html; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.map':'application/json; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.webp':'image/webp',
    '.mp3':'audio/mpeg',
    '.m4a':'audio/mp4',
    '.wav':'audio/wav',
    '.pdf':'application/pdf',
    '.woff2':'font/woff2',
    '.woff':'font/woff',
    '.ttf':'font/ttf'
  })[ext] || 'application/octet-stream';
}

// tiny helper (file check only)
 function isFile(p) {
   try { return fs.existsSync(p) && fs.statSync(p).isFile(); }
   catch { return false; }
 }

function previewHarnessHTML(theme = 'dark') {
  // Loads the canonical filenames per Sprint 3 acceptance
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8"/>',
    '  <meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '  <title>Praetorius Preview</title>',
    '  <link rel="stylesheet" href="/styles.css"/>',
    '  <style>body{margin:0;padding:1rem;background:var(--bg, #111);color:var(--fg,#fff)}</style>',
    '</head>',
    `<body class="prae-theme-${theme}" data-prae-banner>`,
    '  <section id="works-console"></section>',
    '  <script src="/script.js" defer></script>',
    // Ensure host/body have the right theme and render using the minimal list UI.
    `  <script>(function(){var h=document.querySelector('#works-console')||document.body;h.classList.remove('prae-theme-light','prae-theme-dark');h.classList.add('prae-theme-${theme}');})();</script>`,
    `  <script>${EMBED_RENDER}</script>`,
    '</body>',
    '</html>'
  ].join('\n');
}
function startStaticServer({ root, port }) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    // "/" → serve dist/index.html if present; else tiny harness
    if (urlPath === '/' || urlPath === '/index.html') {
      const distIndex = path.join(root, 'index.html');
      if (existsFile(distIndex)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        fs.createReadStream(distIndex).pipe(res);
        return;
      }
      const theme = loadConfig().theme;
      const html  = previewHarnessHTML(theme);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    // Everything else → static file under dist/
    const fsPath = path.join(root, urlPath.replace(/^\/+/, ''));
    if (!fsPath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(fsPath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': contentTypeFor(fsPath), 'Cache-Control': 'no-store' });
      fs.createReadStream(fsPath).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

program
  .command('preview')
  .description('Serve a local preview (no Express): serves dist/ + HTML harness')
  .option('-p, --port <port>', 'port to listen on', (v)=>Number(v), 5173)
  .option('--no-open', 'do not open the browser automatically')
  .action(async function (opts) {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distDir)) {
      console.log(pc.red('Missing dist/. Run ') + pc.cyan('prae generate') + pc.red(' first.'));
      process.exit(1);
    }
    const port = Number(opts.port) || 5173;
    let server;
    try {
      server = await startStaticServer({ root: distDir + path.sep, port });
    } catch (e) {
      if (e && e.code === 'EADDRINUSE') {
        console.log(pc.red(`Port ${port} in use. Try: `) + pc.cyan(`prae preview --port ${port+1}`));
        process.exit(1);
      }
      throw e;
    }
    const url = `http://localhost:${port}/`;
    console.log(pc.green('preview  ') + pc.dim(url));
    console.log(pc.gray('serving: ') + pc.cyan(path.relative(process.cwd(), distDir) || '.'));
     if (opts.open !== false) {
      const open = await lazyOpen();
      try { await open(url); } catch {}
    }
    // Keep process alive
    await new Promise(()=>{});
    server.close();
  });

/* ------------------ init ------------------ */
program
  .command('init')
  .description('Create starter script + css; seed .prae/works.json + .prae/config.json if missing')
  .option('-o, --out <dir>', 'output directory', 'prae-out')
  .option('--dry-run', 'print actions without writing files', false)
  .option('-f, --force', 'overwrite if files exist', false)
    .option('--wizard', 'run site wizard after seeding', false)
  .action(async function (opts) {
    const command = this;
    const outDir = path.resolve(process.cwd(), opts.out);
    const dry    = !!opts['dryRun'];
    const force  = !!opts.force;

    console.log(pc.bold('Praetorius init'));
    console.log(pc.gray('Target: ')+pc.cyan(cwdRel(outDir)));
    console.log(pc.gray('Mode:  ')+pc.cyan(dry ? 'dry-run' : 'write'));
    console.log(pc.gray('Force: ')+pc.cyan(force ? 'on' : 'off'));
    console.log('');

    const files = [
      { name: 'script.js',  contents: STARTER_JS },
      { name: 'styles.css', contents: STARTER_CSS },
      { name: 'README.txt', contents: STARTER_README },
    ];

    if (!dry) fs.mkdirSync(outDir, { recursive: true });

    for (const f of files) {
      const p = path.join(outDir, f.name);
      if (dry) { console.log(pc.yellow('plan  ') + pc.dim(cwdRel(p))); continue; }
      if (fs.existsSync(p) && !force) {
        console.log(pc.yellow('skip  ') + pc.dim(cwdRel(p)) + pc.gray(' (exists; use --force)'));
        continue;
      }
      fs.writeFileSync(p, f.contents, 'utf8');
      console.log(pc.green('write ') + pc.dim(cwdRel(p)));
    }

    // Seed DB if missing
    const dbExists = fs.existsSync(DB_PATH);
    if (!dry && !dbExists) {
      saveDb({ version: 1, works: [] });
      console.log(pc.green('write ') + pc.dim(cwdRel(DB_PATH)));
    }
    if (!dry && !fs.existsSync(CONFIG_PATH)) {
      saveConfig(DEFAULT_CONFIG);
      console.log(pc.green('write ') + pc.dim(cwdRel(CONFIG_PATH)));
    }
    // optionally run the site wizard
    if (opts.wizard) {
      // re-use the site command’s action
      await program.parseAsync(['node','prae','site']);
    }

    console.log('\n' + pc.bold('Next steps:'));
    console.log('  • Add works: ' + pc.cyan('praetorius add'));
    console.log('  • Generate:  ' + pc.cyan('praetorius generate'));
    console.log('  • Read:      ' + pc.cyan('README.md → Skins, Theming & Tokens, PDF + HUD, Accessibility'));
    console.log('');
  });

// site command
program
  .command('site')
  .alias('config')
  .description('Wizard to edit site chrome (name, labels, subtitle, links, updated date)')
  .action(async () => {
    const cfg = loadConfig();
    const s0  = cfg.site || DEFAULT_CONFIG.site;
    const b0 = normalizeBranding(cfg.ui?.branding || {}, { strict: false });

    const base = await prompt([
      { type:'input', name:'firstName', message:'First name', initial: s0.firstName },
      { type:'input', name:'lastName',  message:'Last name',  initial: s0.lastName },
      { type:'input', name:'fullName',  message:'Full name (leave blank to use First + Last)', initial: s0.fullName || '' },
      { type:'select', name:'listLabel', message:'List name', choices:[
          {name:'Works List'},{name:'Portfolio'},{name:'Projects'},{name:'Works'},{name:'Custom…'}
        ], initial: s0.listLabel && ['Works List','Portfolio','Projects','Works'].includes(s0.listLabel) ? s0.listLabel : 'Custom…' },
    ]);

    let listLabel = base.listLabel;
    if (listLabel === 'Custom…') {
      const c = await prompt([{ type:'input', name:'label', message:'Custom list name', initial: s0.listLabel || 'Works List' }]);
      listLabel = c.label || 'Works List';
    }

    const sub = await prompt([
      { type:'input', name:'subtitle', message:'Subtitle (optional)', initial: s0.subtitle || '' },
      { type:'select', name:'updatedMode', message:'Updated date', choices:[{name:'auto'},{name:'manual'}],
        initial: (s0.updated?.mode === 'manual') ? 'manual' : 'auto' }
    ]);

    let updated = { mode: sub.updatedMode, value: '' };
    if (sub.updatedMode === 'manual') {
      const d = await prompt([{ type:'input', name:'value', message:'Updated string (e.g., "Nov 7")', initial: s0.updated?.value || '' }]);
      updated.value = d.value || '';
    }

    const attributionPrompt = await prompt({
      type: 'confirm',
      name: 'enabled',
      message: 'Show Powered by Praetorius attribution?',
      initial: b0.attribution.enabled !== false
    });

    // Links
    const links = [];
    let more = true;
    // Seed from existing if present
    (Array.isArray(s0.links) ? s0.links : []).forEach(l => links.push({ ...l }));
    if (!links.length) links.push({ label:'Home', href:'#', external:false });

    while (more) {
      const i = links.length - 1;
      const cur = links[i] || { label:'', href:'', external:false };
      const ans = await prompt([
        { type:'input',  name:'label',    message:`Link ${i+1} label`, initial: cur.label },
        { type:'input',  name:'href',     message:`Link ${i+1} URL`,   initial: cur.href },
        { type:'confirm',name:'external', message:`Open in new tab?`,  initial: !!cur.external }
      ]);
      links[i] = { label: ans.label, href: ans.href, external: !!ans.external };
      const cont = await prompt({ type:'confirm', name:'ok', message:'Add another link?', initial:false });
      more = cont.ok;
      if (more) links.push({ label:'', href:'', external:false });
    }

    // Save
    const next = {
      ...cfg,
      ui: {
        ...(cfg.ui || {}),
        branding: {
          attribution: { enabled: attributionPrompt.enabled !== false }
        }
      },
      site: {
        ...s0,
        firstName: base.firstName.trim(),
        lastName:  base.lastName.trim(),
        fullName:  (base.fullName || '').trim(),
        listLabel,
        subtitle:  (sub.subtitle || '').trim(),
        updated,
        links
      }
    };
    saveConfig(next);
    console.log(pc.green('site saved ') + pc.dim(cwdRel(CONFIG_PATH)));
  });

async function runDocsWizard(opts = {}, meta = {}) {
  const { autoTriggered = false } = (meta || {});
  const parseList = (input) => {
    if (!input) return [];
    return String(input)
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const abort = (reason) => { const err = new Error('abort'); if (reason) err.reason = reason; throw err; };

  const nonInteractive = !!opts.yes;
  const docsConfig = loadDocsConfig();
  const siteConfig = loadConfig();
  let docsRoot = ensureDocsRoot(opts.docsRoot || docsConfig.paths.root || 'docs/');
  let detection = detectDocsEnvironment({ docsRoot });
  const forcedHome = String(opts.docsHome || '').trim();

  if (autoTriggered) {
    console.log(pc.yellow('Docs Reader skin selected but no docs configuration found.'));
    console.log(pc.gray('Launching Docs Reader wizard…'));
  }

  console.log(pc.bold('Docs Reader wizard'));
  console.log(
    pc.gray('Docs root: ') +
    pc.cyan(docsRoot) +
    pc.gray(detection.docsExists ? ' (found)' : ' (will create)')
  );
  console.log(
    pc.gray(
      `Markdown detected → ${detection.docsFiles.length} in ${docsRoot}, ` +
      `README sections: ${detection.readme.sections.length}, extra markdown: ${detection.otherMarkdown.length}`
    )
  );
  if (detection.assetDirs.length) {
    console.log(pc.gray('Assets folders: ') + pc.cyan(detection.assetDirs.join(', ')));
  }
  if (detection.works.count) {
    const sample = detection.works.titles.join(', ');
    console.log(pc.gray(`Works data found (${detection.works.count})`) + (sample ? pc.gray(` — e.g., ${sample}`) : ''));
  }

  const ensureStarterIfEmpty = async () => {
    const nothingFound =
      !detection.docsFiles.length &&
      !detection.readme.sections.length &&
      !detection.otherMarkdown.length;
    if (!nothingFound) return [];
    if (nonInteractive) {
      console.log(pc.yellow('No markdown sources found. Scaffolding starter docs…'));
      const created = scaffoldDocsSkeleton(detection.docsDir);
      created.forEach((file) => console.log(pc.green('create ') + pc.dim(cwdRel(file))));
      detection = detectDocsEnvironment({ docsRoot });
      return created;
    }
    const ans = await prompt({
      type: 'confirm',
      name: 'scaffold',
      message: 'No docs found. Scaffold a starter docs set?',
      initial: true
    });
    if (ans.scaffold) {
      const created = scaffoldDocsSkeleton(detection.docsDir);
      created.forEach((file) => console.log(pc.green('create ') + pc.dim(cwdRel(file))));
      detection = detectDocsEnvironment({ docsRoot });
      return created;
    }
    console.log(pc.red('Docs wizard cancelled — supply markdown sources or allow scaffolding.'));
    abort('no-sources');
  };

  let createdFiles = [];
  createdFiles = await ensureStarterIfEmpty();

  const fallbackTitle =
    docsConfig.site.title ||
    siteConfig.site.fullName ||
    [siteConfig.site.firstName, siteConfig.site.lastName].filter(Boolean).join(' ') ||
    path.basename(process.cwd());
  const identityDefaults = {
    title: docsConfig.site.title || fallbackTitle,
    subtitle: docsConfig.site.subtitle || siteConfig.site.subtitle || '',
    description:
      docsConfig.site.description ||
      (siteConfig.site.subtitle ? siteConfig.site.subtitle : `Documentation hub for ${fallbackTitle}`),
    accent: docsConfig.site.accent || ''
  };

  const identityAnswers = nonInteractive
    ? identityDefaults
    : await prompt([
        { type: 'input', name: 'title', message: 'Site title?', initial: identityDefaults.title },
        { type: 'input', name: 'subtitle', message: 'Subtitle (optional)', initial: identityDefaults.subtitle },
        {
          type: 'input',
          name: 'description',
          message: 'Short description (≈140 chars)?',
          initial: identityDefaults.description,
          validate: (v) => (String(v).length <= 200 ? true : 'Keep under 200 characters')
        },
        { type: 'input', name: 'accent', message: 'Accent color (hex or CSS var, optional)', initial: identityDefaults.accent }
      ]);

  const forcedGlobs = parseList(opts.docsScan);
  let includeReadme = docsConfig.sources.includeReadme && detection.readme.sections.length > 0;
  let globs = forcedGlobs.length ? forcedGlobs.slice() : [...docsConfig.sources.globs];

  const chooseSourcesInteractively = async () => {
    const choices = [
      {
        name: `Scan ${docsRoot}**/*.md (${detection.docsFiles.length} file${detection.docsFiles.length === 1 ? '' : 's'})`,
        value: 'scan-docs',
        disabled: detection.docsFiles.length === 0,
        initial: detection.docsFiles.length > 0 && (!globs.length || globs.some((g) => g.includes(docsRoot)))
      },
      {
        name: `Import top-level sections from README.md (${detection.readme.sections.length})`,
        value: 'readme',
        disabled: detection.readme.sections.length === 0,
        initial: includeReadme
      }
    ];
    if (detection.otherMarkdown.length) {
      choices.push({
        name: `Pick extra markdown (found ${detection.otherMarkdown.length})`,
        value: 'other',
        initial: false
      });
    }
    choices.push({ name: 'Add another folder or glob…', value: 'extra' });
    choices.push({ name: 'Create starter pages (Getting Started, Concepts, Tutorials, API, FAQ, Changelog)', value: 'starter' });

    const answer = await prompt({
      type: 'multiselect',
      name: 'sources',
      message: 'Pick content sources',
      choices,
      hint: 'Space to toggle · Enter to accept'
    });

    const picks = new Set(answer.sources || []);
    const resultGlobs = [];
    if (picks.has('scan-docs')) {
      resultGlobs.push(`${docsRoot}**/*.md`);
    }
    if (picks.has('readme')) includeReadme = detection.readme.sections.length > 0;
    else includeReadme = false;

    if (picks.has('other') && detection.otherMarkdown.length) {
      const otherChoices = detection.otherMarkdown.map((file) => ({
        name: file.rel,
        value: file.rel
      }));
      const otherAns = await prompt({
        type: 'multiselect',
        name: 'extra',
        message: 'Select extra markdown files to include',
        choices: otherChoices
      });
      (otherAns.extra || []).forEach((rel) => resultGlobs.push(rel));
    }

    if (picks.has('extra')) {
      let more = true;
      while (more) {
        const { pattern } = await prompt({
          type: 'input',
          name: 'pattern',
          message: 'Glob or path to include (leave blank to stop)',
          initial: ''
        });
        if (!pattern || !pattern.trim()) break;
        resultGlobs.push(pattern.trim());
        const again = await prompt({
          type: 'confirm',
          name: 'again',
          message: 'Add another glob?',
          initial: false
        });
        more = again.again;
      }
    }

    if (picks.has('starter')) {
      const created = scaffoldDocsSkeleton(detection.docsDir);
      if (created.length) {
        created.forEach((file) => console.log(pc.green('create ') + pc.dim(cwdRel(file))));
        createdFiles.push(...created);
        detection = detectDocsEnvironment({ docsRoot });
        // ensure docs glob covers new files
        if (!resultGlobs.length) resultGlobs.push(`${docsRoot}**/*.md`);
      }
    }

    return resultGlobs;
  };

  if (!forcedGlobs.length) {
    if (!nonInteractive) {
      const selectedGlobs = await chooseSourcesInteractively();
      if (selectedGlobs.length) globs = selectedGlobs;
    } else {
      if (!globs.length && detection.docsFiles.length) {
        globs = [`${docsRoot}**/*.md`];
      }
      if (includeReadme && !detection.readme.sections.length) includeReadme = false;
    }
  }

  if (!globs.length && detection.docsFiles.length) {
    globs = [`${docsRoot}**/*.md`];
  }
  globs = Array.from(new Set(globs.filter(Boolean)));

  const usedSectionIds = new Set();
  const usedPageSlugs = new Set();

  const uniqueId = (base, prefix) => {
    const safeBase = slugify(base || '') || `${prefix}-${usedSectionIds.size + 1}`;
    let candidate = safeBase;
    let n = 2;
    while (usedSectionIds.has(candidate)) {
      candidate = `${safeBase}-${n++}`;
    }
    usedSectionIds.add(candidate);
    return candidate;
  };

  const uniqueSlug = (base, fallback) => {
    const safeBase = slugify(base || '') || slugify(fallback || '') || 'page';
    let candidate = safeBase;
    let n = 2;
    while (usedPageSlugs.has(candidate)) {
      candidate = `${safeBase}-${n++}`;
    }
    usedPageSlugs.add(candidate);
    return candidate;
  };

  const buildSections = () => {
    const map = new Map();
    const sections = [];
    const ensureSection = (label) => {
      const key = label || 'General';
      if (map.has(key)) return map.get(key);
      const section = {
        id: uniqueId(key, 'section'),
        title: label || 'General',
        order: sections.length,
        hidden: false,
        pages: []
      };
      map.set(key, section);
      sections.push(section);
      return section;
    };

    const considerFile = (info, opts = {}) => {
      const patterns = globs.length ? globs : [`${docsRoot}**/*.md`];
      const relPath = opts.relOverride || info.rel;
      const candidates = [relPath];
      if (info.relWithin) candidates.push(info.relWithin);
      const matches = patterns.some((pattern) => candidates.some((candidate) => matchesGlob(pattern, candidate)));
      if (!matches) return;
      const sectionLabel = sectionLabelFromSegment(opts.sectionSegment || info.section || (relPath.includes('/') ? relPath.split('/')[0] : ''));
      const section = ensureSection(sectionLabel);
      const slug = uniqueSlug(info.title || path.basename(relPath, path.extname(relPath)), relPath);
      section.pages.push({
        source: relPath,
        title: info.title || path.basename(relPath),
        slug,
        summary: info.snippet || '',
        tags: [],
        hidden: false
      });
    };

    detection.docsFiles.forEach((file) => considerFile(file, { relOverride: file.rel, sectionSegment: file.relWithin ? file.relWithin.split('/')[0] : file.section }));
    detection.otherMarkdown.forEach((file) => considerFile(file));

    if (includeReadme && detection.readme.sections.length) {
      const section = ensureSection('README Highlights');
      detection.readme.sections.forEach((item) => {
        const slug = uniqueSlug(item.title, item.slug);
        section.pages.push({
          source: `README.md#${item.slug}`,
          title: item.title,
          slug,
          summary: item.snippet || '',
          tags: [],
          hidden: false
        });
      });
    }

    sections.forEach((section, idx) => {
      section.order = idx;
    });

    return sections;
  };

  let sections = buildSections();

  const existingById = new Map((docsConfig.ia || []).map((section) => [section.id, section]));
  sections = sections.map((section) => {
    const prev = existingById.get(section.id);
    if (!prev) return section;
    section.title = prev.title || section.title;
    section.hidden = !!prev.hidden;
    section.order = Number.isFinite(prev.order) ? prev.order : section.order;
    const prevPages = new Map((prev.pages || []).map((page) => [page.source || page.slug, page]));
    section.pages = section.pages.map((page) => {
      const key = page.source || page.slug;
      const prevPage = prevPages.get(key) || prevPages.get(page.slug);
      if (!prevPage) return page;
      page.hidden = !!prevPage.hidden;
      page.summary = prevPage.summary || page.summary;
      page.tags = Array.isArray(prevPage.tags) ? prevPage.tags.slice() : page.tags;
      page.slug = prevPage.slug || page.slug;
      return page;
    });
    return section;
  });

  sections.sort((a, b) => a.order - b.order);
  sections.forEach((section, idx) => (section.order = idx));

  const refreshSlugSet = () => {
    usedPageSlugs.clear();
    sections.forEach((section) => section.pages.forEach((page) => usedPageSlugs.add(page.slug)));
  };
  refreshSlugSet();

  const previewSections = () => {
    console.log('');
    console.log(pc.bold('Information architecture preview')); 
    sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((section, idx) => {
        const status = section.hidden ? pc.dim(' (hidden)') : '';
        console.log(`  ${idx + 1}. ${section.title}${status}`);
        section.pages.forEach((page) => {
          const pst = page.hidden ? pc.dim(' (hidden)') : '';
          console.log(pc.gray(`       • ${page.title} ${pst} → ${page.source}`));
        });
      });
    console.log('');
  };

  const selectSection = async (message) => {
    if (!sections.length) return null;
    const sorted = sections.slice().sort((a, b) => a.order - b.order);
    const ans = await prompt({
      type: 'select',
      name: 'section',
      message,
      choices: sorted.map((section) => ({
        name: section.id,
        message: `${section.title}${section.hidden ? ' (hidden)' : ''}`
      }))
    });
    return sections.find((section) => section.id === ans.section) || null;
  };

  const selectPage = async (message) => {
    const choices = [];
    sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((section) => {
        section.pages.forEach((page) => {
          choices.push({
            name: `${section.id}::${page.slug}`,
            message: `${section.title} → ${page.title}${page.hidden ? ' (hidden)' : ''}`
          });
        });
      });
    if (!choices.length) return null;
    const ans = await prompt({ type: 'select', name: 'page', message, choices });
    const [sectionId, slug] = String(ans.page || '').split('::');
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return null;
    const page = section.pages.find((p) => p.slug === slug);
    return { section, page };
  };

  if (!nonInteractive) {
    let editing = true;
    while (editing) {
      previewSections();
      const ans = await prompt({
        type: 'select',
        name: 'action',
        message: 'IA adjustments?',
        choices: [
          { name: 'continue', message: 'Continue' },
          { name: 'reorder', message: 'Reorder sections', disabled: sections.length < 2 },
          { name: 'rename', message: 'Rename section', disabled: !sections.length },
          { name: 'toggle', message: 'Hide/show section', disabled: !sections.length },
          { name: 'create', message: 'Create new section' },
          { name: 'page-rename', message: 'Rename page', disabled: !sections.some((s) => s.pages.length) },
          { name: 'page-toggle', message: 'Hide/show page', disabled: !sections.some((s) => s.pages.length) }
        ]
      });

      if (ans.action === 'continue') {
        editing = false;
        break;
      }

      if (ans.action === 'reorder') {
        const section = await selectSection('Reorder which section?');
        if (section) {
          const sorted = sections.slice().sort((a, b) => a.order - b.order);
          const currentIdx = sorted.findIndex((s) => s.id === section.id);
          const moveAns = await prompt({
            type: 'input',
            name: 'idx',
            message: `Move “${section.title}” to position (1-${sorted.length})`,
            initial: currentIdx + 1,
            validate: (v) => {
              const num = Number(v);
              return num >= 1 && num <= sorted.length ? true : `Enter 1-${sorted.length}`;
            }
          });
          const targetIdx = Number(moveAns.idx) - 1;
          const reordered = moveInArray(sorted, currentIdx, targetIdx);
          reordered.forEach((sec, idx) => (sec.order = idx));
          sections = reordered;
        }
      } else if (ans.action === 'rename') {
        const section = await selectSection('Rename which section?');
        if (section) {
          const nameAns = await prompt({
            type: 'input',
            name: 'title',
            message: 'New section title',
            initial: section.title,
            validate: (v) => (v && v.trim().length ? true : 'Required')
          });
          section.title = nameAns.title.trim();
        }
      } else if (ans.action === 'toggle') {
        const section = await selectSection('Toggle which section?');
        if (section) section.hidden = !section.hidden;
      } else if (ans.action === 'create') {
        const newAns = await prompt([
          { type: 'input', name: 'title', message: 'New section title', validate: (v) => (v && v.trim().length ? true : 'Required') }
        ]);
        const newSection = {
          id: uniqueId(newAns.title, 'section'),
          title: newAns.title.trim(),
          order: sections.length,
          hidden: false,
          pages: []
        };
        sections.push(newSection);
      } else if (ans.action === 'page-rename') {
        const pick = await selectPage('Rename which page?');
        if (pick && pick.page) {
          const renameAns = await prompt({
            type: 'input',
            name: 'title',
            message: 'New page title',
            initial: pick.page.title,
            validate: (v) => (v && v.trim().length ? true : 'Required')
          });
          usedPageSlugs.delete(pick.page.slug);
          pick.page.title = renameAns.title.trim();
          pick.page.slug = uniqueSlug(pick.page.title, pick.page.slug);
          refreshSlugSet();
        }
      } else if (ans.action === 'page-toggle') {
        const pick = await selectPage('Toggle which page?');
        if (pick && pick.page) pick.page.hidden = !pick.page.hidden;
      }
    }
  }

  sections.sort((a, b) => a.order - b.order);
  sections.forEach((section, idx) => (section.order = idx));

  const homepageChoice = async () => {
    const pageChoices = [];
    if (detection.readme.exists) {
      pageChoices.push({ name: 'README.md', message: 'Use README.md as homepage' });
    }
    sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((section) => {
        section.pages.forEach((page) => {
          pageChoices.push({
            name: page.source,
            message: `${section.title} → ${page.title}`
          });
        });
      });
    pageChoices.push({ name: '__new__', message: 'Generate a new intro page…' });

    if (!pageChoices.length) return '';

    const ans = await prompt({ type: 'select', name: 'home', message: 'Choose homepage source', choices: pageChoices });
    return ans.home;
  };

  let homepage = docsConfig.paths.homepage || '';
  let homepageSource = forcedHome;
  if (!homepageSource) {
    if (nonInteractive) {
      homepageSource = homepage || (detection.readme.exists ? 'README.md' : (sections[0]?.pages[0]?.source || ''));
    } else {
      homepageSource = await homepageChoice();
    }
  }

  if (homepageSource === '__new__') {
    const introAnswers = nonInteractive
      ? { section: 'Welcome', title: 'Introduction', filename: 'index.md' }
      : await prompt([
          { type: 'input', name: 'section', message: 'Section name for homepage', initial: 'Welcome' },
          { type: 'input', name: 'title', message: 'Homepage title', initial: 'Introduction', validate: (v) => (v && v.trim().length ? true : 'Required') },
          { type: 'input', name: 'filename', message: 'Markdown filename (relative to docs root)', initial: 'index.md', validate: (v) => (v && v.trim().endsWith('.md') ? true : 'Use a .md filename') }
        ]);
    const filename = introAnswers.filename.trim().split('\\').join('/');
    const abs = path.join(detection.docsDir, filename);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) {
      fs.writeFileSync(abs, `# ${introAnswers.title.trim()}\n\nWelcome to your Docs Reader homepage.\n`, 'utf8');
      createdFiles.push(abs);
      console.log(pc.green('create ') + pc.dim(cwdRel(abs)));
    }
    const sectionTitle = introAnswers.section.trim() || 'Welcome';
    const section = {
      id: uniqueId(sectionTitle, 'section'),
      title: sectionTitle,
      order: 0,
      hidden: false,
      pages: [
        {
          source: toPosix(path.join(docsRoot.replace(/\/$/, ''), filename)),
          title: introAnswers.title.trim(),
          slug: uniqueSlug(introAnswers.title.trim(), filename),
          summary: 'Auto-generated homepage placeholder.',
          tags: [],
          hidden: false
        }
      ]
    };
    sections.unshift(section);
    sections.forEach((sec, idx) => (sec.order = idx));
    homepageSource = section.pages[0].source;
    refreshSlugSet();
  }

  homepage = homepageSource;

  const frontDefaults = {
    addIfMissing: docsConfig.frontMatter.addIfMissing,
    tocDepth: docsConfig.frontMatter.tocDepth,
    autoSummary: docsConfig.frontMatter.autoSummary
  };

  const frontAnswers = nonInteractive
    ? frontDefaults
    : await prompt([
        { type: 'confirm', name: 'addIfMissing', message: 'Add front matter when missing?', initial: frontDefaults.addIfMissing },
        { type: 'confirm', name: 'autoSummary', message: 'Auto-generate summary from first paragraph?', initial: frontDefaults.autoSummary },
        {
          type: 'select',
          name: 'tocDepth',
          message: 'Default table-of-contents depth',
          choices: [{ name: '2' }, { name: '3' }, { name: '4' }],
          initial: String(frontDefaults.tocDepth ?? 2)
        }
      ]);

  const forcedTabs = String(opts.docsTabs || '').toLowerCase();
  let codeTabs = { ...docsConfig.codeTabs };
  if (forcedTabs) {
    if (forcedTabs === 'off') codeTabs = { enabled: false, strategy: 'fence', order: docsConfig.codeTabs.order };
    else if (forcedTabs === 'snippets') codeTabs = { enabled: true, strategy: 'snippets', order: docsConfig.codeTabs.order };
    else codeTabs = { enabled: true, strategy: 'fence', order: docsConfig.codeTabs.order };
  } else if (!nonInteractive) {
    const tabAns = await prompt({ type: 'confirm', name: 'enabled', message: 'Enable language tabs for code fences?', initial: codeTabs.enabled });
    codeTabs.enabled = tabAns.enabled;
    if (codeTabs.enabled) {
      const strategyAns = await prompt({
        type: 'select',
        name: 'strategy',
        message: 'Group tabs by…',
        choices: [
          { name: 'fence', message: 'Fence info string (```ts group=install)' },
          { name: 'snippets', message: 'Snippets folder mapping' }
        ],
        initial: codeTabs.strategy === 'snippets' ? 'snippets' : 'fence'
      });
      codeTabs.strategy = strategyAns.strategy;
      const orderAns = await prompt({
        type: 'input',
        name: 'order',
        message: 'Default language order (comma-separated, e.g., js,ts,bash,python)',
        initial: (codeTabs.order || []).join(',') || 'js,ts,bash'
      });
      const parsedOrder = parseList(orderAns.order);
      if (parsedOrder.length) codeTabs.order = parsedOrder;
    } else {
      codeTabs.strategy = 'fence';
    }
  }

  const forcedSearch = String(opts.docsSearch || '').toLowerCase();
  const forcedFields = parseList(opts.docsFields);
  let search = { ...docsConfig.search };
  if (forcedSearch) {
    if (forcedSearch === 'none') search = { ...search, enabled: false, engine: 'none' };
    else if (forcedSearch === 'auto') search = { ...search, enabled: true, engine: 'auto' };
    else search = { ...search, enabled: true, engine: forcedSearch === 'fuse' ? 'fuse' : 'light' };
  }
  if (forcedFields.length) {
    search.fields = forcedFields;
  }

  if (!nonInteractive && !forcedSearch) {
    const searchAns = await prompt({ type: 'confirm', name: 'enabled', message: 'Enable search?', initial: search.enabled });
    search.enabled = searchAns.enabled;
    if (search.enabled) {
      const engineAns = await prompt({
        type: 'select',
        name: 'engine',
        message: 'Search indexer',
        choices: [
          { name: 'auto', message: 'Auto (light for small docs, fuzzy for larger sets)' },
          { name: 'light', message: 'Lightweight keywords' },
          { name: 'fuse', message: 'Fuzzy ranking (force on)' }
        ],
        initial: search.engine === 'fuse' ? 'fuse' : (search.engine === 'auto' ? 'auto' : 'light')
      });
      search.engine = engineAns.engine;
      const fieldAns = await prompt({
        type: 'multiselect',
        name: 'fields',
        message: 'Fields to index',
        choices: [
          { name: 'Title', value: 'title', initial: search.fields.includes('title') },
          { name: 'Headings', value: 'headings', initial: search.fields.includes('headings') },
          { name: 'Body', value: 'body', initial: search.fields.includes('body') },
          { name: 'Summary', value: 'summary', initial: search.fields.includes('summary') },
          { name: 'Tags', value: 'tags', initial: search.fields.includes('tags') }
        ]
      });
      search.fields = fieldAns.fields && fieldAns.fields.length ? fieldAns.fields : search.fields;
      const excludeChoices = sections.map((section) => ({
        name: section.title,
        value: section.id,
        initial: search.excludeSections?.includes(section.id)
      }));
      if (excludeChoices.length) {
        const excludeAns = await prompt({ type: 'multiselect', name: 'exclude', message: 'Exclude sections from search?', choices: excludeChoices });
        search.excludeSections = excludeAns.exclude || [];
      }
    } else {
      search.engine = 'none';
    }
  }

  const forcedAlt = String(opts.docsAltPolicy || '').toLowerCase();
  let assets = { ...docsConfig.assets };
  if (forcedAlt) {
    if (['require', 'warn', 'auto'].includes(forcedAlt)) assets.altPolicy = forcedAlt;
  }

  if (!nonInteractive) {
    const assetAns = await prompt({ type: 'confirm', name: 'optimize', message: 'Optimize images during generation?', initial: assets.optimize });
    assets.optimize = assetAns.optimize;
    if (assets.optimize) {
      const sizeAns = await prompt({
        type: 'multiselect',
        name: 'sizes',
        message: 'Image renditions',
        choices: [
          { name: '1x', value: '1x', initial: assets.sizes.includes('1x') },
          { name: '2x', value: '2x', initial: assets.sizes.includes('2x') },
          { name: 'webp', value: 'webp', initial: assets.sizes.includes('webp') }
        ]
      });
      assets.sizes = sizeAns.sizes && sizeAns.sizes.length ? sizeAns.sizes : assets.sizes;
    }
    const altAns = await prompt({
      type: 'select',
      name: 'policy',
      message: 'Alt text policy',
      choices: [
        { name: 'require', message: 'Require alt text (block missing)' },
        { name: 'warn', message: 'Warn when missing' },
        { name: 'auto', message: 'Auto from filename when missing' }
      ],
      initial: assets.altPolicy
    });
    assets.altPolicy = altAns.policy;
  } else if (forcedAlt) {
    assets.altPolicy = forcedAlt;
  }

  const worksModes = new Set(parseList(opts.docsWorks).map((v) => v.toLowerCase()));
  const worksConfig = { ...docsConfig.works };
  if (worksModes.has('skip')) {
    worksConfig.includeInNav = false;
    worksConfig.includeOnHome = false;
  }
  if (worksModes.has('nav')) worksConfig.includeInNav = true;
  if (worksModes.has('home')) worksConfig.includeOnHome = true;
  if (worksModes.has('internal')) worksConfig.linkMode = 'internal';
  if (worksModes.has('external')) worksConfig.linkMode = 'external';
  if (worksModes.has('auto')) worksConfig.linkMode = 'auto';

  if (!nonInteractive && !worksModes.size) {
    if (detection.works.count) {
      const worksAns = await prompt({ type: 'confirm', name: 'nav', message: 'Add Works section to left nav?', initial: worksConfig.includeInNav });
      worksConfig.includeInNav = worksAns.nav;
      const homeAns = await prompt({ type: 'confirm', name: 'home', message: 'Show Works highlights on homepage hero?', initial: worksConfig.includeOnHome });
      worksConfig.includeOnHome = homeAns.home;
      const modeAns = await prompt({
        type: 'select',
        name: 'mode',
        message: 'Works links should open…',
        choices: [
          { name: 'auto', message: 'Auto (prefer internal pages)' },
          { name: 'internal', message: 'Internal docs pages' },
          { name: 'external', message: 'External URLs' }
        ],
        initial: worksConfig.linkMode || 'auto'
      });
      worksConfig.linkMode = modeAns.mode;
    } else {
      const linkAns = await prompt({ type: 'confirm', name: 'link', message: 'Link an existing works JSON later?', initial: false });
      if (!linkAns.link) {
        worksConfig.includeInNav = false;
        worksConfig.includeOnHome = false;
      }
    }
  }

  if (worksConfig.includeInNav) {
    const existingWorksSection = sections.find((section) => section.id === 'works');
    if (!existingWorksSection) {
      sections.push({
        id: 'works',
        title: 'Works',
        order: sections.length,
        hidden: false,
        pages: [
          {
            source: 'works::auto',
            title: 'Works',
            slug: uniqueSlug('works', 'works'),
            summary: 'Auto-generated works listing.',
            tags: [],
            hidden: false
          }
        ]
      });
      refreshSlugSet();
    }
  } else {
    sections = sections.filter((section) => section.id !== 'works');
    refreshSlugSet();
  }

  sections.sort((a, b) => a.order - b.order);
  sections.forEach((section, idx) => (section.order = idx));

  const pathAnswer = nonInteractive
    ? { root: docsRoot }
    : await prompt({ type: 'input', name: 'root', message: 'Content root (relative path)', initial: docsRoot });

  docsRoot = ensureDocsRoot(pathAnswer.root || docsRoot);

  const summary = {
    site: identityAnswers,
    sources: { globs, includeReadme },
    frontMatter: {
      addIfMissing: frontAnswers.addIfMissing,
      tocDepth: Number(frontAnswers.tocDepth || frontDefaults.tocDepth || 2),
      autoSummary: frontAnswers.autoSummary
    },
    codeTabs,
    assets,
    search,
    works: worksConfig,
    paths: { root: docsRoot, homepage }
  };

  console.log('');
  console.log(pc.bold('Summary'));
  console.log(`  • Root: ${pc.cyan(summary.paths.root)}`);
  console.log(`  • Homepage: ${summary.paths.homepage || '(auto)'}`);
  console.log(`  • Sources: ${summary.sources.globs.join(', ') || '(none)'}`);
  console.log(`  • Include README sections: ${summary.sources.includeReadme ? 'yes' : 'no'}`);
  console.log(`  • Sections: ${sections.length}`);
  console.log(`  • Search: ${summary.search.enabled ? summary.search.engine : 'disabled'}`);
  console.log(`  • Works in nav: ${summary.works.includeInNav ? 'yes' : 'no'}, homepage hero: ${summary.works.includeOnHome ? 'yes' : 'no'}`);
  console.log('');

  if (!nonInteractive) {
    const confirm = await prompt({ type: 'confirm', name: 'write', message: 'Write settings to .prae/docs.json?', initial: true });
    if (!confirm.write) {
      console.log(pc.yellow('Docs wizard cancelled — nothing written.'));
      abort('cancelled');
    }
  } else {
    console.log(pc.gray('--yes flag detected → writing configuration without prompt.'));
  }

  const configToSave = {
    site: {
      title: identityAnswers.title,
      subtitle: identityAnswers.subtitle,
      description: identityAnswers.description,
      accent: identityAnswers.accent
    },
    sources: summary.sources,
    ia: sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      hidden: !!section.hidden,
      pages: section.pages.map((page) => ({
        source: page.source,
        title: page.title,
        slug: page.slug,
        summary: page.summary,
        tags: Array.isArray(page.tags) ? page.tags : [],
        hidden: !!page.hidden
      }))
    })),
    frontMatter: summary.frontMatter,
    codeTabs: summary.codeTabs,
    assets: summary.assets,
    search: summary.search,
    works: summary.works,
    paths: summary.paths
  };

  saveDocsConfig(configToSave);
  console.log(pc.green('write ') + pc.dim(cwdRel(DOCS_CONFIG_PATH)));
  if (createdFiles.length) {
    console.log(pc.gray(`Created ${createdFiles.length} starter file${createdFiles.length === 1 ? '' : 's'}.`));
  }

  return { config: configToSave, createdFiles };
}

if (!program.commands.some(cmd => cmd.name() === 'docs')) {
  program
    .command('docs')
    .description('Docs Reader wizard (content IA, search, assets, and Works integration)')
    .option('--docs-root <dir>', 'Docs content root (default docs/)', '')
    .option('--docs-scan <globs>', 'Comma-separated markdown globs to include', '')
    .option('--docs-home <source>', 'Homepage source (README.md, file path, or section slug)', '')
    .option('--docs-works <modes>', 'Works integration (nav,home,skip,auto,internal,external)', '')
    .option('--docs-search <engine>', 'Search engine (auto|light|fuse|none)', '')
    .option('--docs-fields <fields>', 'Comma-separated search fields', '')
    .option('--docs-alt-policy <policy>', 'Alt text policy (require|warn|auto)', '')
    .option('--docs-tabs <mode>', 'Code tabs mode (off|fence|snippets)', '')
    .option('--yes', 'Accept defaults and write config without prompts', false)
    .action(async (opts) => {
      try {
        await runDocsWizard(opts, { autoTriggered: false });
      } catch (err) {
        if (err && err.message === 'abort') return;
        throw err;
      }
    });
}

/* ------------------ add / wizard ------------------ */
program
  .command('add')
  .alias('wizard')
  .description('Interactive wizard: add one or more works to .prae/works.json (IDs are identities; array order is display order)')
  .action(async () => {
    const db = loadDb();
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);

    let again = true;
    while (again) {
      const base = await prompt([
        { type: 'input', name: 'title', message: 'Work title', validate: v => !!String(v).trim() || 'Required' },
        { type: 'input', name: 'slug',  message: 'Slug', initial: (ans)=> slugify(ans.title), validate: v => !!String(v).trim() || 'Required' },
        { type: 'input', name: 'oneliner', message: 'Oneliner (optional, one sentence)' },
        { type: 'input', name: 'description', message: 'Long description (Markdown, optional)' },
        { type: 'input', name: 'audio', message: 'Audio URL (optional; leave blank if none)' },
        { type: 'input', name: 'pdf',   message: 'Score PDF URL (optional)' },
        { type: 'input', name: 'cover', message: 'Cover image URL (optional)' },
        { type: 'input', name: 'tags',  message: 'Tags (comma separated, optional)' },
      ]);

      const cues = [];
      const wantCues = await prompt({ type: 'confirm', name: 'ok', message: 'Add cue points?', initial: true });
      if (wantCues.ok) {
        let more = true;
        while (more) {
          const c = await prompt([
            { type: 'input', name: 'label', message: 'Cue label (e.g. @5:49)', initial: '@0:00' },
            { type: 'input', name: 'time',  message: 'Cue time (mm:ss or seconds)', initial: '0:00' }
          ]);
          const t = parseTimeToSec(c.time);
          cues.push({ label: c.label || `@${c.time}`, t });
          const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another cue?', initial: false });
          more = cont.ok;
        }
      }

      // NEW: page-follow (score) block
      let score = null;
      const wantScore = await prompt({ type: 'confirm', name: 'ok', message: 'Add PDF page-follow mapping for this work?', initial: false });
      if (wantScore.ok) {
        const sBase = await prompt([
          { type: 'input', name: 'pdfStartPage',   message: 'Printed p.1 equals PDF page (pdfStartPage)', initial: '1', validate: v => /^\d+$/.test(String(v).trim()) && parseInt(v,10)>=1 ? true : 'Enter an integer ≥ 1' },
          { type: 'input', name: 'mediaOffsetSec', message: 'Media offset seconds (can be negative, default 0)', initial: '0', validate: v => /^-?\d+$/.test(String(v).trim()) ? true : 'Enter an integer (e.g., 0, -30, 12)' },
        ]);

        const pageMap = [];
        let more = true;
        while (more) {
          const pm = await prompt([
            { type: 'input', name: 'at',   message: 'Time (mm:ss or seconds)', initial: pageMap.length ? '' : '0:00', validate: v => String(v).trim().length ? true : 'Required' },
            { type: 'input', name: 'page', message: 'Printed page number', initial: pageMap.length ? '' : '1', validate: v => /^\d+$/.test(String(v).trim()) && parseInt(v,10)>=1 ? true : 'Enter an integer ≥ 1' }
          ]);
          pageMap.push({ at: pm.at.trim(), page: parseInt(pm.page,10) });
          const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another page mapping?', initial: false });
          more = cont.ok;
        }

        // Optional: pdfDelta tweak
        let pdfDeltaVal = null;
        const wantDelta = await prompt({ type: 'confirm', name: 'ok', message: 'Add optional pdfDelta (advanced)?', initial: false });
        if (wantDelta.ok) {
          const dAns = await prompt([{ type: 'input', name: 'pdfDelta', message: 'pdfDelta (integer; default none)', validate: v => /^-?\d+$/.test(String(v).trim()) ? true : 'Enter an integer' }]);
          pdfDeltaVal = parseInt(dAns.pdfDelta, 10);
        }

        score = {
          pdfStartPage: parseInt(sBase.pdfStartPage,10),
          mediaOffsetSec: parseInt(sBase.mediaOffsetSec,10),
          pageMap
        };
        if (Number.isInteger(pdfDeltaVal)) score.pdfDelta = pdfDeltaVal;
      }

      const title = String(base.title || '').trim();
      const slugValue = (base.slug?.trim()) || slugify(title);
      const newId = nextId(db);
      const entrySource = {
        id: newId,
        slug: slugValue,
        title,
        oneliner: base.oneliner,
        description: base.description,
        audio: base.audio?.trim() || null,
        pdf: base.pdf?.trim() || null,
        cover: base.cover?.trim() || null,
        tags: parseTagsInput(base.tags),
        cues,
        ...(score ? { score } : {})
      };
      const { sanitized: narrativeSanitized, normalized: normalizedNarrative } = sanitizeNarrativeFields(entrySource);
      const entry = { ...narrativeSanitized };
      if (!String(base.oneliner || '').trim()) {
        if (String(base.description || '').trim() && normalizedNarrative.onelinerEffective) {
          console.log(pc.gray(`No oneliner provided → using "${normalizedNarrative.onelinerEffective}" in compact views.`));
        } else if (!String(base.description || '').trim()) {
          console.log(pc.gray('No oneliner or description provided → using the title in compact views.'));
        }
      }
      const authoringHints = collectWorkWarnings(entry);
      for (const hint of authoringHints) {
        console.log(pc.yellow('  • ' + hint));
      }

      const candidate = { version: db.version || 1, works: [...db.works, entry] };
      const ok = validate(candidate);
      if (!ok) {
        console.log(pc.red('Validation failed:'));
        for (const e of validate.errors || []) {
          console.log('  - ' + e.instancePath + ' ' + e.message);
        }
        const retry = await prompt({ type: 'confirm', name: 'ok', message: 'Edit and try again?', initial: true });
        if (!retry.ok) break;
        continue;
      }

      saveDb(candidate);
      console.log(pc.green('added ') + pc.dim(`#${entry.id} ${entry.title}`));

      const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another work?', initial: true });
      again = cont.ok;
    }

    console.log(pc.gray('DB at ') + pc.cyan(cwdRel(DB_PATH)));
  });

/* ------------------ list ------------------ */
program
  .command('list')
  .description('List works from .prae/works.json')
  .action(() => {
    const db = loadDb();
    if (!db.works.length) { console.log(pc.yellow('No works yet. Add with: ') + pc.cyan('praetorius add')); return; }
    console.log(pc.bold('Works'));
   db.works.forEach((w, idx) => {
      const normalized = normalizeWork(w);
      console.log(pc.cyan(`#${normalized.id}`) + ' ' + normalized.title + pc.gray(`  (${normalized.slug})`));
      const summary = normalized.onelinerEffective || '';
      console.log('   ' + pc.dim(summary) + pc.gray(`   [order=${idx+1}]`));
      if (normalized.audio) console.log('   audio: ' + pc.gray(normalized.audio));
      if (normalized.pdf)   console.log('   pdf:   ' + pc.gray(normalized.pdf));
      if (normalized.cover) console.log('   cover: ' + pc.gray(normalized.cover));
      if (Array.isArray(normalized.tags) && normalized.tags.length) {
        console.log('   tags:  ' + pc.gray(normalized.tags.join(', ')));
      }
      if (w.cues?.length) {
        const cs = w.cues.map(c => `${c.label}=${c.t}s`).join(', ');
        console.log('   cues:  ' + pc.gray(cs));
      }
      if (normalized.score?.pageMap?.length) {
        console.log('   score: ' + pc.gray(`p1→PDF ${normalized.score.pdfStartPage ?? 1}, offset ${normalized.score.mediaOffsetSec ?? 0}s, map ${normalized.score.pageMap.length} rows`));
      }
    });
  });

/* ------------------ validate ------------------ */
program
  .command('validate')
  .description('Validate works DB against schema and emit narrative warnings')
  .action(() => {
    const db = loadDb();
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    const schemaOk = validate(db);

    const worksCount = Array.isArray(db.works) ? db.works.length : 0;
    if (schemaOk) {
      console.log(pc.green(`Schema OK — ${worksCount} work${worksCount === 1 ? '' : 's'}`));
    } else {
      console.log(pc.red('Schema errors:'));
      for (const err of validate.errors || []) {
        const where = err.instancePath && err.instancePath.length ? err.instancePath : '/';
        console.log('  - ' + where + ' ' + (err.message || 'invalid'));
      }
    }

    const warnings = [];
    for (const work of db.works || []) {
      const view = normalizeWork(work);
      const hints = collectWorkWarnings(view);
      for (const hint of hints) {
        const label = `#${view.id ?? '?'} ${view.title ?? ''}`.trim();
        warnings.push({ label, hint });
      }
    }

    if (warnings.length) {
      console.log(pc.yellow('Warnings:'));
      for (const entry of warnings) {
        console.log('  - ' + entry.label + ': ' + entry.hint);
      }
    } else {
      console.log(pc.green('No narrative warnings.'));
    }

    if (!schemaOk) {
      process.exitCode = 1;
    }
  });

/* ------------------ edit ------------------ */
program
  .command('edit <id>')
  .description('Edit a work (wizard by default; flags to set fields directly)')
  .option('--title <str>', 'Set title')
  .option('--slug <str>',  'Set slug')
  .option('--one <str>',   'Set oneliner (legacy alias)')
  .option('--oneliner <str>', 'Set oneliner')
  .option('--description <str>', 'Set description (Markdown)')
  .option('--audio <url>', 'Set audio URL (or empty to clear)')
  .option('--pdf <url>',   'Set score PDF URL (or empty to clear)')
  .option('--cover <url>', 'Set cover image URL (or empty to clear)')
  .option('--tags <list>', 'Set tags (comma-separated; empty to clear)')
  .option('--no-cues',     'Do not edit cues interactively')
  .option('--no-score',    'Do not edit score/page-follow interactively')
  .action(async (id, opts) => {
    const db = loadDb();
    const { idx, work } = findById(db, id);
    if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }

    // Apply direct flags first (non-interactive)
    if (opts.title) work.title = opts.title;
    if (opts.slug)  work.slug  = opts.slug;
    if (opts.one !== undefined) work.oneliner = opts.one;
    if (opts.oneliner !== undefined) work.oneliner = opts.oneliner;
    if ('description' in opts) work.description = opts.description;
    if ('audio' in opts) work.audio = (opts.audio === '' ? null : opts.audio);
    if ('pdf'   in opts) work.pdf   = (opts.pdf   === '' ? null : opts.pdf);
    if ('cover' in opts) work.cover = (opts.cover === '' ? null : opts.cover);
    if ('tags' in opts) work.tags = parseTagsInput(opts.tags);
    Object.assign(work, sanitizeNarrativeFields(work).sanitized);

    // If no flags changed anything, run wizard
    const changedViaFlags =
      !!(opts.title || opts.slug || opts.one || opts.oneliner || 'description' in opts || 'audio' in opts || 'pdf' in opts || 'cover' in opts || 'tags' in opts);
    if (!changedViaFlags) {
      const base = await prompt([
        { type: 'input', name: 'title', message: 'Title', initial: work.title },
        { type: 'input', name: 'slug',  message: 'Slug',  initial: work.slug },
        { type: 'input', name: 'oneliner', message: 'Oneliner (optional, one sentence)', initial: work.oneliner || '' },
        { type: 'input', name: 'description', message: 'Long description (Markdown, optional)', initial: work.description || '' },
        { type: 'input', name: 'audio', message: 'Audio URL (blank to clear)', initial: work.audio || '' },
        { type: 'input', name: 'pdf',   message: 'Score PDF URL (blank to clear)', initial: work.pdf || '' },
        { type: 'input', name: 'cover', message: 'Cover image URL (blank to clear)', initial: work.cover || '' },
        { type: 'input', name: 'tags',  message: 'Tags (comma-separated; blank to clear)', initial: Array.isArray(work.tags) ? work.tags.join(', ') : '' }
      ]);
      work.title = base.title.trim();
      work.slug  = base.slug.trim();
      work.oneliner = base.oneliner;
      work.description = base.description;
      work.audio = base.audio.trim() || null;
      work.pdf   = base.pdf.trim()   || null;
      work.cover = base.cover.trim() || null;
      work.tags = parseTagsInput(base.tags);
      const normalizedNarrative = sanitizeNarrativeFields(work);
      Object.assign(work, normalizedNarrative.sanitized);
      if (!base.oneliner?.trim()) {
        if (base.description?.trim() && normalizedNarrative.normalized.onelinerEffective) {
          console.log(pc.gray(`No oneliner provided → using "${normalizedNarrative.normalized.onelinerEffective}" in compact views.`));
        } else if (!base.description?.trim()) {
          console.log(pc.gray('No oneliner or description provided → using the title in compact views.'));
        }
      }
      const editHints = collectWorkWarnings(work);
      for (const hint of editHints) {
        console.log(pc.yellow('  • ' + hint));
      }
    }

    // Cues edit (unless --no-cues)
    if (opts.cues !== false) {
      const ans = await prompt({ type: 'confirm', name: 'ok', message: 'Edit cues?', initial: false });
      if (ans.ok) {
        const newCues = [];
        let more = true;
        while (more) {
          const c = await prompt([
            { type: 'input', name: 'label', message: 'Cue label', initial: '@0:00' },
            { type: 'input', name: 'time',  message: 'mm:ss or seconds', initial: '0:00' }
          ]);
          newCues.push({ label: c.label || `@${c.time}`, t: parseTimeToSec(c.time) });
          const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another cue?', initial: false });
          more = cont.ok;
        }
        work.cues = newCues;
      }
    }

    // Score/page-follow edit (unless --no-score)
    if (opts.score !== false) {
      const ans = await prompt({ type: 'confirm', name: 'ok', message: 'Edit page-follow (score)?', initial: false });
      if (ans.ok) {
        const s0 = work.score || { pdfStartPage: 1, mediaOffsetSec: 0, pageMap: [] };
        const sBase = await prompt([
          { type: 'input', name: 'pdfStartPage',   message: 'Printed p.1 equals PDF page', initial: String(s0.pdfStartPage ?? 1), validate: v => /^\d+$/.test(String(v).trim()) && parseInt(v,10)>=1 ? true : 'Enter an integer ≥ 1' },
          { type: 'input', name: 'mediaOffsetSec', message: 'Media offset seconds (can be negative)', initial: String(s0.mediaOffsetSec ?? 0), validate: v => /^-?\d+$/.test(String(v).trim()) ? true : 'Enter an integer' }
        ]);
        const pm = [];
        let more = true;
        while (more) {
          const row = await prompt([
            { type: 'input', name: 'at',   message: 'Time (mm:ss or seconds)', initial: pm.length ? '' : '0:00', validate: v => String(v).trim().length ? true : 'Required' },
            { type: 'input', name: 'page', message: 'Printed page number',     initial: pm.length ? '' : '1',    validate: v => /^\d+$/.test(String(v).trim()) && parseInt(v,10)>=1 ? true : 'Enter integer ≥ 1' }
          ]);
          pm.push({ at: row.at.trim(), page: parseInt(row.page, 10) });
          const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another page mapping?', initial: false });
          more = cont.ok;
        }
        work.score = {
          pdfStartPage: parseInt(sBase.pdfStartPage,10),
          mediaOffsetSec: parseInt(sBase.mediaOffsetSec,10),
          pageMap: pm
        };
      }
    }

    // Save
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    const candidate = { ...db };
    candidate.works[idx] = work;
    if (!validate(candidate)) {
      console.log(pc.red('Validation failed:'));
      for (const e of validate.errors || []) console.log('  - ' + (e.instancePath||'/') + ' ' + e.message);
      process.exit(1);
    }
    saveDb(candidate);
    console.log(pc.green('updated ') + pc.dim(`#${work.id} ${work.title}`));
  });

/* ------------------ rm ------------------ */
program
  .command('rm <id>')
  .description('Remove a work by id (confirms; .bak kept automatically)')
  .action(async (id) => {
    const db = loadDb();
    const { idx, work } = findById(db, id);
    if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }
    const ans = await prompt({ type: 'confirm', name: 'ok', message: `Delete #${work.id} ${work.title}?`, initial: false });
    if (!ans.ok) { console.log(pc.gray('aborted')); return; }
    const next = { ...db, works: db.works.filter((_, i) => i !== idx) };
    saveDb(next);
    console.log(pc.green('removed ') + pc.dim(`#${work.id} ${work.title}`));
  });

/* ------------------ order ------------------ */
program
  .command('order')
  .description('Reorder works (interactive by default). Use --move <id> --to <index> for direct move.')
  .option('--move <id>', 'Move a single id')
  .option('--to <index>', 'Target 1-based index for --move')
  .action(async (opts) => {
    const db = loadDb();
    if (!db.works.length) { console.log(pc.yellow('No works to reorder.')); return; }
    if (opts.move && !opts.to) { console.log(pc.red('Provide --to <index> with --move.')); process.exit(1); }

    if (opts.move && opts.to) {
      const id = Number(opts.move);
      const target = Number(opts.to) - 1; // 1-based → 0-based
      const { idx } = findById(db, id);
      if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }
      if (target < 0 || target >= db.works.length) { console.log(pc.red('Index out of range.')); process.exit(1); }
      const next = { ...db, works: moveInArray(db.works, idx, target) };
      saveDb(next);
      console.log(pc.green('moved ') + pc.dim(`#${id} → position ${target+1}`));
      return;
    }

    console.log(pc.bold('Current order:'));
    db.works.forEach((w,i)=>console.log(`${String(i+1).padStart(2,' ')}. #${w.id} ${w.title}`));
    const ans = await prompt({
      type: 'input',
      name: 'order',
      message: 'Enter new order as space/comma-separated IDs (e.g., "3 1 2"):',
    });
    const tokens = String(ans.order||'').split(/[,\s]+/).filter(Boolean).map(n=>Number(n));
    const idsNow = db.works.map(w=>w.id);
    const sameSet = tokens.length === idsNow.length && tokens.every(id => idsNow.includes(id));
    if (!sameSet) { console.log(pc.red('New order must contain exactly the same IDs.')); process.exit(1); }
    const byId = new Map(db.works.map(w => [w.id, w]));
    const reordered = tokens.map(id => byId.get(id));
    saveDb({ ...db, works: reordered });
    console.log(pc.green('reordered ') + pc.dim(tokens.join(' ')));
  });

/* ------------------ score subcommands ------------------ */
const scoreCmd = program.command('score')
  .description('Score/page-follow tools');

scoreCmd
  .command('add <id>')
  .description('Create/replace the score mapping (wizard) for a work')
  .action(async (id) => {
    const db = loadDb();
    const { idx, work } = findById(db, id);
    if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }

    console.log(pc.bold(`Score wizard for #${work.id} ${work.title}`));
    const base = await prompt([
      { type: 'input', name: 'pdfStartPage',   message: 'Printed p.1 equals PDF page (≥1)', initial: String(work.score?.pdfStartPage ?? 1),
        validate: v => /^\d+$/.test(String(v).trim()) && Number(v)>=1 ? true : 'Enter integer ≥ 1' },
      { type: 'input', name: 'mediaOffsetSec', message: 'Media offset seconds (can be negative)', initial: String(work.score?.mediaOffsetSec ?? 0),
        validate: v => /^-?\d+$/.test(String(v).trim()) ? true : 'Enter integer (e.g., 0, -30, 12)' }
    ]);

    // optional advanced delta (kept if you use it elsewhere)
    let pdfDelta;
    const wantDelta = await prompt({ type: 'confirm', name: 'ok', message: 'Add optional pdfDelta (advanced)?', initial: !!work.score?.pdfDelta });
    if (wantDelta.ok) {
      const d = await prompt([{ type:'input', name:'pdfDelta', message:'pdfDelta (integer; default 0)', initial: String(work.score?.pdfDelta ?? 0),
        validate: v => /^-?\d+$/.test(String(v).trim()) ? true : 'Enter integer' }]);
      pdfDelta = Number(d.pdfDelta);
    }

    const rows = [];
    let more = true;
    while (more) {
      const r = await prompt([
        { type: 'input', name: 'at',   message: 'Time (m:ss or h:mm:ss or seconds)', initial: rows.length ? '' : '0:00',
          validate: v => Number.isFinite(parseTimeToSecStrict(v)) ? true : 'Invalid time format' },
        { type: 'input', name: 'page', message: 'Printed page (≥1)', initial: rows.length ? '' : '1',
          validate: v => /^\d+$/.test(String(v).trim()) && Number(v)>=1 ? true : 'Enter integer ≥ 1' }
      ]);
      rows.push({ at: parseTimeToSecStrict(r.at), page: Number(r.page) });
      const cont = await prompt({ type: 'confirm', name: 'ok', message: 'Add another row?', initial: false });
      more = cont.ok;
    }

    const normalized = normalizeScore({
      pdfStartPage: Number(base.pdfStartPage),
      mediaOffsetSec: Number(base.mediaOffsetSec),
      ...(pdfDelta !== undefined ? { pdfDelta } : {}),
      pageMap: rows
    });
    const errs = validateScore(normalized);
    if (errs.length) {
      console.log(pc.red('Validation errors:'));
      errs.forEach(e => console.log('  - ' + e));
      process.exit(1);
    }

    printScorePreview(normalized);
    const ok = await prompt({ type: 'confirm', name: 'ok', message: 'Save this score mapping?', initial: true });
    if (!ok.ok) { console.log(pc.gray('aborted')); return; }

    const next = { ...db };
    next.works[idx] = { ...work, score: normalized };
    saveDb(next);
    console.log(pc.green('score saved ') + pc.dim(`#${work.id} ${work.title}`));
  });

scoreCmd
  .command('list <id>')
  .description('Show the score mapping table for a work')
  .action((id) => {
    const db = loadDb();
    const { work } = findById(db, id);
    if (!work) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }
    if (!work.score) { console.log(pc.yellow('No score/page-follow mapping set.')); return; }
    const sc = normalizeScore(work.score);
    console.log(pc.bold(`#${work.id} ${work.title}`));
    console.log(pc.gray(`pdfStartPage=${sc.pdfStartPage}, mediaOffsetSec=${sc.mediaOffsetSec}${sc.pdfDelta!==undefined?`, pdfDelta=${sc.pdfDelta}`:''}`));
    printScorePreview(sc);
  });

scoreCmd
  .command('rm <id> <rowIndex>')
  .description('Remove a row (1-based) from the score mapping')
  .action((id, rowIndex) => {
    const db = loadDb();
    const { idx, work } = findById(db, id);
    if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }
    if (!work.score || !Array.isArray(work.score.pageMap) || !work.score.pageMap.length) {
      console.log(pc.yellow('No rows to remove.')); return;
    }
    const i = Number(rowIndex) - 1;
    if (!(i >= 0 && i < work.score.pageMap.length)) { console.log(pc.red('Row index out of range.')); process.exit(1); }
    const sc = normalizeScore(work.score);
    sc.pageMap.splice(i, 1);
    const errs = validateScore(sc);
    if (errs.length) {
      console.log(pc.red('Resulting mapping invalid:'));
      errs.forEach(e => console.log('  - ' + e));
      process.exit(1);
    }
    const next = { ...db };
    next.works[idx] = { ...work, score: sc };
    saveDb(next);
    console.log(pc.green('score row removed ') + pc.dim(`#${work.id} ${work.title} [removed index ${i+1}]`));
  });

scoreCmd
  .command('validate <id>')
  .description('Validate score/page-follow mapping for a work')
  .action((id) => {
    const db = loadDb();
    const { work } = findById(db, id);
    if (!work) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }
    const sc = normalizeScore(work.score);
    const errs = validateScore(sc);
    if (errs.length) {
      console.log(pc.red('score: issues found'));
      errs.forEach(e => console.log('  - ' + e));
      process.exit(1);
    }
    console.log(pc.green('score: OK'));
    printScorePreview(sc);
  });

/* ------------------ import ------------------ */
  program
  .command('import <file>')
  .description('Import works from JSON|CSV|YAML and merge into DB (prompts to resolve conflicts).')
  .option('--assume-new-id', 'On id conflict, auto-assign next id (skip prompt)', false)
  .option('--assume-new-slug', 'On slug conflict, auto-append suffix (skip prompt)', false)
  .action(async (file, opts) => {
    const db = loadDb();
    const ext = path.extname(file).toLowerCase();
    const buf = fs.readFileSync(file, 'utf8');
    let rows = [];

   if (ext === '.json') {
      // Plain JSON: no YAML dependency
      const obj = JSON.parse(buf);
      rows = Array.isArray(obj) ? obj : (Array.isArray(obj.works) ? obj.works : []);
    } else if (ext === '.yaml' || ext === '.yml') {
      // YAML: lazy-load the parser and then parse
      const YAML = await lazyYaml();
      const obj = YAML.parse(buf);
      rows = Array.isArray(obj) ? obj : (Array.isArray(obj.works) ? obj.works : []);
    } else if (ext === '.csv') {
const parseCSV = await lazyCsvParse();
      const recs = parseCSV(buf, { columns: true, skip_empty_lines: true, trim: true, bom: true });
      rows = recs;
    } else {
      console.log(pc.red('Unsupported format. Use .json, .csv, .yaml/.yml'));
      process.exit(1);
    }

    if (!rows.length) { console.log(pc.yellow('No rows to import.')); return; }

    const incoming = [];
    for (const r of rows) {
      if (!ensureRequired(r) && !(r.title && r.slug && (r.one || r.oneliner || r.description))) {
        console.log(pc.yellow('skip row (missing required fields): ') + pc.dim(JSON.stringify(r)));
        continue;
      }
      incoming.push(normalizeImportedWork(r));
    }

    // Merge with conflict handling
    const byId    = new Map((db.works||[]).map(w => [Number(w.id), w]));
    const bySlug  = new Map((db.works||[]).map(w => [String(w.slug), w]));
    const merged  = db.works ? db.works.slice() : [];

    for (const w of incoming) {
      // id resolution
      let id = w.id;
      if (id === null) id = nextId({ works: merged });
      if (byId.has(id)) {
        if (opts.assume_new_id) {
          id = nextId({ works: merged });
        } else {
          const choice = await prompt({
            type: 'select', name: 'act', message: `ID ${id} exists. How to import "${w.title}"?`,
            choices: [
              { name: 'overwrite', message: 'Overwrite existing by id' },
              { name: 'newid',     message: 'Assign new id' },
              { name: 'skip',      message: 'Skip this row' }
            ]
          });
          if (choice.act === 'skip') continue;
          if (choice.act === 'newid') id = nextId({ works: merged });
          if (choice.act === 'overwrite') {
            const overwriteIdx = merged.findIndex(x => Number(x.id) === Number(id));
            const newWork = { ...w, id };
            merged[overwriteIdx] = newWork;
            // update slug map
            bySlug.set(newWork.slug, newWork);
            byId.set(id, newWork);
            continue;
          }
        }
      }

      // slug resolution
      let slug = String(w.slug);
      if (bySlug.has(slug)) {
        if (opts.assume_new_slug) {
          let n = 2;
          while (bySlug.has(`${slug}-${n}`)) n++;
          slug = `${slug}-${n}`;
        } else {
          const choice = await prompt({
            type: 'select', name: 'act', message: `Slug "${slug}" exists. Import "${w.title}" as…`,
            choices: [
              { name: 'newslug',  message: 'Append numeric suffix' },
              { name: 'overwrite', message: 'Overwrite existing by slug' },
              { name: 'skip',      message: 'Skip this row' }
            ]
          });
          if (choice.act === 'skip') continue;
          if (choice.act === 'newslug') {
            let n = 2;
            while (bySlug.has(`${slug}-${n}`)) n++;
            slug = `${slug}-${n}`;
          }
          if (choice.act === 'overwrite') {
            const overwriteIdx = merged.findIndex(x => String(x.slug) === String(slug));
            const newWork = { ...w, id, slug };
            merged[overwriteIdx] = newWork;
            bySlug.set(slug, newWork);
            byId.set(id, newWork);
            continue;
          }
        }
      }

      const newWork = { ...w, id, slug };
      merged.push(newWork);
      byId.set(id, newWork);
      bySlug.set(slug, newWork);
    }

    // Validate + save
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    const candidate = { version: db.version || 1, works: merged };
    if (!validate(candidate)) {
      console.log(pc.red('Post-import validation failed:'));
      for (const e of validate.errors || []) console.log('  - ' + (e.instancePath||'/') + ' ' + e.message);
      process.exit(1);
    }
    saveDb(candidate);
    console.log(pc.green('imported ') + pc.dim(`${incoming.length} row(s)`));
  });

/* ------------------ export ------------------ */
program
  .command('export')
  .description('Export DB to stdout as JSON or CSV')
  .option('--format <fmt>', 'json|csv', 'json')
  .action((opts) => {
    const db = loadDb();
    const fmt = String(opts.format||'json').toLowerCase();
    if (fmt === 'json') {
      process.stdout.write(JSON.stringify(db, null, 2) + '\n');
      return;
    }
    if (fmt === 'csv') {
      // Stable columns; JSON-encode nested
      const cols = ['id','slug','title','one','oneliner','description','audio','pdf','cover','tags_csv','cues_json','score_json'];
      const lines = [];
      lines.push(cols.join(','));
      for (const w of db.works||[]) {
        const view = normalizeWork(w);
        const row = [
          view.id ?? '',
          (view.slug ?? '').replaceAll('"','""'),
          (view.title ?? '').replaceAll('"','""'),
          (view.one ?? '').replaceAll('"','""'),
          (view.oneliner ?? '').replaceAll('"','""'),
          (view.description ?? '').replaceAll('"','""'),
          (view.audio ?? '').replaceAll('"','""'),
          (view.pdf ?? '').replaceAll('"','""'),
          (view.cover ?? '').replaceAll('"','""'),
          (Array.isArray(view.tags) ? view.tags.join(', ') : '').replaceAll('"','""'),
          JSON.stringify(view.cues ?? []).replaceAll('"','""'),
          JSON.stringify(view.score ?? null).replaceAll('"','""'),
        ].map(v => `"${String(v)}"`);
        lines.push(row.join(','));
      }
      process.stdout.write(lines.join('\n') + '\n');
      return;
    }
    console.log(pc.red('Unknown format; use --format=json|csv'));
    process.exit(1);
  });

/* ------------------ doctor ------------------ */
program
  .command('doctor')
  .description('Validate DB + config; optionally check audio/pdf URLs & CORS.')
  .option('--json', 'machine-readable JSON report (DB check)', false)
  .option('-q, --quiet', 'suppress OK chatter; only errors (DB check)', false)
  // Sprint 5 additions:
  .option('--urls', 'also run URL/CORS checks (audio/pdf, Drive hints)', false)
  .option('--offline', 'skip network calls in URL checks', false)
  .option('--timeout <ms>', 'per-URL timeout in ms for URL checks', (v)=>Number(v), 4500)
  .option('--no-exit-urls', 'do not set non-zero exit from URL checks', false)
  .action(async (opts) => {
    // ---- DB/config validation (existing behavior) ----
    const db  = loadDb();
    const cfg = loadConfig();
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    const errors = [];

    if (!validate(db)) {
      for (const e of validate.errors || []) {
        errors.push({ type: 'schema', where: e.instancePath || '/', msg: e.message || 'invalid' });
      }
    }
    // duplicate ID/slug checks
    const idSeen = new Set(), slugSeen = new Set();
    const dupIds = new Set(), dupSlugs = new Set();
    for (const w of db.works || []) {
      if (idSeen.has(w.id)) dupIds.add(w.id); else idSeen.add(w.id);
      if (slugSeen.has(w.slug)) dupSlugs.add(w.slug); else slugSeen.add(w.slug);
    }
    if (dupIds.size)  errors.push({ type: 'duplicate', where: 'id',   msg: `duplicate ids: ${[...dupIds].join(', ')}` });
    if (dupSlugs.size)errors.push({ type: 'duplicate', where: 'slug', msg: `duplicate slugs: ${[...dupSlugs].join(', ')}` });

    // config validation
    if (!(cfg.theme === 'light' || cfg.theme === 'dark')) {
      errors.push({ type: 'config', where: 'theme', msg: 'theme must be "light" or "dark"' });
    }
    try {
      normalizeAppearance(cfg.ui?.appearance || {}, { strict: true });
    } catch (err) {
      errors.push({ type: 'config', where: 'ui.appearance', msg: err?.message || 'invalid appearance settings' });
    }
    try {
      normalizeBranding(cfg.ui?.branding || {}, { strict: true });
    } catch (err) {
      errors.push({ type: 'config', where: 'ui.branding', msg: err?.message || 'invalid branding settings' });
    }

    const dbOk = errors.length === 0;

    if (opts.json) {
      const report = { ok: dbOk, errors, counts: { works: db.works?.length || 0 } };
      console.log(JSON.stringify(report, null, 2));
    } else {
      if (dbOk && !opts.quiet) {
        const appearance = normalizeAppearance(cfg.ui?.appearance || {}, { strict: false });
        console.log(pc.green('doctor: OK'));
        console.log(pc.gray(`works: ${db.works?.length || 0}, theme: ${cfg.theme}, palette:${appearance.theme.palette}, cursor:${appearance.cursor.preset}, hover:${appearance.effects.hover}, button:${appearance.effects.button}, minify:${cfg.output.minify}, embed:${cfg.output.embed}`));
      } else if (!dbOk) {
        console.log(pc.red('doctor: issues found'));
        errors.forEach(e => console.log(`  - ${e.type} ${pc.gray(e.where)}: ${e.msg}`));
      }
    }

    let finalExit = dbOk ? 0 : 1;

    // ---- Optional URL/CORS checks (Sprint 5) ----
if (opts.urls) {
  const argv = [];
  if (opts.offline) argv.push('--offline');
  if (Number.isFinite(opts.timeout)) argv.push(`--timeout=${opts.timeout}`);
  if (opts.noExitUrls) argv.push('--no-exit');

  let doctorUrls;
  try {
    const mod = await import('./doctor.js');
    doctorUrls = mod.doctor || mod.default;
  } catch (e) {
    if (!opts.quiet) {
      console.log(pc.yellow('urls: doctor module not found; skipping URL/CORS checks.'));
      console.log(pc.gray('hint: add src/cli/doctor.js (export function doctor(argv){...}) or install your URL checker.'));
    }
  }

  if (typeof doctorUrls === 'function') {
    try {
      const { errors: urlErrors = 0, warns: urlWarns = 0 } = await doctorUrls(argv);
      if (!opts.quiet) {
        console.log(pc.gray(`urls: ${urlErrors} error(s), ${urlWarns} warn(s)`));
      }
      if (urlErrors > 0 && !opts.noExitUrls) finalExit = 1;
    } catch (e) {
      console.log(pc.red('urls doctor failed: ') + (e?.message || String(e)));
      finalExit = 1;
    }
  }
}


    process.exit(finalExit);
  });


/* ------------------ generate ------------------ */
program
  .command('generate')
  .alias('build')
  .description('Emit assets from .prae/works.json (respects .prae/config.json)')
  .option('-o, --out <dir>', 'output directory', 'dist')
  .option('--embed', 'emit one HTML snippet (inline <style> + <script>)', false)
  .option('--minify', 'minify JS+CSS using esbuild', false)
  .option('--js <file>', 'output JS filename (default: script.js)')
  .option('--css <file>', 'output CSS filename (default: styles.css)')
  .option('--no-css', 'skip writing CSS when not using --embed')
  .option('--watch', 'watch .prae/{works,config}.json and regenerate on changes', false)
  .option('--ui-src <dir>', 'UI source dir containing template.html/main.js/style.css', 'ui')
  .option('--skin <name>',  'UI skin key (overrides .prae/config.json ui.skin). Supported: vite-breeze — Liquid Glass portfolio shell; docs-reader (alias: docs) — spacious docs UI; cards-tabs (alias: dashboard) — portfolio dashboard; kiosk (alias: presentation) — touch-first tiles; typescatter (alias: posterboard) — type-only poster wall with drag + scatter/grid toggle. All skins render PRAE.works only.', '')
  .option('--ui-runtime <runtime>', 'UI runtime for supported skins (vanilla|react). React is available for vite-breeze, cards-tabs, kiosk, and docs-reader.', 'vanilla')
  .option('--palette <name>', `appearance palette (${APPEARANCE_PALETTES.join('|')})`)
  .option('--cursor <preset>', `cursor preset (${CURSOR_PRESETS.join('|')})`)
  .option('--hover-effect <preset>', `hover effect preset (${EFFECT_PRESETS.join('|')})`)
  .option('--button-effect <preset>', `button effect preset (${EFFECT_PRESETS.join('|')})`)
  .option('--mono-color <value>', 'mono-one base color (HEX or oklch(L C H))')
  .option('--html <file>',  'template HTML filename within --ui-src', 'template.html')
  .option('--app-js <file>','UI JS output filename', 'app.js')
  .option('--app-css <file>','UI CSS output filename', 'app.css')
  .option('--no-ui',        'skip building UI (HTML/JS/CSS) even if present')
  .option('--seed <mode>', 'starter content seeding (auto|always|never)', 'auto')
  .option('--allow-fallback', 'Use starter seed when validation fails (prints warning banner)', false)


  .action(async function (opts) {
    const command = this;
    const outDir = path.resolve(process.cwd(), opts.out);
    const allowFallback = !!opts.allowFallback;
    fs.mkdirSync(outDir, { recursive: true });
    const uiSrcDir = path.resolve(process.cwd(), opts.uiSrc || 'ui');
    const pkgUiDir = path.resolve(PKG_ROOT, 'ui'); // packaged starter UI (fallback)
    const appJsSource = command?.getOptionValueSource?.('appJs') || 'default';
    const appCssSource = command?.getOptionValueSource?.('appCss') || 'default';
    const seedMode = String(opts.seed ?? 'auto').toLowerCase();
    if (!['auto', 'always', 'never'].includes(seedMode)) {
      console.log(pc.red(`Invalid --seed mode "${opts.seed}". Use auto, always, or never.`));
      process.exit(1);
    }
    const requestedUiRuntime = normalizeUiRuntime(opts.uiRuntime);
    if (!requestedUiRuntime) {
      console.log(pc.red(`Invalid --ui-runtime "${opts.uiRuntime}". Use: ${UI_RUNTIMES.join(', ')}.`));
      process.exit(1);
    }
    const appearanceOverrides = {
      palette: opts.palette,
      cursor: opts.cursor,
      hoverEffect: opts.hoverEffect,
      buttonEffect: opts.buttonEffect,
      monoColor: opts.monoColor
    };

    const buildOnce = async () => {
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
      fs.mkdirSync(outDir, { recursive: true });

      const cfg = loadConfig();
      let effectiveAppearance;
      let effectiveBranding;
      try {
        effectiveAppearance = resolveAppearanceForGenerate(cfg.ui?.appearance || DEFAULT_APPEARANCE, appearanceOverrides);
        effectiveBranding = normalizeBranding(cfg.ui?.branding || DEFAULT_BRANDING, { strict: true });
      } catch (err) {
        console.log(pc.red(err?.message || String(err)));
        if (!opts.watch) process.exit(1);
        process.exitCode = 1;
        return false;
      }
      const brandRoot = findBrandRoot(uiSrcDir, pkgUiDir);
      const brandCss = readBrandCss(brandRoot);
      const brandCssEmbed = readBrandCss(brandRoot, { embed: true });
      const requestedSkinRaw = String(opts.skin || cfg.ui?.skin || 'console').trim();
      const normalizedSkin = requestedSkinRaw.toLowerCase();
      const builtinSkin = resolveBuiltinSkinKey(normalizedSkin);
      const effectiveSkin = builtinSkin || (normalizedSkin || 'console');
      const runtimeResolution = resolveUiRuntimeForSkin(effectiveSkin, requestedUiRuntime);
      const uiRuntime = runtimeResolution.runtime;
      if (runtimeResolution.warned) {
        console.log(pc.yellow(`--ui-runtime=react is not supported for skin "${effectiveSkin}" yet. Falling back to vanilla.`));
      }
      let runtimeAppearance = effectiveAppearance;
      if (effectiveSkin === 'console') {
        runtimeAppearance = {
          theme: {
            palette: effectiveAppearance.theme.palette,
            monoBaseOklch: effectiveAppearance.theme.monoBaseOklch
          },
          cursor: { preset: DEFAULT_APPEARANCE.cursor.preset },
          effects: {
            hover: DEFAULT_APPEARANCE.effects.hover,
            button: DEFAULT_APPEARANCE.effects.button
          }
        };
        if (
          effectiveAppearance.cursor.preset !== DEFAULT_APPEARANCE.cursor.preset ||
          effectiveAppearance.effects.hover !== DEFAULT_APPEARANCE.effects.hover ||
          effectiveAppearance.effects.button !== DEFAULT_APPEARANCE.effects.button
        ) {
          console.log(pc.gray('console skin uses palette + mode only; cursor and hover/button effect presets are ignored.'));
        }
      }
      const detection = await detectWorksState({ skin: effectiveSkin, config: cfg });
      const shouldAutoSeed = await shouldSeed({ skin: effectiveSkin, contentDir: detection.resolvedDir, config: cfg });
      let doSeed = false;
      let seedWasApplied = false;
      if (seedMode === 'always') {
        if (shouldAutoSeed === 'never') {
          console.log(pc.yellow('--seed=always ignored for skin "docs-reader" (uses its own documentation seed).'));
        } else {
          console.log(pc.yellow('--seed=always specified → seeding starter content (non-destructive).'));
          doSeed = true;
        }
      } else if (seedMode === 'never') {
        console.log(pc.gray('--seed=never specified → not seeding starter content.'));
      } else {
        if (shouldAutoSeed === 'never') {
          // docs reader – stay silent to avoid extra noise unless watch prints summary later
        } else if (detection.manifestParseError) {
          console.log(pc.yellow(`Could not parse ${cwdRel(DB_PATH)} → skipping starter seed for safety.`));
        } else if (detection.worksCount > 0) {
          console.log(pc.gray(`Found ${detection.worksCount} works in ${detection.displayDir} → skipping starter seed.`));
        } else {
          console.log(pc.yellow(`No works found in ${detection.displayDir} → seeding starter content (Satie demo, PDF, audio).`));
          doSeed = true;
        }
      }

      if (doSeed) {
        await runGenericStarterSeed({
          targetDirs: { manifestPath: DB_PATH, assetsDir: null, contentDir: detection.resolvedDir },
          skin: effectiveSkin,
          config: cfg
        });
        seedWasApplied = true;
      }

      const db = loadDb();
      let worksCount = Array.isArray(db.works) ? db.works.length : 0;
      let dataSource = seedWasApplied ? 'seed' : 'user';
      let fallbackWorks = null;
      const runtimeWarnings = [];
      const schemaVersion = pkgJson.version || '0.0.0';
      if (process.env.PRAE_TEST === '1') {
        const tag = seedWasApplied ? 'APPLIED' : 'SKIPPED';
        console.log(`PRAE_TEST: works=${worksCount}, seed=${tag}`);
      }
      // Basic validation
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(WORKS_SCHEMA);
      if (!validate(db)) {
        console.log(pc.red('DB validation failed:'));
        for (const e of validate.errors || []) console.log('  - ' + e.instancePath + ' ' + e.message);
        if (allowFallback) {
          console.log(pc.yellow('--allow-fallback specified → using starter seed (validation failed).'));
          fallbackWorks = GENERIC_STARTER_WORKS;
          dataSource = 'seed';
          seedWasApplied = true;
          runtimeWarnings.push('Starter seed is shown because works data failed validation (--allow-fallback).');
        } else {
          if (!opts.watch) process.exit(1);
          process.exitCode = 1;
          return false;
        }
      }
      const wantMin = !!opts.minify || !!cfg.output.minify;
      const runtimeOpts = {
        worksOverride: fallbackWorks,
        theme: cfg.theme,
        appearance: runtimeAppearance,
        branding: effectiveBranding,
        site: cfg.site,
        source: dataSource,
        seeded: dataSource === 'seed',
        warnings: runtimeWarnings,
        schemaVersion
      };
      const runtimePayload = createRuntimePayload(db, runtimeOpts);
      worksCount = runtimePayload.count;
      const scriptOpts = {
        ...runtimeOpts,
        count: runtimePayload.count,
        minify: wantMin
      };
      let js  = renderScriptFromDb(db, scriptOpts);
      let css = buildCssBundle();
      if (wantMin) {
        const esb = await lazyEsbuild();
        const minJS  = await esb.transform(js,  { loader:'js',  minify:true, legalComments:'none' });
        const minCSS = await esb.transform(css, { loader:'css', minify:true, legalComments:'none' });
        js  = minJS.code; css = minCSS.code;
      }
      if (opts.embed) {
        const embedFallbackSkins = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);
        if (embedFallbackSkins.has(effectiveSkin)) {
          if (uiRuntime === 'react') {
            console.log(pc.gray(`Embed requested for ${effectiveSkin} with --ui-runtime=react → using vanilla ${effectiveSkin} fallback.`));
          }
          const htmlName = opts.html || 'template.html';
          const skinRoots = [
            path.join(uiSrcDir, 'skins', effectiveSkin),
            path.join(pkgUiDir, 'skins', effectiveSkin)
          ];
          const embedRoot = skinRoots.find((dir) => existsFile(path.join(dir, htmlName)));
          const skinLabelByKey = {
            'vite-breeze': 'Vite Breeze',
            'cards-tabs': 'Cards-Tabs',
            'kiosk': 'Kiosk',
            'docs-reader': 'Docs Reader'
          };
          const skinLabel = skinLabelByKey[effectiveSkin] || effectiveSkin;
          if (embedRoot) {
            const tplIn = path.join(embedRoot, htmlName);
            const styleIn = path.join(embedRoot, 'style.css');
            const mainIn = path.join(embedRoot, 'main.js');
            const bodyHtml = extractBodyInnerHtml(fs.readFileSync(tplIn, 'utf8'));
            const skinCss = existsFile(styleIn) ? fs.readFileSync(styleIn, 'utf8') : '';
            const skinJs = existsFile(mainIn) ? fs.readFileSync(mainIn, 'utf8') : '';
            const themeClass = (loadConfig().theme === 'light') ? 'prae-theme-light' : 'prae-theme-dark';
            const prelude = `(function(){var b=document.body; if(!b) return; b.classList.remove('prae-theme-light','prae-theme-dark'); b.classList.add('${themeClass}');})();`;
            const html = [
              `<!-- Praetorius embed: ${skinLabel} (vanilla fallback for CMS) -->`,
              '<style>', css, '</style>',
              brandCssEmbed ? '<style>' : '',
              brandCssEmbed || '',
              brandCssEmbed ? '</style>' : '',
              '<style>', skinCss, '</style>',
              `<div id="prae-${effectiveSkin}-embed">`,
              bodyHtml,
              '</div>',
              '<script>', prelude, '</script>',
              '<script>', js, '</script>',
              '<script>', skinJs, '</script>',
              ''
            ].join('\n');
            const htmlPath = path.join(outDir, 'embed.html');
            atomicWriteFile(htmlPath, html);
            console.log(pc.green('write ') + pc.dim(cwdRel(htmlPath)));
            console.log(pc.gray(`Using data: source=${runtimePayload.source}, count=${runtimePayload.count}`));
            return true;
          }
          console.log(pc.yellow(`${skinLabel} embed fallback skin files not found; using generic embed renderer.`));
        }
        const themeClass = (loadConfig().theme === 'light') ? 'prae-theme-light' : 'prae-theme-dark';
        const prelude = `(function(){var h=document.querySelector('#works-console')||document.body;h.classList.remove('prae-theme-light','prae-theme-dark');h.classList.add('${themeClass}');})();`;
        const html = [
          '<!-- Praetorius embed: paste into a Squarespace Code block -->',
          '<style>', css, '</style>',
          brandCssEmbed ? '<style>' : '',
          brandCssEmbed || '',
          brandCssEmbed ? '</style>' : '',
          '<script>', prelude, '</script>',
          '<script>', js, '</script>',
          '<script>', EMBED_RENDER, '</script>',
          ''
        ].join('\n');
        const htmlPath = path.join(outDir, 'embed.html');
        atomicWriteFile(htmlPath, html);
        console.log(pc.green('write ') + pc.dim(cwdRel(htmlPath)));
        console.log(pc.gray(`Using data: source=${runtimePayload.source}, count=${runtimePayload.count}`));
        return true;
      }
      const jsFile  = opts.js || 'script.js';
     const cssWant = opts.css !== false;
      const cssFile = (typeof opts.css === 'string') ? opts.css : 'styles.css';
      const jsPath = path.join(outDir, jsFile);
      atomicWriteFile(jsPath, js);
      console.log(pc.green('write ') + pc.dim(cwdRel(jsPath)));
      if (cssWant) {
        const cssPath = path.join(outDir, cssFile);
        atomicWriteFile(cssPath, css);
        console.log(pc.green('write ') + pc.dim(cwdRel(cssPath)));
      }

      // -------- UI bundle (template.html + main.js + style.css) ----------
      let docsData = null;
      let docsWarnings = [];
      let chosenSkin = builtinSkin || (normalizedSkin || 'console');
      let chosenSkinVariant = chosenSkin;
      let appliedUiRuntime = 'vanilla';
      const skipUiBuild = opts.noUi === true || opts.ui === false;
      if (!skipUiBuild) {
        // Prefer project UI dir; fall back to packaged /ui
        const htmlName = opts.html || 'template.html';
        const candidateSkinKeys = [];
        const requestedSkin = builtinSkin || (normalizedSkin || 'console');
        const requestedVariant = resolveSkinUiVariant(requestedSkin, uiRuntime);
        if (requestedVariant) candidateSkinKeys.push(requestedVariant);
        if (requestedVariant !== requestedSkin) candidateSkinKeys.push(requestedSkin);
        if (!candidateSkinKeys.includes('console')) candidateSkinKeys.push('console');

        let uiRoot = null;

        for (const skinName of candidateSkinKeys) {
          const skinRoots = [
            path.join(uiSrcDir, 'skins', skinName),
            path.join(pkgUiDir, 'skins', skinName)
          ];
          const found = skinRoots.find(d => existsFile(path.join(d, htmlName)));
          if (found) {
            chosenSkinVariant = skinName;
            chosenSkin = skinName.endsWith('-react') ? skinName.slice(0, -'-react'.length) : skinName;
            uiRoot = found;
            break;
          }
        }

        if (!uiRoot) {
          const legacyRoots = [uiSrcDir, pkgUiDir];
          uiRoot = legacyRoots.find(d => existsFile(path.join(d, htmlName))) || null;
          if (!chosenSkin) {
            chosenSkin = candidateSkinKeys[0] || 'console';
          }
          chosenSkinVariant = chosenSkin;
        }

        if (uiRoot) {
          appliedUiRuntime = chosenSkinVariant.endsWith('-react') ? 'react' : 'vanilla';
          if (chosenSkin === 'docs-reader' && !fs.existsSync(DOCS_CONFIG_PATH)) {
            try {
              await runDocsWizard({}, { autoTriggered: true });
            } catch (err) {
              if (err && err.message === 'abort') {
                console.log(pc.yellow('Docs wizard cancelled — aborting generate.'));
                return false;
              }
              throw err;
            }
          }
          if (chosenSkin === 'docs-reader') {
            const docsConfig = loadDocsConfig();
            const built = await buildDocsPayload({ config: docsConfig, projectRoot: process.cwd(), worksDb: db });
            docsData = built.data;
            docsWarnings = built.warnings;
            docsWarnings.forEach((msg) => {
              console.log(pc.yellow('Docs: ') + pc.gray(msg));
            });
          }
          const tplIn   = path.join(uiRoot, htmlName);
          const mainIn  = resolveUiMainEntry(uiRoot);
          const styleIn = path.join(uiRoot, 'style.css');
          const haveTpl   = existsFile(tplIn);
          const haveMain  = !!mainIn;
          const haveStyle = existsFile(styleIn);

          // haveTpl is guaranteed true here, but keep the guard for safety
          if (haveTpl) {
            const appJsFileName  = (appJsSource === 'default') ? 'app.js' : opts.appJs;
            const appCssFileName = (appCssSource === 'default')
              ? (chosenSkin === 'docs-reader' ? 'style.css' : 'app.css')
              : opts.appCss;
            // Copy/transform app.js + app.css if present
            let appJsCode = '';
            let appCssCode = '';
            if (haveMain) {
              const esb = await lazyEsbuild();
              const isReactBundle = chosenSkinVariant.endsWith('-react');
              if (isReactBundle) {
                const bundleResult = await esb.build({
                  entryPoints: [mainIn],
                  bundle: true,
                  format: 'esm',
                  platform: 'browser',
                  target: ['es2020'],
                  minify: !!wantMin,
                  legalComments: 'none',
                  write: false,
                  loader: {
                    '.js': 'js',
                    '.jsx': 'jsx',
                    '.ts': 'ts',
                    '.tsx': 'tsx'
                  }
                });
                const bundledJs = (bundleResult.outputFiles || []).find((file) => file.path.endsWith('.js'))
                  || (bundleResult.outputFiles || [])[0];
                appJsCode = bundledJs ? bundledJs.text : '';
                if (!appJsCode) {
                  throw new Error(`Could not bundle UI runtime entry: ${cwdRel(mainIn)}`);
                }
              } else {
                appJsCode = fs.readFileSync(mainIn, 'utf8');
                if (wantMin) {
                  const ext = path.extname(mainIn).toLowerCase();
                  const loader = ext === '.jsx' ? 'jsx' : (ext === '.ts' ? 'ts' : (ext === '.tsx' ? 'tsx' : 'js'));
                  appJsCode = (await esb.transform(appJsCode, { loader, minify: true, legalComments: 'none' })).code;
                }
              }
              const appJsOut = path.join(outDir, appJsFileName);
              atomicWriteFile(appJsOut, appJsCode);
              console.log(pc.green('write ') + pc.dim(cwdRel(appJsOut)));
            }
            if (haveStyle) {
              appCssCode = fs.readFileSync(styleIn, 'utf8');
              if (wantMin) {
                const esb = await lazyEsbuild();
                appCssCode = (await esb.transform(appCssCode, { loader:'css', minify:true, legalComments:'none' })).code;
              }
              const appCssOut = path.join(outDir, appCssFileName);
              atomicWriteFile(appCssOut, appCssCode);
              console.log(pc.green('write ') + pc.dim(cwdRel(appCssOut)));
            }

            const extraDirs = ['lib'];
            for (const dirName of extraDirs) {
              const srcDir = path.join(uiRoot, dirName);
              let stat;
              try { stat = fs.statSync(srcDir); } catch {}
              if (stat && stat.isDirectory()) {
                const destDir = path.join(outDir, dirName);
                copyDirSync(srcDir, destDir);
                console.log(pc.green('copy ') + pc.dim(`${cwdRel(srcDir)} → ${cwdRel(destDir)}`));
              }
            }
            if (brandRoot) {
              const brandOut = path.join(outDir, 'brand');
              copyDirSync(brandRoot, brandOut);
              console.log(pc.green('copy ') + pc.dim(`${cwdRel(brandRoot)} → ${cwdRel(brandOut)}`));
            }

          // Build dist/index.html by injecting links/scripts before </body>
          let html = fs.readFileSync(tplIn, 'utf8')
            .replace(
              '<html',
              `<html data-skin="${chosenSkin}" data-ui-runtime="${appliedUiRuntime}" data-theme="${cfg.theme === 'light' ? 'light' : 'dark'}" data-palette="${runtimeAppearance.theme.palette}" data-cursor="${runtimeAppearance.cursor.preset}" data-hover-effect="${runtimeAppearance.effects.hover}" data-button-effect="${runtimeAppearance.effects.button}" data-brand-system="${BRAND_SYSTEM_VERSION}" data-brand-attribution="${effectiveBranding.attribution.enabled ? 'on' : 'off'}"`
            );

          if (docsData) {
            const titleText = docsData.site?.title || 'Praetorius Docs';
            const subtitleText = docsData.site?.subtitle || '';
            const fullTitle = subtitleText ? `${titleText} — ${subtitleText}` : `${titleText}`;
            html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
            html = html.replace(/<div class="docs-title" data-site-title>[\s\S]*?<\/div>/, `<div class="docs-title" data-site-title>${escapeHtml(titleText)}</div>`);
            html = html.replace(/<div class="docs-subtitle" data-site-subtitle>[\s\S]*?<\/div>/, `<div class="docs-subtitle" data-site-subtitle>${escapeHtml(subtitleText)}</div>`);
            html = html.replace(/<footer[\s\S]*?<\/footer>/, (match) => match
              .replace(/<span data-site-title>[\s\S]*?<\/span>/, `<span data-site-title>${escapeHtml(titleText)}</span>`)
              .replace(/<span data-site-subtitle>[\s\S]*?<\/span>/, `<span data-site-subtitle>${escapeHtml(subtitleText)}</span>`)
            );
            html = html.replace(/<article class="docs-article">[\s\S]*?<\/article>/, '<article class="docs-article"></article>');
          }

          // Ensure the chosen light/dark theme class lands on <body>
          html = upsertBodyTheme(html, cfg.theme);
          if (!wantMin) {
            const metaTag = `<meta name="prae-data-source" content="${runtimePayload.source}">`;
            if (/<\/head>/i.test(html)) {
              html = html.replace(/<\/head>/i, `  ${metaTag}\n</head>`);
            } else if (/<html[^>]*>/i.test(html)) {
              html = html.replace(/<html[^>]*>/i, (m) => `${m}\n  ${metaTag}`);
            } else {
              html = `${metaTag}\n${html}`;
            }
          }
          const injParts = [
            brandCss ? '<link rel="stylesheet" href="./brand/brand.css">' : '',
            `<link rel="stylesheet" href="./${cssFile}">`
          ];
          if (haveStyle) injParts.push(`<link rel="stylesheet" href="./${appCssFileName}">`);
          injParts.push(`<script id="prae-data" data-source="${runtimePayload.source}" data-count="${runtimePayload.count}">window.__PRAE_DATA__ = ${serializeForScript(runtimePayload)};</script>`);
          injParts.push(`<script src="./${jsFile}" defer></script>`);
          if (docsData) {
            injParts.push(`<script id="prae-docs-data" type="application/json">${serializeForScript(docsData)}</script>`);
          }
          if (haveMain) injParts.push(`<script type="module" src="./${appJsFileName}" defer></script>`);
          const inj = injParts.filter(Boolean).join('\n');
          if (/<\/body>/i.test(html)) {
            html = html.replace(/<\/body>/i, `${inj}\n</body>`);
          } else {
            html += '\n' + inj + '\n';
          }
          const htmlOut = path.join(outDir, 'index.html');
          atomicWriteFile(htmlOut, html);
          console.log(pc.green('write ') + pc.dim(cwdRel(htmlOut)));
        }
        } else {
          console.log(
            pc.gray('UI: no template found in ') +
            pc.dim([uiSrcDir, pkgUiDir].map(cwdRel).join(', ')) +
            pc.gray(' (skipping UI bundle)')
          );
        }
      }
        console.log(pc.gray(`Using data: source=${runtimePayload.source}, count=${runtimePayload.count}`));
        console.log(pc.bold(`Generated ${chosenSkin} (${appliedUiRuntime}) to ${cwdRel(outDir)} (works: ${worksCount}, seeded: ${seedWasApplied ? 'yes' : 'no'})`));
      return true; // end buildOnce success
    }; // <-- end buildOnce

      const ok = await buildOnce();
      if (ok === false) {
        if (!opts.watch) process.exit(1);
        return;
      }
    if (opts.watch) {
      const chokidar = await lazyChokidar();
      const watcher = chokidar.watch(
        [DB_PATH, CONFIG_PATH, path.join(uiSrcDir, '**/*')],
        { ignoreInitial: true }
      );
      console.log(pc.gray(`watching .prae and ${cwdRel(uiSrcDir)} for changes…`));
      watcher.on('all', async (ev, p) => {
        console.log(pc.gray(`rebuild (${ev}: ${cwdRel(p)})`));
        await buildOnce();
      });
      return; // keep process alive while watching
    }
  }); // <-- end .action for generate
/* ------------------ migrate ------------------ */
program
  .command('migrate')
  .description('Detect schema version and apply deterministic transforms; backs up to .prae/history first')
  .option('--dry-run', 'Preview changes without writing files', false)
  .action((opts) => {
    const before = loadDb();
    const after  = migrateDb(JSON.parse(JSON.stringify(before)));
    const changed = JSON.stringify(before) !== JSON.stringify(after);

    if (!changed) {
      console.log(pc.gray(`migrate: nothing to do (version ${before.version ?? 1} already at latest)`));
      return;
    }

    // Validate the migrated DB against schema
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    if (!validate(after)) {
      console.log(pc.red('migrate: migrated DB failed validation:'));
      for (const e of validate.errors || []) console.log('  - ' + (e.instancePath || '/') + ' ' + e.message);
      process.exit(1);
    }

    console.log(pc.bold(`migrate: changes (v${before.version ?? 1} → v${after.version ?? '??'})`));
    printSummaryDiff(summarizeDiff(before, after));

    if (opts.dryRun) { console.log(pc.gray('dry-run: no files written.')); return; }

    const snap = writeHistorySnapshot(`before-migrate-v${before.version ?? 1}-to-v${after.version ?? 'X'}`);
    console.log(pc.gray('backup: ') + pc.cyan(cwdRel(snap)));
    saveDb(after);
    console.log(pc.green('migrated ') + pc.gray(`→ version ${after.version}`));
  });

/* ------------------ undo ------------------ */
program
  .command('undo')
  .description('One-step revert to the last .prae/history snapshot (with preview diff)')
  .action(async () => {
    const last = latestSnapshotFile();
    if (!last) {
      console.log(pc.red('undo: no history snapshots found in .prae/history.'));
      process.exit(1);
    }
    const current = loadDb();
    const snapDb  = loadHistorySnapshot(last);

    // Validate snapshot (best-effort; allow revert even if snapshot is older shape)
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(WORKS_SCHEMA);
    if (!validate(snapDb)) {
      console.log(pc.yellow('warning: snapshot does not fully match current schema; you can migrate again after undo.'));
    }

    console.log(pc.bold('undo: preview diff (current → snapshot)'));
    printSummaryDiff(summarizeDiff(current, snapDb));
    const ans = await prompt({ type:'confirm', name:'ok', message:`Revert to snapshot ${last}?`, initial:false });
    if (!ans.ok) { console.log(pc.gray('aborted')); return; }

    const backup = writeHistorySnapshot('before-undo');
    console.log(pc.gray('backup of current saved: ') + pc.cyan(cwdRel(backup)));
    saveDb(snapDb);
    console.log(pc.green('undo complete ') + pc.dim(`restored from ${last}`));
  });
/* ------------------ run ------------------ */
if (process.env.PRAE_TEST_EXPORTS !== '1') {
  program.parseAsync(process.argv);
} else {
  globalThis.__PRAE_TEST__ = {
    parseTimeToSecStrict, normalizeScore, validateScore,
    migrateDb, renderScriptFromDb, secToHuman,
  };
}
