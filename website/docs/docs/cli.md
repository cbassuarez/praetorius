# CLI Reference

- `prae init` — scaffold a project.
- `prae generate --skin <name> [--ui-runtime vanilla|react] [--palette <name>] [--cursor <preset>] [--hover-effect <preset>] [--button-effect <preset>] [--mono-color <hex|oklch>]` — build a works block.
- `prae generate --embed` — emit a single CMS snippet.
- `prae import / export` — move data in/out.
- `prae doctor` — validate works data.

Runtime notes:
- React runtime currently supports: `vite-breeze`, `cards-tabs`, `kiosk`, `docs-reader`.
- For those skins, `--embed` always falls back to vanilla output (with a console note).

Docs Reader notes:
- `.prae/docs.json` supports `search.engine: auto|light|fuse|none`.
- `auto` is default and selects lightweight vs fuzzy indexing based on docs size.
- Markdown frontmatter supports `hero` and typed `modules[]` (`score`, `media`, `process`, `credits`).

Appearance notes:
- Default palette: `orange-blue-white-silver`.
- Palette choices: `ryb-tricolor`, `mono-bw`, `mono-one`, `gem-diamond`, `orange-blue-white-silver`.
- Cursor choices: `system`, `block-square`, `ring`, `prism-diamond`.
- Hover/button effect choices: `minimal`, `balanced-neo`, `high-drama`.
- `--mono-color` is used with `--palette mono-one` (HEX or OKLCH input; normalized to stored OKLCH).
- `console` skin applies palette + mode only and ignores cursor/effect presets.

Branding notes:
- Global attribution config: `ui.branding.attribution.enabled` (default `true`).
- `prae site` includes an explicit “Show Powered by Praetorius” toggle.
- Backward compatibility: legacy `site.showBadge === false` is normalized to `ui.branding.attribution.enabled = false`.
- Generated HTML now includes skin-agnostic branding markers:
  - `data-brand-system=\"praetorius-v1\"`
  - `data-brand-attribution=\"on|off\"`

See also: [Recipes](/docs/recipes) and [Troubleshooting](/docs/troubleshooting).
