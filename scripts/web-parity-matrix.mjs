#!/usr/bin/env node
import { execa } from 'execa';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'src/cli/index.js');
const nodeBin = process.execPath;
const strict = process.env.PRAE_STRICT_WEB_PARITY === '1';
const reactSupportedSkins = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);
const embedVanillaOnlySkins = new Set(['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader']);

const summary = {
  commandPasses: 0,
  commandFailures: 0,
  assertions: 0,
  assertionFailures: 0,
  failures: [],
};

function clean(text) {
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

function expectTrue(condition, label, detail = {}) {
  summary.assertions += 1;
  if (!condition) {
    summary.assertionFailures += 1;
    summary.failures.push({ type: 'assertion', label, detail });
  }
}

async function runCli(cwd, args, expectedExit = 0) {
  const result = await execa(nodeBin, [cliPath, ...args], {
    cwd,
    reject: false,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const output = clean(`${result.stdout}\n${result.stderr}`).trim();
  if (result.exitCode === expectedExit) {
    summary.commandPasses += 1;
  } else {
    summary.commandFailures += 1;
    summary.failures.push({
      type: 'command',
      label: args.join(' '),
      detail: { expectedExit, actualExit: result.exitCode, output: output.slice(0, 1400) },
    });
  }

  return {
    ...result,
    output,
  };
}

function parseRuntimeFromIndex(indexHtml) {
  const skin = String(indexHtml || '').match(/data-skin="([^"]+)"/)?.[1] || '';
  const runtime = String(indexHtml || '').match(/data-ui-runtime="([^"]+)"/)?.[1] || '';
  const palette = String(indexHtml || '').match(/data-palette="([^"]+)"/)?.[1] || '';
  const theme = String(indexHtml || '').match(/data-theme="([^"]+)"/)?.[1] || '';
  return { skin, runtime, palette, theme };
}

function expectedRuntimeForCase(testCase) {
  let runtime = testCase.runtime === 'react' && reactSupportedSkins.has(testCase.skin) ? 'react' : 'vanilla';
  if (testCase.embed && runtime === 'react' && embedVanillaOnlySkins.has(testCase.skin)) {
    runtime = 'vanilla';
  }
  return runtime;
}

function createStaticServer(root) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
  };

  const harnessHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Folio Parity Harness</title></head>
<body>
  <script type="module">
    import { createDefaultProjectState, hydrateProjectState, runFolioCommand } from '/src/web/folio-runtime.js';
    let state = createDefaultProjectState();
    window.__folioParityReady = true;
    window.__folioHarness = {
      reset() {
        state = createDefaultProjectState();
        return true;
      },
      hydrate(next) {
        state = hydrateProjectState(next || {});
        return state;
      },
      run(argv) {
        const result = runFolioCommand(state, argv);
        state = result.state;
        return result;
      },
      getState() {
        return state;
      },
    };
  </script>
</body>
</html>`;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname || '/');

      if (pathname === '/__folio_parity_harness__') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(harnessHtml);
        return;
      }

      const relative = pathname.replace(/^\/+/, '');
      const candidate = path.resolve(root, relative || 'index.html');
      if (!candidate.startsWith(root)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }

      const stat = await fs.stat(candidate);
      if (!stat.isFile()) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const ext = path.extname(candidate).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      res.end(await fs.readFile(candidate));
    } catch (_err) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  return server;
}

function startServer(server, host = '127.0.0.1', port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve static server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function normalizeCaseName(testCase) {
  return [
    testCase.skin,
    testCase.runtime,
    testCase.embed ? 'embed' : null,
    testCase.noUi ? 'no-ui' : null,
    testCase.noCss ? 'no-css' : null,
    testCase.palette,
  ]
    .filter(Boolean)
    .join('-');
}

function buildGenerateArgv(testCase, outDir = null) {
  const argv = ['generate', '--skin', testCase.skin, '--ui-runtime', testCase.runtime];
  if (testCase.palette) argv.push('--palette', testCase.palette);
  if (testCase.cursor) argv.push('--cursor', testCase.cursor);
  if (testCase.hoverEffect) argv.push('--hover-effect', testCase.hoverEffect);
  if (testCase.buttonEffect) argv.push('--button-effect', testCase.buttonEffect);
  if (testCase.monoColor) argv.push('--mono-color', testCase.monoColor);
  if (testCase.embed) argv.push('--embed');
  if (testCase.noUi) argv.push('--no-ui');
  if (testCase.noCss) argv.push('--no-css');
  if (outDir) argv.push('--out', outDir);
  return argv;
}

function readEmitFile(artifacts, name) {
  if (!artifacts?.files) return '';
  if (name === 'index.html') return String(artifacts.files.index || '');
  if (name === 'embed.html') return String(artifacts.files.embed || '');
  const fileName = artifacts.options?.[name === 'script.js' ? 'js' : name === 'styles.css' ? 'css' : name === 'app.js' ? 'appJs' : name === 'app.css' ? 'appCss' : ''] || name;
  return String(artifacts.files[fileName] || '');
}

async function run() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (_err) {
    const message = 'Playwright is not installed. Run `npm i -D playwright` and install Chromium.';
    if (strict) throw new Error(message);
    console.log(`[web-parity-matrix] skip: ${message}`);
    return;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-web-parity-'));
  const server = createStaticServer(repoRoot);

  let browser = null;
  let context = null;

  try {
    await runCli(tmpDir, ['init']);
    let port = 0;
    try {
      port = await startServer(server);
    } catch (err) {
      if (strict) throw err;
      console.log(`[web-parity-matrix] skip: unable to bind local server (${err?.message || String(err)})`);
      return;
    }
    const harnessUrl = `http://127.0.0.1:${port}/__folio_parity_harness__`;

    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (err) {
      if (strict) {
        throw new Error(`Playwright Chromium launch failed: ${err?.message || String(err)}`);
      }
      console.log(`[web-parity-matrix] skip: unable to launch chromium (${err?.message || String(err)})`);
      return;
    }

    context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__folioParityReady === true);

    const cases = [
      { skin: 'cards-tabs', runtime: 'vanilla' },
      { skin: 'cards-tabs', runtime: 'react' },
      { skin: 'kiosk', runtime: 'react' },
      { skin: 'docs-reader', runtime: 'react', embed: true },
      { skin: 'vite-breeze', runtime: 'react', embed: true },
      { skin: 'typefolio', runtime: 'react' },
      { skin: 'kiosk', runtime: 'vanilla', noUi: true },
      { skin: 'kiosk', runtime: 'vanilla', noCss: true },
      {
        skin: 'cards-tabs',
        runtime: 'vanilla',
        palette: 'mono-one',
        monoColor: '#336699',
        cursor: 'block-square',
        hoverEffect: 'high-drama',
        buttonEffect: 'minimal',
      },
    ];

    for (const testCase of cases) {
      const caseName = normalizeCaseName(testCase);
      const outDir = `dist-web-parity-${caseName}`;

      const cliArgs = buildGenerateArgv(testCase, outDir);
      const cliResult = await runCli(tmpDir, cliArgs);
      expectTrue(cliResult.exitCode === 0, `cli exits clean (${caseName})`, { output: cliResult.output.slice(0, 400) });

      const browserResult = await page.evaluate((argv) => {
        return window.__folioHarness.run(argv);
      }, buildGenerateArgv(testCase));

      expectTrue(!!browserResult && typeof browserResult === 'object', `browser returns payload (${caseName})`);
      expectTrue(browserResult.ok === true, `browser command ok (${caseName})`, { output: browserResult.output });

      const cliIndex = await readIfExists(path.join(tmpDir, outDir, 'index.html'));
      const cliScript = await readIfExists(path.join(tmpDir, outDir, testCase.noUi ? 'script.js' : (browserResult?.artifacts?.options?.js || 'script.js')));
      const cliCss = await readIfExists(path.join(tmpDir, outDir, browserResult?.artifacts?.options?.css || 'styles.css'));
      const cliAppJs = await readIfExists(path.join(tmpDir, outDir, browserResult?.artifacts?.options?.appJs || 'app.js'));
      const cliAppCss = await readIfExists(path.join(tmpDir, outDir, browserResult?.artifacts?.options?.appCss || 'app.css'));
      const cliEmbed = await readIfExists(path.join(tmpDir, outDir, 'embed.html'));

      const webArtifacts = browserResult?.artifacts;
      const webIndex = readEmitFile(webArtifacts, 'index.html');
      const webScript = readEmitFile(webArtifacts, 'script.js');
      const webCss = readEmitFile(webArtifacts, 'styles.css');
      const webAppJs = readEmitFile(webArtifacts, 'app.js');
      const webAppCss = readEmitFile(webArtifacts, 'app.css');
      const webEmbed = readEmitFile(webArtifacts, 'embed.html');

      const cliOptions = {
        skin: parseRuntimeFromIndex(cliIndex).skin || testCase.skin,
        runtime: parseRuntimeFromIndex(cliIndex).runtime || expectedRuntimeForCase(testCase),
      };
      const webIndexMeta = parseRuntimeFromIndex(webIndex);

      expectTrue(webArtifacts?.options?.skin === testCase.skin, `browser skin preserved (${caseName})`, { options: webArtifacts?.options });
      expectTrue(webArtifacts?.options?.uiRuntime === cliOptions.runtime, `runtime resolution parity (${caseName})`, {
        cli: cliOptions.runtime,
        web: webArtifacts?.options?.uiRuntime,
      });

      expectTrue(Boolean(cliIndex) === Boolean(webIndex), `index presence parity (${caseName})`, {});
      expectTrue(Boolean(cliScript) === Boolean(webScript), `script presence parity (${caseName})`, {});
      expectTrue(Boolean(cliCss) === Boolean(webCss), `css presence parity (${caseName})`, {});
      expectTrue(Boolean(cliAppJs) === Boolean(webAppJs), `app.js presence parity (${caseName})`, {});
      expectTrue(Boolean(cliAppCss) === Boolean(webAppCss), `app.css presence parity (${caseName})`, {});
      expectTrue(Boolean(cliEmbed) === Boolean(webEmbed), `embed presence parity (${caseName})`, {});

      if (webIndex) {
        expectTrue(webIndex.includes('data-brand-system="praetorius-v1"'), `brand marker in web index (${caseName})`);
        expectTrue(webIndex.includes('data-brand-attribution="on"') || webIndex.includes('data-brand-attribution="off"'), `brand attribution marker in web index (${caseName})`);
        expectTrue(!webIndex.includes('img.shields.io'), `no shields badge URLs in web index (${caseName})`);
      }
      if (webScript) {
        expectTrue(webScript.includes('window.PRAE.pauseAllAudio'), `singleton audio helper in script (${caseName})`);
      }

      if (cliIndex && webIndex) {
        const cliMeta = parseRuntimeFromIndex(cliIndex);
        expectTrue(cliMeta.skin === webIndexMeta.skin, `index skin marker parity (${caseName})`, { cliMeta, webIndexMeta });
        expectTrue(cliMeta.runtime === webIndexMeta.runtime, `index runtime marker parity (${caseName})`, { cliMeta, webIndexMeta });
        expectTrue(cliMeta.palette === webIndexMeta.palette, `index palette marker parity (${caseName})`, { cliMeta, webIndexMeta });
        expectTrue(cliMeta.theme === webIndexMeta.theme, `index theme marker parity (${caseName})`, { cliMeta, webIndexMeta });
      }

      if (testCase.embed && testCase.runtime === 'react' && ['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader'].includes(testCase.skin)) {
        expectTrue(webArtifacts?.options?.uiRuntime === 'vanilla', `embed fallback to vanilla (${caseName})`);
      }
      if (testCase.runtime === 'react' && ['console', 'typefolio', 'typescatter'].includes(testCase.skin)) {
        expectTrue(webArtifacts?.options?.uiRuntime === 'vanilla', `unsupported react skin fallback (${caseName})`);
      }
    }
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    if (process.env.PRAE_KEEP_TMP === '1') {
      console.log(`[web-parity-matrix] keeping temp dir: ${tmpDir}`);
    } else {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

run()
  .then(() => {
    const payload = {
      commandPasses: summary.commandPasses,
      commandFailures: summary.commandFailures,
      assertions: summary.assertions,
      assertionFailures: summary.assertionFailures,
    };
    console.log(JSON.stringify(payload, null, 2));
    if (summary.failures.length) {
      console.log('--- failures ---');
      summary.failures.forEach((failure) => console.log(JSON.stringify(failure)));
    }
    if (summary.commandFailures > 0 || summary.assertionFailures > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('[web-parity-matrix] fatal:', err?.message || String(err));
    process.exit(1);
  });
