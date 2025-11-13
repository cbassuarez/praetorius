<script setup lang="ts">
import { withBase } from 'vitepress'

/**
 * Serve the generated bundle from public:
 *   website/docs/public/playground/embed/
 * Copy your files:
 *   index.html, styles.css, app.css, script.js, app.js  -> /playground/embed/
 *   lib/work-detail-lines.js, lib/work-normalize.js     -> /playground/embed/lib/
 *
 * The iframe points at that folder; index.html will be used automatically.
 */
const src = withBase('/playground/embed/')
</script>

<template>
  <div class="prae-embed">
    <iframe
      :src="src"
      title="Praetorius Playground"
      loading="lazy"
      allow="autoplay; fullscreen"
      referrerpolicy="no-referrer"
    />
  </div>
</template>

<style scoped>
/* Full-bleed inside the doc column; the generated app controls its own CSS */
.prae-embed { margin: 0; }
.prae-embed iframe {
  display: block;
  width: 100%;
  height: calc(100vh - 96px);
  border: 0;
}
@media (max-width: 640px){
  .prae-embed iframe { height: calc(100vh - 128px); }
}
</style>
