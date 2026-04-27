# Skins

Pick a skin at generate time. You can switch anytime without changing data.

| Skin          | Best for                   | Highlight                                             | Alias        |
|---------------|----------------------------|-------------------------------------------------------|--------------|
| `typefolio`   | editorial / portfolio      | Right-hand PDF preview                                | type         |
| `kiosk`       | gallery / installation     | Touch-wall tiles + hidden operator menu               | presentation |
| `docs-reader` | documentation / webpage    | Long-form reading + docs navigation                   | docs         |
| `cards-tabs`  | expressive portfolio IA    | Neo-brutal board + inspector tabs + action rail       |              |
| `typescatter` | type-forward cards         | Interactive scatter/grid layout                       |              |
| `vite-breeze` | atmospheric portfolio      | Artistic cards + integrated HUD + score pane          |              |
| `default`     | neutral baseline           | Minimal surface                                       |              |

```bash
prae generate --skin typefolio
prae generate --skin typescatter
prae generate --skin vite-breeze
prae generate --skin vite-breeze --ui-runtime react
prae generate --skin cards-tabs
prae generate --skin cards-tabs --ui-runtime react
prae generate --skin kiosk
prae generate --skin kiosk --ui-runtime react
prae generate
```

React runtime is available for `vite-breeze`, `cards-tabs`, `kiosk`, and `docs-reader`:
- `--ui-runtime vanilla` (default)
- `--ui-runtime react` (bundled app runtime)

`--embed` always falls back to vanilla runtime for those four skins for CMS safety.

Docs Reader supports Markdown-first pages plus optional frontmatter modules:
- `hero`: `kicker`, `title`, `lede`
- `modules[]`:
  - `score` (`pdf` required, optional `audio`, `cues`, `pageFollow`)
  - `media` (`items[]` with `src`, `alt`, optional `caption`, optional `layout`)
  - `process` (`steps[]` with titles and optional markdown bodies/media)
  - `credits` (`roles[]` with collaborator lists)

Global appearance options are available across `vite-breeze`, `cards-tabs`, and `kiosk` (both runtimes):
- `--palette ryb-tricolor|mono-bw|mono-one|gem-diamond|orange-blue-white-silver`
- `--cursor system|block-square|ring|prism-diamond`
- `--hover-effect minimal|balanced-neo|high-drama`
- `--button-effect minimal|balanced-neo|high-drama`
- `--mono-color <hex|oklch>` for `mono-one` custom monochrome base

Theme toggle behavior remains mode-only (`light`/`dark`) within the selected palette.
For `console`, palette + mode apply to text styling only; cursor/effect presets are ignored.

Branding system v1:
- Standardized footer attribution uses one shared lockup system across skins/runtimes.
- Attribution is default-on and controlled by `ui.branding.attribution.enabled`.
- Official npm/GitHub callouts are first-party components (no Shields image dependency).
- Press assets and lockup usage rules are available at [Press Kit](/press/).

Kiosk operator defaults:
- Attract: `Visual-only`
- Density: `Balanced`
- Motion: `Standard`
- Menu access: bottom-right hotspot or `Cmd/Ctrl + Shift + O`

See also: [Recipes](https://cbassuarez.github.io/praetorius/docs/recipes)
