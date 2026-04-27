import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

const BASE_DB = {
  version: 1,
  works: [
    {
      id: 1,
      slug: 'appearance-check',
      title: 'Appearance Check',
      oneliner: 'Verifies global appearance options.',
      cues: [{ label: '@0:00', t: 0 }],
      audio: 'https://example.com/audio.mp3',
      pdf: 'https://example.com/score.pdf'
    }
  ]
};

async function setupWorkspace({ db = BASE_DB, config = null } = {}) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-appearance-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify(db, null, 2), 'utf8');
  if (config) {
    await fs.writeFile(path.join(cwd, '.prae', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  }
  return cwd;
}

async function runGenerate(cwd, args, { reject = true } = {}) {
  return execa('node', [CLI, 'generate', ...args], {
    cwd,
    reject,
    env: { FORCE_COLOR: '0' }
  });
}

describe('generate appearance options', () => {
  it('applies CLI appearance flags to html/runtime payload and normalizes mono color', async () => {
    const cwd = await setupWorkspace();
    await runGenerate(cwd, [
      '--skin', 'kiosk',
      '--palette', 'mono-one',
      '--mono-color', '#336699',
      '--cursor', 'ring',
      '--hover-effect', 'high-drama',
      '--button-effect', 'minimal',
      '--out', 'dist-appearance'
    ]);

    const index = await fs.readFile(path.join(cwd, 'dist-appearance', 'index.html'), 'utf8');
    const script = await fs.readFile(path.join(cwd, 'dist-appearance', 'script.js'), 'utf8');

    expect(index).toContain('data-palette="mono-one"');
    expect(index).toContain('data-cursor="ring"');
    expect(index).toContain('data-hover-effect="high-drama"');
    expect(index).toContain('data-button-effect="minimal"');

    expect(script).toMatch(/"palette"\s*:\s*"mono-one"/);
    expect(script).toMatch(/"cursor"\s*:\s*\{\s*"preset"\s*:\s*"ring"/);
    expect(script).toMatch(/"effects"\s*:\s*\{\s*"hover"\s*:\s*"high-drama",\s*"button"\s*:\s*"minimal"/);
    expect(script).toMatch(/"monoBaseOklch"\s*:\s*"oklch\(/);
    expect(script).not.toContain('#336699');
  });

  it('uses CLI overrides over config appearance values', async () => {
    const cwd = await setupWorkspace({
      config: {
        theme: 'dark',
        ui: {
          skin: 'kiosk',
          appearance: {
            theme: { palette: 'mono-bw', monoBaseOklch: 'oklch(0.62 0.09 250)' },
            cursor: { preset: 'block-square' },
            effects: { hover: 'minimal', button: 'minimal' }
          }
        }
      }
    });

    await runGenerate(cwd, [
      '--skin', 'kiosk',
      '--palette', 'gem-diamond',
      '--cursor', 'prism-diamond',
      '--out', 'dist-precedence'
    ]);

    const index = await fs.readFile(path.join(cwd, 'dist-precedence', 'index.html'), 'utf8');
    const script = await fs.readFile(path.join(cwd, 'dist-precedence', 'script.js'), 'utf8');

    expect(index).toContain('data-palette="gem-diamond"');
    expect(index).toContain('data-cursor="prism-diamond"');
    expect(script).toMatch(/"palette"\s*:\s*"gem-diamond"/);
    expect(script).toMatch(/"cursor"\s*:\s*\{\s*"preset"\s*:\s*"prism-diamond"/);
  });

  it('rejects invalid appearance values', async () => {
    const cwd = await setupWorkspace();
    const result = await runGenerate(cwd, ['--skin', 'kiosk', '--palette', 'not-a-palette'], { reject: false });

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid palette "not-a-palette"');
  });

  it('rejects invalid cursor and effect presets', async () => {
    const cwd = await setupWorkspace();

    const badCursor = await runGenerate(cwd, ['--skin', 'kiosk', '--cursor', 'laser-beam'], { reject: false });
    expect(badCursor.exitCode).toBe(1);
    expect(`${badCursor.stdout}\n${badCursor.stderr}`).toContain('Invalid cursor preset "laser-beam"');

    const badHover = await runGenerate(cwd, ['--skin', 'kiosk', '--hover-effect', 'chaos'], { reject: false });
    expect(badHover.exitCode).toBe(1);
    expect(`${badHover.stdout}\n${badHover.stderr}`).toContain('Invalid hover effect "chaos"');

    const badButton = await runGenerate(cwd, ['--skin', 'kiosk', '--button-effect', 'chaos'], { reject: false });
    expect(badButton.exitCode).toBe(1);
    expect(`${badButton.stdout}\n${badButton.stderr}`).toContain('Invalid button effect "chaos"');
  });

  it('accepts OKLCH mono input and persists normalized OKLCH in payload', async () => {
    const cwd = await setupWorkspace();
    await runGenerate(cwd, [
      '--skin', 'cards-tabs',
      '--palette', 'mono-one',
      '--mono-color', 'oklch(62% 0.09 250)',
      '--out', 'dist-oklch'
    ]);

    const script = await fs.readFile(path.join(cwd, 'dist-oklch', 'script.js'), 'utf8');
    expect(script).toMatch(/"monoBaseOklch"\s*:\s*"oklch\(0\.62 0\.09 250\)"/);
  });

  it('keeps root theme compatibility and defaults appearance when missing', async () => {
    const cwd = await setupWorkspace({
      config: {
        theme: 'light',
        ui: { skin: 'cards-tabs' }
      }
    });

    await runGenerate(cwd, ['--skin', 'cards-tabs', '--out', 'dist-theme']);

    const index = await fs.readFile(path.join(cwd, 'dist-theme', 'index.html'), 'utf8');
    const script = await fs.readFile(path.join(cwd, 'dist-theme', 'script.js'), 'utf8');

    expect(index).toContain('data-theme="light"');
    expect(index).toContain('data-palette="orange-blue-white-silver"');
    expect(script).toMatch(/"theme"\s*:\s*"light"/);
    expect(script).toMatch(/"palette"\s*:\s*"orange-blue-white-silver"/);
  });

  it('ignores cursor/effects for console skin and emits notice', async () => {
    const cwd = await setupWorkspace();
    const result = await runGenerate(cwd, [
      '--skin', 'console',
      '--cursor', 'ring',
      '--hover-effect', 'high-drama',
      '--button-effect', 'high-drama',
      '--out', 'dist-console'
    ]);

    const script = await fs.readFile(path.join(cwd, 'dist-console', 'script.js'), 'utf8');

    expect(result.stdout).toContain('console skin uses palette + mode only; cursor and hover/button effect presets are ignored.');
    expect(script).toMatch(/"cursor"\s*:\s*\{\s*"preset"\s*:\s*"system"/);
    expect(script).toMatch(/"effects"\s*:\s*\{\s*"hover"\s*:\s*"balanced-neo",\s*"button"\s*:\s*"balanced-neo"/);
  });
});
