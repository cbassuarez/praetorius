import { normalizeWork, collectWorkWarnings, normalizeCoverUrl } from '../work-model.js';

export const APPEARANCE_PALETTES = Object.freeze([
  'ryb-tricolor',
  'mono-bw',
  'mono-one',
  'gem-diamond',
  'orange-blue-white-silver',
]);

export const CURSOR_PRESETS = Object.freeze(['system', 'block-square', 'ring', 'prism-diamond']);
export const EFFECT_PRESETS = Object.freeze(['minimal', 'balanced-neo', 'high-drama']);

export const BUILTIN_SKINS = Object.freeze([
  'console',
  'vite-breeze',
  'cards-tabs',
  'kiosk',
  'docs-reader',
  'typefolio',
  'typescatter',
]);

const REACT_SUPPORTED_SKINS = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);
const EMBED_VANILLA_ONLY_SKINS = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);

const DEFAULT_APPEARANCE = Object.freeze({
  theme: {
    palette: 'orange-blue-white-silver',
    monoBaseOklch: 'oklch(0.62 0.09 250)',
  },
  cursor: { preset: 'system' },
  effects: { hover: 'balanced-neo', button: 'balanced-neo' },
});

const DEFAULT_BRANDING = Object.freeze({ attribution: { enabled: true } });

const DEFAULT_CONFIG = Object.freeze({
  theme: 'dark',
  output: { minify: false, embed: false },
  ui: {
    skin: 'console',
    appearance: DEFAULT_APPEARANCE,
    branding: DEFAULT_BRANDING,
  },
  site: {
    firstName: '',
    lastName: '',
    fullName: '',
    copyrightName: '',
    listLabel: 'Works List',
    subtitle: '',
    updated: { mode: 'auto', value: '' },
    links: [
      { label: 'Home', href: '#', external: false },
      { label: 'Projects', href: '#', external: false },
      { label: 'Contact', href: '#', external: false },
    ],
  },
});

const DEFAULT_DOCS_CONFIG = Object.freeze({
  site: { title: '', subtitle: '', description: '', accent: '' },
  sources: { globs: ['docs/**/*.md'], includeReadme: true },
  ia: [],
  frontMatter: { addIfMissing: true, tocDepth: 2, autoSummary: true },
  codeTabs: { enabled: false, strategy: 'fence', order: ['js', 'ts', 'bash'] },
  assets: { optimize: false, sizes: ['1x', '2x', 'webp'], altPolicy: 'warn' },
  search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'], excludeSections: [] },
  works: { includeInNav: false, includeOnHome: false, linkMode: 'auto' },
  paths: { root: 'docs/', homepage: '' },
});

const STARTER_WORKS = Object.freeze([
  {
    id: 1,
    slug: 'demo-aurora-study',
    title: 'Aurora Study',
    oneliner: 'A spectral mini-suite bending from stillness into radiant overtone bloom.',
    description:
      'Built in three arcs: static clusters, fractured pulse, then sustained halo harmonics. This temp set previews card hierarchy and PDF handling.',
    audio: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg',
    pdf: 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf',
    cover: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Erik_Satie_by_Santiago_Rusi%C3%B1ol.jpg',
    tags: ['chamber', 'new-music', '2026'],
    cues: [{ label: '@0:00', t: 0 }],
  },
  {
    id: 2,
    slug: 'drift-etude',
    title: 'Drift Etude',
    oneliner: 'A low-register étude for pressure waves, harmonic drift, and controlled noise.',
    description: 'Designed as a mixed-media demo work to exercise cards with and without covers.',
    audio: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg',
    pdf: null,
    cover: null,
    tags: ['installation', 'electroacoustic'],
    cues: [{ label: '@0:00', t: 0 }],
  },
]);

const DEFAULT_DOC_PAGES = Object.freeze([
  {
    id: 'overview',
    title: 'Overview',
    slug: 'overview',
    hero: {
      kicker: 'Folio Builder',
      title: 'Project Overview',
      lede: 'This generated docs payload is authored from structured modules in the browser builder.',
    },
    modules: [
      {
        type: 'process',
        title: 'Workflow',
        steps: [
          { title: 'Draft', body: 'Capture works and cues in the Works tab.' },
          { title: 'Tune', body: 'Dial theme, cursor, and effects in Theme.' },
          { title: 'Ship', body: 'Generate dist or embed output in one click.' },
        ],
      },
    ],
  },
]);

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (_err) {
      // Vue proxies and DOM-backed objects can fail structuredClone.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/["'`]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'work';
}

function parseTimeToSeconds(input) {
  if (input == null || input === '') return NaN;
  if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  const raw = String(input).trim();
  if (!raw) return NaN;
  if (/^\d+$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(':').map((v) => Number(v));
  if (parts.some((v) => !Number.isFinite(v))) return NaN;
  if (parts.length === 2) {
    return Math.max(0, Math.floor(parts[0] * 60 + parts[1]));
  }
  if (parts.length === 3) {
    return Math.max(0, Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]));
  }
  return NaN;
}

function toTimeLabel(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function parseTags(input) {
  if (Array.isArray(input)) return input.map((v) => String(v).trim()).filter(Boolean);
  const raw = String(input || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch (_err) {
      // ignore and fallback to csv mode
    }
  }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

function parseCueLines(input) {
  if (Array.isArray(input)) {
    return input
      .map((row) => {
        const t = parseTimeToSeconds(row.t ?? row.time ?? row.at ?? 0);
        return {
          label: String(row.label || `@${toTimeLabel(Number.isFinite(t) ? t : 0)}`),
          t: Number.isFinite(t) ? t : 0,
        };
      })
      .filter((row) => Number.isFinite(row.t));
  }
  const raw = String(input || '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelRaw, timeRaw] = line.split('|').map((part) => part.trim());
      const sec = parseTimeToSeconds(timeRaw || labelRaw || '0');
      return {
        label: labelRaw || `@${toTimeLabel(Number.isFinite(sec) ? sec : 0)}`,
        t: Number.isFinite(sec) ? sec : 0,
      };
    });
}

function normalizeScore(input) {
  if (!input || typeof input !== 'object') return null;
  const pageMapRaw = Array.isArray(input.pageMap) ? input.pageMap : parseScoreMapLines(input.pageMap);
  const pageMap = pageMapRaw
    .map((row) => {
      const at = parseTimeToSeconds(row.at ?? row.time ?? row.t);
      const page = Number(row.page);
      if (!Number.isFinite(at) || !Number.isFinite(page) || page < 1) return null;
      return { at, page: Math.floor(page) };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  return {
    pdfStartPage: Math.max(1, Number(input.pdfStartPage) || 1),
    mediaOffsetSec: Number.isFinite(Number(input.mediaOffsetSec)) ? Number(input.mediaOffsetSec) : 0,
    ...(Number.isFinite(Number(input.pdfDelta)) ? { pdfDelta: Number(input.pdfDelta) } : {}),
    pageMap,
  };
}

function parseScoreMapLines(input) {
  const raw = String(input || '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [atRaw, pageRaw] = line.split('|').map((part) => part.trim());
      return { at: atRaw || '0:00', page: Number(pageRaw || 1) };
    });
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function parseYouTubeStartToSec(raw) {
  const value = String(raw || '').trim();
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.match(/(\d+)(h|m|s)/g);
  if (!parts) return 0;
  let sec = 0;
  for (const part of parts) {
    const m = part.match(/^(\d+)(h|m|s)$/);
    if (!m) continue;
    const n = Number(m[1]) || 0;
    if (m[2] === 'h') sec += n * 3600;
    else if (m[2] === 'm') sec += n * 60;
    else sec += n;
  }
  return sec;
}

function parseYouTubeUrlMeta(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  let videoId = '';
  if (host === 'youtu.be') {
    videoId = url.pathname.replace(/^\/+/, '').split('/')[0] || '';
  } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') || '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] || '';
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2] || '';
    }
  }
  if (!videoId) return null;
  const tRaw = url.searchParams.get('t') || url.searchParams.get('start') || '';
  const startAtSec = parseYouTubeStartToSec(tRaw);
  return { videoId, startAtSec, url: raw };
}

function normalizeMediaInput(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const mediaSource = source.media && typeof source.media === 'object' ? source.media : null;
  const hasHints = !!(
    mediaSource
    || source.mediaKind
    || source.media_kind
    || source.youtubeUrl
    || source.youtube_url
    || source.videoUrl
    || source.video_url
    || source.startAtSec != null
    || source.start_at_sec != null
  );
  if (!hasHints) return null;

  const kindRaw = mediaSource?.kind ?? source.mediaKind ?? source.media_kind ?? source.kind;
  const kind = String(kindRaw || 'score').trim().toLowerCase() === 'youtube' ? 'youtube' : 'score';
  if (kind !== 'youtube') return { kind: 'score' };

  const youtubeUrl = String(
    mediaSource?.youtubeUrl
    || mediaSource?.url
    || source.youtubeUrl
    || source.youtube_url
    || source.videoUrl
    || source.video_url
    || ''
  ).trim();
  const meta = parseYouTubeUrlMeta(youtubeUrl);
  if (!meta) return { kind: 'youtube' };

  const startAtRaw = mediaSource?.startAtSec ?? source.startAtSec ?? source.start_at_sec;
  const explicitStart = Number(startAtRaw);
  const startAtSec = Number.isFinite(explicitStart) && explicitStart >= 0
    ? explicitStart
    : (meta.startAtSec || 0);
  return {
    kind: 'youtube',
    youtubeUrl: meta.url,
    startAtSec,
  };
}

function normalizeWorkInput(input, state) {
  const media = normalizeMediaInput(input);
  const candidate = {
    id: Number(input.id),
    slug: String(input.slug || slugify(input.title || '')).trim(),
    title: String(input.title || '').trim(),
    oneliner: input.oneliner ?? input.one ?? '',
    description: input.description ?? '',
    audio: input.audio ? String(input.audio).trim() : null,
    pdf: input.pdf ? String(input.pdf).trim() : null,
    cover: normalizeCoverUrl(input.cover ?? input.coverUrl ?? null) || null,
    tags: parseTags(input.tags),
    cues: parseCueLines(input.cues),
    ...(media ? { media } : {}),
    ...(input.score ? { score: normalizeScore(input.score) } : {}),
  };

  if (!Number.isInteger(candidate.id) || candidate.id < 1) {
    candidate.id = nextWorkId(state);
  }
  if (!candidate.slug) candidate.slug = slugify(candidate.title || `work-${candidate.id}`);
  if (!candidate.title) candidate.title = `Untitled Work ${candidate.id}`;

  return normalizeWork(candidate);
}

function nextWorkId(state) {
  const ids = (state.worksDb.works || []).map((work) => Number(work.id)).filter((id) => Number.isFinite(id));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function validateProjectState(state) {
  const errors = [];
  const works = Array.isArray(state.worksDb.works) ? state.worksDb.works : [];
  const ids = new Set();
  const slugs = new Set();

  for (const work of works) {
    if (!Number.isInteger(Number(work.id)) || Number(work.id) < 1) {
      errors.push(`invalid id for work "${work.title || work.slug || 'unknown'}"`);
    }
    const id = Number(work.id);
    if (ids.has(id)) errors.push(`duplicate id ${id}`);
    ids.add(id);

    const slug = String(work.slug || '').trim();
    if (!slug) errors.push(`missing slug for id ${id}`);
    if (slugs.has(slug)) errors.push(`duplicate slug "${slug}"`);
    slugs.add(slug);

    if (!String(work.title || '').trim()) errors.push(`missing title for id ${id}`);
    if (work.media && typeof work.media === 'object') {
      const mediaKind = String(work.media.kind || 'score').trim().toLowerCase();
      if (mediaKind === 'youtube') {
        if (!String(work.media.youtubeUrl || '').trim()) {
          errors.push(`missing media.youtubeUrl for id ${id}`);
        }
        if (work.media.startAtSec != null) {
          const startAtSec = Number(work.media.startAtSec);
          if (!Number.isFinite(startAtSec) || startAtSec < 0) {
            errors.push(`invalid media.startAtSec for id ${id}`);
          }
        }
      }
    }
  }

  return errors;
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      current.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      current.push(cell);
      cell = '';
      if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
        rows.push(current);
      }
      current = [];
      continue;
    }

    cell += char;
  }

  if (cell.length || current.length) {
    current.push(cell);
    rows.push(current);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header || '').trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
}

function toCsv(works) {
  const cols = ['id', 'slug', 'title', 'one', 'oneliner', 'description', 'audio', 'pdf', 'cover', 'tags_csv', 'cues_json', 'score_json', 'media_json'];
  const lines = [cols.join(',')];
  for (const rawWork of works) {
    const work = normalizeWork(rawWork);
    const row = [
      work.id,
      work.slug,
      work.title,
      work.one || '',
      work.oneliner || '',
      work.description || '',
      work.audio || '',
      work.pdf || '',
      work.cover || '',
      Array.isArray(work.tags) ? work.tags.join(', ') : '',
      JSON.stringify(work.cues || []),
      JSON.stringify(work.score || null),
      JSON.stringify(work.media || null),
    ].map(csvEscape);
    lines.push(row.join(','));
  }
  return `${lines.join('\n')}\n`;
}

function normalizeAppearance(input) {
  const source = input && typeof input === 'object' ? input : {};
  const theme = source.theme && typeof source.theme === 'object' ? source.theme : {};
  const cursor = source.cursor && typeof source.cursor === 'object' ? source.cursor : {};
  const effects = source.effects && typeof source.effects === 'object' ? source.effects : {};

  const palette = APPEARANCE_PALETTES.includes(theme.palette) ? theme.palette : DEFAULT_APPEARANCE.theme.palette;
  const monoBaseOklch = String(theme.monoBaseOklch || DEFAULT_APPEARANCE.theme.monoBaseOklch);
  const cursorPreset = CURSOR_PRESETS.includes(cursor.preset) ? cursor.preset : DEFAULT_APPEARANCE.cursor.preset;
  const hover = EFFECT_PRESETS.includes(effects.hover) ? effects.hover : DEFAULT_APPEARANCE.effects.hover;
  const button = EFFECT_PRESETS.includes(effects.button) ? effects.button : DEFAULT_APPEARANCE.effects.button;

  return {
    theme: { palette, monoBaseOklch },
    cursor: { preset: cursorPreset },
    effects: { hover, button },
  };
}

function normalizeBranding(input) {
  const source = input && typeof input === 'object' ? input : {};
  const attr = source.attribution && typeof source.attribution === 'object' ? source.attribution : {};
  return { attribution: { enabled: attr.enabled !== false } };
}

function parseGenerateArgs(argv, state) {
  const args = [...argv];
  const options = {
    out: 'dist',
    embed: false,
    minify: false,
    js: 'script.js',
    css: 'styles.css',
    noCss: false,
    noUi: false,
    skin: String(state.config.ui?.skin || 'console'),
    uiRuntime: 'vanilla',
    appJs: 'app.js',
    appCss: null,
    palette: null,
    cursor: null,
    hoverEffect: null,
    buttonEffect: null,
    monoColor: null,
    saveAppearance: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--embed') options.embed = true;
    else if (arg === '--minify') options.minify = true;
    else if (arg === '--no-css') options.noCss = true;
    else if (arg === '--no-ui') options.noUi = true;
    else if (arg === '--save-appearance') options.saveAppearance = true;
    else if (arg === '--out') options.out = args[i + 1] || options.out, i += 1;
    else if (arg === '--js') options.js = args[i + 1] || options.js, i += 1;
    else if (arg === '--css') options.css = args[i + 1] || options.css, i += 1;
    else if (arg === '--skin') options.skin = args[i + 1] || options.skin, i += 1;
    else if (arg === '--ui-runtime') options.uiRuntime = args[i + 1] || options.uiRuntime, i += 1;
    else if (arg === '--app-js') options.appJs = args[i + 1] || options.appJs, i += 1;
    else if (arg === '--app-css') options.appCss = args[i + 1] || options.appCss, i += 1;
    else if (arg === '--palette') options.palette = args[i + 1] || null, i += 1;
    else if (arg === '--cursor') options.cursor = args[i + 1] || null, i += 1;
    else if (arg === '--hover-effect') options.hoverEffect = args[i + 1] || null, i += 1;
    else if (arg === '--button-effect') options.buttonEffect = args[i + 1] || null, i += 1;
    else if (arg === '--mono-color') options.monoColor = args[i + 1] || null, i += 1;
  }

  return options;
}

function applyGenerateOptionsToAppearance(baseAppearance, options) {
  const next = deepClone(baseAppearance);
  if (options.palette && APPEARANCE_PALETTES.includes(options.palette)) {
    next.theme.palette = options.palette;
  }
  if (options.monoColor) {
    next.theme.monoBaseOklch = String(options.monoColor);
  }
  if (options.cursor && CURSOR_PRESETS.includes(options.cursor)) {
    next.cursor.preset = options.cursor;
  }
  if (options.hoverEffect && EFFECT_PRESETS.includes(options.hoverEffect)) {
    next.effects.hover = options.hoverEffect;
  }
  if (options.buttonEffect && EFFECT_PRESETS.includes(options.buttonEffect)) {
    next.effects.button = options.buttonEffect;
  }
  return normalizeAppearance(next);
}

function runtimeForSkin(skin, runtime) {
  const requested = String(runtime || 'vanilla').toLowerCase() === 'react' ? 'react' : 'vanilla';
  if (requested === 'react' && REACT_SUPPORTED_SKINS.has(skin)) return { runtime: 'react', warned: false };
  if (requested === 'react') return { runtime: 'vanilla', warned: true };
  return { runtime: 'vanilla', warned: false };
}

function renderStyles(themeMode, appearance, skin) {
  const dark = themeMode === 'dark';
  const fg = dark ? '#e6ecf7' : '#11203a';
  const bg = dark ? '#070f1f' : '#f2f6ff';
  const surface = dark ? '#111f36' : '#ffffff';
  const border = dark ? '#37507e' : '#8aa6cf';
  const accent = dark ? '#ff8a30' : '#1e63b8';
  const accent2 = dark ? '#2f85ff' : '#f4962a';

  const hoverShift = appearance.effects.hover === 'high-drama' ? 'translateY(-4px)' : appearance.effects.hover === 'minimal' ? 'translateY(-1px)' : 'translateY(-2px)';
  const buttonScale = appearance.effects.button === 'high-drama' ? 'scale(1.03)' : appearance.effects.button === 'minimal' ? 'scale(1.005)' : 'scale(1.015)';
  const radius = skin === 'cards-tabs' || skin === 'kiosk' ? '2px' : '8px';

  return `:root{--fg:${fg};--bg:${bg};--surface:${surface};--border:${border};--accent:${accent};--accent-2:${accent2};--radius:${radius};font-family:"Space Grotesk",ui-sans-serif,sans-serif;}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg)}
body{min-height:100vh}
.folio-shell{display:grid;gap:16px;padding:18px;max-width:1200px;margin:0 auto}
.folio-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:2px solid var(--border);border-radius:var(--radius);background:linear-gradient(120deg,color-mix(in srgb,var(--surface) 85%, var(--accent) 15%),var(--surface));box-shadow:6px 6px 0 color-mix(in srgb,var(--border) 55%, transparent)}
.folio-header h1{margin:0;font-family:"Instrument Serif",serif;font-size:clamp(28px,4vw,44px)}
.folio-toolbar{display:flex;gap:8px;flex-wrap:wrap}
.folio-btn{appearance:none;border:2px solid var(--border);background:var(--surface);color:var(--fg);padding:8px 12px;border-radius:2px;font:600 14px/1 "IBM Plex Mono",ui-monospace,monospace;cursor:pointer;transition:transform .2s ease, box-shadow .2s ease, background .2s ease}
.folio-btn:hover{transform:${hoverShift};box-shadow:4px 4px 0 color-mix(in srgb,var(--border) 50%, transparent)}
.folio-btn:active{transform:${buttonScale}}
.folio-btn[data-kind="accent"]{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#03101f;border-color:transparent}
.folio-grid{display:grid;gap:14px;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr)}
.folio-card{border:2px solid var(--border);border-radius:${radius};background:radial-gradient(120% 120% at 85% 10%,color-mix(in srgb,var(--accent-2) 22%, transparent),transparent 55%), var(--surface);padding:14px;box-shadow:6px 6px 0 color-mix(in srgb,var(--border) 50%, transparent)}
.folio-work{display:grid;gap:10px;padding:12px;border:2px solid var(--border);border-radius:2px;background:color-mix(in srgb,var(--surface) 86%, var(--accent) 14%)}
.folio-work:hover{transform:${hoverShift};transition:transform .2s ease}
.folio-work h3{margin:0;font:700 28px/1.1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.02em}
.folio-meta{opacity:.78;font:500 14px/1.4 "Space Grotesk",sans-serif}
.folio-tags{display:flex;gap:8px;flex-wrap:wrap}
.folio-tag{border:2px solid var(--border);padding:4px 8px;border-radius:2px;font:600 11px/1 "IBM Plex Mono",ui-monospace,monospace;background:color-mix(in srgb,var(--surface) 75%, var(--accent-2) 25%)}
.folio-actions{display:flex;gap:8px;flex-wrap:wrap}
.folio-cover-wrap{display:grid;gap:6px}
.folio-cover{width:100%;max-height:180px;object-fit:cover;border:2px solid var(--border);border-radius:2px;background:#0f172a}
.folio-cover-fallback{display:inline-flex;align-items:center;justify-content:center;min-height:58px;padding:8px;border:2px dashed var(--border);border-radius:2px;font:600 12px/1 "IBM Plex Mono",ui-monospace,monospace;opacity:.78}
.folio-doc{display:grid;gap:12px}
.folio-doc h2{margin:0;font:700 28px/1.2 "Instrument Serif",serif}
.folio-module{border:2px dashed var(--border);padding:10px;border-radius:2px;background:color-mix(in srgb,var(--surface) 90%, var(--accent) 10%)}
.folio-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:2px solid var(--border);padding-top:12px;font:500 12px/1.4 "IBM Plex Mono",ui-monospace,monospace}
@media (max-width: 980px){.folio-grid{grid-template-columns:1fr}}
@media (max-width: 760px){.folio-shell{padding:10px}.folio-header{flex-direction:column;align-items:flex-start}}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
}

function renderAppScript(payload, skin, runtime) {
  const docsMode = skin === 'docs-reader';
  const reactPrelude = runtime === 'react'
    ? 'function createRoot(node){return {render(fn){fn(node);}};}\n'
    : '';

  return `(function(){\n${reactPrelude}var data=${JSON.stringify(payload)};\nwindow.PRAE=window.PRAE||{};window.PRAE.data=data;\nwindow.PRAE.pauseAllAudio=function(exceptId){var list=document.querySelectorAll('audio[data-work-id]');list.forEach(function(a){if(exceptId&&String(a.dataset.workId)===String(exceptId))return;try{a.pause();a.currentTime=0;}catch(_){}});};\nvar root=document.getElementById('prae-runtime');if(!root)return;\nfunction make(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=String(text);return el;}\nfunction renderWorks(){var shell=make('div','folio-shell');var header=make('header','folio-header');header.append(make('h1','',data.config.site.fullName||'Your Name'));\nvar tools=make('div','folio-toolbar');['Home','Projects','Contact'].forEach(function(label){var btn=make('button','folio-btn',label);btn.type='button';tools.append(btn);});header.append(tools);shell.append(header);\nvar grid=make('div','folio-grid');var listCard=make('section','folio-card');data.works.forEach(function(work,index){var card=make('article','folio-work');card.append(make('h3','',work.title));card.append(make('div','folio-meta',work.slug));if(work.cover){var fig=make('figure','folio-cover-wrap');var img=make('img','folio-cover');var fb=make('span','folio-cover-fallback','Cover unavailable');fb.hidden=true;img.alt='';img.addEventListener('error',function(){img.style.display='none';fb.hidden=false;},{once:true});img.src=work.cover;fig.append(img);fig.append(fb);card.append(fig);}var desc=make('p','',work.onelinerEffective||work.oneliner||work.one||'No summary yet.');card.append(desc);if(Array.isArray(work.tags)&&work.tags.length){var tags=make('div','folio-tags');work.tags.forEach(function(tag){tags.append(make('span','folio-tag',tag));});card.append(tags);}var actions=make('div','folio-actions');var play=make('button','folio-btn','Play');play.type='button';var audio=make('audio','');audio.dataset.workId=String(work.id);audio.controls=true;if(work.audio)audio.src=work.audio;play.addEventListener('click',function(){window.PRAE.pauseAllAudio(work.id);if(!work.audio)return;audio.currentTime=0;audio.play().catch(function(){});});actions.append(play);var deep=make('button','folio-btn','Copy URL');deep.type='button';deep.addEventListener('click',function(){var url=location.origin+location.pathname+'#work='+encodeURIComponent(work.id);if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).catch(function(){});}});actions.append(deep);if(work.pdf){var pdf=make('a','folio-btn','PDF');pdf.href=work.pdf;pdf.target='_blank';pdf.rel='noreferrer';actions.append(pdf);}card.append(actions);card.append(audio);listCard.append(card);});grid.append(listCard);\nvar side=make('aside','folio-card');var np=make('div','');np.append(make('h3','', 'Now Playing'));np.append(make('p','folio-meta','Idle state: choose any work to begin playback.'));side.append(np);side.append(make('div','folio-module','Theme: '+data.config.theme+' • Palette: '+data.config.ui.appearance.theme.palette));side.append(make('div','folio-module','Runtime: ${runtime} • Skin: ${skin}'));grid.append(side);shell.append(grid);\nvar footer=make('footer','folio-footer');footer.append(make('span','', (data.config.site.fullName||'Your Name') + ' · selected works'));var powered=make('span','', data.config.ui.branding.attribution.enabled ? 'Powered by Praetorius' : 'Attribution hidden');footer.append(powered);shell.append(footer);root.replaceChildren(shell);}\nfunction renderDocs(){var shell=make('div','folio-shell');var card=make('section','folio-card folio-doc');var page=(Array.isArray(data.docsPages)&&data.docsPages[0])||null;card.append(make('h2','', page&&page.hero&&page.hero.title?page.hero.title:'Docs Reader'));card.append(make('p','folio-meta', page&&page.hero&&page.hero.lede?page.hero.lede:'No docs pages yet.'));if(page&&Array.isArray(page.modules)){page.modules.forEach(function(module){var block=make('div','folio-module');block.append(make('strong','', String(module.type||'module')));if(module.title)block.append(make('p','',module.title));if(module.type==='credits'&&Array.isArray(module.roles)){module.roles.forEach(function(role){block.append(make('p','',String(role.role||'Role')+': '+(Array.isArray(role.people)?role.people.join(', '):'')));});}if(module.type==='process'&&Array.isArray(module.steps)){module.steps.forEach(function(step){block.append(make('p','',String(step.title||'Step')+' — '+String(step.body||'')));});}if(module.type==='media'&&Array.isArray(module.items)){block.append(make('p','',module.items.length+' media item(s)'));}if(module.type==='score'){block.append(make('p','',String(module.pdf||'No score PDF')));}card.append(block);});}shell.append(card);var footer=make('footer','folio-footer');footer.append(make('span','',data.config.site.fullName||'Your Name'));footer.append(make('span','',data.config.ui.branding.attribution.enabled?'Powered by Praetorius':'Attribution hidden'));shell.append(footer);root.replaceChildren(shell);}\n${docsMode ? 'renderDocs();' : 'renderWorks();'}\n})();\n`;
}

function renderDataScript(payload) {
  return `window.__PRAE_DATA__=${JSON.stringify(payload)};`;
}

function renderIndexHtml(options) {
  const {
    payload,
    themeMode,
    appearance,
    branding,
    skin,
    runtime,
    cssFile,
    scriptFile,
    appCssFile,
    appJsFile,
    includeCss,
    includeUi,
    dataScript,
  } = options;

  const headParts = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(payload.config.site.fullName || 'Praetorius Folio')}</title>`,
    includeCss ? `<link rel="stylesheet" href="./${cssFile}">` : '',
    includeUi ? `<link rel="stylesheet" href="./${appCssFile}">` : '',
  ].filter(Boolean);

  const bodyParts = [
    '<div id="prae-runtime"></div>',
    `<script id="prae-data" data-source="builder" data-count="${payload.works.length}">${dataScript}</script>`,
    `<script src="./${scriptFile}" defer></script>`,
    includeUi ? `<script type="module" src="./${appJsFile}" defer></script>` : '',
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en" data-skin="${skin}" data-ui-runtime="${runtime}" data-theme="${themeMode}" data-palette="${appearance.theme.palette}" data-cursor="${appearance.cursor.preset}" data-hover-effect="${appearance.effects.hover}" data-button-effect="${appearance.effects.button}" data-brand-system="praetorius-v1" data-brand-attribution="${branding.attribution.enabled ? 'on' : 'off'}">
  <head>
    ${headParts.join('\n    ')}
  </head>
  <body class="prae-theme-${themeMode}">
    ${bodyParts.join('\n    ')}
  </body>
</html>
`;
}

function renderEmbedHtml(options) {
  const { skin, runtime, cssText, appCssText, scriptText, appJsText, indexHtml } = options;
  const bodyInner = indexHtml.split('<body')[1]?.split('>')[1]?.split('</body>')[0] || '<div id="prae-runtime"></div>';
  return `<!-- Praetorius embed: ${skin} (${runtime}) -->
<style>${cssText}</style>
<style>${appCssText}</style>
${bodyInner}
<script>${scriptText}</script>
<script>${appJsText}</script>
`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildGenerateArtifacts(state, argv) {
  const options = parseGenerateArgs(argv, state);
  const skin = BUILTIN_SKINS.includes(options.skin) ? options.skin : 'console';
  const runtimeResolution = runtimeForSkin(skin, options.uiRuntime);
  const notes = [];
  if (runtimeResolution.warned) {
    notes.push(`--ui-runtime=react is not supported for skin "${skin}" yet. Falling back to vanilla.`);
  }
  let runtime = runtimeResolution.runtime;

  if (options.embed && runtime === 'react' && EMBED_VANILLA_ONLY_SKINS.has(skin)) {
    notes.push(`Embed requested for ${skin} with --ui-runtime=react -> using vanilla ${skin} fallback.`);
    runtime = 'vanilla';
  }

  const baseAppearance = normalizeAppearance(state.config.ui?.appearance || DEFAULT_APPEARANCE);
  const appearance = applyGenerateOptionsToAppearance(baseAppearance, options);
  const branding = normalizeBranding(state.config.ui?.branding || DEFAULT_BRANDING);
  const themeMode = String(state.config.theme || 'dark') === 'light' ? 'light' : 'dark';

  const payload = {
    config: {
      theme: themeMode,
      ui: {
        skin,
        appearance,
        branding,
      },
      site: state.config.site,
    },
    works: (state.worksDb.works || []).map((work) => normalizeWork(work)),
    docsConfig: state.docsConfig,
    docsPages: state.docsPages,
  };

  const cssFile = options.css || 'styles.css';
  const appCssFile = options.appCss || (skin === 'docs-reader' ? 'style.css' : 'app.css');
  const scriptFile = options.js || 'script.js';
  const appJsFile = options.appJs || 'app.js';

  const cssText = renderStyles(themeMode, appearance, skin);
  const appCssText = `/* ${skin} ${runtime} runtime */\n` + renderStyles(themeMode, appearance, skin);
  const dataScript = renderDataScript(payload);
  const scriptText = `window.PRAE=window.PRAE||{};window.PRAE.pauseAllAudio=function(exceptId){var list=document.querySelectorAll('audio[data-work-id]');list.forEach(function(a){if(exceptId&&String(a.dataset.workId)===String(exceptId))return;try{a.pause();a.currentTime=0;}catch(_){}});};\n${dataScript}`;
  const appJsText = renderAppScript(payload, skin, runtime);

  const indexHtml = renderIndexHtml({
    payload,
    themeMode,
    appearance,
    branding,
    skin,
    runtime,
    cssFile,
    scriptFile,
    appCssFile,
    appJsFile,
    includeCss: !options.noCss,
    includeUi: !options.noUi,
    dataScript,
  });

  const files = {};
  let embedHtml = '';
  if (options.embed) {
    // Match CLI behavior: embed mode emits embed markup only.
    embedHtml = renderEmbedHtml({ skin, runtime, cssText, appCssText, scriptText, appJsText, indexHtml });
    files.embed = embedHtml;
  } else {
    files[scriptFile] = scriptText;
    if (!options.noCss) files[cssFile] = cssText;
    if (!options.noUi) {
      files.index = indexHtml;
      files[appJsFile] = appJsText;
      files[appCssFile] = appCssText;
    }
  }

  const previewHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>${cssText}</style>
<style>${appCssText}</style>
</head>
<body class="prae-theme-${themeMode}">
<div id="prae-runtime"></div>
<script>${scriptText}</script>
<script>${appJsText}</script>
</body>
</html>`;

  if (options.saveAppearance) {
    state.config.ui = state.config.ui || {};
    state.config.ui.appearance = deepClone(appearance);
  }

  return {
    options: {
      ...options,
      skin,
      uiRuntime: runtime,
      appCss: appCssFile,
      appJs: appJsFile,
      css: cssFile,
      js: scriptFile,
      palette: appearance.theme.palette,
    },
    notes,
    files,
    previewHtml,
    embedHtml,
    generatedAt: nowIso(),
  };
}

function commandString(argv) {
  return `prae ${argv.join(' ')}`.trim();
}

function ensureProjectShape(input) {
  const base = input && typeof input === 'object' ? deepClone(input) : {};
  const config = {
    ...deepClone(DEFAULT_CONFIG),
    ...(base.config || {}),
  };
  config.ui = {
    ...deepClone(DEFAULT_CONFIG.ui),
    ...(base.config?.ui || {}),
  };
  config.ui.appearance = normalizeAppearance(base.config?.ui?.appearance || config.ui.appearance);
  config.ui.branding = normalizeBranding(base.config?.ui?.branding || config.ui.branding);
  config.site = {
    ...deepClone(DEFAULT_CONFIG.site),
    ...(base.config?.site || {}),
  };

  const worksDb = {
    version: Number(base.worksDb?.version || base.version || 1),
    works: Array.isArray(base.worksDb?.works || base.works)
      ? (base.worksDb?.works || base.works).map((work) => normalizeWorkInput(work, { worksDb: { works: base.worksDb?.works || base.works || [] } }))
      : deepClone(STARTER_WORKS),
  };

  const docsConfig = {
    ...deepClone(DEFAULT_DOCS_CONFIG),
    ...(base.docsConfig || {}),
  };

  const docsPages = Array.isArray(base.docsPages) && base.docsPages.length
    ? deepClone(base.docsPages)
    : deepClone(DEFAULT_DOC_PAGES);

  return {
    meta: {
      label: 'Folio Builder',
      version: 1,
      updatedAt: nowIso(),
      ...(base.meta || {}),
    },
    config,
    worksDb,
    docsConfig,
    docsPages,
    generated: base.generated || null,
    commandTranscript: Array.isArray(base.commandTranscript) ? base.commandTranscript : [],
    history: Array.isArray(base.history) ? base.history : [],
  };
}

export function createDefaultProjectState() {
  return ensureProjectShape({});
}

export function hydrateProjectState(input) {
  return ensureProjectShape(input);
}

function pushSnapshot(state, label) {
  const snapshot = {
    at: nowIso(),
    label,
    data: {
      config: deepClone(state.config),
      worksDb: deepClone(state.worksDb),
      docsConfig: deepClone(state.docsConfig),
      docsPages: deepClone(state.docsPages),
      generated: deepClone(state.generated),
    },
  };
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push(snapshot);
  if (state.history.length > 60) state.history = state.history.slice(-60);
}

function appendTranscript(state, argv, output, ok = true) {
  const entry = {
    at: nowIso(),
    ok,
    command: commandString(argv),
    output: Array.isArray(output) ? output.slice(0, 80) : [],
  };
  state.commandTranscript = Array.isArray(state.commandTranscript) ? state.commandTranscript : [];
  state.commandTranscript.push(entry);
  if (state.commandTranscript.length > 250) {
    state.commandTranscript = state.commandTranscript.slice(-250);
  }
}

function parsePayload(argv) {
  const index = argv.indexOf('--payload');
  if (index < 0) return null;
  const raw = argv[index + 1];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { __parseError: err?.message || 'Invalid payload JSON' };
  }
}

function readFlag(argv, flag) {
  return argv.includes(flag);
}

function readOption(argv, flag, fallback = '') {
  const index = argv.indexOf(flag);
  if (index < 0) return fallback;
  return argv[index + 1] ?? fallback;
}

function findWork(state, idLike) {
  const id = Number(idLike);
  const works = state.worksDb.works || [];
  const index = works.findIndex((work) => Number(work.id) === id || String(work.slug) === String(idLike));
  if (index < 0) return { index: -1, work: null };
  return { index, work: works[index] };
}

function mergeProjectPatch(state, payload) {
  if (payload.config) {
    state.config = ensureProjectShape({ config: { ...state.config, ...payload.config }, worksDb: state.worksDb, docsConfig: state.docsConfig, docsPages: state.docsPages }).config;
  }
  if (payload.site) {
    state.config.site = {
      ...state.config.site,
      ...payload.site,
    };
  }
  if (payload.ui) {
    state.config.ui = {
      ...state.config.ui,
      ...payload.ui,
    };
    state.config.ui.appearance = normalizeAppearance(state.config.ui.appearance);
    state.config.ui.branding = normalizeBranding(state.config.ui.branding);
  }
  if (payload.theme) {
    state.config.theme = String(payload.theme) === 'light' ? 'light' : 'dark';
  }
}

export function runFolioCommand(inputState, argvInput) {
  const argv = Array.isArray(argvInput) ? argvInput.filter((part) => String(part || '').length) : [];
  const command = argv[0];
  const state = ensureProjectShape(inputState);
  const output = [];
  let exportText = null;
  let artifacts = null;
  let ok = true;

  try {
    if (!command || command === 'help') {
      output.push('Praetorius Folio Builder worker runtime.');
      output.push('Commands: init, site, config, add, edit, rm, order, score, import, export, validate, doctor, docs, generate, migrate, undo.');
    } else if (command === 'init') {
      pushSnapshot(state, 'before-init');
      const fresh = createDefaultProjectState();
      state.config = fresh.config;
      state.worksDb = fresh.worksDb;
      state.docsConfig = fresh.docsConfig;
      state.docsPages = fresh.docsPages;
      state.generated = null;
      output.push('init: project reset to starter defaults.');
    } else if (command === 'site' || command === 'config') {
      const payload = parsePayload(argv);
      if (!payload || payload.__parseError) {
        throw new Error(payload?.__parseError || 'Missing --payload JSON.');
      }
      pushSnapshot(state, `before-${command}`);
      mergeProjectPatch(state, payload);
      output.push(`${command}: configuration updated.`);
    } else if (command === 'add') {
      const payload = parsePayload(argv);
      if (!payload || payload.__parseError) throw new Error(payload?.__parseError || 'Missing --payload JSON.');
      pushSnapshot(state, 'before-add');
      const normalized = normalizeWorkInput(payload, state);
      if ((state.worksDb.works || []).some((work) => Number(work.id) === Number(normalized.id))) {
        normalized.id = nextWorkId(state);
      }
      if ((state.worksDb.works || []).some((work) => String(work.slug) === String(normalized.slug))) {
        let n = 2;
        let candidate = `${normalized.slug}-${n}`;
        while ((state.worksDb.works || []).some((work) => String(work.slug) === candidate)) {
          n += 1;
          candidate = `${normalized.slug}-${n}`;
        }
        normalized.slug = candidate;
      }
      state.worksDb.works.push(normalized);
      output.push(`added #${normalized.id} ${normalized.title}`);
      for (const warning of collectWorkWarnings(normalized)) output.push(`warn: ${warning}`);
    } else if (command === 'edit') {
      const target = argv[1];
      if (!target) throw new Error('edit requires <id>.');
      const payload = parsePayload(argv);
      if (!payload || payload.__parseError) throw new Error(payload?.__parseError || 'Missing --payload JSON.');
      const { index, work } = findWork(state, target);
      if (!work || index < 0) throw new Error(`No work with id ${target}`);
      pushSnapshot(state, 'before-edit');
      const merged = normalizeWorkInput({ ...work, ...payload, id: work.id }, state);
      state.worksDb.works[index] = merged;
      output.push(`updated #${merged.id} ${merged.title}`);
    } else if (command === 'rm') {
      const target = argv[1];
      if (!target) throw new Error('rm requires <id>.');
      const { index, work } = findWork(state, target);
      if (index < 0 || !work) throw new Error(`No work with id ${target}`);
      pushSnapshot(state, 'before-rm');
      state.worksDb.works.splice(index, 1);
      output.push(`removed #${work.id} ${work.title}`);
    } else if (command === 'order') {
      const moveId = readOption(argv, '--move', '');
      const toIndex = Number(readOption(argv, '--to', ''));
      if (!moveId || !Number.isFinite(toIndex)) throw new Error('order requires --move <id> --to <index>');
      const { index, work } = findWork(state, moveId);
      if (!work || index < 0) throw new Error(`No work with id ${moveId}`);
      const targetIndex = Math.max(0, Math.min(state.worksDb.works.length - 1, Math.floor(toIndex) - 1));
      pushSnapshot(state, 'before-order');
      const moved = state.worksDb.works.splice(index, 1)[0];
      state.worksDb.works.splice(targetIndex, 0, moved);
      output.push(`moved #${moved.id} -> position ${targetIndex + 1}`);
    } else if (command === 'list') {
      for (const work of state.worksDb.works || []) {
        const normalized = normalizeWork(work);
        output.push(`#${normalized.id} ${normalized.title} (${normalized.slug})`);
      }
      if (!state.worksDb.works.length) output.push('No works yet.');
    } else if (command === 'score') {
      const sub = argv[1];
      if (!sub) throw new Error('score requires a subcommand.');
      if (sub === 'add') {
        const target = argv[2];
        if (!target) throw new Error('score add requires <id>.');
        const payload = parsePayload(argv);
        if (!payload || payload.__parseError) throw new Error(payload?.__parseError || 'Missing --payload JSON.');
        const { index, work } = findWork(state, target);
        if (!work || index < 0) throw new Error(`No work with id ${target}`);
        pushSnapshot(state, 'before-score-add');
        const score = normalizeScore(payload);
        state.worksDb.works[index] = normalizeWork({ ...work, score });
        output.push(`score saved for #${work.id} ${work.title}`);
      } else if (sub === 'list') {
        const target = argv[2];
        if (!target) throw new Error('score list requires <id>.');
        const { work } = findWork(state, target);
        if (!work) throw new Error(`No work with id ${target}`);
        if (!work.score) output.push('No score mapping.');
        else {
          output.push(`pdfStartPage=${work.score.pdfStartPage || 1}, mediaOffsetSec=${work.score.mediaOffsetSec || 0}`);
          for (const row of work.score.pageMap || []) {
            output.push(`  ${toTimeLabel(row.at)} -> p.${row.page}`);
          }
        }
      } else if (sub === 'rm') {
        const target = argv[2];
        const rowIndex = Number(argv[3]);
        if (!target || !Number.isFinite(rowIndex)) throw new Error('score rm requires <id> <rowIndex>.');
        const { index, work } = findWork(state, target);
        if (!work || index < 0) throw new Error(`No work with id ${target}`);
        if (!work.score || !Array.isArray(work.score.pageMap) || !work.score.pageMap.length) throw new Error('No score rows to remove.');
        pushSnapshot(state, 'before-score-rm');
        const nextScore = normalizeScore(work.score);
        nextScore.pageMap.splice(Math.max(0, Math.floor(rowIndex) - 1), 1);
        state.worksDb.works[index] = normalizeWork({ ...work, score: nextScore });
        output.push(`score row removed from #${work.id}`);
      } else if (sub === 'validate') {
        const target = argv[2];
        if (!target) throw new Error('score validate requires <id>.');
        const { work } = findWork(state, target);
        if (!work) throw new Error(`No work with id ${target}`);
        if (!work.score || !Array.isArray(work.score.pageMap) || !work.score.pageMap.length) {
          output.push('score: no rows');
        } else {
          let last = -1;
          const issues = [];
          for (const row of work.score.pageMap) {
            if (Number(row.at) < last) issues.push('rows are not monotonic in time');
            last = Number(row.at);
            if (!Number.isInteger(Number(row.page)) || Number(row.page) < 1) issues.push('page numbers must be >= 1');
          }
          if (issues.length) {
            ok = false;
            output.push('score: issues found');
            issues.forEach((issue) => output.push(`- ${issue}`));
          } else {
            output.push('score: OK');
          }
        }
      } else {
        throw new Error(`Unknown score subcommand "${sub}"`);
      }
    } else if (command === 'import') {
      const format = String(readOption(argv, '--format', 'json')).toLowerCase();
      const payloadRaw = readOption(argv, '--payload', '');
      if (!payloadRaw) throw new Error('import requires --payload.');
      pushSnapshot(state, 'before-import');
      let rows = [];
      if (format === 'json') {
        const parsed = JSON.parse(payloadRaw);
        rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.works) ? parsed.works : [];
      } else if (format === 'csv') {
        rows = parseCsv(payloadRaw).map((row) => ({
          ...row,
          id: row.id,
          slug: row.slug,
          title: row.title,
          oneliner: row.oneliner || row.one,
          description: row.description,
          audio: row.audio,
          pdf: row.pdf,
          cover: row.cover,
          tags: row.tags_csv,
          cues: row.cues_json ? JSON.parse(row.cues_json || '[]') : [],
          score: row.score_json ? JSON.parse(row.score_json || 'null') : null,
          media: parseMaybeJson(row.media_json),
          mediaKind: row.mediaKind || row.media_kind || row.kind || '',
          youtubeUrl: row.youtubeUrl || row.youtube_url || row.videoUrl || row.video_url || '',
          startAtSec: row.startAtSec ?? row.start_at_sec ?? undefined,
        }));
      } else {
        throw new Error('Unsupported import format. Use json or csv.');
      }
      const assumeNewId = readFlag(argv, '--assume-new-id');
      const assumeNewSlug = readFlag(argv, '--assume-new-slug');
      let imported = 0;
      for (const row of rows) {
        const normalized = normalizeWorkInput(row, state);
        const idConflict = (state.worksDb.works || []).some((work) => Number(work.id) === Number(normalized.id));
        if (idConflict) {
          if (assumeNewId) normalized.id = nextWorkId(state);
          else {
            const index = (state.worksDb.works || []).findIndex((work) => Number(work.id) === Number(normalized.id));
            state.worksDb.works[index] = normalized;
            imported += 1;
            continue;
          }
        }
        const slugConflict = (state.worksDb.works || []).some((work) => String(work.slug) === String(normalized.slug));
        if (slugConflict) {
          if (assumeNewSlug) {
            let n = 2;
            let candidate = `${normalized.slug}-${n}`;
            while ((state.worksDb.works || []).some((work) => String(work.slug) === candidate)) {
              n += 1;
              candidate = `${normalized.slug}-${n}`;
            }
            normalized.slug = candidate;
          } else {
            const index = (state.worksDb.works || []).findIndex((work) => String(work.slug) === String(normalized.slug));
            state.worksDb.works[index] = normalized;
            imported += 1;
            continue;
          }
        }
        state.worksDb.works.push(normalized);
        imported += 1;
      }
      output.push(`imported ${imported} row(s)`);
    } else if (command === 'export') {
      const format = String(readOption(argv, '--format', 'json')).toLowerCase();
      if (format === 'json') {
        exportText = `${JSON.stringify(state.worksDb, null, 2)}\n`;
      } else if (format === 'csv') {
        exportText = toCsv(state.worksDb.works || []);
      } else {
        throw new Error('Unknown export format.');
      }
      output.push(`exported ${format}`);
    } else if (command === 'validate') {
      const errors = validateProjectState(state);
      if (errors.length) {
        ok = false;
        output.push('Schema errors:');
        errors.forEach((entry) => output.push(`- ${entry}`));
      } else {
        output.push(`Schema OK - ${(state.worksDb.works || []).length} work(s)`);
      }
      for (const work of state.worksDb.works || []) {
        for (const warning of collectWorkWarnings(work)) {
          output.push(`warn #${work.id}: ${warning}`);
        }
      }
    } else if (command === 'doctor') {
      const errors = validateProjectState(state);
      const report = {
        ok: errors.length === 0,
        overall: errors.length === 0,
        errors,
        counts: { works: (state.worksDb.works || []).length },
        notes: ['URL/CORS checks use browser-safe fetch probes in Folio Builder.'],
      };
      if (readFlag(argv, '--json')) {
        exportText = `${JSON.stringify(report, null, 2)}\n`;
      }
      if (report.ok) output.push('doctor: OK');
      else {
        ok = false;
        output.push('doctor: issues found');
        errors.forEach((entry) => output.push(`- ${entry}`));
      }
    } else if (command === 'docs') {
      const payload = parsePayload(argv);
      if (!payload || payload.__parseError) throw new Error(payload?.__parseError || 'Missing --payload JSON.');
      pushSnapshot(state, 'before-docs');
      if (payload.docsConfig) {
        state.docsConfig = {
          ...state.docsConfig,
          ...payload.docsConfig,
        };
      }
      if (Array.isArray(payload.docsPages)) {
        state.docsPages = payload.docsPages.map((page, index) => ({
          id: String(page.id || `page-${index + 1}`),
          title: String(page.title || `Page ${index + 1}`),
          slug: String(page.slug || slugify(page.title || `page-${index + 1}`)),
          hero: {
            kicker: String(page.hero?.kicker || ''),
            title: String(page.hero?.title || page.title || ''),
            lede: String(page.hero?.lede || ''),
          },
          modules: Array.isArray(page.modules) ? page.modules : [],
        }));
      }
      output.push('docs configuration updated.');
    } else if (command === 'generate' || command === 'build') {
      artifacts = buildGenerateArtifacts(state, argv.slice(1));
      state.generated = artifacts;
      output.push(`Generated ${artifacts.options.skin} (${artifacts.options.uiRuntime}) to ${artifacts.options.out} (works: ${state.worksDb.works.length})`);
      artifacts.notes.forEach((note) => output.push(note));
    } else if (command === 'migrate') {
      const dryRun = readFlag(argv, '--dry-run');
      const normalizedWorks = (state.worksDb.works || []).map((work) => normalizeWorkInput(work, state));
      const changed = JSON.stringify(normalizedWorks) !== JSON.stringify(state.worksDb.works || []);
      if (!dryRun && changed) {
        pushSnapshot(state, 'before-migrate');
        state.worksDb.works = normalizedWorks;
      }
      output.push(changed ? (dryRun ? 'migrate: changes detected (dry-run).' : 'migrate: applied normalization.') : 'migrate: nothing to do.');
    } else if (command === 'undo') {
      if (!Array.isArray(state.history) || !state.history.length) {
        ok = false;
        output.push('undo: no history snapshots found.');
      } else {
        const snapshot = state.history.pop();
        const restored = snapshot.data;
        state.config = restored.config;
        state.worksDb = restored.worksDb;
        state.docsConfig = restored.docsConfig;
        state.docsPages = restored.docsPages;
        state.generated = restored.generated || null;
        output.push(`undo complete (restored ${snapshot.label})`);
      }
    } else {
      throw new Error(`Unknown command "${command}"`);
    }
  } catch (err) {
    ok = false;
    output.push(`error: ${err?.message || String(err)}`);
  }

  state.meta.updatedAt = nowIso();
  appendTranscript(state, argv, output, ok);

  return {
    ok,
    output,
    exportText,
    artifacts,
    state,
  };
}
