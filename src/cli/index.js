#!/usr/bin/env node
// Praetorius CLI v0 — minimal working "init"
import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const pkgJson    = (() => {
  try { return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')); }
  catch { return { name: 'prae', version: '0.1.0' }; }
})();

const program = new Command();
program
  .name('prae')
  .description('Praetorius — Works Console scaffolder')
  .version(pkgJson.version || '0.1.0');

program
  .command('init')
  .description('Create starter script + css for the Works Console')
  .option('-o, --out <dir>', 'output directory', 'prae-out')
  .option('-f, --force', 'overwrite if files exist', false)
  .action(async (opts) => {
    const outDir = path.resolve(process.cwd(), opts.out);
    fs.mkdirSync(outDir, { recursive: true });

    const files = [
      { name: 'script.js', contents: STARTER_JS },
      { name: 'styles.css', contents: STARTER_CSS },
      { name: 'README.txt', contents: STARTER_README },
    ];

    for (const f of files) {
      const p = path.join(outDir, f.name);
      if (fs.existsSync(p) && !opts.force) {
        console.log(pc.yellow(`skip  `) + pc.dim(f.name) + pc.gray(' (exists; use --force to overwrite)'));
        continue;
      }
      fs.writeFileSync(p, f.contents, 'utf8');
      console.log(pc.green('write ') + pc.dim(path.relative(process.cwd(), p)));
    }

    console.log('');
    console.log(pc.bold('Next steps:'));
    console.log('  1) Open ') + console.log(pc.cyan(path.relative(process.cwd(), outDir)));
    console.log('  2) Copy ') + console.log(pc.cyan('script.js')) + console.log(' into your Squarespace code block (or host it).');
    console.log('  3) Add ') + console.log(pc.cyan('styles.css')) + console.log(' to your page/site CSS.');
    console.log('');
    console.log(pc.gray('Tip: Re-run with --force to overwrite.'));
  });

program.parse(process.argv);

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
