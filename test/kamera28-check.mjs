// Fiks 28.12 · Kamera: egne kameranavn (names) + standardnavn uten kanal-suffiks + padT (Direkte/Frigate-raden).
//   node test/kamera28-check.mjs   (SHOTS=<mappe> gir skjermbilder)
// Uavhengig av klokkeslett.
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/kamera28-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp) {
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  // Ekte UniFi-mønster: «High resolution channel» som entitetsnavn på flere enheter + pakkekamera
  await p.evaluate(() => {
    window.mockExtend(({ add, D }) => {
      D.dev_hage = { id: 'dev_hage', area_id: null, name: 'Hage', model: 'G5 Turret Ultra' };
      add('camera.g5_turret_high_resolution_channel', 'streaming', { access_token: 'tq', friendly_name: 'High resolution channel' }, { platform: 'unifiprotect', device: 'dev_hage' });
    });
  });
  return p;
}
const mk = (p, cfg) => p.evaluate(async (cfg) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.getElementById('dash').innerHTML = '';
  const h = window.mockHass();
  window.__h = h;
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kamera' });
  bc.innerHTML = '<div class="pop bubble-pop-up" style="overflow:hidden;display:flex;flex-direction:column;height:100vh"><div class="hdr bubble-header-container" style="height:50px;flex:none">Kamera</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#kamera';
  const c = document.createElement('msh-kamera-card');
  c.setConfig({ type: 'custom:msh-kamera-card', card_id: 'kam28', ...cfg });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c;
  await w(800);
  return true;
}, cfg);
const deep = (sel) => `(() => { const walk = (r) => { const x = r.querySelector('${sel}'); if (x) return x; for (const e of r.querySelectorAll('*')) if (e.shadowRoot) { const y = walk(e.shadowRoot); if (y) return y; } return null; }; return walk(document); })()`;

for (const vp of [{ width: 390, height: 900, tag: 'mobil' }, { width: 1280, height: 900, tag: 'PC' }]) {
  const p = await page({ width: vp.width, height: vp.height });
  const T = vp.tag;
  await mk(p, {});
  /* ---------------- standardnavn */
  const A = await p.evaluate(() => {
    const sr = window.__c.shadowRoot, t = (s) => [...sr.querySelectorAll(s)].map((e) => e.textContent.trim());
    const M = window.MSH, h = window.__h;
    return { chips: t('.ch span'), tiles: t('.tile .tn'), dn: Object.fromEntries(Object.keys(h.states).filter((x) => x.startsWith('camera.')).map((x) => [x, M.cameraDefaultName(h, x)])) };
  });
  const all = [...A.chips, ...A.tiles, ...Object.values(A.dn)].join(' | ');
  ok(`${T}: ingen «resolution channel»/«Package Camera» i chips, fliser eller standardnavn`, !/resolution|channel|package camera/i.test(all), A);
  const dv = Object.values(A.dn);
  ok(`${T}: standardnavn fra enheten (device_registry) – Ringeklokke …, Hage …, Veranda`, /^Ringeklokke/.test(A.dn['camera.inngang']) && /^Hage/.test(A.dn['camera.g5_turret_high_resolution_channel']) && A.dn['camera.veranda'] === 'Veranda', A.dn);
  ok(`${T}: like navn får kanal/modell («Ringeklokke · Pakke», «Ringeklokke · Middels»), alle standardnavn unike`, /^Ringeklokke · Pakke/.test(A.dn['camera.pakke']) && A.dn['camera.inngang_medium_resolution_channel'] === 'Ringeklokke · Middels' && new Set(dv).size === dv.length, A.dn);
  ok(`${T}: chips og fliser bruker standardnavnene`, A.chips.includes(A.dn['camera.inngang']) && A.chips.includes(A.dn['camera.pakke']) && A.tiles.includes(A.dn['camera.veranda']), A);

  /* ---------------- padT (standard −10) + ingen ekstra luft */
  const P = await p.evaluate(() => {
    const sr = window.__c.shadowRoot, top = sr.querySelector('.top'), hdr = document.querySelector('.bubble-header-container');
    return { mt: getComputedStyle(top).marginTop, d: Math.round(top.getBoundingClientRect().top - hdr.getBoundingClientRect().bottom), cardMt: window.__c.style.marginTop, hcPad: getComputedStyle(sr.querySelector('ha-card')).paddingTop };
  });
  ok(`${T}: padT standard −10 = margin-top på Direkte/Frigate-raden, avstand til headeren −10 px, ingen padding i ha-card`, P.mt === '-10px' && Math.abs(P.d - -10) <= 1 && P.hcPad === '0px', P);

  /* ---------------- egne navn: brukt overalt */
  await mk(p, { padT: 20, names: { 'camera.inngang': 'Inngang', 'camera.pakke': 'Pakkeboks' }, view: 'alle' });
  const N = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c, sr = c.shadowRoot, t = (s) => [...sr.querySelectorAll(s)].map((e) => e.textContent.trim());
    const top = sr.querySelector('.top'), hdr = document.querySelector('.bubble-header-container');
    const r = { chips: t('.ch span'), tiles: t('.tile .tn'), mt: getComputedStyle(top).marginTop, d: Math.round(top.getBoundingClientRect().top - hdr.getBoundingClientRect().bottom) };
    c.setUI({ view: 'camera.inngang' }); await w(200);
    r.one = t('.one .on1')[0];
    c.setUI({ view: 'events' }); await w(200);
    r.ev = t('.evr .t2').join(' | ');
    c.setUI({ view: 'alle' }); await w(100);
    r.api = window.MSH.cameraName(window.__h, c.config, 'camera.inngang');
    return r;
  });
  ok(`${T}: names vises på chips og fliser`, N.chips.includes('Inngang') && N.chips.includes('Pakkeboks') && N.tiles.includes('Inngang') && !N.chips.includes('Ringeklokke'), N);
  ok(`${T}: names i enkeltvisning og hendelser`, N.one === 'Inngang' && /Inngang ·/.test(N.ev), N);
  ok(`${T}: padT 20 → margin-top 20 px på raden (20 px under headeren)`, N.mt === '20px' && Math.abs(N.d - 20) <= 1, N);
  if (shots) await p.screenshot({ path: `${shots}/kamera28-${T}-popup.png` });

  /* ---------------- «Tilpass kameraer»: navnefelt + padT-rad */
  const E = await p.evaluate(async (deepSel) => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c;
    c.customize();
    await w(600);
    const ed = eval(deepSel);
    if (!ed) return { none: true };
    const R = ed.shadowRoot, cs = (e) => getComputedStyle(e), rect = (e) => e.getBoundingClientRect();
    const inp = R.querySelector('input[data-a="nm"][data-v="camera.inngang"]'), lab = inp.closest('.nm');
    const ph = R.querySelector('input[data-a="nm"][data-v="camera.veranda"]');
    const out = { val: inp.value, ph: ph.placeholder, phVal: ph.value, bg: cs(lab).backgroundColor, rad: cs(lab).borderRadius, h: Math.round(rect(lab).height), icon: lab.querySelector('ha-icon') && lab.querySelector('ha-icon').getAttribute('icon') };
    // padT-rad: etikett på én linje, slider i full bredde under, chips under
    // felles ki-spacing-editor (28.10) når den finnes, ellers kortets egne rader med samme design
    const kse = R.querySelector('ki-spacing-editor'), SR = kse ? kse.shadowRoot : R;
    const row = kse ? SR.querySelector('.r[data-spn="padT"]') : R.querySelector('input[data-k="padT"]').closest('.spr');
    const lb = row.querySelector(kse ? '.lt' : '.spl'), sl = row.querySelector('input[type=range]'), ch = row.querySelector(kse ? '.c' : '.spc-ch');
    out.row = { shared: !!kse, lbH: Math.round(rect(lb).height), ws: cs(lb).whiteSpace, slW: Math.round(rect(sl).width), rowW: Math.round(rect(row).width), slTop: rect(sl).top > rect(lb).bottom - 1, chTop: rect(ch).top > rect(sl).bottom - 1, val: row.querySelector(kse ? '.v' : '.spv').textContent, chips: [...ch.children].map((x) => x.textContent), on: (ch.querySelector('.on') || {}).textContent, spcBg: cs(row.parentNode).backgroundColor, spcRad: cs(row.parentNode).borderRadius };
    out.padChip = () => (kse ? SR.querySelector('.p[data-spn="padT"][data-spv="44"]') : [...R.querySelectorAll('.spp')].find((x) => x.dataset.k === 'padT' && x.dataset.v === '44'));
    // skriv nytt navn → live forhåndsvisning, change → config
    let last = null; ed.addEventListener('msh-change', (e) => { last = e.detail.config; });
    ph.focus(); ph.value = 'Terrasse'; ph.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await w(100);
    out.live = last && last.names && last.names['camera.veranda'];
    ph.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await w(100);
    out.after = last && last.names;
    // tomt felt → standardnavnet igjen
    inp.value = ''; inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await w(100);
    out.cleared = last && last.names;
    // padT-chip «Luftig 44»
    out.padChip().click(); delete out.padChip;
    await w(100);
    out.padT = last && last.padT;
    out.cardChip = [...c.shadowRoot.querySelectorAll('.ch span')].map((e) => e.textContent).includes('Terrasse');
    out.done = !!R.querySelector('.hd .done');
    R.querySelector('.hd .done').click();
    await w(900);
    out.saved = c.config.names;
    return out;
  }, deep('msh-kamera-editor'));
  ok(`${T}: Tilpass kameraer: navnefelt (#282828, r10, 30 px, blyant-ikon), placeholder = standardnavn`, !E.none && E.val === 'Inngang' && E.ph === 'Veranda' && E.phVal === '' && E.bg === 'rgb(40, 40, 40)' && E.rad === '10px' && E.h === 30 && /pencil|edit/.test(E.icon || ''), E);
  ok(`${T}: padT-rad som Rom v4 (#404040 r24, etikett på én linje, slider full bredde, chips under, Standard −10)`, E.row && E.row.ws === 'nowrap' && E.row.lbH <= 22 && E.row.slW >= E.row.rowW - 2 && E.row.slTop && E.row.chTop && E.row.val === '20 px' && E.row.chips.join('|') === 'Inntil −20|Standard −10|Tett 6|Luftig 44' && E.row.spcBg === 'rgb(64, 64, 64)' && E.row.spcRad === '24px', E.row);
  ok(`${T}: nytt navn → live forhåndsvisning + names i config; tomt felt fjerner nøkkelen`, E.live === 'Terrasse' && E.after && E.after['camera.veranda'] === 'Terrasse' && E.cleared && !('camera.inngang' in E.cleared) && E.cleared['camera.veranda'] === 'Terrasse', E);
  ok(`${T}: padT-chip setter padT, Ferdig lagrer names`, E.padT === 44 && E.saved && E.saved['camera.veranda'] === 'Terrasse', E);
  if (shots) await p.screenshot({ path: `${shots}/kamera28-${T}-tilpass.png` });
  await p.close();
}

/* ---------------- GUI-editoren (getConfigElement): tekstfelt per kamera + padT */
{
  const p = await page({ width: 500, height: 1200 });
  const G = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const g = customElements.get('msh-kamera-card').getConfigElement();
    g.hass = window.mockHass();
    g.setConfig({ type: 'custom:msh-kamera-card', card_id: 'gui28', names: { 'camera.inngang': 'Inngang' } });
    document.body.appendChild(g);
    await w(300);
    let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
    const R = g.shadowRoot;
    // åpne alle seksjoner
    R.querySelectorAll('[data-a="sec"], .sec-h, summary').forEach((x) => { try { x.click(); } catch (e) { /* */ } });
    await w(200);
    const f = R.querySelector('input[data-name="names.camera\\\\.veranda"]'), fi = R.querySelector('input[data-name="names.camera\\\\.inngang"]');
    const out = { has: !!f, val: fi && fi.value, ph: f && f.placeholder, padT: !!R.querySelector('[data-name="padT"]'), padTop: !!R.querySelector('[data-name="pad_top"]') };
    if (f) { f.value = 'Terrasse'; f.dispatchEvent(new Event('input', { bubbles: true, composed: true })); f.dispatchEvent(new Event('change', { bubbles: true, composed: true })); }
    await w(900);
    out.names = changed && changed.names;
    return out;
  });
  ok('GUI-editor: tekstfelt per kamera (names.<entity_id>), placeholder = standardnavn, padT-slider, pad_top fjernet', G.has && G.val === 'Inngang' && G.ph === 'Veranda' && G.padT && !G.padTop, G);
  ok('GUI-editor: skriver names { entity_id: navn } (punktum i nøkkelen)', G.names && G.names['camera.veranda'] === 'Terrasse' && G.names['camera.inngang'] === 'Inngang' && !G.names.camera, G);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nalle OK');
process.exit(fail.length ? 1 : 0);
