import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

async function setupWorkspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-docs-reader-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.mkdir(path.join(cwd, 'docs'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify({ version: 1, works: [] }, null, 2), 'utf8');
  return cwd;
}

async function runGenerate(cwd, args) {
  return execa('node', [CLI, 'generate', '--skin', 'docs-reader', ...args], {
    cwd,
    env: { FORCE_COLOR: '0' }
  });
}

function readDocsDataFromIndex(indexHtml) {
  const match = indexHtml.match(/<script id="prae-docs-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

describe('docs-reader payload modules + search auto', () => {
  it('normalizes frontmatter modules and emits deterministic warnings', async () => {
    const cwd = await setupWorkspace();
    await fs.writeFile(path.join(cwd, '.prae', 'docs.json'), JSON.stringify({
      site: { title: 'Docs Test', subtitle: '', description: '', accent: '' },
      sources: { globs: ['docs/**/*.md'], includeReadme: false },
      ia: [],
      search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
      works: { includeInNav: false, includeOnHome: false, linkMode: 'auto' },
      paths: { root: 'docs/', homepage: 'docs/index.md' }
    }, null, 2), 'utf8');

    await fs.writeFile(path.join(cwd, 'docs', 'index.md'), `---
title: Aurora Manual
hero:
  title: Aurora Manual
  lede: Score and performance docs
modules:
  - type: score
    title: Full Score
    pdf: https://example.com/score.pdf
    audio: https://example.com/audio.mp3
    cues:
      - label: Intro
        t: 0
        page: 1
      - label: Arc
        t: 45
        page: 3
  - type: media
    layout: masonry
    items:
      - src: https://example.com/cover.jpg
        caption: Cover draft
  - type: process
    steps:
      - title: Draft
        body: |
          Iteration one.
  - type: credits
    roles:
      - role: Composer
        people: ["A. Artist"]
  - type: score
    title: Broken score
---
# Aurora Manual

Main body.
`, 'utf8');

    const result = await runGenerate(cwd, ['--out', 'dist']);
    const index = await fs.readFile(path.join(cwd, 'dist', 'index.html'), 'utf8');
    const docsData = readDocsDataFromIndex(index);

    expect(docsData).toBeTruthy();
    const doc = docsData.docs.find((entry) => entry.id === 'docs/index');
    expect(doc).toBeTruthy();
    expect(Array.isArray(doc.modules)).toBe(true);
    expect(doc.modules.map((module) => module.type)).toEqual(['score', 'media', 'process', 'credits']);
    expect(doc.modules[0].cues.length).toBe(2);
    expect(doc.modules[1].layout).toBe('masonry');
    expect(result.stdout).toContain('missing alt text');
    expect(result.stdout).toContain('missing required "pdf"');
  });

  it('uses light search for small docs and fuse search for large docs when engine=auto', async () => {
    const small = await setupWorkspace();
    await fs.writeFile(path.join(small, '.prae', 'docs.json'), JSON.stringify({
      sources: { globs: ['docs/**/*.md'], includeReadme: false },
      search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
      paths: { root: 'docs/', homepage: 'docs/index.md' }
    }, null, 2), 'utf8');
    await fs.writeFile(path.join(small, 'docs', 'index.md'), '# Small\n\nshort body', 'utf8');
    await runGenerate(small, ['--out', 'dist-small']);
    const smallIndex = await fs.readFile(path.join(small, 'dist-small', 'index.html'), 'utf8');
    const smallData = readDocsDataFromIndex(smallIndex);
    expect(smallData.searchConfig.engine).toBe('light');

    const large = await setupWorkspace();
    await fs.writeFile(path.join(large, '.prae', 'docs.json'), JSON.stringify({
      sources: { globs: ['docs/**/*.md'], includeReadme: false },
      search: { enabled: true, engine: 'auto', fields: ['title', 'headings', 'body', 'summary'] },
      paths: { root: 'docs/', homepage: 'docs/index.md' }
    }, null, 2), 'utf8');

    const hugeBody = `${'large text block '.repeat(22000)}\n`;
    await fs.writeFile(path.join(large, 'docs', 'index.md'), `# Large\n\n${hugeBody}`, 'utf8');
    await runGenerate(large, ['--out', 'dist-large']);
    const largeIndex = await fs.readFile(path.join(large, 'dist-large', 'index.html'), 'utf8');
    const largeData = readDocsDataFromIndex(largeIndex);
    expect(largeData.searchConfig.engine).toBe('fuse');
  });
});
