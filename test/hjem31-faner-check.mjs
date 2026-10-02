// Fiks 31.4 · Hjem: seks fanestiler (tab_style pille | glide | chips | to | popup | gear) – fasit Etasjevelger.dc.html
// (Nå, 1a, 1c, 1d) og Hjem v3.dc.html (fs / tabSet). Mål og farger måles direkte (designfilene rendres ikke her).
//   · hver stil: mål/farger som designet, trykk bytter fane + haptic selection, hold 400 ms + dra = ny tab_order (28.13),
//     touch-action pan-y på radene (fallgruve 2)
//   · status i Chips fra ekte data (rom per etasje, favoritter på Hjem, lave batterier – endres live)
//   · «Som popups» og «Tekst + tannhjul» = samme komponent (MSH.tabBar) som Lys-popupens fanelinje
//   · «Tilpass Hjem» → Faner → Fanestil: Stil + «Fanene viser» + forhåndsvisning (live, trykk bytter fane på Hjem)
//   · getConfigElement(): tab_style / tab_mode i skjemaet
// Kjør: node test/hjem31-faner-check.mjs   (SHOTS=dir → skjermbilder per stil)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/h31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const p = await b.newPage({ viewport: { width: 390, height: 860 }, hasTouch: true });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const wait = (ms) => p.waitForTimeout(ms);

await p.evaluate(async () => {
  const H = (window.H = window.mockHass());
  window.HAP = [];
  window.addEventListener('haptic', (e) => window.HAP.push(e.detail));
  const box = document.createElement('div'); box.style.cssText = 'width:358px;padding:0 16px';
  const F = (window.F = document.createElement('msh-hjem-faner-card'));
  F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-home-faner' }); F.hass = H;
  box.appendChild(F); document.getElementById('dash').appendChild(box);
  window.R = () => F.shadowRoot;
  window.cs = (el, k) => getComputedStyle(el)[k];
  window.rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  window.setStyle = async (patch) => { await F._saveCfg(patch); await new Promise((q) => setTimeout(q, 1300)); }; // samme lagring som kortet (ki-store)
  await new Promise((q) => setTimeout(q, 600));
});

const click = async (sel, i) => { const r = await p.evaluate(({ sel, i }) => { const el = [...R().querySelectorAll(sel)][i]; return el ? rect(el) : null; }, { sel, i }); if (r) await p.mouse.click(r.cx, r.cy); await wait(350); return r; };
const cur = () => p.evaluate(() => F._cur && F._cur.id);
const visIds = () => p.evaluate(() => (F._TV || []).map((t) => t.id));
// Hold + dra med mus: fane i → plass j (sentrum til sentrum)
const holdDrag = async (sel, i, j) => {
  const [a, z] = await p.evaluate(({ sel, i, j }) => { const L = [...R().querySelectorAll(sel)]; return [rect(L[i]), rect(L[j])]; }, { sel, i, j });
  await p.mouse.move(a.cx, a.cy); await p.mouse.down(); await wait(560);
  const lift = await p.evaluate(({ sel, i }) => { const el = [...R().querySelectorAll(sel)][i]; return { tf: el.style.transform, ta: el.style.touchAction }; }, { sel, i });
  for (let k = 1; k <= 14; k++) { await p.mouse.move(a.cx + ((z.cx + (j > i ? 6 : -6) - a.cx) * k) / 14, a.cy); await wait(16); }
  await p.mouse.up(); await wait(1400); // saveCardConfig debouncer 600 ms og setter config live etterpå
  return lift;
};
const reorderCheck = async (name, sel) => {
  const before = await visIds();
  const ids0 = await p.evaluate((sel) => [...R().querySelectorAll(sel)].map((b) => b.dataset.v), sel);
  const lift = await holdDrag(sel, 0, 1);
  const after = await visIds(), saved = await p.evaluate(() => F._rawConfig.tab_order || null);
  const a0 = before.indexOf(ids0[0]), a1 = before.indexOf(ids0[1]);
  ok(`${name}: hold 400 ms løfter fanen (scale 1.06, touch-action none)`, /scale\(1\.06\)/.test(lift.tf) && lift.ta === 'none', lift);
  ok(`${name}: hold + dra bytter rekkefølge og lagrer tab_order`, !!saved && after.indexOf(ids0[0]) > after.indexOf(ids0[1]) && a0 < a1, { før: before, etter: after });
  await p.evaluate(() => setStyle({ tab_order: undefined }));
};
const tapCheck = async (name, sel) => {
  const ids = await p.evaluate((sel) => [...R().querySelectorAll(sel)].map((b) => b.dataset.v), sel);
  const c0 = await cur();
  const i = ids.findIndex((x) => x !== c0 && x !== '__etg');
  await p.evaluate(() => { window.HAP = []; });
  await click(sel, i);
  const c1 = await cur(), hap = await p.evaluate(() => window.HAP.slice());
  ok(`${name}: trykk bytter fane (${c0} → ${ids[i]}) + haptic selection`, c1 === ids[i] && hap.includes('selection'), { c1, hap });
  return ids[i];
};
const shot = async (n) => { if (SHOTS) await p.locator('msh-hjem-faner-card').screenshot({ path: `${SHOTS}/hjem31-${n}.png` }); };

/* ---------------- Pille (standard, uendret) */
let x = await p.evaluate(() => ({ st: F.config.tab_style || null, tg: !!R().querySelector('.tabs .tg.msh-tr'), n: R().querySelectorAll('.tg .tab').length, ta: cs(R().querySelector('.tg'), 'touchAction') }));
ok('Pille er standard (ingen tab_style) og uendret (.tabs > .tg.msh-tr)', x.st === null && x.tg && x.n >= 5 && x.ta === 'pan-y', x);
await shot('pille');

/* ---------------- Glidende · ikon (1a) */
await p.evaluate(() => setStyle({ tab_style: 'glide' }));
x = await p.evaluate(() => {
  const g = R().querySelector('.hts-glide'), th = g.querySelector('.hts-thumb'), bs = [...g.querySelectorAll('.hts-gt')];
  const on = g.querySelector('.hts-gt.on'), ic = (b) => (b.querySelector('ha-icon') || {}).icon || (b.querySelector('ha-icon') || { getAttribute: () => '' }).getAttribute('icon');
  const bat = bs.find((b) => b.dataset.v === 'batterier');
  return {
    bg: cs(g, 'backgroundColor'), r: cs(g, 'borderRadius'), pad: cs(g, 'paddingLeft'), ta: cs(g, 'touchAction'), disp: cs(g, 'display'),
    h: bs.map((b) => Math.round(rect(b).h)), w: bs.map((b) => Math.round(rect(b).w)),
    lbl: cs(bs[0].querySelector('.hts-gl'), 'fontSize'), icS: Math.round(rect(bs[0].querySelector('ha-icon') || bs[0].querySelector('.hts-ic')).w),
    thR: cs(th, 'borderRadius'), thBg: cs(th, 'backgroundImage'), thTr: cs(th, 'transition'), thL: Math.round(rect(th).x), thW: Math.round(rect(th).w), onL: Math.round(rect(on).x), onW: Math.round(rect(on).w),
    icons: bs.map((b) => [b.dataset.v, ic(b)]), batIc: bat ? cs(bat.querySelector('.hts-ic'), 'color') : null, onC: cs(on, 'color'),
  };
});
ok('Glidende: én flate #2f2f2f r26 pad 4, grid', x.bg === 'rgb(47, 47, 47)' && x.r === '26px' && x.pad === '4px' && x.disp === 'grid', x);
ok('Glidende: like brede faner, 56 px høye, etikett 11 px', x.h.every((h) => h === 56) && Math.max(...x.w) - Math.min(...x.w) <= 1 && x.lbl === '11px', { h: x.h, w: x.w, lbl: x.lbl });
ok('Glidende: rosa tommel r22 på valgt fane, left 280 ms cubic-bezier(.2,.8,.2,1)', x.thR === '22px' && /gradient/.test(x.thBg) && /left 0\.28s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/.test(x.thTr) && Math.abs(x.thL - x.onL) <= 1 && Math.abs(x.thW - x.onW) <= 1, x);
const IC = Object.fromEntries(x.icons);
ok('Glidende: ikoner (Hjem home, etasjer tall, Ute yard, Aktuelt bolt, Batterier battery_alert)', IC.hjem === 'mdi:home' && /numeric-1/.test(IC.forste || '') && /numeric-2/.test(IC.andre || '') && /flower|yard/.test(IC.ute || '') && IC.aktuelt === 'mdi:lightning-bolt' && IC.batterier === 'mdi:battery-alert', IC);
ok('Glidende: Batterier-ikonet rødt når noe er lavt', x.batIc === 'rgb(242, 128, 115)', x.batIc);
ok('Glidende: touch-action pan-y', x.ta === 'pan-y', x.ta);
const gt = await tapCheck('Glidende', '.hts-gt');
await wait(400);
x = await p.evaluate(() => { const th = R().querySelector('.hts-thumb'), on = R().querySelector('.hts-gt.on'); return { thL: Math.round(rect(th).x), onL: Math.round(rect(on).x), same: !!th }; });
ok('Glidende: tommelen glir til valgt fane (samme element, ny left)', Math.abs(x.thL - x.onL) <= 1, { ...x, gt });
await reorderCheck('Glidende', '.hts-gt');
await shot('glide');

/* ---------------- Chips med status (1c) */
await p.evaluate(() => setStyle({ tab_style: 'chips' }));
x = await p.evaluate(() => {
  const row = R().querySelector('.hts-chips'), cs0 = [...row.querySelectorAll('.hts-ch')];
  const meta = Object.fromEntries(cs0.map((c) => [c.dataset.v, c.querySelector('.hts-cm').textContent]));
  // ekte data: rom per fane fra kortets egen romliste, lave batterier fra device_class battery
  const T = F._TV, want = {};
  T.forEach((t) => { if (t.id === 'batterier') { const n = F._batteries().list.filter((b) => b.low).length; want[t.id] = n ? `${n} lave` : 'Alle ok'; } else if (t.id === 'aktuelt') want[t.id] = 'Nå'; else { const r = F._rooms(t), lit = r.reduce((n, x) => n + (x.lightsOn || 0), 0); want[t.id] = t.kind === 'hjem' ? `${r.length} favoritter` : r.length ? `${r.length} rom${lit ? ' · ' + lit + ' lys' : ''}` : '–'; } });
  const bat = cs0.find((c) => c.dataset.v === 'batterier');
  return { meta, want, h: cs0.map((c) => Math.round(rect(c).h)), r: cs(cs0[0], 'borderRadius'), ovf: cs(row, 'overflowX'), ta: cs(row, 'touchAction'), gap: cs(row, 'columnGap'), batM: bat && cs(bat.querySelector('.hts-cm'), 'color'), batI: bat && cs(bat.querySelector('.hts-ic'), 'color'), lab: cs(cs0[0].querySelector('.hts-cl'), 'fontSize'), mfs: cs(cs0[0].querySelector('.hts-cm'), 'fontSize'), sw: row.scrollWidth, cw: row.clientWidth };
});
ok('Chips: 56 px, r28, gap 8, raden scroller sidelengs (touch-action pan-y)', x.h.every((h) => h === 56) && x.r === '28px' && x.gap === '8px' && x.ovf === 'auto' && x.ta === 'pan-y' && x.sw > x.cw, x);
ok('Chips: navn 14 px, status 11 px', x.lab === '14px' && x.mfs === '11px', [x.lab, x.mfs]);
ok('Chips: status fra ekte data («N favoritter», «N rom», «Nå», «N lave»)', JSON.stringify(x.meta) === JSON.stringify(x.want) && /favoritter$/.test(x.meta.hjem) && x.meta.aktuelt === 'Nå' && /^\d+ lave$/.test(x.meta.batterier) && /rom/.test(x.meta.forste || ''), x.meta);
ok('Chips: Batterier rød tekst og rødt ikon når noe er lavt', x.batM === 'rgb(242, 128, 115)' && x.batI === 'rgb(242, 128, 115)', [x.batM, x.batI]);
// live: alle batterier ok (fanen vises fordi battery.always) → «Alle ok», ikke rød
x = await p.evaluate(async () => {
  await F._saveCfg({ battery: { always: true } }); await new Promise((q) => setTimeout(q, 1300));
  const S = { ...H.states };
  Object.keys(S).forEach((id) => { const s = S[id]; if (s.attributes.device_class === 'battery') S[id] = { ...s, state: id.startsWith('binary_sensor.') ? 'off' : '90' }; });
  F.hass = { ...H, states: S };
  await new Promise((q) => setTimeout(q, 400));
  const bat = [...R().querySelectorAll('.hts-ch')].find((c) => c.dataset.v === 'batterier');
  const out = { t: bat && bat.querySelector('.hts-cm').textContent, c: bat && cs(bat.querySelector('.hts-cm'), 'color') };
  F.hass = H; await F._saveCfg({ battery: undefined }); await new Promise((q) => setTimeout(q, 1300));
  await new Promise((q) => setTimeout(q, 400));
  return out;
});
ok('Chips: «Alle ok» (grå) når ingen batterier er lave – oppdateres live', x.t === 'Alle ok' && x.c === 'rgb(151, 151, 151)', x);
await tapCheck('Chips', '.hts-ch');
await reorderCheck('Chips', '.hts-ch');
await shot('chips');

/* ---------------- To nivåer (1d) */
await p.evaluate(() => setStyle({ tab_style: 'to' }));
await p.evaluate(() => { const i = F._TV.findIndex((t) => t.id === 'hjem'); F._pickTab(i); });
await wait(400);
x = await p.evaluate(() => {
  const top = R().querySelector('.hts-top'), tt = [...top.querySelectorAll('.hts-tt')], bat = R().querySelector('.hts-bat');
  return { labels: tt.map((b) => b.textContent.trim()), ids: tt.map((b) => b.dataset.v), sub: !!R().querySelector('.hts-sub'), bg: cs(top, 'backgroundColor'), r: cs(top, 'borderRadius'), h: tt.map((b) => Math.round(rect(b).h)),
    bat: bat ? { w: Math.round(rect(bat).w), h: Math.round(rect(bat).h), r: cs(bat, 'borderRadius'), n: (bat.querySelector('.hts-bn') || {}).textContent, nBg: bat.querySelector('.hts-bn') && cs(bat.querySelector('.hts-bn'), 'backgroundColor') } : null,
    low: F._batteries().list.filter((b) => b.low).length, ta: cs(top, 'touchAction') };
});
ok('To nivåer: hovedrad Hjem · Etasjer · Aktuelt (#2f2f2f r26, knapper 48 px)', x.labels[0] === 'Hjem' && x.labels.includes('Etasjer') && x.labels.includes('Aktuelt') && x.bg === 'rgb(47, 47, 47)' && x.r === '26px' && x.h.every((h) => h === 48) && x.ta === 'pan-y', x);
ok('To nivåer: ingen underrad når Hjem er valgt', !x.sub);
ok('To nivåer: Batterier = rund knapp 56 px med rødt tall (antall lave)', x.bat && x.bat.w === 56 && x.bat.h === 56 && x.bat.r === '28px' && x.bat.n === String(x.low) && x.bat.nBg === 'rgb(242, 128, 115)', x.bat);
await click('.hts-tt', x.ids.indexOf('__etg'));
x = await p.evaluate(() => { const sub = R().querySelector('.hts-sub'); const st = sub ? [...sub.querySelectorAll('.hts-st')] : []; const fl = F._TV.filter((t) => t.view === 'liste' && t.kind !== 'hjem' && t.id !== 'aktuelt').map((t) => t.id); return { cur: F._cur.id, sub: st.map((b) => b.dataset.v), fl, on: st.filter((b) => b.classList.contains('on')).map((b) => b.dataset.v), h: st.map((b) => Math.round(rect(b).h)), etgOn: R().querySelector('.hts-tt[data-v="__etg"]').classList.contains('on'), sh: st[0] && cs(st.find((b) => b.classList.contains('on')), 'boxShadow') }; });
ok('To nivåer: Etasjer → underrad med alle Kortliste-faner (36 px), første etasje valgt', x.etgOn && JSON.stringify(x.sub) === JSON.stringify(x.fl) && x.cur === x.fl[0] && x.on[0] === x.fl[0] && x.h.every((h) => h === 36) && /242, 133, 201/.test(x.sh || ''), x);
await p.evaluate(() => { window.HAP = []; });
await click('.hts-st', 1);
x = await p.evaluate(() => ({ cur: F._cur.id, hap: window.HAP.slice(), sub: [...R().querySelectorAll('.hts-st')].map((b) => b.dataset.v) }));
ok('To nivåer: trykk i underraden bytter etasje + haptic selection', x.cur === x.sub[1] && x.hap.includes('selection'), x);
await p.evaluate(() => { window.HAP = []; });
await p.mouse.click(...(await p.evaluate(() => { const r = rect(R().querySelector('.hts-bat')); return [r.cx, r.cy]; }))); await wait(350);
x = await p.evaluate(() => ({ cur: F._cur.id, on: R().querySelector('.hts-bat').classList.contains('on'), bg: cs(R().querySelector('.hts-bat'), 'backgroundColor') }));
ok('To nivåer: Batterier-knappen velger Batterier (rød flate)', x.cur === 'batterier' && x.on && x.bg === 'rgb(242, 128, 115)', x);
// underraden vises bare når en etasje er valgt – velg etasje først
await p.evaluate(() => { const i = F._TV.findIndex((t) => t.id === 'forste'); F._pickTab(i); });
await wait(400);
await reorderCheck('To nivåer · underrad (etasjer)', '.hts-st');
await p.evaluate(() => { const i = F._TV.findIndex((t) => t.id === 'hjem'); F._pickTab(i); });
await wait(400);
{
  const before = await visIds();
  const ids0 = await p.evaluate(() => [...R().querySelectorAll('.hts-tt')].map((b) => b.dataset.v));
  await holdDrag('.hts-tt', 0, 1);
  const after = await visIds();
  ok('To nivåer · hovedrad: Hjem flyttes forbi «Etasjer» (hele etasjeblokken)', after.indexOf('hjem') > after.indexOf('forste') && after.indexOf('hjem') > after.indexOf('andre') && before.indexOf('hjem') === 0, { ids0, før: before, etter: after });
  await p.evaluate(() => setStyle({ tab_order: undefined }));
}
await shot('to');

/* ---------------- Som popups */
await p.evaluate(() => setStyle({ tab_style: 'popup' }));
const popM = () => p.evaluate(() => {
  const bar = R().querySelector('.mtb.mtb-pop'), row = bar.querySelector('.mtb-tabs'), bs = [...row.querySelectorAll('.mtb-t')], on = row.querySelector('.mtb-t.on');
  return { bg: cs(row, 'backgroundColor'), r: cs(row, 'borderRadius'), pad: cs(row, 'paddingTop'), gap: cs(row, 'columnGap'), h: bs.map((b) => Math.round(rect(b).h)), w: bs.map((b) => Math.round(rect(b).w)), onR: cs(on, 'borderRadius'), onBg: cs(on, 'backgroundImage'), onC: cs(on, 'color'), ic: bs.filter((b) => b.querySelector('ha-icon')).length, lb: bs.filter((b) => b.querySelector('.mtb-l')).length, fs: bs[0].querySelector('.mtb-l') ? cs(bs[0].querySelector('.mtb-l'), 'fontSize') : null, n: bs.length, gear: !!bar.querySelector('.mtb-g'), ta: cs(row, 'touchAction'), sh: cs(row, 'boxShadow') };
});
x = await popM();
ok('Som popups: flate #3a3a3a r26 pad 4 gap 2, innerkant', x.bg === 'rgb(58, 58, 58)' && x.r === '26px' && x.pad === '4px' && x.gap === '2px' && /0\.05/.test(x.sh) && x.ta === 'pan-y', x);
ok('Som popups (begge): like brede faner 56 px, ikon over tekst 12 px, aktiv rosa pille r22', x.h.every((h) => h === 56) && Math.max(...x.w) - Math.min(...x.w) <= 1 && x.ic === x.n && x.lb === x.n && x.fs === '12px' && x.onR === '22px' && /gradient/.test(x.onBg) && x.onC === 'rgb(47, 47, 47)' && !x.gear, x);
await p.evaluate(() => setStyle({ tab_mode: 'ikon' }));
x = await popM();
ok('Som popups · Fanene viser ikon: 44 px, bare ikon', x.h.every((h) => h === 44) && x.ic === x.n && x.lb === 0, x);
await p.evaluate(() => setStyle({ tab_mode: 'tekst' }));
x = await popM();
ok('Som popups · Fanene viser tekst: 44 px, bare tekst 14 px', x.h.every((h) => h === 44) && x.ic === 0 && x.lb === x.n && x.fs === '14px', x);
await p.evaluate(() => setStyle({ tab_mode: undefined }));
await tapCheck('Som popups', '.mtb-t');
await reorderCheck('Som popups', '.mtb-t');
await shot('popup');

/* ---------------- Tekst + tannhjul */
await p.evaluate(() => setStyle({ tab_style: 'gear' }));
x = await p.evaluate(() => {
  const bar = R().querySelector('.mtb.mtb-gear'), row = bar.querySelector('.mtb-tabs'), bs = [...row.querySelectorAll('.mtb-t')], g = bar.querySelector('.mtb-g');
  return { r: cs(row, 'borderRadius'), bg: cs(row, 'backgroundColor'), pad: cs(row, 'paddingTop'), gap: cs(row, 'columnGap'), h: bs.map((b) => Math.round(rect(b).h)), br: cs(bs[0], 'borderRadius'), fs: cs(bs[0], 'fontSize'), fw: cs(bs[0], 'fontWeight'), c: cs(bs.find((b) => !b.classList.contains('on')), 'color'), g: { w: Math.round(rect(g).w), h: Math.round(rect(g).h), bg: cs(g, 'backgroundColor'), ic: (g.querySelector('ha-icon') && g.querySelector('ha-icon').getAttribute('icon')) || '' }, cut: bs.filter((b) => { const l = b.querySelector('.mtb-l'); return l && l.scrollWidth > l.clientWidth + 0.5; }).map((b) => b.dataset.v) };
});
ok('Tekst + tannhjul: flate #3a3a3a r28 pad 4 gap 2, faner 48 px r24 14/500 #c7c7c7', x.r === '28px' && x.bg === 'rgb(58, 58, 58)' && x.pad === '4px' && x.gap === '2px' && x.h.every((h) => h === 48) && x.br === '24px' && x.fs === '14px' && x.fw === '500' && x.c === 'rgb(199, 199, 199)', x);
ok('Tekst + tannhjul: rund knapp 56 × 56 #3a3a3a med settings', x.g.w === 56 && x.g.h === 56 && x.g.bg === 'rgb(58, 58, 58)' && /cog|settings/.test(x.g.ic), x.g);
ok('Tekst + tannhjul: ingen etikett kuttet', x.cut.length === 0, x.cut);
x = await p.evaluate(async () => { const seen = []; const o = MSH.openDashEditor; MSH.openDashEditor = (a) => { seen.push(a); }; R().querySelector('.mtb-g').click(); await new Promise((q) => setTimeout(q, 100)); MSH.openDashEditor = o; return seen; });
ok('Tekst + tannhjul: tannhjulet åpner Tilpass Hjem', x.length === 1 && x[0].editor === 'home', x);
x = await p.evaluate(() => ({ items: R().querySelector('.mtb-tabs').__tabReorder.items().length, n: R().querySelectorAll('.mtb-tabs .mtb-t').length }));
ok('Tekst + tannhjul: tannhjulet er ikke med i omorganiseringen', x.items === x.n, x);
await tapCheck('Tekst + tannhjul', '.mtb-t');
await reorderCheck('Tekst + tannhjul', '.mtb-t');
await shot('gear');

/* ---------------- samme komponent som Lys-popupen (MSH.tabBar, variant gear) */
x = await p.evaluate(async () => {
  const L = document.createElement('msh-lys-card');
  L.setConfig({ type: 'custom:msh-lys-card', card_id: 'h31lys' }); L.hass = H;
  const box = document.createElement('div'); box.style.cssText = 'width:358px;padding:0 16px'; box.appendChild(L); document.getElementById('dash').appendChild(box);
  await new Promise((q) => setTimeout(q, 600));
  const pick = (root) => { const row = root.querySelector('.mtb.mtb-gear .mtb-tabs'), t = row.querySelector('.mtb-t:not(.on)'), g = root.querySelector('.mtb.mtb-gear .mtb-g'); const K = ['backgroundColor', 'borderRadius', 'paddingTop', 'columnGap', 'boxShadow', 'touchAction']; const T = ['height', 'borderRadius', 'fontSize', 'fontWeight', 'color', 'paddingLeft', 'flexGrow', 'flexShrink', 'flexBasis']; return { row: K.map((k) => getComputedStyle(row)[k]), tab: T.map((k) => getComputedStyle(t)[k]), gear: ['width', 'height', 'backgroundColor', 'boxShadow', 'borderRadius'].map((k) => getComputedStyle(g)[k]) }; };
  const a = pick(R()), b = pick(L.shadowRoot);
  box.remove();
  return { a, b, same: JSON.stringify(a) === JSON.stringify(b), api: !!MSH.tabBar && typeof MSH.tabBar.html === 'function' };
});
ok('Tekst + tannhjul på Hjem = samme komponent og mål som Lys-popupens fanelinje (MSH.tabBar)', x.same && x.api, x.same ? null : x);

/* ---------------- getConfigElement(): tab_style / tab_mode i skjemaet */
x = await p.evaluate(() => {
  const S = customElements.get('msh-hjem-faner-card').schema, flat = (L) => L.flatMap((f) => (f.fields ? flat(f.fields) : [f]));
  const a = flat(S(H, { tab_style: 'popup' })), b = flat(S(H, {}));
  const st = a.find((f) => f.name === 'tab_style');
  return { st: st && st.options.map((o) => o[0]), def: st && st.default, mode: !!a.find((f) => f.name === 'tab_mode'), modeOff: !b.find((f) => f.name === 'tab_mode'), el: typeof customElements.get('msh-hjem-faner-card').getConfigElement };
});
ok('getConfigElement-skjema: tab_style (6 stiler, standard pille) + tab_mode for «Som popups»', JSON.stringify(x.st) === JSON.stringify(['pille', 'glide', 'chips', 'to', 'popup', 'gear']) && x.def === 'pille' && x.mode && x.modeOff && x.el === 'function', x);

/* ---------------- Tilpass Hjem → Faner → Fanestil: Stil + forhåndsvisning */
await p.evaluate(() => setStyle({ tab_style: undefined }));
await p.evaluate(async () => { MSH.openHomeEditor({ focus: 'faner' }); await new Promise((q) => setTimeout(q, 800)); });
const ER = () => p.evaluate(() => { const all = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); window.EDR = all.find((e) => e.classList && e.classList.contains('fsp')); return !!window.EDR; });
ok('Tilpass Hjem → Faner: forhåndsvisning finnes', await ER());
x = await p.evaluate(() => { const f = EDR, lab = f.querySelector('.fspl'); const tset = f.closest('.tset'); const flds = [...tset.querySelectorAll('.fld .fl')].map((s) => s.textContent); return { lab: lab.textContent, bg: getComputedStyle(f).backgroundColor, r: getComputedStyle(f).borderRadius, first: tset.children[1] === f, flds, pille: !!f.querySelector('.hts-pp'), stil: [...tset.querySelectorAll('[data-k="tab_style"]')].map((b) => b.textContent) }; });
ok('Fanestil: FORHÅNDSVISNING øverst (boks #232323 r18), Stil med seks valg, Pille valgt', x.lab === 'FORHÅNDSVISNING' && x.bg === 'rgb(35, 35, 35)' && x.r === '18px' && x.first && x.flds[0] === 'Stil' && x.stil.length === 6 && x.pille, x);
const edClick = async (sel) => { const r = await p.evaluate((sel) => { const el = EDR.closest('.tset').querySelector(sel) || EDR.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: 'center' }); return rect(el); }, sel); if (r) { const r2 = await p.evaluate((sel) => rect(EDR.closest('.tset').querySelector(sel) || EDR.querySelector(sel)), sel); await p.mouse.click(r2.cx, r2.cy); } await wait(700); await ER(); return r; };
await edClick('[data-k="tab_style"][data-v="chips"]');
x = await p.evaluate(() => ({ live: F.config.tab_style, pv: !!EDR.querySelector('.hts-chips'), card: !!R().querySelector('.hts-chips'), vis: !!EDR.closest('.tset').querySelector('[data-k="tab_mode"]') }));
ok('Fanestil: Stil = Chips → Hjem og forhåndsvisningen oppdateres straks', x.live === 'chips' && x.pv && x.card && !x.vis, x);
await edClick('[data-k="tab_style"][data-v="popup"]');
x = await p.evaluate(() => ({ live: F.config.tab_style, pv: !!EDR.querySelector('.mtb.mtb-pop .m-b'), vis: [...EDR.closest('.tset').querySelectorAll('[data-k="tab_mode"]')].map((b) => b.textContent) }));
ok('Fanestil: Som popups → «Fanene viser» (Ikon · Tekst · Begge)', x.live === 'popup' && x.pv && JSON.stringify(x.vis) === '["Ikon","Tekst","Begge"]', x);
await edClick('[data-k="tab_mode"][data-v="ikon"]');
x = await p.evaluate(() => ({ live: F.config.tab_mode, pv: !!EDR.querySelector('.mtb.mtb-pop .m-i'), card: !!R().querySelector('.mtb.mtb-pop .m-i') }));
ok('Fanestil: Fanene viser = Ikon → forhåndsvisning og Hjem straks', x.live === 'ikon' && x.pv && x.card, x);
await edClick('[data-k="tab_style"][data-v="pille"]');
await edClick('[data-k="tab_height"][data-v="ekstra"]');
x = await p.evaluate(() => ({ h: Math.round(rect(EDR.querySelector('.hts-pt')).h), card: Math.round(rect(R().querySelector('.tg .tab')).h), st: F.config.tab_style || null }));
ok('Fanestil: Høyde (Pille) oppdaterer forhåndsvisningen straks', x.h === 56 && x.card === 56 && x.st === null, x);
await edClick('[data-k="tab_style"][data-v="glide"]');
await p.evaluate(() => { window.HAP = []; });
const target = await p.evaluate(() => { const t = [...EDR.querySelectorAll('[data-a="fsprev"]')].find((x) => !x.classList.contains('on')); return t.dataset.t; });
await edClick(`[data-a="fsprev"][data-t="${target}"]`);
x = await p.evaluate(() => ({ cur: F._cur.id, pvOn: (EDR.querySelector('.hts-gt.on') || {}).dataset?.t, hap: window.HAP.slice() }));
ok('Forhåndsvisning: trykk bytter fane på Hjem (+ haptic selection)', x.cur === target && x.pvOn === target && x.hap.includes('selection'), { target, ...x });
if (SHOTS) await p.screenshot({ path: `${SHOTS}/hjem31-tilpass.png` });

ok('ingen sidefeil', errs.length === 0, errs);
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
await b.close();
process.exit(fails ? 1 : 0);
