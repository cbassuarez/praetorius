# Praetorius CLI Bridge

Lightweight HTTP server that wraps the `prae generate` CLI and serves its output to the docs site so the home / playground / builder preview iframes always render the real Praetorius runtime — including in production where there is no Vite dev server.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health`                                       | Liveness probe (also at `/`) |
| `GET`  | `/__prae_builder/health`                        | Frontend probe used by the builder before calling generate |
| `POST` | `/__prae_builder/generate`                      | Run `prae generate` against a posted project state, return `{ token, previewUrl, files, textFiles, embedHtml }` |
| `GET`  | `/__prae_builder/preview/{token}/{path}`        | Serve a file from the generated output for that session |
| `POST` | `/__prae_builder/close/{token}`                 | Drop a session and remove its tmp dir |

Sessions are kept in memory with a 30-minute TTL and lazily cleaned up on each request.

## Local dev

```bash
cd server
npm install
PORT=8787 ALLOWED_ORIGINS='http://localhost:5173,http://localhost:5174' npm start
```

Then point the docs site at it:

```bash
cd ../website
VITE_PRAE_BUILDER_API='http://localhost:8787' npm run dev
```

The Vite dev plugin is still wired up, so omitting `VITE_PRAE_BUILDER_API` keeps the in-process bridge for dev. Use the env var only when you want to mirror the production path locally.

## Render.com deploy

`render.yaml` at the repo root declares the service. The first push that includes it will let Render auto-create the service; subsequent pushes redeploy.

Required env vars on the Render service:

- `ALLOWED_ORIGINS` — comma-separated list of origins permitted to call the bridge. For GitHub Pages: `https://cbassuarez.github.io`. Add custom domains as needed. Use `*` only for testing.
- `PORT` — Render sets this automatically.

## Wiring the frontend

When the docs site is built for production, set `VITE_PRAE_BUILDER_API` so the iframe components hit the Render service instead of expecting a same-origin Vite plugin:

```yaml
# .github/workflows/deploy.yml
- name: Build VitePress
  run: npm run build
  env:
    VITE_PRAE_BUILDER_API: https://praetorius-cli-bridge.onrender.com
    DOCSEARCH_APP_ID:     ${{ secrets.DOCSEARCH_APP_ID }}
    # ...
```

The frontend code reads it at build time. If it's empty/unset, the components fall back to a same-origin path (`/__prae_builder/...`), which is what the Vite dev plugin handles.

## Operational notes

- Free Render web services sleep after ~15 minutes of inactivity. The first request after sleep takes ~30s while the service spins back up — the iframe components will sit on a loading state for that long. Upgrade to a paid plan for instant warm starts.
- Generated output lives in `os.tmpdir()` inside the container's ephemeral filesystem. No persistent disk is needed.
- The CLI run has a 60 second timeout. Heavier projects will need a higher timeout — adjust `CLI_TIMEOUT_MS` in `handler.mjs`.
- The handler limits posted JSON bodies to 4 MB.
