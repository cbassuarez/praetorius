import tpl from './template.html?raw';
import css from './style.css?inline';
// ❗ Do NOT import the IIFE at module top-level (it would auto-run pre-mount)
// import './main.js';

export async function mount(el, opts = {}) {
  // Resolve host: element | selector | fallback to document.body
  const target = typeof el === 'string'
    ? document.querySelector(el)
    : (el || document.body);

  // Ensure container markup + styles exist **in the chosen host**
  const existing = (target && target.querySelector?.('#works-group')) || document.getElementById('works-group');
  if (!existing) {
    const host = document.createElement('div');
    host.innerHTML = `<style>${css}</style>` + tpl;
    target.appendChild(host);
  } else {
    const style = document.createElement('style');
    style.textContent = css;
    (existing.parentElement || target).insertBefore(style, existing);
    if (!existing.querySelector('#works-console')) {
      existing.outerHTML = `<style>${css}</style>` + tpl;
    }
  }

  // Now run your runtime IIFE so it bootstraps against the injected DOM
  await import('./main.js'); // executes the IIFE once
}

export const init = mount;

export class App {
  constructor(opts = {}) { this.opts = opts; }
  async mount(el) { return mount(el, this.opts); }
}

// Library surface (UMD: window.PRAE; ESM: default export)
const API = { mount, init, App };
// 🔒 Guarantee a global for any loader that fails to wire UMD properly
try {
  const g = (typeof globalThis !== 'undefined' ? globalThis
           : typeof window !== 'undefined'    ? window
           : typeof self !== 'undefined'      ? self
           : {});
  if (g && !g.PRAE) g.PRAE = API;
} catch {}
export default API;