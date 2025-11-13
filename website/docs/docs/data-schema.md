<!-- website/docs/docs/data-schema.md -->
# Data Schema (JSON)

Praetorius reads a simple JSON list of works plus optional page-follow config.

## `works.json`
```json
[
  {
    "id": 3,
    "slug": "amplifications-marimbaideefixe",
    "title": "AMPLIFICATIONS I · MARIMBAideefixe",
    "one": "Two prepared pianos as resonators for a 5.0-octave marimba.",
    "audio": "https://your.cdn/audio/marimbaideefixe.mp3",
    "pdf": "https://your.cdn/pdf/marimbaideefixe.pdf",
    "cues": ["5:49", "7:22", "12:47"]
  }
]
```
### Fields

`id` (number) — stable numeric id (used in #work-id deep links)

`slug` (string) — stable, URL-safe key used by page-follow

`title` (string) — display title

`one` (string) — one-liner / teaser

`audio` (string) — direct URL to audio file (public)

`pdf` (string|null) — direct URL to PDF score (optional)

`cues` (array<string>) — times like "mm:ss" or "s" (optional)

`pageFollow` (optional)

See: [Page-Follow](https://cbassuarez.github.io/praetorius/docs/pdf-audio)


