import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

async function setupProject(db) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-media-roundtrip-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify(db, null, 2), 'utf8');
  return cwd;
}

describe('media import/export round-trip', () => {
  it('preserves media_json youtube payload through csv export/import', async () => {
    const source = await setupProject({
      version: 1,
      works: [
        {
          id: 1,
          slug: 'yt-roundtrip',
          title: 'YouTube Roundtrip',
          oneliner: 'Exports and imports media_json',
          audio: 'https://example.com/fallback.mp3',
          pdf: 'https://example.com/fallback.pdf',
          media: {
            kind: 'youtube',
            youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ?t=43',
            startAtSec: 43
          },
          cues: []
        }
      ]
    });

    const exported = await execa('node', [CLI, 'export', '--format', 'csv'], {
      cwd: source,
      env: { FORCE_COLOR: '0' }
    });
    expect(exported.stdout).toContain('media_json');
    expect(exported.stdout).toContain('""kind"":""youtube""');

    const csvPath = path.join(source, 'works-media.csv');
    await fs.writeFile(csvPath, `${exported.stdout}\n`, 'utf8');

    const target = await setupProject({ version: 1, works: [] });
    await execa('node', [CLI, 'import', csvPath, '--assume-new-id', '--assume-new-slug'], {
      cwd: target,
      env: { FORCE_COLOR: '0' }
    });

    const imported = JSON.parse(await fs.readFile(path.join(target, '.prae', 'works.json'), 'utf8'));
    expect(imported.works).toHaveLength(1);
    expect(imported.works[0].media).toEqual({
      kind: 'youtube',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ?t=43',
      startAtSec: 43
    });
  });

  it('imports youtube media from tolerant legacy csv columns', async () => {
    const project = await setupProject({ version: 1, works: [] });
    const csvPath = path.join(project, 'legacy-youtube.csv');
    const rows = [
      'id,slug,title,oneliner,audio,pdf,media_kind,youtube_url,start_at_sec,cues_json,score_json',
      '1,legacy-yt,Legacy YouTube,Legacy csv fallback,,,youtube,https://www.youtube.com/watch?v=dQw4w9WgXcQ,17,[],'
    ];
    await fs.writeFile(csvPath, `${rows.join('\n')}\n`, 'utf8');

    await execa('node', [CLI, 'import', csvPath, '--assume-new-id', '--assume-new-slug'], {
      cwd: project,
      env: { FORCE_COLOR: '0' }
    });

    const imported = JSON.parse(await fs.readFile(path.join(project, '.prae', 'works.json'), 'utf8'));
    expect(imported.works).toHaveLength(1);
    expect(imported.works[0].media).toEqual({
      kind: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startAtSec: 17
    });
  });

  it('preserves score_pdf_mode across csv export/import', async () => {
    const source = await setupProject({
      version: 1,
      works: [
        {
          id: 1,
          slug: 'score-clean',
          title: 'Score Clean',
          oneliner: 'Score clean mode export/import',
          pdf: 'https://example.com/score.pdf',
          score: {
            pdfStartPage: 1,
            mediaOffsetSec: 0,
            pdfMode: 'clean',
            pageMap: [{ at: 0, page: 1 }]
          },
          cues: []
        }
      ]
    });

    const exported = await execa('node', [CLI, 'export', '--format', 'csv'], {
      cwd: source,
      env: { FORCE_COLOR: '0' }
    });
    expect(exported.stdout).toContain('score_pdf_mode');
    expect(exported.stdout).toContain('"clean"');

    const csvPath = path.join(source, 'works-score-mode.csv');
    await fs.writeFile(csvPath, `${exported.stdout}\n`, 'utf8');

    const target = await setupProject({ version: 1, works: [] });
    await execa('node', [CLI, 'import', csvPath, '--assume-new-id', '--assume-new-slug'], {
      cwd: target,
      env: { FORCE_COLOR: '0' }
    });

    const imported = JSON.parse(await fs.readFile(path.join(target, '.prae', 'works.json'), 'utf8'));
    expect(imported.works).toHaveLength(1);
    expect(imported.works[0].score?.pdfMode).toBe('clean');
  });
});
