// Fiks 25.5 + 26.15 + 27 · Innstillinger (#settings, msh-innstillinger-card): autokonfig fra KI Varslinger og sikkerhet
// (ki_notifications, én rad per regel via erMaster), Strøm fra ki_energi, toppkort (brukerens entiteter uten config),
// animert Privatmodus-kort, tomtilstand, ingen Dashbord-del (fiks 33.3), «Tilpass Innstillinger» etter designet
// (tekstfaner, én flate, navnefelt + bryter i raden, riktige tellere) ↔ GUI-editor, overstyring rows.exclude/move/include,
// migrering fra den importerte #settings (ki-natt-card + ki-tabs-card + ki-varsling-card) og strategien.
// Fiks 27: designets kamera og Tilpass-ark (se også innstillinger27-check). Fiks 29: radene kommer fra MSH.finnBrytere
// (= ki-varsling-card), faner = ki-varsling-card-configer (faner[]), se innstillinger29-check.
//   node test/innstillinger-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
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
    window.MSH.innstNow = () => new Date(2026, 0, 15, 14, 0); // ikke avhengig av klokka (God morgen kl. 05–11)
    window.__h = window.mockHass();
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#settings' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Innstillinger</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#settings';
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
const PRIV = 'input_boolean.innendors_privace_mode';

const p = await page();
// ---------------------------------------------------------------- autokonfig (29: kilden = finnBrytere, standardfanene)
const A = await p.evaluate(() => {
  const M = window.MSH, h = window.__h, rows = (k) => M.innstRows(h, {}, k);
  const all = ['sikkerhet', 'hjem', 'strom'].flatMap((k) => rows(k).map((r) => r.name));
  return { ents: M.innstEntities(h, {}), sik: rows('sikkerhet').map((r) => [r.key, r.name, r.id]), hjem: rows('hjem').map((r) => [r.key, r.name, r.id]), strom: rows('strom').map((r) => r.name), alarm: rows('sikkerhet').find((r) => r.dev === 'n_alarm'), notif: M.innstRules(h, {}).filter((r) => r.plattform === 'ki_notifications'), all };
});
ok('toppkort: brukerens entiteter treffes uten config (switch.nattmodus, …privace_mode, sensor.*vekking*neste*)', A.ents.natt === 'switch.nattmodus' && A.ents.privat === 'input_boolean.innendors_privace_mode' && A.ents.vekking === 'sensor.soverom_vekking_neste_alarm', A.ents);
ok('én rad per regel: hovedbryteren (erMaster) – Alarm = alarm_alle_varsler, nøkkel = device_id', A.alarm && A.alarm.id === 'switch.alarm_alle_varsler' && A.alarm.key === 'n_alarm' && A.alarm.all.length === 3, A.alarm);
ok('uten hovedbryter vises alle bryterne (Støvsuger: to rader, nøkkel = entity_id)', A.hjem.filter((r) => r[0].startsWith('switch.stovsuger_')).length === 2, A.hjem);
ok('29: bare registeret (ki_notifications/ki_energi) – KI Utelys (annen plattform) og input_boolean.varsel_* (ingen plattform) er ikke med som standard', !A.all.some((n) => /Utelys/.test(n)) && !A.all.includes('Dør låst/åpnet'), A.all);
ok('29 Sikkerhet (kjente regler): Alarm, Ansiktsgjenkjenning, Autolås, Dørlys, Fastkjørt lås, Heimdall', A.sik.map((r) => r[1]).join() === 'Alarm,Ansiktsgjenkjenning,Autolås,Dørlys,Fastkjørt lås,Heimdall', A.sik);
ok('29 Hjem = resten av KI Varslinger (hjemme/borte, HA, planter, Ruter, støvsuger, vekking + ukjente regler) – aldri tekniske navn', ['Hjemme / borte', 'Home Assistant', 'Høy fukt bad', 'Planter', 'Ruter fra skolen', 'Støvsuger', 'Vekking', 'Bevegelse ved inngang'].every((n) => A.hjem.some((r) => r[1] === n)) && A.hjem.length === 10 && !A.hjem.some((r) => / - /.test(r[1])), A.hjem);
ok('Strøm: alle varslingsbrytere fra ki_energi (9), «Energivarsler» øverst', A.strom.length === 9 && A.strom[0] === 'Energivarsler' && A.strom.includes('Effektgrense') && A.strom.includes('Spør fredag'), A.strom);
ok('ki_notifications: 16 rader fra 15 regler (Støvsuger har ingen hovedbryter)', new Set(A.notif.map((r) => r.dev)).size === 15 && A.notif.length === 16, A.notif.length);
// ---------------------------------------------------------------- toppkort + Privatmodus-animasjonen (designet)
const T = await p.evaluate(() => { const sr = window.__c.shadowRoot, k = [...sr.querySelectorAll('.two .mk')], pc = k[1] && k[1].querySelector('.pmount'), cr = pc && pc.getBoundingClientRect(), kr = k[1].getBoundingClientRect(); return { n: k.length, h: k.map((x) => Math.round(x.getBoundingClientRect().height)), pon: k[1].classList.contains('on'), ps: k[1].querySelector('.ms').textContent.trim(), cam: !!k[1].querySelector('.ptilt .pscan .plens .plid'), right: cr && Math.round(kr.right - cr.right), top: cr && Math.round(cr.top - kr.top), hap: k[1].dataset.haptic }; });
ok('natt av: to kort (164 px); Privatmodus «på» med kamera på veggfeste mot høyre kant (top 74 px), haptic medium', T.n === 2 && T.h.every((x) => x === 164) && T.pon && T.ps === 'Kameraene er av' && T.cam && T.right === 0 && T.top === 74 && T.hap === 'medium', T);
await wait(p, 1100);
const cam = () => p.evaluate(() => { const k = window.__c.shadowRoot.querySelector('.mk.priv'), q = (s) => k.querySelector(s), cs = (s) => getComputedStyle(q(s)); return { cls: k.className, tilt: cs('.ptilt').transform, lid: cs('.plid').transform, cone: cs('.pcone').opacity, rec: cs('.prec').animationName, scan: q('.pscan').getAnimations().map((a) => a.animationName + ':' + a.playState).join(), lockAnim: q('.lk ha-icon') ? q('.lk ha-icon').getAnimations().length : -1, ring: q('.lk .ring') ? q('.lk .ring').getAnimations().length : 0, lock: q('.lk ha-icon').getAttribute('icon') }; });
const C1 = await cam();
ok('på: kameraet vippet ned 38°, lokket over linsen, kjeglen borte, REC av, ingen camscan', /^matrix\(0\.788/.test(C1.tilt) && C1.lid === 'matrix(1, 0, 0, 1, 0, 0)' && C1.cone === '0' && C1.rec === 'none' && C1.scan === '' && C1.lock === 'mdi:lock', C1);
await setState(p, PRIV, 'off'); await wait(p, 120);
const C2 = await cam();
await wait(p, 1000);
const C3 = await cam();
ok('av via hass: lås-pop (lockpop, ingen ring), kamera skanner (camscan 5 s), kjegle + blinkende REC, lokket opp', C2.lockAnim >= 1 && C2.ring === 0 && C2.lock === 'mdi:lock-open-variant' && C3.scan === 'camscan:running' && C3.cone === '1' && C3.rec === 'recblink' && C3.lid === 'matrix(1, 0, 0, 0, 0, 0)' && C3.tilt === 'matrix(1, 0, 0, 1, 0, 0)', { C2, C3 });
await shot(p, '1-privat-av');
await p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; });
await click(p, '.mk.priv');
const TG = await p.evaluate(() => ({ c: window.__calls.slice(), hap: window.__hap.slice(), on: window.__c.shadowRoot.querySelector('.mk.priv').classList.contains('on') }));
ok('trykk på Privatmodus: homeassistant.turn_on + ett haptic(medium), kortet bytter straks (optimistisk)', TG.c.length === 1 && TG.c[0][0] === 'homeassistant' && TG.c[0][1] === 'turn_on' && TG.c[0][2].entity_id === 'input_boolean.innendors_privace_mode' && TG.hap.length === 1 && TG.hap[0] === 'medium' && TG.on, TG);
await setState(p, PRIV, 'on'); await wait(p, 120);
const C4 = await cam();
ok('på via hass: lås-pop + én ring ut fra låsen', C4.ring === 1 && C4.lockAnim >= 1 && /\bon\b/.test(C4.cls), C4);
await wait(p, 900);
await setState(p, PRIV, 'unavailable'); await wait(p, 300);
const C5 = await cam();
ok('utilgjengelig: kameraet står stille i grått', /\bua\b/.test(C5.cls) && C5.scan === '' && C5.cone === '0', C5);
await setState(p, PRIV, 'on'); await wait(p, 300);
// ---------------------------------------------------------------- faner + rader i kortet
const F = await p.evaluate(() => { const tb = [...window.__c.shadowRoot.querySelectorAll('.bar .tb')]; return { t: tb.map((t) => t.textContent.trim()), h: tb.map((t) => Math.round(t.getBoundingClientRect().height)), ic: tb.every((t) => t.querySelector('ha-icon')), cut: tb.some((t) => t.querySelector('.tl').scrollWidth > t.querySelector('.tl').clientWidth + 1) }; });
ok('faner: Sikkerhet · Hjem · Strøm, ikon + tekst (56 px), ingen avkuttet tekst ved 360 px', F.t.join() === 'Sikkerhet,Hjem,Strøm' && F.h.every((x) => x === 56) && F.ic && !F.cut, F);
const R = await p.evaluate(() => { const sr = window.__c.shadowRoot, rows = [...sr.querySelectorAll('.lst .pr')]; return { n: rows.length, names: rows.map((r) => r.querySelector('.pt b').textContent.trim()), cnt: sr.querySelector('.cnt .num').textContent.trim(), ent: rows.map((r) => r.dataset.ent), ph: sr.querySelector('.srch input').placeholder }; });
ok('Sikkerhet i popupen: 6 rader, «N av 6 på», «Søk blant 6», hold → more-info (data-ent = hovedbryteren)', R.n === 6 && /av 6 på/.test(R.cnt) && R.ph === 'Søk blant 6' && R.ent.includes('switch.alarm_alle_varsler'), R);
await p.evaluate(() => { window.__calls.length = 0; });
await click(p, '.lst .pr[data-id="switch.alarm_alle_varsler"]');
const RT = await p.evaluate(() => window.__calls.slice());
ok('trykk på rad = homeassistant.toggle av hovedbryteren', RT.length === 1 && RT[0][1] === 'toggle' && RT[0][2].entity_id === 'switch.alarm_alle_varsler', RT);
await click(p, '.tb[data-v="strom"]');
const S = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim()));
ok('Strøm-fanen: 9 rader, Energivarsler øverst', S.length === 9 && S[0] === 'Energivarsler', S);
await wait(p, 300);
// Fiks 33.3: Dashbord-/Utseende-/Enheter-delen og fotteksten er fjernet – popupen slutter etter brytersettene
const DB = await p.evaluate(() => { const sr = window.__c.shadowRoot, w = sr.querySelector('.wrap'); return { dash: !!sr.querySelector('.dash, msh-settings-card, .gh'), last: w.lastElementChild && w.lastElementChild.className, txt: sr.textContent }; });
ok('33.3 · ingen DASHBORD/Utseende/Enheter/fottekst – popupen slutter med brytersettene', !DB.dash && /pane/.test(DB.last) && !/Liquid Glass|Tilpass Hjem|gjelder for deg|denne enheten/.test(DB.txt), { dash: DB.dash, last: DB.last });
await shot(p, '2-slutt');
await p.close();

// ---------------------------------------------------------------- tomtilstand (integrasjonen mangler) + Animasjoner av
const p2 = await page({ animasjoner: false });
const N = await p2.evaluate(async () => {
  const h = window.__h, E = {}, St = {}; Object.entries(h.entities).forEach(([k, v]) => { E[k] = ['ki_notifications', 'ki_energi', 'ki_utelys'].includes(v.platform) ? { ...v, platform: 'demo' } : v; });
  Object.entries(h.states).forEach(([k, v]) => { if (!/^input_boolean\.varsel_/.test(k)) St[k] = v; });
  window.__h = { ...h, entities: E, states: St }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 300));
  const sr = window.__c.shadowRoot, e = sr.querySelector('.pane .empty');
  return { txt: e && e.textContent.replace(/\s+/g, ' ').trim(), rows: sr.querySelectorAll('.lst .pr').length, na: sr.querySelector('.mk.priv').classList.contains('na'), scan: sr.querySelector('.pscan').getAnimations().length };
});
ok('mangler integrasjonen: «Fant ingen brytere fra valgte integrasjoner» + «Velg integrasjoner», ingen rader (aldri mock)', /Fant ingen brytere fra valgte integrasjoner/.test(N.txt) && /Velg integrasjoner/.test(N.txt) && N.rows === 0, N);
ok('«Animasjoner» av: kameraet står stille', N.na && N.scan === 0, N);
await p2.close();

// ---------------------------------------------------------------- Tilpass Innstillinger (designet) ↔ GUI-editor
const p3 = await page();
await click(p3, '.bar .gear'); await wait(p3, 600);
const E = await p3.evaluate(() => {
  const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
  const ed = find(window.MSH.overlayRoot()); window.__ed = ed;
  const sr = ed.shadowRoot, seg = sr.querySelector('.chips.sg.tabs'), ss = getComputedStyle(seg), done = sr.querySelector('.ttl .done'), tt = sr.querySelector('.ttl .tt');
  const sec = sr.querySelector('[data-focus="faner"]'), bs = getComputedStyle(sec), hdr = sec.querySelector('.fsh');
  const rows = [...sr.querySelectorAll('[data-elist="inn-tab"]')], r1 = rows[1], inp = r1.querySelector('input.inm'), is = getComputedStyle(inp);
  const dr = done.getBoundingClientRect(), tr = tt.getBoundingClientRect();
  return {
    title: tt.textContent.trim(), full: tt.scrollWidth <= tt.clientWidth, tsize: getComputedStyle(tt).fontSize + '/' + getComputedStyle(tt).fontWeight, done: done.textContent.trim(), doneRight: dr.left > tr.right - 1, doneTop: Math.abs(dr.top - tr.top) < 30, doneBg: getComputedStyle(done).backgroundImage + getComputedStyle(done).backgroundColor,
    tabs: [...seg.querySelectorAll('[data-a="tab"]')].map((t) => t.textContent.trim()), tabIcons: seg.querySelectorAll('ha-icon').length, seg: [ss.backgroundColor, ss.borderRadius, ss.paddingTop, getComputedStyle(seg.querySelector('.chip')).fontSize],
    hdr: hdr.textContent.trim(), hdrSize: getComputedStyle(hdr).fontSize, hdrCol: getComputedStyle(hdr).color, hdrIn: hdr.parentElement === sec, box: [bs.backgroundColor, bs.borderRadius],
    div: getComputedStyle(r1).borderTopColor, inp: [is.backgroundColor, is.borderRadius, is.height], ic: getComputedStyle(r1.querySelector('.iic')).color, sw: !!r1.querySelector('.sw.on'),
    help: [...sr.querySelectorAll('.help')].map((x) => x.textContent),
    vis: [...sr.querySelectorAll('[data-name="tab_labels"]')].map((x) => x.textContent.trim()),
  };
});
ok('tittel «Tilpass Innstillinger» 22/600 (20 under 380 px) + rosa «Ferdig»-pille øverst til høyre', E.title === 'Tilpass Innstillinger' && /^(22px|20px)\/600$/.test(E.tsize) && E.done === 'Ferdig' && E.doneRight && E.doneTop && /242, 133, 201|f285c9/i.test(E.doneBg), E);
ok('tekstfaner i segmentrad: Faner · Rader · Entiteter · Avansert, ingen ikoner, #3a3a3a r24 pad 4, 12 px', E.tabs.join() === 'Faner,Rader,Entiteter,Avansert' && E.tabIcons === 0 && E.seg.join() === 'rgb(58, 58, 58),24px,4px,12px', E);
ok('én flate: «Faner · dra for rekkefølge» 12 px versaler #7f7f7f INNI flaten (#3a3a3a r24), skillelinjer', /Faner · dra for rekkefølge/i.test(E.hdr) && E.hdrSize === '12px' && E.hdrCol === 'rgb(127, 127, 127)' && E.hdrIn && E.box[0] === 'rgb(58, 58, 58)' && E.box[1] === '24px' && E.div === 'rgba(255, 255, 255, 0.06)', E);
ok('rad: ikon #afafaf, navnefelt i raden (#282828 r12 40 px), rosa bryter, ingen «Dra for rekkefølge»-hjelpetekst', E.ic === 'rgb(175, 175, 175)' && E.inp.join() === 'rgb(40, 40, 40),12px,40px' && E.sw && !E.help.some((x) => /Dra for rekkefølge/.test(x)), E);
ok('«Faner viser»: Ikon + tekst · Tekst · Ikoner', E.vis.join() === 'Ikon + tekst,Tekst,Ikoner', E);
await shot(p3, '3-tilpass-faner');
// navn i raden + skjul
await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const i = sr.querySelector('input[data-inn="tname"][data-v="hjem"]'); i.value = 'Push varsler'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(200);
  sr.querySelector('[data-op="teye"][data-v="strom"]').click(); await w(300);
});
const E1 = await p3.evaluate(() => ({ tabs: window.__ed._config.faner, old: window.__ed._config.tabs, card: [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((t) => t.textContent.trim()) }));
ok('Faner: navnefelt + bryter → faner[] (navn, rekkefølge, skjult), forhåndsvises straks', Array.isArray(E1.tabs) && !E1.old && E1.tabs.find((t) => t.key === 'hjem').name === 'Push varsler' && E1.tabs.find((t) => t.key === 'strom').hidden === true && E1.card.join() === 'Sikkerhet,Push varsler', E1);
// Rader: exclude (device_id), flytt (rows.move), legg til (rows.include), navn (i panelet), filter
const RR = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  sr.querySelector('[data-a="tab"][data-v="rader"]').click(); await w(250);
  const hdr = [...sr.querySelectorAll('.fsh')].map((x) => x.textContent.trim());
  const sub = [...sr.querySelectorAll('.chips.sg.tsub .chip')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
  const row = sr.querySelector('[data-elist="inn-row"]'), txt = row.querySelector('.itx').textContent.replace(/\s+/g, ' ').trim();
  sr.querySelector('[data-op="reye"][data-v="n_alarm"]').click(); await w(250);
  sr.querySelector('[data-op="rexp"][data-v="n_heimdall"]').click(); await w(250);
  sr.querySelector('[data-op="rmove"][data-v="n_heimdall"][data-t="hjem"]').click(); await w(250);
  sr.querySelector('[data-op="radd-open"]').click(); await w(200);
  const q = sr.querySelector('[data-edq="inn-q"]'); q.value = 'peis'; q.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(250);
  const hit = sr.querySelector('[data-op="radd"]'); const added = hit && hit.dataset.v; if (hit) hit.click(); await w(250);
  sr.querySelector('.itx[data-v="n_fastkjort"]').click(); await w(250);
  const nm = sr.querySelector('input[data-inn="rname"][data-v="n_fastkjort"]'); nm.value = 'Låsevarsel'; nm.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(250);
  const c = window.__ed._config;
  return { hdr, sub, txt, added, rows: c.rows, ekstra: (c.faner.find((t) => t.key === 'sikkerhet') || {}).ekstra, card: [...window.__c.shadowRoot.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim()) };
});
ok('Rader: undersegment per fane, rad = tittel + entitet (designet), «Rader · dra for rekkefølge» (filteret ligger nå per fane i Faner, 29.3)', RR.sub.join() === 'Sikkerhet,Push varsler,Strøm' && RR.txt === 'Alarmswitch.alarm_alle_varsler' && RR.hdr.some((x) => /Rader · dra for rekkefølge/i.test(x)) && !RR.hdr.some((x) => /Filter for fanen/i.test(x)), RR);
ok('Rader: bryter → rows.exclude [device_id], flytt → rows.move { id: fane }, legg til → fanens ekstra (29), navn → rows.names', RR.rows && RR.rows.exclude.join() === 'n_alarm' && RR.rows.move.n_heimdall === 'hjem' && RR.added === 'switch.stue_peis' && (RR.ekstra || []).includes(RR.added) && !RR.rows.include && RR.rows.names.n_fastkjort === 'Låsevarsel'
  && !RR.card.includes('Alarm') && !RR.card.includes('Heimdall') && RR.card.includes('Låsevarsel') && RR.card.includes('Peis'), RR);
const FL = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  sr.querySelector('[data-a="tab"][data-v="faner"]').click(); await w(250);
  sr.querySelector('[data-op="texp"][data-v="sikkerhet"]').click(); await w(250);
  const i = sr.querySelector('input[data-inn="fenh"][data-v="sikkerhet"]'); i.value = 'fastkjørt, autolås'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(250);
  const F = window.__ed._config.faner;
  sr.querySelector('[data-a="tab"][data-v="rader"]').click(); await w(250);
  return { f: F.find((t) => t.key === 'sikkerhet'), hjem: F.find((t) => t.key === 'hjem'), card: [...window.__c.shadowRoot.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim()) };
});
ok('29 Bare disse for fanen (Tilpass → Faner) → faner[].enheter (ki-varsling-card-nøkkel); Hjem gir fra seg/tar tilbake enhetene', FL.f && FL.f.enheter.join() === 'fastkjørt,autolås' && FL.card.includes('Låsevarsel') && FL.card.includes('Autolås') && FL.card.includes('Peis') && !FL.card.includes('Dørlys') && FL.hjem.ikke_enheter.join() === 'fastkjørt,autolås', FL);
await shot(p3, '4-tilpass-rader');
// Avansert: Animasjoner-bryteren
const AV = await p3.evaluate(async () => { const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms)); sr.querySelector('[data-a="tab"][data-v="avansert"]').click(); await w(250); const b0 = sr.querySelector('[data-name="animasjoner"]'); const on0 = b0.classList.contains('on'); b0.click(); await w(250); return { on0, v: window.__ed._config.animasjoner, na: window.__c.shadowRoot.querySelector('.mk.priv').classList.contains('na'), bg: getComputedStyle(sr.querySelector('[data-name="sok"]')).backgroundColor }; });
ok('Avansert: «Animasjoner» (standard på, rosa bryter) → av stopper animasjonen', AV.on0 && AV.v === false && AV.na && AV.bg === 'rgb(242, 133, 201)', AV);
const G = await p3.evaluate(async () => {
  window.__ed.shadowRoot.querySelector('[data-a="save"]').click(); await new Promise((q) => setTimeout(q, 1200));
  const cfg = window.__c._rawConfig;
  const g = customElements.get('msh-innstillinger-card').getConfigElement(); g.hass = window.__h; g.setConfig(cfg); document.body.appendChild(g); await new Promise((q) => setTimeout(q, 250));
  const gs = g.shadowRoot;
  const tabs = [...gs.querySelectorAll('[data-elist="inn-tab"]')].map((r) => r.querySelector('input').value + (r.classList.contains('off') ? ':skjult' : ''));
  let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
  gs.querySelector('[data-a="tab"][data-v="rader"]').click(); await new Promise((q) => setTimeout(q, 250));
  const hb = gs.querySelector('[data-op="reye"][data-v="n_autolas"]'); if (hb) hb.click(); await new Promise((q) => setTimeout(q, 250));
  return { dbg: hb ? '' : [...gs.querySelectorAll('[data-op]')].map((x) => x.dataset.op + ':' + x.dataset.v).join(' ').slice(0, 600), saved: { faner: cfg.faner, rows: cfg.rows }, tabs, gui: changed && changed.rows };
});
ok('Ferdig lagrer; GUI-editoren viser samme config og skriver samme YAML (rows.exclude)', G.saved.faner.find((t) => t.key === 'hjem').name === 'Push varsler' && G.tabs.includes('Push varsler') && G.tabs.some((x) => /:skjult$/.test(x)) && G.gui && G.gui.exclude.includes('n_autolas') && G.gui.move.n_heimdall === 'hjem', G);
await p3.close();

// ---------------------------------------------------------------- migrering + strategien (#settings)
const html = readFileSync('test/fixtures/popups.html', 'utf8');
const p4 = await page();
const ST = await p4.evaluate(async (html) => {
  const M = window.MSH, h = window.__h;
  const docs = M.yaml.splitDocs(M.yaml.toText(html)).map((d) => d.text).filter((t) => /hash: '#settings'/.test(t));
  const legacy = M.yaml.parse(docs[0]);
  const mig = M.innstMigrate(legacy);
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  if (M.store && !M.store.loaded) await M.store.load(h);
  const d0 = await S.generate({}, h);
  const s0 = d0.views[0].cards[0].cards.filter((c) => c.hash === '#settings');
  await M.store.set('custom_popups', [legacy], { immediate: true });
  const d = await S.generate({}, h);
  const pops = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up'), set = pops.filter((c) => c.hash === '#settings');
  return { mig, n0: s0.length, t0: s0[0] && s0[0].cards.map((c) => c.type), n: set.length, cards: set[0] && set[0].cards, inactive: (M.popupReport.inactive || []).filter((x) => x.hash === '#settings').map((x) => x.by), inn: pops.some((c) => c.hash === '#innstillinger') };
}, html);
ok('migrering: natt, helg→privat, vekking; faner[i] = ki-varsling-card-configen 1:1 (29: enheter/ikke_enheter/plattform følger med), gap-card borte', ST.mig.natt === 'switch.nattmodus' && ST.mig.privat === 'input_boolean.innendors_privace_mode' && ST.mig.vekking === 'sensor.soverom_vekking_neste_alarm'
  && ST.mig.faner.map((t) => t.key).join() === 'sikkerhet,hjem,strom' && ST.mig.faner[1].name === 'Push varsler' && ST.mig.faner[0].name === 'Sikkerhet' && ST.mig.faner[0].enheter.includes('lås') && ST.mig.faner[0].plattform.includes('ki_utelys') && ST.mig.faner[1].ikke_enheter.includes('ki energi') && ST.mig.faner[2].enheter.join() === 'ki energi' && !ST.mig.tabs, ST.mig);
ok('strategien: #settings = ÉTT msh-innstillinger-card (card_id pop-innstillinger); #innstillinger ikke i tillegg', ST.n0 === 1 && ST.t0.join() === 'custom:msh-innstillinger-card' && !ST.inn, ST);
ok('importert #settings (ki-natt/tabs/varsling) erstattes («Erstattet av Innstillinger») og oppsettet flyttes inn', ST.n === 1 && ST.cards.length === 1 && ST.cards[0].type === 'custom:msh-innstillinger-card' && ST.cards[0].card_id === 'pop-innstillinger' && ST.cards[0].privat === 'input_boolean.innendors_privace_mode' && ST.cards[0].faner[1].name === 'Push varsler' && ST.inactive.join() === 'Innstillinger', ST);
await p4.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
