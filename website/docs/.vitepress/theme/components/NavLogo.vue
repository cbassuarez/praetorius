<template>
  <span class="prae-nav-lockup" aria-label="Praetorius">
    <svg class="prae-nav-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="32" cy="32" r="21" />
        <circle cx="32" cy="32" r="5" fill="currentColor" />
        <path d="M32 12c7 6 12 12 14 20" />
        <path d="M32 12c7 6 12 12 14 20" transform="rotate(60 32 32)" />
        <path d="M32 12c7 6 12 12 14 20" transform="rotate(120 32 32)" />
        <path d="M32 12c7 6 12 12 14 20" transform="rotate(180 32 32)" />
        <path d="M32 12c7 6 12 12 14 20" transform="rotate(240 32 32)" />
        <path d="M32 12c7 6 12 12 14 20" transform="rotate(300 32 32)" />
      </g>
    </svg>
    <span class="prae-nav-wordmark">Praetorius</span>
  </span>
</template>

<script setup lang="ts"></script>

<style scoped>
.prae-nav-lockup {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.18rem 0.55rem 0.18rem 0.42rem;
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
  background: var(--vp-c-bg);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--prae-blue) 22%, transparent);
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: transform .14s ease, box-shadow .14s ease;
}

.prae-nav-lockup:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--prae-blue) 38%, transparent);
}

.prae-nav-mark {
  width: 1.45rem;
  height: 1.45rem;
  flex: 0 0 auto;
  color: var(--vp-c-text-1);
}

.prae-nav-wordmark {
  font-family: 'Instrument Serif', 'Times New Roman', serif;
  font-size: 1.32rem;
  letter-spacing: 0.01em;
  line-height: 1;
}
</style>
