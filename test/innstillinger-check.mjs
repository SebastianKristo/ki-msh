// Fiks 25.5 + 26.15 · Innstillinger (#settings, msh-innstillinger-card): autokonfig fra KI Varslinger og sikkerhet
// (ki_notifications, én rad per regel via erMaster), Strøm fra ki_energi, toppkort (brukerens entiteter uten config),
// animert Privatmodus-kort, tomtilstand, Dashbord-fanen (msh-settings-card), «Tilpass Innstillinger» etter designet
// (tekstfaner, én flate, navnefelt + bryter i raden, riktige tellere) ↔ GUI-editor, overstyring rows.exclude/move/include,
// migrering fra den importerte #settings (ki-natt-card + ki-tabs-card + ki-varsling-card) og strategien.
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
// ---------------------------------------------------------------- autokonfig
const A = await p.evaluate(() => {
  const M = window.MSH, h = window.__h, rows = (k) => M.innstRows(h, {}, k);
  return { ents: M.innstEntities(h, {}), auto: rows('automasjoner').map((r) => [r.key, r.name, r.id]), push: rows('varsler').map((r) => [r.key, r.name, r.id]), strom: rows('strom').map((r) => r.name), alarm: rows('varsler').find((r) => r.dev === 'n_alarm'), notif: M.innstRules(h, {}).filter((r) => r.plattform === 'ki_notifications') };
});
ok('toppkort: brukerens entiteter treffes uten config (switch.nattmodus, …privace_mode, sensor.*vekking*neste*)', A.ents.natt === 'switch.nattmodus' && A.ents.privat === 'input_boolean.innendors_privace_mode' && A.ents.vekking === 'sensor.soverom_vekking_neste_alarm', A.ents);
ok('én rad per regel: hovedbryteren (erMaster) – Alarm = alarm_alle_varsler, nøkkel = device_id', A.alarm && A.alarm.id === 'switch.alarm_alle_varsler' && A.alarm.key === 'n_alarm' && A.alarm.all.length === 3, A.alarm);
ok('uten hovedbryter vises alle bryterne (Støvsuger: to rader, nøkkel = entity_id)', A.push.filter((r) => r[0].startsWith('switch.stovsuger_')).length === 2, A.push);
ok('Automasjoner (fane auto): vekking, ansikt, autolås, fastkjørt lås, dørlys, Heimdall, utelys', ['Vekking', 'Ansiktsgjenkjenning', 'Autolås', 'Fastkjørt lås', 'Dørlys', 'Heimdall', 'Utelys automatikk'].every((n) => A.auto.some((r) => r[1] === n)) && A.auto.length === 7, A.auto);
ok('Varsler (fane push): alarm, hjemme/borte, Ruter, planter, støvsuger, HA – aldri tekniske navn', ['Alarm', 'Hjemme / borte', 'Ruter fra skolen', 'Planter', 'Støvsuger', 'Home Assistant'].every((n) => A.push.some((r) => r[1] === n)) && !A.push.some((r) => / - /.test(r[1])), A.push);
ok('Strøm: alle varslingsbrytere fra ki_energi (9), «Energivarsler» øverst', A.strom.length === 9 && A.strom[0] === 'Energivarsler' && A.strom.includes('Effektgrense') && A.strom.includes('Spør fredag'), A.strom);
ok('12 regler fra ki_notifications (13 rader: Støvsuger har ingen hovedbryter)', new Set(A.notif.map((r) => r.dev)).size === 12 && A.notif.length === 13, A.notif.length);
// ---------------------------------------------------------------- toppkort + Privatmodus-animasjonen
const T = await p.evaluate(() => { const sr = window.__c.shadowRoot, k = [...sr.querySelectorAll('.two .mk')], pc = k[1] && k[1].querySelector('.pcam'), cr = pc && pc.getBoundingClientRect(), kr = k[1].getBoundingClientRect(); return { n: k.length, h: k.map((x) => Math.round(x.getBoundingClientRect().height)), pon: k[1].classList.contains('on'), ps: k[1].querySelector('.ms').textContent.trim(), cam: !!pc, right: cr && Math.round(kr.right - cr.right), w: cr && Math.round(cr.width), hap: k[1].dataset.haptic }; });
ok('natt av: to kort (164 px); Privatmodus «på» med kamera festet mot høyre kant, haptic medium', T.n === 2 && T.h.every((x) => x === 164) && T.pon && T.ps === 'Kameraene er av' && T.cam && T.right === 0 && T.w >= 44 && T.hap === 'medium', T);
await wait(p, 1100);
const cam = () => p.evaluate(() => { const k = window.__c.shadowRoot.querySelector('.mk.priv'), q = (s) => k.querySelector(s), cs = (s) => getComputedStyle(q(s)); const sw = q('.cm-sweep').getAnimations(); return { cls: k.className, tilt: cs('.cm-tilt').transform, shut: cs('.cm-shut').transform, cone: cs('.cm-cone').opacity, rec: cs('.cm-rec').opacity, ok: cs('.cm-ok').opacity, sweep: sw.map((a) => a.playState).join(), lockAnim: q('.lk ha-icon') ? q('.lk ha-icon').getAnimations().length : -1, ring: q('.lk .ring').getAnimations().length }; });
const C1 = await cam();
ok('på: kameraet vippet ned (−32°), lukker over linsen, kjeglen borte, grønn prikk, sveip satt på pause', /matrix\(0\.84/.test(C1.tilt) && C1.shut === 'matrix(1, 0, 0, 1, 0, 0)' && C1.cone === '0' && C1.ok === '1' && C1.rec === '0' && C1.sweep === 'paused', C1);
await setState(p, PRIV, 'off'); await wait(p, 120);
const C2 = await cam();
await wait(p, 1000);
const C3 = await cam();
ok('av via hass: lås-klikk (ingen ring), kamera sveiper (5 s), kjegle + blinkende rød REC, lukker opp', /\bkl\b/.test(C2.cls) && !/\brg\b/.test(C2.cls) && C2.lockAnim >= 1 && !/\bkl\b/.test(C3.cls) && C3.sweep === 'running' && C3.cone === '0.9' && C3.ok === '0' && C3.shut === 'matrix(1, 0, 0, 0, 0, 0)', { C2, C3 });
await shot(p, '1-privat-av');
await p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; });
await click(p, '.mk.priv');
const TG = await p.evaluate(() => ({ c: window.__calls.slice(), hap: window.__hap.slice() }));
ok('trykk på Privatmodus: homeassistant.toggle + ett haptic(medium)', TG.c.length === 1 && TG.c[0][1] === 'toggle' && TG.c[0][2].entity_id === 'input_boolean.innendors_privace_mode' && TG.hap.length === 1 && TG.hap[0] === 'medium', TG);
await setState(p, PRIV, 'on'); await wait(p, 120);
const C4 = await cam();
ok('på via hass: lås-klikk + én ring ut fra låsen', /\bkl\b/.test(C4.cls) && /\brg\b/.test(C4.cls) && C4.ring === 1, C4);
await wait(p, 900);
await setState(p, PRIV, 'unavailable'); await wait(p, 300);
const C5 = await cam();
ok('utilgjengelig: kameraet står stille i grått', /\bua\b/.test(C5.cls) && C5.sweep === '' && C5.cone === '0', C5);
await setState(p, PRIV, 'on'); await wait(p, 300);
// ---------------------------------------------------------------- faner + rader i kortet
const F = await p.evaluate(() => { const tb = [...window.__c.shadowRoot.querySelectorAll('.bar .tb')]; return { t: tb.map((t) => t.textContent.trim()), cut: tb.some((t) => t.querySelector('span').scrollWidth > t.querySelector('span').clientWidth + 1) }; });
ok('faner: Automasjoner · Varsler · Strøm, ingen avkuttet tekst ved 360 px', F.t.join() === 'Automasjoner,Varsler,Strøm' && !F.cut, F);
const R = await p.evaluate(() => { const sr = window.__c.shadowRoot, rows = [...sr.querySelectorAll('.rows .pr')]; return { n: rows.length, names: rows.map((r) => r.querySelector('.pt b').textContent.trim()), cnt: sr.querySelector('.cnt .num').textContent.trim(), ent: rows.map((r) => r.dataset.ent) }; });
ok('Automasjoner i popupen: 7 rader, «N av 7 på», hold → more-info (data-ent = hovedbryteren)', R.n === 7 && /av 7 på/.test(R.cnt) && R.ent.includes('switch.vekking_aktivert'), R);
await p.evaluate(() => { window.__calls.length = 0; });
await click(p, '.rows .pr[data-id="switch.vekking_aktivert"]');
const RT = await p.evaluate(() => window.__calls.slice());
ok('trykk på rad = homeassistant.toggle av hovedbryteren', RT.length === 1 && RT[0][2].entity_id === 'switch.vekking_aktivert', RT);
await click(p, '.tb[data-v="strom"]');
const S = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.rows .pr .pt b')].map((x) => x.textContent.trim()));
ok('Strøm-fanen: 9 rader, Energivarsler øverst', S.length === 9 && S[0] === 'Energivarsler', S);
await wait(p, 300);
const DB = await p.evaluate(() => { const sr = window.__c.shadowRoot, d = sr.querySelector('.dash msh-settings-card'), gh = sr.querySelector('.gh[data-key="dash-h"]'); return { el: !!d, gh: gh && gh.textContent.trim(), after: !!(gh && sr.querySelector('.pane').compareDocumentPosition(gh) & 4), txt: d && d.shadowRoot && d.shadowRoot.textContent.replace(/\s+/g, ' ') }; });
ok('«Dashbord» nederst: dashbordets innstillinger (msh-settings-card) – Tilpass Hjem/navbar/header, HA, Liquid Glass', DB.el && DB.gh === 'Dashbord' && DB.after && /Tilpass Hjem/.test(DB.txt) && /Tilpass navbar/.test(DB.txt) && /Home Assistant/.test(DB.txt), DB);
await p.evaluate(() => window.__c.shadowRoot.querySelector('.dash').scrollIntoView());
await shot(p, '2-dashbord');
await p.close();

// ---------------------------------------------------------------- tomtilstand (integrasjonen mangler) + Animasjoner av
const p2 = await page({ animasjoner: false });
const N = await p2.evaluate(async () => {
  const h = window.__h, E = {}; Object.entries(h.entities).forEach(([k, v]) => { E[k] = ['ki_notifications', 'ki_energi', 'ki_utelys'].includes(v.platform) ? { ...v, platform: 'demo' } : v; });
  window.__h = { ...h, entities: E }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 300));
  const sr = window.__c.shadowRoot, e = sr.querySelector('.pane .empty');
  return { txt: e && e.textContent.replace(/\s+/g, ' ').trim(), rows: sr.querySelectorAll('.rows .pr').length, na: sr.querySelector('.mk.priv').classList.contains('na'), sweep: sr.querySelector('.cm-sweep').getAnimations().length };
});
ok('mangler integrasjonen: «Fant ingen regler fra KI Varslinger og sikkerhet» + «Velg entiteter», ingen rader', /Fant ingen regler fra KI Varslinger og sikkerhet/.test(N.txt) && /Velg entiteter/.test(N.txt) && N.rows === 0, N);
ok('«Animasjoner» av: kameraet står stille', N.na && N.sweep === 0, N);
await p2.close();

// ---------------------------------------------------------------- Tilpass Innstillinger (designet) ↔ GUI-editor
const p3 = await page();
await click(p3, '.bar .gear'); await wait(p3, 600);
const E = await p3.evaluate(() => {
  const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
  const ed = find(window.MSH.overlayRoot()); window.__ed = ed;
  const sr = ed.shadowRoot, seg = sr.querySelector('.chips.sg.tabs'), ss = getComputedStyle(seg), done = sr.querySelector('.ttl .done'), tt = sr.querySelector('.ttl .tt');
  const sec = sr.querySelector('[data-focus="faner"]'), box = sec.querySelector('.sec'), bs = getComputedStyle(box), hdr = sec.querySelector('.fsh');
  const rows = [...sr.querySelectorAll('[data-elist="inn-tab"]')], r1 = rows[1], inp = r1.querySelector('input.inm'), is = getComputedStyle(inp);
  const dr = done.getBoundingClientRect(), tr = tt.getBoundingClientRect();
  return {
    title: tt.textContent.trim(), tsize: getComputedStyle(tt).fontSize + '/' + getComputedStyle(tt).fontWeight, done: done.textContent.trim(), doneRight: dr.left > tr.right - 1, doneTop: Math.abs(dr.top - tr.top) < 30, doneBg: getComputedStyle(done).backgroundImage + getComputedStyle(done).backgroundColor,
    tabs: [...seg.querySelectorAll('[data-a="tab"]')].map((t) => t.textContent.trim()), tabIcons: seg.querySelectorAll('ha-icon').length, seg: [ss.backgroundColor, ss.borderRadius, ss.paddingTop],
    hdr: hdr.textContent.trim(), hdrSize: getComputedStyle(hdr).fontSize, hdrCol: getComputedStyle(hdr).color, box: [bs.backgroundColor, bs.borderRadius, bs.boxShadow, bs.borderTopWidth],
    rows: rows.map((r) => r.querySelector('.icnt').textContent.trim()), div: getComputedStyle(r1).borderTopColor, inp: [is.backgroundColor, is.borderRadius, is.height], ic: getComputedStyle(r1.querySelector('.iic')).color, sw: !!r1.querySelector('.sw.on'),
    pencil: sr.querySelectorAll('[data-op="texp"], .mdi-pencil').length + [...sr.querySelectorAll('ha-icon')].filter((i) => /pencil|eye/.test(i.getAttribute('icon') || '')).length,
    help: [...sr.querySelectorAll('.help')].map((x) => x.textContent), next: sec.nextElementSibling && sec.nextElementSibling.querySelector('.fsh') && sec.nextElementSibling.querySelector('.fsh').textContent.trim(),
    vis: [...sec.nextElementSibling.querySelectorAll('[data-name="tab_labels"]')].map((x) => x.textContent.trim()),
  };
});
ok('tittel «Tilpass Innstillinger» 22/600 (20 under 380 px) + rosa «Ferdig»-pille øverst til høyre', E.title === 'Tilpass Innstillinger' && /^(22px|20px)\/600$/.test(E.tsize) && E.done === 'Ferdig' && E.doneRight && E.doneTop && /242, 133, 201|f285c9/i.test(E.doneBg), E);
ok('tekstfaner i segmentrad: Faner · Rader · Entiteter · Avansert, ingen ikoner, #3a3a3a r24 pad 4', E.tabs.join() === 'Faner,Rader,Entiteter,Avansert' && E.tabIcons === 0 && E.seg.join() === 'rgb(58, 58, 58),24px,4px', E);
ok('én flate: «Faner · dra for rekkefølge» 12 px versaler #7f7f7f, seksjon #3a3a3a r24 uten kant, skillelinjer', /Faner · dra for rekkefølge/i.test(E.hdr) && E.hdrSize === '12px' && E.hdrCol === 'rgb(127, 127, 127)' && E.box[0] === 'rgb(58, 58, 58)' && E.box[1] === '24px' && E.box[2] === 'none' && E.box[3] === '0px' && E.div === 'rgba(255, 255, 255, 0.06)', E);
ok('rad: ikon #afafaf, navnefelt i raden (#282828 r12 40 px), rosa bryter; ingen blyant/øye, ingen hjelpetekst', E.ic === 'rgb(175, 175, 175)' && E.inp.join() === 'rgb(40, 40, 40),12px,40px' && E.sw && E.pencil === 0 && !E.help.some((x) => /Dra for rekkefølge/.test(x)), E);
ok('tellere etter filter: 7 rader · 7 rader · 9 rader', E.rows.join() === '7 rader,7 rader,9 rader', E.rows);
ok('«Visning» rett under: Faner viser Ikon · Tekst · Begge', /Visning/i.test(E.next || '') && E.vis.join() === 'Ikon,Tekst,Begge', E);
await shot(p3, '3-tilpass-faner');
// navn i raden + skjul
await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const i = sr.querySelector('input[data-inn="tname"][data-v="varsler"]'); i.value = 'Push varsler'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(200);
  sr.querySelector('[data-op="teye"][data-v="strom"]').click(); await w(300);
});
const E1 = await p3.evaluate(() => ({ tabs: window.__ed._config.tabs, card: [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((t) => t.textContent.trim()) }));
ok('Faner: navnefelt + bryter → tabs[] (tittel, rekkefølge, skjult), forhåndsvises straks', Array.isArray(E1.tabs) && E1.tabs.find((t) => t.key === 'varsler').title === 'Push varsler' && E1.tabs.find((t) => t.key === 'strom').hidden === true && E1.card.join() === 'Automasjoner,Push varsler', E1);
// Rader: exclude (device_id), flytt (rows.move), legg til (rows.include), filter
const RR = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  sr.querySelector('[data-a="tab"][data-v="rader"]').click(); await w(250);
  const hdr = [...sr.querySelectorAll('.fsh')].map((x) => x.textContent.trim());
  const sub = [...sr.querySelectorAll('.chips.sg.tsub .chip')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
  sr.querySelector('[data-op="reye"][data-v="n_heimdall"]').click(); await w(250);
  sr.querySelector('[data-op="rexp"][data-v="n_dorlys"]').click(); await w(250);
  sr.querySelector('[data-op="rmove"][data-v="n_dorlys"][data-t="varsler"]').click(); await w(250);
  sr.querySelector('[data-op="radd-open"]').click(); await w(200);
  const q = sr.querySelector('[data-edq="inn-q"]'); q.value = 'peis'; q.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(250);
  const hit = sr.querySelector('[data-op="radd"]'); const added = hit && hit.dataset.v; if (hit) hit.click(); await w(250);
  const nm = sr.querySelector('input[data-inn="rname"][data-v="n_vekking"]'); nm.value = 'Morgenvekking'; nm.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(250);
  const c = window.__ed._config;
  return { hdr, sub, added, rows: c.rows, card: [...window.__c.shadowRoot.querySelectorAll('.rows .pr .pt b')].map((x) => x.textContent.trim()) };
});
ok('Rader: undersegment per fane med antall, «Rader · dra for rekkefølge» + «Filter for fanen»', RR.sub.length === 3 && /^Automasjoner\s*7$/.test(RR.sub[0]) && RR.hdr.some((x) => /Rader · dra for rekkefølge/i.test(x)) && RR.hdr.some((x) => /Filter for fanen/i.test(x)), RR);
ok('Rader: bryter → rows.exclude [device_id], flytt → rows.move { id: fane }, legg til → rows.include, navn → rows.names', RR.rows && RR.rows.exclude.join() === 'n_heimdall' && RR.rows.move.n_dorlys === 'varsler' && RR.rows.include.includes(RR.added) && RR.rows.move[RR.added] === 'automasjoner' && RR.rows.names.n_vekking === 'Morgenvekking'
  && !RR.card.includes('Heimdall') && !RR.card.includes('Dørlys') && RR.card.includes('Morgenvekking'), RR);
const FL = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const i = sr.querySelector('input[data-inn="fenh"]'); i.value = 'vekking, autolås'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(250);
  return { f: window.__ed._config.tabs.find((t) => t.key === 'automasjoner').filter, card: [...window.__c.shadowRoot.querySelectorAll('.rows .pr .pt b')].map((x) => x.textContent.trim()) };
});
ok('Filter: enheter for valgt fane → tabs[i].filter (samme som ki-varsling-card)', FL.f && FL.f.enheter.join() === 'vekking,autolås' && FL.card.includes('Morgenvekking') && FL.card.includes('Autolås') && !FL.card.includes('Ansiktsgjenkjenning'), FL);
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
  return { dbg: hb ? '' : [...gs.querySelectorAll('[data-op]')].map((x) => x.dataset.op + ':' + x.dataset.v).join(' ').slice(0, 600), saved: { tabs: cfg.tabs, rows: cfg.rows }, tabs, gui: changed && changed.rows };
});
ok('Ferdig lagrer; GUI-editoren viser samme config og skriver samme YAML (rows.exclude)', G.saved.tabs.find((t) => t.key === 'varsler').title === 'Push varsler' && G.tabs.includes('Push varsler') && G.tabs.some((x) => /:skjult$/.test(x)) && G.gui && G.gui.exclude.includes('n_autolas') && G.gui.move.n_dorlys === 'varsler', G);
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
ok('migrering: natt, helg→privat, vekking; tabs[i] fra ki-tabs-card (tittel «Push varsler»), gap-card borte, ingen enheter:-lister', ST.mig.natt === 'switch.nattmodus' && ST.mig.privat === 'input_boolean.innendors_privace_mode' && ST.mig.vekking === 'sensor.soverom_vekking_neste_alarm'
  && ST.mig.tabs.map((t) => t.key).join() === 'automasjoner,varsler,strom' && ST.mig.tabs[1].title === 'Push varsler' && !JSON.stringify(ST.mig).includes('enheter'), ST.mig);
ok('strategien: #settings = ÉTT msh-innstillinger-card (card_id pop-innstillinger); #innstillinger ikke i tillegg', ST.n0 === 1 && ST.t0.join() === 'custom:msh-innstillinger-card' && !ST.inn, ST);
ok('importert #settings (ki-natt/tabs/varsling) erstattes («Erstattet av Innstillinger») og oppsettet flyttes inn', ST.n === 1 && ST.cards.length === 1 && ST.cards[0].type === 'custom:msh-innstillinger-card' && ST.cards[0].card_id === 'pop-innstillinger' && ST.cards[0].privat === 'input_boolean.innendors_privace_mode' && ST.cards[0].tabs[1].title === 'Push varsler' && ST.inactive.join() === 'Innstillinger', ST);
await p4.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
