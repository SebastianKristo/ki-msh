# Klima-diagnose (fiks 16.13)

Når `#klima` viser Bubble-headeren, men en tom flate under: kjør skriptet under i nettleseren og send svaret.

## Slik gjør du det
1. Åpne dashbordet og trykk på Klima, slik at `#klima` er åpen (tom flate synlig).
2. Trykk **F12** (Mac: **⌥⌘I**) → fanen **Console** (Konsoll).
3. Lim inn hele skriptet under og trykk Enter. (Chrome kan be deg skrive `allow pasting` først.)
4. Vent ca. 1 s. Resultatet skrives som JSON (og kopieres til utklippstavlen i Chrome). Lim det inn i svaret ditt.

Skriptet endrer ingenting, bortsett fra at det ber kortet tegne seg på nytt én gang (fase 2) for å se om tegningen er blokkert.

```js
(async () => {
  const deep = (root, sel, out = []) => { root.querySelectorAll(sel).forEach((e) => out.push(e)); root.querySelectorAll('*').forEach((e) => e.shadowRoot && deep(e.shadowRoot, sel, out)); return out; };
  const up = (e) => e.parentNode || e.host || null;
  const nm = (e) => e ? e.localName + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') : null;
  const st = (e) => {
    if (!e || !e.getBoundingClientRect) return null;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return { el: nm(e), display: cs.display, opacity: cs.opacity, visibility: cs.visibility, transform: cs.transform === 'none' ? undefined : cs.transform, height: Math.round(r.height), width: Math.round(r.width), top: Math.round(r.top), overflow: cs.overflow === 'visible' ? undefined : cs.overflow };
  };
  const one = (a) => {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {}, k = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
    return { el: nm(a.effect && a.effect.target), type: a.constructor.name, name: a.animationName || a.transitionProperty || undefined,
      props: [...new Set(k.flatMap((x) => Object.keys(x).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))].join(','),
      from: k[0] && k[0].opacity != null ? 'opacity ' + k[0].opacity : undefined,
      playState: a.playState, fill: t.fill, delay: t.delay, duration: t.duration, currentTime: a.currentTime == null ? null : Math.round(a.currentTime), progress: t.progress, pending: a.pending };
  };
  const an = (r) => (r && r.getAnimations ? r.getAnimations().map(one) : []);
  const ha = document.querySelector('home-assistant'), hass = ha && ha.hass;
  const pops = deep(document, 'bubble-card').filter((b) => b.config && b.config.hash === '#klima');
  const pop = pops[0];
  const tags = ['msh-klima-card', 'msh-klima-hero-card', 'ki-klima-card'];
  const el = deep(document, 'msh-klima-card')[0] || deep(document, 'ki-klima-card')[0];
  const snap = () => {
    const sr = el && el.shadowRoot, hc = sr && sr.querySelector('ha-card'), slot = sr && sr.querySelector('.msh-hero-slot');
    const hero = slot && slot.querySelector('msh-klima-hero-card'), hs = hero && hero.shadowRoot, kh = hs && hs.querySelector('.kh');
    // Kjeden fra kortet opp til popupen: finner hvem som er skjult / 0 høy
    const chain = []; for (let n = el, i = 0; n && i < 14; n = up(n), i++) { if (n.nodeType === 1) chain.push(st(n)); if (n.classList && n.classList.contains('bubble-pop-up')) break; }
    // Usynlige elementer inne i kortet (opacity < 0.05 eller visibility hidden) – første 12
    const skjult = []; if (sr) { const w = (r) => r.querySelectorAll('*').forEach((x) => { const c = getComputedStyle(x); if (skjult.length < 12 && (Number(c.opacity) < 0.05 || c.visibility === 'hidden') && x.getBoundingClientRect().height > 0) skjult.push(nm(x) + ' op=' + c.opacity + ' vis=' + c.visibility); if (x.shadowRoot) w(x.shadowRoot); }); w(sr); }
    return {
      host: st(el), haCard: st(hc), heroSlot: st(slot), hero: st(hero), heroKh: st(kh), heroFirst: st(kh && kh.firstElementChild), first: st(hc && [...hc.children].find((x) => !x.classList.contains('msh-hero-slot'))),
      children: hc ? [...hc.children].map((x) => nm(x) + ' h=' + Math.round(x.getBoundingClientRect().height)) : null,
      shadowChildren: sr ? sr.childElementCount : null, html: sr ? sr.innerHTML.length : null, heroHtml: hs ? hs.innerHTML.length : null,
      text: hc ? hc.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null, feilkort: sr ? !!sr.querySelector('.msh-fail') : null,
      anims: [...an(el), ...an(sr), ...an(hero), ...an(hs)],
      skjult, chain,
      state: el ? { open: el._open, isOpen: el.isOpen, firstRender: el._firstRender, raf: el._raf, force: el._force, busy: el._busy, pickerFocus: el._pickerFocus, hasHass: !!(el._hass || el.hass), heroEl: !!el._heroEl, heroConnected: !!(el._heroEl && el._heroEl.isConnected), tab: el._ui && el._ui.tab } : null,
      config: el ? (el._config || el.config) : null,
    };
  };
  const ki = hass && hass.entities ? Object.values(hass.entities).filter((e) => e.platform === 'ki_energi') : [];
  const statusId = (window.MSH && window.MSH.klimaMapId && window.MSH.klimaMapId('sensor.ki_energi_status')) || 'sensor.ki_energi_status';
  const res = {
    versjon: window.KI_MSH_VERSION || null, hash: location.hash, ua: navigator.userAgent, hidden: document.hidden, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    defined: Object.fromEntries(tags.map((t) => [t, !!customElements.get(t)])), bubble: !!customElements.get('bubble-card'), huiCard: !!customElements.get('hui-card'),
    popups: pops.length, popup: !!pop, popupOpen: pop ? deep(pop.shadowRoot || pop, '.bubble-pop-up.is-popup-opened').length > 0 || !!(pop.querySelector && pop.querySelector('.is-popup-opened')) : null,
    cards: pop && pop.config.cards ? pop.config.cards.map((c) => c.type) : null,
    antall: Object.fromEntries(tags.map((t) => [t, deep(document, t).length])),
    el: !!el, tag: el && el.localName, connected: el && el.isConnected, hass: !!hass,
    status: { id: statusId, state: hass && hass.states[statusId] ? hass.states[statusId].state : undefined, kiEntiteter: ki.length, registerId: (ki.find((e) => e.translation_key === 'ki_energi_status' || /ki_energi_status/.test(e.entity_id)) || {}).entity_id },
    fase1: snap(),
  };
  // Fase 2: be kortet tegne seg på nytt og se om noe endrer seg (blokkert tegning / animasjon som henger)
  if (el && el.update) { try { el.update(); } catch (e) { res.updateFeil = String(e && e.message || e); } }
  await new Promise((r) => setTimeout(r, 800));
  res.fase2 = snap();
  const txt = JSON.stringify(res, null, 1);
  try { copy(txt); } catch (e) { /* copy() finnes bare i Chrome-konsollen */ }
  console.log(txt);
  return res;
})();
```

## Hva svaret betyr

| Utfall | Betyr | Tiltak |
|---|---|---|
| `popup: false`, eller `cards` uten `custom:msh-klima-card` | Strategien/YAML lager feil popup (eller `#klima` finnes dobbelt: `popups > 1`) | Rett popup-configen (`popup_overrides`, `custom_popups`). |
| `defined['msh-klima-card']: false` | ki-msh-bundelen er ikke lastet (ressursen mangler eller er gammel/cachet) | Sjekk ressursen `/hacsfiles/ki-msh/ki-msh.js`, tøm cache. `versjon` viser hvilken bundel som kjører. |
| `el: false` | Bubble har ikke laget kortet (lat lasting: plassholder `.card.is-placeholder`) | Se `chain`/`popupOpen`. |
| `tag: 'ki-klima-card'` | Gammelt kortnavn i popupen | Strategien retter dette; lagre dashbordet på nytt. |
| `state.hasHass: false` | Kortet har aldri fått `hass` | Kortet henter nå `hass` fra `home-assistant` selv (fiks 16.13). |
| `html: 0` / `shadowChildren: 0` | Tegningen har ikke kjørt | Se `state.raf`/`force`/`pickerFocus` (blokkert tegning) og konsollen for `msh-klima-card`-feil. |
| `host.height: 0` eller en `chain`-rad med `display: none` / `height: 0` | Et foreldreelement (Bubble/HA `hui-card`) skjuler kortet | Raden i `chain` viser hvilket. |
| `opacity` 0 / `visibility: hidden` på `host`, `haCard`, `hero`, `heroKh` eller i `skjult` | Noe er gjennomsiktig. Se `anims`: en animasjon med `fill: backwards/both`, `playState: 'paused'/'running'`, `currentTime` < `delay` og `from: 'opacity 0'` holder innholdet skjult | Animasjonene startes nå bare fra synlig tilstand (fiks 16.13). |
| `feilkort: true` | Kortet tegnet et feilkort; `text` viser meldingen | Meld feilmeldingen. |
| `fase1` tom, `fase2` fylt | Tegningen var blokkert, men gikk etter `update()` | Meld begge. |
| `status.state` `unavailable`/`undefined` | KI Energi er ikke klar | Kortet viser «Venter på KI Energi», aldri tom flate. |

Etter fiks 16.13 viser kortet alltid et skjelett (hero med «–» + faner) fra første øyeblikk, og etter 3 s uten synlig innhold (høyde 0 eller opacity 0) et feilkort med det samme diagnoseobjektet – kopier det derfra.
