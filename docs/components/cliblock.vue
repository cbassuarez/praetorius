<script setup lang="ts">
import { ref } from 'vue'
type Shell = 'bash'|'zsh'|'fish'|'pwsh'
const props = defineProps<{ commands: { shell: Shell; cmd: string }[] }>()
const active = ref<Shell>(props.commands[0]?.shell ?? 'bash')
function copy(){
  const found = props.commands.find(c=>c.shell===active.value)
  if (found) navigator.clipboard.writeText(found.cmd)
}
</script>

<template>
  <div class="prae-card" style="padding:8px;">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <div>
        <button v-for="c in commands" :key="c.shell"
          :aria-pressed="active===c.shell" @click="active=c.shell"
          style="margin-right:6px;">{{ c.shell }}</button>
      </div>
      <button @click="copy">Copy</button>
    </div>
    <pre style="margin-top:8px;"><code>{{ commands.find(c=>c.shell===active)?.cmd }}</code></pre>
  </div>
</template>
