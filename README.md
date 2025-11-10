# Praetorius — portfolio-first SPA generator. Render your works list, pick a skin, ship.

Praetorius turns the canonical `window.PRAE.works` list into a synchronized portfolio SPA with HUD, PDF,
and theme glue that stays consistent across skins.

## Table of Contents
- [Key principles](#key-principles)
- [Quick Start](#quick-start)
- [Skins overview](#skins-overview)
- [Works list contract (PRAE.works)](#works-list-contract-praeworks)
- [Theming & Tokens](#theming--tokens)
- [PDF + HUD](#pdf--hud)
- [Accessibility](#accessibility)
- [CLI reference](#cli-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Key principles
- Single source of truth: populate `window.PRAE.works`; the CLI never fabricates projects.
- Skins are just views: each skin renders the same works list with shared controls and actions.
- PDF + HUD glue is preserved across skins so playback, cues, and score panes stay in sync.
- Theming: light/dark via CSS tokens, ESM modules with `defer`, and no Web Animations API claims.
- Accessibility: keyboard and touch friendly layouts, ≥44px targets, and reduced-motion respect.

## Quick Start
### Requirements
- Node.js >= 18.17 (see `package.json` engines).

### Install & generate
```bash
npm i -g praetorius
prae generate
prae generate --skin docs-reader
prae generate --skin cards-tabs
prae generate --skin kiosk
```

### Outputs & theme toggle
- Runtime bundle: `dist/script.js` + `dist/styles.css`.
- UI skin bundle: `dist/app.js` + `dist/app.css` (`docs-reader` emits `dist/style.css`).
- Generated markup: `dist/index.html` with linked assets and `data-skin` metadata.
- Toggle light/dark using the built-in `#wc-theme-toggle` control exposed in every skin.

## Skins overview
### [vite-breeze](ui/skins/vite-breeze/) — Liquid Glass split layout
- Split shell keeps works on the left and the PDF pane docked on the right.
- HUD, nav, and badge live in a translucent Liquid Glass treatment with responsive spacing.
- Works list cards expose Play, PDF, Copy, and Open actions inline.
- PDF pane stays on page with close button and respects HUD playback updates.
- Theme toggle animates the Liquid Glass palette without breaking focus indicators.

**Use for:** elegant web portfolios where adjudicators can audition works while following scores on-page.

### [docs-reader](ui/skins/docs-reader/) — spacious documentation reader
- Left navigation rail with collapsible groups and persistent state.
- Right-side outline mirrors headings; copy buttons land on each fence with clipboard helpers.
- Search box focuses with `/`, returns instant results, and announces matches via ARIA.
- Works-derived hero and integrations keep HUD, PDF pane, and console hooks intact.
- Drawer controls adapt the layout for tablets while respecting touch targets.

**Use for:** tutorials, how-it-works guides, and works documentation that needs prose plus interactive cues.

### [cards-tabs](ui/skins/cards-tabs/) — portfolio dashboard
- Masonry-like card grid on the left summarizes each work with cues and actions.
- Right column hosts tabbed panels for Details, Cues, Playback, and Score (ARIA-managed tabs).
- Built-in PDF dialog mirrors Vite Breeze controls with backdrop and close affordances.
- Summary column surfaces site metadata, updated date, and navigation from `.prae/config.json`.
- Theme toggle and HUD controls stay pinned above the layout for quick context.

**Use for:** at-a-glance browsing with dedicated panels for playback and score follow-up per selection.

### [kiosk](ui/skins/kiosk/) — touch-first presentation
- Oversized tiles in the kiosk grid highlight key works with minimal chrome.
- Dedicated control rail offers fullscreen toggle, mute/play, and PDF launch with large hit areas.
- Detail view expands selected works with cues, actions, and HUD status.
- PDF modal mirrors other skins to keep the HUD/PDF handshake intact.
- Navigation and theme toggle meet ≥44px touch guidelines for gallery installs.

**Use for:** touchscreen kiosks, gallery presentations, juried demos, and classroom show-and-tell setups.

All skins: Play / PDF / Copy / Open actions behave consistently and update the global HUD/PDF pane.
Skins never fabricate data—everything derives from `window.PRAE.works`.

## Works list contract (PRAE.works)
- Array at `window.PRAE.works` with objects containing:
  - `id` (integer) — stable identity used for deep links.
  - `slug` (string) — unique slug for URLs and hashing.
  - `title` (string) — display name.
  - `one` (string) — one-liner description.
  - Optional `audio` (URL) — streaming audio source.
  - Optional `pdf` (URL) — score PDF target (PDF.js viewer recommended).
  - Optional `cues[]` — `{ label, t }` pairs for playback markers (seconds or parsed from CLI).
  - Optional `score` — `{ pdfStartPage, mediaOffsetSec, pdfDelta?, pageMap[] }` for page-follow.
- The CLI also seeds `window.PRAE.worksById`, HUD bindings, and helper methods used by skins.
- Deep links: skins may sync selection or tabs via `location.hash` (e.g., `#work=<id>&tab=playback`);
  check each skin template for exact keys.

## Theming & Tokens
- Global helpers `window.praeApplyTheme` and `window.praeCurrentTheme` drive theme changes.
- Skins read and set `body[data-theme]` / `.prae-theme-*` classes using CSS tokens for colors.
- Output bundle includes `dist/app.js` (skin logic) and `dist/app.css` (or `dist/style.css`) alongside
  the runtime `script.js` to keep theme code modular.
- Use the `#wc-theme-toggle` button; skins wire it up with ESM `type="module"` scripts plus `defer`.
- Prefer CSS transitions; Praetorius does not rely on the Web Animations API and respects
  `prefers-reduced-motion`.

## PDF + HUD
- HUD lives at `#wc-hud` and surfaces now-playing metadata, scrub meter, and playback toggles.
- PDF panes reuse shared markup (`vb-pdfpane` classes) so skins inherit the same controls.
- Works with Mozilla PDF viewer URLs or other PDF endpoints that allow direct linking.
- CLI injects HUD + PDF hooks into generated HTML; skins reuse them instead of reimplementing.

## Accessibility
- Keyboard navigation covers nav drawers, tablists, and PDF dialogs with ARIA attributes wired in.
- Focus outlines stay visible in both themes; buttons meet or exceed 44px hit areas.
- Reduced motion preferences are honored in theme transitions and kiosk animations.
- Copy buttons, search results, and PDF dialogs announce changes via live regions where relevant.

## CLI reference
- `prae generate` — build runtime bundle and optional UI assets using configured skin.
- `prae generate --skin <name>` — override skin (`vite-breeze`, `docs-reader`, `cards-tabs`, `kiosk`).
- `prae skin list` — list built-in skins, aliases, and summaries.
- `prae site` (alias: `prae config`) — wizard for site chrome (name, subtitle, nav, updated date).
- `prae docs` — Docs Reader wizard for content IA, search, assets, and Works integration.

### Examples
```bash
# Generate with default skin
prae generate

# Generate with a specific skin
prae generate --skin vite-breeze
prae generate --skin docs-reader
prae generate --skin cards-tabs
prae generate --skin kiosk

# Tip: deep-link a work or tab in supported skins by URL hash
# (actual hash keys depend on the skin; see this README)
```

## Troubleshooting
- Empty UI: ensure `.prae/works.json` populates `window.PRAE.works`; missing data renders no cards.
- Disabled actions: audio or PDF buttons turn off when the corresponding URL is absent or invalid.
- Theme button missing: confirm your template retains `#wc-theme-toggle`.
- PDF not opening: verify the URL is reachable and compatible with your PDF viewer or Drive mapping.

## Contributing
- Follow conventional commits; documentation-only updates are welcome via focused PRs.
- Run lint/format for docs if applicable and keep markdown lint friendly (no trailing whitespace).
- Skins must not fabricate or mutate works data—always consume `window.PRAE.works` and helpers.

## License
MIT — see [LICENSE](LICENSE).
