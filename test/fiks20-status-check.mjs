// Fiks 20.5 («Tilpass header» → Status og soner: ikon/farge for Hjemme, Sover, Borte + MSH.personStatus) og
// 20.9 (sticky live forhåndsvisning i «Tilpass Hjem» → Tekst og i prosa-kortets GUI-editor).
// Kjør: node test/fiks20-status-check.mjs  (skjermbilder: SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f20s-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let bad = 0;
const ok = (name, cond, info) => { if (!cond) bad++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + R + 'test/harness.html');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ki-device-id', 'testenhet'); });
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
const wait = (ms) => page.waitForTimeout(ms);

/* ---------------- 20.5 · personStatus + Status og soner */
const st = await page.evaluate(async () => {
  const h = window.mockHass(); window.H = h;
  h.states['input_boolean.cybele_sover'] = { entity_id: 'input_boolean.cybele_sover', state: 'off', attributes: { friendly_name: 'Cybele sover' } };
  if (MSH.store) await MSH.store.load(h);
  const d = document.getElementById('dash'); d.innerHTML = '';
  const c = document.createElement('msh-hjem-header-card');
  c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hdr', badge: 'icon' }); c.hass = h; d.appendChild(c); window.HC = c;
  await new Promise((q) => setTimeout(q, 500));
  const icons = () => [...c.shadowRoot.querySelectorAll('.faces .bd ha-icon')].map((x) => x.getAttribute('icon'));
  const out = { def: { seb: MSH.personStatus(h, 'person.sebastian'), cyb: MSH.personStatus(h, 'person.cybele') }, icons0: icons() };
  // Tilpass header → Status og soner
  c.customize(); await new Promise((q) => setTimeout(q, 600));
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  const E = all().find((e) => e.localName === 'msh-hjem-editor'); window.E = E;
  const sec = E.shadowRoot.querySelector('details[data-focus="zones"]');
  sec.open = true; E._open = { ...(E._open || {}), 'id:zones': true }; E._render(); await new Promise((q) => setTimeout(q, 200));
  const S = E.shadowRoot.querySelector('details[data-focus="zones"]');
  out.sum = S.querySelector('summary').textContent.trim();
  out.rows = [...S.querySelectorAll('.xr .xrh b')].map((b) => b.textContent);
  // Åpne Hjemme → ikonvelger + fargevelger
  S.querySelector('[data-a="x-sopen"][data-k="home"]').click(); await new Promise((q) => setTimeout(q, 200));
  const S2 = E.shadowRoot.querySelector('details[data-focus="zones"]');
  out.homeOpen = { icon: !!S2.querySelector('[data-key="xst-home-b"] msh-icon-field, [data-key="xst-home-b"] ha-icon-picker, [data-key="xst-home-b"] [data-name="status.home.icon"]'), color: !!S2.querySelector('[data-key="xst-home-b"] [data-name="status.home.color"], [data-key="xst-home-b"] .sw, [data-key="xst-home-b"] [data-a]') };
  E._set('status.home.icon', 'mdi:home-heart');
  E._set('status.home.color', 'var(--blue)');
  E._set('status.away.icon', 'mdi:briefcase');
  await new Promise((q) => setTimeout(q, 400));
  out.store = JSON.parse(JSON.stringify(MSH.store.get('header_profiles') || {}));
  out.icons1 = icons();
  out.bg1 = [...c.shadowRoot.querySelectorAll('.faces .bd')].map((x) => x.style.background);
  out.after = { seb: MSH.personStatus(h, 'person.sebastian'), cyb: MSH.personStatus(h, 'person.cybele') };
  // Sover
  h.states['input_boolean.sebastian_sover'] = { entity_id: 'input_boolean.sebastian_sover', state: 'on', attributes: { friendly_name: 'Sebastian sover' } };
  c.hass = { ...h }; await new Promise((q) => setTimeout(q, 300));
  out.sleep = MSH.personStatus(c.hass, 'person.sebastian');
  out.chip = S2.querySelector('.xr[data-key="xst-home"] .xchip') ? E.shadowRoot.querySelector('.xr[data-key="xst-home"] .xchip ha-icon').getAttribute('icon') : null;
  // GUI-editoren: ha-icon-picker / farge for de tre (ha-icon-picker finnes ikke i harness → felles velger)
  const G = customElements.get('msh-hjem-header-card').getConfigElement(); G.hass = h; G.setConfig({ type: 'custom:msh-hjem-header-card' }); document.body.appendChild(G); await new Promise((q) => setTimeout(q, 300));
  out.gui = [...G.shadowRoot.querySelectorAll('[data-a="x-sopen"].xrh b')].map((b) => b.textContent);
  G.remove();
  E.close && E.close();
  return out;
});
ok('20.5 standard: Hjemme mdi:home grønn', st.def.seb.kind === 'home' && st.def.seb.icon === 'mdi:home' && /green/.test(st.def.seb.color) && st.def.seb.label === 'Hjemme', st.def.seb);
ok('20.5 standard: Borte mdi:airplane lilla', st.def.cyb.kind === 'away' && st.def.cyb.icon === 'mdi:airplane' && /purple/.test(st.def.cyb.color) && st.def.cyb.label === 'Borte', st.def.cyb);
ok('20.5 seksjonen heter «Status og soner»', /^Status og soner/.test(st.sum), st.sum);
ok('20.5 rekkefølge Hjemme · Sover · soner · Borte', st.rows[0] === 'Hjemme' && st.rows[1] === 'Sover' && st.rows[st.rows.length - 1] === 'Borte · annen sone' && st.rows.length >= 3, st.rows);
ok('20.5 Hjemme åpen: ikon- og fargevelger', st.homeOpen.icon && st.homeOpen.color, st.homeOpen);
ok('20.5 lagret i header-profilen (19.13)', Object.values(st.store).some((p) => p.status && p.status.home && p.status.home.icon === 'mdi:home-heart' && p.status.away.icon === 'mdi:briefcase'), st.store);
ok('20.5 personbildet viser nytt Hjemme-ikon med en gang', st.icons1.includes('mdi:home-heart'), st.icons1);
ok('20.5 MSH.personStatus følger oppsettet', st.after.seb.icon === 'mdi:home-heart' && /blue/.test(st.after.seb.color) && st.after.cyb.icon === 'mdi:briefcase', st.after);
ok('20.5 Sover som før (bedtime lilla, label Sover)', st.sleep.sleep === true && st.sleep.icon === 'bedtime' && /purple/.test(st.sleep.color) && st.sleep.label === 'Sover', st.sleep);
ok('20.5 raden viser valgt ikon', st.chip === 'mdi:home-heart', st.chip);
ok('20.5 GUI-editoren har de tre radene', ['Hjemme', 'Sover', 'Borte · annen sone'].every((x) => st.gui.includes(x)), st.gui);

/* ---------------- 20.9 · Tilpass Hjem → Tekst */
const tk = await page.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const E = MSH.openHomeEditor({ focus: 'tekst' }); window.TE = E; await w(500);
  E.u.sec = 'tekst'; E.u.proseSel = null; E.render(); await w(200);
  const pv = () => E.root.querySelector('[data-key="prev"]');
  const first = E.root.querySelector('.ed').children;
  const kids = [...first], tabsI = kids.findIndex((x) => x.matches && (x.matches('.seg,[role=tablist]') || x.querySelector('[data-a="sec"]')));
  const out = { afterTabs: tabsI + 1, first: kids.findIndex((x) => x === pv()), label: pv() && pv().querySelector('.xpzl').textContent, pos: pv() && getComputedStyle(pv()).position, mh: pv() && getComputedStyle(pv().querySelector('.xpzb')).maxHeight };
  // åpne setning 0 → markert
  E._act('psel', { i: '0' }); await w(200);
  out.mark = !!pv().querySelector('.pzm');
  // skriv: per tastetrykk
  const inp = E.root.querySelector('input[data-in="pf"][data-i="0"][data-f="pre"]');
  inp.focus(); inp.value = 'Hei Zebra'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  out.live = pv().querySelector('.pz').textContent.includes('Zebra');
  out.focus = E.root.activeElement === inp || document.activeElement === inp || (inp.getRootNode().activeElement === inp);
  // betingelse som skjuler setningen → gjennomstreket
  const L = E._proseRows(); L[0].cop = '='; L[0].csrc = L[0].src && L[0].src !== 'none' && L[0].src !== 'text' ? L[0].src : 'weather'; L[0].cval = 'finnes-ikke-xyz';
  E.saveP({ prose: L }); await w(400);
  out.off = !!pv().querySelector('.pzm.off');
  // trykk på en boble → åpner delen
  const chip = [...pv().querySelectorAll('.chip[data-a="pzsel"]')].find((c) => c.dataset.i !== '0');
  out.chipI = chip ? chip.dataset.i : null;
  if (chip) { chip.click(); await w(200); }
  out.sel = E.u.proseSel;
  // scroll arket ned → forhåndsvisningen står fortsatt øverst
  const sh = E.sheet; sh.scrollTop = 800; await w(200);
  const sr = sh.getBoundingClientRect(), pr = pv().getBoundingClientRect();
  out.sticky = { scroll: sh.scrollTop, top: Math.round(pr.top - sr.top), vis: pr.bottom > sr.top && pr.top < sr.top + 60 };
  return out;
});
if (SHOTS) await page.screenshot({ path: SHOTS + '/f20-tekst.png' });
await page.evaluate(() => TE.ov.close());
// 23.7 la «Tilpass alt ›» øverst i arket – forhåndsvisningen skal stå rett etter fanevelgeren (første innhold i Tekst-fanen)
ok('20.9 forhåndsvisningen står først i Tekst-fanen', tk.first === tk.afterTabs, tk);
ok('20.9 «FORHÅNDSVISNING · LIVE» + sticky + maks 34vh', /FORHÅNDSVISNING · LIVE/.test(tk.label) && tk.pos === 'sticky' && tk.mh !== 'none', tk);
ok('20.9 delen som redigeres er markert', tk.mark, tk.mark);
ok('20.9 per tastetrykk (input)', tk.live, tk.live);
ok('20.9 skjult av betingelsen → gjennomstreket', tk.off, tk.off);
ok('20.9 trykk på boble åpner delen', tk.chipI != null && String(tk.sel) === tk.chipI, [tk.chipI, tk.sel]);
ok('20.9 sticky når arket scrolles', tk.sticky.scroll > 100 && tk.sticky.vis, tk.sticky);

/* ---------------- 20.9 · prosa-kortets GUI-editor */
const gui = await page.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const G = customElements.get('msh-prosa-card').getConfigElement(); G.hass = H;
  G.setConfig({ type: 'custom:msh-prosa-card', card_id: 'pg', prose: [{ id: 'a', pre: 'Første', src: 'none', post: '.' }, { id: 'b', pre: 'Andre', src: 'text', fmt: 'boble', post: '.' }] });
  document.body.appendChild(G); await w(400);
  const R = G.shadowRoot, pv = () => R.querySelector('[data-pzprev]');
  const out = { has: !!pv(), first: R.querySelector('[data-pzprev]') === R.querySelector('.xpz'), pos: pv() && getComputedStyle(pv()).position };
  G._ropen.prose = 1; G._render(); await w(200);
  out.mark = pv() && pv().querySelector('.pzm') ? pv().querySelector('.pzm').textContent.replace(/\s+/g, ' ').trim() : null;
  const inp = R.querySelector('input[data-name="prose.1.pre"]');
  if (inp) { inp.value = 'Andre Zulu'; inp.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
  out.live = pv().textContent.includes('Zulu');
  const chip = pv().querySelector('.chip[data-a="x-pzsel"]');
  G._ropen.prose = null; G._render(); await w(100);
  if (chip) { pv().querySelector('.chip[data-a="x-pzsel"]').click(); await w(200); }
  out.sel = G._ropen.prose;
  G.remove();
  return out;
});
ok('20.9 GUI-editor: sticky forhåndsvisning', gui.has && gui.pos === 'sticky', gui);
ok('20.9 GUI-editor: åpen setning markert', gui.mark && /Andre/.test(gui.mark), gui.mark);
ok('20.9 GUI-editor: per tastetrykk', gui.live, gui.live);
ok('20.9 GUI-editor: trykk på boble åpner setningen', gui.sel === 1, gui.sel);
ok('ingen sidefeil', !errs.length, errs);
console.log(res.join('\n'));
await browser.close();
if (bad) { console.error(`${bad} feil`); process.exit(1); }
console.log('fiks20-status-check OK');
