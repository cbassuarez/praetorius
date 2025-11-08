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

/* ------------------ templates FIRST (avoid TDZ) ------------------ */
// Theme tokens (light/dark only; no auto)
const THEME_CSS = `/* Praetorius — theme tokens (strict light/dark) */
#works-console.prae-theme-dark, body.prae-theme-dark{
  --bg:#0f0f0f; --fg:#fff; --dim:#8a8a8a; --line:rgba(255,255,255,.18);
}
#works-console.prae-theme-light, body.prae-theme-light{
  --bg:#ffffff; --fg:#0d0d0d; --dim:#555; --line:rgba(0,0,0,.18);
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
// Minimal renderer injected only for --embed so the snippet is self-contained.
const EMBED_RENDER = `(function(){
  function render(){
    try{
      var data = (window.PRAE && window.PRAE.works) || [];
      console.log('[prae embed] works:', data.length);
      // Ensure a host exists
      var host = document.querySelector('#works-console');
      if(!host){ host=document.createElement('section'); host.id='works-console'; document.body.appendChild(host); }
      host.innerHTML = '';
      var list = document.createElement('div');
      function esc(s){return String(s||'').replace(/[&<>\\"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]); });}
      data.forEach(function(w){
        var line=document.createElement('div'); line.className='line';
        var html = '<div class="title"><strong>'+esc(w.title)+'</strong> <span class="muted">('+esc(w.slug)+')</span></div>'
                 + '<div class="one">'+esc(w.one||'')+'</div>';
        if(w.pdf){ html += '<div>score: <a href="'+esc(w.pdf)+'" target="_blank" rel="noopener">PDF</a></div>'; }
        if(w.audio){ html += '<div class="actions"><button class="btn" data-id="'+w.id+'">Play/Pause</button></div>'; }
        line.innerHTML = html;
        list.appendChild(line);
      });
      host.appendChild(list);
      if(window.PRAE && typeof window.PRAE.ensureAudioTags==='function'){ window.PRAE.ensureAudioTags(); }
      host.addEventListener('click', function(e){
        var b=e.target.closest('button[data-id]'); if(!b) return;
        var id=b.getAttribute('data-id'); var a=document.getElementById('wc-a'+id); if(!a) return;
        if(a.paused){ a.src=a.getAttribute('data-audio')||a.src; a.play(); } else { a.pause(); }
      });
    }catch(err){ console.error('[prae embed]', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();`;
function buildCssBundle(){ return THEME_CSS + '\n' + STARTER_CSS; }
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
      one: 'A through-composed/indeterminate quartet...',
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
function renderScriptFromDb(db, opts = {}) {
  const min = !!opts.minify;
  const worksArr = (db.works || []).map(w => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    one: w.one,
    cues: w.cues || [],
    pdf: w.pdf || null,
    audio: w.audio || null,
    audioId: `wc-a${w.id}`
  }));

  // Build page-follow maps keyed by slug (only for works that provide "score")
  const pf = {};
  for (const w of db.works || []) {
    if (w.score && (w.score.pdfStartPage || (w.score.pageMap && w.score.pageMap.length))) {
      pf[w.slug] = {
        pdfStartPage: Number.isInteger(w.score.pdfStartPage) ? w.score.pdfStartPage : 1,
        mediaOffsetSec: Number.isInteger(w.score.mediaOffsetSec) ? w.score.mediaOffsetSec : 0,
        pageMap: (w.score.pageMap || []).map(row => ({
          at: row.at,                 // mm:ss string or integer seconds; main.js can parse both
          page: row.page
        }))
      };
      if (Number.isInteger(w.score.pdfDelta)) {
        pf[w.slug].pdfDelta = w.score.pdfDelta; // optional override hook your console already supports
      }
    }
  }

 const serializedWorks = JSON.stringify(worksArr, null, min ? 0 : 2);
  const serializedPF    = JSON.stringify(pf, null,   min ? 0 : 2);

  return `/** AUTO-GENERATED by praetorius generate
 * Paste into a Squarespace Code block, or host as an external JS file.
 * Source data: .prae/works.json
 */
(function(){
  var works = ${serializedWorks};

  // Ensure matching <audio> tags exist and carry data-audio attributes.
  function ensureAudioTags() {
    works.forEach(function(w){
      if(!w.audio) return;
      var id = w.audioId || ('wc-a' + String(w.id||'').trim());
      if(!id) return;
      var a = document.getElementById(id);
      if(!a){
        a = document.createElement('audio');
        a.id = id;
        a.preload = 'none';
        a.setAttribute('playsinline','');
        a.setAttribute('data-audio', w.audio);
        var host = document.querySelector('#works-console') || document.body;
        host.appendChild(a);
      } else {
        a.setAttribute('data-audio', w.audio);
      }
    });
  }

  var worksById = {};
  works.forEach(function(w){ worksById[w.id] = w; });

  // Emit page-follow maps: picked up by main.js via
  // const pageFollowMaps = (window.PRAE && window.PRAE.pageFollowMaps) || { ...fallback... };
  var pageFollowMaps = ${serializedPF};

  window.PRAE = window.PRAE || {};
  window.PRAE.works = works;
  window.PRAE.worksById = worksById;
  window.PRAE.pageFollowMaps = pageFollowMaps;
  window.PRAE.ensureAudioTags = ensureAudioTags;
  // Optional theme hint from config (non-authoritative; UI can ignore)
  window.PRAE.config = window.PRAE.config || {};
  window.PRAE.config.theme = ${JSON.stringify(opts.theme === 'light' ? 'light' : 'dark')};
  window.PRAE.config.site  = ${JSON.stringify(opts.site || {})};

  try { ensureAudioTags(); } catch(_) {}
  console.log('[prae] loaded', works.length, 'works; page-follow maps:', Object.keys(pageFollowMaps).length);
})();
`;
}

/* ------------------ schema + helpers ------------------ */
// Config schema (light) – theme + output flags
const DEFAULT_CONFIG = Object.freeze({
  theme: 'dark',
  output: { minify: false, embed: false },
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
        required: ['id','slug','title','one'],
        properties: {
          id:    { type: 'integer', minimum: 1 },
          slug:  { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          one:   { type: 'string', minLength: 1 },
          audio: { type: ['string','null'] },
          pdf:   { type: ['string','null'] },
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
    w.one   = String(w.one   ?? '').trim();
    // slug normalized
    w.slug  = slugify(w.slug || w.title || '');

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
  const fields = ['title','slug','one','audio','pdf'];
  const changed = [];
  for (const k of fields) if (String(a?.[k] ?? '') !== String(b?.[k] ?? '')) changed.push(k);
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
  return hasTitle && hasSlug && hasOne;
}
function parseMaybeJSON(s) {
  if (!s || typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch { return null; }
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
  const one = (row.one && String(row.one).trim()) || '';
  const base = {
    id: id ?? null,
    slug,
    title: String(row.title || '').trim(),
    one,
    audio: row.audio ? String(row.audio).trim() : null,
    pdf: row.pdf ? String(row.pdf).trim() : null,
    cues: Array.isArray(row.cues) ? row.cues
         : parseMaybeJSON(row.cues_json) || []
  };
  // score block via JSON or flat columns
  const scoreJSON = parseMaybeJSON(row.score_json);
  if (scoreJSON) base.score = scoreJSON;
  else if (row.pdfStartPage || row.mediaOffsetSec || row.pdfDelta || row.pageMap) {
    base.score = {
      pdfStartPage: Number(row.pdfStartPage) || 1,
      mediaOffsetSec: Number(row.mediaOffsetSec) || 0,
      ...(row.pdfDelta !== undefined ? { pdfDelta: Number(row.pdfDelta) } : {}),
      pageMap: Array.isArray(row.pageMap) ? row.pageMap : parseMaybeJSON(row.pageMap) || []
    };
  }
  return base;
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
  // deep-merge with defaults and normalize theme
  const theme = (raw.theme === 'light') ? 'light' : 'dark';
  const out   = raw.output || {};
    return {
    ...DEFAULT_CONFIG,
    theme,
    output: {
      ...DEFAULT_CONFIG.output,
      minify: !!out.minify,
      embed:  !!out.embed
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
    const normalized = {
    theme: (cfg.theme === 'light') ? 'light' : 'dark',
    output: {
      minify: !!cfg.output?.minify,
      embed:  !!cfg.output?.embed
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
  .description('Praetorius — Works Console scaffolder & wizard')
  .version(pkgJson.version || '0.0.0');

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
    `<body class="prae-theme-${theme}">`,
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
  .action(async (opts) => {
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
  .action(async (opts) => {
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
        { type: 'input', name: 'one',   message: 'One-liner / description', validate: v => !!String(v).trim() || 'Required' },
        { type: 'input', name: 'audio', message: 'Audio URL (optional; leave blank if none)' },
        { type: 'input', name: 'pdf',   message: 'Score PDF URL (optional)' },
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

      const entry = {
        id: nextId(db),
        slug: (base.slug?.trim()) || slugify(base.title),
        title: base.title,
        one: base.one,
        audio: base.audio?.trim() || null,
        pdf: base.pdf?.trim() || null,
        cues
      };
      if (score) entry.score = score;

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
      console.log(pc.cyan(`#${w.id}`) + ' ' + w.title + pc.gray(`  (${w.slug})`));
     console.log('   ' + pc.dim(w.one) + pc.gray(`   [order=${idx+1}]`));
      if (w.audio) console.log('   audio: ' + pc.gray(w.audio));
      if (w.pdf)   console.log('   pdf:   ' + pc.gray(w.pdf));
      if (w.cues?.length) {
        const cs = w.cues.map(c => `${c.label}=${c.t}s`).join(', ');
        console.log('   cues:  ' + pc.gray(cs));
      }
      if (w.score?.pageMap?.length) {
        console.log('   score: ' + pc.gray(`p1→PDF ${w.score.pdfStartPage ?? 1}, offset ${w.score.mediaOffsetSec ?? 0}s, map ${w.score.pageMap.length} rows`));
      }
    });
  });

/* ------------------ edit ------------------ */
program
  .command('edit <id>')
  .description('Edit a work (wizard by default; flags to set fields directly)')
  .option('--title <str>', 'Set title')
  .option('--slug <str>',  'Set slug')
  .option('--one <str>',   'Set one-liner')
  .option('--audio <url>', 'Set audio URL (or empty to clear)')
  .option('--pdf <url>',   'Set score PDF URL (or empty to clear)')
  .option('--no-cues',     'Do not edit cues interactively')
  .option('--no-score',    'Do not edit score/page-follow interactively')
  .action(async (id, opts) => {
    const db = loadDb();
    const { idx, work } = findById(db, id);
    if (idx < 0) { console.log(pc.red(`No work with id ${id}`)); process.exit(1); }

    // Apply direct flags first (non-interactive)
    if (opts.title) work.title = opts.title;
    if (opts.slug)  work.slug  = opts.slug;
    if (opts.one)   work.one   = opts.one;
    if ('audio' in opts) work.audio = (opts.audio === '' ? null : opts.audio);
    if ('pdf'   in opts) work.pdf   = (opts.pdf   === '' ? null : opts.pdf);

    // If no flags changed anything, run wizard
    const changedViaFlags =
      !!(opts.title || opts.slug || opts.one || 'audio' in opts || 'pdf' in opts);
    if (!changedViaFlags) {
      const base = await prompt([
        { type: 'input', name: 'title', message: 'Title', initial: work.title },
        { type: 'input', name: 'slug',  message: 'Slug',  initial: work.slug },
        { type: 'input', name: 'one',   message: 'One-liner', initial: work.one },
        { type: 'input', name: 'audio', message: 'Audio URL (blank to clear)', initial: work.audio || '' },
        { type: 'input', name: 'pdf',   message: 'Score PDF URL (blank to clear)', initial: work.pdf || '' }
      ]);
      work.title = base.title.trim();
      work.slug  = base.slug.trim();
      work.one   = base.one.trim();
      work.audio = base.audio.trim() || null;
      work.pdf   = base.pdf.trim()   || null;
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
      if (!ensureRequired(r) && !(r.title && r.slug && r.one)) {
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
      const cols = ['id','slug','title','one','audio','pdf','cues_json','score_json'];
      const lines = [];
      lines.push(cols.join(','));
      for (const w of db.works||[]) {
        const row = [
          w.id ?? '',
          (w.slug ?? '').replaceAll('"','""'),
          (w.title ?? '').replaceAll('"','""'),
          (w.one ?? '').replaceAll('"','""'),
          (w.audio ?? '').replaceAll('"','""'),
          (w.pdf ?? '').replaceAll('"','""'),
          JSON.stringify(w.cues ?? []).replaceAll('"','""'),
          JSON.stringify(w.score ?? null).replaceAll('"','""'),
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

    // config validation (theme only)
    if (!(cfg.theme === 'light' || cfg.theme === 'dark')) {
      errors.push({ type: 'config', where: 'theme', msg: 'theme must be "light" or "dark"' });
    }

    const dbOk = errors.length === 0;

    if (opts.json) {
      const report = { ok: dbOk, errors, counts: { works: db.works?.length || 0 } };
      console.log(JSON.stringify(report, null, 2));
    } else {
      if (dbOk && !opts.quiet) {
        console.log(pc.green('doctor: OK'));
        console.log(pc.gray(`works: ${db.works?.length || 0}, theme: ${cfg.theme}, minify:${cfg.output.minify}, embed:${cfg.output.embed}`));
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
  .option('--html <file>',  'template HTML filename within --ui-src', 'template.html')
  .option('--app-js <file>','UI JS output filename', 'app.js')
  .option('--app-css <file>','UI CSS output filename', 'app.css')
  .option('--no-ui',        'skip building UI (HTML/JS/CSS) even if present', false)

  .action(async (opts) => {
    const outDir = path.resolve(process.cwd(), opts.out);
    fs.mkdirSync(outDir, { recursive: true });
    const uiSrcDir = path.resolve(process.cwd(), opts.uiSrc || 'ui');
    const pkgUiDir = path.resolve(PKG_ROOT, 'ui'); // packaged starter UI (fallback)

    const buildOnce = async () => {
      const db = loadDb();
      const cfg = loadConfig();
      // Basic validation
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(WORKS_SCHEMA);
      if (!validate(db)) {
        console.log(pc.red('DB validation failed:'));
        for (const e of validate.errors || []) console.log('  - ' + e.instancePath + ' ' + e.message);
        return false;
      }
      const wantMin = !!opts.minify || !!cfg.output.minify;
            let js  = renderScriptFromDb(db, { minify: wantMin, theme: cfg.theme, site: cfg.site });
      let css = buildCssBundle();
      if (wantMin) {
        const esb = await lazyEsbuild();
        const minJS  = await esb.transform(js,  { loader:'js',  minify:true, legalComments:'none' });
        const minCSS = await esb.transform(css, { loader:'css', minify:true, legalComments:'none' });
        js  = minJS.code; css = minCSS.code;
      }
      if (opts.embed) {
        const themeClass = (loadConfig().theme === 'light') ? 'prae-theme-light' : 'prae-theme-dark';
        const prelude = `(function(){var h=document.querySelector('#works-console')||document.body;h.classList.remove('prae-theme-light','prae-theme-dark');h.classList.add('${themeClass}');})();`;
        const html = [
          '<!-- Praetorius embed: paste into a Squarespace Code block -->',
          '<style>', css, '</style>',
          '<script>', prelude, '</script>',
          '<script>', js, '</script>',
          '<script>', EMBED_RENDER, '</script>',
          ''
        ].join('\n');
        const htmlPath = path.join(outDir, 'embed.html');
        atomicWriteFile(htmlPath, html);
        console.log(pc.green('write ') + pc.dim(cwdRel(htmlPath)));
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
      if (!opts.noUi) {
        // Prefer project UI dir; fall back to packaged /ui
        const htmlName = opts.html || 'template.html';
        const candidates = [uiSrcDir, pkgUiDir];
        const uiRoot = candidates.find(d => existsFile(path.join(d, htmlName)));

        if (uiRoot) {
          const tplIn   = path.join(uiRoot, htmlName);
          const mainIn  = path.join(uiRoot, 'main.js');
          const styleIn = path.join(uiRoot, 'style.css');
          const haveTpl   = existsFile(tplIn);
          const haveMain  = existsFile(mainIn);
          const haveStyle = existsFile(styleIn);

          // haveTpl is guaranteed true here, but keep the guard for safety
          if (haveTpl) {
          // Copy/transform app.js + app.css if present
          let appJsCode = '';
          let appCssCode = '';
          if (haveMain) {
            appJsCode = fs.readFileSync(mainIn, 'utf8');
            if (wantMin) {
              const esb = await lazyEsbuild();
              appJsCode = (await esb.transform(appJsCode, { loader:'js', minify:true, legalComments:'none' })).code;
            }
            const appJsOut = path.join(outDir, opts.appJs || 'app.js');
            atomicWriteFile(appJsOut, appJsCode);
            console.log(pc.green('write ') + pc.dim(cwdRel(appJsOut)));
          }
          if (haveStyle) {
            appCssCode = fs.readFileSync(styleIn, 'utf8');
            if (wantMin) {
              const esb = await lazyEsbuild();
              appCssCode = (await esb.transform(appCssCode, { loader:'css', minify:true, legalComments:'none' })).code;
            }
            const appCssOut = path.join(outDir, opts.appCss || 'app.css');
            atomicWriteFile(appCssOut, appCssCode);
            console.log(pc.green('write ') + pc.dim(cwdRel(appCssOut)));
          }

          // Build dist/index.html by injecting links/scripts before </body>
          let html = fs.readFileSync(tplIn, 'utf8');
          const inj = [
            `<link rel="stylesheet" href="./${cssFile}">`,
            haveStyle ? `<link rel="stylesheet" href="./${opts.appCss || 'app.css'}">` : '',
            `<script src="./${jsFile}" defer></script>`,
            haveMain ? `<script type="module" src="./${opts.appJs || 'app.js'}"></script>` : ''
          ].filter(Boolean).join('\n');
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
return true; // end buildOnce success
    }; // <-- end buildOnce

    const ok = await buildOnce();
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
program.parseAsync(process.argv);
