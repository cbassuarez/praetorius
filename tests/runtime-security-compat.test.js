import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

function baseEnv() {
  return {
    FORCE_COLOR: '0',
    PRAE_DISABLE_UPDATE_CHECK: '1',
    PRAE_TEST: '1',
    PRAE_TEST_EXPORTS: '0',
  };
}

async function setupBaseWorkspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-runtime-security-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify({
    version: 1,
    works: [
      {
        id: 1,
        slug: 'malicious-work',
        title: '<img src=x onerror=alert(1)>Malicious',
        oneliner: 'Hello <svg onload=alert(2)> world',
        description: 'Body <script>alert(3)</script> [x](javascript:alert(4))',
        audio: 'javascript:alert(5)',
        pdf: 'javascript:alert(6)',
        cover: 'javascript:alert(7)',
        tags: ['<b>tag</b>', 'clean'],
        cues: [{ label: '@0:00', t: 0 }]
      }
    ]
  }, null, 2), 'utf8');
  return cwd;
}

async function setupDocsInputs(cwd) {
  await fs.mkdir(path.join(cwd, 'docs'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'docs', 'index.md'), [
    '# Intro',
    '',
    '<script>alert(1)</script>',
    '',
    '[bad](javascript:alert(2))',
    '',
    'Safe paragraph'
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(cwd, '.prae', 'docs.json'), JSON.stringify({
    site: { title: 'Docs Test', subtitle: '', description: '', accent: '' },
    sources: { globs: ['docs/**/*.md'], includeReadme: false },
    search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
    paths: { root: 'docs/', homepage: 'docs/index.md' }
  }, null, 2), 'utf8');
}

function parsePraeData(indexHtml) {
  const tagMatch = indexHtml.match(/<script id="prae-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (!tagMatch) return null;
  const body = String(tagMatch[1] || '').trim();
  const payload = body.replace(/^window\.__PRAE_DATA__\s*=\s*/i, '').replace(/;\s*$/, '');
  return JSON.parse(payload);
}

function parseDocsData(indexHtml) {
  const tagMatch = indexHtml.match(/<script id="prae-docs-data" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!tagMatch) return null;
  return JSON.parse(tagMatch[1]);
}

describe('runtime security hardening + compatibility', () => {
  it('sanitizes runtime payload values used by skins', async () => {
    const cwd = await setupBaseWorkspace();
    await execa('node', [CLI, 'generate', '--skin', 'cards-tabs', '--out', 'dist-security'], {
      cwd,
      env: baseEnv()
    });

    const index = await fs.readFile(path.join(cwd, 'dist-security', 'index.html'), 'utf8');
    const data = parsePraeData(index);
    expect(data).toBeTruthy();
    const work = data.works[0];
    expect(work.title.includes('<')).toBe(false);
    expect(work.onelinerEffective.includes('<')).toBe(false);
    expect(work.descriptionEffective.includes('<')).toBe(false);
    expect(work.audio).toBe('');
    expect(work.pdf).toBe('');
    expect(work.cover).toBe('');
    expect(work.tags).toEqual(['tag', 'clean']);
  });

  it('sanitizes docs markdown and module HTML before render', async () => {
    const cwd = await setupBaseWorkspace();
    await setupDocsInputs(cwd);

    await execa('node', [CLI, 'generate', '--skin', 'docs-reader', '--out', 'dist-docs-security'], {
      cwd,
      env: baseEnv()
    });

    const index = await fs.readFile(path.join(cwd, 'dist-docs-security', 'index.html'), 'utf8');
    const docsData = parseDocsData(index);
    expect(docsData).toBeTruthy();
    const doc = Array.isArray(docsData.docs) ? docsData.docs.find((entry) => entry.id === 'docs/index') : null;
    expect(doc).toBeTruthy();
    expect(String(doc.html || '').toLowerCase()).not.toContain('<script');
    expect(String(doc.html || '').toLowerCase()).not.toContain('javascript:');
    expect(String(doc.html || '').toLowerCase()).not.toContain('onerror=');
  });

  it('smokes all shipped skins and keeps legacy pinned runtime behavior', async () => {
    const cwd = await setupBaseWorkspace();
    await setupDocsInputs(cwd);

    const skins = ['console', 'vite-breeze', 'cards-tabs', 'kiosk', 'typefolio', 'typescatter', 'docs-reader'];
    for (const skin of skins) {
      const outDir = `dist-${skin}`;
      await execa('node', [CLI, 'generate', '--skin', skin, '--out', outDir], {
        cwd,
        env: baseEnv()
      });
      const indexPath = path.join(cwd, outDir, 'index.html');
      const index = await fs.readFile(indexPath, 'utf8');
      if (skin === 'console') {
        expect(index).toContain('id="works-console"');
      } else {
        expect(index).toContain(`data-skin="${skin}"`);
      }
      expect(index).toContain('<script src="./script.js" defer></script>');
      expect(index).not.toContain('data-prae-runtime-loader="1"');
    }
  });

  it('supports custom styleless shells without forcing loader mode', async () => {
    const cwd = await setupBaseWorkspace();
    const uiRoot = path.join(cwd, 'ui-styleless');
    await fs.mkdir(uiRoot, { recursive: true });
    await fs.writeFile(path.join(uiRoot, 'template.html'), [
      '<!doctype html>',
      '<html>',
      '  <head><meta charset="utf-8"><title>Styleless</title></head>',
      '  <body>',
      '    <main id="works-console"></main>',
      '  </body>',
      '</html>'
    ].join('\n'), 'utf8');
    await fs.writeFile(path.join(uiRoot, 'main.js'), [
      "const root = document.getElementById('works-console');",
      "const title = window.PRAE?.works?.[0]?.title || 'No work';",
      "root.textContent = title;"
    ].join('\n'), 'utf8');
    await fs.writeFile(path.join(uiRoot, 'style.css'), '', 'utf8');

    await execa('node', [CLI, 'generate', '--ui-src', 'ui-styleless', '--out', 'dist-styleless'], {
      cwd,
      env: baseEnv()
    });

    const index = await fs.readFile(path.join(cwd, 'dist-styleless', 'index.html'), 'utf8');
    const runtimeScript = await fs.readFile(path.join(cwd, 'dist-styleless', 'script.js'), 'utf8');
    expect(index).toContain('<script src="./script.js" defer></script>');
    expect(index).not.toContain('data-prae-runtime-loader="1"');
    expect(runtimeScript).toContain('window.PRAE.works = works;');
    expect(runtimeScript).toContain('window.PRAE.media = Object.assign');
    expect(runtimeScript).toContain('window.PRAE.pauseAllAudio = function(exceptId)');
    expect(runtimeScript).toContain('resolveScorePdfMode');
    expect(runtimeScript).toContain('applyPdfFramePolicy');
  });
});
