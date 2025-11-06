#!/usr/bin/env node
// Praetorius CLI — init scaffolder

import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------- templates FIRST (avoid TDZ) ---------- */
const STARTER_JS = `/** Praetorius Works Console — starter v0
 * Paste this into a <script> block or host it as an external JS file.
 * Replace the "works" array with your entries (or wait for the full GUI).
 */
(function(){
  const works = [
    {
      id: 1,
      slug: 'soundnoisemusic',
      title: 'WORK 1 — String Quartet No. 2 “SOUNDNOISEMUSIC”',
      one: 'A through-composed/indeterminate quartet...',
      cues: [{ label: '@10:30', t: 630 }],
      audio: 'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3',
      pdf:   'https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf'
    }
  ];

  // Simple window hook for now:
  window.PRAE = window.PRAE || {};
  window.PRAE.works = works;
  console.log('[prae] starter loaded: 1 work (edit script.js to add more).');
})();
`;

const STARTER_CSS = `/* Praetorius Works Console — minimal CSS seed (merge with your global/page CSS) */
#works-console .btn{padding:.4rem .7rem;border:1px solid var(--line,rgba(255,255,255,.18));border-radius:.6rem;background:transparent}
#works-console .line{opacity:.92;transition:opacity .2s}
#works-console .line.muted{opacity:.62}
#works-console .actions{display:flex;gap:.6rem;margin:.25rem 0 .6rem}
#works-console .toast{position:sticky;bottom:.5rem;align-self:flex-end;padding:.5rem .7rem;border-radius:.6rem;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)}
`;

const STARTER_README = `Praetorius CLI starter
======================

This folder contains:
- script.js : a tiny seed that exposes window.PRAE.works
- styles.css: minimal styles to get you going

Usage in Squarespace:
- Put the contents of script.js into a Code block (or host as external JS)
- Put styles.css into Page CSS or Site-wide CSS (Design → Custom CSS)

Later:
- The full CLI will generate a richer JS bundle that wires the audio + PDF pane automatically.
- A GUI editor will write to a /data/works.json and produce a final bundle for copy/paste.
`;

/* ---------- setup ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const pkgJson = (() => {
  try {
    const p = path.resolve(__dirname, '../../package.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { name: 'praetorius', version: '0.0.0' };
  }
})();

const program = new Command();
program
  .name('praetorius')
  .alias('prae')
  .description('Praetorius — Works Console scaffolder')
  .version(pkgJson.version || '0.0.0');

/* ---------- commands ---------- */
program
  .command('init')
  .description('Create starter script + css for the Works Console')
  .option('-o, --out <dir>', 'output directory', 'prae-out')
  .option('--dry-run', 'print actions without writing files', false)
  .option('-f, --force', 'overwrite if files exist', false)
  .action(async (opts) => {
    const outDir = path.resolve(process.cwd(), opts.out);
    const dry    = !!opts['dryRun'];
    const force  = !!opts.force;

    const logHead = () => {
      console.log('');
      console.log(pc.bold('Praetorius init'));
      console.log(pc.gray('Target: ')+pc.cyan(path.relative(process.cwd(), outDir) || '.'));
      console.log(pc.gray('Mode:  ')+pc.cyan(dry ? 'dry-run' : 'write'));
      console.log(pc.gray('Force: ')+pc.cyan(force ? 'on' : 'off'));
      console.log('');
    };

    const files = [
      { name: 'script.js',  contents: STARTER_JS },
      { name: 'styles.css', contents: STARTER_CSS },
      { name: 'README.txt', contents: STARTER_README },
    ];

    logHead();
    if (!dry) fs.mkdirSync(outDir, { recursive: true });

    for (const f of files) {
      const p = path.join(outDir, f.name);
      if (dry) {
        console.log(pc.yellow('plan  ') + pc.dim(path.relative(process.cwd(), p)));
        continue;
      }
      if (fs.existsSync(p) && !force) {
        console.log(pc.yellow('skip  ') + pc.dim(path.relative(process.cwd(), p)) + pc.gray(' (exists; use --force)'));
        continue;
      }
      fs.writeFileSync(p, f.contents, 'utf8');
      console.log(pc.green('write ') + pc.dim(path.relative(process.cwd(), p)));
    }

    console.log('');
    console.log(pc.bold('Next steps:'));
    console.log('  1) Open ' + pc.cyan(path.relative(process.cwd(), outDir)));
    console.log('  2) Copy ' + pc.cyan('script.js')  + ' into your Squarespace code block (or host it).');
    console.log('  3) Add  ' + pc.cyan('styles.css') + ' to your page/site CSS.');
    console.log('');
    console.log(pc.gray('Tip: Re-run with --force to overwrite, or --dry-run to preview.'));
  });

/* ---------- run ---------- */
program.parseAsync(process.argv);
