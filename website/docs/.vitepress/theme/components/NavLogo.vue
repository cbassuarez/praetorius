<template>
  <!-- wrapper keeps hover scope tight to the brand icon -->
  <span class="wb-brand" aria-hidden="true">
    <!-- ↓↓↓ Paste this SVG markup VERBATIM (do not alter attributes) ↓↓↓ -->
    <svg class="wb-orbit" viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" focusable="false">
      <g class="iris-rot" stroke="#0f0f0f" stroke-width="1.4" fill="none"
         stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
        <circle class="iris-ring" cx="32" cy="32" r="20"/>
        <circle class="iris-pupil" cx="32" cy="32" r="5"/>
        <g class="iris-blades" shape-rendering="geometricPrecision">
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32"/>
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32" transform="rotate(60 32 32)"/>
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32" transform="rotate(120 32 32)"/>
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32" transform="rotate(180 32 32)"/>
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32" transform="rotate(240 32 32)"/>
          <path class="blade" d="M32 18 C38 23, 42 27, 44 32" transform="rotate(300 32 32)"/>
        </g>
      </g>
    </svg>
    <!-- ↑↑↑ EXACTLY as in your snippet ↑↑↑ -->
  </span>
</template>

<script setup>
// no logic; pure decorative brand glyph
</script>

<style scoped>
.wb-orbit{ display:block; }
.wb-orbit .iris-rot{ transform-origin:32px 32px; }
.wb-orbit .iris-pupil{ transform-origin:32px 32px; transition: transform .35s ease; }
.wb-orbit .blade{ stroke-dasharray:4 8; }

/* Hover animations: subtle rotation + dash shimmer + slight pupil dilation */
.wb-brand:hover .wb-orbit .iris-rot{ animation: iris-tilt 2.6s ease-in-out infinite; }
.wb-brand:hover .wb-orbit .blade{ animation: iris-dash 1.8s linear infinite; }
.wb-brand:hover .wb-orbit .iris-pupil{ transform: scale(1.12); }

@keyframes iris-tilt{
  0%{   transform: rotate(-6deg); }
  50%{  transform: rotate(6deg);  }
  100%{ transform: rotate(-6deg); }
}
@keyframes iris-dash{
  to { stroke-dashoffset: -20; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce){
  .wb-brand:hover .wb-orbit .iris-rot,
  .wb-brand:hover .wb-orbit .blade,
  .wb-brand:hover .wb-orbit .iris-pupil{
    animation:none !important;
    transform:none !important;
  }
}
</style>
