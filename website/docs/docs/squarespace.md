# Squarespace Embed

Praetorius runs well inside a Squarespace Code block when assets are hosted.

## Steps

1. Generate locally and host assets (GitHub Pages/CDN).
2. In Squarespace, add a **Code Block**  to your page.
3. Provide a target container and load your hosted JS/CSS.

```html
<section id="works-group"></section>
<link rel="stylesheet" href="https://your.cdn/prae/styles.css">
<script defer src="https://your.cdn/prae/app.js"></script>
```

Or single-block embed at generate time with:
```
prae generate --embed -o paste
```
Copy and paste the file contents of the generated file into your code block. 

## Formatting Considerations
– Full width, from end-to-end of viewport

– Minimal, equal-sized top/bottom spacing

– No header or footer: remove header and footer in page settings -> Advanced -> Show Header / Show Footer

– No other content on the page

### Notes

Use direct audio/PDF URLs. Host on Github and use the cdn.jsdelivr.net permalink. **Drive “viewer” links can be unreliable for big files.**

If page-follow is configured, the embedded viewer will track playback where supported.
