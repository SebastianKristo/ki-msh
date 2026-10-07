/* KI MSH · tema (lys/mørk) – «ki-theme» (Fiks 34 · Del A + 35.7 regel 2–6 og 8). Eksporteres som MSH.theme.
 * Lastes FØR 00-base.js (navnerekkefølge i build.mjs: «00-a-…» < «00-base»).
 *
 * TOKENS (semantiske farger) – se CLAUDE.md «Tema (lys/mørk)»:
 *   Tokenene er BARE definert i lys modus (:root[data-ki-theme=light]). I mørk modus er de udefinert, så hver bruk
 *   faller tilbake til dagens farge: ALLTID `var(--ki-text, #fafafa)` / `var(--ki-surface, var(--gray200, #3a3a3a))`.
 *   Mørk modus blir dermed piksel-lik det den var (fallback = dagens hex), og samme token kan stå for flere nesten-like
 *   mørke gråtoner (f.eks. #e1e1e1 og #fafafa som tekst) uten at mørk modus endres. MSH.theme.DARK har tabellens
 *   mørk-verdier for JS som trenger en konkret farge (canvas, kontrastberegning).
 * MODUS: hass.themes.darkMode (lyttes på via MSH.Card sin hass-setter → MSH.theme.update) → data-ki-theme="dark|light" på
 *   <html>, dashbord-containeren (hui-root #view), ki-overlay-root og hver Bubble popup-rot (.bubble-pop-up). Custom
 *   properties arves gjennom shadow DOM, så <html> alene gir tokens overalt; attributtene på de andre røttene er for
 *   CSS-selektorer (Bubble-headeren) og tester.
 * GRÅSKALA FRA TEMAET: i lys modus sjekkes om My SmartHome-temaets --gray000…--gray1000 er snudd (L(gray000) > L(gray1000)
 *   målt på <html>). Er de snudd → data-ki-gray="flip" og --ki-bg/--ki-surface-2/--ki-surface-3/--ki-ctrl tas fra
 *   var(--gray000/300/100/400). Ellers (temaet har bare mørke grå) brukes tabellens lys-verdier.
 * MØRKE ØYER (regel 2): MSH.theme.classify(root) markerer elementer med mørk gradient/bilde (snitt-luminans < 0,32) eller
 *   mørk mettet flate (HSL-lyshet < 0,5 og metning > 0,35) med data-theme="dark" og nullstiller tokenene lokalt (inline
 *   `--ki-…: initial` → mørk fallback). Kort kan merke eksplisitt med attributtet data-ki-island (CSS i MSH.theme.CSS,
 *   som ligger i MSH.BASE_CSS). Kjøres bare i lys modus: ved modusbytte, når en popup åpnes, og via én MutationObserver
 *   per popup-rot (debounced, bare nye/endrede noder) – regel 8.
 */
(function () {
  const MSH = (window.MSH = window.MSH || {});
  if (MSH.theme) return;

  /* ------------------------------------------------------------ token-tabell */
  // Mørk = dagens verdier (fallback i hver bruk). Lys = Del A pkt. 2 + 35.6-rettelser (+ noen hjelpetokens).
  const DARK = {
    bg: '#232323', popup: '#282828', surface: '#3a3a3a', 'surface-2': '#404040', 'surface-3': '#2f2f2f', ctrl: '#545454',
    text: '#fafafa', 'text-1': '#e1e1e1', 'text-2': '#afafaf', 'text-mid': '#979797', 'text-3': '#7f7f7f', 'text-lo': '#545454',
    line: 'rgba(255,255,255,0.06)', 'pill-bg': '#fafafa', 'pill-fg': '#141414', 'on-accent': '#3a3a3a', knob: '#fafafa',
    glass: 'rgba(40,40,44,0.5)', 'glass-fg': '#fafafa',
  };
  const LIGHT = {
    bg: '#e6e6e6', popup: '#f0f0f0', surface: '#ffffff', 'surface-2': '#ebebeb', 'surface-3': '#dedede', ctrl: '#cfcfcf',
    // --ki-text-2: 35.6 retter tabellens #5c5c5c til #565656 (inaktive faner/løpetekst, bedre kontrast).
    // --ki-text-mid/-3/-lo: kravet ≥ 4,5:1 også på --ki-surface-2/-3 (#ebebeb/#dedede) → #5b5b5b/#606060/#626262
    // (tabellens #858585 gir bare 3,7:1 på hvit; regel 5 sitt #707878–#787878 under 4,5:1 på grå flater)
    text: '#1c1c1c', 'text-1': '#333333', 'text-2': '#565656', 'text-mid': '#5b5b5b', 'text-3': '#606060', 'text-lo': '#626262',
    line: 'rgba(0,0,0,0.08)', 'pill-bg': '#1c1c1c', 'pill-fg': '#fafafa', 'on-accent': '#2a1720', knob: '#ffffff',
    glass: 'rgba(255,255,255,0.62)', 'glass-fg': '#1c1c1c',
  };
  // Hjelpetokens (bare lys; mørk = fallback i bruken): skygger på hevede flater, stepper-gradient, regel 3/4-faktorer,
  // tone-faktor (pkt. 5) og aksent-mørkning (pkt. 6).
  const LIGHT_EXTRA = {
    // Hjem-kort/hevede flater: HELE skyggen (brukes som var(--ki-card-sh, <dagens skygge>), så mørk er uendret)
    '--ki-card-sh': 'inset 0 0 0 1px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06)',
    '--ki-pill-sh': '0 1px 2px rgba(0,0,0,0.08)', // prosa-piller, knapper på flate
    '--ki-glass-ind': 'rgba(0,0,0,0.08)', // aktiv indikator i glass-navbaren (mørk: rgba(18,18,20,.62))
    '--ki-step-bg': 'linear-gradient(180deg,#ffffff,#f2f2f2)', // termostat-stepper (mørk: #484848→#3f3f3f)
    '--ki-step-sh': 'inset 0 0 0 1px rgba(0,0,0,0.06),0 2px 8px rgba(0,0,0,0.10)',
    '--ki-wa-c': '0 0 0', '--ki-wa-min': '0.06', '--ki-wa-k': '1.1', '--ki-wa-max': '0.16', // regel 4
    '--ki-ka-min': '0.12', '--ki-ka-k': '0.4', // regel 3
    '--ki-tone-k': '1.5', // pkt. 5: .12 → .18
    '--ki-accent-mix': '60%', // pkt. 6 for aksenter utenfor tabellen (blandes med svart)
    // Fiks 56 · «lys-bryter» (space toggle): tom verdi i lys modus, udefinert i mørk. `--x: var(--ki-lt) <lys-verdi>` blir
    // dermed <lys-verdi> i lys modus og ugyldig i mørk, så `var(--x, <mørk verdi>)` velger per modus – for farger som
    // regnes ut per element (lampefarge) og ikke kan ligge som faste tokens på :root. Se MSH.theme.lightOnly().
    '--ki-lt': ' ',
    // Fiks 56 M · lys-raden (08-light-row.js) i lys modus. Mørk = Rom v4-fargene (fallback i bruken).
    '--ki-track': '#ececec', // skinne / tom del (mørk: #6b5b50 / #695b51)
    '--ki-track-sh': 'inset 0 0 0 1px rgba(0,0,0,0.05)',
    '--ki-lr-fill-sh': '0 1px 3px rgba(0,0,0,0.12)', // fyll / på-tommel
    '--ki-lr-k': 'var(--ki-text)', '--ki-lr-kw': '3px', '--ki-lr-ksh': '0 0 0 1.5px #ffffff', // dimmerens strek-tommel
    '--ki-lr-off': '#ffffff', '--ki-lr-off-sh': '0 1px 4px rgba(0,0,0,0.15)', // av-tommel på av/på-bryteren
    '--ki-lr-ic-off': 'var(--ki-text-2)', '--ki-lr-ic-on': 'var(--ki-on-accent)', // ikon på av-tommel / på fyllet
    '--ki-lr-dot': 'rgba(0,0,0,0.25)', '--ki-lr-dot-op': '1', // prikken på av-siden
    '--ki-lr-p': 'var(--ki-text-2)', // statustekst («På», «40%», «Av»)
    '--ki-lr-bulb-off': 'var(--ki-text-3)', // pære-ikonet når lyset er av
  };
  // Pkt. 6: aksent brukt som TEKST/ikon → mørknes i lys modus. [navn, mørk rgb, lys rgb, temavariabel, temahex]
  const ACCENTS = [
    ['orange', '242 181 115', '168 98 24', '--orange', '#f2b573'], ['blue', '115 185 242', '30 108 178', '--blue', '#73b9f2'],
    ['green', '102 209 158', '18 128 78', '--green', '#66d19e'], ['red', '242 128 115', '186 58 44', '--red', '#f28073'],
    ['pink', '242 133 201', '176 48 128', '--pink', '#f285c9'], ['yellow', '242 210 111', '140 108 0', '--yellow', '#f2d26f'],
    ['purple', '174 150 230', '104 76 186', '--purple', '#ad99e6'],
  ];
  const ACC_ALIAS = { amber: 'orange', lilla: 'purple', rosa: 'pink', gul: 'yellow', 'rød': 'red', groenn: 'green', 'grønn': 'green', 'blå': 'blue' };

  /* ------------------------------------------------------------ OKLCH (Fiks 56 D/M) */
  // sRGB [0–255] ↔ OKLab/OKLCH. Brukes til å regne ut lys-modus-tintene én gang (konkrete farger → målbar kontrast og
  // ingen avhengighet av color-mix/relative farger i eldre WebView) og til å mørkne lampefarger (lys-rad-ikonet).
  const sl = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const sg = (u) => 255 * (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  function toOklch(rgb) {
    const r = sl(rgb[0]), g = sl(rgb[1]), b = sl(rgb[2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function fromOklchRaw(L, C, h) {
    const A = C * Math.cos(h), B = C * Math.sin(h);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  // OKLCH → sRGB (0–255) med kroma redusert til fargen er innenfor sRGB (samme L og hue)
  function fromOklch(L, C, h) {
    let c = C, v = fromOklchRaw(L, c, h);
    for (let i = 0; i < 40 && v.some((x) => x < -1e-4 || x > 1.0001); i++) { c *= 0.94; v = fromOklchRaw(L, c, h); }
    return v.map((x) => Math.round(Math.max(0, Math.min(255, sg(Math.max(0, Math.min(1, x)))))));
  }
  const hex2 = (p) => '#' + p.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const relL = (p) => 0.2126 * sl(p[0]) + 0.7152 * sl(p[1]) + 0.0722 * sl(p[2]);
  const ratio = (a, b) => { const x = relL(a), y = relL(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Aksent p (0–1) blandet inn i hvitt i OKLCH (= color-mix(in oklch, aksent p, white): hvit har ingen hue)
  const mixWhite = (rgb, p) => { const [L, C, h] = toOklch(rgb); return fromOklch(p * L + (1 - p), p * C, h); };
  // Mørk variant av en farge: OKLCH L = l (samme hue), senkes til kontrasten mot alle bakgrunner er ≥ min
  function darkTo(rgb, l, bgs, min) {
    const [, C, h] = toOklch(rgb);
    let L = l, out = fromOklch(L, C, h);
    while (L > 0.2 && bgs.some((bg) => ratio(out, bg) < min)) { L -= 0.01; out = fromOklch(L, C, h); }
    return out;
  }
  const WHITE = [255, 255, 255];
  // Fiks 56 D · tonede piller/fliser: --ki-tint-<aksent>-bg/-fg/-ring/-circle/-sh (bare lys modus; mørk = fallback i bruken)
  //   bg = aksent 9 % inn i hvitt (opak), circle = 22 %, ring = 25 %, fg = mørk aksent (OKLCH L ≈ 0,47) ≥ 4,5:1 mot
  //   både sirkel og flate, sh = inset-ring + svak skygge 0 1px 2px rgba(0,0,0,.06).
  const TINT = {};
  ACCENTS.forEach(([n, d]) => {
    const rgb = d.split(' ').map(Number), bg = mixWhite(rgb, 0.09), circle = mixWhite(rgb, 0.22), ring = mixWhite(rgb, 0.25);
    TINT[n] = { bg: hex2(bg), circle: hex2(circle), ring: hex2(ring), fg: hex2(darkTo(rgb, 0.47, [circle, bg], 4.6)) };
  });
  const TINT_NAMES = [...Object.keys(TINT), 'amber'];
  const tintDecl = (n, t) => `--ki-tint-${n}-bg:${t.bg};--ki-tint-${n}-fg:${t.fg};--ki-tint-${n}-ring:${t.ring};--ki-tint-${n}-circle:${t.circle};--ki-tint-${n}-sh:inset 0 0 0 1px ${t.ring},0 1px 2px rgba(0,0,0,0.06)`;
  const TINT_LIGHT = [...Object.entries(TINT).map(([n, t]) => tintDecl(n, t)), tintDecl('amber', TINT.orange),
    // undertekst på tonet flate · fylt varselpille («Avvik»): tekst/undertekst mørk, ikonsirkel rgba(0,0,0,.12)
    '--ki-tint-sub:var(--ki-text-2)', '--ki-tint-solid-sub:var(--ki-on-accent)', '--ki-tint-solid-circle:rgba(0,0,0,0.12)'].join(';');
  const TINT_ALL = [...TINT_NAMES.flatMap((n) => ['bg', 'fg', 'ring', 'circle', 'sh'].map((k) => `--ki-tint-${n}-${k}`)), '--ki-tint-sub', '--ki-tint-solid-sub', '--ki-tint-solid-circle'];

  const decl = (obj, pre = '--ki-') => Object.entries(obj).map(([k, v]) => `${pre}${k}:${v}`).join(';');
  const ACC_LIGHT = ACCENTS.map(([n, , l]) => `--ki-${n}-text:rgb(${l})`).join(';') + ';--ki-amber-text:rgb(168 98 24);' + TINT_LIGHT;
  const ALL_NAMES = [...Object.keys(LIGHT).map((k) => '--ki-' + k), ...Object.keys(LIGHT_EXTRA), ...ACCENTS.map(([n]) => `--ki-${n}-text`), '--ki-amber-text', ...TINT_ALL];
  // Nullstill alle tokens (mørk øy / eksplisitt [data-ki-island]): initial = ugyldig → fallback (mørk verdi)
  const RESET = ALL_NAMES.map((n) => `${n}:initial`).join(';');

  // Eksplisitte øyer ([data-ki-island]) og auto-øyer: tokens nullstilt → mørk fallback
  const ISLAND_CSS = `[data-ki-island],[data-theme=dark][data-ki-island-auto]{${RESET}}`;
  // Bubble-popup-header og -bakgrunn i lys modus (Del A «Bubble-popup-header», regel 6). Legges i popupens shadow root
  // (der .bubble-pop-up ligger). Selektorene har høyere spesifisitet enn popupens egne styles (malene i 02-popups.js), så
  // de vinner bare i lys modus – mørk modus bruker popupens styles urørt (identisk med i dag).
  const POP_CSS = `
.bubble-pop-up[data-ki-theme=light]{--bubble-pop-up-background-color:color-mix(in srgb,var(--ki-popup) var(--ki-pop-op,98%),transparent)!important;--bubble-pop-up-fade-color:rgba(240,240,240,0)!important;--bubble-pop-up-main-background-color:color-mix(in srgb,var(--ki-popup) var(--ki-pop-op,98%),transparent)!important;color:var(--ki-text)}
.bubble-pop-up[data-ki-theme=light] .bubble-header-container{box-shadow:none!important;border:0!important}
.bubble-pop-up[data-ki-theme=light] #header-container > div > div{background:var(--ki-popup)!important;box-shadow:none!important}
.bubble-pop-up[data-ki-theme=light] #header-container > button{background:none!important}
.bubble-pop-up[data-ki-theme=light] .bubble-name,.bubble-pop-up[data-ki-theme=light] .bubble-state{color:var(--ki-text)!important}
.bubble-pop-up[data-ki-theme=light] #header-container .bubble-close-button,.bubble-pop-up[data-ki-theme=light] #header-container .bubble-previous-button{background-color:var(--ki-surface-2)!important;color:var(--ki-text)!important;box-shadow:none!important;border:0!important}
.bubble-pop-up[data-ki-theme=light] .bubble-close-button svg,.bubble-pop-up[data-ki-theme=light] .bubble-previous-button svg{fill:var(--ki-text)!important}
.bubble-pop-up[data-ki-theme=light][data-ki-pop-icon=neutral] .icon-container{background-color:var(--ki-surface)!important;box-shadow:var(--ki-pill-sh)!important}
.bubble-pop-up[data-ki-theme=light][data-ki-pop-icon=neutral] .icon-container > ha-icon{color:var(--ki-text)!important}
.bubble-pop-up[data-ki-theme=light][data-ki-pop-icon=accent] .icon-container > ha-icon{color:var(--ki-on-accent)!important}
${ISLAND_CSS}
`;
  // Dokumentnivå: tokens i lys modus + Bubble-bakteppe (rgba(0,0,0,.5) → .2) + eksplisitte øyer i light DOM.

  const DOC_CSS = `
:root[data-ki-theme=light]{${decl(LIGHT)};${decl(LIGHT_EXTRA, '')};${ACC_LIGHT};--bubble-backdrop-background-color:rgba(0,0,0,0.2)}
:root[data-ki-theme=light][data-ki-gray=flip]{--ki-bg:var(--gray000,#e6e6e6);--ki-surface-2:var(--gray300,#ebebeb);--ki-surface-3:var(--gray100,#dedede);--ki-ctrl:var(--gray400,#cfcfcf)}
${ISLAND_CSS}
`;
  function injectDoc() {
    if (document.getElementById('msh-theme')) return;
    const st = document.createElement('style');
    st.id = 'msh-theme';
    st.textContent = DOC_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  injectDoc();

  /* ------------------------------------------------------------ fargematte */
  // '#abc' | '#aabbcc(dd)' | 'rgb(a b c / x)' | 'rgba(a,b,c,x)' | 'var(--x, fb)' | temanavn → [r, g, b, a] (0–255, 0–1)
  function parse(c) {
    if (Array.isArray(c)) return c;
    let s = String(c == null ? '' : c).trim();
    const v = /^var\((--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(s);
    if (v) {
      let r = '';
      try { r = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim(); } catch (e) { /* */ }
      s = r || (v[2] || '').trim();
      if (/^var\(/.test(s)) return parse(s);
    }
    const acc = ACCENTS.find((a) => a[0] === (ACC_ALIAS[s] || s));
    if (acc) return [...acc[1].split(' ').map(Number), 1];
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map((x) => x + x).join('');
      const n = (i) => parseInt(h.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), h.length >= 8 ? n(6) / 255 : 1];
    }
    m = /^rgba?\(([^)]*)\)$/i.exec(s);
    if (m) {
      const p = m[1].replace(/\//, ' ').split(/[\s,]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)));
      return [p[0], p[1], p[2], p[3] == null || isNaN(p[3]) ? 1 : p[3]];
    }
    m = /^color\(srgb\s+([^)]*)\)$/i.exec(s);
    if (m) { const p = m[1].replace('/', ' ').split(/\s+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null || isNaN(p[3]) ? 1 : p[3]]; }
    return null;
  }
  const lin = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const lum = (c) => { const p = parse(c); return p ? 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]) : null; };
  // Legg en (delvis gjennomsiktig) farge over en bakgrunn → opak [r,g,b,1]
  const over = (fg, bg) => { const f = parse(fg), b = parse(bg) || [255, 255, 255, 1]; if (!f) return b; const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; };
  const contrast = (a, b) => { const bb = over(b, '#ffffff'); const l1 = lum(over(a, bb)), l2 = lum(bb); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const hsl = (c) => {
    const p = parse(c); if (!p) return null;
    const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const s = mx === mn ? 0 : (l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
    return { l, s };
  };
  const rgbStr = (p, a) => `rgba(${Math.round(p[0])}, ${Math.round(p[1])}, ${Math.round(p[2])}, ${+(a == null ? p[3] : a).toFixed(3)})`;

  /* ------------------------------------------------------------ modus */
  let mode = 'dark';
  const T = (MSH.theme = {
    DARK, LIGHT, LIGHT_EXTRA, ACCENTS, POP_CSS, ISLAND_CSS,
    // CSS som kort tar med i sin shadow root (MSH.BASE_CSS har den): eksplisitte mørke øyer [data-ki-island]
    CSS: ISLAND_CSS,
    mode: () => mode,
    isLight: () => mode === 'light',
    parse, lum, contrast, hsl,
    // Token med mørk fallback: T.v('text') → 'var(--ki-text, #fafafa)'; T.v('surface', 'var(--gray200, #3a3a3a)')
    v: (name, fb) => `var(--ki-${name}, ${fb != null ? fb : DARK[name]})`,
    // Konkret verdi for en modus (canvas/tester): T.val('text', 'light') → '#1c1c1c'
    val: (name, m) => ((m || mode) === 'light' ? LIGHT[name] : DARK[name]),
  });

  // Regel 4 · gjennomsiktig hvit som flate/kant: lys modus → rgba(0,0,0, min(.16, max(.06, a × 1.1))).
  //   Uten modus: CSS-uttrykk som tilpasser seg (mørk = rgba(255,255,255,a) uendret). Med modus: konkret rgba-streng.
  T.whiteA = function (a, m) {
    a = +a;
    if (m === 'dark') return `rgba(255, 255, 255, ${a})`;
    if (m === 'light') return `rgba(0, 0, 0, ${+Math.min(0.16, Math.max(0.06, a * 1.1)).toFixed(3)})`;
    return `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`;
  };
  // Regel 3 · gjennomsiktig svart som flate: a < 0,2 → behold (begge moduser); a ≥ 0,2 → lys: max(0.12, a × 0.4).
  T.blackA = function (a, m) {
    a = +a;
    if (a < 0.2) return `rgb(0 0 0 / ${a})`; // bevisst uendret i begge moduser
    if (m === 'dark') return `rgba(0, 0, 0, ${a})`;
    if (m === 'light') return `rgba(0, 0, 0, ${+Math.max(0.12, a * 0.4).toFixed(3)})`;
    return `rgb(0 0 0/max(var(--ki-ka-min,0),calc(${a}*var(--ki-ka-k,1))))`;
  };
  // Regel 5 · gråskala-TEKST → lys modus. Uten modus: token med dagens hex som fallback. Med modus: konkret farge.
  //   #f2f1ee/#fafafa/#ffffff → --ki-text (#1c1c1c) · #c9c7c2/#d6d6d6/#c7c7c7/#e1e1e1 → --ki-text-1 (#333)
  //   #afafaf → --ki-text-2 (#565656) · #8e8d89/#a8a8a8/#979797 → --ki-text-mid (#5b5b5b)
  //   #7f7f7f → --ki-text-3 (#606060) · #6d6c69/#696969/#545454 → --ki-text-lo (#626262)
  const GRAY_TEXT = [
    ['text', ['#fafafa', '#ffffff', '#fff', '#f2f1ee', '#f5f5f5']],
    ['text-1', ['#e1e1e1', '#c7c7c7', '#d6d6d6', '#c9c7c2', '#dddddd', '#cccccc']],
    ['text-2', ['#afafaf', '#b0b0b0', '#aaaaaa']],
    ['text-mid', ['#979797', '#a8a8a8', '#8e8d89', '#999999', '#9e9e9e']],
    ['text-3', ['#7f7f7f', '#808080', '#888888']],
    ['text-lo', ['#6d6c69', '#696969', '#545454', '#666666', '#5f5f5f']],
  ];
  T.grayRole = function (hex) {
    const h = String(hex || '').trim().toLowerCase();
    const hit = GRAY_TEXT.find(([, l]) => l.includes(h));
    if (hit) return hit[0];
    const p = parse(h); if (!p) return null;
    const l = lum(p);
    return l > 0.8 ? 'text' : l > 0.5 ? 'text-1' : l > 0.35 ? 'text-2' : l > 0.25 ? 'text-mid' : l > 0.17 ? 'text-3' : 'text-lo';
  };
  T.grayText = function (hex, m) {
    const role = T.grayRole(hex);
    if (!role) return hex;
    if (m === 'dark') return hex;
    if (m === 'light') return LIGHT[role];
    return `var(--ki-${role}, ${hex})`;
  };

  // Pkt. 6 · aksent brukt som TEKST/ikon. Uten modus → CSS (var(--ki-red-text, <original>)); kjente aksenter (temanavn,
  // var(--red…), temahex, rgb-tripletten i tabellen) får tabellens mørke variant, andre blandes med svart (60 %).
  function accentOf(c) {
    const s = String(c || '').trim().toLowerCase();
    let m = /^var\(--([\w-]+)/.exec(s);
    const name = m ? m[1].replace(/-color$/, '') : s;
    let a = ACCENTS.find((x) => x[0] === (ACC_ALIAS[name] || name) || x[4] === s);
    if (a) return a;
    const p = parse(s);
    if (p) a = ACCENTS.find((x) => { const q = x[1].split(' ').map(Number); return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) <= 9; });
    return a || null;
  }
  T.accentText = function (c, m) {
    const a = accentOf(c);
    if (m === 'dark') return a && !/var\(/.test(String(c)) ? `rgb(${a[1]})` : String(c);
    if (m === 'light') {
      if (a) return `rgb(${a[2]})`;
      const p = parse(c); return p ? rgbStr([p[0] * 0.6, p[1] * 0.6, p[2] * 0.6], 1) : String(c);
    }
    if (a) return `var(--ki-${a[0]}-text, ${String(c).trim()})`;
    return `color-mix(in srgb, ${c} var(--ki-accent-mix, 100%), black)`;
  };
  // Pkt. 5 · farget tone-bakgrunn + tekst. tone(color, mode?, a = .12) → { bg, fg }. Lys: opasitet × 1,5 (.12 → .18) og
  // tekst mørknet (accentText). Uten modus: CSS-uttrykk som følger modus; med modus: konkrete farger.
  T.tone = function (c, m, a = 0.12) {
    if (m === 'dark' || m === 'light') {
      const p = parse(c) || [127, 127, 127, 1];
      return { bg: rgbStr(p, m === 'light' ? Math.min(1, a * 1.5) : a), fg: T.accentText(c, m) };
    }
    return { bg: `color-mix(in srgb, ${c} calc(${+(a * 100).toFixed(2)}% * var(--ki-tone-k, 1)), transparent)`, fg: T.accentText(c) };
  };

  // Fiks 56 D · tonet pille/flis for en aksent (temanavn, var(--orange…), temahex). Returnerer CSS-uttrykk med mørk
  //   fallback = dagens oppskrift (aksent med alpha som flate/sirkel/kant, aksent som ikon) og lys = --ki-tint-*:
  //   { bg, fg, circle, ring, sh (hele box-shadow), sub (undertekst), name }. a = mørke alpha-er { bg, circle, ring }.
  //   Ukjent aksent → name null og bare mørk oppskrift (lys: tone-faktoren som før).
  T.TINT = TINT;
  T.tint = function (c, a) {
    a = { bg: 0.14, circle: 0.2, ring: 0.4, ...(a || {}) };
    const acc = accentOf(c), n = acc ? acc[0] : null, col = String(c).trim();
    const mix = (x) => `color-mix(in srgb, ${col} ${Math.round(x * 100)}%, transparent)`;
    const tk = (k, fb) => (n ? `var(--ki-tint-${n}-${k}, ${fb})` : fb);
    return {
      name: n,
      bg: tk('bg', mix(a.bg)), fg: tk('fg', col), circle: tk('circle', mix(a.circle)), ring: tk('ring', mix(a.ring)),
      sh: tk('sh', `inset 0 0 0 1px ${mix(a.ring)}`),
      sub: (fb) => (n ? `var(--ki-tint-sub, ${fb})` : fb),
    };
  };
  // Fylt varselpille («Avvik»): tekst/ikon --ki-on-accent, undertekst og ikonsirkel (lys: on-accent / rgba(0,0,0,.12))
  T.solid = { sub: (fb) => `var(--ki-tint-solid-sub, ${fb})`, circle: (fb) => `var(--ki-tint-solid-circle, ${fb})` };
  // Fiks 56 · verdi som bare gjelder i lys modus (space toggle --ki-lt): `--x:${T.lightOnly(v)}` + `var(--x, <mørk>)`
  T.lightOnly = (v) => `var(--ki-lt) ${v}`;
  // Fiks 56 M · lampefarge → ikonfarge i lys modus: OKLCH L ≈ 0,55 (samme hue), ≥ 4,5:1 mot hvitt (og ev. bgs)
  T.lampInk = function (c, bgs) {
    const p = Array.isArray(c) ? c : parse(c);
    if (!p) return null;
    return hex2(darkTo(p.slice(0, 3), 0.55, (bgs || [WHITE]).map((b) => (Array.isArray(b) ? b : (parse(b) || WHITE).slice(0, 3))), 4.6));
  };
  T.oklch = { to: toOklch, from: fromOklch, mixWhite, darkTo, ratio, hex: hex2 };

  /* ------------------------------------------------------------ røtter */
  const roots = new Set(); // elementer som har fått data-ki-theme (bortsett fra <html>)
  const pops = new Map(); // .bubble-pop-up → { mo, pending:Set, t, observed:WeakSet }
  const autoIslands = new Set();
  function dashEl() {
    try {
      const ha = document.querySelector('home-assistant');
      const panel = ha && MSH.deep && MSH.deep(ha.shadowRoot, 'ha-panel-lovelace');
      const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
      return (root && root.shadowRoot && (root.shadowRoot.querySelector('#view') || root.shadowRoot.querySelector('hui-view-container'))) || null;
    } catch (e) { return null; }
  }
  function tag(el) {
    if (!el || !el.setAttribute) return;
    if (el.getAttribute('data-ki-theme') !== mode) el.setAttribute('data-ki-theme', mode);
    roots.add(el);
  }
  T.tag = tag;
  // Gråskala-sjekk (se toppen): snur temaet --gray000/--gray1000?
  T.grayFlips = function () {
    try {
      const cs = getComputedStyle(document.documentElement);
      const g0 = cs.getPropertyValue('--gray000').trim(), g10 = cs.getPropertyValue('--gray1000').trim();
      if (!g0 || !g10) return false;
      return lum(g0) > lum(g10);
    } catch (e) { return false; }
  };
  function popIconKind(pop) {
    const host = pop.getRootNode && pop.getRootNode().host;
    const cfg = host && (host.config || host._config);
    const m = cfg && typeof cfg.styles === 'string' && /\.icon-container\s*\{[^}]*background-color\s*:\s*([^;!}]+)/.exec(cfg.styles);
    const v = m ? m[1].trim() : '';
    if (!v || /gray|grey|white|#e1e1e1|#fafafa|#fff\b|#ffffff|#c7c7c7/i.test(v)) return 'neutral';
    return 'accent';
  }
  function popOpacity(pop) {
    const host = pop.getRootNode && pop.getRootNode().host;
    const cfg = host && (host.config || host._config);
    const o = cfg && cfg.bg_opacity != null && cfg.bg_opacity !== '' ? Number(cfg.bg_opacity) : NaN;
    return Number.isFinite(o) ? Math.max(0, Math.min(100, o)) + '%' : '';
  }
  // Registrer en Bubble popup-rot: attributt, header-CSS i shadow rooten, opasitet, MutationObserver (regel 8)
  T.adoptPopup = function (pop) {
    if (!pop || !pop.classList || !pop.classList.contains('bubble-pop-up')) return;
    tag(pop);
    const rn = pop.getRootNode();
    // Fiks 52: getElementById – «:scope > …» treffer ingenting i en ShadowRoot (ingen scope-element), så før ble en ny
    // <style> lagt til ved HVER adoptPopup (hver T.scan for alle popups) – stilberegning midt i åpne-animasjonen.
    if (rn && rn !== document && rn.getElementById && !rn.getElementById('ki-theme-pop')) {
      const st = document.createElement('style');
      st.id = 'ki-theme-pop';
      st.textContent = POP_CSS;
      rn.appendChild(st);
    }
    if (MSH.perf && MSH.perf.adoptPop) MSH.perf.adoptPop(pop); // ytelsesmodus (00-b-perf.js): bg_blur → 0 på Android
    const kind = popIconKind(pop);
    if (pop.getAttribute('data-ki-pop-icon') !== kind) pop.setAttribute('data-ki-pop-icon', kind);
    const op = popOpacity(pop);
    if (op) pop.style.setProperty('--ki-pop-op', op);
    if (!pops.has(pop)) {
      const rec = { pending: new Set(), t: 0, seen: new WeakSet() };
      rec.mo = new MutationObserver((list) => {
        if (mode !== 'light') return;
        for (const r of list) {
          if (r.type === 'childList') r.addedNodes.forEach((n) => { if (n.nodeType === 1) rec.pending.add(n); });
          else if (r.target && r.target.nodeType === 1 && !(r.attributeName === 'data-theme' || r.attributeName === 'data-ki-island-auto' || r.attributeName === 'data-ki-theme')) rec.pending.add(r.target);
        }
        if (rec.pending.size && !rec.t) rec.t = setTimeout(() => { rec.t = 0; const ns = [...rec.pending]; rec.pending.clear(); ns.forEach((n) => { if (n.isConnected) T.classify(n, rec); }); }, 150);
      });
      const opts = { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] };
      // Ytelse: observeren kobles bare til i lys modus (i mørk modus gjør den ingenting – men hver stil-/klasseendring i
      // popupen ville ellers laget MutationRecords). T.set kobler til/fra ved modusbytte.
      rec.observe = (root) => { if (!root || mode !== 'light' || rec.seen.has(root)) return; rec.seen.add(root); try { rec.mo.observe(root, opts); } catch (e) { /* */ } };
      rec.pop = pop;
      rec.observe(pop);
      pops.set(pop, rec);
    }
  };
  // Kort kaller denne (MSH.Card) – finner popup-roten over elementet på tvers av shadow roots
  T.adopt = function (el) {
    let n = el;
    for (let i = 0; n && i < 60; i++) {
      if (n.classList && n.classList.contains('bubble-pop-up')) { T.adoptPopup(n); return n; }
      n = n.parentNode || n.host;
    }
    return null;
  };
  function allPops(root) {
    const out = [];
    const walk = (r, d) => {
      if (!r || d > 14) return;
      r.querySelectorAll('*').forEach((e) => { if (e.classList && e.classList.contains('bubble-pop-up')) out.push(e); if (e.shadowRoot) walk(e.shadowRoot, d + 1); });
    };
    walk(root, 0);
    return out;
  }
  // Finn og merk alle røtter (dashbord, overlay, popups). Billig nok ved modusbytte/hash-endring (debounced).
  T.scan = function () {
    tag(document.documentElement);
    const d = dashEl(); if (d) { tag(d); if (MSH.perf && MSH.perf.tag) MSH.perf.tag(d); } // Fiks 52: ki-android på dashbord-containeren
    const ov = document.querySelector('body > ki-overlay-root'); if (ov) tag(ov);
    for (const r of [...roots]) { if (!r.isConnected) { roots.delete(r); const p = pops.get(r); if (p) { p.mo.disconnect(); pops.delete(r); } } else tag(r); }
    const base = d ? (d.getRootNode() === document ? document : d) : document;
    allPops(base).forEach(T.adoptPopup);
    if (d && base !== document) allPops(document).forEach(T.adoptPopup); // Fiks 52: ikke samme tre to ganger
  };

  /* ------------------------------------------------------------ mørke øyer (regel 2) */
  const ISL_MIN_AREA = 2400; // px² – chips/ikoner er aldri øyer
  function bgVerdict(cs, el) {
    const img = cs.backgroundImage;
    if (img && img !== 'none') {
      if (/url\(/.test(img)) return true; // bilde (kamera/scene): lys tekst over foto
      const cols = img.match(/rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || [];
      const ls = cols.map((c) => { const p = parse(c); return p && p[3] > 0.05 ? lum(p) : null; }).filter((x) => x != null);
      if (ls.length) return ls.reduce((a, b) => a + b, 0) / ls.length < 0.32;
    }
    const bc = parse(cs.backgroundColor);
    if (bc && bc[3] > 0.5) { const h = hsl(bc); if (h && h.l < 0.5 && h.s > 0.35) return true; }
    return false;
  }
  function setIsland(el, on) {
    if (on) {
      if (el.getAttribute('data-ki-island-auto') === '1') return;
      el.setAttribute('data-theme', 'dark');
      el.setAttribute('data-ki-island-auto', '1');
      ALL_NAMES.forEach((n) => el.style.setProperty(n, 'initial'));
      autoIslands.add(el);
    } else if (el.getAttribute('data-ki-island-auto') === '1') {
      el.removeAttribute('data-ki-island-auto');
      if (el.getAttribute('data-theme') === 'dark') el.removeAttribute('data-theme');
      ALL_NAMES.forEach((n) => el.style.removeProperty(n));
      autoIslands.delete(el);
    }
  }
  T.isIsland = (el) => !!el && el.nodeType === 1 && (el.hasAttribute('data-ki-island') || el.getAttribute('data-ki-island-auto') === '1');
  // Klassifiser el og etterkommere (også shadow roots). Bare i lys modus. rec = popup-posten (observerer nye shadow roots).
  T.classify = function (root, rec) {
    if (mode !== 'light' || !root) return 0;
    let n = 0;
    const visit = (el, depth) => {
      if (depth > 40) return;
      if (el.nodeType === 1) {
        const tagn = el.localName;
        if (tagn === 'style' || tagn === 'script' || tagn === 'svg' || tagn === 'ha-icon' || tagn === 'img' || tagn === 'video' || tagn === 'canvas') return;
        if (el.hasAttribute('data-ki-island')) return; // eksplisitt øy: arver mørke tokens – hopp over innholdet
        let isl = false;
        try {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') return;
          if (bgVerdict(cs, el)) { const r = el.getBoundingClientRect(); isl = r.width * r.height >= ISL_MIN_AREA; }
        } catch (e) { /* */ }
        setIsland(el, isl);
        if (isl) { n++; return; } // innholdet i en øy arver
        if (el.shadowRoot) { if (rec) rec.observe(el.shadowRoot); el.shadowRoot.childNodes.forEach((c) => visit(c, depth + 1)); }
      }
      if (el.children) for (const c of el.children) visit(c, depth + 1);
    };
    if (root.nodeType === 11) root.childNodes.forEach((c) => visit(c, 0)); else visit(root, 0);
    return n;
  };
  function clearIslands() { [...autoIslands].forEach((el) => setIsland(el, false)); autoIslands.clear(); }
  function classifyOpen() {
    if (mode !== 'light') return;
    for (const [pop, rec] of pops) if (pop.isConnected && (pop.classList.contains('is-popup-opened') || pop.getBoundingClientRect().height > 0)) T.classify(pop, rec);
    const d = dashEl(); if (d) T.classify(d);
  }
  T.classifyOpen = classifyOpen;

  /* ------------------------------------------------------------ bytte */
  let scanT = 0;
  const later = (fn, ms) => { clearTimeout(scanT); scanT = setTimeout(fn, ms); };
  T.set = function (m) {
    m = m === 'light' ? 'light' : 'dark';
    const changed = m !== mode;
    mode = m;
    const html = document.documentElement;
    if (m === 'light' && T.grayFlips()) html.setAttribute('data-ki-gray', 'flip'); else html.removeAttribute('data-ki-gray');
    tag(html);
    T.scan();
    if (!changed) return;
    for (const rec of pops.values()) { if (m === 'light') rec.observe(rec.pop); else { rec.mo.disconnect(); rec.seen = new WeakSet(); clearTimeout(rec.t); rec.t = 0; rec.pending.clear(); } }
    if (m === 'dark') clearIslands(); else { classifyOpen(); later(classifyOpen, 400); }
    try { window.dispatchEvent(new CustomEvent('ki-theme-change', { detail: { mode: m } })); } catch (e) { /* */ }
  };
  // Kalles med hver nye hass (MSH.Card). Billig: gjør bare noe når darkMode endres.
  let first = true;
  T.update = function (hass) {
    const th = hass && hass.themes;
    const m = th && typeof th.darkMode === 'boolean' ? (th.darkMode ? 'dark' : 'light') : mode;
    if (first) { first = false; T.set(m); later(() => T.scan(), 300); return; } // første hass: merk røttene (også i mørk)
    if (m !== mode || document.documentElement.getAttribute('data-ki-theme') !== m) T.set(m);
  };
  tag(document.documentElement);
  // Popup åpnes (hash) → merk nye popup-røtter og omklassifiser (regel 8).
  // Fiks 52: T.scan går gjennom hele DOM-en (alle shadow roots) – før kom den 120 ms etter hash-byttet, midt i Bubbles
  // åpne-animasjon (300 ms), og ble en lang oppgave på Android. Nå etter animasjonen og i ledig tid. Kortet i popupen
  // merker sin egen popup-rot straks (MSH.Card._checkOpen → MSH.theme.adopt), så dette er bare reserven.
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : fn());
  window.addEventListener('hashchange', () => later(() => idle(() => { T.scan(); classifyOpen(); }), 450));
  window.addEventListener('location-changed', () => later(() => idle(() => T.scan()), 450));
})();
