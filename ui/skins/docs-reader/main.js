const NAV_STATE_KEY = 'docs-reader.nav.state.v2';
const HEROICONS_BASE = './lib/heroicons/24/outline';
const ICON_FILES = Object.freeze({
  nav: 'arrows-pointing-out',
  tools: 'arrows-pointing-in',
  search: 'sparkles',
  close: 'x-mark',
  themeLight: 'sun',
  themeDark: 'moon',
  link: 'link',
  external: 'arrow-up-right',
  copy: 'document-text',
  play: 'play',
  pause: 'pause',
  eye: 'eye',
  refresh: 'arrow-path'
});

function iconMarkup(name, className = 'dr-icon', label = '') {
  const file = ICON_FILES[name];
  if (!file) return '';
  const safeLabel = label ? ` alt="${label.replace(/"/g, '&quot;')}"` : ' alt="" aria-hidden="true"';
  return `<img class="${className}" src="${HEROICONS_BASE}/${file}.svg"${safeLabel} loading="lazy" decoding="async">`;
}

function readDocsData() {
  const script = document.getElementById('prae-docs-data');
  if (!script) return {};
  try {
    const text = script.textContent || '';
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return {};
  }
}

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

const DOCS_DATA = readDocsData();
const DOCS_LIST = Array.isArray(DOCS_DATA.docs) ? DOCS_DATA.docs : [];
const NAV_DATA = Array.isArray(DOCS_DATA.nav) ? DOCS_DATA.nav : [];
const SEARCH_ENTRIES = Array.isArray(DOCS_DATA.search) ? DOCS_DATA.search : [];
const SEARCH_CONFIG = DOCS_DATA.searchConfig && typeof DOCS_DATA.searchConfig === 'object'
  ? DOCS_DATA.searchConfig
  : { enabled: true, requestedEngine: 'auto', engine: 'light', fields: ['title', 'headings', 'body', 'summary'], stats: { docCount: DOCS_LIST.length, bytes: 0 } };
const SITE_DATA = DOCS_DATA.site && typeof DOCS_DATA.site === 'object' ? DOCS_DATA.site : {};
const WORKS_SETTINGS = DOCS_DATA.works && typeof DOCS_DATA.works === 'object' ? DOCS_DATA.works : {};
const HERO_DATA = DOCS_DATA.hero && typeof DOCS_DATA.hero === 'object' ? DOCS_DATA.hero : {};
const HOME_SECTIONS = Array.isArray(DOCS_DATA.sections) ? DOCS_DATA.sections : [];
const HOMEPAGE_ID = typeof DOCS_DATA.homepage === 'string' ? DOCS_DATA.homepage : '';
const HOMEPAGE_MISSING = !!DOCS_DATA.homepageMissing;

const DOC_BY_ID = new Map();
DOCS_LIST.forEach((doc) => {
  if (!doc || typeof doc !== 'object' || typeof doc.id !== 'string') return;
  DOC_BY_ID.set(doc.id, doc);
});

const PLACEHOLDER_DOC = HOMEPAGE_MISSING
  ? {
      id: 'docs-placeholder',
      title: 'Documentation coming soon',
      subtitle: '',
      summary: 'Auto-generated homepage placeholder.',
      html: '<p>Auto-generated homepage placeholder.</p>',
      modules: [],
      headings: [],
      breadcrumbs: [],
      meta: { status: '', updated: '' }
    }
  : null;

const moduleAudioMap = new Map();
const stringWarnings = new Set();

function ensureString(value, key, fallback = '') {
  if (typeof value === 'string') return value;
  if (value != null && key && !stringWarnings.has(key)) {
    console.warn(`[docs-reader] Ignoring non-string ${key}.`);
    stringWarnings.add(key);
  }
  return fallback;
}

function ensureHtml(value, key) {
  if (typeof value === 'string') return value;
  if (value != null && key && !stringWarnings.has(key)) {
    console.warn(`[docs-reader] Ignoring non-string ${key}.`);
    stringWarnings.add(key);
  }
  return '';
}

function copyText(value) {
  if (!value) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

function readNavState() {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeNavState(value) {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(value || {}));
  } catch (_) {}
}

function parseRouteHash(hash) {
  let raw = String(hash || '').trim();
  if (raw.startsWith('#')) raw = raw.slice(1);
  if (!raw) return { docId: '', heading: '' };
  if (raw.startsWith('/')) raw = raw.slice(1);
  const qIdx = raw.indexOf('?');
  const docPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const query = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
  const params = new URLSearchParams(query);
  return {
    docId: decodeURIComponent(docPart || '').replace(/^\/+/, ''),
    heading: params.get('h') || ''
  };
}

function buildRouteHash(docId, headingId) {
  const safeDoc = String(docId || '').replace(/^\/+/, '');
  if (!safeDoc) return '';
  if (!headingId) return `#/${safeDoc}`;
  const params = new URLSearchParams();
  params.set('h', String(headingId));
  return `#/${safeDoc}?${params.toString()}`;
}

function ensureThemeHelpers() {
  if (typeof window.praeApplyTheme === 'function' && typeof window.praeCurrentTheme === 'function') {
    return {
      apply: window.praeApplyTheme,
      current: window.praeCurrentTheme,
      cycle: typeof window.praeCycleTheme === 'function'
        ? window.praeCycleTheme
        : () => {
            const next = window.praeCurrentTheme() === 'dark' ? 'light' : 'dark';
            window.praeApplyTheme(next);
          }
    };
  }

  const STORAGE_KEY = 'wc.theme';

  function normalize(mode) {
    return mode === 'light' ? 'light' : 'dark';
  }

  function current() {
    const attr = document.body ? document.body.getAttribute('data-theme') : '';
    if (attr === 'light' || attr === 'dark') return attr;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalize(raw || 'dark');
    } catch (_) {
      return 'dark';
    }
  }

  function apply(mode, opts = {}) {
    const next = normalize(mode);
    [document.documentElement, document.body, document.getElementById('works-console')].forEach((node) => {
      if (!node) return;
      node.setAttribute('data-theme', next);
      node.classList.remove('prae-theme-light', 'prae-theme-dark');
      node.classList.add(next === 'light' ? 'prae-theme-light' : 'prae-theme-dark');
    });
    if (document.documentElement) {
      document.documentElement.style.colorScheme = next;
    }
    if (opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    }
    return next;
  }

  function cycle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  window.praeApplyTheme = apply;
  window.praeCurrentTheme = current;
  window.praeCycleTheme = cycle;
  return { apply, current, cycle };
}

function applySiteChrome(site) {
  const title = ensureString(site.title, 'site.title', 'Praetorius Docs') || 'Praetorius Docs';
  const subtitle = ensureString(site.subtitle, 'site.subtitle', '');
  document.querySelectorAll('[data-site-title]').forEach((node) => {
    node.textContent = title;
  });
  document.querySelectorAll('[data-site-subtitle]').forEach((node) => {
    node.textContent = subtitle;
  });
  document.title = subtitle ? `${title} - ${subtitle}` : title;
}

function renderBrandFooter() {
  const root = document.getElementById('prae-footer');
  if (!root) return;
  const site = (window.PRAE && window.PRAE.config && window.PRAE.config.site) || {};
  const branding = (window.PRAE && window.PRAE.config && window.PRAE.config.branding) || {};
  if (window.PRAE && window.PRAE.branding && typeof window.PRAE.branding.renderFooter === 'function') {
    window.PRAE.branding.renderFooter(root, { site, branding });
  }
}

function getHomepageDoc() {
  if (HOMEPAGE_ID && DOC_BY_ID.has(HOMEPAGE_ID)) return DOC_BY_ID.get(HOMEPAGE_ID);
  const first = DOCS_LIST.find((doc) => doc && typeof doc.id === 'string');
  return first || null;
}

function getDocByRoute(routeDocId) {
  const key = String(routeDocId || '').trim();
  if (!key) return null;
  if (DOC_BY_ID.has(key)) return DOC_BY_ID.get(key);
  const lower = key.toLowerCase();
  for (const [docId, doc] of DOC_BY_ID.entries()) {
    if (docId.toLowerCase() === lower) return doc;
  }
  return null;
}

function humanizePathSegment(value) {
  const raw = String(value || '').replace(/\.md$/i, '').trim();
  if (!raw) return '';
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function renderBreadcrumbs(doc) {
  const node = document.querySelector('[data-doc-breadcrumbs]');
  if (!node) return;
  node.innerHTML = '';
  const crumbs = Array.isArray(doc && doc.breadcrumbs) ? doc.breadcrumbs : [];
  const home = document.createElement('span');
  home.className = 'dr-breadcrumb-item';
  home.textContent = 'Docs';
  node.appendChild(home);
  crumbs.forEach((crumb) => {
    const sep = document.createElement('span');
    sep.className = 'dr-breadcrumb-sep';
    sep.textContent = '/';
    node.appendChild(sep);
    const part = document.createElement('span');
    part.className = 'dr-breadcrumb-item';
    part.textContent = ensureString(crumb && crumb.label, 'doc.breadcrumb.label', humanizePathSegment(crumb && crumb.id));
    node.appendChild(part);
  });
  if (!crumbs.length && doc && doc.title) {
    const sep = document.createElement('span');
    sep.className = 'dr-breadcrumb-sep';
    sep.textContent = '/';
    node.appendChild(sep);
    const leaf = document.createElement('span');
    leaf.className = 'dr-breadcrumb-item';
    leaf.textContent = doc.title;
    node.appendChild(leaf);
  }
}

function renderMeta(doc) {
  const node = document.querySelector('[data-doc-meta]');
  if (!node) return;
  node.innerHTML = '';
  const meta = (doc && typeof doc.meta === 'object') ? doc.meta : {};
  const tags = Array.isArray(doc && doc.tags) ? doc.tags.slice(0, 4) : [];
  if (meta.status === 'new' || meta.status === 'updated') {
    const chip = document.createElement('span');
    chip.className = 'dr-meta-chip';
    chip.dataset.state = meta.status;
    chip.textContent = meta.status;
    node.appendChild(chip);
  }
  if (meta.updated) {
    const updated = document.createElement('span');
    updated.textContent = `Updated ${meta.updated}`;
    node.appendChild(updated);
  }
  tags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'dr-meta-chip';
    chip.textContent = tag;
    node.appendChild(chip);
  });
}

function renderHero(container, doc, isHomepage) {
  const hero = document.createElement('header');
  hero.className = 'dr-hero';
  const heroConfig = (doc && doc.hero && typeof doc.hero === 'object')
    ? doc.hero
    : ((isHomepage && HERO_DATA && typeof HERO_DATA === 'object') ? HERO_DATA : {});
  const kickerText = ensureString(heroConfig.kicker, 'hero.kicker', ensureString(doc && doc.subtitle, 'doc.subtitle', ''));
  if (kickerText) {
    const kicker = document.createElement('p');
    kicker.className = 'dr-kicker';
    kicker.textContent = kickerText;
    hero.appendChild(kicker);
  }
  const title = document.createElement('h1');
  title.textContent = ensureString(heroConfig.title, 'hero.title', ensureString(doc && doc.title, 'doc.title', 'Documentation'));
  hero.appendChild(title);
  const ledeText = ensureString(heroConfig.lede, 'hero.lede', ensureString(doc && doc.summary, 'doc.summary', ''));
  if (ledeText) {
    const lede = document.createElement('p');
    lede.className = 'dr-lede';
    lede.textContent = ledeText;
    hero.appendChild(lede);
  }
  container.appendChild(hero);
}

function closeAllModuleAudio(exceptKey = '') {
  moduleAudioMap.forEach((entry, key) => {
    if (!entry || !entry.audio) return;
    if (exceptKey && key === exceptKey) return;
    entry.audio.pause();
  });
}

function closeGlobalWorksAudio() {
  if (window.PRAE && typeof window.PRAE.pauseAllAudio === 'function') {
    try {
      window.PRAE.pauseAllAudio('');
    } catch (_) {}
  }
}

function getModuleAudio(moduleKey, src) {
  if (moduleAudioMap.has(moduleKey)) return moduleAudioMap.get(moduleKey).audio;
  const audio = new Audio(src);
  audio.preload = 'metadata';
  moduleAudioMap.set(moduleKey, { audio, activeCue: -1, activePage: 0 });
  return audio;
}

function formatClock(seconds) {
  const sec = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const whole = Math.floor(sec);
  const min = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${min}:${String(rem).padStart(2, '0')}`;
}

function enhanceCodeBlocks(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach((pre) => {
    pre.setAttribute('tabindex', '0');
    if (pre.querySelector('.dr-copy-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dr-copy-btn';
    btn.innerHTML = `${iconMarkup('copy', 'dr-icon-xs')}<span>Copy</span>`;
    btn.addEventListener('click', async () => {
      const ok = await copyText(pre.textContent || '');
      btn.innerHTML = ok ? `${iconMarkup('copy', 'dr-icon-xs')}<span>Copied</span>` : `${iconMarkup('copy', 'dr-icon-xs')}<span>Copy</span>`;
      setTimeout(() => {
        btn.innerHTML = `${iconMarkup('copy', 'dr-icon-xs')}<span>Copy</span>`;
      }, 1500);
    });
    pre.appendChild(btn);
  });

  root.querySelectorAll('p code, li code').forEach((code) => {
    if (code.closest('pre') || code.parentElement?.classList.contains('dr-inline-copy')) return;
    const wrap = document.createElement('span');
    wrap.className = 'dr-inline-copy';
    const text = code.textContent || '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dr-inline-copy-btn';
    btn.innerHTML = iconMarkup('copy', 'dr-icon-xs');
    btn.setAttribute('aria-label', 'Copy snippet');
    btn.addEventListener('click', async () => {
      const ok = await copyText(text);
      btn.innerHTML = ok ? 'OK' : iconMarkup('copy', 'dr-icon-xs');
      setTimeout(() => { btn.innerHTML = iconMarkup('copy', 'dr-icon-xs'); }, 1100);
    });
    code.replaceWith(wrap);
    wrap.appendChild(code);
    wrap.appendChild(btn);
  });
}

function buildHeadings(container) {
  if (!container) return [];
  const nodes = Array.from(container.querySelectorAll('h2, h3, h4'));
  return nodes.map((node) => {
    let id = node.id;
    if (!id) {
      id = String(node.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (!id) id = `heading-${Math.random().toString(16).slice(2, 8)}`;
      node.id = id;
    }
    return {
      id,
      node,
      depth: node.tagName === 'H3' ? 3 : (node.tagName === 'H4' ? 4 : 2)
    };
  });
}

function enhanceHeadingAnchors(headings, getDocAndHeadingHash) {
  headings.forEach((entry) => {
    const heading = entry && entry.node;
    if (!heading || heading.querySelector('.dr-heading-anchor')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dr-heading-anchor';
    btn.innerHTML = iconMarkup('link', 'dr-icon-xs');
    btn.setAttribute('aria-label', 'Copy heading link');
    btn.addEventListener('click', async () => {
      const hash = getDocAndHeadingHash(entry.id);
      const url = `${location.origin}${location.pathname}${hash}`;
      const ok = await copyText(url);
      if (ok) {
        btn.textContent = 'OK';
        setTimeout(() => {
          btn.innerHTML = iconMarkup('link', 'dr-icon-xs');
        }, 1300);
      }
    });
    heading.appendChild(btn);
  });
}

function observeHeadingActivity(headings, onActive) {
  if (!('IntersectionObserver' in window)) return null;
  const observer = new IntersectionObserver((entries) => {
    const shown = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (shown[0] && shown[0].target && shown[0].target.id) {
      onActive(shown[0].target.id);
    }
  }, { threshold: [0.2, 0.45, 0.7], rootMargin: '-18% 0px -65% 0px' });
  headings.forEach((entry) => {
    if (entry && entry.node) observer.observe(entry.node);
  });
  return observer;
}

function renderOutline(headings, onPick) {
  const host = document.getElementById('dr-outline');
  if (!host) return { links: new Map(), observer: null };
  host.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'dr-outline-list';
  host.appendChild(list);
  const links = new Map();
  headings.forEach((entry) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dr-outline-link';
    button.dataset.depth = String(entry.depth || 2);
    button.textContent = entry.node.textContent || entry.id;
    button.addEventListener('click', () => {
      if (typeof onPick === 'function') onPick(entry.id);
    });
    li.appendChild(button);
    list.appendChild(li);
    links.set(entry.id, button);
  });
  return { links, observer: null };
}

function renderNav(onNavigate) {
  const navRoot = document.getElementById('dr-nav');
  if (!navRoot) return new Map();
  navRoot.innerHTML = '';
  const state = readNavState();
  const map = new Map();

  NAV_DATA.forEach((group) => {
    if (!group || typeof group !== 'object') return;
    const section = document.createElement('section');
    section.className = 'dr-nav-group';
    const groupId = ensureString(group.id, '', `group-${Math.random().toString(16).slice(2, 6)}`);
    const open = state[groupId] !== false;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'dr-nav-group-toggle';
    toggle.setAttribute('aria-expanded', String(open));
    const title = ensureString(group.label, 'nav.group.label', 'Section');
    toggle.innerHTML = `<span>${title}</span><span>${open ? '[-]' : '[+]'}</span>`;

    const list = document.createElement('ul');
    list.className = 'dr-nav-items';
    list.hidden = !open;

    toggle.addEventListener('click', () => {
      const nextOpen = list.hidden;
      list.hidden = !nextOpen;
      toggle.setAttribute('aria-expanded', String(nextOpen));
      toggle.lastElementChild.textContent = nextOpen ? '[-]' : '[+]';
      state[groupId] = nextOpen;
      writeNavState(state);
    });

    const items = Array.isArray(group.items) ? group.items : [];
    items.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const li = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'dr-nav-link';
      const label = ensureString(item.label, 'nav.item.label', 'Untitled');
      const snippet = ensureString(item.snippet, 'nav.item.snippet', '');
      const href = ensureString(item.href, 'nav.item.href', '');
      const docId = ensureString(item.docId || item.id, 'nav.item.docId', '');
      link.innerHTML = `<span class="dr-nav-link-title">${label}</span>${snippet ? `<span class="dr-nav-link-snippet">${snippet}</span>` : ''}`;
      const status = item.meta && typeof item.meta === 'object' ? ensureString(item.meta.status, 'nav.item.meta.status', '') : '';
      if (status) {
        const statusNode = document.createElement('span');
        statusNode.className = 'dr-nav-link-meta';
        statusNode.textContent = status;
        link.appendChild(statusNode);
      }
      link.addEventListener('click', () => {
        if (typeof onNavigate === 'function') onNavigate({ href, docId });
      });
      li.appendChild(link);
      list.appendChild(li);
      if (docId) map.set(docId, link);
    });

    section.appendChild(toggle);
    section.appendChild(list);
    navRoot.appendChild(section);
  });

  return map;
}

function renderMediaModule(module) {
  const wrapper = document.createElement('section');
  wrapper.className = 'dr-module';
  const title = document.createElement('h3');
  title.className = 'dr-module-title';
  title.textContent = ensureString(module.title, 'module.media.title', 'Media');
  wrapper.appendChild(title);

  const grid = document.createElement('div');
  grid.className = module.layout === 'masonry' ? 'dr-module-media-masonry' : 'dr-module-media-grid';
  const items = Array.isArray(module.items) ? module.items : [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const src = ensureString(item.src, 'module.media.item.src', '');
    if (!src) return;
    const figure = document.createElement('figure');
    figure.className = 'dr-media-item';
    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.preload = 'metadata';
      if (item.alt) video.setAttribute('aria-label', item.alt);
      figure.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = src;
      img.alt = ensureString(item.alt, 'module.media.item.alt', '');
      img.loading = 'lazy';
      img.decoding = 'async';
      figure.appendChild(img);
    }
    const captionText = ensureString(item.caption, 'module.media.item.caption', '');
    if (captionText) {
      const caption = document.createElement('figcaption');
      caption.textContent = captionText;
      figure.appendChild(caption);
    }
    grid.appendChild(figure);
  });
  wrapper.appendChild(grid);
  return wrapper;
}

function renderProcessModule(module) {
  const wrapper = document.createElement('section');
  wrapper.className = 'dr-module';
  const title = document.createElement('h3');
  title.className = 'dr-module-title';
  title.textContent = ensureString(module.title, 'module.process.title', 'Process');
  wrapper.appendChild(title);

  const list = document.createElement('ol');
  list.className = 'dr-process-list';
  const steps = Array.isArray(module.steps) ? module.steps : [];
  steps.forEach((step) => {
    if (!step || typeof step !== 'object') return;
    const li = document.createElement('li');
    li.className = 'dr-process-step';
    const heading = document.createElement('h4');
    heading.textContent = ensureString(step.title, 'module.process.step.title', 'Step');
    li.appendChild(heading);
    const bodyHtml = ensureHtml(step.body, 'module.process.step.body');
    if (bodyHtml) {
      const body = document.createElement('div');
      body.className = 'dr-process-step-body';
      body.innerHTML = bodyHtml;
      li.appendChild(body);
    }
    const media = Array.isArray(step.media) ? step.media : [];
    if (media.length) {
      const mediaModule = renderMediaModule({ title: '', layout: 'grid', items: media });
      li.appendChild(mediaModule.querySelector('.dr-module-media-grid') || mediaModule.querySelector('.dr-module-media-masonry'));
    }
    list.appendChild(li);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function renderCreditsModule(module) {
  const wrapper = document.createElement('section');
  wrapper.className = 'dr-module';
  const title = document.createElement('h3');
  title.className = 'dr-module-title';
  title.textContent = ensureString(module.title, 'module.credits.title', 'Credits');
  wrapper.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'dr-credits-list';
  const roles = Array.isArray(module.roles) ? module.roles : [];
  roles.forEach((role) => {
    if (!role || typeof role !== 'object') return;
    const li = document.createElement('li');
    const roleLabel = document.createElement('span');
    roleLabel.className = 'dr-credits-role';
    roleLabel.textContent = ensureString(role.role, 'module.credits.role', 'Role');
    li.appendChild(roleLabel);
    const people = Array.isArray(role.people) ? role.people.map((value) => String(value || '').trim()).filter(Boolean) : [];
    const names = document.createElement('div');
    names.textContent = people.join(', ');
    li.appendChild(names);
    list.appendChild(li);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function syncScoreToolsPane(activeScore) {
  const emptyNode = document.querySelector('[data-score-empty]');
  const pane = document.querySelector('[data-score-pane]');
  const frame = document.querySelector('[data-score-frame]');
  const title = document.querySelector('[data-score-title]');
  const open = document.querySelector('[data-score-open]');
  const closeBtn = document.querySelector('[data-action="close-score"]');
  if (!pane || !frame || !title || !open || !emptyNode || !closeBtn) return;

  if (!activeScore || !activeScore.pdf) {
    pane.hidden = true;
    emptyNode.hidden = false;
    closeBtn.hidden = true;
    frame.removeAttribute('src');
    open.removeAttribute('href');
    title.textContent = 'Score';
    return;
  }

  pane.hidden = false;
  emptyNode.hidden = true;
  closeBtn.hidden = false;
  const safePage = Number.isFinite(Number(activeScore.page)) && Number(activeScore.page) >= 1 ? Math.floor(Number(activeScore.page)) : 0;
  const hash = safePage ? `#page=${safePage}` : '';
  frame.src = `${activeScore.pdf}${hash}`;
  open.href = `${activeScore.pdf}${hash}`;
  title.textContent = activeScore.title || 'Score';
}

function renderScoreModule(module, doc, moduleIndex, state) {
  const wrapper = document.createElement('section');
  wrapper.className = 'dr-module';
  const title = document.createElement('h3');
  title.className = 'dr-module-title';
  title.textContent = ensureString(module.title, 'module.score.title', 'Score');
  wrapper.appendChild(title);

  const moduleKey = `${doc.id}::score::${moduleIndex}`;
  const controls = document.createElement('div');
  controls.className = 'dr-module-score-controls';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'dr-module-btn';
  openBtn.innerHTML = `${iconMarkup('eye', 'dr-icon-sm')}<span>Open score</span>`;

  openBtn.addEventListener('click', () => {
    state.activeScore = {
      pdf: ensureString(module.pdf, 'module.score.pdf', ''),
      title: ensureString(module.title, 'module.score.title', 'Score'),
      page: 0,
      key: moduleKey
    };
    syncScoreToolsPane(state.activeScore);
  });

  controls.appendChild(openBtn);

  const audioSrc = ensureString(module.audio, 'module.score.audio', '');
  let playBtn = null;
  let audio = null;
  if (audioSrc) {
    audio = getModuleAudio(moduleKey, audioSrc);
    playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'dr-module-btn';
    playBtn.innerHTML = `${iconMarkup('play', 'dr-icon-sm')}<span>Play</span>`;
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        closeGlobalWorksAudio();
        closeAllModuleAudio(moduleKey);
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
    audio.addEventListener('play', () => {
      playBtn.dataset.state = 'playing';
      playBtn.innerHTML = `${iconMarkup('pause', 'dr-icon-sm')}<span>Pause</span>`;
    });
    audio.addEventListener('pause', () => {
      delete playBtn.dataset.state;
      playBtn.innerHTML = `${iconMarkup('play', 'dr-icon-sm')}<span>Play</span>`;
    });
    controls.appendChild(playBtn);
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'dr-module-btn';
  copyBtn.innerHTML = `${iconMarkup('link', 'dr-icon-sm')}<span>Copy module link</span>`;
  copyBtn.addEventListener('click', async () => {
    const hash = buildRouteHash(doc.id, `module-${moduleIndex + 1}`);
    const ok = await copyText(`${location.origin}${location.pathname}${hash}`);
    copyBtn.innerHTML = ok
      ? `${iconMarkup('link', 'dr-icon-sm')}<span>Copied</span>`
      : `${iconMarkup('link', 'dr-icon-sm')}<span>Copy module link</span>`;
    setTimeout(() => {
      copyBtn.innerHTML = `${iconMarkup('link', 'dr-icon-sm')}<span>Copy module link</span>`;
    }, 1300);
  });
  controls.appendChild(copyBtn);

  wrapper.appendChild(controls);

  const cues = Array.isArray(module.cues) ? module.cues : [];
  if (cues.length) {
    const cueWrap = document.createElement('div');
    cueWrap.className = 'dr-module-cues';
    cues.forEach((cue, cueIdx) => {
      const cueBtn = document.createElement('button');
      cueBtn.type = 'button';
      cueBtn.className = 'dr-module-cue';
      const label = ensureString(cue && cue.label, 'module.score.cue.label', `Cue ${cueIdx + 1}`);
      const time = Number.isFinite(Number(cue && cue.t)) ? Number(cue.t) : 0;
      cueBtn.textContent = `${label} @${formatClock(time)}`;
      cueBtn.addEventListener('click', () => {
        if (audio) {
          closeGlobalWorksAudio();
          closeAllModuleAudio(moduleKey);
          audio.currentTime = Math.max(0, time);
          audio.play().catch(() => {});
        }
        if (module.pageFollow !== false && cue && Number.isFinite(Number(cue.page)) && Number(cue.page) >= 1) {
          state.activeScore = {
            pdf: ensureString(module.pdf, 'module.score.pdf', ''),
            title: ensureString(module.title, 'module.score.title', 'Score'),
            page: Number(cue.page),
            key: moduleKey
          };
          syncScoreToolsPane(state.activeScore);
        }
      });
      cueWrap.appendChild(cueBtn);
    });
    wrapper.appendChild(cueWrap);
  }

  if (audio && cues.length && module.pageFollow !== false) {
    let lastCue = -1;
    audio.addEventListener('timeupdate', () => {
      const now = Number(audio.currentTime) || 0;
      let nextCue = -1;
      for (let i = 0; i < cues.length; i += 1) {
        const cueTime = Number.isFinite(Number(cues[i] && cues[i].t)) ? Number(cues[i].t) : 0;
        if (now >= cueTime) nextCue = i;
        else break;
      }
      if (nextCue === lastCue || nextCue < 0) return;
      lastCue = nextCue;
      const cue = cues[nextCue];
      if (cue && Number.isFinite(Number(cue.page)) && Number(cue.page) >= 1) {
        state.activeScore = {
          pdf: ensureString(module.pdf, 'module.score.pdf', ''),
          title: ensureString(module.title, 'module.score.title', 'Score'),
          page: Number(cue.page),
          key: moduleKey
        };
        syncScoreToolsPane(state.activeScore);
      }
    });
  }

  return wrapper;
}

function renderModules(container, modules, doc, state) {
  if (!Array.isArray(modules) || !modules.length) return;
  const zone = document.createElement('section');
  zone.className = 'dr-module-zone';
  modules.forEach((module, index) => {
    if (!module || typeof module !== 'object') return;
    let el = null;
    if (module.type === 'score') {
      el = renderScoreModule(module, doc, index, state);
    } else if (module.type === 'media') {
      el = renderMediaModule(module);
    } else if (module.type === 'process') {
      el = renderProcessModule(module);
    } else if (module.type === 'credits') {
      el = renderCreditsModule(module);
    }
    if (el) {
      el.id = `module-${index + 1}`;
      zone.appendChild(el);
    }
  });
  if (zone.childElementCount) container.appendChild(zone);
}

function renderHomeSections(container) {
  if (!Array.isArray(HOME_SECTIONS) || !HOME_SECTIONS.length) return;
  HOME_SECTIONS.forEach((section) => {
    if (!section || typeof section !== 'object') return;
    const block = document.createElement('section');
    block.className = 'dr-module';
    if (section.id) block.id = section.id;

    const kicker = ensureString(section.kicker, 'home.section.kicker', '');
    if (kicker) {
      const kickerNode = document.createElement('p');
      kickerNode.className = 'dr-kicker';
      kickerNode.textContent = kicker;
      block.appendChild(kickerNode);
    }

    const heading = ensureString(section.title, 'home.section.title', '');
    if (heading) {
      const title = document.createElement('h3');
      title.className = 'dr-module-title';
      title.textContent = heading;
      block.appendChild(title);
    }

    const lede = ensureString(section.lede, 'home.section.lede', '');
    if (lede) {
      const p = document.createElement('p');
      p.className = 'dr-lede';
      p.textContent = lede;
      block.appendChild(p);
    }

    const html = ensureHtml(section.html, 'home.section.html');
    if (html) {
      const body = document.createElement('div');
      body.className = 'dr-prose';
      body.innerHTML = html;
      block.appendChild(body);
    }

    const items = Array.isArray(section.items) ? section.items : [];
    if (items.length) {
      const list = document.createElement('div');
      list.className = 'dr-module-actions';
      items.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dr-module-btn';
        const titleText = ensureString(item.title, 'home.section.item.title', 'Open');
        const href = ensureString(item.href, 'home.section.item.href', '');
        const docId = ensureString(item.docId, 'home.section.item.docId', '');
        btn.textContent = titleText;
        btn.addEventListener('click', () => {
          if (docId) {
            location.hash = buildRouteHash(docId, '');
            return;
          }
          if (href && href.startsWith('#/')) {
            location.hash = href;
            return;
          }
          if (href) {
            window.open(href, '_blank', 'noopener');
          }
        });
        list.appendChild(btn);
      });
      block.appendChild(list);
    }

    container.appendChild(block);
  });
}

function createSearchEngine(entries, config) {
  const safeEntries = Array.isArray(entries)
    ? entries.map((entry) => ({
        ...entry,
        title: ensureString(entry.title, 'search.entry.title', ''),
        snippet: ensureString(entry.snippet, 'search.entry.snippet', ''),
        group: ensureString(entry.group, 'search.entry.group', 'Docs'),
        docId: ensureString(entry.docId, 'search.entry.docId', ''),
        headingId: ensureString(entry.headingId, 'search.entry.headingId', ''),
        url: ensureString(entry.url, 'search.entry.url', ''),
        kind: ensureString(entry.kind, 'search.entry.kind', 'doc'),
        tokens: ensureString(entry.tokens, 'search.entry.tokens', '')
      }))
    : [];

  const engine = config && config.engine ? config.engine : 'light';
  const enabled = config && config.enabled !== false;
  if (!enabled || engine === 'none') {
    return {
      search: () => []
    };
  }

  const defaultResults = safeEntries
    .filter((entry) => entry.kind === 'doc' && entry.docId)
    .slice(0, 10);

  function lightScore(entry, queryLower, queryWords) {
    const hay = `${entry.title} ${entry.snippet} ${entry.tokens}`.toLowerCase();
    if (!hay) return 0;
    if (hay === queryLower) return 180;
    if (hay.startsWith(queryLower)) return 150;
    if (hay.includes(queryLower)) return 120;
    let score = 0;
    queryWords.forEach((word) => {
      if (!word) return;
      if (hay.includes(word)) score += Math.min(30, 4 + word.length * 2);
    });
    if (entry.kind === 'heading') score *= 0.92;
    return score;
  }

  function fuzzyScore(entry, queryLower) {
    const hay = `${entry.title} ${entry.tokens} ${entry.snippet}`.toLowerCase();
    if (!hay || !queryLower) return 0;
    if (hay.includes(queryLower)) return 140 + queryLower.length;

    let cursor = 0;
    let streak = 0;
    let score = 0;
    for (let i = 0; i < queryLower.length; i += 1) {
      const ch = queryLower[i];
      const found = hay.indexOf(ch, cursor);
      if (found < 0) return 0;
      const gap = found - cursor;
      if (gap === 0) {
        streak += 1;
        score += 6 + streak;
      } else {
        streak = 0;
        score += Math.max(1, 4 - Math.min(3, gap));
      }
      cursor = found + 1;
    }
    const denom = Math.max(1, hay.length / 90);
    if (entry.kind === 'heading') score *= 0.95;
    return score / denom;
  }

  return {
    search(query) {
      const raw = String(query || '').trim();
      if (!raw) return defaultResults;
      const q = raw.toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const scored = safeEntries.map((entry) => {
        const score = engine === 'fuse'
          ? fuzzyScore(entry, q)
          : lightScore(entry, q, words);
        return { entry, score };
      }).filter((item) => item.score > 0);

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ad = a.entry.kind === 'doc' ? 0 : 1;
        const bd = b.entry.kind === 'doc' ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return a.entry.title.localeCompare(b.entry.title);
      });

      return scored.slice(0, 32).map((item) => item.entry);
    }
  };
}

ready(() => {
  const state = {
    activeDoc: null,
    activeHeading: '',
    headingObserver: null,
    outlineLinks: new Map(),
    navLinks: new Map(),
    activeScore: null,
    commandOpen: false,
    commandResults: [],
    commandIndex: -1,
    pendingHeadingAfterRender: ''
  };

  const article = document.querySelector('.dr-article');
  if (!article) return;

  applySiteChrome(SITE_DATA);
  renderBrandFooter();

  const themeHelpers = ensureThemeHelpers();
  themeHelpers.apply(themeHelpers.current(), { persist: false });

  const themeBtn = document.getElementById('wc-theme-toggle');
  if (themeBtn) {
    themeBtn.innerHTML = `<span class="sr-only">Toggle theme</span>${iconMarkup('themeLight', 'dr-icon-sm')} ${iconMarkup('themeDark', 'dr-icon-sm')}`;
    const sync = () => {
      const mode = themeHelpers.current();
      themeBtn.dataset.mode = mode;
      themeBtn.setAttribute('aria-checked', String(mode === 'dark'));
      themeBtn.title = `Toggle theme (current: ${mode})`;
    };
    sync();
    themeBtn.addEventListener('click', () => {
      themeHelpers.cycle();
      sync();
    });
  }

  const navToggle = document.querySelector('[data-action="toggle-nav"]');
  const toolsToggle = document.querySelector('[data-action="toggle-right"]');
  const commandTrigger = document.querySelector('[data-action="open-command"]');
  const closeScoreBtn = document.querySelector('[data-action="close-score"]');

  if (navToggle) navToggle.innerHTML = iconMarkup('nav', 'dr-icon-sm');
  if (toolsToggle) toolsToggle.innerHTML = iconMarkup('tools', 'dr-icon-sm');
  if (commandTrigger) {
    commandTrigger.innerHTML = `${iconMarkup('search', 'dr-icon-sm')}<span>Search docs</span><kbd>⌘K</kbd>`;
  }

  const commandRoot = document.getElementById('dr-command-palette');
  const commandInput = document.getElementById('dr-command-input');
  const commandResults = document.getElementById('dr-command-results');
  const commandClose = document.querySelectorAll('[data-action="close-command"]');
  commandClose.forEach((node) => {
    if (node.classList.contains('dr-command-close')) {
      node.innerHTML = iconMarkup('close', 'dr-icon-sm');
    }
    node.addEventListener('click', () => {
      closeCommand();
    });
  });

  const mobileQuery = window.matchMedia('(max-width: 1040px)');

  function syncDrawerControls() {
    const isMobile = mobileQuery.matches;
    if (navToggle) {
      const expanded = isMobile ? document.body.classList.contains('dr-nav-open') : !document.body.classList.contains('dr-nav-collapsed');
      navToggle.setAttribute('aria-expanded', String(expanded));
    }
    if (toolsToggle) {
      const expanded = isMobile ? document.body.classList.contains('dr-right-open') : !document.body.classList.contains('dr-right-collapsed');
      toolsToggle.setAttribute('aria-expanded', String(expanded));
    }
  }

  function closeDrawers() {
    document.body.classList.remove('dr-nav-open', 'dr-right-open');
    syncDrawerControls();
  }

  navToggle?.addEventListener('click', () => {
    if (mobileQuery.matches) {
      const next = !document.body.classList.contains('dr-nav-open');
      document.body.classList.toggle('dr-nav-open', next);
      if (next) document.body.classList.remove('dr-right-open');
    } else {
      document.body.classList.toggle('dr-nav-collapsed');
    }
    syncDrawerControls();
  });

  toolsToggle?.addEventListener('click', () => {
    if (mobileQuery.matches) {
      const next = !document.body.classList.contains('dr-right-open');
      document.body.classList.toggle('dr-right-open', next);
      if (next) document.body.classList.remove('dr-nav-open');
    } else {
      document.body.classList.toggle('dr-right-collapsed');
    }
    syncDrawerControls();
  });

  document.querySelector('[data-action="close-drawers"]')?.addEventListener('click', closeDrawers);

  function getDocHashForHeading(headingId) {
    if (!state.activeDoc) return '';
    return buildRouteHash(state.activeDoc.id, headingId || '');
  }

  function navigate(docId, headingId = '') {
    const hash = buildRouteHash(docId, headingId);
    if (!hash) return;
    if (location.hash === hash) {
      state.pendingHeadingAfterRender = headingId || '';
      renderFromRoute();
      return;
    }
    location.hash = hash;
  }

  function openScoreExternal() {
    if (!state.activeScore || !state.activeScore.pdf) return;
    const page = Number.isFinite(Number(state.activeScore.page)) && Number(state.activeScore.page) >= 1
      ? `#page=${Math.floor(Number(state.activeScore.page))}`
      : '';
    window.open(`${state.activeScore.pdf}${page}`, '_blank', 'noopener');
  }

  closeScoreBtn?.addEventListener('click', () => {
    state.activeScore = null;
    syncScoreToolsPane(state.activeScore);
  });

  document.querySelector('[data-action="copy-page-link"]')?.addEventListener('click', async () => {
    if (!state.activeDoc) return;
    const url = `${location.origin}${location.pathname}${buildRouteHash(state.activeDoc.id, state.activeHeading || '')}`;
    const node = document.querySelector('[data-action="copy-page-link"]');
    const ok = await copyText(url);
    if (node) {
      node.textContent = ok ? 'Copied' : 'Copy page link';
      setTimeout(() => { node.textContent = 'Copy page link'; }, 1200);
    }
  });

  document.querySelector('[data-action="open-page-tab"]')?.addEventListener('click', () => {
    if (!state.activeDoc) return;
    const hash = buildRouteHash(state.activeDoc.id, state.activeHeading || '');
    window.open(`${location.pathname}${hash}`, '_blank', 'noopener');
  });

  document.querySelector('[data-action="scroll-top"]')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.querySelector('[data-score-open]')?.addEventListener('click', (ev) => {
    if (!state.activeScore || !state.activeScore.pdf) {
      ev.preventDefault();
      return;
    }
    openScoreExternal();
    ev.preventDefault();
  });

  const searchEngine = createSearchEngine(SEARCH_ENTRIES, SEARCH_CONFIG);

  function renderCommandResults(results) {
    if (!commandResults) return;
    commandResults.innerHTML = '';
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'dr-command-empty';
      empty.textContent = 'No results yet. Try title, heading, tags, or cue terms.';
      commandResults.appendChild(empty);
      state.commandIndex = -1;
      state.commandResults = [];
      return;
    }

    state.commandResults = results;
    state.commandIndex = 0;

    const grouped = new Map();
    results.forEach((result) => {
      const group = result.group || 'Docs';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(result);
    });

    let idx = 0;
    grouped.forEach((items, groupName) => {
      const block = document.createElement('section');
      const heading = document.createElement('h3');
      heading.className = 'dr-command-group-title';
      heading.textContent = groupName;
      block.appendChild(heading);

      items.forEach((result) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dr-command-item';
        button.dataset.index = String(idx);
        button.innerHTML = `<span class="dr-command-item-title">${result.title || 'Untitled'}</span><span class="dr-command-item-snippet">${result.snippet || ''}</span><span class="dr-command-item-meta">${result.kind === 'heading' ? 'Heading' : 'Page'} · ${result.docId || ''}</span>`;
        button.addEventListener('click', () => {
          const entry = state.commandResults[Number(button.dataset.index)];
          if (!entry) return;
          closeCommand();
          navigate(entry.docId || parseRouteHash(entry.url).docId, entry.headingId || parseRouteHash(entry.url).heading);
        });
        if (idx === 0) button.classList.add('is-active');
        block.appendChild(button);
        idx += 1;
      });

      commandResults.appendChild(block);
    });
  }

  function updateCommandActiveIndex(nextIndex) {
    if (!commandResults) return;
    const total = state.commandResults.length;
    if (!total) {
      state.commandIndex = -1;
      return;
    }
    state.commandIndex = ((nextIndex % total) + total) % total;
    const buttons = commandResults.querySelectorAll('.dr-command-item');
    buttons.forEach((button) => {
      const isActive = Number(button.dataset.index) === state.commandIndex;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.scrollIntoView({ block: 'nearest' });
    });
  }

  function openCommand(prefill = '') {
    if (!commandRoot || !commandInput) return;
    commandRoot.hidden = false;
    state.commandOpen = true;
    commandInput.value = prefill;
    renderCommandResults(searchEngine.search(prefill));
    setTimeout(() => {
      commandInput.focus();
      commandInput.select();
    }, 0);
  }

  function closeCommand() {
    if (!commandRoot) return;
    commandRoot.hidden = true;
    state.commandOpen = false;
    if (commandInput) commandInput.value = '';
  }

  commandTrigger?.addEventListener('click', () => openCommand(''));
  commandInput?.addEventListener('input', () => {
    renderCommandResults(searchEngine.search(commandInput.value || ''));
  });
  commandInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      updateCommandActiveIndex(state.commandIndex + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      updateCommandActiveIndex(state.commandIndex - 1);
    } else if (ev.key === 'Enter') {
      const current = state.commandResults[state.commandIndex];
      if (!current) return;
      ev.preventDefault();
      closeCommand();
      navigate(current.docId || parseRouteHash(current.url).docId, current.headingId || parseRouteHash(current.url).heading);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      closeCommand();
    }
  });

  function resolveDocFromRoute() {
    const route = parseRouteHash(location.hash || '');
    let doc = getDocByRoute(route.docId);
    if (!doc) {
      if (PLACEHOLDER_DOC) {
        doc = PLACEHOLDER_DOC;
      } else {
        doc = getHomepageDoc();
      }
    }
    return {
      doc,
      heading: route.heading || ''
    };
  }

  function renderDocument(doc, headingId) {
    article.innerHTML = '';
    const homepage = getHomepageDoc();
    const isHomepage = !!(homepage && doc && homepage.id === doc.id);

    renderHero(article, doc, isHomepage);

    if (isHomepage) {
      renderHomeSections(article);
    }

    renderModules(article, Array.isArray(doc.modules) ? doc.modules : [], doc, state);

    const prose = document.createElement('section');
    prose.className = 'dr-prose';
    prose.innerHTML = ensureHtml(doc.html, 'doc.html');
    article.appendChild(prose);

    enhanceCodeBlocks(prose);
    const headings = buildHeadings(prose);
    enhanceHeadingAnchors(headings, getDocHashForHeading);

    if (state.headingObserver) state.headingObserver.disconnect();
    const outline = renderOutline(headings, (id) => {
      state.activeHeading = id;
      const hash = buildRouteHash(doc.id, id);
      if (hash && location.hash !== hash) {
        history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
      }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    state.outlineLinks = outline.links;
    state.headingObserver = observeHeadingActivity(headings, (id) => {
      state.activeHeading = id;
      state.outlineLinks.forEach((button, key) => {
        if (!button) return;
        button.classList.toggle('is-active', key === id);
      });
    });

    const targetHeading = state.pendingHeadingAfterRender || headingId;
    if (targetHeading) {
      const target = document.getElementById(targetHeading);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 35);
      }
    }
    state.pendingHeadingAfterRender = '';

    renderBreadcrumbs(doc);
    renderMeta(doc);
  }

  function setActiveNav(docId) {
    state.navLinks.forEach((link, id) => {
      if (!link) return;
      link.classList.toggle('is-active', id === docId);
    });
  }

  function renderFromRoute() {
    const resolved = resolveDocFromRoute();
    const doc = resolved.doc;
    if (!doc) return;

    if (doc.id !== state.activeDoc?.id) {
      state.activeScore = null;
      syncScoreToolsPane(state.activeScore);
    }

    state.activeDoc = doc;
    state.activeHeading = resolved.heading || '';

    renderDocument(doc, resolved.heading);
    setActiveNav(doc.id);

    const targetHash = buildRouteHash(doc.id, resolved.heading || '');
    if (targetHash && location.hash !== targetHash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${targetHash}`);
    }
  }

  state.navLinks = renderNav(({ href, docId }) => {
    closeDrawers();
    if (docId) {
      navigate(docId, '');
      return;
    }
    const parsed = parseRouteHash(href);
    if (parsed.docId) {
      navigate(parsed.docId, parsed.heading);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (state.commandOpen) {
        closeCommand();
        return;
      }
      closeDrawers();
      return;
    }

    const target = ev.target;
    const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      openCommand('');
      return;
    }

    if (!isEditable && ev.key === '/' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      ev.preventDefault();
      openCommand('');
      return;
    }

    if (!isEditable && ev.key.toLowerCase() === 'c' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      const active = document.activeElement;
      if (active && active.classList && active.classList.contains('dr-copy-btn')) {
        active.click();
      }
    }
  });

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', () => {
      closeDrawers();
      if (mobileQuery.matches) {
        document.body.classList.remove('dr-nav-collapsed', 'dr-right-collapsed');
      }
      syncDrawerControls();
    });
  }

  syncDrawerControls();
  renderFromRoute();
  window.addEventListener('hashchange', renderFromRoute);
});
