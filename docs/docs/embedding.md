# Embedding (Squarespace & Static)

## Squarespace (single code block)
1. Paste the generated HTML/JS block from `prae generate`.
2. Ensure the **PDF worker** path is accessible (PDF.js is bundled in the block).
3. If you see a blank panel, check **Script Settings** → allow custom script and **disable AMP** on that page.

## Static hosts
- GitHub Pages / Cloudflare Pages / Netlify: copy the generated files; ensure asset paths are relative.
- If deploying under a subpath, set your base URL accordingly.

## Troubleshooting (common)
- **PDF CORS** — host PDFs on the same origin, or ensure `Access-Control-Allow-Origin: *`.
- **Autoplay** — browsers may block; require a user click to start audio.
- **Base path 404** — on GitHub Pages project sites, set VitePress `base: '/praetorius/'`.
