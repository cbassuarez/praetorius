#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cliPath = path.join(root, 'src/cli/index.js');
const pkgPath = path.join(root, 'package.json');

async function main() {
  // Exists
  await fs.access(cliPath);

  // Shebang check
  const src = await fs.readFile(cliPath, 'utf8');
  const first = (src.split(/\r?\n/, 1)[0] || '').trim();
  if (!/^#!\/usr\/bin\/env node\b/.test(first)) {
    throw new Error(`Missing/invalid shebang in ${path.relative(root, cliPath)}`);
  }

  // Executable bit (skip on Windows)
  if (process.platform !== 'win32') {
    const st = fsSync.statSync(cliPath);
    if ((st.mode & 0o111) === 0) {
      throw new Error(`CLI is not executable (+x): ${path.relative(root, cliPath)}`);
    }
  }

  // package.json bin mapping
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  const want = 'src/cli/index.js';
  const ok =
    pkg?.bin?.praetorius === want &&
    pkg?.bin?.prae === want;
  if (!ok) {
    throw new Error(`package.json "bin" must map { prae, praetorius } → ${want}`);
  }

  console.log('prepack-verify: OK');
}

main().catch((e) => {
  console.error('prepack-verify:', e.message);
  process.exit(1);
});
