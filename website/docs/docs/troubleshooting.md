# Troubleshooting

<ErrorGlossary :items="[
  {
    code:'PDF_CORS',
    title:'PDF fails to render (CORS)',
    cause:'The viewer origin cannot fetch the PDF URL.',
    fix:'Serve PDFs from the same origin or enable Access-Control-Allow-Origin.'
  },
  {
    code:'AUDIO_AUTOPLAY',
    title:'Audio does not start',
    cause:'Autoplay policies block audio until user gesture.',
    fix:'Require click to start; the viewer already exposes a play button.'
  },
  {
    code:'PDF_WORKER',
    title:'PDF worker not loading',
    cause:'Worker asset path incorrect in the host environment.',
    fix:'Use the bundled worker or set an absolute worker URL in the block.'
  },
  {
    code:'GHP_BASE',
    title:'404s on GitHub Pages',
    cause:'Deployed under subpath without base config.',
    fix:'Set VitePress base to /praetorius/.'
  },
]" />
