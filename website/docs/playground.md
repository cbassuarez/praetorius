---
title: Playground
layout: page
sidebar: false
aside: false
outline: false
pageClass: playground-page
---

<section class="prae-playground">
  <header class="prae-playground__header">
    <p class="prae-playground__kicker">Playground</p>
    <h1>Live stock demo</h1>
    <p>Test Praetorius behavior exactly as generated output does, including audio playback, PDF score viewing, and global appearance controls.</p>
  </header>
  <div class="prae-playground__stage">
    <ClientOnly>
      <PraeConsoleExact />
    </ClientOnly>
  </div>
</section>
