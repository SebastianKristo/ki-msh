// Fiks 23.7 · Onboarding (1a) og «Tilpass alt» (1b), 54-onboarding.js.
//  · vises ikke i testharnessen uten window.__kiOnboard (ingen <home-assistant>) – eksisterende tester blokkeres ikke
//  · tallene i steg 0 = hass (områder, personer, lys …), hvert steg lagres i ki-store når man går videre
//  · strategien lager ikke popups som er slått av (popups.<id>.hidden), navbar/header speiler valgene
//  · Tilpass alt: søk finner hurtigvalg, hurtigvalg ↔ samme config som det fulle arket, gjennomgangen huskes etter omlasting
//  · «Mer»-menyen har «Tilpass alt» øverst blant verktøyene, Tilpass Hjem har lenken, «Kjør oppsettet på nytt»
// Kjør: node test/onboarding-check.mjs   (SHOT_DIR=… for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/onboarding-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const SHOT = process.env.SHOT_DIR;
let fail = 0;
const ok = (c, m, info) => { console.log((c ? 'OK   ' : 'FEIL ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 400) : '')); if (!c) fail++; };

async function boot(ud) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate((ud) => { localStorage.clear(); localStorage.setItem('ki-device-id', 'testenhet'); localStorage.setItem('browser_mod-browser-id', 'fold-123'); localStorage.setItem('ki_kiosk_applied', ''); window.__userData = ud || {}; }, ud);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    const H = window.mockHass(); window.H = H;
    const ws = H.callWS;
    window.__pupd = [];
    H.callWS = (m) => {
      if (m.type === 'config/device_registry/list') return ws(m).then((d) => [...(d || []), { id: 'bm1', name: 'Pixel Fold', identifiers: [['browser_mod', 'fold-123']] }]);
      if (m.type === 'person/update') { window.__pupd.push(m); return Promise.resolve({}); }
      return ws(m);
    };
    window.MSH.lastHass = H;
    await window.MSH.store.load(H);
    // strategien (samme som i HA) → MSH.strategyConfig / popupReport
    window.__view = await window.MSH.generateDashboardView({}, H);
    const hj = document.createElement('msh-hjem-card'); hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); hj.hass = H;
    const nb = document.createElement('msh-navbar-card'); const nc = window.__view.cards[0].cards.find((c) => c.type === 'custom:msh-navbar-card'); nb.setConfig(nc); nb.hass = H;
    document.getElementById('dash').append(hj, nb);
    await new Promise((q) => setTimeout(q, 1500));
  });
  return { p, errs };
}
const sheet = (p) => p.evaluate(() => { const P = window.MSH.portals(); const h = P[P.length - 1]; return h ? h.shadowRoot.querySelector('.body').innerText.replace(/\s+/g, ' ').trim() : ''; });
const click = (p, sel) => p.evaluate((sel) => { const P = window.MSH.portals(); const r = P[P.length - 1].shadowRoot; const el = r.querySelector(sel); if (!el) return false; el.click(); return true; }, sel);
const ud = (p) => p.evaluate(() => JSON.parse(JSON.stringify((window.__userData || {}).ki_dashboard || {})));
const flush = (p) => p.evaluate(async () => { window.MSH.store.flush(); await new Promise((q) => setTimeout(q, 900)); window.MSH.store.flush(); await new Promise((q) => setTimeout(q, 200)); });

/* ---------------- 1 · ikke i harnessen uten flagget */
{
  const { p, errs } = await boot({});
  const n = await p.evaluate(() => window.MSH.portals().length);
  ok(n === 0, 'onboarding vises ikke i testharnessen (ingen <home-assistant>, ingen __kiOnboard)', n);
  const facts = await p.evaluate(() => { const H = window.H, M = window.MSH; return { areas: M.areas(H).length, persons: M.all(H, 'person').length, lights: M.all(H, 'light').length, media: M.all(H, 'media_player').length, climate: M.all(H, 'climate').length, sensors: M.all(H, 'sensor').length, persIds: M.all(H, 'person'), areaIds: M.areas(H).filter((a) => !M.roomBlocked(H, a.id)).map((a) => a.id), rooms: M.areas(H).filter((a) => !M.roomBlocked(H, a.id)).length, blocked: M.areas(H).filter((a) => M.roomBlocked(H, a.id)).map((a) => a.id), fnKeys: M.FUNCTION_POPUPS.map((f) => f[0].slice(1)), fnAlias: Object.keys(M.HASH_ALIAS || {}).map((a) => a.slice(1)) }; });

  /* ---------------- 2 · onboarding med flagget */
  await p.evaluate(() => { window.__kiOnboard = true; window.MSH.onboardMaybe(window.H); });
  await p.waitForTimeout(900);
  let t = await sheet(p);
  // Fiks 59: første steg er «Språk / Language» (norsk valgt som standard)
  ok(/Språk \/ Language/.test(t) && /Norsk/.test(t) && /English/.test(t), 'steg «Språk / Language» først', t.slice(0, 80));
  await click(p, '[data-a="lnext"]'); await p.waitForTimeout(3600);
  t = await sheet(p);
  ok(/Hei, Sebastian\./.test(t), 'steg 0: «Hei, Sebastian.»', t.slice(0, 80));
  const scan = await p.evaluate(() => { const P = window.MSH.portals(); return [...P[P.length - 1].shadowRoot.querySelectorAll('.scan .row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()); });
  const num = (l) => { const r = scan.find((x) => x.startsWith(l)); return r ? r.slice(l.length).trim() : null; };
  ok(num('Områder') === String(facts.areas) && num('Personer') === String(facts.persons) && num('Lys') === String(facts.lights) && num('Mediaspillere') === String(facts.media) && num('Termostater') === String(facts.climate) && num('Sensorer') === String(facts.sensors), 'steg 0: ekte antall fra hass', { scan, facts });
  ok(/KI Rom-integrasjon \d+ rom/.test(scan.join('|')), 'steg 0: KI Rom-integrasjonen funnet', scan);
  const full = await p.evaluate(() => { const P = window.MSH.portals(), h = P[P.length - 1], s = h.shadowRoot.querySelector('.sh').getBoundingClientRect(); return { w: s.width, h: s.height, t: s.top, vw: innerWidth, vh: innerHeight }; });
  ok(full.w === full.vw && Math.abs(full.h - full.vh) < 2 && full.t === 0, 'fullskjerm-ark på mobil', full);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-0.png' });

  await click(p, '[data-a="start"]'); await p.waitForTimeout(200);
  t = await sheet(p);
  ok(/Hvem bor her/.test(t) && /Hopp over/.test(t), 'steg 1: personer + toppen (tilbake, progresjon, Hopp over)', t.slice(0, 120));
  const segs = await p.evaluate(() => { const P = window.MSH.portals(); return P[P.length - 1].shadowRoot.querySelectorAll('.prog i').length; });
  ok(segs === 6, 'progresjon i 6 segmenter', segs);
  // person 2 skjules, «Meg» på person 1
  const p2 = facts.persIds[1] || facts.persIds[0];
  await click(p, `[data-a="pvis"][data-v="${p2}"]`);
  await click(p, `[data-a="me"][data-v="${facts.persIds[0]}"]`); await p.waitForTimeout(100);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-1.png' });
  await click(p, '[data-a="next"]'); await p.waitForTimeout(150);
  let U = await p.evaluate(() => window.MSH.store.get('header_profiles'));
  const hp = U && Object.values(U).find((v) => v && v.people_hidden);
  ok(hp && hp.people_hidden.includes(p2), 'steg 1 lagret: people_hidden i header_profiles (som Tilpass header)', U);

  // steg 2: rom av + farge
  t = await sheet(p);
  ok(/Rom/.test(t) && new RegExp(facts.rooms + ' områder').test(t), 'steg 2: ett kort per område (ikke «Basseng» – bassengpopupen er slettet)', t.slice(0, 160));
  const bl = await p.evaluate((ids) => { const P = window.MSH.portals(), r = P[P.length - 1].shadowRoot; return ids.filter((id) => r.querySelector(`[data-a="rtog"][data-v="${id}"]`)); }, facts.blocked);
  ok(facts.blocked.includes('basseng') && !bl.length, 'steg 2: området «Basseng» foreslås ikke som rom', { blocked: facts.blocked, bl });
  const room = facts.areaIds.find((a) => a === 'stue') || facts.areaIds[0], room2 = facts.areaIds.find((a) => a !== room && !facts.fnKeys.includes(a) && !facts.fnAlias.includes(a)); // 30.1: alias-hasher (f.eks. #nibe) er ikke rom
  await click(p, `[data-a="rtog"][data-v="${room2}"]`);
  await click(p, `[data-a="rcol"][data-v="${room}"]`); await p.waitForTimeout(80);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-2.png' });
  await click(p, '[data-a="next"]'); await p.waitForTimeout(150);
  U = await p.evaluate((r) => ({ hid: window.MSH.store.get('popups.' + r[1]), col: window.MSH.store.get('rooms.' + r[0] + '.look.col') }), [room, room2]);
  ok(U.hid && U.hid.hidden === true && /^var\(--/.test(U.col || ''), 'steg 2 lagret: popups.<rom>.hidden + rooms.<rom>.look.col', U);

  // steg 3: Lys av, funksjoner uten entiteter står av med rød tekst
  t = await sheet(p);
  ok(/Funksjoner/.test(t) && /Lys/.test(t) && /Søppel/.test(t), 'steg 3: funksjonsrader', t.slice(0, 200));
  const red = await p.evaluate(() => { const P = window.MSH.portals(); return [...P[P.length - 1].shadowRoot.querySelectorAll('.row')].filter((r) => r.querySelector('.red')).map((r) => [r.dataset.v, r.querySelector('.sw').classList.contains('on')]); });
  ok(red.every((x) => !x[1]), 'funksjoner uten entiteter står av («Ingen entiteter funnet»)', red);
  const fnRows = await p.evaluate(() => { const P = window.MSH.portals(); return [...P[P.length - 1].shadowRoot.querySelectorAll('button.row[data-v]')].map((r) => r.dataset.v); });
  ok(fnRows.length > 3 && !fnRows.some((v) => /basseng|pool/.test(v)) && !/Basseng/.test(t), 'steg 3: Basseng foreslås ikke (bassengpopupen er slettet)', fnRows);
  await click(p, 'button.row[data-v="lys"]'); await p.waitForTimeout(60);
  await click(p, '[data-a="next"]'); await p.waitForTimeout(150);
  U = await p.evaluate(() => window.MSH.store.get('popups.lys'));
  ok(U && U.hidden === true, 'steg 3 lagret: popups.lys.hidden', U);

  // steg 4: navbar – maks 5 med toast
  const chips = await p.evaluate(() => { const P = window.MSH.portals(); return [...P[P.length - 1].shadowRoot.querySelectorAll('[data-a="nav"]')].map((c) => c.dataset.v); });
  ok(!chips.includes('lys') && !chips.includes('soppel') && !chips.includes('basseng'), 'steg 4: bare påslåtte funksjoner med popup som chips', chips);
  // nullstill valget og velg i ny rekkefølge
  for (const k of chips) { const on = await p.evaluate((k) => { const P = window.MSH.portals(); return P[P.length - 1].shadowRoot.querySelector(`[data-a="nav"][data-v="${k}"]`).classList.contains('on'); }, k); if (on) await click(p, `[data-a="nav"][data-v="${k}"]`); }
  const want = chips.slice(0, 6);
  for (const k of want) await click(p, `[data-a="nav"][data-v="${k}"]`);
  await p.waitForTimeout(60);
  const toast = await p.evaluate(() => { const t = window.MSH.overlayRoot().querySelector('#msh-toast'); return t ? t.textContent : ''; });
  ok(want.length < 6 || /Maks fem/.test(toast), 'sjette valg gir toasten «Maks fem · resten ligger i «Mer»»', { toast, want });
  const pill = await p.evaluate(() => { const P = window.MSH.portals(); return P[P.length - 1].shadowRoot.querySelectorAll('.pill ha-icon').length; });
  ok(pill === Math.min(5, want.length) + 1, 'navbaren vises live (ikoner + more_horiz)', pill);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-4.png' });
  await click(p, '[data-a="next"]'); await p.waitForTimeout(150);
  U = await p.evaluate(() => window.MSH.store.get('cards.ki-navbar'));
  ok(U && JSON.stringify(U.bar) === JSON.stringify(want.slice(0, 5)) && Array.isArray(U.more), 'steg 4 lagret: bar/more i navbar-configen', U);

  // steg 5: header
  await click(p, '[data-a="hmode"][data-v="hjem"]'); await click(p, '[data-a="hsize"][data-v="L"]'); await click(p, '[data-a="hname"]'); await p.waitForTimeout(60);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-5.png' });
  await click(p, '[data-a="next"]'); await p.waitForTimeout(150);
  U = await p.evaluate(() => window.MSH.hjemHeaderProfile());
  ok(U.mode === 'hjem' && U.size === 'L' && U.show_name === true, 'steg 5 lagret: header-profil (mode/size/show_name)', U);

  // steg 6: enhet
  t = await sheet(p);
  const nm = await p.evaluate(() => { const P = window.MSH.portals(); const i = P[P.length - 1].shadowRoot.querySelector('[data-in="dname"]'); return i ? i.value : null; });
  ok(/Denne enheten/.test(t) && /fold-123/.test(t), 'steg 6: denne enheten (Browser Mod-ID)', t.slice(0, 160));
  ok(nm === 'Pixel Fold' || !!nm, 'steg 6: enhetsnavn fra Browser Mod', nm);
  await click(p, '[data-a="dhap"]'); await click(p, '[data-a="dside"]'); await p.waitForTimeout(60);
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-6.png' });
  const btn = await p.evaluate(() => { const P = window.MSH.portals(); return P[P.length - 1].shadowRoot.querySelector('[data-a="next"]').textContent.trim(); });
  ok(btn === 'Fullfør', '«Fullfør» på steg 6', btn);
  await click(p, '[data-a="next"]'); await p.waitForTimeout(300);
  U = await p.evaluate(() => ({ off: window.MSH.hapticOff(), k: window.MSH.store.get('kiosk.devices.fold-123'), ob: window.MSH.store.get('onboarded'), known: window.MSH.store.get('onboard_known') }));
  ok(U.off === true && U.k && U.k.on && U.k.hide.includes('hide_sidebar') && U.ob === true && Array.isArray(U.known), 'Fullfør: haptikk av, sidebaren skjult (kiosk.devices), onboarded: true', U);
  t = await sheet(p);
  ok(/Dashbordet er klart\./.test(t) && /Endre ›/.test(t) && /Åpne dashbordet/.test(t), 'steg 7: oppsummering med «Endre ›»', t.slice(0, 200));
  if (SHOT) await p.screenshot({ path: SHOT + '/ob-7.png' });
  // «Endre ›» hopper til steget og tilbake
  await click(p, '[data-a="goto"][data-v="4"]'); await p.waitForTimeout(80);
  t = await sheet(p);
  ok(/Navbar/.test(t) && /Ferdig/.test(t), '«Endre ›» → steg 4, knappen heter «Ferdig»', t.slice(0, 80));
  await click(p, '[data-a="next"]'); await p.waitForTimeout(80);
  t = await sheet(p);
  ok(/Dashbordet er klart/.test(t), 'tilbake til oppsummeringen', t.slice(0, 60));
  await click(p, '[data-a="open"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.MSH.portals().length === 0), '«Åpne dashbordet» lukker');

  // strategien speiler valgene
  await flush(p);
  const S = await p.evaluate(async (r) => { const v = await window.MSH.generateDashboardView({}, window.H); const cs = v.cards[0].cards; return { hashes: cs.filter((c) => c.card_type === 'pop-up').map((c) => c.hash), nav: cs.find((c) => c.type === 'custom:msh-navbar-card') }; }, [room, room2]);
  ok(!S.hashes.includes('#lys') && !S.hashes.includes('#' + room2) && S.hashes.includes('#' + room), 'strategien lager ikke av-slåtte popups (#lys, #' + room2 + ')', S.hashes);
  const saved = await ud(p);
  ok(saved.onboarded === true && saved.popups && saved.popups.lys && saved.popups.lys.hidden, 'lagret i HA (frontend/set_user_data)', Object.keys(saved));
  // flagget → vises ikke igjen
  await p.evaluate(() => { window.MSH.onboardMaybe(window.H); });
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.MSH.portals().length === 0), 'vises bare én gang (onboarded: true)');
  if (errs.length) console.log('sidefeil:', errs);
  ok(!errs.length, 'ingen sidefeil (onboarding)', errs);

  /* ---------------- 3 · Tilpass alt */
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'tilpass-alt' } })));
  await p.waitForTimeout(300);
  t = await sheet(p);
  ok(/Tilpass alt/.test(t) && /Ferdig/.test(t) && /Gå gjennom alt/.test(t) && /Dashbord/.test(t) && /Avansert/.test(t), 'Tilpass alt: liste med grupper og «Gå gjennom alt»', t.slice(0, 200));
  if (SHOT) await p.screenshot({ path: SHOT + '/ta-list.png' });
  // søk etter hurtigvalg
  await p.evaluate(() => { const P = window.MSH.portals(); const i = P[P.length - 1].shadowRoot.querySelector('[data-in="q"]'); i.value = 'navn under'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
  await p.waitForTimeout(100);
  t = await sheet(p);
  ok(/Header/.test(t) && /Hurtigvalg · Vis navn under bildene/.test(t), 'søket finner hurtigvalg', t.slice(0, 200));
  await click(p, '[data-a="sel"][data-v="header"]'); await p.waitForTimeout(100);
  t = await sheet(p);
  ok(/Åpne «Tilpass header» ↗/.test(t) && /Hurtigvalg/.test(t), 'detalj: hurtigvalg + «Åpne «Tilpass header» ↗»', t.slice(0, 200));
  const hi = await p.evaluate(() => { const P = window.MSH.portals(); return !!P[P.length - 1].shadowRoot.querySelector('.hi'); });
  ok(hi, 'søketreffet er markert i detaljen');
  const q0 = await p.evaluate(() => window.MSH.hjemHeaderProfile().show_name);
  await click(p, '[data-a="qt"]'); await p.waitForTimeout(100);
  const q1 = await p.evaluate(() => window.MSH.hjemHeaderProfile().show_name);
  ok(q0 === true && q1 === false, 'hurtigvalg skriver til header-profilen (samme som Tilpass header)', { q0, q1 });
  // omvendt: endring fra «det fulle arket» (profileSet) vises i hurtigvalget
  await p.evaluate(() => window.MSH.profileSet('header_profiles', { show_name: true }));
  await p.waitForTimeout(150);
  const swOn = await p.evaluate(() => { const P = window.MSH.portals(); return P[P.length - 1].shadowRoot.querySelector('[data-a="qt"]').classList.contains('on'); });
  ok(swOn, 'endring i det fulle arket speiles i hurtigvalget');
  // «Åpne …» åpner det eksisterende arket oppå
  const nP = await p.evaluate(() => window.MSH.portals().length);
  await click(p, '[data-a="openfull"]'); await p.waitForTimeout(500);
  const nP2 = await p.evaluate(() => window.MSH.portals().length);
  ok(nP2 === nP + 1, '«Åpne «Tilpass header» ↗» åpner arket via ki-open-editor', { nP, nP2 });
  await p.evaluate(async () => { const P = window.MSH.portals(), top = P[P.length - 1]; const x = top.shadowRoot.querySelector('.bg'); x.click(); await new Promise((q) => setTimeout(q, 350)); });
  // funksjon: hurtigvalg «Vis popupen» = popups.<key>.hidden (Tilpass Hjem → Popups)
  await click(p, '[data-a="back"]'); await p.waitForTimeout(60);
  await p.evaluate(() => { const P = window.MSH.portals(); const i = P[P.length - 1].shadowRoot.querySelector('[data-in="q"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); });
  await p.waitForTimeout(60);
  const fnIds = await p.evaluate(() => { const P = window.MSH.portals(); return [...P[P.length - 1].shadowRoot.querySelectorAll('[data-a="sel"]')].map((e) => e.dataset.v).filter((x) => x.startsWith('fn:')); });
  ok(fnIds.length > 0, 'Funksjoner: én rad per aktiv popup', fnIds);
  const fk = fnIds.find((x) => x === 'fn:media') || fnIds[0];
  await click(p, `[data-a="sel"][data-v="${fk}"]`); await p.waitForTimeout(80);
  await click(p, '[data-a="qt"][data-i="0"]'); await p.waitForTimeout(80);
  const fh = await p.evaluate((k) => window.MSH.store.get('popups.' + k.slice(3)), fk);
  ok(fh && fh.hidden === true, 'funksjon: «Vis popupen» av → popups.<key>.hidden', fh);
  await click(p, '[data-a="qt"][data-i="0"]'); await p.waitForTimeout(80);
  await click(p, '[data-a="back"]'); await p.waitForTimeout(60);

  // gjennomgang: start, to «Ser bra ut», avbryt
  await click(p, '[data-a="review"]'); await p.waitForTimeout(100);
  t = await sheet(p);
  const m = /Steg (\d+) av (\d+) · (\w+)/.exec(t);
  ok(m && m[1] === '1', 'gjennomgang: «Steg 1 av N · gruppe»', t.slice(0, 80));
  await click(p, '[data-a="rvok"]'); await p.waitForTimeout(80);
  await click(p, '[data-a="rvok"]'); await p.waitForTimeout(80);
  await click(p, '[data-a="rvskip"]'); await p.waitForTimeout(80);
  t = await sheet(p);
  const m2 = /Steg (\d+) av/.exec(t);
  ok(m2 && m2[1] === '4', 'Ser bra ut / Hopp over går videre', t.slice(0, 60));
  await click(p, '[data-a="rvx"]'); await p.waitForTimeout(100);
  t = await sheet(p);
  ok(/2 av \d+ sjekket/.test(t) && /Fortsett/.test(t), '× avbryter, progresjonen beholdes (Fortsett)', t.slice(0, 260));
  if (SHOT) await p.screenshot({ path: SHOT + '/ta-review.png' });
  await click(p, '[data-a="close"]'); await p.waitForTimeout(300);
  await flush(p);
  const saved2 = await ud(p);
  ok(saved2.reviewed && Object.keys(saved2.reviewed).length === 2 && saved2.review_at, 'reviewed + review_at lagret i ki-store', { r: saved2.reviewed, at: saved2.review_at });

  // «Mer»-menyen: «Tilpass alt» øverst blant verktøyene
  await p.waitForTimeout(800);
  const nav = await p.evaluate(async () => {
    const btn = window.deep('nav.nb [data-id="__more"]'); if (!btn) return null;
    btn.click(); await new Promise((q) => setTimeout(q, 500));
    const ids = window.deepAll('.mbox .mi').map((e) => e.dataset.id);
    return ids.filter((x) => x.startsWith('__'));
  });
  // 24.5: én «Tilpass»-knapp i «Mer» → arket med «Tilpass alt» øverst
  ok(nav && nav.length === 1 && nav[0] === '__tilpass', '«Mer»: én «Tilpass»-knapp blant verktøyene', nav);
  if (nav) {
    await p.evaluate(async () => { window.deep('.mbox .mi[data-id="__tilpass"]').click(); await new Promise((q) => setTimeout(q, 400)); });
    const rows = await p.evaluate(() => { const P = window.MSH.portals(), h = P.find((x) => x.hasAttribute('data-tilpass')); return h ? [...h.shadowRoot.querySelectorAll('.tpr')].map((e) => e.dataset.v) : null; });
    ok(rows && rows[0] === 'alt', '«Tilpass»-arket: «Tilpass alt» øverst', rows);
    await p.evaluate(async () => { const h = window.MSH.portals().find((x) => x.hasAttribute('data-tilpass')); h.shadowRoot.querySelector('.tpr[data-v="alt"]').click(); await new Promise((q) => setTimeout(q, 400)); });
    t = await sheet(p);
    ok(/Tilpass alt/.test(t), '«Mer» → Tilpass alt åpner arket', t.slice(0, 40));
    await p.evaluate(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((q) => setTimeout(q, 350)); });
  }
  // Tilpass Hjem: lenke øverst
  await p.evaluate(() => window.MSH.openHomeEditor({})); await p.waitForTimeout(500);
  const link = await p.evaluate(() => { const P = window.MSH.portals(); const el = P[P.length - 1].shadowRoot.querySelector('[data-a="tall"]'); return el ? el.textContent.trim() : null; });
  ok(link && /Tilpass alt/.test(link), 'Tilpass Hjem: lenke «Tilpass alt ›» øverst', link);
  if (link) { await click(p, '[data-a="tall"]'); await p.waitForTimeout(500); t = await sheet(p); ok(/Gå gjennom alt/.test(t), 'lenken åpner Tilpass alt', t.slice(0, 60)); }
  await p.evaluate(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((q) => setTimeout(q, 350)); });
  // GUI-editoren til msh-hjem-card: knapp
  const gui = await p.evaluate(() => { const S0 = customElements.get('msh-hjem-card').schema, S = typeof S0 === 'function' ? S0(window.H, {}) : S0; /* Fiks 55 B3: schema kan være (hass, config) => [] */ const s = S.find((x) => x.id === 'tilpass_alt'); return s ? s.fields.map((f) => f.label) : null; });
  ok(gui && gui.includes('Tilpass alt'), 'GUI-editoren (msh-hjem-card) har knappen «Tilpass alt»', gui);
  // Kjør oppsettet på nytt → onboarding med dagens valg
  await p.evaluate(() => window.MSH.openTilpassAlt({ id: 'rerun' })); await p.waitForTimeout(200);
  await click(p, '[data-a="rerun"]'); await p.waitForTimeout(300);
  t = await sheet(p);
  const offP = await p.evaluate((id) => { const P = window.MSH.portals(); const r = P[P.length - 1].shadowRoot.querySelector(`[data-a="pvis"][data-v="${id}"]`); return r ? !r.classList.contains('on') : null; }, p2);
  ok(/Hvem bor her/.test(t) && offP === true, '«Kjør oppsettet på nytt» åpner onboarding med dagens valg', { t: t.slice(0, 60), offP });
  await p.evaluate(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((q) => setTimeout(q, 350)); });
  ok(!errs.length, 'ingen sidefeil (Tilpass alt)', errs);
  var carry = { ...saved2, kiosk: undefined }; // kiosk per enhet ville lastet siden på nytt (kioskTick) – ikke det som testes her
  await p.close();
}

/* ---------------- 4 · gjennomgangen husker hvor man var etter omlasting */
{
  const { p, errs } = await boot(JSON.parse(JSON.stringify({ ki_dashboard: carry })));
  const n0 = await p.evaluate(() => window.MSH.portals().length);
  await p.evaluate(() => window.MSH.openTilpassAlt({})); await p.waitForTimeout(200);
  let t = await sheet(p);
  ok(/2 av \d+ sjekket/.test(t) && /Fortsett/.test(t), 'etter omlasting: 2 sjekket, «Fortsett»', t.slice(0, 200));
  await click(p, '[data-a="review"]'); await p.waitForTimeout(100);
  t = await sheet(p);
  ok(/Steg 4 av/.test(t), 'fortsetter der man var (review_at = steg 4)', t.slice(0, 60));
  ok(n0 === 0, 'ingen onboarding når onboarded: true', n0);
  const dot = await p.evaluate(() => { const M = window.MSH, d0 = M.tilpassAltDot(); window.H.areas.nyttrom = { area_id: 'nyttrom', name: 'Nytt rom' }; const d1 = M.tilpassAltDot(); window.MSH.store.set('reviewed', { ...(M.store.get('reviewed') || {}), 'rom:nyttrom': true }); const d2 = M.tilpassAltDot(); delete window.H.areas.nyttrom; return [d0, d1, d2]; });
  ok(dot[0] === false && dot[1] === true && dot[2] === false, 'nytt rom etter oppsettet → prikk på «Tilpass alt» til det er sjekket', dot);
  ok(!errs.length, 'ingen sidefeil (omlasting)', errs);
  await p.close();
}
/* ---------------- 5 · «Bruk standard og hopp over» */
{
  const { p, errs } = await boot({});
  await p.evaluate(() => window.MSH.openOnboarding({ step: 0 })); await p.waitForTimeout(300);
  await click(p, '[data-a="std"]'); await p.waitForTimeout(200);
  const t = await sheet(p);
  const U = await p.evaluate(() => ({ ob: window.MSH.store.get('onboarded'), pops: window.MSH.store.get('popups') || null, nav: window.MSH.store.get('cards.ki-navbar') || null }));
  ok(/Dashbordet er klart/.test(t) && U.ob === true && !U.pops && !U.nav, '«Bruk standard og hopp over» → steg 7, standardoppsett (ingenting overstyrt)', U);
  ok(!errs.length, 'ingen sidefeil (hopp over)', errs);
  await p.close();
}
await b.close();
console.log(fail ? `${fail} feil` : 'Alt OK');
process.exit(fail ? 1 : 0);
