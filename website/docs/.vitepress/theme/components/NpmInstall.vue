<template>
  <div class="npm-install" role="group" aria-label="Install praetorius via npm">
    <span class="npm-badge" aria-hidden="true">npm</span>
    <code class="command">{{ command }}</code>
    <button
      class="copy-button"
      type="button"
      @click="copy"
      :aria-label="copied ? 'Command copied' : 'Copy npm install command'"
    >
      <svg
        class="copy-icon"
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14h13a2 2 0 0 0 2-2V5Zm-2 14H8V7h9v12Z"
          fill="currentColor"
        />
      </svg>
      <span class="copy-label" aria-live="polite">{{ copied ? 'Copied' : 'Copy' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const command = 'npm i -g praetorius'
const copied = ref(false)
let timeoutId: ReturnType<typeof setTimeout> | undefined

const resetCopied = () => {
  copied.value = false
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = undefined
  }
}

const copy = async () => {
  if (copied.value) {
    return
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return
  }

  try {
    await navigator.clipboard.writeText(command)
    copied.value = true
    timeoutId = setTimeout(() => {
      copied.value = false
      timeoutId = undefined
    }, 1600)
  } catch (error) {
    resetCopied()
  }
}

onBeforeUnmount(() => {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = undefined
  }
})
</script>

<style scoped>
.npm-install {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.24rem 0.5rem 0.24rem 0.4rem;
  border-radius: 2px;
  background: #fff;
  border: 2px solid #000;
  color: #000;
  font-size: 0.85rem;
  line-height: 1.2;
  margin-left: 0.3rem;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: min(380px, 30vw);
  min-width: 0;
  box-shadow: 3px 3px 0 color-mix(in srgb, oklch(0.5797 0.2296 263.44) 22%, transparent);
}

.npm-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.4rem;
  border-radius: 0.375rem;
  background: #cb3837;
  color: #fff;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.command {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  color: inherit;
  background: transparent;
  user-select: all;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 150px;
}

.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.4rem;
  border-radius: 2px;
  border: 2px solid #000;
  background: #fff;
  color: inherit;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  flex: 0 0 auto;
}

.copy-button:hover {
  background: color-mix(in srgb, oklch(0.9035 0.1796 104.9) 28%, #fff);
  border-color: #000;
}

.copy-button:focus-visible {
  outline: 2px solid oklch(0.5797 0.2296 263.44);
  outline-offset: 2px;
}

.copy-button:active {
  background: var(--vp-c-bg);
}

.copy-icon {
  width: 1rem;
  height: 1rem;
}

.copy-label {
  line-height: 1;
}

@media (max-width: 560px) {
  .npm-install {
    display: none;
  }
}

@media (max-width: 1220px) {
  .npm-install {
    max-width: min(300px, 28vw);
    gap: 0.35rem;
  }

  .command {
    flex-basis: 110px;
    font-size: 0.76rem;
  }

  .copy-button {
    padding-inline: 0.32rem;
  }
}
</style>
