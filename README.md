# Praetorius — Interactive Works Console

![npm](https://img.shields.io/npm/v/praetorius?label=praetorius\&logo=npm)
![node](https://img.shields.io/badge/node-%E2%89%A5%2018-black)
![license](https://img.shields.io/badge/license-MIT-black)
![install](https://img.shields.io/badge/install-npm%20i%20-g%20praetorius)

**An interactive, artist‑made composition portfolio with robust PDF and playback support.**

Praetorius is a small, disciplined toolchain for composers, artists, educators, festivals, and universities to publish “score‑centric” works pages: synchronized audio, score PDFs with **page‑follow** (auto‑snapping to the current printed page), deep links, and a clean console‑style UI that drops into Squarespace (or any site builder) via a single code block.

> ![Example image2](https://raw.githubusercontent.com/cbassuarez/praetorius/4f7a17bbca81772543201cb7f41ef7bc2806b69f/praetorius_example_video.gif)

> the score PDF *snaps* to the correct printed page while audio plays, so evaluators aren’t lost—and you aren’t judged on secondary characteristics.

---

## Why it exists

Presenting—or judging—score‑based works on the web often collapses into:

1. the evaluator doesn’t know the score; 2) the evaluator gets lost between time and page; 3) judgments drift to secondary aesthetics. Praetorius restores **primary evidence**: *the work as score + sound*, tightly synchronized.

---

## Key features

* **PDF page‑follow**: printed page ↔︎ media time mapping (with `pdfStartPage`, `mediaOffsetSec`, and a `pageMap`).
* **Works set authoring**: a CLI wizard writes `.prae/works.json`; a generator emits paste‑ready `dist/script.js` + `dist/styles.css`.
* **Squarespace‑friendly**: paste one snippet, or host files and link—no theme collisions.
* **Deep links**: `#work-<n>?t=<sec>` for precise sharing.
* **Light | Dark theme tokens** only: predictable contrast, museum‑grade minimalism.
* **No vendor lock‑in**: plain JS/CSS; deploy anywhere.

Non‑goals: hosting your media, analytics, auth. You own your assets; Praetorius orchestrates them.

---

## How it works (architecture overview)

```
.prae/works.json  ──▶  praetorius generate  ──▶  dist/script.js + dist/styles.css
                        (optionally --embed to emit a single HTML snippet)

Your site (Squarespace/Webflow/…)
  └─ Code block loads dist/script.js (or pasted inline)
      ├─ window.PRAE.works                (works array)
      ├─ window.PRAE.pageFollowMaps       (slug→page map)
      └─ window.PRAE.ensureAudioTags()    (<audio> hydration)

main.js (your console UI)
  └─ Consumes PRAE data + drives audio + PDF.js viewer
```

* **Single source of truth**: `.prae/works.json` (schema v1).
* Optional `.prae/config.json` for defaults (theme, output flags)—see Roadmap.

---

## Quick start

### Install

```bash
# Global
npm i -g praetorius
# or one-off
npx praetorius@latest --help
```

### Initialize a project

```bash
mkdir my-portfolio && cd my-portfolio
praetorius init --out dist
```

This creates a seed `dist/script.js`, `dist/styles.css` and `.prae/works.json` if missing.

### Add works (wizard)

```bash
praetorius add
# Answer prompts for title, one-liner, audio, pdf, cues, and (optionally) page-follow mapping
```

### Generate site assets

```bash
praetorius generate --out dist
# emits dist/script.js (+ styles.css if not present)
```

### Integrate in your site

* **Squarespace**: add a **Code** block → paste `dist/script.js` (or use `--embed` to emit a single snippet). Add `dist/styles.css` to **Design → Custom CSS**.
* Any other platform (Webflow/Wix/Jekyll/etc.): include the script and CSS as you would any static assets.


---

## Data model (`.prae/works.json`)

Minimal, human‑readable schema (v1):

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
        ]
      }
    }
  ]
}
```

Fields:

* `id` (int), `slug` (string), `title` (string), `one` (string)
* `audio` (URL | null), `pdf` (URL | null)
* `cues[]` with `{ label, t }` (seconds)
* Optional `score`: `pdfStartPage` (printed p.1 → PDF page), `mediaOffsetSec` (can be negative), `pageMap[]` rows `{ at: "mm:ss"|seconds, page: int }`, optional `pdfDelta`

---

## PDF Page‑Follow (concept & practice)

**Goal**: While audio plays, the PDF viewer jumps to the correct **printed** page.

* `pdfStartPage`: the PDF page number that corresponds to **printed page 1**.
* `mediaOffsetSec`: if the recording’s bar 1 doesn’t begin at 0:00 (pre‑roll, announcements), use a positive or negative integer to align.
* `pageMap`: waypoints like `{ at: "7:49", page: 10 }` defined in **printed** page numbers.

Example mapping:

```json
{
  "pdfStartPage": 11,
  "mediaOffsetSec": 0,
  "pageMap": [
    { "at": "0:00", "page": 1 },
    { "at": "1:07", "page": 2 },
    { "at": "5:49", "page": 7 }
  ]
}
```

**Gotchas**

* Use **PDF.js viewer** URLs for reliable page navigation; plain Drive “preview” iframes don’t expose paging. Your console can wrap Drive links via a direct `uc?export=download&id=...` and pass them to PDF.js.
* Times must be monotonic; pages ≥ 1. Negative `mediaOffsetSec` is allowed.

---

## Squarespace & other platforms

**Squarespace/Wordpress (recommended workflow)**

1. Add a **Code** block to your page.
2. Paste the generated `dist/script.js` contents (or run `praetorius generate --embed` and paste the single snippet).
3. Add `dist/styles.css` in **Design → Custom CSS**.
4. Ensure your main console script (e.g., `main.js`) reads:

   ```js
   const pageFollowMaps = (window.PRAE && window.PRAE.pageFollowMaps) || {};
   // then use as you already do
   ```

**Other platforms**

* **Webflow/Wix/Framer**: add custom HTML/JS to the page and include the CSS.
* **Static/JAMStack**: copy `dist/*` into your web root and reference in your template.

**Hosting**

* Host audio/PDF on your preferred CDN; for Google Drive links, prefer direct download URLs and PDF.js for navigation.

---

## Accessibility & performance

* **ARIA**: console output uses `aria-live` for status; PDF pane and controls carry labels.
* **Keyboard**: CLI input is keyboard‑first; buttons mirror commands; Esc closes the PDF pane.
* **Color & theme**: strictly **light | dark** tokens for predictable contrast.
* **Performance**: audio is lazy‑loaded (`data-audio` → `src` on first play); PDF viewer is iframed; minimal DOM churn; no framework.
* **CSP/CORS**: allow your media/CDN origins; prefer PDF.js with a `file=` param for third‑party PDFs.

---

## Theming (light | dark only)

Praetorius keeps the visual surface neutral (black/white). The CLI will expose a `config.theme` default in a future release; for now your UI can toggle via the `data-theme` attribute (`light` | `dark`). No system/auto mode by design.

---

## Troubleshooting / FAQ

**PDF doesn’t page‑follow**

* Ensure your generated script includes `window.PRAE.pageFollowMaps` and your console reads it.
* Use PDF.js viewer URLs; Drive “preview” pages can’t be controlled.

**Google Drive audio doesn’t play**

* Convert `…/file/d/<ID>/view` → `https://drive.google.com/uc?export=download&id=<ID>`.

**CLI errors (validation)**

* Run `praetorius list` to inspect the DB.
* Times must be `mm:ss` or integers; pages ≥ 1. Slugs unique; IDs unique.

**Autoplay blocked**

* Click any Play once to unlock; the console shows a hint toast.

---

## Roadmap 

~~**Sprint 0 — Hardening**~~

~~* TDZ/runtime fixes; atomic writes (.tmp → fsync → rename) + `.bak`; dual bin (`praetorius`/`prae`); `prae doctor` (schema + duplicates).~~

~~**Sprint 1 — Core authoring**~~

~~* `edit`, `rm`, `order`, `import` (json/csv), `export` (json/csv). IDs stable; display order managed.~~

~~**Sprint 2 — Score/page‑follow**~~

~~* First‑class `score` editor/validator; preview printed→PDF mapping; strict normalization.~~

~~**Sprint 3 — Output modes**~~

~~* `--embed` single‑snippet for Squarespace; `--minify`; `--js/--css` filename control; theme light|dark only.~~

**Sprint 4 — Preview & Watch**

* Local preview server; `generate --watch` with nice logs.

**Sprint 5 — Doctor++ & URL checks**

* HEAD checks for assets; Drive normalization hints; CORS warnings; PDF.js suggestions.

**Sprint 6 — Migrations, history, undo**

* Schema migration tool; history snapshots; `undo` to last snapshot.

**Sprint 7 — CI/CD & DX**

* GitHub Actions for tests + publish on tag; snapshot/E2E tests; update‑notifier; rich `--help`.

---

## Contributing

Issues and PRs welcome: open an issue with a minimal repro (DB sample, links). Conventional commits appreciated; unit tests for time parsing and score validation are especially helpful.

## License

MIT. © Seb Suarez.

## Acknowledgements

Design and authorship: **Seb Suarez**. Built for artists and evaluators who deserve to see (and hear) the work on its own terms.
