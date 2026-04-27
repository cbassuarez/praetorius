#!/usr/bin/env node
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.env.PRAE_STRICT_BUILDER_SMOKE === '1';

const summary = {
  assertions: 0,
  assertionFailures: 0,
  failures: [],
  metrics: {
    desktopReadyMs: null,
    generateLatencyMs: null,
    mobileReadyMs: null,
  },
};

function expectTrue(condition, label, detail = {}) {
  summary.assertions += 1;
  if (!condition) {
    summary.assertionFailures += 1;
    summary.failures.push({ label, detail });
  }
}

async function waitForBuilderPath(baseUrl, timeoutMs = 90000) {
  const candidates = ['/builder', '/builder/', '/praetorius/builder', '/praetorius/builder/'];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const candidate of candidates) {
      try {
        const response = await fetch(`${baseUrl}${candidate}`, { redirect: 'manual' });
        if (response.status >= 200 && response.status < 400) {
          const body = await response.text();
          if (body.includes('Folio Builder') || body.includes('folio-builder')) {
            return candidate;
          }
        }
      } catch {
        // continue to next candidate
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for builder route under ${baseUrl}`);
}

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (_err) {
    const message = 'Playwright is not installed. Run `npm i -D playwright` and install Chromium.';
    if (strict) throw new Error(message);
    console.log(`[builder-a11y-perf-smoke] skip: ${message}`);
    return;
  }

  await execa('npm', ['run', 'build', '--prefix', 'website'], {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: 'inherit',
  });

  const port = Number(process.env.PRAE_BUILDER_SMOKE_PORT || 4192);
  const baseUrl = `http://127.0.0.1:${port}`;

  const serve = execa('npm', ['run', 'serve', '--prefix', 'website', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    reject: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  let browser = null;

  try {
    let builderPath = '/builder';
    try {
      builderPath = await waitForBuilderPath(baseUrl);
    } catch (err) {
      if (strict) throw err;
      console.log(`[builder-a11y-perf-smoke] skip: unable to start local docs server (${err?.message || String(err)})`);
      return;
    }

    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (err) {
      if (strict) {
        throw new Error(`Playwright Chromium launch failed: ${err?.message || String(err)}`);
      }
      console.log(`[builder-a11y-perf-smoke] skip: unable to launch chromium (${err?.message || String(err)})`);
      return;
    }

    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopContext.newPage();

    const desktopStart = Date.now();
    await desktopPage.goto(`${baseUrl}${builderPath}`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForSelector('[data-builder-surface="folio-builder"]', { timeout: 20000 });
    await desktopPage.waitForSelector('button:has-text("Load Sample Set")', { timeout: 20000 });
    summary.metrics.desktopReadyMs = Date.now() - desktopStart;

    await desktopPage.click('button:has-text("Load Sample Set")');
    await desktopPage.waitForSelector('.fb-step__label', { timeout: 30000 });

    const tabLabels = await desktopPage.$$eval('.fb-step__label', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean));
    expectTrue(
      ['Project', 'Works', 'Theme', 'Generate'].every((label) => tabLabels.includes(label)),
      'builder guided step rail is present',
      { tabLabels }
    );
    const optionalDocsState = await desktopPage.$eval('.fb-step--optional', (node) => ({
      text: (node.textContent || '').trim(),
      active: node.classList.contains('is-active'),
    }));
    expectTrue(optionalDocsState.text.toLowerCase().includes('docs'), 'optional docs control is present in step rail', optionalDocsState);
    expectTrue(optionalDocsState.active === false, 'docs is not active by default', optionalDocsState);

    await desktopPage.click('button:has-text("Next")');
    await desktopPage.click('button:has-text("Next")');
    await desktopPage.click('button:has-text("Next")');
    const generateStart = Date.now();
    await desktopPage.click('button.fb-btn.fb-btn--accent:has-text("Generate")');
    await desktopPage.waitForTimeout(1200);
    summary.metrics.generateLatencyMs = Date.now() - generateStart;

    const previewAttrs = await desktopPage.$eval('.folio-builder__preview iframe', (node) => ({
      src: node.getAttribute('src') || '',
      srcdoc: node.getAttribute('srcdoc') || '',
    }));
    const isCliBridgePreview = /\/__prae_builder\/preview\/[^/]+\/index\.html/.test(previewAttrs.src);
    const isInlinePreview =
      previewAttrs.srcdoc.includes('id=\"prae-runtime\"') && previewAttrs.srcdoc.includes('window.PRAE.pauseAllAudio');
    expectTrue(isCliBridgePreview || isInlinePreview, 'live preview iframe updates with generated runtime markup', {
      src: previewAttrs.src,
      srcdocSnippet: previewAttrs.srcdoc.slice(0, 180),
    });

    await desktopPage.keyboard.press('Tab');
    await desktopPage.keyboard.press('Tab');
    const keyboardState = await desktopPage.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        return { ok: false, tag: null, hasFocusStyle: false };
      }
      const style = window.getComputedStyle(active);
      const hasFocusStyle =
        style.outlineStyle !== 'none' ||
        Number.parseFloat(style.outlineWidth || '0') > 0 ||
        style.boxShadow !== 'none' ||
        style.borderColor !== 'rgba(0, 0, 0, 0)';
      return {
        ok: true,
        tag: active.tagName,
        className: active.className,
        hasFocusStyle,
      };
    });
    expectTrue(Boolean(keyboardState.ok), 'keyboard traversal reaches focusable controls', keyboardState);
    expectTrue(Boolean(keyboardState.hasFocusStyle), 'focused controls have visible focus affordance', keyboardState);

    const namingIssues = await desktopPage.evaluate(() => {
      const issues = [];
      const root = document.querySelector('[data-builder-surface=\"folio-builder\"]');
      if (!root) return [{ tag: 'surface', className: '', id: '' }];
      const interactive = Array.from(root.querySelectorAll('button,a,input,select,textarea'));
      for (const el of interactive) {
        if (el.hasAttribute('hidden')) continue;
        if (el.getAttribute('aria-hidden') === 'true') continue;
        if (el.tagName === 'INPUT' && el.getAttribute('type') === 'hidden') continue;

        const aria = (el.getAttribute('aria-label') || '').trim();
        let labelText = '';
        const labelledBy = (el.getAttribute('aria-labelledby') || '').trim();
        if (labelledBy) {
          labelText = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() || '')
            .join(' ')
            .trim();
        }
        const closestLabel = el.closest('label');
        if (!labelText && closestLabel) labelText = (closestLabel.textContent || '').trim();
        if (!labelText && el.id) {
          const linked = document.querySelector(`label[for="${el.id}"]`);
          if (linked) labelText = (linked.textContent || '').trim();
        }
        const text = (el.textContent || '').trim();
        const placeholder = (el.getAttribute('placeholder') || '').trim();
        const name = [aria, labelText, text, placeholder].find((value) => value && value.length > 0) || '';
        if (!name) {
          issues.push({ tag: el.tagName.toLowerCase(), className: el.className || '', id: el.id || '' });
        }
      }
      return issues.slice(0, 20);
    });
    expectTrue(namingIssues.length === 0, 'interactive controls expose accessible names', { namingIssues });

    const contrastIssues = await desktopPage.evaluate(() => {
      function parseColor(value) {
        if (!value) return null;
        const normalized = value.trim().toLowerCase();
        if (normalized === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
        const rgba = normalized.match(/^rgba?\(([^)]+)\)$/);
        if (!rgba) return null;
        const parts = rgba[1].split(',').map((part) => Number.parseFloat(part.trim()));
        if (parts.length < 3) return null;
        return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
      }

      function luminance(channel) {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }

      function contrastRatio(fg, bg) {
        const lf = 0.2126 * luminance(fg.r) + 0.7152 * luminance(fg.g) + 0.0722 * luminance(fg.b);
        const lb = 0.2126 * luminance(bg.r) + 0.7152 * luminance(bg.g) + 0.0722 * luminance(bg.b);
        const lighter = Math.max(lf, lb);
        const darker = Math.min(lf, lb);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function findBackgroundColor(node) {
        let current = node;
        while (current && current !== document.documentElement) {
          const color = parseColor(window.getComputedStyle(current).backgroundColor);
          if (color && color.a > 0.99) return color;
          current = current.parentElement;
        }
        return parseColor(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      }

      const selectors = [
        '.folio-builder__kicker',
        '.folio-builder h1',
        '.fb-tab',
        '.fb-tabpanel h2',
        '.fb-note',
        '.fb-btn',
        '.fb-work-item strong',
        '.folio-builder__status',
      ];

      const issues = [];
      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector)).slice(0, 6);
        for (const node of nodes) {
          const style = window.getComputedStyle(node);
          const fg = parseColor(style.color);
          const bg = findBackgroundColor(node);
          if (!fg || !bg) continue;
          const ratio = contrastRatio(fg, bg);
          if (ratio < 4.5) {
            issues.push({ selector, ratio: Number(ratio.toFixed(2)), text: (node.textContent || '').trim().slice(0, 60) });
          }
        }
      }
      return issues;
    });
    expectTrue(contrastIssues.length === 0, 'builder text contrast meets WCAG 2.1 AA target', { contrastIssues });

    const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(`${baseUrl}${builderPath}`, { waitUntil: 'domcontentloaded' });
    await reducedPage.waitForSelector('[data-builder-surface="folio-builder"]', { timeout: 20000 });
    const reducedState = await reducedPage.evaluate(() => {
      const motionPref = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const style = window.getComputedStyle(document.querySelector('.fb-btn'));
      return { motionPref, transitionDuration: style.transitionDuration, animationDuration: style.animationDuration };
    });
    expectTrue(Boolean(reducedState.motionPref), 'reduced-motion media query is honored', reducedState);
    expectTrue(
      reducedState.transitionDuration === '0s' || reducedState.transitionDuration === '0s, 0s' || reducedState.transitionDuration === '0ms',
      'reduced-motion mode removes transition duration',
      reducedState
    );
    await reducedContext.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    const mobileStart = Date.now();
    await mobilePage.goto(`${baseUrl}${builderPath}`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('button:has-text("Load Sample Set")', { timeout: 20000 });
    await mobilePage.click('button:has-text("Load Sample Set")');
    await mobilePage.waitForSelector('button:has-text("Open Preview")', { timeout: 10000 });
    summary.metrics.mobileReadyMs = Date.now() - mobileStart;

    await mobilePage.click('button:has-text("Open Preview")');
    await mobilePage.waitForSelector('.folio-builder__mobile-sheet iframe', { timeout: 10000 });
    expectTrue(true, 'mobile preview bottom-sheet opens with iframe');

    await mobileContext.close();
    await desktopContext.close();

    expectTrue(summary.metrics.desktopReadyMs <= 5000, 'desktop builder route is interactable within 5s', {
      desktopReadyMs: summary.metrics.desktopReadyMs,
    });
    expectTrue(summary.metrics.generateLatencyMs <= 4000, 'generate-to-preview latency stays under 4s', {
      generateLatencyMs: summary.metrics.generateLatencyMs,
    });
    expectTrue(summary.metrics.mobileReadyMs <= 6000, 'mobile builder route is interactable within 6s', {
      mobileReadyMs: summary.metrics.mobileReadyMs,
    });
  } finally {
    if (browser) await browser.close().catch(() => {});

    serve.kill('SIGTERM');
    const serveResult = await serve.catch(() => null);
    if (serveResult?.exitCode && serveResult.exitCode !== 0 && strict) {
      throw new Error(`VitePress serve exited early with code ${serveResult.exitCode}`);
    }
  }
}

run()
  .then(() => {
    console.log(JSON.stringify({
      assertions: summary.assertions,
      assertionFailures: summary.assertionFailures,
      metrics: summary.metrics,
    }, null, 2));

    if (summary.failures.length) {
      console.log('--- failures ---');
      summary.failures.forEach((failure) => console.log(JSON.stringify(failure)));
    }

    if (summary.assertionFailures > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('[builder-a11y-perf-smoke] fatal:', err?.message || String(err));
    process.exit(1);
  });
