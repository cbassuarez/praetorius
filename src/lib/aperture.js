const SIZE_MAP = { sm: 24, md: 32, lg: 40 };
const STYLE_ID = 'prae-aperture-style';
const SVG_NS = 'http://www.w3.org/2000/svg';
const APERTURE_SVG_STRING = `<svg class="prae-aperture__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision">
    <circle cx="32" cy="32" r="20"></circle>
    <circle cx="32" cy="32" r="5"></circle>
    <path d="M32 18 C38 23, 42 27, 44 32"></path>
    <path d="M32 18 C38 23, 42 27, 44 32" transform="rotate(60 32 32)"></path>
    <path d="M32 18 C38 23, 42 27, 44 32" transform="rotate(120 32 32)"></path>
    <path d="M32 18 C38 23, 42 27, 44 32" transform="rotate(180 32 32)"></path>
    <path d="M32 18 C38 23, 42 27, 44 32" transform="rotate(240 32 32)"></path>
    <path d="M32 18 C38 23, 42 27, 44 32" transform="rotate(300 32 32)"></path>
  </g>
</svg>`;

const BRAND_DEFAULTS = Object.freeze({
  showAperture: true,
  href: 'https://www.npmjs.com/package/praetorius',
  target: '_blank',
  size: 'md',
  theme: 'auto',
  title: '',
  ariaLabel: '',
  className: ''
});

let cachedUrl = null;
let titleIdCounter = 0;

function resolveDocument(target) {
  if (!target) return typeof document !== 'undefined' ? document : null;
  return target.ownerDocument || (typeof document !== 'undefined' ? document : null);
}

function ensureStyles(doc) {
  if (!doc) return;
  const head = doc.head || doc.querySelector('head');
  if (!head) return;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .prae-aperture {
      --size: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: var(--size);
      block-size: var(--size);
      color: var(--prae-aperture-color, var(--fg, currentColor));
      transition: opacity 0.18s ease, transform 0.18s ease;
      line-height: 0;
    }
    .prae-aperture[data-prae-size="sm"] { --size: 24px; }
    .prae-aperture[data-prae-size="md"] { --size: 32px; }
    .prae-aperture[data-prae-size="lg"] { --size: 40px; }
    .prae-aperture svg {
      inline-size: 100%;
      block-size: 100%;
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      transform-origin: center;
    }
    .prae-aperture:hover svg,
    .prae-aperture:focus-visible svg {
      opacity: 0.88;
      transform: scale(1.02);
    }
    .prae-aperture[data-prae-theme="light"] {
      color: var(--prae-aperture-color-light, var(--fg, #111));
    }
    .prae-aperture[data-prae-theme="dark"] {
      color: var(--prae-aperture-color-dark, var(--fg, #f5f5f5));
    }
    [data-theme="dark"] .prae-aperture:not([data-prae-theme="light"]):not([data-prae-theme="dark"]) {
      color: var(--prae-aperture-color-dark, var(--fg, #f5f5f5));
    }
    [data-theme="light"] .prae-aperture:not([data-prae-theme="light"]):not([data-prae-theme="dark"]) {
      color: var(--prae-aperture-color-light, var(--fg, #111));
    }
    .prae-aperture:focus {
      outline: none;
    }
    .prae-aperture:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
  `;
  head.appendChild(style);
}

function createSvg(doc) {
  const template = doc.createElement('template');
  template.innerHTML = APERTURE_SVG_STRING.trim();
  const svg = template.content.firstElementChild;
  if (svg) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}

function applyAccessibility(svg, options) {
  if (!svg) return;
  svg.querySelectorAll('title').forEach((node) => node.remove());
  svg.removeAttribute('aria-labelledby');
  svg.removeAttribute('aria-label');
  if (options.title) {
    const titleEl = svg.ownerDocument.createElementNS(SVG_NS, 'title');
    const id = `prae-aperture-title-${++titleIdCounter}`;
    titleEl.setAttribute('id', id);
    titleEl.textContent = options.title;
    svg.insertBefore(titleEl, svg.firstChild);
    svg.setAttribute('aria-labelledby', id);
    svg.removeAttribute('aria-hidden');
  } else if (options.ariaLabel) {
    svg.setAttribute('aria-label', options.ariaLabel);
    svg.removeAttribute('aria-hidden');
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
}

function normalizeSize(size) {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    return { key: 'custom', value: size };
  }
  if (size === 'sm' || size === 'lg') {
    return { key: size, value: SIZE_MAP[size] };
  }
  return { key: 'md', value: SIZE_MAP.md };
}

function applyOptions(root, options) {
  if (!root) return;
  const doc = resolveDocument(root);
  if (!doc) return;
  let svg = root.querySelector('svg');
  if (!svg) {
    svg = createSvg(doc);
    if (svg) root.appendChild(svg);
  }

  const { key, value } = normalizeSize(options.size);
  root.dataset.praeAperture = '1';
  root.dataset.praeSize = key;
  if (key === 'custom') {
    root.style.setProperty('--size', `${value}px`);
  } else {
    root.style.removeProperty('--size');
  }

  if (options.theme === 'light' || options.theme === 'dark') {
    root.dataset.praeTheme = options.theme;
  } else {
    delete root.dataset.praeTheme;
  }

  const baseClass = 'prae-aperture';
  root.className = options.className
    ? `${baseClass} ${options.className}`.trim()
    : baseClass;

  if (root.tagName === 'A') {
    if (options.linkHref) {
      root.setAttribute('href', options.linkHref);
    } else {
      root.removeAttribute('href');
    }
    if (options.linkTarget) {
      root.setAttribute('target', options.linkTarget);
      if (options.linkTarget === '_blank') {
        root.setAttribute('rel', 'noopener');
      } else {
        root.removeAttribute('rel');
      }
    } else {
      root.removeAttribute('target');
      root.removeAttribute('rel');
    }
  }

  applyAccessibility(svg, options);
}

function normalizeOptions(options = {}) {
  const out = { ...options };
  out.size = options.size ?? 'md';
  out.theme = options.theme ?? 'auto';
  out.className = options.className ?? '';
  out.linkHref = options.linkHref || '';
  out.linkTarget = options.linkTarget || '';
  out.title = options.title ? String(options.title) : '';
  out.ariaLabel = options.ariaLabel ? String(options.ariaLabel) : '';
  return out;
}

export function injectAperture(target, options = {}) {
  if (!target || typeof target.querySelector !== 'function') return null;
  const doc = resolveDocument(target);
  if (!doc) return null;
  ensureStyles(doc);
  const normalized = normalizeOptions(options);
  const existing = target.querySelector('[data-prae-aperture]');
  if (existing) {
    applyOptions(existing, normalized);
    return existing;
  }
  const root = normalized.linkHref ? doc.createElement('a') : doc.createElement('span');
  const svg = createSvg(doc);
  if (svg) root.appendChild(svg);
  applyOptions(root, normalized);
  target.appendChild(root);
  return root;
}

export function resolveBrandConfig(overrides = {}) {
  const source = (typeof window !== 'undefined' && window.PRAE && window.PRAE.config && window.PRAE.config.site && window.PRAE.config.site.brand)
    ? window.PRAE.config.site.brand
    : {};
  const merged = { ...BRAND_DEFAULTS, ...(source || {}), ...(overrides || {}) };
  const sizeValue = (() => {
    const raw = merged.size;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (['sm', 'md', 'lg'].includes(trimmed)) return trimmed;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return BRAND_DEFAULTS.size;
  })();
  const normalized = {
    showAperture: merged.showAperture !== false,
    href: typeof merged.href === 'string' && merged.href.trim() ? merged.href.trim() : BRAND_DEFAULTS.href,
    target: merged.target === '_self' ? '_self' : '_blank',
    size: sizeValue,
    theme: merged.theme === 'light' || merged.theme === 'dark' ? merged.theme : BRAND_DEFAULTS.theme,
    title: typeof merged.title === 'string' ? merged.title.trim() : '',
    ariaLabel: typeof merged.ariaLabel === 'string' ? merged.ariaLabel.trim() : '',
    className: typeof merged.className === 'string' ? merged.className.trim() : ''
  };
  return normalized;
}

export function ensureBrandMark(target, overrides = {}) {
  if (!target || typeof target.querySelector !== 'function') return null;
  const config = resolveBrandConfig(overrides);
  const existing = target.querySelector('[data-prae-aperture]');
  if (!config.showAperture) {
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    return null;
  }
  const element = injectAperture(target, {
    linkHref: config.href,
    linkTarget: config.target,
    size: config.size,
    theme: config.theme,
    title: config.title,
    ariaLabel: config.ariaLabel,
    className: config.className
  });
  if (!element) return null;
  if (target.firstChild && target.firstChild !== element) {
    target.insertBefore(element, target.firstChild);
  }
  return element;
}

export function getApertureUrl() {
  if (cachedUrl !== null) return cachedUrl;
  try {
    cachedUrl = new URL('../../assets/aperture.svg', import.meta.url).href;
  } catch (_) {
    cachedUrl = '';
  }
  return cachedUrl;
}

export const apertureSvgString = APERTURE_SVG_STRING;
export const apertureSvgUrl = getApertureUrl();
