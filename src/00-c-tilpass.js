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
 */
(function () {
  const M = window.MSH;
  if (!M || M.tp) return;
  const esc = M.esc;
  const ic = (n, s) => (M.icon ? M.icon(n, s) : `<ha-icon icon="${n}"></ha-icon>`);

  const SEC = 'font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--ki-text-2, var(--gray800,#afafaf));';
  const SEC_META = 'margin-left:auto;font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap;font-variant-numeric:tabular-nums;';
  const GROUP = 'border-radius:24px;background:var(--ki-sheet-grp, var(--ki-surface, var(--gray200,#3a3a3a)));box-shadow:var(--ki-sheet-grp-sh, inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1))));';
  const HINT = 'font-size:12px;line-height:1.4;color:var(--ki-text-3, var(--gray600,#7f7f7f));padding:0 8px;';
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

  M.tp = { head, title, CSS, SEC, SEC_META, GROUP, HINT, IB };
})();
