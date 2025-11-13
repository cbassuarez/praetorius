# Recipes
Praetorius is useful for a wide variety of cases where PDFs and audio need to be synced, like:
- **Squarespace block on a collection page** — embed once, feed works by URL params.
- **Jury packet** — one page per movement, all deep-linked.
- **Exhibit kiosk** — Console skin in full-screen mode, page-follow off.

To that end, you may package a Praetorius instance in your works as such:

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

`Prae init` runs an initialization CLI wizard.

`Prae generate` generates a dist/ directory and populate it with works based on your input (optional --skin modifier changes the wrapper/theme). 

`Prae preview` generates opens a local preview on port 5173 from the bundled dist/. 


*Then enable GitHub Pages for your repo (branch + /docs or your chosen folder).*

Switch skins without touching data
```
prae generate --skin cards-tabs
prae generate --skin kiosk|presentation
prae generate --skin docs-reader|docs
prae generate --skin typefolio|type
prae generate --skin typescatter
prae generate --skin vite-breeze
prae generate --skin default | prae generate
```

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
    "cues": ["1:00"]
  }
]
```
*Add page-follow mapping to your config*
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
See: [Page Follow](docs/page-follow)

# Squarespace embed (hosted build)
```
prae init
prae generate
prae preview
```
1. Generate site locally, host assets on Pages/CDN.
2. In Squarespace, insert a Code block and load your hosted JS/CSS.
3. Provide a target container:
  ```html
  <section id="works-group"></section>
  ```
See: [Squarespace Embed](docs/squarespace)
