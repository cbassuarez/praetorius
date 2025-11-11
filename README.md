# Praetorius — portfolio-first SPA generator

Praetorius — portfolio-first SPA generator. Render your works list, pick a skin, ship.

## Table of contents
- [Key principles](#key-principles)
- [Quick Start](#quick-start)
- [Skins overview](#skins-overview)
- [Works list contract (PRAEworks)](#works-list-contract-praeworks)
- [Theming & Tokens](#theming--tokens)
- [PDF + HUD](#pdf--hud)
- [Accessibility](#accessibility)
- [CLI reference (concise)](#cli-reference-concise)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Key principles
- **Single source of truth:** `window.PRAE.works` drives every skin. No mock data.
- **Skins are views:** each skin renders the same works list and HUD/PDF primitives.
- **PDF + HUD glue:** the global HUD and PDF pane stay wired across skins.
- **Theming:** light/dark via CSS tokens; ESM + `defer`; no WAAPI claims.
- **Accessibility:** keyboard/touch parity, ≥44px targets, reduced-motion respected.

## Quick Start
### Requirements
- Node.js ≥ 18.17 (per [`package.json`](package.json)).

### Install
```bash
npm i -g praetorius
```

### Generate
```bash
prae generate
prae generate --skin vite-breeze
prae generate --skin docs-reader
prae generate --skin cards-tabs
prae generate --skin kiosk
```

### Outputs
- `dist/script.js` and `dist/styles.css` mirror your `window.PRAE.works` data.
- UI bundles land beside them: `dist/app.js` plus `dist/app.css` (or `dist/style.css` for `docs-reader`).
- `dist/index.html` (or your specified template) links the generated assets.
- Toggle light/dark from the shared button `#wc-theme-toggle` embedded in each skin.

## Skins overview
All skins expose Play / PDF / Copy / Open actions that update the global HUD and PDF pane consistently.

### [vite-breeze](ui/skins/vite-breeze/)
- Liquid Glass split layout with works on the left and a PDF pane on the right.
- HUD stays pinned at the top with transport + now playing metadata.
- Works cards emphasize imagery, cues, and quick actions.
- Built-in PDF pane follows playback using your page maps.
- Use for: elegant web portfolios with on-page score viewing.

### [docs-reader](ui/skins/docs-reader/) (alias: `docs`)
- Spacious documentation shell with left navigation and right outline.
- Search focuses the input on `/` and highlights matches inline.
- Code fences include copy affordances and optional language tabs.
- Outline syncs to scroll and the works hero surfaces featured projects.
- Use for: tutorials and "how it works" narratives about your works.

### [cards-tabs](ui/skins/cards-tabs/) (alias: `dashboard`)
- Dashboard skin: cards summarize works; tabs reveal cues, playback, and score panes.
- Right-side detail rail keeps media controls and PDF together.
- Global HUD + PDF toggles mirror the card selection.
- Supports deep-linking tabs for quick sharing of focus views.
- Use for: at-a-glance browsing with focused detail panels.

### [kiosk](ui/skins/kiosk/) (alias: `presentation`)
- Oversized tiles and buttons tuned for touch screens and gallery installs.
- Minimal chrome keeps attention on works imagery and cues.
- One-tap fullscreen toggle and swipe-friendly controls.
- HUD and PDF buttons stretch to ≥44px for kiosks.
- Use for: live demos, touch-first presentations, and installations.

## Works list contract (PRAE.works)
Skins read the works array seeded via `window.PRAE.works`. Common fields:
- `id` (integer identifier).
- `slug` (stable string used for hashes and lookup).
- `title` (display name).
- `one` (legacy single-line summary alias; kept in sync for compatibility).
- `oneliner` (optional) — single-line (~160 char) blurb for compact/tile views. Markdown is stripped; newlines collapse. Legacy `one` is accepted on ingest and normalized to this field.
- `description` (optional) — Markdown body for program notes, shown in detailed views.
- `cues` (optional) — array of `{ t, label }` where `t` is seconds.
- `audio` (optional) — URL or `null` for playback.
- `pdf` (optional) — URL or `null` for score viewing.
- `score` (optional) — include `pdfStartPage`, `mediaOffsetSec`, `pageMap[]`, and optional
  `pdfDelta` for page-follow.

Praetorius normalizes each work via `normalizeWork` to expose `onelinerEffective` and `descriptionEffective`.
Supplying both `oneliner` and `one` is tolerated; the newer field wins and a warning is emitted so you can clean up legacy data.
Skins always read these computed fields, so legacy projects that only provide `description` render identically to earlier releases.

Run `prae validate` anytime to confirm schema compliance and catch narrative warnings (e.g., long
oneliners or accidental line breaks).

Deep links: some skins sync selection and tabs into the URL hash (e.g.,
`#work=<id>&tab=playback`). The exact keys are skin-specific—inspect each skin template when you
need to wire custom routing.

## Theming & Tokens
- `praeApplyTheme(mode, opts)` and `praeCurrentTheme()` are exposed globally by the skins.
- Body/theme tokens live on `body[data-theme]` or the equivalent class; generated CSS
  (`dist/app.css` or `dist/style.css`) applies light/dark palettes.
- Toggle via the shared `#wc-theme-toggle` control; skins call into the helpers so theme changes
  propagate consistently.
- Animations rely on CSS transitions only. Reduced-motion preferences short-circuit transitions.
- ESM bundles ship with `<script type="module" defer>`; no Web Animations API assumptions.

## PDF + HUD
- The global HUD (`#wc-hud`) announces the current work, progress bar, and transport state.
- The PDF pane reuses a single viewer element so skins avoid duplicating embeds.
- Mozilla's PDF.js viewer is supported when you supply a compatible URL; fallback iframes
  respect the same IDs.
- Skins wire the HUD buttons to the shared playback APIs exposed in `window.PRAE`.
- Page-follow maps derived from your works JSON drive automatic page jumps.

## Accessibility
- Keyboard support covers navigation, playback controls, and dialog toggles across skins.
- Tabs and accordions expose proper ARIA attributes (e.g., `role="tablist"`, `aria-selected`).
- Touch targets meet or exceed 44px sizing—including kiosk HUD buttons.
- Contrast tokens are tuned for light and dark variants; check your accent colors for WCAG compliance.
- Motion-sensitive flows respect `prefers-reduced-motion` and disable nonessential transitions.

## CLI reference (concise)
```bash
prae generate
prae generate --skin <name>
prae skin list
prae validate
```

Supported skin flags: `vite-breeze`, `docs-reader` (`docs`), `cards-tabs` (`dashboard`),
`kiosk` (`presentation`).

Examples:
```bash
# Generate with default skin
prae generate

# Generate with a specific skin
prae generate --skin vite-breeze
prae generate --skin docs-reader
prae generate --skin cards-tabs
prae generate --skin kiosk

# Tip: deep-link a work or tab in supported skins by URL hash
# (actual hash keys depend on the skin; see README)
```

## Troubleshooting
- Empty page? Ensure `window.PRAE.works` is populated—missing data yields an empty works list.
- Disabled audio or PDF buttons? Provide valid `audio`/`pdf` URLs per work; absent values disable the
  action gracefully.
- Theme toggle missing? Confirm your template includes `#wc-theme-toggle` or wire one via the
  exported helpers.
- PDF not opening? Verify the URL is reachable and compatible with PDF.js (e.g., Google Drive
  `uc?export=download` links).
- CLI import hiccups? Install optional deps (`csv-parse`, `yaml`, `esbuild`) when prompted.

## Contributing
- Follow conventional commits; docs-only changes use the `docs:` scope.
- Keep skins honest: they must never fabricate works—everything flows from `window.PRAE.works`.
- Update documentation alongside CLI strings to keep help and README aligned.
- Run linting/tests as needed (`npm run test`) before submitting PRs.

## License
[MIT](LICENSE)
