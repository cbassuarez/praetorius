# Page-Follow (PDF-Audio sync)

Sync the PDF viewer to playback by mapping **printed page** numbers to times.

```json
{
  "pageFollow": {
    "soundnoisemusic": {
      "pdfStartPage": 11,
      "mediaOffsetSec": 0,
      "pageMap": [
        { "at": "0:30", "page": 1 },
        { "at": "1:00", "page": 2 },
        { "at": "1:35", "page": 3 },
        { "at": "2:00", "page": 4 }
      ]
    }
  }
}
```
## Keys

`pdfStartPage` — PDF page index where printed p.1 begins.

`mediaOffsetSec` — shift if printed p.1 should align before/after 0:00.

`pageMap` — ordered list of { at, page } where at is "mm:ss" or seconds.

## Tips:

– Prefer hosting PDFs where PDF.js can fetch with CORS.

– If you want to shift the entire audio track over to start at *n* seconds instead of 0s (silence at track start, e.g.), set mediaOffsetSec to a positive value *n*.
