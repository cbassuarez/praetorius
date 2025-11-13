# Deploy

## GitHub Pages (project site)

1. Commit your generated site (e.g., `/docs`).
2. GitHub → **Settings** → **Pages** → select branch + folder → **Save**.
3. Wait for the green check; visit the Pages URL.

```bash
git add .
git commit -m "Publish works page"
git push
```

## Media hosting

Same-origin or a public CDN (range-request friendly) works best.

For large audio, use GitHub Releases or a CDN bucket.

Any static host: upload the generated output to Netlify, Cloudflare Pages, or your preferred static host.
