# Troubleshooting

## Node version
Praetorius requires **Node ≥ 18.17**. Check with:
```bash
node -v
```
## Audio won’t play or stalls
– Use direct media URLs that accept range requests (CDN/Pages).

*Large Google Drive files may throttle; prefer a CDN or GitHub Releases.*

## Autoplay blocked
– Browsers may block first play. Click any Play action once, then retry.

## PDF doesn’t follow pages
– Use the PDF.js viewer (skins select it automatically for page-follow cases).

– Confirm your Page-Follow mapping and pdfStartPage.

## Deep links don’t jump
– Ensure the hash is #work-N and optional time query ?t=SECONDS, e.g. `#work-1?t=90`

## CORS or 403 on media
– Host audio/PDF on the same origin as your site or a public CDN that permits cross-origin reads.
