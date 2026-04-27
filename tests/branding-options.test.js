import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

async function setupWorkspace({ config } = {}) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-branding-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify({
    version: 1,
    works: [{
      id: 1,
      slug: 'branding-check',
      title: 'Branding Check',
      oneliner: 'Verifies branding defaults and migration behavior.',
      cues: []
    }]
  }, null, 2), 'utf8');
  if (config) {
    await fs.writeFile(path.join(cwd, '.prae', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  }
  return cwd;
}

describe('branding options', () => {
  it('defaults attribution to on when config is missing branding block', async () => {
    const cwd = await setupWorkspace({
      config: {
        theme: 'dark',
        ui: { skin: 'cards-tabs' }
      }
    });

    await execa('node', [CLI, 'generate', '--skin', 'cards-tabs', '--out', 'dist-default-branding'], {
      cwd,
      env: { FORCE_COLOR: '0' }
    });

    const index = await fs.readFile(path.join(cwd, 'dist-default-branding', 'index.html'), 'utf8');
    const script = await fs.readFile(path.join(cwd, 'dist-default-branding', 'script.js'), 'utf8');

    expect(index).toContain('data-brand-system="praetorius-v1"');
    expect(index).toContain('data-brand-attribution="on"');
    expect(script).toMatch(/"branding"\s*:\s*\{\s*"attribution"\s*:\s*\{\s*"enabled"\s*:\s*true/);
  });

  it('maps legacy site.showBadge=false to attribution off', async () => {
    const cwd = await setupWorkspace({
      config: {
        theme: 'dark',
        site: { showBadge: false },
        ui: { skin: 'kiosk' }
      }
    });

    await execa('node', [CLI, 'generate', '--skin', 'kiosk', '--out', 'dist-legacy-badge'], {
      cwd,
      env: { FORCE_COLOR: '0' }
    });

    const index = await fs.readFile(path.join(cwd, 'dist-legacy-badge', 'index.html'), 'utf8');
    const script = await fs.readFile(path.join(cwd, 'dist-legacy-badge', 'script.js'), 'utf8');

    expect(index).toContain('data-brand-attribution="off"');
    expect(script).toMatch(/"branding"\s*:\s*\{\s*"attribution"\s*:\s*\{\s*"enabled"\s*:\s*false/);
  });

  it('respects explicit attribution opt-out in new ui.branding config', async () => {
    const cwd = await setupWorkspace({
      config: {
        theme: 'light',
        ui: {
          skin: 'vite-breeze',
          branding: {
            attribution: { enabled: false }
          }
        }
      }
    });

    await execa('node', [CLI, 'generate', '--skin', 'vite-breeze', '--out', 'dist-branding-off'], {
      cwd,
      env: { FORCE_COLOR: '0' }
    });

    const index = await fs.readFile(path.join(cwd, 'dist-branding-off', 'index.html'), 'utf8');
    expect(index).toContain('data-brand-attribution="off"');
  });
});
