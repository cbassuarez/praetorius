# Praetorius – Interactive Works Portfolio
interactive works portfolio, vanilla html/js


# To use as a CLI, you can call
```
npx praetorius@latest init --out dist
```

or globally install with 

```
npm i -g praetorius
```

or your favorite package handler.


# To create a works set:
*New scratch folder*
```
mkdir -p ~/prae-demo && cd ~/prae-demo
```

*Generate starter files*
```
npx praetorius@latest init --out dist
```

*See what you got*
```
ls -1 dist
```

# To create a works set:

Open dist/script.js and replace the sample with your set. Minimal fields:
```
(function(){
  const works = [
    {
      id: 1,
      slug: 'work1', // a slug identifying your work
      title: 'WORK 1 — TITLE OF WORK 1”',
      one: 'oneliner description of work 1',
      cues: [{ label: '@10:30', t: 630 }],       // seconds or mm:ss → seconds, specific cues you want your users to see
      audio: 'https://cdn.jsdelivr.net/gh/your-org/your-repo/audio/work1.mp3', // hosted on a cdn like GitHub
      pdf:   'https://cdn.jsdelivr.net/gh/your-org/your-repo/scores/work1.pdf'
      // optional: openNote: ['Para 1', 'Para 2', ...]
    },
    {
      id: 2,
      slug: 'work2',
      title: 'WORK 2 — TITLE OF WORK 2”',
      one: 'oneliner description of work 2',
      cues: [{ label: '@7:45', t: 465 }, { label: '@9:15', t: 555 }],
      audio: 'https://cdn.jsdelivr.net/gh/your-org/your-repo/audio/work2.mp3',
      pdf:   null                                  // if no score
    },
    {
      id: 3,
      slug: 'work3',
      title: 'WORK 3 — TITLE OF WORK 3',
      one: 'oneliner description of work 3',
      cues: [{ label: '@5:49', t: 349 }],
      audio: 'https://cdn.jsdelivr.net/gh/your-org/your-repo/audio/work3.mp3',
      pdf:   'https://cdn.jsdelivr.net/gh/your-org/your-repo/scores/work3.pdf'
    }
  ];

  // Expose to the page / console
  window.PRAE = window.PRAE || {};
  window.PRAE.works = works;

  console.log('[prae] starter loaded:', works.length, 'works');
})();
```
# Field notes

id: integer 1…N (used for #work-<id> deep links).

slug: short, URL-safe key (used by future page-follow + data exports).

cues: each {label, t} where t is seconds (write mm:ss → convert to seconds).

audio: use direct MP3/OGG URLs (CDN/GitHub raw/jsDelivr are fine).
Google Drive viewer links don’t stream well; use their direct uc?export=download&id=... form if you must.

pdf: direct PDF URL if available; null / omit if no score.

openNote (optional): array of paragraph strings; some skins print these in open <id>.

# Then, host the code on your site

Paste dist/styles.css into your website → Design → Custom CSS (or page CSS).
(Or host it and include as a < link >)

You now have usable css/js you can add to your site. 
