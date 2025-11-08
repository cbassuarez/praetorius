// src/cli/doctor.js
// Doctor++: URL checks for audio/pdf + Drive normalization + CORS hints
// Node ≥18 has global fetch. Zero deps.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FRIENDLY_PDF_CORS_HOSTS = [
  /(^|\.)jsdelivr\.net$/i,
  /(^|\.)unpkg\.com$/i,
  /(^|\.)raw\.githubusercontent\.com$/i,
  /(^|\.)cloudflare-ipfs\.com$/i,
  /(^|\.)stagedevices\.com$/i,
  /(^|\.)dexdsl\.org$/i,
  /(^|\.)cbassuarez\.com$/i,
];

const DRIVE_RX = /https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//i;

export async function doctor(argv = []) {
  const flags = parseFlags(argv);
  const ctx = { offline: flags.offline, timeout: flags.timeout };

  const { audioUrls, pdfUrls, sources } = await collectTargets();
  const tasks = [
    ...audioUrls.map(u => ({ url: u, kind: 'audio' })),
    ...pdfUrls.map(u => ({ url: u, kind: 'pdf' })),
  ];

  logHead(`prae doctor — checking ${audioUrls.length} audio, ${pdfUrls.length} pdf`);
  if (ctx.offline) info('offline mode — skipping network checks');

  let errors = 0, warns = 0;
  for await (const r of runChecks(tasks, ctx)) {
    const { level, msg } = r;
    if (level === 'ERROR') { errors++; error(msg); }
    else if (level === 'WARN') { warns++; warn(msg); }
    else ok(msg);
  }

  // Google Drive normalization hints
  for (const u of tasks.map(t => t.url).filter(u => DRIVE_RX.test(u))) {
    const id = u.match(DRIVE_RX)[1];
    const direct = `https://drive.google.com/uc?export=download&id=${id}`;
    hint(`Drive viewer link detected. Prefer direct stream: ${direct}`);
    if (!ctx.offline) {
      const head = await tryHead(direct, ctx.timeout);
      if (!head.ok) warn(`Direct Drive link test failed (${head.note}); large files may require re-hosting.`);
    }
  }

  // PDF CORS pitfalls
  if (!ctx.offline) {
    for (const u of pdfUrls) {
      const h = await tryHead(u, ctx.timeout);
      const host = hostname(u);
      if (!h.ok) {
        warn(`pdf ${short(u)} — HEAD failed (${h.note}). Viewer may still load via browser plugin, but PDF.js may not.`);
        continue;
      }
      const aco = h.headers.get('access-control-allow-origin');
      const friendly = FRIENDLY_PDF_CORS_HOSTS.some(rx => rx.test(host));
      if (!aco && !friendly) {
        warn(`pdf ${short(u)} — No Access-Control-Allow-Origin header from ${host}. PDF.js (cross-origin) may fail; consider same-origin hosting or a CORS-friendly CDN.`);
      }
    }
  } else {
    hint('CORS checks skipped in offline mode.');
  }

  // Summary
  if (errors || warns) {
    logTail(`doctor finished — ${errors} error(s), ${warns} warn(s)`);
  } else {
    logTail('doctor finished — all checks passed');
  }

  // Exit code contract: errors → non-zero
  if (flags.exit !== false && errors > 0) process.exitCode = 1;

  // Extra context for other tooling
  return { errors, warns, sources };
}

/* ---------------- helpers ---------------- */

function parseFlags(argv) {
  const out = { offline: false, timeout: 4500, exit: true };
  for (const a of argv) {
    if (a === '--offline') out.offline = true;
    else if (a.startsWith('--timeout=')) out.timeout = clampInt(a.split('=')[1], 1500, 15000, 4500);
    else if (a === '--no-exit') out.exit = false;
  }
  return out;
}

function clampInt(v, lo, hi, dft) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dft;
}

async function collectTargets() {
  // Conservative: scrape dist/index.html for <audio ... data-audio|src="">
  // and dist/script.js for `pdf: "..."` occurrences.
  const htmlPath = resolve('dist/index.html');
  const jsPath   = resolve('dist/script.js');

  let html = ''; let js = '';
  try { html = await readFile(htmlPath, 'utf8'); } catch {}
  try { js   = await readFile(jsPath, 'utf8'); } catch {}

  const audioUrls = [];
  if (html) {
    const rx = /<audio\b[^>]*?(?:data-audio|src)\s*=\s*"(.*?)"[^>]*?>/ig;
    let m; while ((m = rx.exec(html))) pushIfUrl(audioUrls, m[1]);
  }
  const pdfUrls = [];
  if (js) {
    const rx = /\bpdf\s*:\s*["']([^"']+)["']/ig;
    let m; while ((m = rx.exec(js))) pushIfUrl(pdfUrls, m[1]);
  }
  return {
    audioUrls: uniq(audioUrls),
    pdfUrls:   uniq(pdfUrls),
    sources: { htmlFound: html.length > 0, jsFound: js.length > 0 }
  };
}

function pushIfUrl(arr, v) {
  if (!v) return;
  const s = String(v).trim();
  if (/^https?:\/\//i.test(s)) arr.push(s);
}

function uniq(a) { return Array.from(new Set(a)); }
function hostname(u) { try { return new URL(u).hostname; } catch { return 'unknown'; } }
function short(u) { try { const x = new URL(u); return x.hostname + x.pathname; } catch { return u; } }

async function* runChecks(tasks, ctx) {
  for (const t of tasks) {
    if (ctx.offline) {
      yield { level: 'INFO', msg: `${t.kind} ${short(t.url)} — skipped (offline)` };
      continue;
    }
    const res = await tryHead(t.url, ctx.timeout);
    if (!res.ok) {
      yield { level: 'ERROR', msg: `${t.kind} ${short(t.url)} — ${res.note}` };
      continue;
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (t.kind === 'audio' && !/^audio\//.test(ct) && !/octet-stream/.test(ct)) {
      yield { level: 'WARN', msg: `audio ${short(t.url)} — content-type "${ct || 'unknown'}" (server may not set audio/*)` };
    } else if (t.kind === 'pdf' && !/application\/pdf/.test(ct) && !/octet-stream/.test(ct)) {
      yield { level: 'WARN', msg: `pdf ${short(t.url)} — content-type "${ct || 'unknown'}" (PDF viewers may mis-detect)` };
    } else {
      const len = humanSize(res.headers.get('content-length'));
      yield { level: 'INFO', msg: `${t.kind} ${short(t.url)} — OK ${ct || ''}${len ? ` · ${len}` : ''}` };
    }
  }
}

async function tryHead(url, timeoutMs) {
  const note = n => ({ ok: false, note: n, headers: new Headers() });
  try {
    const res = await timedFetch(url, { method: 'HEAD', redirect: 'follow' }, timeoutMs);
    if (res.ok) return { ok: true, headers: res.headers };
    // Some CDNs/hosts reject HEAD; fall back to Range GET
    if (res.status === 405 || res.status === 501) {
      const g = await timedFetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' }, timeoutMs);
      return g.ok ? { ok: true, headers: g.headers } : note(`GET(range) ${g.status}`);
    }
    return note(`HEAD ${res.status}`);
  } catch (e) {
    return note(e?.message || 'network error');
  }
}

async function timedFetch(u, init, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(new Error('timeout')), ms);
  try { return await fetch(u, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

function humanSize(len) {
  const n = Number(len);
  if (!Number.isFinite(n) || n <= 0) return '';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= k && i < units.length - 1) { v /= k; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/* pretty loggers */
function ok(s)    { console.log(`\x1b[32mOK\x1b[0m    ${s}`); }
function warn(s)  { console.warn(`\x1b[33mWARN\x1b[0m  ${s}`); }
function error(s) { console.error(`\x1b[31mERROR\x1b[0m ${s}`); }
function info(s)  { console.log(`\x1b[36mINFO\x1b[0m  ${s}`); }
function hint(s)  { console.log(`\x1b[35mHINT\x1b[0m  ${s}`); }
function logHead(s){ console.log(`\n\x1b[1m${s}\x1b[0m`); }
function logTail(s){ console.log(`\x1b[1m${s}\x1b[0m\n`); }
