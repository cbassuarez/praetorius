import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
    const result = await execa('node', [CLI, 'validate'], {
      cwd: ROOT,
      env: { FORCE_COLOR: '0' }
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Schema OK/);
  });
});
