# Recipes
Praetorius is useful for cases where PDFs and audio need tight syncing, like:
- **Squarespace block on a collection page** — embed once, feed works by URL params.
- **Jury packet** — one page per movement, all deep-linked.
- **Exhibit kiosk** — touch-wall mode with operator presets.

To package a Praetorius instance:

# Quick static-site publish (GitHub Pages)
```
cd DIRECTORY
prae init
prae generate
prae preview
git add .
git commit -m "Add Praetorius works directory"
git push
```

`prae init` runs initialization wizard.

`prae generate` emits `dist/` with works based on your data (`--skin` selects wrapper/theme; `--ui-runtime` selects runtime where supported).

`prae preview` opens local preview on port 5173 from generated assets.

Switch skins without touching data
```
prae generate --skin cards-tabs
prae generate --skin cards-tabs --ui-runtime react
prae generate --skin kiosk|presentation
prae generate --skin kiosk --ui-runtime react
prae generate --skin docs-reader|docs
prae generate --skin typefolio|type
prae generate --skin typescatter
prae generate --skin vite-breeze
prae generate --skin vite-breeze --ui-runtime react
prae generate --skin default | prae generate
```

Embed fallback behavior
```
# These embed snippets always use vanilla runtime for CMS safety
prae generate --skin vite-breeze --ui-runtime react --embed
prae generate --skin cards-tabs --ui-runtime react --embed
prae generate --skin kiosk --ui-runtime react --embed
```

Global appearance presets (all output skins)
```
prae generate --skin kiosk \
  --palette orange-blue-white-silver \
  --cursor ring \
  --hover-effect balanced-neo \
  --button-effect balanced-neo

prae generate --skin cards-tabs --palette gem-diamond --cursor prism-diamond --hover-effect high-drama --button-effect high-drama
prae generate --skin vite-breeze --palette ryb-tricolor --cursor block-square --hover-effect minimal --button-effect minimal
```

Custom monochrome palette
```
# mono-one accepts HEX or OKLCH, then normalizes to OKLCH internally
prae generate --skin cards-tabs --palette mono-one --mono-color "#3355cc"
prae generate --skin kiosk --palette mono-one --mono-color "oklch(0.62 0.09 250)"
```

Console appearance behavior
```
# Console uses palette + mode only; cursor and effects are ignored with a note
prae generate --skin console --palette gem-diamond --cursor ring --hover-effect high-drama --button-effect high-drama
```

Kiosk operator menu
```
# open menu while previewing:
# - touch/click bottom-right hotspot
# - or press Cmd/Ctrl + Shift + O
```
Defaults:
- Attract: `Visual-only`
- Density: `Balanced`
- Motion: `Standard`

Minimal JSON works file
```json
[
  {
    "id": 1,
    "slug": "slug",
    "title": "title",
    "oneliner": "oneliner",
    "description": "description",
    "audio": "https://your.cdn/audio/soundnoisemusic.mp3",
    "pdf": "https://your.cdn/pdf/soundnoisemusic.pdf",
    "cover": "https://your.cdn/img/cover.jpg",
    "tags": ["quartet", "2026", "premiere"],
    "cues": ["1:00"]
  }
]
```

Add page-follow mapping to config
```json
{
  "pageFollow": {
    "soundnoisemusic": {
      "pdfStartPage": 11,
      "mediaOffsetSec": 0,
      "pageMap": [
        { "at": "0:30", "page": 1 },
        { "at": "1:00", "page": 2 }
      ]
    }
  }
}
```
See: [Page Follow](https://cbassuarez.github.io/praetorius/docs/pdf-audio)

# Squarespace embed (hosted build)
```
prae init
prae generate
prae preview
```
1. Generate site locally and host assets on Pages/CDN.
2. In Squarespace, insert a Code block and load hosted JS/CSS.
3. Provide target container:
  ```html
  <section id="works-group"></section>
  ```
See: [Squarespace Embed](https://cbassuarez.github.io/praetorius/docs/embedding)
