import tpl from './template.html?raw';
import css from './style.css?inline';
import './main.js'; // your IIFE reads the DOM and boots itself

function mount() {
  // If user didn’t provide the wrapper, create it.
  const existing = document.getElementById('works-group');
  if (!existing) {
    const host = document.createElement('div');
    host.innerHTML = `<style>${css}</style>` + tpl;
    document.body.appendChild(host);
  } else {
    // Ensure styles are present
    const style = document.createElement('style');
    style.textContent = css;
    existing.parentElement.insertBefore(style, existing);
    // If #works-group is empty, fill it with template
    if (!existing.querySelector('#works-console')) {
      existing.outerHTML = `<style>${css}</style>` + tpl;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
