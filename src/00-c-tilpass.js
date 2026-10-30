/* KI MSH · felles design for ALLE «Tilpass …»-ark (MSH.tp)
 * Én header, én seksjonstittel og én gruppeflate – brukt av navbar, header, Hjem, rom (felles editor), lys, kamera,
 * klima, vær, media, strøm, varmepumpe, kiosk, ringeklokke, Tesla, Stue og «Tilpass alt».
 *
 *   MSH.tp.head({ title, sub, cancel, reset, done, busy, doneLabel, stat, extra })
 *     → innholdet i arkets tittelrad (wrapperen og dens plassering/sticky eies av arket; gi den klassen «kt-head»):
 *       [× Avbryt]  Tittel / undertittel  [↺ Nullstill]  [Ferdig]
 *     cancel/reset/done = data-a-navnet arket lytter på (utelatt = ingen knapp). busy → Ferdig deaktivert + «Lagrer …».
 *     stat = ferdig HTML (f.eks. lagrestatus) før knappene, extra = ferdig HTML rett før Ferdig.
 *     act = navnet på data-attributtet knappene får (standard 'a' → data-a; f.eks. 'sa' → data-sa).
 *   MSH.tp.CSS        → stilene for head (legg i arkets <style>)
 *   MSH.tp.SEC        → CSS-deklarasjoner for seksjonstitler (setning, 13/600, sekundærtekst – ingen VERSALER)
 *   MSH.tp.SEC_META   → deklarasjoner for meta-teksten til høyre i seksjonstittelen
 *   MSH.tp.GROUP      → deklarasjoner for en gruppeflate (r24, arkets gruppefarge, tynn kant)
 *   MSH.tp.HINT       → deklarasjoner for hjelpetekst under grupper
 *   MSH.tp.title(navn)→ «Tilpass navn» uten «·» (én skrivemåte: «Tilpass navbar», «Tilpass Hjem», «Tilpass Stue» …)
 *
 * Felles kontroller (innholdet i arkene – samme utseende overalt):
 *   MSH.tp.range(sel) → CSS for native <input type=range> i sel: 6 px spor (--ki-ctrl), rosa fyll fram til verdien
 *                       (--kt-p, settes av MSH.tp.fill / den globale input-lytteren under), hvit knott 22 px.
 *   MSH.tp.fill(root|input) → setter --kt-p på alle range-inputer i root (kall etter tegning) eller på én input.
 *   MSH.tp.LABEL / SUB / VAL → feltetikett (14/500), undertekst (12, text-mid), verdi til høyre (13, tabular-nums)
 *   MSH.tp.CHIP / CHIP_ON    → valg-chip 34 px r17 (indre flate) / valgt = rosa gradient + mørk tekst
 *   MSH.tp.SNAP / SNAP_ON    → små forvalg under slidere (28 px, stille kant) / valgt = rosa tone
 *   MSH.tp.ROW               → rad i en gruppe (min 52 px, ingen egen flate – skillelinje mellom radene: ROW_SEP)
 *   MSH.tp.sw(spor, knott, på) → CSS for ÉN felles bryter (50×30, knott 24, transform) – se under
 *   MSH.tp.SEG / SEG_BTN     → felles segmentkontroll (valgt knapp + CHIP_ON)
 *   MSH.tp.entries(nøkler?)  → de felles inngangene til Tilpass [nøkkel, ikon, tittel, undertittel]
 */
(function () {
  const M = window.MSH;
  if (!M || M.tp) return;
  const esc = M.esc;
  const ic = (n, s) => (M.icon ? M.icon(n, s) : `<ha-icon icon="${n}"></ha-icon>`);

  const SEC = 'font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--ki-text-2, var(--gray800,#afafaf));';
  const SEC_META = 'margin-left:auto;font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap;font-variant-numeric:tabular-nums;';
  const GROUP = 'border-radius:24px;background:var(--ki-sheet-grp, var(--ki-surface, var(--gray200,#3a3a3a)));box-shadow:var(--ki-sheet-grp-sh, inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1))));';
  const HINT = 'font-size:12px;line-height:1.4;color:var(--ki-text-mid, var(--gray700,#979797));padding:0 8px;';
  // Runde ikonknapper i headeren (× og ↺): samme flate som gruppene, 40 px
  const IB = 'flex:none;width:40px;height:40px;border-radius:20px;border:0;margin:0;padding:0;display:grid;place-items:center;cursor:pointer;'
    + 'background:var(--ki-sheet-grp, var(--ki-surface, var(--gray200,#3a3a3a)));box-shadow:var(--ki-sheet-grp-sh, none);color:var(--ki-text-2, var(--gray800,#afafaf));transition:transform .12s,background .2s;';

  // Dobbel klasse = vinner over arkenes egne regler for samme wrapper (display/gap), uten !important
  const CSS = `.kt-head.kt-head{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;min-height:52px}
    .kt-head .kt-x,.kt-head .kt-ib{${IB}}
    .kt-head .kt-x ha-icon,.kt-head .kt-ib ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
    .kt-head .kt-x:active,.kt-head .kt-ib:active,.kt-head .kt-done:active{transform:scale(.94)}
    .kt-head .kt-tx{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px;text-align:left}
    .kt-head .kt-tx .tt{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:22px;font-weight:600;line-height:1.15;letter-spacing:-0.01em;color:var(--ki-text, #fafafa)}
    .kt-head .kt-tx .kt-sub{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:400;line-height:1.3;color:var(--ki-text-mid, var(--gray700,#979797))}
    .kt-head .kt-x+.kt-tx{padding-left:2px}
    .kt-head .kt-done{flex:none;${M.DONE_PILL}transition:transform .12s,opacity .2s}
    .kt-head .kt-done[disabled]{opacity:.7;cursor:progress}
    .kt-head .kt-done .spin{width:16px;height:16px;border-radius:50%;border:2px solid rgb(42 23 32/.25);border-top-color:var(--ki-on-accent, #2a1720);animation:ktspin .8s linear infinite;flex:none}
    @keyframes ktspin{to{transform:rotate(360deg)}}
    @media (max-width:380px){.kt-head .kt-tx .tt{font-size:20px}.kt-head .kt-done{padding:0 14px}.kt-head.kt-head{gap:6px}}
    @media (max-width:440px){.kt-head .kt-tx .tt.kt-l1{font-size:19px}.kt-head .kt-tx .tt.kt-l2{font-size:17px}}`;

  const title = (name) => {
    const n = String(name || '').trim();
    if (!n) return 'Tilpass';
    return /^tilpass\b/i.test(n) ? n : 'Tilpass ' + n;
  };

  function head({ title: t = 'Tilpass', sub = '', cancel = null, reset = null, done = 'done', busy = false, doneLabel = 'Ferdig', stat = '', extra = '', titleAttrs = '', act = 'a' } = {}) {
    const da = 'data-' + act, len = String(t).length; // lange titler («Tilpass ringeklokke») krymper litt før ellipsis
    return (cancel ? `<button class="kt-x press" ${da}="${esc(cancel)}" title="Avbryt" aria-label="Avbryt">${ic('mdi:close', 20)}</button>` : '')
      + `<span class="kt-tx"><span class="tt${len > 20 ? ' kt-l2' : len > 15 ? ' kt-l1' : ''}" ${titleAttrs}>${esc(t)}</span>${sub ? `<span class="kt-sub">${esc(sub)}</span>` : ''}</span>`
      + stat
      + (reset ? `<button class="kt-ib press" ${da}="${esc(reset)}" title="Nullstill" aria-label="Nullstill">${ic('mdi:restore', 20)}</button>` : '')
      + extra
      + (done ? `<button class="kt-done done press" ${da}="${esc(done)}" ${busy ? 'disabled aria-busy="true"' : ''}>${busy ? '<span class="spin" aria-hidden="true"></span>Lagrer …' : esc(doneLabel)}</button>` : '');
  }

  /* ---------------------------------------------------------------- felles kontroller */
  const PINK = 'rgb(242 133 201)'; // ki-hex-ok (aksent, lik i begge moduser)
  const LABEL = 'font-size:14px;font-weight:500;line-height:1.3;color:var(--ki-text, #fafafa);';
  const SUB = 'font-size:12px;font-weight:400;line-height:1.4;color:var(--ki-text-mid, var(--gray700,#979797));'; // ≥ 4,5:1 også på #282828
  const VAL = 'font-size:13px;font-weight:500;color:var(--ki-text-2, var(--gray800,#afafaf));font-variant-numeric:tabular-nums;white-space:nowrap;';
  const CHIP = 'height:34px;padding:0 14px;border-radius:17px;border:0;margin:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;'
    + 'background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text-2, var(--gray800,#afafaf));transition:background .2s,color .2s,transform .12s;';
  const CHIP_ON = `background:linear-gradient(145deg, ${PINK} -10%, rgb(245 205 198) 100%);color:var(--ki-on-accent, #2a1720);`; // ki-hex-ok
  const SNAP = 'height:28px;padding:0 11px;border-radius:14px;border:0;margin:0;display:inline-flex;align-items:center;font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;'
    + 'background:transparent;box-shadow:inset 0 0 0 1px var(--ki-sheet-line, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1))));color:var(--ki-text-2, var(--gray800,#afafaf));transition:background .2s,color .2s,transform .12s;';
  const SNAP_ON = `background:color-mix(in srgb, ${PINK} calc(18% * var(--ki-tone-k, 1)), transparent);box-shadow:none;color:var(--ki-pink-text, ${PINK});`;
  const ROW = 'min-height:52px;display:flex;align-items:center;gap:12px;padding:0 12px 0 16px;background:none;border-radius:0;';
  const ROW_SEP = 'box-shadow:inset 0 1px 0 var(--ki-sheet-line, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1))));';
  const range = (sel) => `${sel}{-webkit-appearance:none;appearance:none;display:block;width:100%;height:28px;margin:0;padding:0;background:transparent;accent-color:auto;cursor:pointer}
    ${sel}::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(to right, var(--ki-range-fill, ${PINK}) var(--kt-p, 0%), var(--ki-ctrl, var(--gray400,#545454)) var(--kt-p, 0%))}
    ${sel}::-moz-range-track{height:6px;border-radius:3px;background:var(--ki-ctrl, var(--gray400,#545454))}
    ${sel}::-moz-range-progress{height:6px;border-radius:3px;background:var(--ki-range-fill, ${PINK})}
    ${sel}::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-8px;border:0;border-radius:11px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 4px rgb(0 0 0/.35);transition:transform .15s}
    ${sel}::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:11px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 4px rgb(0 0 0/.35)}
    ${sel}:active::-webkit-slider-thumb{transform:scale(1.12)}
    ${sel}:focus-visible{outline:none}
    ${sel}:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px rgb(242 133 201/.5),0 1px 4px rgb(0 0 0/.35)}
    ${sel}:disabled{opacity:.45;cursor:default}`;
  const pct = (el) => {
    const min = el.min === '' ? 0 : Number(el.min), max = el.max === '' ? 100 : Number(el.max), v = Number(el.value);
    return max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0;
  };
  // Fyll for én input, eller alle range-inputer i root (også et shadow root). Trygg å kalle ofte.
  const fill = (x) => {
    if (!x) return;
    const one = (el) => { const p = pct(el).toFixed(2) + '%'; if (el.style.getPropertyValue('--kt-p') !== p) el.style.setProperty('--kt-p', p); };
    if (x.tagName === 'INPUT') { if (x.type === 'range') one(x); return; }
    if (x.querySelectorAll) x.querySelectorAll('input[type=range]').forEach(one);
  };
  // Én global lytter: input-hendelsen er «composed», så den når document også fra arkenes shadow roots (capture = før arket
  // eventuelt stopper den). Programmatisk endring av value må kalle MSH.tp.fill selv.
  if (!window.__ktFill) {
    window.__ktFill = true;
    const on = (e) => { const t = e.composedPath ? e.composedPath()[0] : e.target; if (t && t.tagName === 'INPUT' && t.type === 'range') fill(t); };
    document.addEventListener('input', on, true);
    document.addEventListener('change', on, true);
  }

  // Runde 2 · ÉN bryter i alle Tilpass-ark: 50×30, knott 24 px (alltid hvit --ki-knob), av = --ki-ctrl, på = rosa (M.SWITCH_ON).
  // Knotten flyttes med transform (ingen layout per frame). Legges ETTER arkets egne regler (samme spesifisitet → vinner).
  //   MSH.tp.sw(sporet, knotten relativt til sporet, på-klassen) – f.eks. sw('.trk', ' i', '.on') eller sw('.sw', '::after', '.on')
  //   on kan også være et forfedre-prefiks: sw('.qtr', ' i', '.on', '.qalt') → «.qalt.on .qtr»
  const sw = (t, k, on = '.on', anc = '') => {
    const pse = /^::/.test(k), T = anc ? `${anc} ${t}` : t, TON = anc ? `${anc}${on} ${t}` : `${t}${on}`;
    return `${T}{position:relative;display:inline-block;width:50px;height:30px;border-radius:15px;flex:none;box-sizing:border-box;padding:0;background:var(--ki-ctrl, var(--gray400,#545454));box-shadow:none;transition:background .2s ease}
    ${T}${k}{${pse ? "content:'';" : ''}position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 3px rgb(0 0 0/.3);transform:translateX(0);transition:transform .22s cubic-bezier(.3,1.3,.6,1)}
    ${TON}{background:${M.SWITCH_ON || PINK}}
    ${TON}${k}{left:3px;background:var(--ki-knob, #fafafa);transform:translateX(20px)}
    @media (prefers-reduced-motion: reduce){${T},${T}${k}{transition:none}}`;
  };
  // Runde 2 · felles segmentkontroll (spor --ki-surface-3, valgt = CHIP_ON)
  const SEG = 'display:flex;gap:2px;padding:3px;border-radius:20px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));';
  const SEG_BTN = 'flex:1 1 0;min-width:0;height:34px;padding:0 12px;border:0;border-radius:17px;background:transparent;color:var(--ki-text-2, var(--gray800,#afafaf));font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .2s,color .2s;';
  // Runde 2 · de felles inngangene til Tilpass (én kilde for navbarens Tilpass-ark, Innstillinger, PC-oversikten og HA-hub-en):
  //   [nøkkel, ikon, tittel, undertittel] – synlighet avgjøres av kalleren
  const ENTRIES = [
    ['alt', 'mdi:auto-fix', 'Tilpass alt', 'Veiviser for hele dashbordet'],
    ['home', 'mdi:view-dashboard-edit-outline', 'Tilpass Hjem', 'Kort, faner, popups og tekst på forsiden'],
    ['navbar', 'mdi:dock-bottom', 'Tilpass navbar', 'Knapper, rekkefølge, plassering og mini-spiller'],
    ['header', 'mdi:page-layout-header', 'Tilpass header', 'Hilsen, vær og personer øverst'],
    ['pc', 'mdi:monitor', 'Dashbord på PC', null],
    ['kiosk', 'mdi:fullscreen', 'Kiosk-modus', null],
    ['devices', 'mdi:devices', 'Enheter', 'Eget oppsett per enhet'],
    ['ha', 'mdi:home-assistant', 'Home Assistant', 'Automasjoner, scener, oppdateringer og backup'],
  ];
  const entries = (keys) => (keys ? ENTRIES.filter((e) => keys.includes(e[0])) : ENTRIES.slice());

  M.tp = { head, title, CSS, SEC, SEC_META, GROUP, HINT, IB, LABEL, SUB, VAL, CHIP, CHIP_ON, SNAP, SNAP_ON, ROW, ROW_SEP, range, fill, PINK, sw, SEG, SEG_BTN, entries };
})();
