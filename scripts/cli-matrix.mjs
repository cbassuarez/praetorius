#!/usr/bin/env node
import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(repoRoot, 'src/cli/index.js');
const nodeBin = process.execPath;

const summary = {
  commandPasses: 0,
  commandFailures: 0,
  assertions: 0,
  assertionFailures: 0,
  failures: []
};

const APPEARANCE_PALETTES = [
  'ryb-tricolor',
  'mono-bw',
  'mono-one',
  'gem-diamond',
  'orange-blue-white-silver'
];

const CURSOR_PRESETS = ['system', 'block-square', 'ring', 'prism-diamond'];
const EFFECT_PRESETS = ['minimal', 'balanced-neo', 'high-drama'];

function clean(text) {
  return String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');
}

function markFailure(type, label, detail) {
  summary.failures.push({ type, label, detail });
}

function expectTrue(condition, label, detail) {
  summary.assertions += 1;
  if (!condition) {
    summary.assertionFailures += 1;
    markFailure('assertion', label, detail);
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function runCli(label, cwd, args, { expectedExit = 0, env = {}, timeout = null } = {}) {
  const result = await execa(nodeBin, [cliPath, ...args], {
    cwd,
    reject: false,
    timeout: timeout ?? undefined,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      ...env
    }
  });

  const stdout = clean(result.stdout);
  const stderr = clean(result.stderr);
  const output = `${stdout}\n${stderr}`.trim();
  if (result.exitCode === expectedExit) {
    summary.commandPasses += 1;
  } else {
    summary.commandFailures += 1;
    markFailure('command', label, {
      args,
      expectedExit,
      actualExit: result.exitCode,
      output: output.slice(0, 1200)
    });
  }

  return { ...result, stdout, stderr, output };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function setupWorkspace(prefix = 'prae-cli-matrix-') {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });

  const baseDb = {
    version: 1,
    works: [
      {
        id: 1,
        slug: 'matrix-aurora',
        title: 'Matrix Aurora',
        oneliner: 'Matrix baseline item for runtime and appearance checks.',
        description: 'Used by CLI matrix checks for output assertions.',
        audio: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Gymnopedie_No._1..ogg',
        pdf: 'https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1-a4.pdf',
        cover: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Erik_Satie_by_Santiago_Rusi%C3%B1ol.jpg',
        tags: ['matrix', 'demo', 'primary'],
        cues: [{ label: '@0:00', t: 0 }]
      },
      {
        id: 2,
        slug: 'matrix-drift',
        title: 'Matrix Drift',
        oneliner: 'Secondary item without cover for fallback/render checks.',
        description: 'Intentionally has no cover so layouts exercise mixed-card behavior.',
        audio: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/U.S._Army_Band_-_Lo_How_a_Rose.ogg',
        pdf: 'https://www.mutopiaproject.org/ftp/Anonymous/es_ist_ein_ros/es_ist_ein_ros-a4.pdf',
        tags: ['matrix', 'secondary'],
        cues: [{ label: '@0:00', t: 0 }]
      }
    ]
  };
  await writeJson(path.join(cwd, '.prae', 'works.json'), baseDb);

  const baseConfig = {
    theme: 'dark',
    ui: {
      skin: 'cards-tabs',
      appearance: {
        theme: { palette: 'orange-blue-white-silver', monoBaseOklch: 'oklch(0.62 0.09 250)' },
        cursor: { preset: 'system' },
        effects: { hover: 'balanced-neo', button: 'balanced-neo' }
      }
    }
  };
  await writeJson(path.join(cwd, '.prae', 'config.json'), baseConfig);
  await writeJson(path.join(cwd, '.prae', 'docs.json'), {
    sources: { globs: ['docs/**/*.md'], includeReadme: false },
    search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
    paths: { root: 'docs/', homepage: 'docs/index.md' }
  });
  await fs.mkdir(path.join(cwd, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(cwd, 'docs', 'index.md'),
    '# Matrix Docs\\n\\nCLI matrix docs fixture for docs-reader runtime checks.\\n',
    'utf8'
  );

  await fs.mkdir(path.join(cwd, 'custom-ui'), { recursive: true });
  await fs.writeFile(
    path.join(cwd, 'custom-ui', 'template.html'),
    `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Custom Matrix UI</title></head>
  <body>
    <main id="matrix-custom-root" data-marker="custom-ui">Custom UI Root</main>
    <script src="./app.js"></script>
  </body>
</html>
`,
    'utf8'
  );
  await fs.writeFile(
    path.join(cwd, 'custom-ui', 'main.js'),
    `window.__PRAE_CUSTOM_UI__ = 'matrix';\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(cwd, 'custom-ui', 'style.css'),
    `#matrix-custom-root { border: 1px solid currentColor; }\n`,
    'utf8'
  );

  return cwd;
}

async function assertGenerated(cwd, outDir, checks = {}) {
  const out = path.join(cwd, outDir);
  const indexPath = path.join(out, checks.indexName || 'index.html');
  const scriptPath = path.join(out, checks.scriptName || 'script.js');
  const cssPath = path.join(out, checks.cssName || 'styles.css');
  const appJsPath = path.join(out, checks.appJsName || 'app.js');
  const appCssPath = path.join(out, checks.appCssName || 'app.css');

  if (checks.expectIndex !== undefined) {
    expectTrue(await pathExists(indexPath) === checks.expectIndex, `exists:${outDir}/index.html`, { expected: checks.expectIndex });
  }
  if (checks.expectScript !== undefined) {
    expectTrue(await pathExists(scriptPath) === checks.expectScript, `exists:${outDir}/${path.basename(scriptPath)}`, { expected: checks.expectScript });
  }
  if (checks.expectCss !== undefined) {
    expectTrue(await pathExists(cssPath) === checks.expectCss, `exists:${outDir}/${path.basename(cssPath)}`, { expected: checks.expectCss });
  }
  if (checks.expectAppJs !== undefined) {
    expectTrue(await pathExists(appJsPath) === checks.expectAppJs, `exists:${outDir}/${path.basename(appJsPath)}`, { expected: checks.expectAppJs });
  }
  if (checks.expectAppCss !== undefined) {
    expectTrue(await pathExists(appCssPath) === checks.expectAppCss, `exists:${outDir}/${path.basename(appCssPath)}`, { expected: checks.expectAppCss });
  }

  const index = await readFileSafe(indexPath);
  const appJs = await readFileSafe(appJsPath);
  const script = await readFileSafe(scriptPath);
  const combined = `${index}\n${script}\n${appJs}`;

  if (index && checks.expectIndex !== false) {
    expectTrue(index.includes('data-brand-system="praetorius-v1"'), 'index includes brand system marker', { outDir });
    expectTrue(
      index.includes('data-brand-attribution="on"') || index.includes('data-brand-attribution="off"'),
      'index includes brand attribution marker',
      { outDir }
    );
  }
  expectTrue(!combined.includes('img.shields.io'), 'emitted assets exclude shields URLs', { outDir });

  if (checks.indexIncludes) {
    for (const token of checks.indexIncludes) {
      expectTrue(index.includes(token), `index includes: ${token}`, { outDir });
    }
  }
  if (checks.scriptIncludes) {
    for (const token of checks.scriptIncludes) {
      expectTrue(script.includes(token), `script includes: ${token}`, { outDir });
    }
  }
  if (checks.appJsIncludes) {
    for (const token of checks.appJsIncludes) {
      expectTrue(appJs.includes(token), `app.js includes: ${token}`, { outDir });
    }
  }
}

async function runWatchProbe(cwd) {
  const child = execa(nodeBin, [cliPath, 'generate', '--skin', 'cards-tabs', '--watch', '--out', 'dist-watch'], {
    cwd,
    reject: false,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  await new Promise((resolve) => setTimeout(resolve, 2300));
  child.kill('SIGTERM');
  const result = await child;
  const output = clean(`${result.stdout}\n${result.stderr}`);

  const missingChokidar = output.includes('Missing dependency "chokidar"');
  expectTrue(!missingChokidar, '--watch loads chokidar dependency', { output: output.slice(0, 600) });
}

async function runMatrix() {
  const cleanupDirs = new Set();
  const cwd = await setupWorkspace();
  cleanupDirs.add(cwd);
  try {
    await runCli('help', cwd, ['--help']);

    const validate = await runCli('validate', cwd, ['validate']);
    expectTrue(validate.output.includes('Schema OK'), 'validate schema ok', { output: validate.output.slice(0, 300) });

    const doctor = await runCli('doctor', cwd, ['doctor', '--json']);
    expectTrue(doctor.output.includes('"overall"') || doctor.output.includes('"ok"'), 'doctor returns JSON-ish output', {});

    const exported = await runCli('export csv', cwd, ['export', '--format', 'csv']);
    expectTrue(exported.stdout.includes('cover'), 'export includes cover column', {});
    expectTrue(exported.stdout.includes('tags_csv'), 'export includes tags_csv column', {});
    const csvPath = path.join(cwd, 'matrix-export.csv');
    await fs.writeFile(csvPath, `${exported.stdout}\n`, 'utf8');

    const importCwd = await setupWorkspace('prae-cli-matrix-import-');
    cleanupDirs.add(importCwd);
    await writeJson(path.join(importCwd, '.prae', 'works.json'), { version: 1, works: [] });
    await runCli('import csv', importCwd, ['import', csvPath, '--assume-new-id', '--assume-new-slug']);
    const imported = JSON.parse(await fs.readFile(path.join(importCwd, '.prae', 'works.json'), 'utf8'));
    expectTrue(imported.works.length >= 1, 'import created works', { count: imported.works.length });

    await runCli('generate default', cwd, ['generate', '--out', 'dist-default']);
    await assertGenerated(cwd, 'dist-default', {
      expectIndex: true,
      expectScript: true,
      expectCss: true,
      expectAppJs: true,
      expectAppCss: true,
      indexIncludes: ['data-skin="cards-tabs"', 'data-ui-runtime="vanilla"']
    });

    const skinRuntimeCases = [
      ['vite-breeze', 'vanilla'],
      ['vite-breeze', 'react'],
      ['cards-tabs', 'vanilla'],
      ['cards-tabs', 'react'],
      ['kiosk', 'vanilla'],
      ['kiosk', 'react'],
      ['docs-reader', 'vanilla'],
      ['docs-reader', 'react']
    ];
    for (const [skin, runtime] of skinRuntimeCases) {
      const outDir = `dist-${skin}-${runtime}`;
      const result = await runCli(`generate ${skin} ${runtime}`, cwd, ['generate', '--skin', skin, '--ui-runtime', runtime, '--out', outDir]);
      expectTrue(result.exitCode === 0, `${skin}/${runtime} exits clean`, {});
      await assertGenerated(cwd, outDir, {
        expectIndex: true,
        expectScript: true,
        expectCss: true,
        expectAppJs: true,
        expectAppCss: true,
        ...(skin === 'docs-reader' ? { appCssName: 'style.css' } : {}),
        indexIncludes: [`data-skin="${skin}"`, `data-ui-runtime="${runtime}"`, 'data-palette="orange-blue-white-silver"'],
        scriptIncludes: ['window.PRAE.pauseAllAudio = function(exceptId)']
      });
      if (runtime === 'react') {
        await assertGenerated(cwd, outDir, {
          appJsIncludes: ['createRoot']
        });
      }
    }

    const unsupportedReact = await runCli('react fallback unsupported skin', cwd, ['generate', '--skin', 'typefolio', '--ui-runtime', 'react', '--out', 'dist-typefolio-react']);
    expectTrue(unsupportedReact.output.includes('Falling back to vanilla'), 'unsupported skin warns and falls back', {});
    await assertGenerated(cwd, 'dist-typefolio-react', {
      indexIncludes: ['data-skin="typefolio"', 'data-ui-runtime="vanilla"']
    });

    const embedCases = ['vite-breeze', 'cards-tabs', 'kiosk', 'docs-reader'];
    for (const skin of embedCases) {
      const outDir = `dist-${skin}-embed-react`;
      const embed = await runCli(`embed fallback ${skin}`, cwd, ['generate', '--skin', skin, '--ui-runtime', 'react', '--embed', '--out', outDir]);
      expectTrue(embed.output.includes(`using vanilla ${skin} fallback`), `${skin} embed prints fallback note`, {});
      const embedHtml = await readFileSafe(path.join(cwd, outDir, 'embed.html'));
      expectTrue(embedHtml.includes('vanilla fallback for CMS'), `${skin} embed markup is vanilla fallback`, {});
    }

    await runCli('generate no-ui', cwd, ['generate', '--skin', 'kiosk', '--no-ui', '--out', 'dist-no-ui']);
    await assertGenerated(cwd, 'dist-no-ui', {
      expectIndex: false,
      expectScript: true,
      expectCss: true,
      expectAppJs: false,
      expectAppCss: false
    });

    await runCli('generate no-css', cwd, ['generate', '--skin', 'kiosk', '--no-css', '--out', 'dist-no-css']);
    await assertGenerated(cwd, 'dist-no-css', {
      expectScript: true,
      expectCss: false
    });

    await runCli('generate custom js/css', cwd, ['generate', '--skin', 'cards-tabs', '--js', 'bundle.js', '--css', 'bundle.css', '--out', 'dist-custom-names']);
    await assertGenerated(cwd, 'dist-custom-names', {
      scriptName: 'bundle.js',
      cssName: 'bundle.css',
      expectScript: true,
      expectCss: true
    });

    await runCli('generate custom app js/css', cwd, ['generate', '--skin', 'cards-tabs', '--app-js', 'shell.js', '--app-css', 'shell.css', '--out', 'dist-custom-app']);
    await assertGenerated(cwd, 'dist-custom-app', {
      appJsName: 'shell.js',
      appCssName: 'shell.css',
      expectAppJs: true,
      expectAppCss: true
    });

    await runCli('generate custom ui-src', cwd, ['generate', '--skin', 'made-up-skin', '--ui-src', 'custom-ui', '--out', 'dist-custom-ui']);
    await assertGenerated(cwd, 'dist-custom-ui', {
      indexIncludes: ['data-marker="custom-ui"', 'Custom UI Root']
    });
    const customApp = await readFileSafe(path.join(cwd, 'dist-custom-ui', 'app.js'));
    expectTrue(customApp.includes('__PRAE_CUSTOM_UI__'), 'custom ui-src app.js copied', {});

    await runCli('generate minify', cwd, ['generate', '--skin', 'kiosk', '--minify', '--out', 'dist-minify']);
    const minifiedScript = await readFileSafe(path.join(cwd, 'dist-minify', 'script.js'));
    expectTrue(minifiedScript.length > 0, 'minified script emitted', {});

    for (const palette of APPEARANCE_PALETTES) {
      const outDir = `dist-palette-${palette}`;
      const args = ['generate', '--skin', 'cards-tabs', '--palette', palette, '--out', outDir];
      if (palette === 'mono-one') {
        args.splice(args.length - 2, 0, '--mono-color', '#336699');
      }
      await runCli(`palette ${palette}`, cwd, args);
      await assertGenerated(cwd, outDir, {
        indexIncludes: [`data-palette="${palette}"`]
      });
      if (palette === 'mono-one') {
        const script = await readFileSafe(path.join(cwd, outDir, 'script.js'));
        expectTrue(script.includes('"monoBaseOklch":"oklch(') || script.includes('"monoBaseOklch": "oklch('), 'mono-one stores normalized OKLCH', {});
      }
    }

    for (const cursor of CURSOR_PRESETS) {
      const outDir = `dist-cursor-${cursor}`;
      await runCli(`cursor ${cursor}`, cwd, ['generate', '--skin', 'kiosk', '--cursor', cursor, '--out', outDir]);
      await assertGenerated(cwd, outDir, {
        indexIncludes: [`data-cursor="${cursor}"`]
      });
    }

    for (const hover of EFFECT_PRESETS) {
      const outDir = `dist-hover-${hover}`;
      await runCli(`hover ${hover}`, cwd, ['generate', '--skin', 'kiosk', '--hover-effect', hover, '--out', outDir]);
      await assertGenerated(cwd, outDir, {
        indexIncludes: [`data-hover-effect="${hover}"`]
      });
    }

    for (const button of EFFECT_PRESETS) {
      const outDir = `dist-button-${button}`;
      await runCli(`button ${button}`, cwd, ['generate', '--skin', 'kiosk', '--button-effect', button, '--out', outDir]);
      await assertGenerated(cwd, outDir, {
        indexIncludes: [`data-button-effect="${button}"`]
      });
    }

    await runCli('invalid palette', cwd, ['generate', '--skin', 'kiosk', '--palette', 'not-a-palette'], { expectedExit: 1 });
    await runCli('invalid cursor', cwd, ['generate', '--skin', 'kiosk', '--cursor', 'laser-beam'], { expectedExit: 1 });
    await runCli('invalid hover', cwd, ['generate', '--skin', 'kiosk', '--hover-effect', 'chaos'], { expectedExit: 1 });
    await runCli('invalid button', cwd, ['generate', '--skin', 'kiosk', '--button-effect', 'chaos'], { expectedExit: 1 });
    await runCli('invalid mono color', cwd, ['generate', '--skin', 'kiosk', '--palette', 'mono-one', '--mono-color', 'not-a-color'], { expectedExit: 1 });

    await writeJson(path.join(cwd, '.prae', 'config.json'), {
      theme: 'dark',
      ui: {
        skin: 'cards-tabs',
        appearance: {
          theme: { palette: 'orange-blue-white-silver', monoBaseOklch: 'oklch(0.62 0.09 250)' },
          cursor: { preset: 'system' },
          effects: { hover: 'balanced-neo', button: 'balanced-neo' }
        },
        branding: {
          attribution: { enabled: false }
        }
      }
    });
    await runCli('branding attribution off', cwd, ['generate', '--skin', 'cards-tabs', '--out', 'dist-branding-off']);
    await assertGenerated(cwd, 'dist-branding-off', {
      indexIncludes: ['data-brand-attribution="off"']
    });

    const seedCwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-cli-matrix-seed-'));
    cleanupDirs.add(seedCwd);
    const seeded = await runCli('seed always', seedCwd, ['generate', '--skin', 'kiosk', '--seed', 'always', '--out', 'dist-seed']);
    expectTrue(seeded.exitCode === 0, '--seed always succeeds', {});
    const seededDb = JSON.parse(await fs.readFile(path.join(seedCwd, '.prae', 'works.json'), 'utf8'));
    const overLimit = (seededDb.works || []).filter((w) => String(w?.oneliner || '').length > 240);
    expectTrue(overLimit.length === 0, 'seeded oneliners stay within schema max length', { overLimit: overLimit.map((w) => w.slug) });

    const fallbackCwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-cli-matrix-fallback-'));
    cleanupDirs.add(fallbackCwd);
    await fs.mkdir(path.join(fallbackCwd, '.prae'), { recursive: true });
    await writeJson(path.join(fallbackCwd, '.prae', 'works.json'), {
      version: 1,
      works: [{ id: 1, slug: 'broken', title: 'Broken', oneliner: 'x'.repeat(600), cues: [] }]
    });
    const fallback = await runCli('allow fallback', fallbackCwd, ['generate', '--skin', 'cards-tabs', '--allow-fallback', '--out', 'dist-fallback']);
    expectTrue(fallback.output.includes('using starter seed (validation failed)'), 'allow-fallback banner printed', {});
    await assertGenerated(fallbackCwd, 'dist-fallback', {
      expectIndex: true,
      expectAppJs: true,
      expectAppCss: true
    });

    await runWatchProbe(cwd);

  } catch (err) {
    markFailure('runtime', 'cli-matrix crashed', { message: err?.message || String(err) });
  } finally {
    if (process.env.PRAE_KEEP_TMP === '1') {
      for (const dir of cleanupDirs) {
        console.log(`[cli-matrix] keeping temp dir: ${dir}`);
      }
    } else {
      for (const dir of cleanupDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {}
      }
    }
  }
}

async function main() {
  await runMatrix();
  const payload = {
    commandPasses: summary.commandPasses,
    commandFailures: summary.commandFailures,
    assertions: summary.assertions,
    assertionFailures: summary.assertionFailures
  };
  console.log(JSON.stringify(payload, null, 2));
  if (summary.failures.length) {
    console.log('--- failures ---');
    for (const failure of summary.failures) {
      console.log(JSON.stringify(failure));
    }
  }
  if (summary.commandFailures > 0 || summary.assertionFailures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[cli-matrix] fatal:', err?.message || String(err));
  process.exit(1);
});
