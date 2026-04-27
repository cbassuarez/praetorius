<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { withBase } from 'vitepress';

import {
  APPEARANCE_PALETTES,
  BUILTIN_SKINS,
  CURSOR_PRESETS,
  EFFECT_PRESETS,
  createDefaultProjectState,
  hydrateProjectState,
} from '../../../src/web/folio-runtime.js';
import { clearStoredProjectState, loadStoredProjectState, saveStoredProjectState } from './builder/storage';
import { createZipBlob } from './builder/zip';

const steps = [
  { id: 'project', label: 'Project', required: true },
  { id: 'works', label: 'Works', required: true },
  { id: 'theme', label: 'Theme', required: true },
  { id: 'generate', label: 'Generate', required: true },
];
const LINK_TYPES = Object.freeze([
  { value: 'page', label: 'Page / Section' },
  { value: 'website', label: 'Website' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
]);

const workerRef = ref(null);
const currentStepIndex = ref(0);
const optionalTab = ref('');
const mobilePreviewOpen = ref(false);
const launcherOpen = ref(true);
const busy = ref(false);
const statusLine = ref('Idle');
const copiedState = reactive({
  embed: false,
});
const stepError = ref('');
const toasts = ref([]);

const project = ref(hydrateProjectState(createDefaultProjectState()));
const generated = computed(() => cliGenerated.value || project.value.generated || null);
const works = computed(() => (project.value.worksDb?.works || []).slice());
const docsPages = ref((project.value.docsPages || []).slice());
const activeStep = computed(() => steps[currentStepIndex.value] || steps[0]);
const activeTab = computed(() => optionalTab.value || activeStep.value.id);
const optionalDocsActive = computed(() => optionalTab.value === 'docs');

const previewScale = ref('desktop');
const previewFrameTitle = ref('Folio Builder Preview');
const previewPending = ref(true);
const previewFrameLoading = ref(true);
const previewIframeRef = ref(null);
const previewContentHeight = ref(560);
const layoutRef = ref(null);
const splitterRef = ref(null);
const leftPanePct = ref(52);
const generatedFilesOpen = ref(false);
const deployGuidanceOpen = ref(false);
const monoColorHex = ref('#5e77bd');
const SPLIT_PANE_STORAGE_KEY = 'prae.builder.split.leftPct';
const previewSrc = computed(() => {
  const raw = String(cliGenerated.value?.previewUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return withBase(raw);
  return raw;
});
const previewSrcdoc = computed(() => {
  if (previewSrc.value) return '';
  if (cliGenerated.value?.embedHtml) return String(cliGenerated.value.embedHtml);
  return generated.value?.previewHtml || '';
});
const layoutStyle = computed(() => ({
  '--fb-left-pane': `${leftPanePct.value}%`,
}));
const showPreviewSkeleton = computed(() => {
  if (previewPending.value) return true;
  if (!previewSrc.value && !previewSrcdoc.value) return true;
  return previewFrameLoading.value;
});
const isMonoOnePalette = computed(() => themeForm.palette === 'mono-one');
const previewCanvasHeightPx = computed(() => Math.max(560, Math.min(4200, Number(previewContentHeight.value) || 560)));
const previewCanvasHeight = computed(() => `${previewCanvasHeightPx.value}px`);
const builderApiBase = withBase('/__prae_builder');
const builderApiReady = ref(false);
const cliGenerated = ref(null);

const projectForm = reactive({
  fullName: '',
  subtitle: '',
  listLabel: 'Works List',
  copyrightName: '',
});
const projectLinks = ref([{ label: 'Home', kind: 'page', value: 'home', external: false }]);

const docsForm = reactive({
  title: '',
  subtitle: '',
  description: '',
  accent: '',
  searchEngine: 'auto',
  includeInNav: false,
  includeOnHome: false,
});

const themeForm = reactive({
  skin: 'cards-tabs',
  uiRuntime: 'react',
  theme: 'dark',
  palette: 'orange-blue-white-silver',
  monoColor: 'oklch(0.62 0.09 250)',
  cursor: 'system',
  hoverEffect: 'balanced-neo',
  buttonEffect: 'balanced-neo',
});

const generateForm = reactive({
  embed: false,
  noUi: false,
  noCss: false,
  minify: false,
});

const selectedWorkId = ref(null);
const workDraft = reactive({
  title: '',
  slug: '',
  oneliner: '',
  description: '',
  audio: '',
  pdf: '',
  cover: '',
  tags: '',
  cues: [{ label: '@0:00', time: '0:00' }],
  scoreEnabled: false,
  scorePdfStartPage: 1,
  scoreMediaOffsetSec: 0,
  scoreRows: [{ at: '0:00', page: 1 }],
  scorePdfDelta: '',
});

const selectedDocPageId = ref(null);
const selectedDocPage = computed(() => {
  if (!selectedDocPageId.value) return null;
  return docsPages.value.find((page) => page.id === selectedDocPageId.value) || null;
});

const pending = new Map();
let reqCounter = 0;
let persistTimer = null;
let toastCounter = 0;
let previewResizeObserver = null;
let previewMutationObserver = null;
let previewHeightRaf = 0;
let panePointerId = null;
let paneCaptureTarget = null;

function icon(name) {
  return withBase(`/builder/icons/heroicons/24/outline/${name}.svg`);
}

function nextRequestId() {
  reqCounter += 1;
  return `req-${reqCounter}`;
}

function mapPreviewWidth() {
  if (previewScale.value === 'mobile') return '420px';
  if (previewScale.value === 'tablet') return '900px';
  return '100%';
}

const previewWidth = computed(mapPreviewWidth);
const previewZoom = computed(() => {
  if (previewScale.value === 'mobile') return 0.78;
  if (previewScale.value === 'tablet') return 0.66;
  return 1;
});
const previewDisplayHeight = computed(() => `${Math.max(380, Math.ceil(previewCanvasHeightPx.value * previewZoom.value))}px`);
const previewViewportStyle = computed(() => ({
  width: `${(100 / previewZoom.value).toFixed(3)}%`,
  height: `${(100 / previewZoom.value).toFixed(3)}%`,
  transform: `scale(${previewZoom.value})`,
  transformOrigin: 'top center',
}));

function normalizeHexColor(raw, fallback = '#5e77bd') {
  const text = String(raw || '').trim();
  if (!text) return fallback;
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return fallback;
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return `#${hex.slice(0, 6).toLowerCase()}`;
}

function cssColorToHex(value, fallback = '#5e77bd') {
  const normalized = normalizeHexColor(value, '');
  if (normalized) return normalized;
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const raw = String(value || '').trim();
  if (!raw || !(window.CSS && window.CSS.supports && window.CSS.supports('color', raw))) return fallback;
  const probe = document.createElement('span');
  probe.style.color = raw;
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  probe.remove();
  const channels = computed.match(/[\d.]+/g);
  if (!channels || channels.length < 3) return fallback;
  const [r, g, b] = channels.slice(0, 3).map((entry) => {
    const numeric = Math.max(0, Math.min(255, Math.round(Number(entry) || 0)));
    return numeric.toString(16).padStart(2, '0');
  });
  return `#${r}${g}${b}`;
}

function syncMonoColorHex() {
  monoColorHex.value = cssColorToHex(themeForm.monoColor, monoColorHex.value || '#5e77bd');
}

function onMonoColorInput(event) {
  const hex = cssColorToHex(event?.target?.value, monoColorHex.value || '#5e77bd');
  monoColorHex.value = hex;
  themeForm.monoColor = hex;
}

function clone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Vue proxies can fail structuredClone in some browsers/hydration paths.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function formatErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const text = String(err?.message || err || '').trim();
  if (!text) return fallback;
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

function formatBridgeFailure(payload, statusCode = 0) {
  const lines = [];
  const outputText = String(payload?.output || '').trim();
  const errorText = String(payload?.error || '').trim();
  if (outputText) lines.push(outputText.split('\n').filter(Boolean).slice(0, 6).join('\n'));
  if (errorText) lines.push(errorText);
  if (!lines.length && statusCode) lines.push(`HTTP ${statusCode}`);
  const compact = lines.join('\n').trim();
  return compact || 'CLI bridge generate failed.';
}

function pushToast(message, kind = 'info', durationMs = 4200) {
  toastCounter += 1;
  const id = `toast-${toastCounter}`;
  const entry = {
    id,
    kind,
    message: String(message || '').trim() || 'Update complete.',
  };
  toasts.value = [...toasts.value, entry];
  if (durationMs > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, durationMs);
  }
  return id;
}

function dismissToast(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function toBuilderLink(link) {
  const href = String(link?.href || '').trim();
  const lower = href.toLowerCase();
  if (lower.startsWith('mailto:')) {
    return {
      label: String(link?.label || ''),
      kind: 'email',
      value: href.replace(/^mailto:/i, ''),
      external: false,
    };
  }
  if (lower.startsWith('tel:')) {
    return {
      label: String(link?.label || ''),
      kind: 'phone',
      value: href.replace(/^tel:/i, ''),
      external: false,
    };
  }
  if (!href || href.startsWith('#') || href.startsWith('/')) {
    return {
      label: String(link?.label || ''),
      kind: 'page',
      value: href.replace(/^#/, ''),
      external: false,
    };
  }
  return {
    label: String(link?.label || ''),
    kind: 'website',
    value: href,
    external: link?.external !== false,
  };
}

function normalizeWebsiteValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '#';
  const lower = raw.toLowerCase();
  if (raw.startsWith('#') || raw.startsWith('/')) return raw;
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
  if (lower.startsWith('//')) return `https:${raw}`;
  return `https://${raw}`;
}

function normalizePageValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '#';
  if (raw.startsWith('#') || raw.startsWith('/')) return raw;
  return `#${raw.replace(/^#+/, '')}`;
}

function normalizeLinkDestination(link) {
  const kind = String(link?.kind || 'page');
  const value = String(link?.value || '').trim();
  if (kind === 'email') {
    const email = value.replace(/^mailto:/i, '').trim();
    return email ? `mailto:${email}` : '#';
  }
  if (kind === 'phone') {
    const phone = value.replace(/^tel:/i, '').trim();
    return phone ? `tel:${phone}` : '#';
  }
  if (kind === 'website') {
    return normalizeWebsiteValue(value);
  }
  return normalizePageValue(value);
}

function linkHintText(link) {
  const kind = String(link?.kind || 'page');
  if (kind === 'email') return 'Example: hello@artist.studio';
  if (kind === 'phone') return 'Example: +1 555 123 4567';
  if (kind === 'website') return 'Example: artistname.com';
  return 'Example: works or #contact';
}

function linkDestinationLabel(link) {
  const destination = normalizeLinkDestination(link);
  return destination === '#' ? 'Destination: root section (#)' : `Destination: ${destination}`;
}

function onProjectLinkKindChange(link) {
  const nextKind = String(link?.kind || 'page');
  if (nextKind === 'page' && !String(link?.value || '').trim()) {
    link.value = 'home';
  }
  if (nextKind === 'website') {
    link.external = true;
  } else {
    link.external = false;
  }
}

async function refreshPreviewSafely(contextLabel = '') {
  try {
    await refreshPreview();
    return true;
  } catch (err) {
    previewPending.value = false;
    if (!previewSrc.value && !previewSrcdoc.value) {
      previewFrameLoading.value = false;
    }
    const message = formatErrorMessage(err, 'Preview refresh failed.');
    const context = contextLabel ? `${contextLabel}. ` : '';
    pushToast(`${context}${message}`, 'warning', 5600);
    return false;
  }
}

function setStatus(text) {
  statusLine.value = text;
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveStoredProjectState(clone(project.value)).catch(() => {});
  }, 300);
}

async function workerCall(kind, payload = {}) {
  const worker = workerRef.value;
  if (!worker) throw new Error('worker unavailable');
  const id = nextRequestId();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, kind, ...payload });
  });
}

async function runCommand(argv, opts = {}) {
  busy.value = true;
  const commandText = `prae ${argv.join(' ')}`;
  setStatus(`Running ${commandText}`);
  try {
    const response = await workerCall('run', { argv });
    if (!response || typeof response !== 'object') throw new Error('invalid worker response');
    project.value = hydrateProjectState(response.state);
    syncFormsFromState();
    schedulePersist();
    if (!response.ok && !opts.allowFailure) {
      const output = Array.isArray(response.output) ? response.output.join('\n') : '';
      throw new Error(output || 'command failed');
    }
    setStatus(`${commandText} complete`);
    return response;
  } catch (err) {
    const message = formatErrorMessage(err, `${commandText} failed.`);
    setStatus(`Error: ${message}`);
    pushToast(message, 'error', 5600);
    throw err;
  } finally {
    busy.value = false;
  }
}

function makePayloadFromProjectForm() {
  const links = (projectLinks.value || [])
    .map((link) => ({
      label: String(link?.label || '').trim(),
      href: normalizeLinkDestination(link),
      external: String(link?.kind || 'page') === 'website' ? !!link?.external : false,
    }))
    .filter((link) => link.label || link.href !== '#');

  return {
    site: {
      fullName: projectForm.fullName,
      subtitle: projectForm.subtitle,
      listLabel: projectForm.listLabel,
      copyrightName: projectForm.copyrightName,
      links,
    },
  };
}

function normalizeWorkDraftPayload() {
  const cues = Array.isArray(workDraft.cues)
    ? workDraft.cues
        .map((cue) => ({
          label: String(cue?.label || '').trim() || '@0:00',
          t: String(cue?.time || '').trim() || '0:00',
        }))
        .filter((cue) => cue.label || cue.t)
    : [];

  const payload = {
    title: workDraft.title,
    slug: workDraft.slug,
    oneliner: workDraft.oneliner,
    description: workDraft.description,
    audio: workDraft.audio,
    pdf: workDraft.pdf,
    cover: workDraft.cover,
    tags: workDraft.tags,
    cues,
  };

  if (workDraft.scoreEnabled) {
    payload.score = {
      pdfStartPage: Number(workDraft.scorePdfStartPage) || 1,
      mediaOffsetSec: Number(workDraft.scoreMediaOffsetSec) || 0,
      pageMap: (Array.isArray(workDraft.scoreRows) ? workDraft.scoreRows : [])
        .map((row) => ({
          at: String(row?.at || '').trim() || '0:00',
          page: Math.max(1, Number(row?.page) || 1),
        }))
        .filter((row) => row.at),
      ...(String(workDraft.scorePdfDelta || '').trim() ? { pdfDelta: Number(workDraft.scorePdfDelta) || 0 } : {}),
    };
  } else {
    payload.score = null;
  }

  return payload;
}

function secondsToClock(input) {
  const sec = Math.max(0, Math.floor(Number(input) || 0));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function toCueRows(cues) {
  if (!Array.isArray(cues) || !cues.length) return [{ label: '@0:00', time: '0:00' }];
  return cues.map((cue) => {
    const raw = cue?.t;
    const time = typeof raw === 'number' ? secondsToClock(raw) : String(raw || '0:00');
    return {
      label: String(cue?.label || `@${time}`),
      time,
    };
  });
}

function toScoreRows(score) {
  if (!score || !Array.isArray(score.pageMap) || !score.pageMap.length) return [{ at: '0:00', page: 1 }];
  return score.pageMap.map((row) => ({
    at: typeof row?.at === 'number' ? secondsToClock(row.at) : String(row?.at || '0:00'),
    page: Math.max(1, Number(row?.page) || 1),
  }));
}

function resetWorkDraft() {
  selectedWorkId.value = null;
  workDraft.title = '';
  workDraft.slug = '';
  workDraft.oneliner = '';
  workDraft.description = '';
  workDraft.audio = '';
  workDraft.pdf = '';
  workDraft.cover = '';
  workDraft.tags = '';
  workDraft.cues = [{ label: '@0:00', time: '0:00' }];
  workDraft.scoreEnabled = false;
  workDraft.scorePdfStartPage = 1;
  workDraft.scoreMediaOffsetSec = 0;
  workDraft.scoreRows = [{ at: '0:00', page: 1 }];
  workDraft.scorePdfDelta = '';
}

function pickWork(work) {
  if (!work) return;
  selectedWorkId.value = Number(work.id);
  workDraft.title = work.title || '';
  workDraft.slug = work.slug || '';
  workDraft.oneliner = work.oneliner || work.one || '';
  workDraft.description = work.description || '';
  workDraft.audio = work.audio || '';
  workDraft.pdf = work.pdf || '';
  workDraft.cover = work.cover || '';
  workDraft.tags = Array.isArray(work.tags) ? work.tags.join(', ') : '';
  workDraft.cues = toCueRows(work.cues);
  workDraft.scoreEnabled = !!work.score;
  workDraft.scorePdfStartPage = Number(work.score?.pdfStartPage || 1);
  workDraft.scoreMediaOffsetSec = Number(work.score?.mediaOffsetSec || 0);
  workDraft.scoreRows = toScoreRows(work.score);
  workDraft.scorePdfDelta = work.score?.pdfDelta != null ? String(work.score.pdfDelta) : '';
}

function syncFormsFromState() {
  const cfg = project.value.config || {};
  const site = cfg.site || {};
  projectForm.fullName = site.fullName || '';
  projectForm.subtitle = site.subtitle || '';
  projectForm.listLabel = site.listLabel || 'Works List';
  projectForm.copyrightName = site.copyrightName || '';
  const links = Array.isArray(site.links) ? site.links : [];
  projectLinks.value = links.length
    ? links.map((link) => toBuilderLink(link))
    : [{ label: 'Home', kind: 'page', value: 'home', external: false }];

  const docsCfg = project.value.docsConfig || {};
  docsForm.title = docsCfg.site?.title || '';
  docsForm.subtitle = docsCfg.site?.subtitle || '';
  docsForm.description = docsCfg.site?.description || '';
  docsForm.accent = docsCfg.site?.accent || '';
  docsForm.searchEngine = docsCfg.search?.engine || 'auto';
  docsForm.includeInNav = !!docsCfg.works?.includeInNav;
  docsForm.includeOnHome = !!docsCfg.works?.includeOnHome;

  docsPages.value = Array.isArray(project.value.docsPages) ? clone(project.value.docsPages) : [];
  if (!docsPages.value.some((page) => page.id === selectedDocPageId.value)) {
    selectedDocPageId.value = docsPages.value[0]?.id || null;
  }

  themeForm.skin = cfg.ui?.skin || 'cards-tabs';
  themeForm.theme = cfg.theme === 'light' ? 'light' : 'dark';
  themeForm.palette = cfg.ui?.appearance?.theme?.palette || 'orange-blue-white-silver';
  themeForm.monoColor = cfg.ui?.appearance?.theme?.monoBaseOklch || 'oklch(0.62 0.09 250)';
  themeForm.cursor = cfg.ui?.appearance?.cursor?.preset || 'system';
  themeForm.hoverEffect = cfg.ui?.appearance?.effects?.hover || 'balanced-neo';
  themeForm.buttonEffect = cfg.ui?.appearance?.effects?.button || 'balanced-neo';
  if (themeForm.uiRuntime !== 'react' && themeForm.uiRuntime !== 'vanilla') {
    themeForm.uiRuntime = 'react';
  }
  syncMonoColorHex();
}

function syncDocPage(page) {
  const index = docsPages.value.findIndex((entry) => entry.id === page.id);
  if (index >= 0) docsPages.value[index] = page;
}

function addProjectLink() {
  projectLinks.value.push({ label: '', kind: 'website', value: '', external: true });
}

function removeProjectLink(index) {
  if (projectLinks.value.length <= 1) {
    projectLinks.value = [{ label: 'Home', kind: 'page', value: 'home', external: false }];
    return;
  }
  projectLinks.value.splice(index, 1);
}

function addCueRow() {
  workDraft.cues = Array.isArray(workDraft.cues) ? workDraft.cues : [];
  workDraft.cues.push({ label: '@0:00', time: '0:00' });
}

function removeCueRow(index) {
  const rows = Array.isArray(workDraft.cues) ? workDraft.cues : [];
  if (rows.length <= 1) {
    workDraft.cues = [{ label: '@0:00', time: '0:00' }];
    return;
  }
  rows.splice(index, 1);
  workDraft.cues = rows;
}

function addScoreRow() {
  workDraft.scoreRows = Array.isArray(workDraft.scoreRows) ? workDraft.scoreRows : [];
  workDraft.scoreRows.push({ at: '0:00', page: 1 });
}

function removeScoreRow(index) {
  const rows = Array.isArray(workDraft.scoreRows) ? workDraft.scoreRows : [];
  if (rows.length <= 1) {
    workDraft.scoreRows = [{ at: '0:00', page: 1 }];
    return;
  }
  rows.splice(index, 1);
  workDraft.scoreRows = rows;
}

async function addDocPage() {
  const n = docsPages.value.length + 1;
  const page = {
    id: `page-${n}`,
    title: `Page ${n}`,
    slug: `page-${n}`,
    hero: { kicker: '', title: `Page ${n}`, lede: '' },
    modules: [],
  };
  docsPages.value.push(page);
  selectedDocPageId.value = page.id;
  await applyDocsConfig({ refresh: false, notify: false });
}

async function removeDocPage(id) {
  docsPages.value = docsPages.value.filter((page) => page.id !== id);
  if (selectedDocPageId.value === id) {
    selectedDocPageId.value = docsPages.value[0]?.id || null;
  }
  await applyDocsConfig({ refresh: false, notify: false });
}

async function applyProjectTab(options = {}) {
  const refresh = options.refresh !== false;
  const notify = options.notify !== false;
  const payload = makePayloadFromProjectForm();
  await runCommand(['site', '--payload', JSON.stringify(payload)]);
  if (refresh) await refreshPreviewSafely('Project settings saved');
  if (notify) pushToast('Project details saved.', 'success');
}

async function applyThemeTab(options = {}) {
  const refresh = options.refresh !== false;
  const notify = options.notify !== false;
  const payload = {
    theme: themeForm.theme,
    ui: {
      skin: themeForm.skin,
      appearance: {
        theme: {
          palette: themeForm.palette,
          monoBaseOklch: themeForm.monoColor,
        },
        cursor: { preset: themeForm.cursor },
        effects: {
          hover: themeForm.hoverEffect,
          button: themeForm.buttonEffect,
        },
      },
    },
  };
  await runCommand(['config', '--payload', JSON.stringify(payload)]);
  if (refresh) await refreshPreviewSafely('Theme settings saved');
  if (notify) pushToast('Theme settings applied.', 'success');
}

async function saveWorkDraft() {
  const payload = normalizeWorkDraftPayload();
  if (selectedWorkId.value) {
    await runCommand(['edit', String(selectedWorkId.value), '--payload', JSON.stringify(payload)]);
  } else {
    await runCommand(['add', '--payload', JSON.stringify(payload)]);
    const newest = works.value[works.value.length - 1];
    if (newest) pickWork(newest);
  }
  await refreshPreviewSafely(selectedWorkId.value ? 'Work updated' : 'Work added');
}

async function deleteSelectedWork() {
  if (!selectedWorkId.value) return;
  await runCommand(['rm', String(selectedWorkId.value)]);
  resetWorkDraft();
  await refreshPreviewSafely('Work removed');
}

async function moveSelectedWork(delta) {
  if (!selectedWorkId.value) return;
  const index = works.value.findIndex((work) => Number(work.id) === Number(selectedWorkId.value));
  if (index < 0) return;
  const to = Math.max(1, Math.min(works.value.length, index + 1 + delta));
  await runCommand(['order', '--move', String(selectedWorkId.value), '--to', String(to)]);
  await refreshPreviewSafely('Work order updated');
}

async function addScoreForSelected() {
  if (!selectedWorkId.value) return;
  const payload = {
    pdfStartPage: Number(workDraft.scorePdfStartPage) || 1,
    mediaOffsetSec: Number(workDraft.scoreMediaOffsetSec) || 0,
    pageMap: (Array.isArray(workDraft.scoreRows) ? workDraft.scoreRows : []).map((row) => ({
      at: String(row?.at || '').trim() || '0:00',
      page: Math.max(1, Number(row?.page) || 1),
    })),
    ...(String(workDraft.scorePdfDelta || '').trim() ? { pdfDelta: Number(workDraft.scorePdfDelta) || 0 } : {}),
  };
  await runCommand(['score', 'add', String(selectedWorkId.value), '--payload', JSON.stringify(payload)]);
  await refreshPreviewSafely('Score mapping saved');
}

async function validateScoreForSelected() {
  if (!selectedWorkId.value) return;
  await runCommand(['score', 'validate', String(selectedWorkId.value)], { allowFailure: true });
}

async function validateWorks() {
  await runCommand(['validate'], { allowFailure: true });
}

async function importWorksFromFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const text = await file.text();
  const name = String(file.name || '').toLowerCase();

  if (name.endsWith('.json')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.__folioBuilderProject && parsed.project) {
        const next = hydrateProjectState(parsed.project);
        const response = await workerCall('hydrate', { state: next });
        project.value = hydrateProjectState(response.state);
        syncFormsFromState();
        cliGenerated.value = null;
        schedulePersist();
        launcherOpen.value = false;
        await refreshPreviewSafely('Project imported');
        event.target.value = '';
        return;
      }
    } catch (_err) {
      // fallback to import
    }
  }

  const format = name.endsWith('.csv') ? 'csv' : 'json';
  await runCommand(['import', '--format', format, '--payload', text, '--assume-new-id', '--assume-new-slug']);
  cliGenerated.value = null;
  launcherOpen.value = false;
  await refreshPreviewSafely('Works imported');
  event.target.value = '';
}

function downloadText(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportWorks(format) {
  const response = await runCommand(['export', '--format', format]);
  const text = String(response.exportText || '');
  downloadText(`works.${format === 'csv' ? 'csv' : 'json'}`, text, format === 'csv' ? 'text/csv' : 'application/json');
}

async function refreshPreview() {
  stepError.value = '';
  previewPending.value = true;
  previewFrameLoading.value = true;
  await checkBuilderApi();
  if (builderApiReady.value) {
    try {
      await runGenerateViaCliBridge();
      previewPending.value = false;
      return;
    } catch (err) {
      const message = formatErrorMessage(err, 'CLI bridge preview failed.');
      builderApiReady.value = false;
      setStatus(`Bridge fallback: ${message}`);
      pushToast(`CLI bridge preview failed. Switching to local preview mode. ${message}`, 'warning', 6000);
    }
  }
  setStatus('CLI bridge unavailable; using local compatibility preview.');
  const argv = ['generate', '--skin', themeForm.skin || 'cards-tabs', '--ui-runtime', themeForm.uiRuntime || 'react'];
  if (themeForm.palette) argv.push('--palette', themeForm.palette);
  if (themeForm.cursor) argv.push('--cursor', themeForm.cursor);
  if (themeForm.hoverEffect) argv.push('--hover-effect', themeForm.hoverEffect);
  if (themeForm.buttonEffect) argv.push('--button-effect', themeForm.buttonEffect);
  if (themeForm.palette === 'mono-one' && themeForm.monoColor) argv.push('--mono-color', themeForm.monoColor);
  if (generateForm.embed) argv.push('--embed');
  if (generateForm.noUi) argv.push('--no-ui');
  if (generateForm.noCss) argv.push('--no-css');
  if (generateForm.minify) argv.push('--minify');
  argv.push('--save-appearance');

  const response = await runCommand(argv);
  cliGenerated.value = null;
  if (response?.artifacts?.options?.skin) {
    previewFrameTitle.value = `Preview - ${response.artifacts.options.skin}`;
  }
  previewPending.value = false;
}

async function checkBuilderApi() {
  try {
    const response = await fetch(`${builderApiBase}/health`, { method: 'GET' });
    builderApiReady.value = response.ok;
  } catch {
    builderApiReady.value = false;
  }
}

function createBridgePayload() {
  return {
    project: {
      config: clone(project.value.config),
      worksDb: clone(project.value.worksDb),
      docsConfig: clone(project.value.docsConfig),
      docsPages: clone(docsPages.value),
    },
    generate: {
      skin: themeForm.skin,
      uiRuntime: themeForm.uiRuntime,
      embed: !!generateForm.embed,
      noUi: !!generateForm.noUi,
      noCss: !!generateForm.noCss,
      minify: !!generateForm.minify,
    },
  };
}

async function runGenerateViaCliBridge() {
  busy.value = true;
  setStatus('Running CLI parity generate');
  try {
    closeCliPreviewSession();
    const response = await fetch(`${builderApiBase}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBridgePayload()),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(formatBridgeFailure(payload, response.status));
    }
    cliGenerated.value = payload;
    if (generateForm.embed && payload.embedHtml) {
      copiedState.embed = false;
    }
    previewFrameTitle.value = `Preview - ${themeForm.skin}`;
    setStatus('CLI parity generate complete');
  } finally {
    busy.value = false;
  }
}

async function runGenerateTab() {
  await refreshPreview();
}

function generatedFileList() {
  if (Array.isArray(cliGenerated.value?.files) && cliGenerated.value.files.length) {
    return cliGenerated.value.files.map((name) => ({
      name,
      content: '',
      source: 'cli-bridge',
    }));
  }
  if (!generated.value || !generated.value.files) return [];
  const out = [];
  Object.entries(generated.value.files).forEach(([name, content]) => {
    const normalized = name === 'index' ? 'index.html' : name === 'embed' ? 'embed.html' : name;
    out.push({ name: normalized, content: String(content || ''), source: 'worker' });
  });
  return out;
}

const generatedFiles = computed(generatedFileList);

function scrollPreviewToTop() {
  try {
    const frame = previewIframeRef.value;
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    win?.scrollTo?.(0, 0);
    if (doc?.documentElement) doc.documentElement.scrollTop = 0;
    if (doc?.body) doc.body.scrollTop = 0;
  } catch {
    // ignore cross-origin scroll failures
  }
}

function onPreviewFrameLoad() {
  previewPending.value = false;
  previewFrameLoading.value = false;
  scrollPreviewToTop();
  setTimeout(scrollPreviewToTop, 80);
  setTimeout(scrollPreviewToTop, 320);
  queuePreviewHeightMeasure();
  bindPreviewObservers();
}

function clampPanePct(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 52;
  return Math.min(72, Math.max(34, numeric));
}

function updatePanePctFromClientX(clientX) {
  const node = layoutRef.value;
  if (!node) return;
  const rect = node.getBoundingClientRect();
  if (!rect.width) return;
  const pct = ((clientX - rect.left) / rect.width) * 100;
  leftPanePct.value = clampPanePct(pct);
}

function stopPaneResize() {
  window.removeEventListener('pointermove', onPanePointerMove);
  window.removeEventListener('pointerup', stopPaneResize);
  window.removeEventListener('pointercancel', stopPaneResize);
  window.removeEventListener('mouseleave', stopPaneResize);
  window.removeEventListener('blur', stopPaneResize);
  if (paneCaptureTarget && panePointerId != null && typeof paneCaptureTarget.releasePointerCapture === 'function') {
    try {
      paneCaptureTarget.releasePointerCapture(panePointerId);
    } catch {
      // ignore pointer capture release failures
    }
  }
  paneCaptureTarget = null;
  panePointerId = null;
  document.body.classList.remove('fb-is-resizing');
  try {
    window.localStorage?.setItem(SPLIT_PANE_STORAGE_KEY, String(leftPanePct.value));
  } catch {
    // ignore storage restrictions
  }
}

function onPanePointerMove(event) {
  if (event.buttons === 0) {
    stopPaneResize();
    return;
  }
  updatePanePctFromClientX(event.clientX);
}

function startPaneResize(event) {
  if (window.matchMedia('(max-width: 1280px)').matches) return;
  panePointerId = event.pointerId;
  paneCaptureTarget = event.currentTarget || splitterRef.value || null;
  if (paneCaptureTarget && panePointerId != null && typeof paneCaptureTarget.setPointerCapture === 'function') {
    try {
      paneCaptureTarget.setPointerCapture(panePointerId);
    } catch {
      // ignore pointer capture setup failures
    }
  }
  if (paneCaptureTarget && typeof paneCaptureTarget.addEventListener === 'function') {
    paneCaptureTarget.addEventListener('lostpointercapture', stopPaneResize, { once: true });
  }
  updatePanePctFromClientX(event.clientX);
  window.addEventListener('pointermove', onPanePointerMove);
  window.addEventListener('pointerup', stopPaneResize);
  window.addEventListener('pointercancel', stopPaneResize);
  window.addEventListener('mouseleave', stopPaneResize);
  window.addEventListener('blur', stopPaneResize);
  document.body.classList.add('fb-is-resizing');
}

function disconnectPreviewObservers() {
  if (previewResizeObserver) {
    previewResizeObserver.disconnect();
    previewResizeObserver = null;
  }
  if (previewMutationObserver) {
    previewMutationObserver.disconnect();
    previewMutationObserver = null;
  }
  if (previewHeightRaf) {
    cancelAnimationFrame(previewHeightRaf);
    previewHeightRaf = 0;
  }
}

function measurePreviewHeight() {
  previewHeightRaf = 0;
  const frame = previewIframeRef.value;
  if (!frame) return;
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    const html = doc.documentElement;
    const body = doc.body;
    const root = body?.firstElementChild;
    if (html) {
      html.style.minHeight = '0';
    }
    if (body) {
      body.style.minHeight = '0';
      body.style.margin = '0';
    }
    const layoutHeight = Number(layoutRef.value?.getBoundingClientRect?.().height || 0);
    const maxFrameHeight = layoutHeight > 0 ? Math.max(560, Math.floor(layoutHeight - 72)) : 2400;
    const nextHeight = Math.max(
      Number(root?.scrollHeight || 0),
      Number(root?.clientHeight || 0),
      Number(html?.scrollHeight || 0),
      Number(html?.offsetHeight || 0),
      Number(body?.scrollHeight || 0),
      Number(body?.offsetHeight || 0),
      560
    );
    previewContentHeight.value = Math.max(560, Math.min(maxFrameHeight, Math.ceil(nextHeight)));
  } catch {
    previewContentHeight.value = 560;
  }
}

function queuePreviewHeightMeasure() {
  if (previewHeightRaf) cancelAnimationFrame(previewHeightRaf);
  previewHeightRaf = requestAnimationFrame(measurePreviewHeight);
}

function bindPreviewObservers() {
  disconnectPreviewObservers();
  const frame = previewIframeRef.value;
  if (!frame || typeof window === 'undefined') return;
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    const html = doc.documentElement;
    const body = doc.body;
    if (window.ResizeObserver && html) {
      previewResizeObserver = new window.ResizeObserver(() => queuePreviewHeightMeasure());
      previewResizeObserver.observe(html);
      if (body) previewResizeObserver.observe(body);
    }
    if (window.MutationObserver && html) {
      previewMutationObserver = new window.MutationObserver(() => queuePreviewHeightMeasure());
      previewMutationObserver.observe(html, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
    queuePreviewHeightMeasure();
    setTimeout(queuePreviewHeightMeasure, 160);
    setTimeout(queuePreviewHeightMeasure, 520);
  } catch {
    // Ignore cross-origin or sandboxed preview documents.
  }
}

function downloadGeneratedFile(file) {
  if (file.source === 'cli-bridge' && cliGenerated.value?.token) {
    const safePath = String(file.name || '')
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const href = `${builderApiBase}/preview/${encodeURIComponent(cliGenerated.value.token)}/${safePath}`;
    const link = document.createElement('a');
    link.href = href;
    link.download = file.name;
    link.click();
    return;
  }
  downloadText(file.name, file.content, file.name.endsWith('.css') ? 'text/css' : file.name.endsWith('.html') ? 'text/html' : 'application/javascript');
}

function makeCliPreviewPath(fileName) {
  const token = String(cliGenerated.value?.token || '').trim();
  if (!token) return '';
  const safePath = String(fileName || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${builderApiBase}/preview/${encodeURIComponent(token)}/${safePath}`;
}

async function fetchCliGeneratedFileBytes(fileName) {
  const target = makeCliPreviewPath(fileName);
  if (!target) return null;
  const response = await fetch(target);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

async function copyEmbed() {
  const text = String(cliGenerated.value?.embedHtml || generated.value?.embedHtml || generated.value?.files?.embed || '');
  if (!text) return;
  await navigator.clipboard.writeText(text);
  copiedState.embed = true;
  setTimeout(() => {
    copiedState.embed = false;
  }, 1200);
}

function downloadZip(name, entries) {
  const blob = createZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function buildDistEntries() {
  const entries = {};
  if (cliGenerated.value?.token) {
    for (const file of generatedFiles.value) {
      const bytes = await fetchCliGeneratedFileBytes(file.name);
      if (bytes) entries[`dist/${file.name}`] = bytes;
    }
    return entries;
  }
  for (const file of generatedFiles.value) {
    entries[`dist/${file.name}`] = file.content;
  }
  return entries;
}

async function downloadDistArchive() {
  const entries = await buildDistEntries();
  if (!Object.keys(entries).length) return;
  downloadZip('praetorius-folio-dist.zip', entries);
}

async function downloadProjectArchive() {
  const distEntries = await buildDistEntries();
  const entries = {
    '.prae/works.json': `${JSON.stringify(clone(project.value.worksDb), null, 2)}\n`,
    '.prae/config.json': `${JSON.stringify(clone(project.value.config), null, 2)}\n`,
    '.prae/docs.json': `${JSON.stringify(clone(project.value.docsConfig), null, 2)}\n`,
    'docs/pages.json': `${JSON.stringify(clone(project.value.docsPages), null, 2)}\n`,
    'builder/project.json': `${JSON.stringify({ __folioBuilderProject: true, project: clone(project.value) }, null, 2)}\n`,
    ...distEntries,
  };
  downloadZip('praetorius-folio-project.zip', entries);
}

function resetLauncher() {
  launcherOpen.value = true;
}

async function quickstart(mode) {
  if (mode === 'new') {
    await runCommand(['init']);
    cliGenerated.value = null;
  }
  if (mode === 'sample') {
    await runCommand(['init']);
    cliGenerated.value = null;
  }
  if (mode === 'import') {
    const input = document.getElementById('folio-import-project');
    if (input) input.click();
    return;
  }
  launcherOpen.value = false;
  currentStepIndex.value = 0;
  await refreshPreviewSafely();
}

async function migrateProject(dryRun = false) {
  const argv = ['migrate'];
  if (dryRun) argv.push('--dry-run');
  await runCommand(argv);
  if (!dryRun) await refreshPreviewSafely('Migration complete');
}

async function undoProject() {
  await runCommand(['undo'], { allowFailure: true });
  await refreshPreviewSafely('Undo complete');
}

async function applyDocsConfig(options = {}) {
  const refresh = options.refresh !== false;
  const notify = options.notify !== false;
  const payload = {
    docsConfig: {
      site: {
        title: docsForm.title,
        subtitle: docsForm.subtitle,
        description: docsForm.description,
        accent: docsForm.accent,
      },
      search: {
        ...(project.value.docsConfig?.search || {}),
        engine: docsForm.searchEngine,
      },
      works: {
        ...(project.value.docsConfig?.works || {}),
        includeInNav: !!docsForm.includeInNav,
        includeOnHome: !!docsForm.includeOnHome,
      },
    },
    docsPages: docsPages.value.map((page) => ({
      ...page,
      modules: Array.isArray(page.modules) ? page.modules : [],
    })),
  };
  await runCommand(['docs', '--payload', JSON.stringify(payload)]);
  if (refresh) await refreshPreviewSafely('Docs settings saved');
  if (notify) pushToast('Docs settings saved.', 'success');
}

async function runDoctor() {
  await runCommand(['doctor', '--json'], { allowFailure: true });
}

async function clearLocalState() {
  await clearStoredProjectState();
  await runCommand(['init']);
  cliGenerated.value = null;
  currentStepIndex.value = 0;
  launcherOpen.value = true;
  await refreshPreviewSafely();
}

function canAdvanceFromCurrentStep() {
  if (activeStep.value.id === 'works') {
    if (!works.value.length) {
      stepError.value = 'Add at least one work before continuing.';
      return false;
    }
  }
  stepError.value = '';
  return true;
}

async function toggleOptionalDocs() {
  stepError.value = '';
  if (!optionalDocsActive.value) {
    optionalTab.value = 'docs';
    if (!selectedDocPageId.value && docsPages.value.length) {
      selectedDocPageId.value = docsPages.value[0].id;
    }
    return;
  }
  try {
    await applyDocsConfig({ refresh: false, notify: false });
    optionalTab.value = '';
    await refreshPreviewSafely('Docs saved');
  } catch (err) {
    stepError.value = formatErrorMessage(err, 'Unable to save docs yet.');
  }
}

function goToStep(index) {
  if (busy.value) return;
  const next = Math.max(0, Math.min(steps.length - 1, Number(index)));
  optionalTab.value = '';
  currentStepIndex.value = next;
  stepError.value = '';
}

async function nextStep() {
  if (!canAdvanceFromCurrentStep()) return;

  const leavingOptionalDocs = optionalDocsActive.value;
  const currentTab = activeTab.value;

  try {
    if (currentTab === 'project') {
      await applyProjectTab({ refresh: false, notify: false });
    } else if (currentTab === 'docs') {
      await applyDocsConfig({ refresh: false, notify: false });
    } else if (currentTab === 'theme') {
      await applyThemeTab({ refresh: false, notify: false });
    }
  } catch (err) {
    stepError.value = formatErrorMessage(err, 'Unable to save this step yet.');
    return;
  }

  if (leavingOptionalDocs) {
    optionalTab.value = '';
  }
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value += 1;
  }

  if (currentTab === 'project' || currentTab === 'docs' || currentTab === 'theme') {
    await refreshPreviewSafely();
  }
}

async function prevStep() {
  stepError.value = '';
  if (optionalDocsActive.value) {
    try {
      await applyDocsConfig({ refresh: false, notify: false });
      optionalTab.value = '';
      await refreshPreviewSafely('Docs saved');
    } catch (err) {
      stepError.value = formatErrorMessage(err, 'Unable to save docs yet.');
    }
    return;
  }
  if (currentStepIndex.value > 0) {
    currentStepIndex.value -= 1;
  }
}

function onWorkerMessage(event) {
  const message = event.data;
  if (!message || !message.id) return;
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  entry.resolve(message);
}

async function bootWorker() {
  const worker = new Worker(new URL('./builder/folio.worker.ts', import.meta.url), { type: 'module' });
  workerRef.value = worker;
  worker.addEventListener('message', onWorkerMessage);

  const stored = await loadStoredProjectState();
  if (stored) {
    const hydrated = await workerCall('hydrate', { state: stored });
    project.value = hydrateProjectState(hydrated.state);
    launcherOpen.value = false;
  } else {
    const initial = await workerCall('get');
    project.value = hydrateProjectState(initial.state);
  }

  syncFormsFromState();
  await checkBuilderApi();
  await nextTick();
  await refreshPreviewSafely();
}

watch(
  () => selectedWorkId.value,
  (id) => {
    if (!id) return;
    const target = works.value.find((work) => Number(work.id) === Number(id));
    if (target) pickWork(target);
  }
);

watch(
  () => [previewSrc.value, previewSrcdoc.value],
  ([src, srcdoc]) => {
    disconnectPreviewObservers();
    previewContentHeight.value = 560;
    if (src || srcdoc) {
      previewFrameLoading.value = true;
    }
  }
);

watch(
  () => themeForm.palette,
  (palette) => {
    if (palette === 'mono-one') syncMonoColorHex();
  }
);

watch(
  () => themeForm.monoColor,
  () => {
    if (themeForm.palette === 'mono-one') syncMonoColorHex();
  }
);

onMounted(async () => {
  try {
    const saved = window.localStorage?.getItem(SPLIT_PANE_STORAGE_KEY);
    if (saved != null) {
      leftPanePct.value = clampPanePct(Number(saved));
    }
  } catch {
    // ignore storage restrictions
  }
  await bootWorker();
});

function closeCliPreviewSession() {
  const token = String(cliGenerated.value?.token || '').trim();
  if (!token) return;
  fetch(`${builderApiBase}/close/${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
}

onBeforeUnmount(() => {
  stopPaneResize();
  disconnectPreviewObservers();
  closeCliPreviewSession();
  if (persistTimer) clearTimeout(persistTimer);
  if (workerRef.value) {
    workerRef.value.removeEventListener('message', onWorkerMessage);
    workerRef.value.terminate();
  }
});
</script>

<template>
  <section class="folio-builder" data-builder-surface="folio-builder">
    <header class="folio-builder__header">
      <div class="folio-builder__identity">
        <img :src="icon('sparkles')" alt="" aria-hidden="true" />
        <div>
          <p class="folio-builder__kicker">Praetorius</p>
          <h1>Folio Builder</h1>
          <p>CLI-powered web studio for score-centric portfolio publishing.</p>
        </div>
      </div>
      <div class="folio-builder__header-actions">
        <button class="fb-btn" type="button" @click="resetLauncher">Quickstart</button>
        <button class="fb-btn" type="button" @click="clearLocalState">Reset Local</button>
        <span class="folio-builder__status">{{ statusLine }}</span>
      </div>
    </header>

    <transition-group name="fb-toast" tag="section" class="fb-toast-stack" aria-live="polite" aria-label="Builder alerts">
      <article v-for="toast in toasts" :key="toast.id" class="fb-toast" :class="[`is-${toast.kind}`]">
        <p>{{ toast.message }}</p>
        <button class="fb-btn fb-btn--icon" type="button" aria-label="Dismiss message" @click="dismissToast(toast.id)">Close</button>
      </article>
    </transition-group>

    <section v-if="launcherOpen" class="folio-builder__launcher fb-panel">
      <h2>Build Portfolio</h2>
      <p>Choose a launch path to start or continue your folio project.</p>
      <div class="folio-builder__launcher-grid">
        <button class="fb-tile" type="button" @click="quickstart('new')">
          <img :src="icon('document-text')" alt="" aria-hidden="true" />
          <span>Start New</span>
        </button>
        <button class="fb-tile" type="button" @click="quickstart('import')">
          <img :src="icon('arrow-up-right')" alt="" aria-hidden="true" />
          <span>Import Project</span>
        </button>
        <button class="fb-tile" type="button" @click="quickstart('sample')">
          <img :src="icon('eye')" alt="" aria-hidden="true" />
          <span>Load Sample Set</span>
        </button>
      </div>
      <input id="folio-import-project" type="file" accept=".json,.csv" hidden @change="importWorksFromFile" />
    </section>

    <template v-if="!launcherOpen">
    <nav class="folio-builder__tabs" aria-label="Folio builder steps">
      <div class="folio-builder__tabs-track">
        <button
          v-for="(step, idx) in steps"
          :key="step.id"
          class="fb-step"
          :class="{
            'is-active': currentStepIndex === idx && !optionalDocsActive,
            'is-complete': idx < currentStepIndex,
          }"
          :disabled="busy"
          type="button"
          @click="goToStep(idx)"
        >
          <span class="fb-step__index">{{ idx + 1 }}</span>
          <span class="fb-step__label">{{ step.label }}</span>
        </button>
      </div>
      <button class="fb-step fb-step--optional" :class="{ 'is-active': optionalDocsActive }" :disabled="busy" type="button" @click="toggleOptionalDocs">
        <span class="fb-step__index">+</span>
        <span class="fb-step__label">Docs</span>
        <span class="fb-step__meta">Optional</span>
      </button>
    </nav>

    <div ref="layoutRef" class="folio-builder__layout" :style="layoutStyle">
      <section class="folio-builder__workspace fb-panel">
        <article v-if="activeTab === 'project'" class="fb-tabpanel">
          <h2>Project Identity</h2>
          <div class="fb-field-grid">
            <label>
              Full name
              <input v-model="projectForm.fullName" type="text" placeholder="Your Name" />
            </label>
            <label>
              Subtitle
              <input v-model="projectForm.subtitle" type="text" placeholder="Selected works" />
            </label>
            <label>
              Works label
              <input v-model="projectForm.listLabel" type="text" placeholder="Works List" />
            </label>
            <label>
              Copyright name
              <input v-model="projectForm.copyrightName" type="text" placeholder="Name for footer" />
            </label>
          </div>
          <section class="fb-collection">
            <div class="fb-collection__head">
              <h3>Links</h3>
              <button class="fb-btn" type="button" @click="addProjectLink">Add Link</button>
            </div>
            <div class="fb-link-head" aria-hidden="true">
              <span>Label</span>
              <span>Type</span>
              <span>Destination</span>
              <span>New tab</span>
              <span>Action</span>
            </div>
            <div v-for="(link, index) in projectLinks" :key="`project-link-${index}`" class="fb-row-grid fb-link-row">
              <input v-model="link.label" class="fb-link-input" type="text" placeholder="Home" :aria-label="`Label for link ${index + 1}`" />
              <select v-model="link.kind" class="fb-link-input" :aria-label="`Destination type for ${link.label || `link ${index + 1}`}`" @change="onProjectLinkKindChange(link)">
                <option v-for="kind in LINK_TYPES" :key="kind.value" :value="kind.value">{{ kind.label }}</option>
              </select>
              <label class="fb-link-destination">
                <input
                  v-model="link.value"
                  type="text"
                  :placeholder="linkHintText(link)"
                  :aria-label="`Destination for ${link.label || 'link'}`"
                />
                <span class="fb-link-hint">{{ linkDestinationLabel(link) }}</span>
              </label>
              <label class="fb-inline-toggle fb-link-external">
                <span class="fb-link-mobile-label">Open in new tab</span>
                <input
                  v-model="link.external"
                  type="checkbox"
                  :disabled="link.kind !== 'website'"
                  :aria-label="`Open ${link.label || 'link'} in a new tab`"
                />
              </label>
              <button class="fb-btn fb-link-remove" type="button" @click="removeProjectLink(index)">Remove</button>
            </div>
          </section>
          <div class="fb-actions">
            <button class="fb-btn fb-btn--accent" :disabled="busy" type="button" @click="applyProjectTab">Apply Project</button>
            <button class="fb-btn" :disabled="busy" type="button" @click="migrateProject(true)">Dry-run Migrate</button>
            <button class="fb-btn" :disabled="busy" type="button" @click="migrateProject(false)">Migrate</button>
            <button class="fb-btn" :disabled="busy" type="button" @click="undoProject">Undo</button>
          </div>
        </article>

        <article v-else-if="activeTab === 'works'" class="fb-tabpanel">
          <h2>Works Catalog</h2>
          <div class="fb-works-shell">
            <aside class="fb-works-list">
              <div class="fb-works-list__head">
                <button class="fb-btn" type="button" @click="resetWorkDraft">New Work</button>
                <button class="fb-btn" :disabled="busy" type="button" @click="validateWorks">Validate</button>
              </div>
              <ul>
                <li v-for="work in works" :key="work.id">
                  <button class="fb-work-item" :class="{ 'is-active': Number(work.id) === Number(selectedWorkId) }" type="button" @click="pickWork(work)">
                    <strong>{{ work.title }}</strong>
                    <span>{{ work.slug }}</span>
                  </button>
                </li>
              </ul>
            </aside>
            <section class="fb-work-editor">
              <div class="fb-field-grid">
                <label>
                  Title
                  <input v-model="workDraft.title" type="text" />
                </label>
                <label>
                  Slug
                  <input v-model="workDraft.slug" type="text" />
                </label>
                <label>
                  Oneliner
                  <input v-model="workDraft.oneliner" type="text" />
                </label>
                <label>
                  Tags (comma-separated)
                  <input v-model="workDraft.tags" type="text" />
                </label>
                <label>
                  Audio URL
                  <input v-model="workDraft.audio" type="url" />
                </label>
                <label>
                  PDF URL
                  <input v-model="workDraft.pdf" type="url" />
                </label>
                <label>
                  Cover URL
                  <input v-model="workDraft.cover" type="url" />
                </label>
              </div>
              <label>
                Description
                <textarea v-model="workDraft.description" rows="4" />
              </label>
              <section class="fb-collection">
                <div class="fb-collection__head">
                  <h3>Cues</h3>
                  <button class="fb-btn" type="button" @click="addCueRow">Add Cue</button>
                </div>
                <div v-for="(cue, index) in workDraft.cues" :key="`cue-${index}`" class="fb-row-grid">
                  <label>
                    Label
                    <input v-model="cue.label" type="text" placeholder="@0:00" />
                  </label>
                  <label>
                    Time
                    <input v-model="cue.time" type="text" placeholder="mm:ss" />
                  </label>
                  <button class="fb-btn" type="button" @click="removeCueRow(index)">Remove</button>
                </div>
              </section>

              <details class="fb-advanced" :open="workDraft.scoreEnabled">
                <summary>
                  <span>Advanced: Score / Page Follow</span>
                  <label class="fb-toggle">
                    <input v-model="workDraft.scoreEnabled" type="checkbox" />
                    Enabled
                  </label>
                </summary>
                <div class="fb-field-grid">
                  <label>
                    PDF start page
                    <input v-model.number="workDraft.scorePdfStartPage" type="number" min="1" />
                  </label>
                  <label>
                    Media offset seconds
                    <input v-model.number="workDraft.scoreMediaOffsetSec" type="number" />
                  </label>
                  <label>
                    PDF delta
                    <input v-model="workDraft.scorePdfDelta" type="number" />
                  </label>
                </div>
                <section class="fb-collection">
                  <div class="fb-collection__head">
                    <h3>Score Map</h3>
                    <button class="fb-btn" type="button" @click="addScoreRow">Add Row</button>
                  </div>
                  <div v-for="(row, index) in workDraft.scoreRows" :key="`score-row-${index}`" class="fb-row-grid">
                    <label>
                      Time
                      <input v-model="row.at" type="text" placeholder="mm:ss" />
                    </label>
                    <label>
                      Page
                      <input v-model.number="row.page" type="number" min="1" />
                    </label>
                    <button class="fb-btn" type="button" @click="removeScoreRow(index)">Remove</button>
                  </div>
                </section>
	              <div class="fb-actions fb-actions--works-score">
	                  <button class="fb-btn" :disabled="!selectedWorkId || busy" type="button" @click="addScoreForSelected">Save Score</button>
	                  <button class="fb-btn" :disabled="!selectedWorkId || busy" type="button" @click="validateScoreForSelected">Validate Score</button>
	                </div>
	              </details>

	              <div class="fb-actions fb-actions--works-main">
	                <button class="fb-btn fb-btn--accent" :disabled="busy" type="button" @click="saveWorkDraft">{{ selectedWorkId ? 'Update Work' : 'Add Work' }}</button>
	                <button class="fb-btn" :disabled="!selectedWorkId || busy" type="button" @click="deleteSelectedWork">Delete</button>
	                <button class="fb-btn" :disabled="!selectedWorkId || busy" type="button" @click="moveSelectedWork(-1)">Move Up</button>
	                <button class="fb-btn" :disabled="!selectedWorkId || busy" type="button" @click="moveSelectedWork(1)">Move Down</button>
	              </div>

	              <details class="fb-advanced">
	                <summary>Advanced: Import / Export</summary>
	                <div class="fb-actions fb-actions--works-import">
	                  <input type="file" accept=".json,.csv" @change="importWorksFromFile" />
	                  <button class="fb-btn" :disabled="busy" type="button" @click="exportWorks('json')">Export JSON</button>
	                  <button class="fb-btn" :disabled="busy" type="button" @click="exportWorks('csv')">Export CSV</button>
	                </div>
	              </details>
            </section>
          </div>
        </article>

        <article v-else-if="activeTab === 'docs'" class="fb-tabpanel">
          <h2>Docs Reader Blocks</h2>
          <p class="fb-note">Blocks-only authoring for docs-reader modules.</p>
          <div class="fb-field-grid">
            <label>
              Site title
              <input v-model="docsForm.title" type="text" />
            </label>
            <label>
              Subtitle
              <input v-model="docsForm.subtitle" type="text" />
            </label>
            <label>
              Accent
              <input v-model="docsForm.accent" type="text" placeholder="#ff8a30 or token" />
            </label>
            <label>
              Search engine
              <select v-model="docsForm.searchEngine">
                <option value="auto">auto</option>
                <option value="light">light</option>
                <option value="fuse">fuse</option>
                <option value="none">none</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea v-model="docsForm.description" rows="3" />
          </label>
          <div class="fb-inline-toggle">
            <label><input v-model="docsForm.includeInNav" type="checkbox" /> Include works in nav</label>
            <label><input v-model="docsForm.includeOnHome" type="checkbox" /> Include works on home</label>
          </div>

          <div class="fb-docs-shell">
            <aside class="fb-doc-pages">
              <div class="fb-actions">
                <button class="fb-btn" type="button" @click="addDocPage">Add Page</button>
              </div>
              <ul>
                <li v-for="page in docsPages" :key="page.id">
                  <button class="fb-work-item" :class="{ 'is-active': page.id === selectedDocPageId }" type="button" @click="selectedDocPageId = page.id">
                    <strong>{{ page.title }}</strong>
                    <span>{{ page.slug }}</span>
                  </button>
                </li>
              </ul>
            </aside>

            <section v-if="selectedDocPage" class="fb-doc-editor">
              <div class="fb-field-grid">
                <label>
                  Page title
                  <input v-model="selectedDocPage.title" type="text" />
                </label>
                <label>
                  Slug
                  <input v-model="selectedDocPage.slug" type="text" />
                </label>
                <label>
                  Hero kicker
                  <input v-model="selectedDocPage.hero.kicker" type="text" />
                </label>
                <label>
                  Hero title
                  <input v-model="selectedDocPage.hero.title" type="text" />
                </label>
              </div>
              <label>
                Hero lede
                <textarea v-model="selectedDocPage.hero.lede" rows="2" />
              </label>
              <p class="fb-note">Module authoring uses visual forms in the next pass. Existing modules in imported projects are preserved and generated through CLI parity mode.</p>

              <div class="fb-actions">
                <button class="fb-btn fb-btn--accent" :disabled="busy" type="button" @click="applyDocsConfig">Apply Docs</button>
                <button class="fb-btn" :disabled="busy" type="button" @click="removeDocPage(selectedDocPage.id)">Delete Page</button>
              </div>
            </section>
          </div>
        </article>

        <article v-else-if="activeTab === 'theme'" class="fb-tabpanel">
          <h2>Global Appearance</h2>
          <p class="fb-note">Mode-only light/dark toggles inside your selected palette.</p>
          <div class="fb-field-grid">
            <label>
              Skin
              <select v-model="themeForm.skin">
                <option v-for="skin in BUILTIN_SKINS" :key="skin" :value="skin">{{ skin }}</option>
              </select>
            </label>
            <label>
              UI runtime
              <select v-model="themeForm.uiRuntime">
                <option value="react">react</option>
                <option value="vanilla">vanilla</option>
              </select>
            </label>
            <label>
              Theme mode
              <select v-model="themeForm.theme">
                <option value="dark">dark</option>
                <option value="light">light</option>
              </select>
            </label>
            <label>
              Palette
              <select v-model="themeForm.palette">
                <option v-for="palette in APPEARANCE_PALETTES" :key="palette" :value="palette">{{ palette }}</option>
              </select>
            </label>
            <label>
              Cursor
              <select v-model="themeForm.cursor">
                <option v-for="cursor in CURSOR_PRESETS" :key="cursor" :value="cursor">{{ cursor }}</option>
              </select>
            </label>
            <label>
              Hover effect
              <select v-model="themeForm.hoverEffect">
                <option v-for="effect in EFFECT_PRESETS" :key="effect" :value="effect">{{ effect }}</option>
              </select>
            </label>
            <label>
              Button effect
              <select v-model="themeForm.buttonEffect">
                <option v-for="effect in EFFECT_PRESETS" :key="effect" :value="effect">{{ effect }}</option>
              </select>
            </label>
	            <label v-if="isMonoOnePalette" class="fb-mono-color-field">
	              Mono color
	              <div class="fb-mono-color-control" :style="{ '--fb-mono-color': monoColorHex }">
	                <input :value="monoColorHex" type="color" aria-label="Select monochrome base color" @input="onMonoColorInput" />
	                <span class="fb-mono-color-bar" aria-hidden="true" />
	                <span class="fb-mono-color-code">{{ monoColorHex.toUpperCase() }}</span>
	              </div>
	            </label>
	          </div>
	          <div class="fb-actions">
	            <button class="fb-btn fb-btn--accent" :disabled="busy" type="button" @click="applyThemeTab">Apply Theme</button>
	            <button class="fb-btn" :disabled="busy" type="button" @click="runDoctor">Run Doctor</button>
          </div>
        </article>

        <article v-else class="fb-tabpanel">
          <h2>Generate + Export</h2>
          <p class="fb-note">Skin and runtime are configured in Theme. This step is output-only.</p>
          <div class="fb-field-grid fb-field-grid--single">
            <label class="fb-inline-toggle"><input v-model="generateForm.embed" type="checkbox" /> Embed output</label>
            <label class="fb-inline-toggle"><input v-model="generateForm.noUi" type="checkbox" /> No UI bundle</label>
            <label class="fb-inline-toggle"><input v-model="generateForm.noCss" type="checkbox" /> No CSS</label>
            <label class="fb-inline-toggle"><input v-model="generateForm.minify" type="checkbox" /> Minify</label>
          </div>
          <div class="fb-actions">
            <button class="fb-btn fb-btn--accent" :disabled="busy" type="button" @click="runGenerateTab">Generate</button>
            <button class="fb-btn" :disabled="!generated" type="button" @click="downloadDistArchive">Download dist zip</button>
            <button class="fb-btn" :disabled="!generated" type="button" @click="downloadProjectArchive">Download project zip</button>
            <button class="fb-btn" :disabled="!generated" type="button" @click="copyEmbed">{{ copiedState.embed ? 'Embed Copied' : 'Copy embed' }}</button>
          </div>

	          <section class="fb-advanced fb-advanced--collapsible">
	            <button
	              class="fb-advanced__toggle"
	              type="button"
	              :aria-expanded="generatedFilesOpen ? 'true' : 'false'"
	              @click="generatedFilesOpen = !generatedFilesOpen"
	            >
	              <span>Generated files</span>
	              <img :src="icon(generatedFilesOpen ? 'chevron-up' : 'chevron-down')" alt="" aria-hidden="true" />
	            </button>
	            <div v-if="generatedFilesOpen" class="fb-advanced__body">
	              <ul class="fb-file-list">
	                <li v-for="file in generatedFiles" :key="file.name">
	                  <span>{{ file.name }}</span>
	                  <button class="fb-btn" type="button" @click="downloadGeneratedFile(file)">Download</button>
	                </li>
	              </ul>
	            </div>
	          </section>

	          <section class="fb-advanced fb-advanced--collapsible">
	            <button
	              class="fb-advanced__toggle"
	              type="button"
	              :aria-expanded="deployGuidanceOpen ? 'true' : 'false'"
	              @click="deployGuidanceOpen = !deployGuidanceOpen"
	            >
	              <span>Deploy guidance</span>
	              <img :src="icon(deployGuidanceOpen ? 'chevron-up' : 'chevron-down')" alt="" aria-hidden="true" />
	            </button>
	            <div v-if="deployGuidanceOpen" class="fb-advanced__body">
	              <p class="fb-note">Download your dist archive for hosting, or copy embed HTML for CMS placement.</p>
	            </div>
	          </section>
	        </article>

        <div class="fb-step-controls">
          <button class="fb-btn" :disabled="busy || (!optionalDocsActive && currentStepIndex === 0)" type="button" @click="prevStep">
            {{ optionalDocsActive ? 'Close Docs' : 'Back' }}
          </button>
          <button
            class="fb-btn fb-btn--accent"
            :disabled="busy || (!optionalDocsActive && currentStepIndex >= steps.length - 1)"
            type="button"
            @click="nextStep"
          >
            {{ optionalDocsActive ? 'Save + Next' : 'Next' }}
          </button>
        </div>
        <p v-if="stepError" class="fb-step-error">{{ stepError }}</p>
      </section>

	      <div
	        ref="splitterRef"
	        class="folio-builder__splitter"
	        role="separator"
	        aria-label="Resize editor and preview panes"
	        aria-orientation="vertical"
	        @pointerdown.prevent="startPaneResize"
      />

      <aside class="folio-builder__preview fb-panel">
        <div class="folio-builder__preview-head">
          <h3>{{ previewFrameTitle }}</h3>
          <div class="fb-preview-controls">
            <button class="fb-btn" type="button" aria-label="Preview desktop width" @click="previewScale = 'desktop'">
              <img :src="icon('arrows-pointing-out')" alt="" aria-hidden="true" />
            </button>
            <button class="fb-btn" type="button" aria-label="Preview tablet width" @click="previewScale = 'tablet'">
              <img :src="icon('arrows-pointing-in')" alt="" aria-hidden="true" />
            </button>
            <button class="fb-btn" type="button" aria-label="Preview mobile width" @click="previewScale = 'mobile'">
              <img :src="icon('eye')" alt="" aria-hidden="true" />
            </button>
            <button class="fb-btn" :disabled="busy" type="button" aria-label="Refresh preview" @click="refreshPreview">
              <img :src="icon('arrow-path')" alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="folio-builder__preview-frame" :style="{ width: previewWidth }">
          <div v-if="showPreviewSkeleton" class="fb-preview-skeleton" aria-hidden="true">
            <div class="fb-preview-skeleton__bar is-title" />
            <div class="fb-preview-skeleton__bar is-line" />
            <div class="fb-preview-skeleton__bar is-line short" />
            <div class="fb-preview-skeleton__panel">
              <div class="fb-preview-skeleton__chip" />
              <div class="fb-preview-skeleton__chip" />
              <div class="fb-preview-skeleton__chip" />
            </div>
            <p v-if="!previewSrc && !previewSrcdoc" class="fb-preview-skeleton__caption">
              {{ previewPending ? 'Generating preview…' : 'Run Generate to create preview.' }}
            </p>
          </div>
          <div v-if="previewSrc || previewSrcdoc" class="folio-builder__preview-viewport" :style="previewViewportStyle">
	            <iframe
	              v-if="previewSrc"
	              ref="previewIframeRef"
	              :title="previewFrameTitle"
	              :src="previewSrc"
	              loading="lazy"
	              scrolling="auto"
	              @load="onPreviewFrameLoad"
	            />
	            <iframe
	              v-else-if="previewSrcdoc"
	              ref="previewIframeRef"
	              :title="previewFrameTitle"
	              :srcdoc="previewSrcdoc"
	              loading="lazy"
	              scrolling="auto"
	              @load="onPreviewFrameLoad"
	            />
          </div>
	        </div>
	      </aside>
    </div>

    <button class="folio-builder__mobile-toggle" type="button" @click="mobilePreviewOpen = !mobilePreviewOpen">
      <img :src="icon(mobilePreviewOpen ? 'x-mark' : 'play')" alt="" aria-hidden="true" />
      {{ mobilePreviewOpen ? 'Close Preview' : 'Open Preview' }}
    </button>

    <transition name="fb-sheet">
      <section v-if="mobilePreviewOpen" class="folio-builder__mobile-sheet fb-panel">
        <div class="folio-builder__preview-head">
          <h3>{{ previewFrameTitle }}</h3>
          <button class="fb-btn" type="button" @click="mobilePreviewOpen = false">Close</button>
        </div>
        <iframe v-if="previewSrc" :title="`${previewFrameTitle} mobile`" :src="previewSrc" loading="lazy" @load="onPreviewFrameLoad" />
        <iframe v-else-if="previewSrcdoc" :title="`${previewFrameTitle} mobile`" :srcdoc="previewSrcdoc" loading="lazy" @load="onPreviewFrameLoad" />
      </section>
    </transition>
    </template>
  </section>
</template>

<style scoped>
.folio-builder {
  --fb-bg: #ffffff;
  --fb-surface: #ffffff;
  --fb-surface-2: #f7f7f7;
  --fb-line: #000000;
  --fb-text: #000000;
  --fb-accent: #000000;
  --fb-shadow: 6px 6px 0 color-mix(in srgb, #2c6bff 30%, transparent);
  --fb-shadow-2d: 4px 4px 0 color-mix(in srgb, #2c6bff 28%, transparent);
  display: grid;
  gap: 14px;
  width: 100%;
  min-height: calc(100vh - 120px);
  padding: 8px;
  background: var(--fb-bg);
  color: var(--fb-text);
}

.folio-builder__header,
.fb-panel,
.folio-builder__tabs,
.folio-builder__mobile-toggle {
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface);
  box-shadow: var(--fb-shadow);
}

.folio-builder__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  gap: 14px;
  background: var(--fb-surface);
}

.folio-builder__identity {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.folio-builder__identity img {
  width: 28px;
  height: 28px;
}

.folio-builder__kicker {
  margin: 0;
  font: 700 12px/1.1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.folio-builder__identity h1 {
  margin: 2px 0 4px;
  font: 500 clamp(28px, 4vw, 44px)/1 "Instrument Serif", serif;
}

.folio-builder__identity p {
  margin: 0;
  font: 500 14px/1.35 "Space Grotesk", ui-sans-serif, sans-serif;
}

.folio-builder__header-actions {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.folio-builder__status {
  font: 500 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  opacity: .78;
}

.folio-builder__launcher {
  padding: 14px;
  display: grid;
  gap: 10px;
  background: var(--fb-surface);
}

.folio-builder__launcher h2 {
  margin: 0;
  font: 700 28px/1.1 "IBM Plex Mono", ui-monospace, monospace;
}

.folio-builder__launcher p {
  margin: 0;
  font: 500 14px/1.3 "Space Grotesk", ui-sans-serif, sans-serif;
}

.folio-builder__launcher-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.fb-tile {
  appearance: none;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface-2);
  display: grid;
  gap: 8px;
  justify-items: start;
  align-content: center;
  min-height: 92px;
  padding: 10px;
  cursor: pointer;
  font: 700 13px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  transition: transform .2s ease, box-shadow .2s ease;
}

.fb-tile img {
  width: 18px;
  height: 18px;
}

.fb-tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--fb-shadow-2d);
}

.folio-builder__tabs {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: var(--fb-surface);
}

.folio-builder__tabs-track {
  display: flex;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  padding-bottom: 2px;
}

.fb-step {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface-2);
  padding: 8px 10px;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .04em;
  text-transform: uppercase;
  box-shadow: var(--fb-shadow-2d);
  cursor: pointer;
}

.fb-step:disabled {
  opacity: .58;
  cursor: not-allowed;
}

.fb-step__meta {
  font: 700 10px/1 "IBM Plex Mono", ui-monospace, monospace;
  opacity: .74;
}

.fb-step__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-radius: 2px;
  font: 700 10px/1 "IBM Plex Mono", ui-monospace, monospace;
}

.fb-step.is-active {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
  box-shadow: 5px 5px 0 color-mix(in srgb, #2c6bff 38%, transparent);
}

.fb-step.is-complete {
  background: var(--fb-surface-2);
}

.fb-step--optional {
  appearance: none;
  cursor: pointer;
  white-space: nowrap;
}

.fb-step--optional .fb-step__index {
  border-style: dashed;
}

.fb-step--optional.is-active {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.folio-builder__layout {
  --fb-left-pane: 52%;
  display: grid;
  grid-template-columns: minmax(0, var(--fb-left-pane)) 12px minmax(0, calc(100% - var(--fb-left-pane) - 12px));
  gap: 0;
  align-items: stretch;
  height: clamp(560px, calc(100vh - 280px), 980px);
  min-height: 0;
}

.fb-panel {
  padding: 12px;
  background: var(--fb-surface);
}

.folio-builder__workspace {
  display: grid;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable both-edges;
  background: #ffffff;
}

.folio-builder__splitter {
  cursor: col-resize;
  align-self: stretch;
  border-top: 2px solid var(--fb-line);
  border-bottom: 2px solid var(--fb-line);
  border-radius: 2px;
  background:
    repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--fb-line) 82%, transparent) 0 6px,
      transparent 6px 12px
    ),
    var(--fb-surface-2);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fb-line) 16%, transparent);
  transition: background .16s ease;
}

.folio-builder__splitter:hover {
  background:
    repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--fb-line) 94%, transparent) 0 7px,
      transparent 7px 12px
    ),
    #ececec;
}

.fb-tabpanel {
  display: grid;
  gap: 12px;
}

.fb-tabpanel h2 {
  margin: 0;
  font: 700 24px/1.1 "IBM Plex Mono", ui-monospace, monospace;
}

.fb-note {
  margin: 0;
  font: 500 13px/1.35 "Space Grotesk", ui-sans-serif, sans-serif;
  opacity: .86;
}

.fb-field-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fb-field-grid.fb-field-grid--single {
  grid-template-columns: 1fr;
}

.fb-collection {
  display: grid;
  gap: 8px;
}

.fb-collection__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.fb-collection__head h3 {
  margin: 0;
  font: 700 13px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .03em;
  text-transform: uppercase;
}

.fb-row-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
}

.fb-row-grid > * {
  min-width: 0;
}

.fb-link-row {
  grid-template-columns: minmax(120px, .85fr) minmax(140px, .9fr) minmax(240px, 1.7fr) 82px auto;
  align-items: center;
}

.fb-link-head {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(120px, .85fr) minmax(140px, .9fr) minmax(240px, 1.7fr) 82px auto;
  padding: 0 2px;
  font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--fb-text) 78%, transparent);
}

.fb-link-destination {
  display: grid;
  gap: 4px;
}

.fb-link-hint {
  font: 500 11px/1.2 "Space Grotesk", ui-sans-serif, sans-serif;
  opacity: .8;
}

.fb-link-external {
  justify-content: center;
}

.fb-link-external input {
  margin: 0;
}

.fb-link-mobile-label {
  display: none;
  font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: .04em;
}

label {
  display: grid;
  gap: 6px;
  font: 600 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .03em;
}

input,
select,
textarea {
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface-2);
  color: var(--fb-text);
  padding: 8px;
  font: 500 13px/1.3 "Space Grotesk", ui-sans-serif, sans-serif;
}

textarea {
  resize: vertical;
}

.fb-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.fb-actions--works-main,
.fb-actions--works-score,
.fb-actions--works-import {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(138px, 1fr));
  width: 100%;
}

.fb-actions--works-main .fb-btn,
.fb-actions--works-score .fb-btn,
.fb-actions--works-import .fb-btn,
.fb-actions--works-import input[type='file'] {
  width: 100%;
  min-width: 0;
}

.fb-works-list__head {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.fb-works-list__head .fb-btn {
  width: 100%;
  justify-content: center;
}

.fb-step-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 2px solid color-mix(in srgb, var(--fb-line) 24%, transparent);
  padding-top: 10px;
}

.fb-step-error {
  margin: 0;
  font: 700 12px/1.3 "IBM Plex Mono", ui-monospace, monospace;
  color: #8b1c10;
}

.fb-btn {
  appearance: none;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface-2);
  color: var(--fb-text);
  padding: 8px 11px;
  cursor: pointer;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .04em;
  text-transform: uppercase;
  box-shadow: var(--fb-shadow-2d);
  transition: transform .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease;
}

.fb-btn img {
  width: 14px;
  height: 14px;
}

.fb-btn.fb-btn--icon {
  padding: 6px 8px;
  font-size: 10px;
}

.fb-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 color-mix(in srgb, #2c6bff 40%, transparent);
}

.fb-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.fb-btn.fb-btn--accent {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.fb-toast-stack {
  display: grid;
  gap: 8px;
}

.fb-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface-2);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--fb-line) 35%, transparent);
}

.fb-toast p {
  margin: 0;
  font: 600 12px/1.3 "IBM Plex Mono", ui-monospace, monospace;
}

.fb-toast.is-error {
  border-color: var(--fb-line);
  background: #f2f2f2;
  color: var(--fb-text);
}

.fb-toast.is-success {
  border-color: var(--fb-line);
  background: #f2f2f2;
  color: var(--fb-text);
}

.fb-toast.is-warning {
  border-color: var(--fb-line);
  background: #f2f2f2;
  color: var(--fb-text);
}

.fb-toast-enter-active,
.fb-toast-leave-active {
  transition: transform .18s ease, opacity .18s ease;
}

.fb-toast-enter-from,
.fb-toast-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}

.fb-advanced {
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  padding: 8px;
  background: var(--fb-surface-2);
}

.fb-advanced > summary {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.fb-advanced > summary::-webkit-details-marker {
  display: none;
}

.fb-advanced--collapsible {
  padding: 0;
  overflow: hidden;
}

.fb-advanced__toggle {
  appearance: none;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.fb-advanced__toggle img {
  width: 16px;
  height: 16px;
}

.fb-advanced__body {
  display: grid;
  gap: 8px;
  padding: 0 10px 10px;
}

.fb-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
}

.fb-inline-toggle {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.fb-works-shell,
.fb-docs-shell {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(180px, 0.38fr) minmax(0, 1fr);
}

.fb-works-list,
.fb-doc-pages {
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  padding: 8px;
  background: var(--fb-surface-2);
  display: grid;
  gap: 8px;
  align-content: start;
}

.fb-works-list ul,
.fb-doc-pages ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.fb-work-item {
  width: 100%;
  border: 2px solid var(--fb-line);
  background: var(--fb-surface);
  border-radius: 2px;
  padding: 8px;
  text-align: left;
  display: grid;
  gap: 4px;
  cursor: pointer;
  box-shadow: var(--fb-shadow-2d);
}

.fb-work-item strong {
  font: 700 13px/1.2 "IBM Plex Mono", ui-monospace, monospace;
}

.fb-work-item span {
  font: 500 12px/1.2 "Space Grotesk", ui-sans-serif, sans-serif;
  opacity: .78;
}

.fb-work-item.is-active {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.fb-module {
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: var(--fb-surface);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.fb-module__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.fb-file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.fb-file-list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  padding: 8px;
  background: var(--fb-surface-2);
  font: 600 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
}

.folio-builder__preview {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  align-self: stretch;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f3f3f3;
}

.folio-builder__preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.folio-builder__preview-head h3 {
  margin: 0;
  font: 700 13px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.fb-preview-controls {
  display: flex;
  gap: 6px;
}

.folio-builder__preview-frame {
  position: relative;
  margin-inline: auto;
  width: min(100%, 1320px);
  height: 100%;
  min-height: 0;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background: #f5f5f5;
  overflow: hidden;
  transition: width .25s ease;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--fb-line) 8%, transparent);
}

.folio-builder__preview-viewport {
  margin-inline: auto;
  width: 100%;
  height: 100%;
  transform-origin: top center;
  will-change: transform;
}

.folio-builder__preview-frame iframe,
.folio-builder__mobile-sheet iframe {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  display: block;
  background: white;
}

.fb-mono-color-field {
  grid-column: span 2;
}

.fb-mono-color-control {
  --fb-mono-color: #5e77bd;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.fb-mono-color-control input[type='color'] {
  width: 42px;
  height: 36px;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  padding: 2px;
  background: var(--fb-surface-2);
  cursor: pointer;
}

.fb-mono-color-bar {
  height: 22px;
  border: 2px solid var(--fb-line);
  border-radius: 2px;
  background:
    linear-gradient(90deg, #000000 0%, var(--fb-mono-color) 52%, #ffffff 100%);
}

.fb-mono-color-code {
  font: 700 11px/1 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .04em;
}

.fb-preview-skeleton {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 14px;
  background: #f6f6f6;
}

.fb-preview-skeleton__bar,
.fb-preview-skeleton__chip,
.fb-preview-skeleton__panel {
  border: 2px solid color-mix(in srgb, var(--fb-line) 24%, transparent);
  border-radius: 2px;
  background: #ececec;
}

.fb-preview-skeleton__bar {
  height: 16px;
}

.fb-preview-skeleton__bar.is-title {
  width: 58%;
  height: 22px;
}

.fb-preview-skeleton__bar.is-line {
  width: 82%;
}

.fb-preview-skeleton__bar.short {
  width: 44%;
}

.fb-preview-skeleton__panel {
  margin-top: 4px;
  padding: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.fb-preview-skeleton__chip {
  width: 84px;
  height: 28px;
}

.fb-preview-skeleton__caption {
  margin: 0;
  font: 600 12px/1.2 "IBM Plex Mono", ui-monospace, monospace;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--fb-line) 70%, transparent);
}

.folio-builder__mobile-toggle {
  display: none;
  position: sticky;
  bottom: 10px;
  z-index: 20;
  width: fit-content;
  margin-left: auto;
  padding: 8px 10px;
  align-items: center;
  gap: 6px;
  font: 700 12px/1 "IBM Plex Mono", ui-monospace, monospace;
  text-transform: uppercase;
  cursor: pointer;
}

.folio-builder__mobile-toggle img {
  width: 14px;
  height: 14px;
}

.folio-builder__mobile-sheet {
  position: fixed;
  inset: auto 8px 8px;
  z-index: 30;
  max-height: 74vh;
  overflow: auto;
  background: var(--fb-surface);
}

.fb-sheet-enter-active,
.fb-sheet-leave-active {
  transition: transform .22s ease, opacity .22s ease;
}

.fb-sheet-enter-from,
.fb-sheet-leave-to {
  transform: translateY(22px);
  opacity: 0;
}

@media (max-width: 1280px) {
  .folio-builder__layout {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .folio-builder__splitter {
    display: none;
  }

  .folio-builder__preview {
    display: none;
  }

  .folio-builder__mobile-toggle {
    display: inline-flex;
  }
}

@media (max-width: 1560px) {
  .fb-link-head {
    display: none;
  }

  .fb-link-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    border: 2px solid color-mix(in srgb, var(--fb-line) 24%, transparent);
    border-radius: 2px;
    padding: 8px;
    background: var(--fb-surface-2);
  }

  .fb-link-destination {
    grid-column: 1 / -1;
  }

  .fb-link-external {
    justify-content: start;
    gap: 8px;
  }

  .fb-link-mobile-label {
    display: inline;
  }

  .fb-link-remove {
    justify-self: start;
  }
}

@media (max-width: 920px) {
  .folio-builder {
    min-height: auto;
  }

  .folio-builder__header {
    flex-direction: column;
    align-items: stretch;
  }

  .folio-builder__header-actions {
    justify-items: start;
  }

  .fb-field-grid,
  .fb-row-grid,
  .fb-works-shell,
  .fb-docs-shell,
  .folio-builder__launcher-grid {
    grid-template-columns: 1fr;
  }

  .fb-link-head {
    display: none;
  }

  .fb-link-row {
    grid-template-columns: 1fr;
    align-items: end;
  }

  .fb-link-external {
    justify-content: start;
  }

  .fb-mono-color-field {
    grid-column: auto;
  }

  .fb-actions--works-main,
  .fb-actions--works-score,
  .fb-actions--works-import,
  .fb-works-list__head {
    grid-template-columns: 1fr;
  }

  .fb-step {
    min-width: max-content;
  }

  .fb-step__meta {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
</style>
