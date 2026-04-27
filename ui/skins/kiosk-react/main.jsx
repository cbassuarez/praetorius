import React from 'react';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'framer-motion';
import '../kiosk/main.js';

function RuntimeMarker() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      id="kiosk-react-runtime-marker"
      data-runtime="react"
      aria-hidden="true"
      style={{
        position: 'fixed',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clipPath: 'inset(50%)',
        pointerEvents: 'none'
      }}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.12 }}
    />
  );
}

(function bootReactRuntime() {
  const node = document.createElement('div');
  node.id = 'kiosk-react-runtime-root';
  node.setAttribute('hidden', '');
  document.body.appendChild(node);
  const root = createRoot(node);
  root.render(<RuntimeMarker />);
})();
