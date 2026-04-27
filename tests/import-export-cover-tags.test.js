import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

async function setupProject(db) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-roundtrip-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify(db, null, 2), 'utf8');
  return cwd;
}

describe('cover/tags CSV round-trip', () => {
  it('preserves cover and tags through export/import', async () => {
    const source = await setupProject({
      version: 1,
      works: [
        {
          id: 1,
          slug: 'cover-tags-roundtrip',
          title: 'Cover Tags Roundtrip',
          oneliner: 'Roundtrip test for visual metadata.',
          cover: 'https://cdn.example.com/work-cover.jpg',
          tags: ['electroacoustic', 'premiere', '2026'],
          cues: []
        }
      ]
    });

    const exported = await execa('node', [CLI, 'export', '--format', 'csv'], {
      cwd: source,
      env: { FORCE_COLOR: '0' }
    });

    expect(exported.stdout).toContain('cover');
    expect(exported.stdout).toContain('tags_csv');

    const csvPath = path.join(source, 'works.csv');
    await fs.writeFile(csvPath, `${exported.stdout}\n`, 'utf8');

    const target = await setupProject({ version: 1, works: [] });
    await execa('node', [CLI, 'import', csvPath, '--assume-new-id', '--assume-new-slug'], {
      cwd: target,
      env: { FORCE_COLOR: '0' }
    });

    const importedRaw = await fs.readFile(path.join(target, '.prae', 'works.json'), 'utf8');
    const imported = JSON.parse(importedRaw);
    expect(imported.works).toHaveLength(1);
    expect(imported.works[0].cover).toBe('https://cdn.example.com/work-cover.jpg');
    expect(imported.works[0].tags).toEqual(['electroacoustic', 'premiere', '2026']);
  });
});
