import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

async function setupWorkspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-ui-runtime-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  const db = {
    version: 1,
    works: [
      {
        id: 1,
        slug: 'runtime-check',
        title: 'Runtime Check',
        oneliner: 'Verifies UI runtime behavior.',
        cover: 'https://cdn.example.com/cover.jpg',
        tags: ['runtime', 'test'],
        cues: [{ label: '@0:00', t: 0 }],
        audio: 'https://example.com/audio.mp3',
        pdf: 'https://example.com/score.pdf'
      }
    ]
  };
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify(db, null, 2), 'utf8');
  return cwd;
}

async function setupDocsReaderInputs(cwd) {
  await fs.mkdir(path.join(cwd, 'docs'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'docs', 'index.md'), '# Docs Reader\\n\\nRuntime parity test.', 'utf8');
  await fs.writeFile(
    path.join(cwd, '.prae', 'docs.json'),
    JSON.stringify({
      sources: { globs: ['docs/**/*.md'], includeReadme: false },
      search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
      paths: { root: 'docs/', homepage: 'docs/index.md' }
    }, null, 2),
    'utf8'
  );
}

async function runGenerate(cwd, args) {
  return execa('node', [CLI, 'generate', ...args], {
    cwd,
    env: { FORCE_COLOR: '0' }
  });
}

const REACT_RUNTIME_SKINS = [
  { key: 'vite-breeze', label: 'Vite Breeze' },
  { key: 'cards-tabs', label: 'Cards-Tabs' },
  { key: 'kiosk', label: 'Kiosk' },
  { key: 'docs-reader', label: 'Docs Reader' }
];

describe('generate --ui-runtime', () => {
  REACT_RUNTIME_SKINS.forEach(({ key, label }) => {
    it(`${key} defaults to vanilla runtime`, async () => {
      const cwd = await setupWorkspace();
      if (key === 'docs-reader') await setupDocsReaderInputs(cwd);
      await runGenerate(cwd, ['--skin', key, '--out', 'dist-vanilla']);

      const index = await fs.readFile(path.join(cwd, 'dist-vanilla', 'index.html'), 'utf8');
      const script = await fs.readFile(path.join(cwd, 'dist-vanilla', 'script.js'), 'utf8');

      expect(index).toContain(`data-skin="${key}"`);
      expect(index).toContain('data-ui-runtime="vanilla"');
      expect(index).toContain('data-brand-system="praetorius-v1"');
      expect(index).toContain('data-brand-attribution="on"');
      expect(index).toContain('data-palette="orange-blue-white-silver"');
      expect(index).toContain('data-cursor="system"');
      expect(index).toContain('data-hover-effect="balanced-neo"');
      expect(index).toContain('data-button-effect="balanced-neo"');
      expect(script).toContain('window.PRAE.applyAppearanceMode = praeApplyAppearanceMode;');
      expect(script).toContain('window.PRAE.config.branding = data.config ? data.config.branding');
      expect(script).toContain("root.setAttribute('data-brand-system', 'praetorius-v1');");
      expect(script).toContain('window.PRAE.pauseAllAudio = function(exceptId)');
      expect(script).toContain('setEmbedFrameMode: praeSetEmbedFrameMode');
      expect(script).toContain("frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');");
      expect(script).toContain("frame.setAttribute('referrerpolicy', 'no-referrer');");
    });

    it(`${key} bundles react runtime`, async () => {
      const cwd = await setupWorkspace();
      if (key === 'docs-reader') await setupDocsReaderInputs(cwd);
      await runGenerate(cwd, ['--skin', key, '--ui-runtime', 'react', '--out', 'dist-react']);

      const index = await fs.readFile(path.join(cwd, 'dist-react', 'index.html'), 'utf8');
      const appJs = await fs.readFile(path.join(cwd, 'dist-react', 'app.js'), 'utf8');
      const script = await fs.readFile(path.join(cwd, 'dist-react', 'script.js'), 'utf8');

      expect(index).toContain(`data-skin="${key}"`);
      expect(index).toContain('data-ui-runtime="react"');
      expect(index).toContain('data-brand-system="praetorius-v1"');
      expect(index).toContain('data-brand-attribution="on"');
      expect(index).toContain('data-palette="orange-blue-white-silver"');
      expect(appJs).toContain('createRoot');
      expect(appJs.includes("from 'react'") || appJs.includes('from "react"')).toBe(false);
      expect(script).toContain('window.PRAE.pauseAllAudio = function(exceptId)');
      expect(script).toContain("node.setAttribute('data-palette', appearance.theme.palette);");
      expect(script).toContain("node.setAttribute('data-hover-effect', appearance.effects.hover);");
      expect(script).toContain("node.setAttribute('data-button-effect', appearance.effects.button);");
      expect(script).toContain('setEmbedFrameMode: praeSetEmbedFrameMode');
    });

    it(`${key} uses vanilla embed fallback when react runtime is requested`, async () => {
      const cwd = await setupWorkspace();
      if (key === 'docs-reader') await setupDocsReaderInputs(cwd);
      const result = await runGenerate(cwd, ['--skin', key, '--ui-runtime', 'react', '--embed', '--out', 'dist-embed']);

      const embed = await fs.readFile(path.join(cwd, 'dist-embed', 'embed.html'), 'utf8');

      expect(result.stdout).toContain(`using vanilla ${key} fallback`);
      expect(embed).toContain(`${label} (vanilla fallback for CMS)`);
    });
  });
});
