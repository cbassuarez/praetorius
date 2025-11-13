# Squarespace Embed

Praetorius runs well inside a Squarespace code block when assets are hosted.

## Steps

1. Generate locally and host assets (GitHub Pages/CDN).
2. In Squarespace, add a **Code block** to your page.
3. Provide a target container and load your hosted JS/CSS.

```html
<section id="works-group"></section>
<link rel="stylesheet" href="https://your.cdn/prae/styles.css">
<script defer src="https://your.cdn/prae/app.js"></script>
```

## Notes

Use direct audio/PDF URLs. Host on Github and use the cdn.jsdelivr.net permalink. **Drive “viewer” links can be unreliable for big files.**

If page-follow is configured, the embedded viewer will track playback where supported.
