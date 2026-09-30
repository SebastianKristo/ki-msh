// Fiks 25.5 · Innstillinger (#innstillinger, msh-innstillinger-card): autokonfig (automasjoner, varsler, strøm, natt/privat,
// vekking), toppkort (natt av = to kort, natt på = scene), faner + tannhjul, søk, «N av M på», pillekort-rader, toggle,
// Tilpass Innstillinger ↔ GUI-editor.   node test/innstillinger-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/innst-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp) {
  const p = await b.newPage({ viewport: vp || { width: 360, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    window.__hap = 0; window.addEventListener('haptic', () => window.__hap++);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#innstillinger' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Innstillinger</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#innstillinger';
    const c = document.createElement('msh-innstillinger-card');
    c.setConfig({ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
  }, cfg || {});
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const click = async (p, sel) => { await p.evaluate((sel) => window.__c.shadowRoot.querySelector(sel).click(), sel); await wait(p, 350); };
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/innst-${n}.png`, fullPage: true }); };
const setState = (p, id, st) => p.evaluate(({ id, st }) => { const h = window.__h; window.__h = { ...h, states: { ...h.states, [id]: { ...h.states[id], state: st } } }; window.__c.hass = window.__h; }, { id, st });

const p = await page();
// ---------------------------------------------------------------- autokonfig
const A = await p.evaluate(() => { const M = window.MSH, h = window.__h; return { rows: M.innstAutoRows(h, {}), ents: M.innstEntities(h, {}) }; });
ok('autokonfig: automasjoner (uten varsel/strøm), varsler (input_boolean varsel + push-automasjon), strøm (etiketter)', A.rows.automasjoner.includes('automation.automation_morgenlys') && A.rows.automasjoner.includes('automation.vanning_plen_morgen') && !A.rows.automasjoner.includes('automation.push_automation_dor_apen')
  && A.rows.varsler.includes('input_boolean.varsel_vaskemaskin') && A.rows.varsler.includes('automation.push_automation_dor_apen') && A.rows.strom.join() === 'automation.lade_bil_billigst,input_boolean.ki_prisstyring', A);
ok('autokonfig: nattmodus, privatmodus og vekking', A.ents.natt === 'input_boolean.nattmodus' && A.ents.privat === 'input_boolean.privatmodus' && A.ents.vekking === 'input_datetime.vekking', A.ents);
// ---------------------------------------------------------------- toppkort: natt av = to kort
const T = await p.evaluate(() => { const sr = window.__c.shadowRoot, k = [...sr.querySelectorAll('.two .mk')]; return { n: k.length, h: k.map((x) => Math.round(x.getBoundingClientRect().height)), r: k.map((x) => getComputedStyle(x).borderRadius), side: k.length === 2 && Math.abs(k[0].getBoundingClientRect().top - k[1].getBoundingClientRect().top) < 1, nv: k[0].querySelector('.mv').textContent.trim(), pv: k[1].querySelector('.mv').textContent.trim(), ps: k[1].querySelector('.ms').textContent.trim(), pon: k[1].classList.contains('on'), bg: getComputedStyle(k[0]).backgroundImage, scene: !!sr.querySelector('.scene') }; });
ok('natt av: to kort side om side, 164 px, r28', T.n === 2 && T.h.every((x) => x === 164) && T.r.every((x) => x === '28px') && T.side && !T.scene, T);
ok('Nattmodus «Av» (mørkeblå gradient), Privatmodus «På» grønn med «Kameraene er av»', T.nv === 'Av' && /gradient/.test(T.bg) && T.pv === 'På' && T.pon && T.ps === 'Kameraene er av', T);
await shot(p, '1-natt-av');
// trykk på Nattmodus-kortet → toggle
await p.evaluate(() => { window.__calls.length = 0; window.__hap = 0; });
await click(p, '.mk.natt');
const TG = await p.evaluate(() => ({ c: window.__calls.slice(), hap: window.__hap }));
ok('trykk på kortet slår entiteten av/på (homeassistant.toggle), én haptic', TG.c.length === 1 && TG.c[0][0] === 'homeassistant' && TG.c[0][1] === 'toggle' && TG.c[0][2].entity_id === 'input_boolean.nattmodus' && TG.hap === 1, TG);
// natt på → scene
await setState(p, 'input_boolean.nattmodus', 'on'); await setState(p, 'input_boolean.privatmodus', 'off'); await wait(p, 300);
const S = await p.evaluate(() => { const sr = window.__c.shadowRoot, s = sr.querySelector('.scene'); return { h: s && Math.round(s.getBoundingClientRect().height), gt: s && s.querySelector('.gt').textContent.trim(), vk: s && (s.querySelector('.vk') || {}).textContent, chips: s && [...s.querySelectorAll('.chips .chip')].map((c) => c.textContent.trim()), cam: s && !!s.querySelector('.cam'), two: !!sr.querySelector('.two'), gearInTop: !!(s && s.querySelector('[data-act="customize"]:not(.chip)')) }; });
ok('natt på: toppkort 184 px med scene, «God natt», «Vekking kl. 07:00», chips Natt/Privat, rød kamera-prikk (privat av)', S.h === 184 && S.gt === 'God natt' && /Vekking kl\. 07:00/.test(S.vk || '') && S.chips.length === 2 && /Natt/.test(S.chips[0]) && /Privat/.test(S.chips[1]) && S.cam && !S.two && !S.gearInTop, S);
await shot(p, '2-natt-pa');
// ---------------------------------------------------------------- faner + tannhjul
const F = await p.evaluate(() => { const sr = window.__c.shadowRoot, bar = sr.querySelector('.bar'), g = bar.querySelector('.gear'), gr = g.getBoundingClientRect(); const tabs = [...bar.querySelectorAll('.tb')]; return { tabs: tabs.map((t) => t.textContent.trim()), cut: tabs.some((t) => t.querySelector('span').scrollWidth > t.querySelector('span').clientWidth + 1), g: [Math.round(gr.width), Math.round(gr.height)], gbg: getComputedStyle(g).backgroundColor, glass: bar.querySelector('.tabs').dataset.glassDrag, right: gr.right >= bar.getBoundingClientRect().right - 1 }; });
ok('faner Automasjoner · Varsler · Strøm + 56 px tannhjul (#3a3a3a) til høyre, ingen avkuttet tekst ved 360 px', F.tabs.join() === 'Automasjoner,Varsler,Strøm' && !F.cut && F.g.join() === '56,56' && F.gbg === 'rgb(58, 58, 58)' && F.glass === 'x' && F.right, F);
// ---------------------------------------------------------------- rader
const R = await p.evaluate(() => { const sr = window.__c.shadowRoot, rows = [...sr.querySelectorAll('.rows .pr')], r0 = rows[0], cs = getComputedStyle(r0), pi = getComputedStyle(r0.querySelector('.pi')); const g = Math.min(...rows.slice(1).map((x, i) => x.getBoundingClientRect().top - rows[i].getBoundingClientRect().bottom)); return { n: rows.length, bg: cs.backgroundColor, rad: cs.borderRadius, mh: cs.minHeight, pi: [pi.width, pi.backgroundColor], gap: g, cnt: sr.querySelector('.cnt').textContent.replace(/\s+/g, ' ').trim(), nowrap: getComputedStyle(sr.querySelector('.all')).whiteSpace, srch: !!sr.querySelector('.srch input'), off: rows.filter((x) => x.classList.contains('off')).map((x) => x.querySelector('.pt i').textContent.trim()), offCol: rows.find((x) => x.classList.contains('off')) && getComputedStyle(rows.find((x) => x.classList.contains('off')).querySelector('.pt i')).color, gh: [...sr.querySelectorAll('.rows .gh')].map((x) => x.textContent.trim()) }; });
ok('rader er egne pillekort: #3a3a3a, r34, min 66, 58 px ikonsirkel #4a4a4a, 8 px mellom', R.bg === 'rgb(58, 58, 58)' && R.rad === '34px' && R.mh === '66px' && R.pi[0] === '58px' && R.pi[1] === 'rgb(74, 74, 74)' && R.gap === 8, R);
ok('søkefelt, «N av M på» og «Slå alle av/på» (nowrap)', R.srch && /^\d+ av \d+ på ?Slå alle (av|på)$/.test(R.cnt) && R.nowrap === 'nowrap', R);
ok('av: «Av · …» i rødt; gruppert etter område', R.off.length > 0 && R.off.every((x) => /^Av · /.test(x)) && R.offCol === 'rgb(242, 128, 115)' && R.gh.includes('Gang'), R);
await shot(p, '3-rader');
// søk
await p.evaluate(async () => { const i = window.__c.shadowRoot.querySelector('.srch input'); i.value = 'morgen'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await new Promise((q) => setTimeout(q, 300)); });
const Q = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rows .pr .pt b')].map((x) => x.textContent.trim()));
ok('søk filtrerer radene', Q.length >= 1 && Q.every((x) => /morgen/i.test(x)), Q);
// slå alle
await p.evaluate(() => { window.__calls.length = 0; });
await click(p, '.all');
const AL = await p.evaluate(() => window.__calls.slice());
ok('«Slå alle» kaller homeassistant.turn_on/turn_off for de synlige radene', AL.length === 1 && AL[0][0] === 'homeassistant' && /turn_(on|off)/.test(AL[0][1]) && AL[0][2].entity_id.length === Q.length, AL);
await click(p, '.clr');
// rad-trykk → toggle
await p.evaluate(() => { window.__calls.length = 0; });
await click(p, '.rows .pr[data-id="automation.automation_morgenlys"]');
const RT = await p.evaluate(() => window.__calls.slice());
ok('trykk på rad = homeassistant.toggle', RT.length === 1 && RT[0][1] === 'toggle' && RT[0][2].entity_id === 'automation.automation_morgenlys', RT);
// Varsler / Strøm
await click(p, '.tb[data-v="varsler"]');
const VV = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rows .pr')].map((x) => x.dataset.id));
await click(p, '.tb[data-v="strom"]');
const SS = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rows .pr')].map((x) => x.dataset.id));
ok('Varsler- og Strøm-fanene viser sine rader', VV.includes('input_boolean.varsel_vaskemaskin') && VV.includes('automation.push_automation_dor_apen') && SS.length === 2, { VV, SS });
await p.close();

// ---------------------------------------------------------------- uten entiteter: toppkortet står, «Velg entitet»
const p2 = await page({ natt: 'input_boolean.finnes_ikke', privat: 'input_boolean.finnes_ikke_heller' });
const N = await p2.evaluate(() => { const sr = window.__c.shadowRoot; return { two: sr.querySelectorAll('.two .mk').length, mv: [...sr.querySelectorAll('.two .mv')].map((x) => x.textContent.trim()), pick: sr.querySelectorAll('.two [data-act="customize"][data-section="entiteter"]').length }; });
ok('uten natt/privat-entitet: to kort med «–» og «Velg entitet» (aldri skjult)', N.two === 2 && N.mv.join() === '–,–' && N.pick === 2, N);
await p2.close();
const p2b = await page({ scene: 'dag' });
const DG = await p2b.evaluate(() => { const s = window.__c.shadowRoot.querySelector('.scene'); return { day: s && s.classList.contains('day'), birds: !!(s && s.querySelector('.birds')), sun: !!(s && s.querySelector('.sun')) }; });
ok('scene «Alltid dag»: scene med sol og fugler', DG.day && DG.birds && DG.sun, DG);
await shot(p2b, '4-dag');
await p2b.close();

// ---------------------------------------------------------------- Tilpass Innstillinger ↔ GUI-editor
const p3 = await page();
await click(p3, '.bar .gear'); await wait(p3, 500);
const E = await p3.evaluate(() => {
  const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
  const ed = find(window.MSH.overlayRoot()); window.__ed = ed;
  const sr = ed.shadowRoot;
  return { title: sr.querySelector('.ttl .tt').textContent, tabs: [...sr.querySelectorAll('.chips.sg.tabs [data-a="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim()), rows: sr.querySelectorAll('[data-elist="inn-tab"]').length, hd: getComputedStyle(sr.querySelector('[data-edrag]')).touchAction };
});
ok('Tilpass Innstillinger: fire faner (Faner · Rader · Entiteter · Avansert), dra-håndtak touch-action:none', /Innstillinger/.test(E.title) && E.tabs.join() === 'Faner,Rader,Entiteter,Avansert' && E.rows === 3 && E.hd === 'none', E);
// gi fanen nytt navn + skjul Strøm
await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  sr.querySelector('[data-op="texp"][data-v="varsler"]').click(); await w(200);
  const i = sr.querySelector('[data-innname="varsler"]'); i.value = 'Push'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(200);
  sr.querySelector('[data-op="teye"][data-v="strom"]').click(); await w(300);
});
const E1 = await p3.evaluate(() => ({ cfg: { n: window.__ed._config.tab_names, h: window.__ed._config.tab_hidden }, tabs: [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((t) => t.textContent.trim()) }));
ok('Faner: nytt navn og skjul → forhåndsvises straks', E1.cfg.n && E1.cfg.n.varsler === 'Push' && E1.cfg.h.join() === 'strom' && E1.tabs.join() === 'Automasjoner,Push', E1);
// Rader: skjul (exclude) + legg til (include) + dra (row_order), uten lekkasje til popupen
const RR = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  sr.querySelector('[data-a="tab"][data-v="rader"]').click(); await w(200);
  sr.querySelector('[data-op="reye"][data-v="automation.vanning_plen_morgen"]').click(); await w(200);
  sr.querySelector('[data-op="radd-open"]').click(); await w(200);
  const q = sr.querySelector('[data-edq="inn-q"]'); q.value = 'peis'; q.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(200);
  const hit = sr.querySelector('[data-op="radd"]'); const added = hit && hit.dataset.v; if (hit) hit.click(); await w(200);
  let leaked = 0; const leak = () => leaked++;
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach((t) => document.addEventListener(t, leak));
  const rows = [...sr.querySelectorAll('[data-elist="inn-row"]')], vis = rows.filter((x) => !x.classList.contains('off')), last = vis[vis.length - 1], hd = last.querySelector('[data-edrag]'), r0 = rows[0].getBoundingClientRect(), rh = hd.getBoundingClientRect();
  const ev = (t, y) => hd.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, pointerId: 9, clientX: rh.left + 5, clientY: y, button: 0 }));
  ev('pointerdown', rh.top + 5); ev('pointermove', r0.top + 10); ev('pointerup', r0.top + 10); await w(300);
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach((t) => document.removeEventListener(t, leak));
  const c = window.__ed._config;
  return { added, exc: c.exclude, inc: c.include, order: c.row_order && c.row_order.automasjoner, leaked, first: last.dataset.edk, cardRows: [...window.__c.shadowRoot.querySelectorAll('.rows .pr')].map((x) => x.dataset.id) };
});
ok('Rader: øyet → exclude, «Legg til rad» → include, dra → row_order; popupen får ingen dra-hendelser', RR.exc && RR.exc.automasjoner.includes('automation.vanning_plen_morgen') && RR.inc && RR.inc.automasjoner.includes(RR.added) && RR.order && RR.order[0] === RR.first && RR.leaked === 0 && RR.cardRows[0] === RR.first && !RR.cardRows.includes('automation.vanning_plen_morgen'), RR);
// Avansert: scene alltid natt + avslåtte øverst
await p3.evaluate(async () => { const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms)); sr.querySelector('[data-a="tab"][data-v="avansert"]').click(); await w(200); sr.querySelector('[data-name="scene"][data-v="natt"]').click(); await w(300); });
const AV = await p3.evaluate(() => ({ scene: window.__ed._config.scene, top: !!window.__c.shadowRoot.querySelector('.scene.night'), sw: getComputedStyle(window.__ed.shadowRoot.querySelector('.sw')).width }));
ok('Avansert: toppkort-scene «Alltid natt» → scene straks; brytere 44 px', AV.scene === 'natt' && AV.top && AV.sw === '44px', AV);
await shot(p3, '5-tilpass');
const G = await p3.evaluate(async () => {
  window.__ed.shadowRoot.querySelector('[data-a="save"]').click(); await new Promise((q) => setTimeout(q, 1200));
  const cfg = window.__c._rawConfig;
  const g = customElements.get('msh-innstillinger-card').getConfigElement(); g.hass = window.__h; g.setConfig(cfg); document.body.appendChild(g); await new Promise((q) => setTimeout(q, 200));
  const gs = g.shadowRoot;
  const tabs = [...gs.querySelectorAll('[data-elist="inn-tab"]')].map((r) => r.querySelector('b').textContent.trim() + (r.classList.contains('off') ? ':skjult' : ''));
  let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
  gs.querySelector('[data-a="tab"][data-v="avansert"]').click(); await new Promise((q) => setTimeout(q, 200));
  gs.querySelector('[data-name="scene"][data-v="dag"]').click(); await new Promise((q) => setTimeout(q, 200));
  return { saved: { scene: cfg.scene, n: cfg.tab_names }, tabs, gui: changed && changed.scene };
});
ok('Ferdig lagrer; GUI-editoren viser samme config og endrer samme nøkler', G.saved.scene === 'natt' && G.saved.n.varsler === 'Push' && G.tabs.includes('Push') && G.tabs.includes('Strøm:skjult') && G.gui === 'dag', G);
await p3.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
