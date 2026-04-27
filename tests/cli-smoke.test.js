import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));
const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

describe('prae CLI smoke', () => {
  it('prints help', async () => {
    const result = await execa('node', [CLI, '--help'], {
      cwd: ROOT,
      env: { FORCE_COLOR: '0' }
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Praetorius — portfolio-first SPA generator');
  });

  it('validates works db without errors', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-cli-smoke-'));
    await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });
    await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify({
      version: 1,
      works: [
        {
          id: 1,
          slug: 'smoke',
          title: 'Smoke',
          oneliner: 'Minimal smoke test record.',
          cues: []
        }
      ]
    }, null, 2), 'utf8');

    const result = await execa('node', [CLI, 'validate'], {
      cwd,
      env: { FORCE_COLOR: '0' }
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Schema OK/);
  });
});
