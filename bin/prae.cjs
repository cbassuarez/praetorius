#!/usr/bin/env node
/* Praetorius CLI (prae) — v0.1
   - init, add, validate, build (single|files), preview
   - Non-destructive build: injects window.PRAE_WORKS_BY_ID + window.PRAE_PAGE_FOLLOW
     and makes src/main.js prefer them via tiny token replacements.
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Command } = require('commander');
const Ajv = require('ajv');
const pc = require('picocolors');
const { prompt } = require('enquirer');

const CWD = process.cwd();
const DATA_DIR = path.join(CWD, 'data');
const SRC_DIR  = path.join(CWD, 'src');
const DIST_DIR = path.join(CWD, 'dist');

const FILE_SCHEMA = path.join(DATA_DIR, 'works.schema.json');
const FILE_DATA   = path.join(DATA_DIR, 'works.json');
const FILE_MAINJS = path.join(SRC_DIR, 'main.js');
const FILE_STYLES = path.join(SRC_DIR, 'styles.css'); // adjust if different

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, {recursive:true}); }
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function writeJson(p, obj){ ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }
function readText(p, fallback=''){ try{ return fs.readFileSync(p,'utf8'); }catch{ return fallback; } }
function writeText(p, s){ ensureDir(path.dirname(p)); fs.writeFileSync(p, s); }
function logOK(msg){ console.log(pc.green('✔ ') + msg); }
function logWarn(msg){ console.log(pc.yellow('• ') + msg); }
function logErr(msg){ console.error(pc.red('✖ ') + msg); process.exitCode = 1; }
function die(msg){ console.error(pc.red('✖ ') + msg); process.exit(1); }

// --- Time helpers ---
function parseTimeToSec(s){
  if(typeof s === 'number') return Math.max(0, Math.floor(s));
  const str = String(s||'').trim();
  if(/^\d+$/.test(str)) return parseInt(str,10);
  const m = str.match(/^(\d+):([0-5]?\d)$/);
  if(!m) return NaN;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}
function secToLabel(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60), s = sec % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

// --- Normalization & build data ---
function normalizeData(raw){
  // clone
  const data = JSON.parse(JSON.stringify(raw));

  // works array → worksById object
  const worksById = {};
  const pageFollow = {};

  // basic uniqueness checks
  const seenId = new Set();
  const seenSlug = new Set();

  for(const w of data.works){
    if(seenId.has(w.id)) die(`Duplicate work id ${w.id}`);
    if(seenSlug.has(w.slug)) die(`Duplicate slug "${w.slug}"`);
    seenId.add(w.id); seenSlug.add(w.slug);

    // normalize cues
    if(Array.isArray(w.cues)){
      w.cues = w.cues.map(c=>{
        const at = parseTimeToSec(c.at);
        if(Number.isNaN(at)) die(`Invalid cue time "${c.at}" in work ${w.id}`);
        return { label: c.label || `@${secToLabel(at)}`, t: at };
      }).sort((a,b)=> a.t - b.t);
    } else {
      w.cues = [];
    }

    // direct drive url for audio (optional; runtime also handles it)
    if (w.audioUrl && /https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//.test(w.audioUrl)) {
      const id = w.audioUrl.match(/\/d\/([^/]+)\//)[1];
      w.audioUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    }

    // collect pageFollow map per slug
    if(w.pageFollow && w.pdfUrl){
      const cfg = {
        pdfStartPage: Math.max(1, parseInt(w.pageFollow.pdfStartPage||1,10)),
        mediaOffsetSec: parseInt(w.pageFollow.mediaOffsetSec||0,10),
        pageMap: []
      };
      for(const row of (w.pageFollow.pageMap||[])){
        const at = parseTimeToSec(row.at);
        if(Number.isNaN(at)) die(`Invalid pageFollow time "${row.at}" in work ${w.id}`);
        cfg.pageMap.push({ at, page: Math.max(1, parseInt(row.page,10)) });
      }
      // ascending checks
      for(let i=1;i<cfg.pageMap.length;i++){
        if(cfg.pageMap[i].at < cfg.pageMap[i-1].at){
          die(`pageFollow times must be ascending in work ${w.id}`);
        }
      }
      pageFollow[w.slug] = cfg;
    }

    // shape for runtime (by id)
    worksById[w.id] = {
      id: w.id,
      slug: w.slug,
      title: w.title,
      one: w.one,
      openNote: w.openNote || [],
      cues: w.cues,           // already normalized (t: seconds)
      audioId: `wc-a${w.id}`, // your runtime uses wc-a1, wc-a2, ...
      pdf: w.pdfUrl || null
    };
  }

  return { meta: data.meta || {}, worksById, pageFollow, worksArray: data.works };
}

// --- Build (single-block or files) ---
function transformMainForOverrides(src){
  // 1) Make works prefer window.PRAE_WORKS_BY_ID
  src = src.replace(/const\s+works\s*=\s*{/, 'const works = (window.PRAE_WORKS_BY_ID) || {');

  // 2) Make pageFollowMaps prefer window.PRAE_PAGE_FOLLOW
  src = src.replace(/const\s+pageFollowMaps\s*=\s*{/, 'const pageFollowMaps = (window.PRAE_PAGE_FOLLOW) || {');

  return src;
}

function buildSingleBlock({styles, dataJs, mainJs}){
  return [
    '<style>',
    styles.trim(),
    '</style>',
    '',
    '<script>',
    dataJs.trim(),
    '</script>',
    '',
    '<script>',
    mainJs.trim(),
    '</script>'
  ].join('\n');
}

function makeDataJS({meta, worksById, pageFollow}){
  // NOTE: we also emit a helper array for building audio tags if desired later
  return [
    '(function(){',
    '  window.PRAE_META = ' + JSON.stringify(meta) + ';',
    '  window.PRAE_WORKS_BY_ID = ' + JSON.stringify(worksById) + ';',
    '  window.PRAE_PAGE_FOLLOW = ' + JSON.stringify(pageFollow) + ';',
    '})();'
  ].join('\n');
}

// --- Preview server (uses built files) ---
function startPreviewServer(port=5173){
  const app = express();
  ensureDir(DIST_DIR);

  // minimal index that mounts your template + dist assets
  app.get('/', (req,res)=>{
    const tpl = readText(path.join(SRC_DIR,'template.html'), '<section id="works-group"></section>');
    // Inject file references just before closing body/section is fine in your template
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '  <meta charset="utf-8"/>',
      '  <meta name="viewport" content="width=device-width,initial-scale=1"/>',
      '  <title>Praetorius Preview</title>',
      '  <link rel="stylesheet" href="/dist/works.css"/>',
      '</head>',
      '<body>',
      tpl,
      '  <script src="/dist/works.js"></script>',
      '</body>',
      '</html>'
    ].join('\n');
    res.set('content-type','text/html; charset=utf-8').send(html);
  });

  app.use('/dist', express.static(DIST_DIR));

  const server = http.createServer(app);
  server.listen(port, ()=> console.log(pc.cyan(`Preview running → http://localhost:${port}`)));
}

// --- Validation ---
function validateData(obj){
  const schema = readJson(FILE_SCHEMA);
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  const ok = validate(obj);
  if(!ok){
    console.error(pc.red('Schema errors:'));
    for(const err of validate.errors){
      console.error('  •', err.instancePath || '(root)', '-', err.message);
    }
    return false;
  }
  // Logical rules
  const ids = new Set(); const slugs = new Set();
  for(const w of obj.works){
    if(ids.has(w.id)) { logErr(`Duplicate id ${w.id}`); return false; }
    if(slugs.has(w.slug)) { logErr(`Duplicate slug ${w.slug}`); return false; }
    ids.add(w.id); slugs.add(w.slug);

    // Ascending cues
    if(Array.isArray(w.cues)){
      let prev = -1;
      for(const c of w.cues){
        const t = parseTimeToSec(c.at);
        if(Number.isNaN(t)) { logErr(`Invalid cue time "${c.at}" in work ${w.id}`); return false; }
        if(t < prev) { logErr(`Cues not ascending in work ${w.id}`); return false; }
        prev = t;
      }
    }

    // pageFollow presence implies pdfUrl
    if(w.pageFollow && !w.pdfUrl){
      logErr(`Work ${w.id} has pageFollow but no pdfUrl`); return false;
    }
  }
  return true;
}

// --- CLI wiring ---
const program = new Command();
program.name('prae').description('Praetorius CLI (data → runtime builder)').version('0.1.0');

program
  .command('init')
  .description('Create data directory, schema, and starter works.json')
  .action(()=>{
    ensureDir(DATA_DIR);
    if(!fs.existsSync(FILE_SCHEMA)){
      writeText(FILE_SCHEMA, readText(FILE_SCHEMA) || JSON.stringify(readJson(path.join(__dirname,'..','data','works.schema.json') ), null, 2));
    }
    if(!fs.existsSync(FILE_DATA)){
      writeText(FILE_DATA, readText(FILE_DATA) || JSON.stringify(readJson(path.join(__dirname,'..','data','works.json') ), null, 2));
    }
    ensureDir(DIST_DIR);
    logOK('Initialized /data and /dist.');
  });

program
  .command('add')
  .description('Interactively add a new work to data/works.json')
  .action(async ()=>{
    const data = readJson(FILE_DATA);
    const nextId = Math.max(0, ...data.works.map(w=>w.id)) + 1;
    const answers = await prompt([
      { name:'title', message:'Title', type:'input', required:true },
      { name:'slug', message:'Slug (kebab-case)', type:'input', required:true, initial: (data.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') },
      { name:'one', message:'One-line blurb', type:'input', required:true },
      { name:'audioUrl', message:'Audio URL (optional)', type:'input' },
      { name:'pdfUrl', message:'PDF URL (optional)', type:'input' }
    ]);
    const w = {
      id: nextId,
      slug: answers.slug,
      title: answers.title,
      one: answers.one,
      openNote: [],
      audioUrl: answers.audioUrl || null,
      pdfUrl: answers.pdfUrl || null,
      cues: []
    };
    data.works.push(w);
    writeJson(FILE_DATA, data);
    logOK(`Added work #${w.id} "${w.title}". Run "${pc.bold('prae validate')}" then "${pc.bold('prae build --variant single')}".`);
  });

program
  .command('validate')
  .description('Validate data/works.json against schema and logical rules')
  .action(()=>{
    const data = readJson(FILE_DATA);
    if(validateData(data)){ logOK('Validation passed.'); }
    else { die('Validation failed.'); }
  });

program
  .command('build')
  .description('Build exports')
  .option('--variant <mode>', 'single | files', 'single')
  .action((opts)=>{
    const variant = (opts.variant||'single').toLowerCase();
    const raw = readJson(FILE_DATA);
    if(!validateData(raw)) die('Validation failed. Aborting build.');

    const norm = normalizeData(raw);
    const styles = readText(FILE_STYLES, '/* (no styles.css found) */');
    const mainSrc = readText(FILE_MAINJS);
    if(!mainSrc) die('src/main.js not found.');

    const transformed = transformMainForOverrides(mainSrc);
    const dataJs = makeDataJS(norm);

    ensureDir(DIST_DIR);

    if(variant === 'single'){
      const txt = buildSingleBlock({ styles, dataJs, mainJs: transformed });
      writeText(path.join(DIST_DIR, 'works.single-block.txt'), txt);
      logOK('Built dist/works.single-block.txt (paste into one Squarespace Code Block).');
    } else if(variant === 'files'){
      writeText(path.join(DIST_DIR, 'works.css'), styles);
      writeText(path.join(DIST_DIR, 'works.js'), [dataJs, '\n', transformed].join('\n'));
      logOK('Built dist/works.css and dist/works.js');
    } else {
      die('Unknown variant. Use "single" or "files".');
    }
  });

program
  .command('preview')
  .description('Serve a local preview using the built files variant')
  .option('--port <n>', 'port', '5173')
  .action((opts)=>{
    // ensure files exist; build files variant on the fly
    program.emit('command:build', { variant: 'files' }); // Commander trick won't fire action; do manual:
    const raw = readJson(FILE_DATA);
    if(!validateData(raw)) die('Validation failed. Aborting preview.');
    const norm = normalizeData(raw);
    const styles = readText(FILE_STYLES, '/* (no styles.css found) */');
    const mainSrc = readText(FILE_MAINJS);
    if(!mainSrc) die('src/main.js not found.');
    const transformed = transformMainForOverrides(mainSrc);
    const dataJs = makeDataJS(norm);
    writeText(path.join(DIST_DIR, 'works.css'), styles);
    writeText(path.join(DIST_DIR, 'works.js'), [dataJs, '\n', transformed].join('\n'));

    startPreviewServer(parseInt(opts.port,10) || 5173);
  });

program.parse(process.argv);
