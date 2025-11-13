function W(f) {
  return f == null ? "" : String(f);
}
function vt(f) {
  const a = W(f);
  return a ? a.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim() : "";
}
function yt(f) {
  let a = W(f);
  return a ? (a = a.replace(/```[\s\S]*?```/g, " "), a = a.replace(/`[^`]*`/g, " "), a = a.replace(/!\[[^\]]*\]\([^)]*\)/g, ""), a = a.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"), a = a.replace(/^#{1,6}\s*/gm, ""), a = a.replace(/^>\s?/gm, ""), a = a.replace(/([*_~]{1,3})([^*_~]+)\1/g, "$2"), a = a.replace(/<[^>]+>/g, " "), a.replace(/\s+/g, " ").trim()) : "";
}
function kt(f, a) {
  if (!f) return "";
  if (f.length <= a) return f;
  const u = f.slice(0, Math.max(0, a - 1)).replace(/\s+\S*$/, "").trim();
  return u.length >= a - 1 ? `${u}…` : `${f.slice(0, a - 1).trim()}…`;
}
function Et(f) {
  if (!f) return "";
  const a = yt(f);
  if (!a) return "";
  const c = a.match(/(.+?[.!?])(?=\s|$)/);
  let u = c ? c[1] : a;
  if (!c) {
    const E = u.indexOf(`
`);
    E >= 0 && (u = u.slice(0, E));
  }
  return u = u.replace(/\s+/g, " ").trim(), u ? kt(u, 160) : "";
}
function Nt(f = {}) {
  const a = f || {}, c = { ...a }, u = a.oneliner ?? a.one ?? "", E = W(u);
  let g = vt(E).trim();
  const d = E.trim().length > 0, U = (p) => {
    if (p == null) return "";
    let l;
    return Array.isArray(p) ? l = p.map((T) => W(T).replace(/\r\n?/g, `
`).trim()).filter(Boolean).join(`

`) : l = W(p), l = l.replace(/\r\n?/g, `
`).trim(), l ? (l = l.replace(/\n{3,}/g, `

`), l = l.replace(/[ \t]{2,}/g, " "), l) : "";
  }, J = [
    "description",
    "desc",
    "program",
    "programNote",
    "programNotes",
    "notes",
    "body",
    "text",
    "copy"
  ];
  let w = "", $ = null;
  for (const p of J) {
    const l = U(a[p]);
    if (l) {
      w = l, $ = p;
      break;
    }
  }
  !g && !d && w && (g = Et(w) || "");
  let y = !1;
  const A = (p) => p.replace(/\s+/g, " ").trim().toLowerCase();
  if (w) {
    const p = w.split(/\n{2,}/).map((l) => l.trim()).find(Boolean) || w.split(/\n+/).map((l) => l.trim()).find(Boolean) || "";
    p && g && A(p) === A(g) && (g = "", y = !0);
  } else g && (w = "");
  if (d && g ? c.oneliner = g : "oneliner" in c && delete c.oneliner, g ? c.one = g : "one" in c && delete c.one, w ? c.description = w : "description" in c && delete c.description, g || (g = null), w || (w = null), typeof window < "u" && window && window.__PRAE_DEBUG)
    try {
      const p = window.console && window.console.debug ? window.console.debug : window.console?.log;
      p && p("[prae] normalizeWork", {
        descriptionField: $,
        dedupedOneliner: y
      });
    } catch {
    }
  return {
    ...c,
    onelinerEffective: g || null,
    descriptionEffective: w || null
  };
}
(function() {
  if (typeof document > "u") return;
  const a = document.head || document.querySelector("head");
  if (!a || a.querySelector('link[rel="icon"]')) return;
  const c = document.createElement("link");
  c.setAttribute("rel", "icon"), c.setAttribute("type", "image/svg+xml"), c.setAttribute("href", 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Ccircle cx="8" cy="8" r="7" fill="%23f97316"/%3E%3C/svg%3E'), a.appendChild(c);
})();
(function() {
  function a() {
    try {
      var c = document.getElementById("works-group"), u = localStorage.getItem("wc.theme");
      if (u && u.trim().charAt(0) === "{")
        try {
          u = (JSON.parse(u) || {}).mode || "dark";
        } catch {
          u = "dark";
        }
      var E = u === "light" ? "light" : "dark";
      c && (c.removeAttribute("data-theme-mode"), c.setAttribute("data-theme", E)), document.documentElement.style.colorScheme = "light dark";
    } catch {
    }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", a, { once: !0 }) : a();
})();
function $t() {
  (() => {
    const f = document.getElementById("works-group") || document, a = (e, t = f) => t.querySelector(e), c = a("#works-console .wc-output"), u = a("#wc-cmd"), E = a("#works-console .wc-input"), g = a("#works-console"), d = {
      1: {
        id: 1,
        slug: "soundnoisemusic",
        title: "WORK 1 — String Quartet No. 2 “SOUNDNOISEMUSIC”",
        oneliner: "A through-composed/indeterminate quartet that alternates fixed score, structured mischief, and noise permissions.",
        cues: [{ label: "@10:30", t: x("10:30") }],
        audioId: "wc-a1",
        pdf: "https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/STRING%20QUARTET%20NO.%202%20_soundnoisemusic_%20-%20Score-min.pdf",
        openNote: [
          " ",
          "Heard melodies are sweet, but those unheard",
          "Are sweeter; therefore, ye soft pipes, play on;",
          "Not to the sensual ear, but, more endeared,",
          "Pipe to the spirit ditties of no tone:",
          "John Keats, “Ode on a Grecian Urn,” lines 11-14",
          " ",
          "Every other performance, this piece is entirely improvised. Every other performance, the performers follow the through-composed score. Every other other performance, this piece is played at 80% intent and 50% rsentment. Every other other other performance, the members of this piece trade parts. Every 10 performanes, the members of the ensemble are playing a cruel joke on the composer and the audience. Every 12, the 5th page of every part is swapped for a page from one of J.S. Bach’s Sonatas or Partitas for Violin. On any performance where it is the ensemble’s second time performing that day, the music is to be read in retrograde inversion. Every peformance indoors must be done at double tempo. In the event that performers were not fed prior to performing, they may play noise whenever they may choose. If ███████████████████████████████████████, the piece should be played in near-complete darkness.",
          " ",
          "If you cannot tell the difference if you cannot beat ‘em join ‘em then does it even matter?"
        ]
      },
      2: {
        id: 2,
        slug: "lux-nova",
        title: "WORK 2 — Organum Quadruplum “Lux Nova”",
        oneliner: "A stained-glass acoustics study: bowed dalle-de-verre slab transduced into a ring of pianos—polyphony by distance rather than shared air.",
        cues: [{ label: "@7:45", t: x("7:45") }, { label: "@9:15", t: x("9:15") }],
        audioId: "wc-a2",
        pdf: null,
        openNote: [
          " ",
          "There is a special quality to the kind of light that stained glass emanates which I find fascinating. Unlike traditional art, stained glass is an entanglement of light and material: the art is not the light, nor the glass, but the way the light conditions the space beyond which it occupies (a material declaration reminiscent of Fichtian dialectics or medieval anagogy; a sum greater than its parts). In this sense, it is not reflecting light but conditioning it, giving light a quality that makes its invisibilities visible.",
          " ",
          "Abbot Suger, in a historical reaffirmation of Gothic architecture, described this phenomenon – light passing through glass, which gives body and boundary to the invisible – as lux nova. Medieval builders saw themselves as material theologians: with the technological advancements of the Gothic period allowing for great windows, they could materialize theological truths through illuminatio, making light itself into an art that “corresponds” to celestial œuvres.",
          " ",
          "At the center is a dalle de verre slab, mounted to approximate free-free boundary conditions: edge-untethered, supported at nodal points, so the plate speaks in families of modes. As the bow excites the glass (in a lineage that runs from Suger’s Saint-Denis and its program of lux nova to Le Corbusier’s Notre-Dame du Haut with its deep-set colored glazing to Richter’s pixelated Cologne Cathedral window), the bow draws breath, a sort of pneuma. These sounds are transmitted via transducer speakers to a ring of pianos which, even without hammer action, perform as a sort of telephoned organum: polyphony carried at a distance by transduction rather than shared air. In this way, the pianos act as armature and tracery, structures that bind."
        ]
      },
      3: {
        id: 3,
        slug: "amplifications-marimbaideefixe",
        title: "WORK 3 — AMPLIFICATIONS I · MARIMBAideefixe",
        oneliner: "Two prepared pianos as resonators for a 5.0-octave marimba: sympathetic “ghost ensemble” via transduction.",
        cues: [{ label: "@5:49", t: x("5:49") }],
        audioId: "wc-a3",
        pdf: "https://cdn.jsdelivr.net/gh/cbassuarez/website-blog/AMPLIFICATIONS%201.%20MARIMBAideefixe.pdf",
        openNote: [
          " ",
          "AMPLIFICATIONS – a series of improvised compositions, utilizing multiple pianos as resonating bodies to extend the sustain of various instruments. with various metal implements scattered throughout the piano bodies, the strings sympathetically reverberate along to the improvisatory sounds of each instrument, at times a whisper, at times a roar. microphones are placed inside the body of the piano capturing a large, harmonious reverberation, a ghostly chamber ensemble of one. credits released October 16, 2023 marimba, viola da gamba, music box, multiple percussion, desk bells, sebastian suarez-solis audio, sebastian suarez-solis photo, sebastian suarez-solis recorded at California Institute of the Arts on Oct. 13-15, 2023. ",
          " ",
          "MARIMBAideefixe – 2 prepared pianos + 5.0 octave marimba with the marimba, i found that the pianos were quite receptive to many of the notes and harmonies i would play. even though the marimba is tuned to 442, or maybe because of it, notes would pop out and rattle metal discs and bells inside the piano, sometimes the same note, sometimes a more distant one. the marimba makes the pianos roar, swell to life, a sort of homunculus, a marionette. a bell swirls around inside the body of the piano, providing a rounded, tumbling ostinato. a ghostly chamber ensemble. i describe the track as an idée fixe as the main motivating phrase is such a focus of my playing. the piano seems to like it very well. a note about barlines: This piece is constructed in two voices which move independently. For this reason, barlines are modified to preserve the nature of the voices. You will see that, often, barlines do not match up until the end of a phrase. This might make more sense when listening to the recording. Visually, it aims to help the performer notice distance, silence, and the space between instances, where more traditional notation may not. The phrases played, though disjunct, are imitations of a baroque style, extemporized in a baroque fashion."
        ]
      }
    };
    Object.keys(d).forEach((e) => {
      const t = d[e];
      Array.isArray(t.cues) ? t.cues = t.cues.map(et) : t.cues = [], d[e] = Nt(t);
    });
    const U = {
      soundnoisemusic: {
        pdfStartPage: 11,
        // printed p.1 is PDF page 11
        mediaOffsetSec: 0,
        // set to -30 if you want page 1 at t=0
        pageMap: [
          { at: "0:30", page: 1 },
          { at: "1:00", page: 2 },
          { at: "1:35", page: 3 },
          { at: "2:00", page: 4 },
          { at: "2:48", page: 5 },
          { at: "4:03", page: 6 },
          { at: "4:35", page: 7 },
          { at: "4:52", page: 8 },
          { at: "5:29", page: 9 },
          { at: "5:56", page: 10 },
          { at: "6:12", page: 11 },
          { at: "6:28", page: 12 },
          { at: "7:54", page: 13 },
          { at: "8:39", page: 14 },
          { at: "9:44", page: 15 },
          { at: "10:30", page: 16 }
        ]
      },
      "amplifications-marimbaideefixe": {
        pdfStartPage: 7,
        // printed p.1 is PDF page 7
        mediaOffsetSec: 0,
        pageMap: [
          { at: "0:00", page: 1 },
          { at: "1:07", page: 2 },
          { at: "2:13", page: 3 },
          { at: "3:33", page: 4 },
          { at: "4:17", page: 5 },
          { at: "5:01", page: 6 },
          { at: "5:49", page: 7 },
          { at: "6:44", page: 8 },
          { at: "7:22", page: 9 },
          { at: "7:49", page: 10 },
          { at: "8:39", page: 11 },
          { at: "9:45", page: 12 },
          { at: "10:39", page: 13 },
          { at: "12:01", page: 14 },
          { at: "12:47", page: 15 },
          { at: "13:56", page: 16 },
          { at: "15:04", page: 17 },
          { at: "15:44", page: 18 },
          { at: "16:42", page: 19 },
          { at: "18:40", page: 20 }
        ]
      }
      // work 2 has no score → no entry needed
    }, J = ["help", "list", "open", "play", "pause", "stop", "copy", "goto", "pdf", "vol", "speed", "resume", "share", "unlock", "clear", "theme"], w = { h: "help", ls: "list", o: "open", p: "play", pa: "pause", st: "stop", cp: "copy", g: "goto", v: "vol", sp: "speed", rs: "resume", sh: "share", ul: "unlock", cls: "clear", th: "theme" }, $ = [];
    let y = 0, A = null, D = !1;
    const h = {
      last: { n: null, at: 0 },
      vol: 1,
      rate: 1
    };
    ee(), R("list", !0), Q(!0), ne(), requestAnimationFrame(V), requestAnimationFrame(() => {
      c.scrollTop = 0;
    }), window.addEventListener("load", () => {
      c.scrollTop = 0;
    }, { once: !0 }), E.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = u.value.trim();
      if (!t) {
        R(""), u.value = "";
        return;
      }
      D = !0, R(t, !0), $.push(t), y = $.length, p(t), u.value = "";
    }), u.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" && y > 0 && (y--, u.value = $[y] || "", Ee(), e.preventDefault()), e.key === "ArrowDown" && y < $.length && (y++, u.value = $[y] || "", Ee(), e.preventDefault()), e.key === "c" && e.ctrlKey && (i("^C", "muted", !0), u.value = "", e.preventDefault()), e.key === "l" && e.ctrlKey && (ye(), ee(), R("list", !0), Q(!0), u.value = "", e.preventDefault()), e.key === "Tab") {
        e.preventDefault();
        const t = u.value.trim().split(/\s+/), n = t[0] || "", r = Object.keys(w).concat(J).filter((s) => s.startsWith(n));
        r.length === 1 && (t[0] = ke(r[0]), u.value = t.join(" ") + " ");
      }
    }), g && g.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t || !g.contains(t)) return;
      if (t.classList.contains("js-play")) {
        const o = ve(t);
        if (o == null) return;
        te(`play ${o}`);
        return;
      }
      if (t.classList.contains("js-playat")) {
        const o = ve(t);
        if (o == null) return;
        const r = rt(t);
        te(`play ${o} ${r}`);
        return;
      }
      const n = t.getAttribute("data-cmd");
      n && te(n);
    });
    function p(e) {
      const t = e.trim().split(/\s+/);
      let n = ke(t.shift()?.toLowerCase() || "");
      const o = t;
      switch (n) {
        case "help":
          Pe();
          break;
        case "list":
          Q();
          break;
        case "open":
          ue(o[0]);
          break;
        case "play":
          de(o);
          break;
        case "pause":
          Oe(o[0]);
          break;
        case "stop":
          Fe(o[0]);
          break;
        case "copy":
          Be(o.join(" "));
          break;
        // allow time
        case "goto":
          De(o.join(" "));
          break;
        // allow time
        case "pdf":
          Re(o[0]);
          break;
        case "vol":
          We(o[0]);
          break;
        case "speed":
          Ue(o[0]);
          break;
        case "resume":
          He(o[0]);
          break;
        case "share":
          Ke(o[0], o[1]);
          break;
        case "unlock":
          Ge();
          break;
        case "theme":
          bt(o);
          break;
        case "clear":
          ye(), ee();
          break;
        default:
          n ? i(`error: unknown command "${n}"`, "err", !0) : i("", "", !0);
      }
    }
    let l = { audio: null, slug: null, lastPrinted: null, _on: null };
    function T(e, t = 0) {
      const n = U[e];
      if (!n) return 1;
      const o = ce(n, t);
      return (n.pdfStartPage || 1) + (o - 1) + (n.pdfDelta ?? 0);
    }
    function Ae(e) {
      return typeof e == "number" ? e : x(e);
    }
    function ce(e, t) {
      const n = (t || 0) + (e.mediaOffsetSec || 0);
      let o = e.pageMap[0]?.page ?? 1;
      for (const r of e.pageMap) {
        const s = Ae(r.at);
        if (n >= s) o = r.page;
        else break;
      }
      return o;
    }
    function le() {
      l.audio && l._on && (l.audio.removeEventListener("timeupdate", l._on), l.audio.removeEventListener("seeking", l._on)), l = { audio: null, slug: null, lastPrinted: null, _on: null };
    }
    function Te(e, t) {
      le();
      const n = U[e];
      if (!n || !t) return;
      const o = () => {
        const r = ce(n, t.currentTime || 0);
        if (r !== l.lastPrinted) {
          l.lastPrinted = r;
          const s = T(e, t.currentTime || 0);
          try {
            console.debug("[pagefollow]", { slug: e, printed: r, pdfPage: s, t: t.currentTime | 0 });
          } catch {
          }
          window.dispatchEvent(new CustomEvent("wc:pdf-goto", {
            detail: { slug: e, printedPage: r, pdfPage: s }
          }));
        }
      };
      l = { audio: t, slug: e, lastPrinted: null, _on: o }, t.addEventListener("timeupdate", o, { passive: !0 }), t.addEventListener("seeking", o, { passive: !0 }), o();
    }
    function Pe() {
      H("Commands"), Ve([
        "help                   Show this help",
        "list                   List the three works with actions",
        "open <n>               Print program note for work n",
        "play <n> [mm:ss|s]     Play work n at time (defaults to first cue)",
        "pause <n>              Pause work n",
        "stop <n>               Stop work n",
        "copy <n> [time]        Copy deep link (supports ?t=)",
        "goto <n> [time]        Jump to #work-n (supports ?t=)",
        "pdf <n>                Open PDF for work n (1 & 3 only)",
        "vol <0–100>            Set volume percent",
        "speed <0.5–2>          Set playback rate",
        "resume [n]             Resume last (or specific) work",
        "share <n> [time]       Share/copy deep link (supports ?t=)",
        "unlock                 One-shot autoplay unlock",
        "clear                  Clear console",
        "",
        "aliases: h, ls, o, p, pa, st, cp, g, v, sp, rs, sh, ul, cls"
      ], "muted", 12);
    }
    function Q(e = !1) {
      H(" "), Object.values(d).map((n, o) => {
        const r = document.createElement("div");
        r.className = "row";
        const s = Qe(n, o);
        return r.dataset.workIndex = String(s), r.appendChild(Je([
          at(`[${n.id}] ${n.title}`),
          it(n.onelinerEffective || "", "one"),
          ge([
            S(`open ${n.id}`, "Open"),
            ...we(n, s),
            S(`copy ${n.id}`, "Copy URL"),
            ...n.pdf ? [S(`pdf ${n.id}`, "PDF")] : []
          ], s)
        ], s)), r;
      }).forEach((n, o) => setTimeout(() => {
        c.appendChild(n), st(n), K();
      }, o * 30));
    }
    function ue(e) {
      const t = parseInt(e, 10), n = d[t];
      if (!n)
        return i(`error: unknown work ${e}`, "err", !0);
      H(n.title), n.openNote.forEach((r, s) => setTimeout(() => i(r, "", !0), s * 18));
      const o = ge([
        ...we(n, n.id),
        S(`copy ${n.id}`, "Copy URL"),
        ...n.pdf ? [S(`pdf ${n.id}`, "PDF")] : []
      ], n.id);
      c.appendChild(o), F(o), K();
    }
    function de(e) {
      const t = parseInt(e[0], 10), n = d[t];
      if (!n)
        return i(`error: unknown work ${e[0] || ""}`, "err", !0);
      const o = e[1] ? x(e[1]) : n.cues[0]?.t ?? 0;
      if (o < 0)
        return i(`error: invalid time "${e[1] || ""}" (use mm:ss or seconds)`, "err", !0);
      const r = a("#" + n.audioId);
      if (!r) return i("error: audio element missing", "err", !0);
      if (!r.src) {
        const m = r.dataset.audio || "", v = $e(m);
        if (!v)
          return i("warn: no audio source found", "warn", !0);
        r.src = v, r.load();
      }
      const s = () => {
        try {
          r.currentTime = o;
        } catch {
        }
        Me(r, t, o);
      };
      if (r.readyState >= 1)
        s();
      else {
        const m = () => {
          r.removeEventListener("loadedmetadata", m), s();
        };
        r.addEventListener("loadedmetadata", m);
      }
    }
    function Me(e, t, n) {
      typeof Ne == "function" && Ne(e);
      const o = e.play();
      o && typeof o.catch == "function" && o.catch((r) => {
        if ((r && r.name || "") === "NotAllowedError")
          i("warn: autoplay blocked; press play once in the browser", "warn", !0), gt("Autoplay blocked — click any Play action once, then retry.");
        else {
          const m = dt(e);
          i(`error: could not start playback (${m})`, "err", !0), ut(e.src) && i('hint: Google Drive viewer links must be converted to direct "uc?export=download" links. This console auto-rewrites, but very large files may still require re-hosting.', "muted", !0);
        }
      }), h.last = { n: t, at: n || 0 }, ft(t), N(t, e), Te(d[t].slug, e), _e(t), i(`playing [${t}] at ${L(n)} ▷`, "", !0);
    }
    function Oe(e) {
      const t = parseInt(e, 10), n = d[t];
      if (!n) return i(`error: unknown work ${e}`, "err", !0);
      const o = a("#" + n.audioId);
      o && !o.paused ? (o.pause(), h.last = { n: t, at: o.currentTime || 0 }, N(t, o), i(`paused [${t}] at ${L(o.currentTime | 0)} ❚❚`, "", !0)) : i(`paused [${t}]`, "muted", !0);
    }
    function Fe(e) {
      const t = parseInt(e, 10), n = d[t];
      if (!n) return i(`error: unknown work ${e}`, "err", !0);
      const o = a("#" + n.audioId);
      o && (o.pause(), o.currentTime = 0), h.last = { n: t, at: 0 }, pt(), le(), i(`stopped [${t}] ⏹`, "", !0);
    }
    function Be(e) {
      const t = (e ?? "").toString().trim().split(/\s+/), n = parseInt(t[0] || "", 10), o = t[1];
      return ht(n, o);
    }
    function De(e) {
      const t = (e ?? "").toString().trim().split(/\s+/), n = parseInt(t[0] || "", 10);
      if (!d[n]) return i(`error: unknown work ${t[0] || ""}`, "err", !0);
      const o = oe(t[1]);
      location.hash = `#work-${n}${o ? `?t=${o}` : ""}`, i(`goto #work-${n}${o ? `?t=${o}` : ""}`, "ok", !0);
    }
    function Re(e) {
      const t = parseInt(e, 10);
      if (!e)
        return i("error: pdf requires a work number (1 or 3)", "err", !0);
      const n = d[t];
      if (!n)
        return i(`error: unknown work ${e}`, "err", !0);
      if (!n.pdf)
        return i(`error: no PDF available for work ${t}`, "err", !0);
      fe(n.pdf, n.title || `Work ${t}`);
      const { n: o } = lt();
      o != null && o !== t && de([String(t)]);
    }
    const b = document.getElementById("works-console"), Y = b.querySelector(".wc-pdfpane"), qe = b.querySelector(".wc-pdf-title"), P = b.querySelector(".wc-pdf-frame"), me = b.querySelector(".wc-pdf-close");
    let M = null, O = null, X = !1;
    window.addEventListener("wc:pdf-goto", (e) => {
      const { slug: t, pdfPage: n } = e.detail || {};
      if (!(!P || !n)) {
        if (!b.classList.contains("has-pdf") || t && t !== O || !X) {
          M = { slug: t, pdfPage: n };
          return;
        }
        pe(n);
      }
    }), P.addEventListener("load", () => {
      X = !0, M && (!M.slug || M.slug === O) && (pe(M.pdfPage), M = null);
    });
    function pe(e) {
      const t = P.src || "";
      if (/\/viewer\.html/i.test(t)) {
        const n = new URL(t, location.href), o = new URLSearchParams(n.hash.replace(/^#/, "")), r = Number(o.get("page") || "1"), s = Number(e);
        if (r === s) return;
        o.set("page", String(s)), o.has("zoom") || o.set("zoom", "page-width"), n.hash = "#" + o.toString(), P.src = n.toString();
      }
    }
    function fe(e, t) {
      const n = ze(e), o = je(n);
      qe.textContent = String(t || "Score");
      const r = /^https?:\/\//i.test(o) ? o : "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.9.179/web/viewer.html?file=" + encodeURIComponent(o);
      let s = 1;
      const m = Object.values(d).find((k) => k.pdf === e);
      O = m ? m.slug : null, b.dataset.pdfSlug = O || "", m && l?.slug === m.slug ? s = T(m.slug, l.audio?.currentTime || 0) : m ? s = T(m.slug, 0) : l?.slug && (s = T(l.slug, l.audio?.currentTime || 0));
      const v = r.split("#")[0];
      X = !1, P.src = `${v}#page=${Math.max(1, s)}&zoom=page-width&toolbar=0`, b.classList.add("has-pdf"), Y.setAttribute("aria-hidden", "false"), ne(), i(`opening ${t}…`, "muted", !0), l && typeof l._on == "function" && (l.lastPrinted = null, l._on()), j(8);
    }
    function Z() {
      Y.setAttribute("aria-hidden", "true"), b.classList.remove("has-pdf"), O = null, delete b.dataset.pdfSlug, j(8), setTimeout(() => {
        P.src = "about:blank";
      }, 160), ne();
    }
    function _e(e) {
      const t = d[e];
      if (!t) return;
      const n = b.classList.contains("has-pdf");
      if (!t.pdf) {
        Z();
        return;
      }
      n && O === t.slug || fe(t.pdf, t.title || `Work ${e}`);
    }
    me && (me.addEventListener("click", Z), document.addEventListener("keydown", (e) => {
      e.key === "Escape" && b.classList.contains("has-pdf") && Z();
    }, { passive: !0 })), Y.addEventListener("transitionend", (e) => {
      (e.propertyName === "width" || e.propertyName === "max-width" || e.propertyName === "transform" || e.propertyName === "opacity") && j(4);
    }, { passive: !0 }), new MutationObserver(() => j(4)).observe(b, { attributes: !0, attributeFilter: ["class"] });
    function je(e) {
      const t = e.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
      if (t) {
        const r = `https://drive.google.com/uc?export=download&id=${t[1]}`;
        return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(r)}#page=1&zoom=page-width&toolbar=0`;
      }
      const n = e.startsWith(location.origin), o = /^https?:\/\/([^\/]*\.)?(jsdelivr\.net|unpkg\.com|githubusercontent\.com|cloudflare-ipfs\.com|stagedevices\.com|dexdsl\.org|cbassuarez\.com)\//i.test(e);
      return n || o ? `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(e)}#page=1&zoom=page-width&toolbar=0` : `${e}#toolbar=1&view=FitH`;
    }
    function ze(e) {
      if (!e) return "";
      const t = e.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
      return t ? `https://drive.google.com/file/d/${t[1]}/view?usp=drivesdk` : e;
    }
    function We(e) {
      const t = Math.max(0, Math.min(100, parseInt(e ?? "100", 10)));
      h.vol = t / 100, Object.values(d).forEach((o) => {
        const r = document.getElementById(o.audioId);
        r && (r.volume = h.vol);
      }), i(`volume ${t}%`, "ok", !0);
      const n = h.last.n ? document.getElementById(d[h.last.n].audioId) : null;
      N(h.last.n, n);
    }
    function Ue(e) {
      const t = Math.max(0.5, Math.min(2, parseFloat(e ?? "1") || 1));
      h.rate = t, Object.values(d).forEach((o) => {
        const r = document.getElementById(o.audioId);
        r && (r.playbackRate = h.rate);
      }), i(`speed ${t.toFixed(2)}x`, "ok", !0);
      const n = h.last.n ? document.getElementById(d[h.last.n].audioId) : null;
      N(h.last.n, n);
    }
    function He(e) {
      const t = e ? parseInt(e, 10) : h.last.n || null;
      if (!t || !d[t]) return i("error: nothing to resume", "err", !0);
      const n = h.last.at || 0;
      p(`play ${t} ${L(n | 0)}`);
    }
    function Ke(e, t) {
      const n = parseInt(e, 10);
      if (!d[n]) return i(`error: unknown work ${e}`, "err", !0);
      const o = oe(t), r = Ie(n, o);
      navigator.share ? navigator.share({ title: d[n].title, url: r }).then(
        () => i("shared", "ok", !0),
        () => i(r, "muted", !0)
      ) : (navigator.clipboard && navigator.clipboard.writeText(r), i(r, "ok", !0));
    }
    function Ge() {
      const e = Object.values(d).map((o) => document.getElementById(o.audioId)).filter(Boolean);
      let t = !1;
      const n = (o) => new Promise((r) => {
        const s = o.volume;
        o.volume = 0;
        const m = o.src || $e(o.dataset.audio || "");
        !o.src && m && (o.src = m, o.load()), o.play().then(() => {
          o.pause(), o.volume = s, r();
        }).catch(() => {
          o.volume = s, r();
        });
      });
      (async () => {
        for (const o of e)
          await n(o), t = !0;
        i(t ? "audio unlocked" : "nothing to unlock", "ok", !0);
      })();
    }
    function ee() {
      H("Praetorius – Interactive Portfolio v0.1"), i("Click an action or type a command.", "muted", !0), i("Type help for more options", "muted", !0), i(" ", "muted", !0);
    }
    function R(e, t = !1) {
      const n = document.createElement("div");
      n.className = "line cmd-echo", n.innerHTML = `<span class="prompt" style="color:var(--accent);font-weight:700">$</span><span class="sp"></span>${ct(e)}`, c.appendChild(n), F(n), K();
    }
    function H(e) {
      he();
      const t = C("div", "line title");
      t.textContent = e, c.appendChild(t), F(t), he();
    }
    function Ve(e, t = "", n = 10) {
      e.forEach((o, r) => setTimeout(() => i(o, t, !0), r * n));
    }
    function i(e, t = "", n = !1) {
      const o = C("div", "line" + (t ? " " + t : ""));
      o.textContent = e, c.appendChild(o), n && F(o), K();
    }
    function he() {
      const e = C("div", "divider");
      c.appendChild(e);
    }
    function S(e, t, n = {}) {
      const o = document.createElement("button");
      o.type = "button";
      const r = n.className ? ` ${n.className}` : "";
      o.className = `btn${r}`, e && o.setAttribute("data-cmd", e);
      const s = n.ariaLabel || (e ? `${t} (${e})` : t);
      s && o.setAttribute("aria-label", s), o.textContent = t;
      const m = n.dataset || {};
      return Object.entries(m).forEach(([v, k]) => {
        k != null && (o.dataset[v] = String(k));
      }), o;
    }
    function ge(e, t) {
      const n = C("div", "actions");
      return t != null && (n.dataset.workIndex = String(t)), e.forEach((o) => n.appendChild(o)), n;
    }
    function Je(e, t) {
      const n = C("div", "blk");
      return t != null && (n.dataset.workIndex = String(t)), e.forEach((o) => n.appendChild(o)), n;
    }
    function Qe(e, t) {
      const n = Number(e?.id);
      return Number.isInteger(n) && n >= 1 ? n : Number.isInteger(t) ? t + 1 : 1;
    }
    function we(e, t) {
      const n = [Ye(t)];
      return (Array.isArray(e?.cues) ? e.cues : []).forEach((r) => {
        n.push(Xe(r, t));
      }), n;
    }
    function Ye(e) {
      return S(null, "Play", {
        className: "js-play",
        ariaLabel: `Play work ${e}`,
        dataset: { workIndex: e, seconds: 0 }
      });
    }
    function Xe(e, t) {
      const n = { workIndex: t };
      if (Object.assign(n, Ze(e)), n.seconds != null) {
        const m = Math.max(0, Math.floor(Number(n.seconds)));
        n.seconds = m;
      }
      const o = Number(n.seconds), r = Number.isFinite(o) ? Math.max(0, o) : null, s = typeof e?.label == "string" && e.label.trim() ? e.label.trim() : r != null ? `@${L(Math.floor(r))}` : "@0:00";
      return S(null, `Play ${s}`, {
        className: "js-playat",
        ariaLabel: `Play ${s}`,
        dataset: n
      });
    }
    function Ze(e) {
      const t = {}, n = [e?.t, e?.seconds, e?.at, e?.time];
      let o = "";
      for (const r of n) {
        if (r == null || r === "") continue;
        const s = be(r);
        if (Number.isFinite(s))
          return t.seconds = Math.max(0, Math.floor(s)), t;
        if (!o) {
          const m = tt(r);
          m && (o = m);
        }
      }
      return o && (t.mmss = o), t;
    }
    function et(e) {
      const t = typeof e == "object" && e !== null ? { ...e } : { at: e }, n = [t.t, t.seconds, t.at, t.time];
      let o = NaN;
      for (const r of n)
        if (o = be(r), Number.isFinite(o)) break;
      if (Number.isFinite(o)) {
        const r = Math.max(0, o);
        t.t = r, t.seconds = r, (!t.label || !String(t.label).trim()) && (t.label = `@${L(Math.floor(r))}`);
      }
      return t;
    }
    function be(e) {
      if (e == null || e === "") return NaN;
      if (typeof e == "number") return Number.isFinite(e) ? e : NaN;
      const t = String(e).trim();
      if (!t) return NaN;
      if (/^-?\d+$/.test(t)) return Number(t);
      const n = t.match(/^(-?\d+):([0-5]?\d)$/);
      if (!n) return NaN;
      const o = Number(n[1]), r = Number(n[2]);
      return !Number.isFinite(o) || !Number.isFinite(r) ? NaN : o * 60 + r;
    }
    function tt(e) {
      if (e == null || e === "") return "";
      const n = String(e).trim().match(/^(\d+):([0-5]?\d)$/);
      if (!n) return "";
      const o = String(Number(n[1])), r = n[2].padStart(2, "0");
      return `${o}:${r}`;
    }
    function ve(e) {
      if (!e) return null;
      if (e.dataset.workIndex != null) {
        const n = Number(e.dataset.workIndex);
        return Number.isInteger(n) && n >= 1 ? n : (console.warn("Invalid data-work-index on console action", e), null);
      }
      const t = e.closest("[data-work-index]");
      if (t?.dataset?.workIndex != null) {
        const n = Number(t.dataset.workIndex);
        return Number.isInteger(n) && n >= 1 ? n : (console.warn("Invalid data-work-index on console action", t), null);
      }
      return console.error("Missing data-work-index on console action", e), null;
    }
    function nt(e) {
      if (!e) return NaN;
      const t = e.dataset.seconds;
      if (t != null && t !== "") {
        const o = Number(t);
        if (Number.isFinite(o)) return o;
      }
      const n = e.dataset.mmss;
      return n != null && n !== "" ? ot(n) : NaN;
    }
    function ot(e) {
      if (e == null || e === "") return NaN;
      const n = String(e).trim().match(/^(-?\d+):([0-5]?\d)$/);
      if (!n) return NaN;
      const o = Number(n[1]), r = Number(n[2]);
      return !Number.isFinite(o) || !Number.isFinite(r) ? NaN : o * 60 + r;
    }
    function rt(e) {
      const t = nt(e);
      let n = Number.isFinite(t) ? t : NaN;
      (!Number.isFinite(n) || n < 0) && (e.dataset.warnedInvalid || (console.warn("Invalid cue time on Play@ button; defaulting to 0.", e), e.dataset.warnedInvalid = "1"), n = 0);
      const o = Math.max(0, Math.floor(n));
      return e.dataset.seconds = String(o), delete e.dataset.mmss, o;
    }
    function te(e) {
      const t = String(e || "").trim();
      t && (D = !0, R(t, !0), p(t));
    }
    function at(e) {
      const t = C("div", "line"), n = document.createElement("span");
      return n.style.fontWeight = "800", n.textContent = e, t.appendChild(n), t;
    }
    function it(e, t) {
      const n = C("div", "line " + t);
      return n.textContent = e, n;
    }
    function C(e, t) {
      const n = document.createElement(e);
      return t && (n.className = t), n;
    }
    function F(e) {
      requestAnimationFrame(() => e.classList.add("in"));
    }
    function st(e) {
      e.querySelectorAll(".line, .actions, .blk").forEach((t) => F(t));
    }
    function ye() {
      c.innerHTML = "";
    }
    function x(e) {
      if (e == null || e === "") return -1;
      if (/^\d+$/.test(e)) return parseInt(e, 10);
      const t = String(e).match(/^(\d+):([0-5]?\d)$/);
      return t ? parseInt(t[1], 10) * 60 + parseInt(t[2], 10) : -1;
    }
    function L(e) {
      e = Math.max(0, Math.floor(e));
      const t = Math.floor(e / 60), n = e % 60;
      return `${t}:${n.toString().padStart(2, "0")}`;
    }
    function ke(e) {
      return e ? w[e] ? w[e] : e : "";
    }
    function ct(e) {
      return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[t]);
    }
    function K(e = !1) {
      !D && !e || (c.scrollTop = c.scrollHeight);
    }
    function ne() {
      a("#works-console").addEventListener("click", () => u.focus(), { capture: !0 }), u.focus();
    }
    function Ee() {
      const e = u.value;
      u.value = "", u.value = e;
    }
    function Ne(e) {
      const t = Array.from(document.querySelectorAll("audio"));
      for (const n of t)
        if (!(e && n === e))
          try {
            n.pause(), n.currentTime = 0;
          } catch {
          }
    }
    function lt() {
      for (const e of Object.values(d)) {
        const t = document.getElementById(e.audioId);
        if (t && !t.paused && !t.ended)
          return { n: e.id, audio: t };
      }
      return { n: null, audio: null };
    }
    function ut(e) {
      return /https?:\/\/(drive|docs)\.google\.com\/file\/d\//.test(e);
    }
    function $e(e) {
      if (!e) return "";
      const t = e.match(/https?:\/\/(?:drive|docs)\.google\.com\/file\/d\/([^/]+)\//);
      return t ? `https://drive.google.com/uc?export=download&id=${t[1]}` : e;
    }
    function dt(e) {
      if (e.error)
        return `media error ${e.error.code}`;
      switch (e.networkState) {
        case e.NETWORK_EMPTY:
          return "no source";
        case e.NETWORK_IDLE:
          return "network idle";
        case e.NETWORK_LOADING:
          return "loading";
        case e.NETWORK_NO_SOURCE:
          return "no compatible source";
      }
      return "unknown";
    }
    ["keydown", "pointerdown", "wheel"].forEach((e) => {
      document.addEventListener(e, () => D = !0, { once: !0, passive: !0 });
    });
    const I = document.querySelector("#works-console .wc-hud");
    I && I.addEventListener("click", (e) => {
      if (!e.target.closest('button[data-hud="toggle"]')) return;
      const n = h.last.n;
      if (!n || !d[n]) {
        i("warn: nothing to control", "warn", !0);
        return;
      }
      const o = document.getElementById(d[n].audioId);
      o && !o.paused ? p(`pause ${n}`) : p(`resume ${n}`);
    });
    let q = null;
    function mt() {
      if (!I) return null;
      if (q) return q;
      I.innerHTML = "";
      const e = document.createElement("div");
      e.className = "row";
      const t = document.createElement("span");
      t.className = "tag tag-now";
      const n = document.createElement("span");
      n.className = "scroll";
      const o = document.createElement("span");
      o.className = "txt";
      const r = document.createElement("span");
      r.className = "dup", r.setAttribute("aria-hidden", "true"), n.append(o, r), t.appendChild(n);
      const s = document.createElement("span");
      s.className = "hud-time";
      const m = document.createElement("span");
      m.textContent = "|";
      const v = document.createElement("span");
      v.className = "soft hud-vol";
      const k = document.createElement("span");
      k.className = "soft hud-speed";
      const B = document.createElement("div");
      B.className = "meter", B.setAttribute("aria-hidden", "true");
      const Le = document.createElement("span");
      B.appendChild(Le);
      const se = document.createElement("div");
      se.className = "hud-actions";
      const z = document.createElement("button");
      return z.type = "button", z.className = "btn hud-btn", z.setAttribute("data-hud", "toggle"), se.appendChild(z), e.append(t, s, m, v, k, B, se), I.appendChild(e), q = { tag: t, tagTxt: o, tagDup: r, time: s, vol: v, speed: k, fill: Le, btn: z }, requestAnimationFrame(() => {
        t.style.width || (t.style.width = t.offsetWidth + "px");
      }), q;
    }
    function N(e, t) {
      if (!I) return;
      const n = mt();
      if (!n) return;
      const r = `Now playing ${e && d[e] ? d[e].title : "—"}`;
      n.tagTxt.textContent = r, n.tagDup.textContent = " · " + r;
      const s = n.tagScroll ? n.tagScroll.scrollWidth > n.tag.clientWidth + 2 : n.tag.querySelector(".scroll").scrollWidth > n.tag.clientWidth + 2;
      n.tag.classList.toggle("is-marquee", s);
      const v = Number.isFinite(t?.duration) ? L(t.duration | 0) : "--:--", k = Number.isFinite(t?.currentTime) ? L(t.currentTime | 0) : "0:00", B = t && t.duration ? Math.max(0, Math.min(100, t.currentTime / t.duration * 100)) : 0;
      n.time.textContent = `${k} / ${v}`, n.vol.textContent = `vol:${Math.round(h.vol * 100)}`, n.speed.textContent = `speed:${h.rate.toFixed(2)}x`, n.fill.style.inset = `0 ${100 - B}% 0 0`, n.btn.textContent = t?.paused ? "Play ▷" : "Pause ❚❚", n.btn.setAttribute("aria-label", `${t?.paused ? "Play" : "Pause"} current track`);
    }
    function pt() {
      I && (I.innerHTML = "", q = null);
    }
    function ft(e) {
      const t = d[e];
      if (!t) return;
      const n = document.getElementById(t.audioId);
      n && (n.volume = h.vol, n.playbackRate = h.rate, n.dataset.bound || (n.addEventListener("timeupdate", () => N(e, n), { passive: !0 }), n.addEventListener("ratechange", () => N(e, n), { passive: !0 }), n.addEventListener("volumechange", () => N(e, n), { passive: !0 }), n.addEventListener("loadedmetadata", () => N(e, n), { once: !0, passive: !0 }), n.addEventListener("ended", () => {
        N(e, n);
      }, { passive: !0 }), n.dataset.bound = "1"));
    }
    function oe(e) {
      return /^\d+(:[0-5]?\d)?$/.test(e || "") ? x(e) : null;
    }
    function Ie(e, t) {
      const n = `${location.origin}${location.pathname}#work-${e}`;
      return t ? `${n}?t=${t | 0}` : n;
    }
    function ht(e, t) {
      if (!d[e]) return i(`error: unknown work ${e}`, "err", !0);
      const o = oe(t), r = Ie(e, o);
      navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(r).then(
        () => i(`copied ${r}`, "ok", !0),
        () => i(r, "muted", !0)
      ) : i(r, "muted", !0);
    }
    function gt(e, t = 2600) {
      let n = a(".toast", c);
      n || (n = document.createElement("div"), n.className = "toast", c.appendChild(n)), n.textContent = e, F(n), A && clearTimeout(A), A = setTimeout(() => n.classList.remove("in"), t);
    }
    function Se() {
      const e = location.hash.match(/^#work-(\d+)(?:\?t=(\d+))?$/);
      if (!e) return;
      const t = parseInt(e[1], 10), n = e[2] ? parseInt(e[2], 10) : null;
      ue(t), Number.isFinite(n) && p(`play ${t} ${n}`);
    }
    window.addEventListener("hashchange", Se, { passive: !0 }), Se();
    const re = document.getElementById("works-group"), _ = document.getElementById("wc-theme-toggle");
    function ae() {
      try {
        const e = localStorage.getItem("wc.theme") || "dark";
        return e.trim().charAt(0) === "{" ? (JSON.parse(e) || {}).mode || "dark" : e;
      } catch {
        return "dark";
      }
    }
    function wt(e) {
      try {
        localStorage.setItem("wc.theme", e === "light" ? "light" : "dark");
      } catch {
      }
    }
    function ie(e) {
      const t = e === "light" ? "light" : e === "dark" ? "dark" : ae();
      re.removeAttribute("data-theme-mode"), re.setAttribute("data-theme", t), _ && (_.setAttribute("title", `Toggle theme (Alt/Opt+D) · current: ${t}`), _.setAttribute("aria-checked", String(t === "dark"))), wt(t);
    }
    function Ce() {
      const t = (re.getAttribute("data-theme") || ae()) === "dark" ? "light" : "dark";
      ie(t), i(`theme ${t}`, "ok", !0);
    }
    function bt(e) {
      const t = (e[0] || "").toLowerCase();
      t === "dark" || t === "light" ? (ie(t), i(`theme ${t}`, "ok", !0)) : i("usage: theme dark|light", "muted", !0);
    }
    _ && _.addEventListener("click", Ce, { passive: !0 }), document.addEventListener("keydown", (e) => {
      (e.altKey || e.metaKey) && (e.key === "d" || e.key === "D") && (e.preventDefault(), Ce());
    }, { passive: !1 }), ie(ae());
    const G = document.querySelector("#works-title .wt-wrap"), xe = document.getElementById("works-group");
    function V() {
      const e = document.querySelector("#works-console .wc-frame");
      if (!G || !xe || !e) return;
      const t = xe.getBoundingClientRect(), n = e.getBoundingClientRect(), o = Math.max(0, Math.round(n.left - t.left));
      G.style.marginLeft = o + "px", G.style.marginRight = "0", G.style.width = Math.round(n.width) + "px";
    }
    function j(e = 6) {
      let t = 0;
      const n = () => {
        V(), ++t < e && requestAnimationFrame(n);
      };
      requestAnimationFrame(n);
    }
    window.addEventListener("load", V, { once: !0 }), window.addEventListener("resize", V, { passive: !0 });
    try {
      const e = new ResizeObserver(() => j(2)), t = document.querySelector("#works-console .wc-split"), n = document.querySelector("#works-console .wc-frame");
      t && e.observe(t), n && e.observe(n);
    } catch {
    }
  })();
}
document.addEventListener("DOMContentLoaded", $t);
export {
  $t as initWorksConsole
};
