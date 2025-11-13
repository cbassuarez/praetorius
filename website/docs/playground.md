# Playground

Real Praetorius runtime running in a same-origin embed page. This avoids SSR/HMR quirks and guarantees the correct PDF worker.

<script setup lang="ts">
const base = import.meta.env.BASE_URL || '/';
const works = new URL('samples/works.playground.json', location.href).toString();
const src = `${base}embed.html?works=${encodeURIComponent(works)}&skin=typefolio&pageFollow=1`;
</script>

<iframe :src="src" title="Praetorius Playground" style="width:100%;height:70vh;border:1px solid var(--vp-c-divider);border-radius:12px;"></iframe>
