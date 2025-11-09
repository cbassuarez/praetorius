#!/usr/bin/env node
import { execa } from 'execa';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repoRoot, 'src/cli/index.js');
const nodeBin = process.execPath;
const port = 5178;

async function main() {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-smoke-'));
  console.log('e2e-smoke cwd:', work);

  // Seed minimal project state
  await execa(nodeBin, [cli, 'init'], { cwd: work, stdio: 'inherit' });

  // Build assets
  try {
    await execa(nodeBin, [cli, 'generate', '-o', 'dist', '--minify', '--no-ui'], { cwd: work, stdio: 'inherit' });
  } catch {
    // If a packaged UI exists, allow it; otherwise skip quietly
    await execa(nodeBin, [cli, 'generate', '-o', 'dist', '--minify'], { cwd: work, stdio: 'inherit' });
  }

  // Start preview (no browser)
  const child = execa(nodeBin, [cli, 'preview', '--no-open', '--port', String(port)], { cwd: work });
  let ready = false;
  child.stdout.on('data', (d) => {
    const s = d.toString();
    process.stdout.write(s);
    if (!ready && /preview\s+http:\/\/localhost:/i.test(s)) ready = true;
  });

  // Wait up to ~8s for server banner
  const deadline = Date.now() + 8000;
  while (!ready && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
  if (!ready) { child.kill('SIGTERM'); throw new Error('preview did not start'); }

  // Probe /
  const res = await fetch(`http://localhost:${port}/`);
  const html = await res.text();
  if (!(res.ok && /<section id="works-console">/.test(html))) {
    child.kill('SIGTERM');
    throw new Error('preview probe failed');
  }

  child.kill('SIGTERM');
  console.log('e2e-smoke: OK');
}

main().catch((e) => {
  console.error('e2e-smoke:', e.message);
  process.exit(1);
});
