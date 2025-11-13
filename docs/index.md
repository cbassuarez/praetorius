---
title: Praetorius — Interactive Works Console
aside: false
---

<div class="prae-card" style="padding:16px;margin:1.5rem 0;">
  <h1>Praetorius — Interactive Works Console</h1>
  <p>Score-centric works pages with synchronized audio, page-follow PDFs, and shareable deep links—made for artists, festivals, and archives.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
    <CLIBlock :commands="[
      { shell:'bash', cmd:'npm i -g praetorius' },
      { shell:'zsh',  cmd:'npm i -g praetorius' },
      { shell:'fish', cmd:'npm i -g praetorius' },
      { shell:'pwsh', cmd:'npm i -g praetorius' }
    ]" />
    <a class="VPSocialLink" href="/docs/getting-started">Read the Docs →</a>
  </div>
  <div style="margin-top:10px;display:flex;gap:16px;align-items:center;">
    <GitHubMeta repo="cbassuarez/praetorius" />
    <NpmBadge pkg="praetorius" />
  </div>
</div>

## Skins (live)
<ClientOnly>
<PraePlayground
  pdf="https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf"
  audio="https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3"
  fallback-pdf="/samples/demo.pdf"
  fallback-audio="/samples/demo.mp3"
/>
</ClientOnly>

### Who it’s for
- **Festivals & Universities** — juries, archives, ensemble materials with deep links.
- **Libraries & Galleries** — score-forward records; playback and page-follow at a glance.

> Tip: Regenerate with different skins or embed as a single block in Squarespace.

<script setup>
import CLIBlock from './components/CLIBlock.vue'
</script>
