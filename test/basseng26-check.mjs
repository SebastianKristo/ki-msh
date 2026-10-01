// Fiks 26.14 · Basseng (#basseng / importert #badebasseng): ÉTT kort msh-basseng-card – toppkort → prosalinje → faner
// → innhold; hurtigknapper Lys · Pumpe · Varme · Stille (lyd av) · Stikkontakt autokonfigurert etter rolle-tabellen,
// overrides/exclude/include, migrering av `hurtig:`/navn/hero-kort og basseng-v3-cfg, strategien (alias #badebasseng),
// bunnluft uten gap-card og «Tilpass basseng» ↔ getConfigElement.   node test/basseng26-check.mjs  (SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/basseng26-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

// Brukerens anlegg (ingen område – funnet via navn/id, typoen «baseng» inkludert)
const USER = [
  ['light.bassenglys', 'off', { friendly_name: 'Bassenglys', supported_color_modes: ['onoff'] }],
  ['switch.bassengpumpe', 'on', { friendly_name: 'Bassengpumpe' }],
  ['climate.basseng_bassengvarmepumpe', 'heat', { friendly_name: 'Bassengvarmepumpe', temperature: 28, current_temperature: 26.4, hvac_action: 'heating', hvac_modes: ['off', 'heat'] }],
  ['switch.baseng_basengvarmepumpe_stillemodus', 'off', { friendly_name: 'Basengvarmepumpe Stillemodus' }],
  ['switch.baseng_stikkontakt', 'on', { friendly_name: 'Baseng Stikkontakt', device_class: 'outlet' }],
  ['sensor.basseng_vanntemperatur', '26.4', { friendly_name: 'Basseng vanntemperatur', device_class: 'temperature', unit_of_measurement: '°C' }],
];

async function page(cfg, opts = {}) {
  const p = await b.newPage({ viewport: opts.vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  if (opts.ls) await p.evaluate((v) => { localStorage.setItem('basseng-v3-cfg', JSON.stringify(v)); window.__pc0 = v; }, opts.ls);
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, user, USER }) => {
    const h = window.mockHass();
    if (user) {
      // bare brukerens anlegg: fjern basseng-området og alt i det
      delete h.areas.basseng;
      Object.keys(h.entities).forEach((id) => { if (h.entities[id].area_id === 'basseng' || /basseng|pool|klorlogg/.test(id)) { delete h.states[id]; delete h.entities[id]; } });
      USER.forEach(([id, st, at]) => { h.states[id] = { entity_id: id, state: st, attributes: at, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() }; h.entities[id] = { entity_id: id, platform: 'demo', area_id: null, device_id: null }; });
    }
    window.__h = h;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#basseng' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Basseng</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#basseng';
    const c = document.createElement('msh-basseng-card');
    c.setConfig({ type: 'custom:msh-basseng-card', card_id: 'pop-basseng', ...(cfg || {}) });
    c.hass = h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 800));
  }, { cfg, user: !!opts.user, USER });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const click = async (p, sel) => { await p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) throw new Error('fant ikke ' + sel); e.click(); }, sel); await wait(p, 250); };
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').slice());
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; });
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/basseng-${n}.png`, fullPage: true }); };
const quick = (p) => p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.ctl .tile')].map((e) => e.dataset.k + '=' + (e.dataset.ent || '') + '|' + e.textContent.trim()));

// ================================================================ A · brukerens anlegg: rollene finnes automatisk
let p = await page({}, { user: true });
let L = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, card = sr.querySelector('ha-card'), kids = [...card.children].map((e) => e.className || e.localName);
  const wrap = sr.querySelector('.wrap'), W = [...wrap.children].map((e) => e.className.split(' ').filter((x) => x !== 'press').join('.'));
  const hero = sr.querySelector('.msh-hero-slot msh-basseng-hero-card');
  return { kids, W, hero: !!hero, heroT: hero && hero.shadowRoot && hero.shadowRoot.querySelector('.t') ? hero.shadowRoot.querySelector('.t').textContent : null, heroN: hero && hero.shadowRoot && hero.shadowRoot.querySelector('.lbl') ? hero.shadowRoot.querySelector('.lbl').textContent : null, prose: sr.querySelector('.ptop').textContent.replace(/\s+/g, ' ').trim(), tabs: [...sr.querySelectorAll('.gti')].map((e) => e.textContent), inner: [...document.querySelector('.inner').children].map((e) => e.localName), w: Math.round(window.__c.getBoundingClientRect().width), iw: Math.round(document.querySelector('.inner').getBoundingClientRect().width) - 36 };
});
ok('A · ett kort i popupen', L.inner.join() === 'msh-basseng-card', L.inner);
ok('A · rekkefølge: toppkort → prosalinje → faner → innhold', L.kids[0] === 'msh-hero-slot' && L.hero && L.W[0].startsWith('prose') && L.W[1] === 'tabrow', L);
ok('A · toppkortet viser vanntemperatur 26,4', /26,4/.test(L.heroT || ''), L.heroT);
ok('A · prosalinje «Vannet er 26,4° og 1,6° under målet. Pumpa går nå.»', /Vannet er 26,4° og 1,6° under målet\. Pumpa går nå\./.test(L.prose), L.prose);
ok('A · faner Oversikt · Varme · Klor skjules uten data (Klor/Spreder uten entiteter)', L.tabs.join('|') === 'Oversikt|Varme', L.tabs);
ok('A · fyller bredden (390 px)', Math.abs(L.w - L.iw) <= 2, [L.w, L.iw]);
let Q = await quick(p);
ok('A · fem hurtigknapper funnet automatisk: Lys, Pumpe, Varme, Stille, Stikkontakt',
  Q.join(',') === 'light=light.bassenglys|Lys,pump=switch.bassengpumpe|Pumpe,heat=climate.basseng_bassengvarmepumpe|Varme,quiet=switch.baseng_basengvarmepumpe_stillemodus|Stille,sock=switch.baseng_stikkontakt|Stikkontakt', Q);
await shot(p, 'a-oversikt');
await clearCalls(p);
await click(p, '.tile[data-k="quiet"]');
let CA = await calls(p);
ok('A · «Stille» (Lyd av) slår stillemodus-bryteren', CA.some((c) => c[1] === 'toggle' && c[2].entity_id === 'switch.baseng_basengvarmepumpe_stillemodus'), CA);
await clearCalls(p);
await click(p, '.tile[data-k="heat"]');
CA = await calls(p);
ok('A · «Varme» slår av climate', CA.some((c) => c[0] === 'climate' && c[1] === 'turn_off' && c[2].entity_id === 'climate.basseng_bassengvarmepumpe'), CA);
L = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { graf: !!sr.querySelector('[data-key="ovgraf"] svg.chart'), mx: (sr.querySelector('[data-key="ovgraf"] .hch') || {}).textContent }; });
ok('A · Oversikt har temperaturgraf med maks og min', L.graf && /maks .*min /s.test(L.mx || ''), L);
await p.close();

// ---------------- overrides / exclude / include (YAML-form)
p = await page({ overrides: { pump: 'switch.baseng_stikkontakt' }, exclude: ['sock', 'quiet'], include: [{ entity: 'light.stue_tak', navn: 'Fontene', ikon: 'mdi:fountain' }] }, { user: true });
Q = await quick(p);
ok('B · overrides.pump bytter, exclude fjerner Stille/Stikkontakt, include legger til ekstra knapp',
  Q.join(',') === 'light=light.bassenglys|Lys,pump=switch.baseng_stikkontakt|Pumpe,heat=climate.basseng_bassengvarmepumpe|Varme,x:light.stue_tak=light.stue_tak|Fontene', Q);
await p.close();

// ---------------- rekkefølge og skjuling (controls / hidden_controls, designets ctl/ctlHide)
p = await page({ ctl: ['sock', 'mute', 'light'], ctlHide: { pump: true } }, { user: true });
Q = await quick(p);
ok('C · ctl/ctlHide styrer rekkefølge og skjuling (mute = Stille)', Q.map((x) => x.split('=')[0]).join(',') === 'sock,quiet,light,heat', Q);
await p.close();

// ================================================================ D · migrering av gammel config
p = await page({ navn: 'Bassenget', hero: false, hurtig: [{ entity: 'light.bassenglys', navn: 'Lys' }, { entity: 'switch.bassengpumpe', navn: 'Pumpe' }, { entity: 'switch.baseng_basengvarmepumpe_stillemodus' }, { entity: 'switch.baseng_stikkontakt', navn: 'Stikkontakt' }, { entity: 'light.stue_tak', navn: 'Terrasse', ikon: 'mdi:outdoor-lamp' }], varmepumpe: 'climate.basseng_bassengvarmepumpe' }, { user: true });
let N = await p.evaluate(() => window.MSH.poolNorm(window.__c._rawConfig, window.__h));
ok('D · hurtig: autokonfig-roller skrives ikke inn, resten → include.hurtig + labels; navn → name; hurtig/hero fjernet',
  !N.hurtig && !('hero' in N) && !N.navn && N.name === 'Bassenget' && !N.overrides && JSON.stringify(N.include) === '{"hurtig":["light.stue_tak"]}' && N.labels['light.stue_tak'].navn === 'Terrasse' && !N.varmepumpe, N);
Q = await quick(p);
ok('D · gammel config vises riktig før migreringen er lagret', Q.length === 6 && Q[5] === 'x:light.stue_tak=light.stue_tak|Terrasse', Q);
L = await p.evaluate(() => { const hero = window.__c.shadowRoot.querySelector('msh-basseng-hero-card'); return hero && hero.shadowRoot.querySelector('.lbl').textContent; });
ok('D · navn fra hero-kortet vises i toppkortet', L === 'Bassenget', L);
N = await p.evaluate(() => window.MSH.poolNorm({ type: 'custom:msh-basseng-card', hurtig: ['switch.annen_pumpe'] }, window.__h));
ok('D · hurtig-entitet som avviker fra autokonfig → overrides', JSON.stringify(N.overrides) === '{"pump":"switch.annen_pumpe"}' && !N.include, N);
await p.close();

// ---------------- basseng-v3-cfg (designets localStorage) → config
p = await page({}, { user: true, ls: { ents: { spr: 'switch.hage_spreder', cal: 'calendar.klor' }, ctl: ['pump', 'light', 'mute'], ctlHide: { light: true }, tabs: ['klor', 'ov', 'heat', 'spr'], tabHide: {}, vals: { 'Omsetninger per døgn': '4', 'Prisstyring': false }, anim: false, chips: true } });
N = await p.evaluate(() => ({ ls: window.MSH.poolLS(), n: window.MSH.poolNorm({ type: 'custom:msh-basseng-card', card_id: 'pop-basseng' }, window.__h, window.__pc0) }));
ok('E · basseng-v3-cfg fjernes fra localStorage etter migreringen (config er sannheten)', N.ls === null, N.ls);
N = N.n;
ok('E · basseng-v3-cfg → overrides/controls/hidden_controls/tabs/vals/anim i config',
  N.overrides.spr === 'switch.hage_spreder' && N.overrides.klor_calendar === 'calendar.klor' && N.controls.join() === 'pump,light,quiet' && N.hidden_controls.join() === 'light' && N.tabs[0] === 'klor' && N.vals.turnovers === '4' && N.vals.price_ctrl === false && N.anim === false, N);
await p.close();

// ================================================================ F · strategien: importert #badebasseng → #basseng med ÉTT kort
p = await page({}, {});
let S = await p.evaluate(() => {
  const M = window.MSH;
  const legacy = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', name: 'Badebasseng', icon: 'mdi:pool', button_type: 'name', popup_mode: 'x', sub_button: { main: [], bottom: [] },
    cards: [{ type: 'custom:gap-card', height: 10 }, { type: 'custom:ki-basseng-hero-card', navn: 'Bassenget' }, { type: 'custom:gap-card' }, { type: 'custom:ki-basseng-card', hero: false, hurtig: [{ entity: 'light.bassenglys', navn: 'Lys' }, { entity: 'switch.bassengpumpe' }, { entity: 'switch.baseng_stikkontakt' }] }] };
  const cfg = { custom_popups: [legacy] };
  const extra = M.POPUP_EXTRA['#basseng'](cfg);
  const gen = M.popupTemplateA({ name: 'Basseng', icon: 'mdi:pool', hash: '#basseng', card: { type: 'custom:msh-basseng-card', card_id: 'pop-basseng', ...(extra || {}) } });
  const r = M.mergePopups({ auto: [{ config: gen, group: 'fn' }], custom: cfg.custom_popups });
  const out = r.popups.filter((x) => /basseng/.test(x.hash));
  return { hashes: out.map((x) => x.hash), cards: out[0] && out[0].cards.map((c) => c.type), card: out[0] && out[0].cards[0], extra, inactive: r.report.inactive, gap: JSON.stringify(out).includes('gap-card'), legacyWhen: M.bassengLegacy(cfg) };
});
ok('F · importert #badebasseng erstattes: én popup #basseng med ÉTT msh-basseng-card, ingen gap-card', S.hashes.join() === '#basseng' && S.cards.join() === 'custom:msh-basseng-card' && !S.gap, S);
ok('F · navn og hurtig flyttes fra de gamle kortene til kortet (migreres der)', S.extra && S.extra.navn === 'Bassenget' && Array.isArray(S.extra.hurtig) && S.card.navn === 'Bassenget' && S.legacyWhen, S.extra);
S = await p.evaluate(() => {
  const M = window.MSH;
  const legacy = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', cards: [{ type: 'custom:ki-basseng-card' }] };
  const gen = M.popupTemplateA({ name: 'Basseng', icon: 'mdi:pool', hash: '#basseng', card: { type: 'custom:msh-basseng-card', card_id: 'pop-basseng' } });
  const r = M.mergePopups({ auto: [{ config: gen, group: 'fn' }], custom: [legacy], userPopups: { basseng: { prefer: 'custom' } } });
  const own = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', cards: [{ type: 'markdown', content: 'x' }] };
  const r2 = M.mergePopups({ auto: [{ config: gen, group: 'fn' }], custom: [own] });
  return { pref: r.popups.filter((x) => x.hash === '#basseng').map((x) => x.cards[0].type), own: r2.popups.map((x) => x.hash).filter((h) => /basseng/.test(h)) };
});
// Fiks 28.14: også «Bruk egen» får de gamle kortene (ki-basseng-card/hero/gap-card) migrert til ÉTT msh-basseng-card
ok('F · «Bruk egen» beholder egen popup (gamle kort migrert til msh-basseng-card); en helt annen #badebasseng røres ikke', S.pref.join() === 'custom:msh-basseng-card' && S.own.join() === '#basseng,#badebasseng', S);
// manuelt dashbord (M.buildPopups): #badebasseng tas over som #basseng med ett kort
S = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h;
  const lc = { views: [{ title: 'Hjem', type: 'sections', sections: [{ type: 'grid', cards: [{ type: 'custom:msh-hjem-card' }, { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', name: 'Badebasseng', cards: [{ type: 'custom:gap-card' }, { type: 'custom:ki-basseng-hero-card', navn: 'Bassenget' }, { type: 'custom:ki-basseng-card', hurtig: [{ entity: 'switch.bassengpumpe' }] }] }] }] }] };
  const old = h.callWS;
  h.callWS = (m) => (m.type === 'lovelace/config' ? Promise.resolve(JSON.parse(JSON.stringify(lc))) : old(m));
  const r = await M.buildPopups(h, { dryRun: true });
  h.callWS = old;
  const pops = []; JSON.stringify(r.config, (k, v) => { if (v && v.card_type === 'pop-up' && /basseng/.test(v.hash)) pops.push(v); return v; });
  return pops.map((x) => ({ hash: x.hash, cards: x.cards.map((c) => c.type), navn: x.cards[0].navn, hurtig: !!x.cards[0].hurtig }));
});
ok('F · manuelt dashbord: #badebasseng blir #basseng med ÉTT kort (navn/hurtig med)', S.length === 1 && S[0].hash === '#basseng' && S[0].cards.join() === 'custom:msh-basseng-card' && S[0].navn === 'Bassenget' && S[0].hurtig, S);
await p.close();

// ================================================================ G · editorene og bunnluft
p = await page({}, {});
S = await p.evaluate(() => {
  const C = customElements.get('msh-basseng-card'), sch = C.schema, ov = sch.find((f) => f.type === 'overrides'), ord = sch.find((f) => f.name === 'controls');
  const el = C.getConfigElement();
  return { el: el.localName, fields: ov.fields.map((f) => f.name), ctl: ord.options.map((o) => o[0]), pad: C.spacingDefaults.pad_bottom, bot: window.MSH.popupBottomPad(C.spacingDefaults.pad_bottom), lists: sch.some((f) => f.type === 'lists') };
});
ok('G · GUI-editor (getConfigElement) med samme skjema: Entiteter inkl. Stille/Stikkontakt, hurtigknapper, lister', S.el === 'msh-editor' && ['water', 'ute', 'pump', 'heat', 'quiet', 'sock', 'light', 'cover', 'power', 'spr', 'klor_calendar'].every((k) => S.fields.includes(k)) && S.ctl.slice(0, 5).join() === 'light,pump,heat,quiet,sock' && S.lists, S);
ok('G · bunnluft ≥ 120 px over navbaren (68 + 8 + 44 + safe area), ingen gap-card', S.pad === 44 && /68px/.test(S.bot) && /44px/.test(S.bot) && /safe-area-inset-bottom/.test(S.bot), S.bot);
await clearCalls(p);
await click(p, '.cfg[data-act="customize"]');
await wait(p, 400);
S = await p.evaluate(() => { let e = null; const w = (r, d) => { if (e || !r || d > 10) return; e = r.querySelector('msh-editor'); if (!e) r.querySelectorAll('*').forEach((x) => { if (x.shadowRoot) w(x.shadowRoot, d + 1); }); }; w(document, 0); return { open: !!e, t: e && (e.shadowRoot || e).textContent.slice(0, 60) }; });
ok('G · tannhjulet åpner «Tilpass» (msh-editor-arket)', S.open, S);
await p.close();

// ---------------- tomt: ingen entiteter → «–» + Velg entitet, toppkortet vises likevel
p = await page({ area: 'finnes_ikke' }, {});
S = await p.evaluate(() => { const sr = window.__c.shadowRoot; const hero = sr.querySelector('msh-basseng-hero-card'); return { hero: !!hero && !!hero.shadowRoot.querySelector('.hero'), t: hero && hero.shadowRoot.querySelector('.t').textContent, prose: sr.querySelector('.ptop').textContent.replace(/\s+/g, ' ').trim(), q: sr.querySelectorAll('.ctl .tile').length, pick: !!sr.querySelector('.qempty [data-act="customize"]') }; });
ok('H · uten entiteter: toppkort med «–», prosalinje «Vannet er –» + Velg entitet, ingen hurtigknapper', S.hero && /–/.test(S.t) && /Vannet er – \. ?Velg entitet|Vannet er –\. Velg entitet/.test(S.prose) && S.q === 0 && S.pick, S);
await p.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.error('FEIL:', fail.join(' | ')); process.exit(1); }
console.log('Basseng 26.14: alt OK');
