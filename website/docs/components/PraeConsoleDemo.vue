<script setup lang="ts">
import PraeViewer from './PraeViewer.vue'
</script>

<template>
  <PraeViewer
    pdf="https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf"
    audio="https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/audio/SSS_soundnoisemusic_audio.mp3"
    fallback-pdf="/samples/demo.pdf"
    fallback-audio="/samples/demo.mp3"
    initial-skin="console"
  />
</template>
