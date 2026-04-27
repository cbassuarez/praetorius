import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const CLI_TIMEOUT_MS = 60_000;

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let received = 0;
    let body = '';
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(new Error('Request body exceeds size limit.'));
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => resolve(safeJsonParse(body)));
    req.on('error', reject);
  });
}

function json(res, statusCode, payload) {
  const text = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

function stripPrefix(urlPath, basePath) {
  if (!basePath || basePath === '/') return urlPath;
  if (urlPath === basePath) return '/';
  if (urlPath.startsWith(`${basePath}/`)) return urlPath.slice(basePath.length) || '/';
  return urlPath;
}

function parseTimeToSeconds(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  const raw = String(input || '').trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(':').map((part) => Number(part));
  if (parts.some((v) => !Number.isFinite(v))) return 0;
  if (parts.length === 2) return Math.max(0, Math.floor(parts[0] * 60 + parts[1]));
  if (parts.length === 3) return Math.max(0, Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]));
  return 0;
}

function toTimeLabel(value) {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function sanitizeCueRows(input) {
  const list = Array.isArray(input) ? input : [];
  const rows = list
    .map((row) => {
      const t = parseTimeToSeconds(row?.t ?? row?.time ?? row?.at);
      return { label: String(row?.label || `@${toTimeLabel(t)}`), t };
    })
    .filter((row) => row.label || Number.isFinite(row.t));
  return rows.length ? rows : [{ label: '@0:00', t: 0 }];
}

function sanitizeScore(input) {
  if (!input || typeof input !== 'object') return undefined;
  const out = {};
  if (Number.isFinite(Number(input.pdfStartPage))) out.pdfStartPage = Math.max(1, Math.floor(Number(input.pdfStartPage)));
  if (Number.isFinite(Number(input.mediaOffsetSec))) out.mediaOffsetSec = Math.floor(Number(input.mediaOffsetSec));
  if (Number.isFinite(Number(input.pdfDelta))) out.pdfDelta = Math.floor(Number(input.pdfDelta));
  const map = Array.isArray(input.pageMap)
    ? input.pageMap
        .map((row) => {
          const atRaw = row?.at ?? row?.time ?? row?.t;
          const at = typeof atRaw === 'number' ? Math.max(0, Math.floor(atRaw)) : (String(atRaw || '').trim() || '0:00');
          const page = Math.max(1, Number(row?.page) || 1);
          return { at, page };
        })
        .filter((row) => row.at !== '')
    : [];
  if (map.length) out.pageMap = map;
  return Object.keys(out).length ? out : undefined;
}

function sanitizeWorkRecord(input, index) {
  const src = input && typeof input === 'object' ? input : {};
  const idCandidate = Number(src.id);
  const id = Number.isInteger(idCandidate) && idCandidate > 0 ? idCandidate : index + 1;
  const title = String(src.title || src.slug || `Work ${id}`).trim() || `Work ${id}`;
  const slugRaw = String(src.slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = slugRaw || `work-${id}`;
  const onelinerRaw = src.oneliner ?? src.one ?? src.onelinerEffective ?? '';
  const oneliner = String(onelinerRaw || '').replace(/\r?\n+/g, ' ').trim();
  const out = { id, slug, title, oneliner: oneliner || 'Untitled work.' };
  const description = src.description ?? src.descriptionEffective ?? src.desc ?? null;
  if (description != null && description !== '') out.description = description;
  if (src.audio != null) out.audio = src.audio === '' ? null : String(src.audio);
  if (src.pdf != null) out.pdf = src.pdf === '' ? null : String(src.pdf);
  if (src.cover != null) out.cover = src.cover === '' ? null : String(src.cover);
  if (Array.isArray(src.tags)) out.tags = src.tags.map((tag) => String(tag).trim()).filter(Boolean);
  out.cues = sanitizeCueRows(src.cues);
  const score = sanitizeScore(src.score);
  if (score) out.score = score;
  return out;
}

function sanitizeWorkDb(input) {
  const works = Array.isArray(input?.works) ? input.works.map((work, index) => sanitizeWorkRecord(work, index)) : [];
  return {
    version: Number.isFinite(Number(input?.version)) ? Number(input.version) : 1,
    works,
  };
}

function sanitizeConfig(input) {
  const cfg = input && typeof input === 'object' ? input : {};
  return {
    theme: cfg.theme === 'light' ? 'light' : 'dark',
    output: { minify: !!cfg.output?.minify, embed: !!cfg.output?.embed },
    ui: {
      skin: String(cfg.ui?.skin || 'cards-tabs'),
      allowUrlOverride: cfg.ui?.allowUrlOverride !== false,
      appearance: cfg.ui?.appearance || {},
      branding: cfg.ui?.branding || { attribution: { enabled: true } },
    },
    site: cfg.site || {},
  };
}

function sanitizeDocsConfig(input) {
  return input && typeof input === 'object'
    ? input
    : {
        site: { title: '', subtitle: '', description: '', accent: '' },
        sources: { globs: ['docs/**/*.md'], includeReadme: true },
        search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
        paths: { root: 'docs/', homepage: '' },
      };
}

function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function escapeMd(input) {
  return String(input || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^---$/gm, '\\---');
}

function buildPageMarkdown(page) {
  const title = String(page?.title || page?.hero?.title || 'Untitled');
  const slug = String(page?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/(^-|-$)/g, '') || 'page';
  const hero = page?.hero || {};
  const lines = [];
  lines.push('---');
  lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
  lines.push(`slug: "${slug.replace(/"/g, '\\"')}"`);
  if (hero?.kicker) lines.push(`kicker: "${String(hero.kicker).replace(/"/g, '\\"')}"`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${escapeMd(hero?.title || title)}`);
  if (hero?.lede) {
    lines.push('');
    lines.push(escapeMd(String(hero.lede)));
  }
  const modules = Array.isArray(page?.modules) ? page.modules : [];
  for (const module of modules) {
    const type = String(module?.type || 'module');
    const moduleTitle = String(module?.title || type);
    lines.push('');
    lines.push(`## ${escapeMd(moduleTitle)}`);
    lines.push('');
    lines.push(`_Type: ${type}_`);
    if (type === 'score') {
      if (module?.pdf) lines.push('', `Score PDF: ${String(module.pdf)}`);
      if (module?.audio) lines.push('', `Audio: ${String(module.audio)}`);
      const cues = Array.isArray(module?.cues) ? module.cues : [];
      if (cues.length) {
        lines.push('', 'Cues:');
        cues.forEach((cue) => {
          const rawTime = cue?.t;
          const t = typeof rawTime === 'number' ? toTimeLabel(rawTime) : String(rawTime || '0:00');
          lines.push(`- ${String(cue?.label || '@0:00')} (${t})`);
        });
      }
    } else if (type === 'media') {
      const items = Array.isArray(module?.items) ? module.items : [];
      if (items.length) {
        lines.push('', 'Media:');
        items.forEach((item) => {
          const caption = item?.caption ? ` — ${String(item.caption)}` : '';
          lines.push(`- ${String(item?.alt || 'media')}: ${String(item?.src || '')}${caption}`);
        });
      }
    } else if (type === 'process') {
      const steps = Array.isArray(module?.steps) ? module.steps : [];
      if (steps.length) {
        lines.push('', 'Process steps:');
        steps.forEach((step, i) => {
          lines.push(`- ${i + 1}. ${String(step?.title || 'Step')}`);
          if (step?.body) lines.push(`  ${String(step.body)}`);
          if (step?.media) lines.push(`  Media: ${String(step.media)}`);
        });
      }
    } else if (type === 'credits') {
      const roles = Array.isArray(module?.roles) ? module.roles : [];
      if (roles.length) {
        lines.push('', 'Credits:');
        roles.forEach((role) => {
          const people = Array.isArray(role?.people) ? role.people.join(', ') : '';
          lines.push(`- ${String(role?.role || 'Role')}: ${people}`);
        });
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function writeProjectFiles(tmpRoot, request) {
  const project = request.project || {};
  const config = sanitizeConfig(project.config);
  const worksDb = sanitizeWorkDb(project.worksDb);
  const docsConfig = sanitizeDocsConfig(project.docsConfig);
  const docsPages = Array.isArray(project.docsPages) ? project.docsPages : [];

  const praeDir = path.join(tmpRoot, '.prae');
  await fsp.mkdir(praeDir, { recursive: true });
  await fsp.writeFile(path.join(praeDir, 'config.json'), stringifyJson(config), 'utf8');
  await fsp.writeFile(path.join(praeDir, 'works.json'), stringifyJson(worksDb), 'utf8');
  await fsp.writeFile(path.join(praeDir, 'docs.json'), stringifyJson(docsConfig), 'utf8');

  const docsDir = path.join(tmpRoot, 'docs');
  await fsp.mkdir(docsDir, { recursive: true });

  const pages = docsPages.length
    ? docsPages
    : [{ id: 'overview', slug: 'index', title: 'Overview', hero: { title: 'Overview', lede: '' }, modules: [] }];
  const paths = [];
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const slug = String(page?.slug || page?.id || `page-${i + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `page-${i + 1}`;
    const fileName = i === 0 ? 'index.md' : `${slug}.md`;
    const absolute = path.join(docsDir, fileName);
    await fsp.writeFile(absolute, buildPageMarkdown(page), 'utf8');
    paths.push(`docs/${fileName}`);
  }

  if (paths.length) {
    const nav = paths.map((entry) => `- [${entry.replace('docs/', '').replace('.md', '')}](${entry})`).join('\n');
    await fsp.writeFile(path.join(tmpRoot, 'README.md'), `# Praetorius Builder Project\n\n${nav}\n`, 'utf8');
  }
}

async function runCli(repoRoot, cwd, argv) {
  const cliPath = path.join(repoRoot, 'src/cli/index.js');
  return withTimeout(
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath, ...argv], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
      child.on('error', reject);
      child.on('close', (code) => { resolve({ code: code ?? 1, stdout, stderr }); });
    }),
    CLI_TIMEOUT_MS,
    `CLI generate timed out after ${CLI_TIMEOUT_MS / 1000} seconds.`,
  );
}

async function collectOutputManifest(outDir) {
  const files = [];
  const textFiles = {};
  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(outDir, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) { await walk(abs); continue; }
      files.push(rel);
      const ext = path.extname(entry.name).toLowerCase();
      const isText = ['.html', '.js', '.css', '.json', '.svg', '.txt', '.md'].includes(ext);
      if (!isText) continue;
      try { textFiles[rel] = await fsp.readFile(abs, 'utf8'); } catch { /* ignore */ }
    }
  }
  await walk(outDir);
  files.sort();
  return { files, textFiles };
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

const HEIGHT_POSTER_SCRIPT = `<script>(function(){
  if (window.__praeHeightPoster) return;
  window.__praeHeightPoster = true;
  function neutralizeViewportMinHeight() {
    // Skin CSS often sets 100vh / 100dvh / 100% min-heights on html/body/wrappers
    // which combined with auto-resize creates a feedback loop. Reset them so
    // scrollHeight reflects the natural content size.
    var doc = document.documentElement;
    var body = document.body;
    if (doc) {
      doc.style.setProperty('min-height', '0', 'important');
      doc.style.setProperty('height', 'auto', 'important');
      doc.style.setProperty('overflow', 'hidden', 'important');
    }
    if (body) {
      body.style.setProperty('min-height', '0', 'important');
      body.style.setProperty('height', 'auto', 'important');
      body.style.margin = '0';
    }
  }
  function measure() {
    neutralizeViewportMinHeight();
    var body = document.body;
    if (!body) return 0;
    var max = 0;
    var children = body.children || [];
    for (var i = 0; i < children.length; i += 1) {
      var rect = children[i].getBoundingClientRect();
      if (rect.bottom > max) max = rect.bottom;
    }
    return Math.max(max, body.scrollHeight, body.offsetHeight);
  }
  function send() {
    try {
      window.parent.postMessage({ type: 'prae:height', value: measure() }, '*');
    } catch (_) { /* ignore */ }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(send, 0);
  } else {
    window.addEventListener('DOMContentLoaded', send);
  }
  window.addEventListener('load', send);
  setTimeout(send, 200);
  setTimeout(send, 800);
  setTimeout(send, 2000);
  try {
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function(){ send(); });
      if (document.body) ro.observe(document.body);
    }
  } catch (_) { /* ignore */ }
  try {
    if (typeof MutationObserver === 'function' && document.body) {
      var mo = new MutationObserver(function(){ send(); });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    }
  } catch (_) { /* ignore */ }
})();</script>`;

async function readHtmlWithHeightPoster(target) {
  const text = await fsp.readFile(target, 'utf8');
  if (text.includes('window.__praeHeightPoster')) return text;
  if (text.includes('</body>')) return text.replace('</body>', `${HEIGHT_POSTER_SCRIPT}</body>`);
  return `${text}\n${HEIGHT_POSTER_SCRIPT}`;
}

export function createBuilderHandler(options) {
  const repoRoot = options.repoRoot;
  const basePath = options.basePath || '/';
  const sessions = new Map();

  const cleanupExpired = async () => {
    const now = Date.now();
    for (const [id, entry] of sessions.entries()) {
      if (entry.expiresAt > now) continue;
      sessions.delete(id);
      try { await fsp.rm(entry.rootDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  };

  return async function handleRequest(req, res) {
    if (!req.url) return false;
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const pathnameRaw = stripPrefix(parsedUrl.pathname, basePath);
    const pathname = pathnameRaw.replace(/\/+$/, '') || '/';

    if (!pathname.startsWith('/__prae_builder')) return false;

    await cleanupExpired();

    if (pathname === '/__prae_builder/health' && req.method === 'GET') {
      json(res, 200, { ok: true, mode: 'cli-bridge' });
      return true;
    }

    if (pathname === '/__prae_builder/generate' && req.method === 'POST') {
      const payload = await parseRequestBody(req);
      if (!payload || typeof payload !== 'object') {
        json(res, 400, { ok: false, error: 'Invalid JSON payload.' });
        return true;
      }
      const reqGenerate = payload.generate || {};
      const outDirName = 'dist';
      const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'prae-builder-api-'));
      const outDir = path.join(tmpRoot, outDirName);

      try {
        await writeProjectFiles(tmpRoot, payload);
        const argv = ['generate', '--out', outDirName, '--skin', String(reqGenerate.skin || 'cards-tabs')];
        argv.push('--ui-runtime', String(reqGenerate.uiRuntime || 'react'));
        if (reqGenerate.embed) argv.push('--embed');
        if (reqGenerate.noUi) argv.push('--no-ui');
        if (reqGenerate.noCss) argv.push('--no-css');
        if (reqGenerate.minify) argv.push('--minify');

        const result = await runCli(repoRoot, tmpRoot, argv);
        if (result.code !== 0) {
          json(res, 400, {
            ok: false,
            error: 'CLI generate failed.',
            code: result.code,
            output: `${result.stdout}\n${result.stderr}`.trim(),
          });
          await fsp.rm(tmpRoot, { recursive: true, force: true });
          return true;
        }

        const token = randomUUID();
        const now = Date.now();
        sessions.set(token, { id: token, rootDir: tmpRoot, outDir, createdAt: now, expiresAt: now + SESSION_TTL_MS });

        const manifest = await collectOutputManifest(outDir);
        const fileList = manifest.files;
        const previewUrl = fileList.includes('index.html') ? `/__prae_builder/preview/${token}/index.html` : '';

        json(res, 200, {
          ok: true,
          token,
          previewUrl,
          files: fileList,
          textFiles: manifest.textFiles,
          embedHtml: manifest.textFiles['embed.html'] || '',
          output: `${result.stdout}\n${result.stderr}`.trim(),
          expiresInMs: SESSION_TTL_MS,
        });
      } catch (error) {
        try { await fsp.rm(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
        json(res, 500, { ok: false, error: error?.message || String(error) });
      }
      return true;
    }

    if (pathname.startsWith('/__prae_builder/preview/') && req.method === 'GET') {
      const chunks = pathname.split('/').filter(Boolean);
      const token = chunks[2] || '';
      const entry = sessions.get(token);
      if (!entry) { res.statusCode = 404; res.end('Not found'); return true; }
      const relative = chunks.slice(3).join('/') || 'index.html';
      const target = path.resolve(entry.outDir, relative);
      if (!target.startsWith(entry.outDir)) { res.statusCode = 403; res.end('Forbidden'); return true; }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.statusCode = 404; res.end('Not found'); return true; }
      const mime = guessMime(target);
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);
      if (mime.startsWith('text/html')) {
        const html = await readHtmlWithHeightPoster(target);
        res.end(html);
      } else {
        fs.createReadStream(target).pipe(res);
      }
      return true;
    }

    if (pathname.startsWith('/__prae_builder/close/') && req.method === 'POST') {
      const chunks = pathname.split('/').filter(Boolean);
      const token = chunks[2] || '';
      const entry = sessions.get(token);
      if (entry) {
        sessions.delete(token);
        try { await fsp.rm(entry.rootDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
      json(res, 200, { ok: true });
      return true;
    }

    res.statusCode = 404;
    res.end('Not found');
    return true;
  };
}
