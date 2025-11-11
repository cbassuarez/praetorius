const DEFAULT_NAV_DATA = [
  {
    id: 'start',
    label: 'Getting started',
    items: [
      { id: 'overview', label: 'Overview', href: '#overview', snippet: 'Meet the Docs Reader shell and run your first build.' },
      { id: 'layout', label: 'Layout anatomy', href: '#layout', snippet: 'Tour the three-pane responsive layout.' },
      { id: 'search', label: 'Search & shortcuts', href: '#search', snippet: 'Keyboard-driven instant search and link sharing.' }
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    items: [
      { id: 'integration', label: 'Works Console', href: '#integration', snippet: 'Keep HUD and PDF hooks without extra wiring.' }
    ]
  }
];

const NAV_STATE_KEY = 'docs-reader.nav.state';
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

const DOCS_DATA = readDocsData();
const NAV_DATA = Array.isArray(DOCS_DATA.nav) && DOCS_DATA.nav.length ? DOCS_DATA.nav : DEFAULT_NAV_DATA;
const SEARCH_INDEX = Array.isArray(DOCS_DATA.search) && DOCS_DATA.search.length
  ? DOCS_DATA.search
  : DEFAULT_NAV_DATA.flatMap(group => group.items.map(item => ({
      title: item.label,
      url: item.href,
      snippet: item.snippet,
      group: group.label
    })));

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
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
  const THEME_CLASSES = ['prae-theme-light', 'prae-theme-dark'];

  function normalize(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function readStoredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return 'dark';
      if (saved.trim().startsWith('{')) {
        const parsed = JSON.parse(saved);
        return normalize(parsed?.mode);
      }
      return normalize(saved);
    } catch (_) {
      return 'dark';
    }
  }

  function syncTheme(mode) {
    const eff = normalize(mode);
    const body = document.body;
    const doc = document.documentElement;
    const consoleHost = document.getElementById('works-console');
    if (doc) {
      doc.setAttribute('data-theme', eff);
      doc.style.colorScheme = eff === 'dark' ? 'dark' : 'light';
    }
    if (body) {
      body.setAttribute('data-theme', eff);
      body.classList.remove(...THEME_CLASSES);
      body.classList.add(eff === 'dark' ? THEME_CLASSES[1] : THEME_CLASSES[0]);
    }
    if (consoleHost) {
      consoleHost.classList.remove(...THEME_CLASSES);
      consoleHost.classList.add(eff === 'dark' ? THEME_CLASSES[1] : THEME_CLASSES[0]);
      consoleHost.setAttribute('data-theme', eff);
    }
    return eff;
  }

  function applyTheme(mode, opts) {
    const eff = syncTheme(mode);
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, eff); } catch (_) {}
    }
    const btn = document.getElementById('wc-theme-toggle');
    if (btn) {
      btn.setAttribute('aria-checked', String(eff === 'dark'));
      btn.dataset.mode = eff;
      btn.title = `Toggle theme (current: ${eff})`;
    }
    return eff;
  }

  function currentTheme() {
    const body = document.body;
    const attr = body?.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return readStoredTheme();
  }

  function cycleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  window.praeApplyTheme = applyTheme;
  window.praeCurrentTheme = currentTheme;
  window.praeCycleTheme = cycleTheme;

  return { apply: applyTheme, current: currentTheme, cycle: cycleTheme };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/["'’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function readNavState() {
  try {
    const raw = localStorage.getItem(NAV_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeNavState(state) {
  try {
    localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function copyToClipboard(text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
  }
  return fallback();

  function fallback() {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return Promise.resolve(ok);
  }
}

function applySiteChrome(site) {
  const title = site?.title || 'Praetorius Docs';
  const subtitle = site?.subtitle || '';
  document.title = subtitle ? `${title} — ${subtitle}` : title;
  document.querySelectorAll('[data-site-title]').forEach((el) => { el.textContent = title; });
  document.querySelectorAll('[data-site-subtitle]').forEach((el) => { el.textContent = subtitle; });
  if (site?.accent) {
    document.documentElement.style.setProperty('--prae-color-accent', site.accent);
  }
}

function buildHeroElement(hero) {
  if (!hero || (!hero.title && !hero.lede && !hero.kicker)) return null;
  const header = document.createElement('header');
  header.className = 'docs-hero';

  if (hero.kicker) {
    const kicker = document.createElement('p');
    kicker.className = 'docs-kicker';
    kicker.textContent = hero.kicker;
    header.appendChild(kicker);
  }

  const title = document.createElement('h1');
  title.textContent = hero.title || 'Documentation';
  header.appendChild(title);

  if (hero.lede) {
    const lede = document.createElement('p');
    lede.className = 'docs-lede';
    lede.textContent = hero.lede;
    header.appendChild(lede);
  }

  if (Array.isArray(hero.works) && hero.works.length) {
    const highlights = document.createElement('div');
    highlights.className = 'docs-hero-highlights';
    const heading = document.createElement('h2');
    heading.textContent = 'Featured works';
    highlights.appendChild(heading);
    const list = document.createElement('ul');
    hero.works.forEach((work) => {
      const li = document.createElement('li');
      li.id = `works-${slugify(work.id || work.title || '')}`;
      const label = document.createElement('strong');
      label.textContent = work.title || 'Untitled';
      li.appendChild(label);
      if (work.summary || work.snippet || work.description || work.onelinerEffective || work.descriptionEffective) {
        const p = document.createElement('p');
        const summary = work.summary
          ?? work.snippet
          ?? work.description
          ?? work.onelinerEffective
          ?? work.descriptionEffective
          ?? '';
        if (typeof summary === 'string') {
          p.textContent = summary;
        } else if (summary && typeof summary === 'object') {
          if (typeof summary.text === 'string') {
            p.textContent = summary.text;
          } else if (typeof summary.html === 'string') {
            p.innerHTML = summary.html;
          } else {
            p.textContent = String(summary);
          }
        } else {
          p.textContent = String(summary || '');
        }
        li.appendChild(p);
      }
      list.appendChild(li);
    });
    highlights.appendChild(list);
    header.appendChild(highlights);
  }

  return header;
}

function renderDocsContent(article, data) {
  if (!article) return;
  article.innerHTML = '';
  const hero = buildHeroElement(data.hero);
  if (hero) article.appendChild(hero);
  const sections = Array.isArray(data.sections) ? data.sections : [];
  sections.forEach((section) => {
    const sec = document.createElement('section');
    sec.className = 'docs-section';
    const id = section?.id || slugify(section?.title || 'section');
    sec.id = id;
    sec.setAttribute('data-source', section?.type || 'markdown');
    sec.innerHTML = section?.html || '';
    article.appendChild(sec);
  });
}

function buildNav(nav, state, onActivate) {
  if (!nav) return new Map();
  nav.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'docs-nav-scroll';
  nav.appendChild(scroll);

  const linkMap = new Map();
  const groupsState = { ...state };

  NAV_DATA.forEach(group => {
    const groupEl = document.createElement('section');
    groupEl.className = 'docs-nav-group';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'docs-nav-group-toggle';
    const open = groupsState[group.id] !== false;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = `<span>${group.label}</span><span aria-hidden="true">${open ? '▾' : '▸'}</span>`;

    const list = document.createElement('ul');
    list.className = 'docs-nav-items';
    list.hidden = !open;

    toggle.addEventListener('click', () => {
      const next = list.hidden;
      list.hidden = !next;
      groupsState[group.id] = next;
      toggle.setAttribute('aria-expanded', String(next));
      toggle.lastElementChild.textContent = next ? '▾' : '▸';
      writeNavState(groupsState);
    });

    group.items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'docs-nav-item';
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;
      link.addEventListener('click', (ev) => {
        if (typeof onActivate === 'function') onActivate(item.href);
        // allow default navigation (hash)
      });
      li.appendChild(link);
      list.appendChild(li);
      const id = item.href.replace('#', '');
      linkMap.set(id, link);
    });

    groupEl.appendChild(toggle);
    groupEl.appendChild(list);
    scroll.appendChild(groupEl);
  });

  return linkMap;
}

function buildOutline(container, headings) {
  if (!container) return new Map();
  container.innerHTML = '';
  const title = document.createElement('h2');
  title.textContent = 'On this page';
  container.appendChild(title);
  const list = document.createElement('ul');
  list.className = 'docs-outline-list';
  container.appendChild(list);
  const map = new Map();

  headings.forEach(({ element, depth }) => {
    const id = element.id || slugify(element.textContent || 'section');
    element.id = id;
    const li = document.createElement('li');
    li.className = 'docs-outline-item';
    li.dataset.depth = String(depth);
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = element.textContent || id;
    li.appendChild(link);
    list.appendChild(li);
    map.set(id, li);
  });

  return map;
}

function enhanceHeadings(headings) {
  headings.forEach(({ element }) => {
    if (!element) return;
    const id = element.id || slugify(element.textContent || 'section');
    element.id = id;
    element.setAttribute('tabindex', '-1');
    if (element.querySelector('.docs-heading-anchor')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'docs-heading-anchor';
    btn.setAttribute('aria-label', `Copy link to ${element.textContent || id}`);
    btn.textContent = '#';
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const url = `${location.origin}${location.pathname}#${id}`;
      const ok = await copyToClipboard(url);
      if (ok) {
        btn.dataset.copied = '1';
        btn.textContent = '✓';
        setTimeout(() => {
          btn.dataset.copied = '0';
          btn.textContent = '#';
        }, 1600);
      }
    });
    element.appendChild(btn);
  });
}

function enhanceCodeBlocks(root) {
  if (!root) return;
  const blocks = root.querySelectorAll('pre');
  blocks.forEach((pre, index) => {
    pre.setAttribute('tabindex', '0');
    if (!pre.querySelector('.docs-copy-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'docs-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const ok = await copyToClipboard(pre.textContent || '');
        btn.textContent = ok ? 'Copied' : 'Copy';
        btn.dataset.state = ok ? 'copied' : 'error';
        setTimeout(() => {
          btn.textContent = 'Copy';
          delete btn.dataset.state;
        }, 1800);
      });
      pre.appendChild(btn);
    }
  });

  const inlineCodes = root.querySelectorAll('p code, li code');
  inlineCodes.forEach(code => {
    if (code.closest('pre') || code.parentElement?.classList.contains('inline-copy')) return;
    const wrapper = document.createElement('span');
    wrapper.className = 'inline-copy';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy code snippet');
    btn.textContent = '⧉';
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const ok = await copyToClipboard(code.textContent || '');
      btn.textContent = ok ? '✓' : '⧉';
      setTimeout(() => { btn.textContent = '⧉'; }, 1400);
    });
    code.replaceWith(wrapper);
    wrapper.append(code, btn);
  });
}

function buildHeadings(root) {
  if (!root) return [];
  const selector = 'h2, h3';
  const nodes = Array.from(root.querySelectorAll(selector));
  return nodes.map(el => ({ element: el, depth: el.tagName === 'H3' ? 3 : 2 }));
}

function observeHeadings(headings, onActive) {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible.length) {
      const id = visible[0].target.id;
      if (id) onActive(id);
      return;
    }
    const top = entries
      .map(entry => ({ id: entry.target.id, top: entry.boundingClientRect.top }))
      .sort((a, b) => a.top - b.top)
      .find(entry => entry.top >= 0);
    if (top?.id) onActive(top.id);
  }, { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

  headings.forEach(({ element }) => { if (element) observer.observe(element); });
}

function buildSearchAdapter() {
  return function runSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX
      .map(item => ({
        ...item,
        score: matchScore(item, q)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  };

  function matchScore(item, q) {
    const haystack = `${item.title} ${item.group ?? ''} ${item.snippet ?? ''}`.toLowerCase();
    if (haystack.includes(q)) return q.length;
    const words = q.split(/\s+/);
    let score = 0;
    words.forEach(word => {
      if (word && haystack.includes(word)) score += word.length;
    });
    return score;
  }
}

function setupSearch(root, onNavigate) {
  if (!root) return;
  const input = root.querySelector('#docs-search-input');
  const resultsHost = root.querySelector('#docs-search-results');
  if (!input || !resultsHost) return;
  const search = buildSearchAdapter();
  let activeIndex = -1;
  let lastResults = [];

  input.addEventListener('input', () => {
    const q = input.value;
    const hits = search(q);
    renderResults(hits);
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      if (!lastResults.length) return;
      ev.preventDefault();
      activeIndex = (activeIndex + 1) % lastResults.length;
      updateActive();
    } else if (ev.key === 'ArrowUp') {
      if (!lastResults.length) return;
      ev.preventDefault();
      activeIndex = (activeIndex - 1 + lastResults.length) % lastResults.length;
      updateActive();
    } else if (ev.key === 'Enter') {
      if (activeIndex >= 0 && lastResults[activeIndex]) {
        ev.preventDefault();
        go(lastResults[activeIndex].url);
      }
    } else if (ev.key === 'Escape') {
      clearResults();
      input.blur();
    }
  });

  resultsHost.addEventListener('mousedown', (ev) => {
    // prevent input blur before click handler
    ev.preventDefault();
  });

  resultsHost.addEventListener('click', (ev) => {
    const item = ev.target.closest('.docs-search-item');
    if (!item) return;
    const url = item.getAttribute('data-url');
    go(url);
  });

  function renderResults(items) {
    lastResults = items;
    activeIndex = items.length ? 0 : -1;
    if (!items.length) {
      clearResults();
      return;
    }
    resultsHost.innerHTML = '';
    items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'docs-search-item';
      btn.setAttribute('role', 'option');
      btn.dataset.url = item.url;
      btn.dataset.index = String(i);
      btn.id = `docs-search-item-${i}`;
      btn.innerHTML = `<strong>${item.title}</strong><span class="docs-search-snippet">${item.snippet || ''}</span>`;
      resultsHost.appendChild(btn);
    });
    resultsHost.hidden = false;
    updateActive();
  }

  function updateActive() {
    const buttons = resultsHost.querySelectorAll('.docs-search-item');
    buttons.forEach((btn, idx) => {
      if (idx === activeIndex) {
        btn.setAttribute('aria-selected', 'true');
        btn.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', btn.id);
      } else {
        btn.removeAttribute('aria-selected');
      }
    });
    if (activeIndex < 0) {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function clearResults() {
    resultsHost.hidden = true;
    resultsHost.innerHTML = '';
    activeIndex = -1;
    lastResults = [];
    input.removeAttribute('aria-activedescendant');
  }

  function go(url) {
    clearResults();
    if (!url) return;
    if (typeof onNavigate === 'function') onNavigate(url);
    location.hash = url;
  }

  document.addEventListener('keydown', (ev) => {
    const target = ev.target;
    const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
    if (ev.key === '/' && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !isEditable) {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  });

  document.addEventListener('click', (ev) => {
    if (!resultsHost.contains(ev.target) && ev.target !== input) {
      clearResults();
    }
  });
}

function setupDrawers() {
  const navBtn = document.querySelector('[data-action="toggle-nav"]');
  const outlineBtn = document.querySelector('[data-action="toggle-outline"]');
  const overlay = document.querySelector('.docs-drawer-overlay');
  const mq = window.matchMedia('(max-width: 960px)');

  function closeMobile() {
    document.body.classList.remove('docs-nav-open', 'docs-outline-open');
  }

  function syncState() {
    const isMobile = mq.matches;
    if (navBtn) {
      const expanded = isMobile
        ? document.body.classList.contains('docs-nav-open')
        : !document.body.classList.contains('docs-nav-collapsed');
      navBtn.setAttribute('aria-expanded', String(expanded));
    }
    if (outlineBtn) {
      const expanded = isMobile
        ? document.body.classList.contains('docs-outline-open')
        : !document.body.classList.contains('docs-outline-collapsed');
      outlineBtn.setAttribute('aria-expanded', String(expanded));
    }
  }

  navBtn?.addEventListener('click', () => {
    if (mq.matches) {
      const open = !document.body.classList.contains('docs-nav-open');
      document.body.classList.toggle('docs-nav-open', open);
      if (open) document.body.classList.remove('docs-outline-open');
    } else {
      const collapsed = document.body.classList.toggle('docs-nav-collapsed');
      if (!collapsed) document.body.classList.remove('docs-outline-collapsed');
    }
    syncState();
  });

  outlineBtn?.addEventListener('click', () => {
    if (mq.matches) {
      const open = !document.body.classList.contains('docs-outline-open');
      document.body.classList.toggle('docs-outline-open', open);
      if (open) document.body.classList.remove('docs-nav-open');
    } else {
      const collapsed = document.body.classList.toggle('docs-outline-collapsed');
      if (!collapsed) document.body.classList.remove('docs-nav-collapsed');
    }
    syncState();
  });

  overlay?.addEventListener('click', () => {
    closeMobile();
    syncState();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      closeMobile();
      syncState();
    }
  });

  const handleChange = () => {
    closeMobile();
    if (mq.matches) {
      document.body.classList.remove('docs-nav-collapsed', 'docs-outline-collapsed');
    }
    syncState();
  };

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handleChange);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(handleChange);
  }

  syncState();

  return {
    close: () => {
      closeMobile();
      syncState();
    }
  };
}

function attachCopyShortcut(root) {
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'c' && ev.key !== 'C') return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const active = document.activeElement;
    if (!active) return;
    if (active.classList.contains('docs-copy-btn')) {
      active.click();
      ev.preventDefault();
      return;
    }
    const pre = active.closest ? active.closest('pre') : null;
    if (pre) {
      const btn = pre.querySelector('.docs-copy-btn');
      if (btn) {
        btn.click();
        ev.preventDefault();
      }
    }
  });
}

ready(() => {
  const { apply, current, cycle } = ensureThemeHelpers();
  apply(current(), { persist: false });

  applySiteChrome(DOCS_DATA.site || {});
  const article = document.querySelector('.docs-article');
  const hasDynamicContent = Array.isArray(DOCS_DATA.sections) && DOCS_DATA.sections.length > 0;
  if (hasDynamicContent) {
    renderDocsContent(article, DOCS_DATA);
  }

  const themeBtn = document.getElementById('wc-theme-toggle');
  if (themeBtn && themeBtn.childElementCount === 0) {
    themeBtn.innerHTML = '<span class="sr-only">Toggle theme</span><span class="docs-theme-icon" data-mode="light">🌞</span><span class="docs-theme-icon" data-mode="dark">🌜</span>';
  }
  if (themeBtn) {
    const syncThemeBtn = () => {
      const mode = current();
      themeBtn.setAttribute('aria-checked', String(mode === 'dark'));
      themeBtn.dataset.mode = mode;
    };
    syncThemeBtn();
    themeBtn.addEventListener('click', () => {
      cycle();
      syncThemeBtn();
    });
    themeBtn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        cycle();
        syncThemeBtn();
      }
    });
  }

  const closeDrawers = setupDrawers().close;
  const main = document.getElementById('docs-main');
  const headings = buildHeadings(main);
  enhanceHeadings(headings);
  enhanceCodeBlocks(main);
  attachCopyShortcut(main);

  const navState = readNavState();
  const navLinkMap = buildNav(document.getElementById('docs-nav'), navState, () => closeDrawers());
  const outlineMap = buildOutline(document.getElementById('docs-outline'), headings);

  function setActive(id) {
    navLinkMap.forEach((link, key) => {
      if (!link) return;
      link.classList.toggle('is-active', key === id);
    });
    outlineMap.forEach((item, key) => {
      if (!item) return;
      item.classList.toggle('is-active', key === id);
    });
  }

  observeHeadings(headings, setActive);
  if (headings[0]?.element?.id) {
    setActive(headings[0].element.id);
  }

  setupSearch(document, (url) => {
    closeDrawers();
    setTimeout(() => {
      const targetId = url.replace('#', '');
      const target = document.getElementById(targetId);
      if (target) target.focus({ preventScroll: false });
    }, 50);
  });

  document.addEventListener('click', (ev) => {
    if (ev.target.closest?.('#docs-nav a')) closeDrawers();
    if (ev.target.closest?.('#docs-outline a')) closeDrawers();
  });
});
