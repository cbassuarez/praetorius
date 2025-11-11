# Praetorius — Interactive Works Console

![npm](https://img.shields.io/npm/v/praetorius?label=praetorius\&logo=npm)
![license](https://img.shields.io/badge/license-MIT-black)
![install](https://img.shields.io/badge/install-npm%20i%20-g%20praetorius)

<!-- (Optional) add a Node badge if you want to declare a minimum runtime -->

**An interactive, artist-made composition portfolio with robust PDF and playback support.**

Praetorius is a small, disciplined toolchain for composers, artists, educators, festivals, and universities to publish “score-centric” works pages: synchronized audio, score PDFs with **page-follow** (auto-snapping to the current printed page), deep links, and clean UIs that drop into Squarespace (or any site builder) via a single code block. 

> ![Example image2](https://raw.githubusercontent.com/cbassuarez/praetorius/4f7a17bbca81772543201cb7f41ef7bc2806b69f/praetorius_example_video.gif)
> the score PDF *snaps* to the correct printed page while audio plays, so evaluators aren’t lost—and you aren’t judged on secondary characteristics.

---

## Why it exists

Presenting—or judging—score-based works on the web often collapses into: (1) the evaluator doesn’t know the score; (2) they get lost between time and page; (3) judgments drift to secondary aesthetics. Praetorius restores primary evidence: *the work as score + sound*, tightly synchronized.

---

## What it does

* **PDF page-follow**: printed page ↔︎ media-time mapping.
* **Works set authoring**: a wizard writes your DB; a generator emits paste-ready assets.
* **Squarespace-friendly**: paste one snippet or host the assets—no theme collisions. 
* **Deep links**: link straight to a work, with an optional start time.
* **Light/Dark**: strict tokens for predictable contrast.

**Non-goals:** hosting your media, analytics, auth. You own your assets; Praetorius orchestrates them.

---

## Quick start

### 1) Install

```bash
# Global (recommended for authoring)
npm i -g praetorius

# Or one-off
npx praetorius@latest --help
```

### 2) Initialize a project

```bash
mkdir my-portfolio && cd my-portfolio
prae init --out dist
```

This seeds `.prae/works.json` (if missing) and a minimal `dist/` scaffold you can paste or host.

### 3) Add works (guided)

```bash
prae add
# Answer prompts for title, one-liner, audio, pdf, cues, and (optionally) page-follow mapping
```

### 4) Generate assets

```bash
# default skin = console
prae generate --out dist

# pick a specific skin
prae generate --skin console       --out dist
prae generate --skin vite-breeze   --out dist
prae generate --skin docs-reader   --out dist
prae generate --skin cards-tabs    --out dist
prae generate --skin kiosk         --out dist
prae generate --skin typefolio     --out dist
prae generate --skin typescatter   --out dist

# single pasteable snippet (for a Code block)
prae generate --embed > embed.html
```

### 5) Integrate in your site

* **Squarespace (and similar):** add a Code block and paste the embed *or* include the generated JS/CSS you’re hosting. This is the intended workflow; it avoids theme collisions. 
* **Static/JAMStack (any host):** copy `dist/*` and reference in your template.
* **PDF viewing:** use the PDF.js viewer (`?file=<url>`) for reliable page navigation; Drive “preview” iframes don’t expose page control—see PDF Page-Follow below. 

---

## Data model (`.prae/works.json`)

Minimal, human-readable schema:

```json
{
  "version": 1,
  "works": [
    {
      "id": 1,
      "slug": "soundnoisemusic",
      "title": "String Quartet No. 2 — SOUNDNOISEMUSIC",
      "one": "A through-composed/indeterminate quartet…",
      "audio": "https://…/audio.mp3",
      "pdf": "https://…/score.pdf",
      "cues": [ { "label": "@10:30", "t": 630 } ],
      "score": {
        "pdfStartPage": 11,
        "mediaOffsetSec": 0,
        "pageMap": [
          { "at": "0:30", "page": 1 },
          { "at": "1:00", "page": 2 }
        ],
        "pdfDelta": 0
      }
    }
  ]
}
```

**Notes**

* `id` (int), `slug`, `title`, `one` (short one-liner).
* `audio` (URL or null), `pdf` (URL or null).
* `cues[]` may be `{ label, t }` (seconds) or `@mm:ss`.
* `score` holds printed→PDF mapping: see next section.

---

## PDF Page-Follow (concept & practice)

**Goal:** While audio plays, the PDF viewer jumps to the correct printed page.

* `pdfStartPage`: the PDF page number that corresponds to printed page **1**.
* `mediaOffsetSec`: if the recording’s bar 1 doesn’t start at 0:00 (pre-roll, announcements), offset can be positive *or negative*.
* `pageMap`: waypoints like `{ at: "7:49", page: 10 }` defined in printed page numbers.
* Optional `pdfDelta`: adjust all computed PDF page numbers by a constant.

---

## Skins
> ![Example_gif_2](https://raw.githubusercontent.com/cbassuarez/praetorius/a7242056a07f669dcaf6f22b632e352199e009cd/praetorius_example_video_typefolio.gif)
Praetorius renders the same data across different skins. Choose one at generate time with `--skin`. (You can regenerate in another skin at any time—your data stays the same.)

| Skin                | Summary (one-liner)                                  |
| ------------------- | ---------------------------------------------------- |
| `console` (default) | Terminal-style console/takeover UX with commands.    |
| `vite-breeze`       | Modern “liquid glass” portfolio UI.                  |
| `docs-reader`       | Reader layout for long-form notes + preview.         |
| `cards-tabs`        | Card grid with tabbed details.                       |
| `kiosk`             | Fullscreen, minimal, for exhibitions or on-site use. |
| `typefolio`         | Editorial spread with a live preview pane.           |
| `typescatter`       | Free-form/scatter presentation with focus on titles. |

> See the `ui/` directory in the repo for each skin’s source and templates. (Skins currently listed in the repo include at least `vite-breeze`, `docs-reader`, `cards-tabs`, `kiosk`; additional skins here reflect the current codebase you’re generating with.) 

---

## CLI reference

All commands are available via `praetorius` or its short alias `prae`.

* `prae init [--out dist]` — create seed files (`.prae/works.json`, minimal output).
* `prae add` — add a new work (guided prompts).
* `prae edit` — edit an existing work (by id/slug; guided).
* `prae rm` — remove a work.
* `prae order` — reorder display order.
* `prae list` — print current DB for inspection.
* `prae import <file.(json|csv)>` — import works.
* `prae export [--format json|csv]` — export works.
* `prae generate [--skin <name>] [--out dist] [--embed]` — emit assets/snippet.
* `prae doctor` — validate schema, mapping, and links; print actionable guidance.
  *(Doctor++ checks are implemented; use this when something feels off.)*

> Authoring is intended to be host-agnostic: generate static assets (`dist/*`) or a single `--embed` snippet you paste into a site builder. 

---

## Embedding & hosting

* **Squarespace/WordPress/Webflow/etc.:** paste the embed or include your hosted `script.js`/`styles.css`. This avoids theme collisions and works anywhere a Code/HTML block is allowed. 
* **PDF hosting:** prefer your own origin (or a CDN you control). When using Google Drive, convert links as noted under PDF Page-Follow.

---

## Deep linking

You can link directly to a work section (e.g., `#work-<slug>`) and optionally include a start time query (e.g., `?t=630` for 10:30). Your UI can read these on load and activate the correct section + seek the audio.

---

## Accessibility & performance

* **ARIA:** preview/hud announce via `aria-live`; controls are labeled.
* **Keyboard:** arrow keys to change selection; Esc closes drawers.
* **Performance:** audio loads lazily; PDF viewer is iframed to isolate work.
* **Color:** strict light/dark tokens for predictable contrast.

---

## Troubleshooting

**404s for `style.css`/`main.js` (during dev or embed testing)**
If you see `GET http://localhost:5173/style.css 404` or similar, you’re pointing at a dev server that isn’t running or a path that doesn’t exist in production. When embedding, either paste `--embed` output directly or host `dist/*` on your site and reference those hosted URLs.

**PDF page-follow doesn’t work**
Use **cdn-hosted links** URL with a proper `file=` parameter (not a Drive “preview” URL). Verify your `score` mapping is monotonic (i.e. times increasing; pages ≥ 1). 


---

## Contributing

Issues and PRs welcome—open an issue with a minimal repro (DB sample, links). Unit tests for time parsing and score validation are especially helpful.

## License

MIT. © Seb Suarez.
