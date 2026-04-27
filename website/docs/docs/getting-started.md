# Install & First Page  <SinceBadge since="v0.2.0" />

<CLIBlock :commands="[
  { shell:'bash', cmd:'npm i -g praetorius' },
  { shell:'zsh',  cmd:'npm i -g praetorius' },
  { shell:'fish', cmd:'npm i -g praetorius' },
  { shell:'pwsh', cmd:'npm i -g praetorius' }
]" />

```bash
prae init
prae generate --skin typefolio
```

Your generated output lands in `dist/` by default.

Common next commands:

```bash
# Switch skin + runtime
prae generate --skin cards-tabs --ui-runtime react

# Try the global appearance system
prae generate --skin vite-breeze --palette ryb-tricolor --cursor prism-diamond --hover-effect balanced-neo --button-effect balanced-neo

# Emit an embed-safe snippet
prae generate --skin docs-reader --embed
```

For visual tuning without local setup, use the [Playground](/playground) and [Folio Builder](/builder).
