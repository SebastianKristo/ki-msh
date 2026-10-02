// Selvtest for msh-navbar-card i harnessen (kjøres kun når et navbar-kort ligger i #dash).
// Feil rapporteres med console.error → smoke-testen feiler. Sjekker:
//  - portalen eies av kortet: fjernes ved disconnect (og padding på dashbordet nullstilles), kommer tilbake ved connect
//  - åpen-prikk: location.hash = knappens hash → prikk (scale 1) under ikonet; standardprofil har ingen pille
//  - liquid glass: ingen prikk, men kapsel (.ind) over valgt fane: top/bottom 4, høyde 56, bredde = én fane; navbaren 64 px
//  - navigasjon (kun over http – file:// tillater ikke pushState til annen sti): /annet-dashbord skjuler, retur viser
(function () {
  if (/harness-bubble/.test(location.pathname)) return; // ikke i Bubble-sjekklisten (endrer hash)
  const t0 = Date.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const portal = () => document.querySelector('.msh-navbar-portal');
  const fail = (m) => console.error('[navbar-selvtest] ' + m);
  async function run(card) {
    const dash = document.getElementById('dash');
    const parent = card.parentNode, next = card.nextSibling;
    // 1) disconnect / connect
    card.remove();
    await sleep(30);
    if (portal()) fail('portalen finnes etter at kortet er fjernet');
    if (dash.style.paddingBottom || dash.style.paddingLeft) fail('reserve_space-padding ble ikke fjernet ved disconnect');
    card.hass = { ...card.hass }; // hass-oppdatering på frakoblet kort skal ikke lage portal
    await sleep(40);
    if (portal()) fail('frakoblet kort laget portal ved hass-oppdatering');
    parent.insertBefore(card, next);
    await sleep(80);
    if (!portal()) fail('portalen kom ikke tilbake ved connect');
    // 2) navigasjon bort / tilbake
    if (location.protocol.indexOf('http') === 0) {
      const orig = location.pathname + location.search;
      history.pushState(null, '', '/annet-dashbord');
      window.dispatchEvent(new CustomEvent('location-changed'));
      await sleep(60);
      if (portal()) fail('navbaren vises i et annet dashbord');
      history.pushState(null, '', orig);
      window.dispatchEvent(new CustomEvent('location-changed'));
      await sleep(60);
      if (!portal()) fail('navbaren kom ikke tilbake ved retur til dashbordet');
    }
    // 3) åpen-prikk
    const cfg = card.config || {};
    const bar = Array.isArray(cfg.bar) ? cfg.bar : ['vanning', 'media', 'klima', 'ruter'];
    if (!bar.includes('klima') || !portal()) return;
    location.hash = '#klima';
    await sleep(380);
    const nav = portal().shadowRoot.querySelector('nav');
    const btn = nav && nav.querySelector('.it[data-id="klima"]');
    const od = btn && btn.querySelector('.od');
    const ind = nav.querySelector('.ind');
    if (cfg.style === 'glass') {
      await sleep(450); // kapselen glir på plass (.5 s fjær)
      if (!btn || !btn.classList.contains('open')) fail('valgt fane markeres ikke for #klima');
      if (od) fail('glass-profil viser prikk under navnet');
      const nr = nav.getBoundingClientRect(), ir = ind && ind.getBoundingClientRect(), br = btn && btn.getBoundingClientRect();
      if (!nav.classList.contains('rail')) {
        if (Math.round(nr.height) !== 64) fail('glass-navbaren er ' + Math.round(nr.height) + ' px høy (skal være 64)');
        if (!ir || Math.round(ir.top - nr.top) !== 4 || Math.round(ir.height) !== 56 || Math.abs(ir.left - br.left) > 1 || Math.abs(ir.width - br.width) > 1) fail('glass-kapselen dekker ikke valgt fane (top 4, høyde 56, bredde = én fane)');
      }
    } else if (!od || !btn.classList.contains('open') || getComputedStyle(od).transform !== 'matrix(1, 0, 0, 1, 0, 0)') fail('åpen-prikk vises ikke for #klima');
    if (cfg.style !== 'glass' && ind && getComputedStyle(ind).display !== 'none') fail('standardprofil viser pille bak ikonet');
    if (cfg.style === 'glass' && (!ind || getComputedStyle(ind).opacity !== '1')) fail('glass-profil mangler pille for valgt fane');
    history.replaceState(null, '', location.pathname + location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await sleep(60);
    if (nav.querySelector('.it.open')) fail('åpen-prikk forsvant ikke da hashen ble fjernet');
  }
  const iv = setInterval(() => {
    if (Date.now() - t0 > 4000) return clearInterval(iv);
    const card = document.querySelector('#dash > msh-navbar-card');
    if (!card || !portal()) return;
    clearInterval(iv);
    run(card).catch((e) => fail(e.message));
  }, 40);
})();
