// Fiks 17.21–17.25 · Media-popupen (#media): volum-raden (Pille/Trinn/Knapper + bryter), musikk- og TV-kortet
// (fast høyde 248, tittel ≤ 2 linjer, chips, fremdrift/DIREKTE) og editoren (TV | Musikk + rekkefølge/vis-skjul).
// Kjøres mot test/harness.html med mock-hass. Skjermbilder: MEDIA_SHOTS=<mappe> (valgfritt).
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/media-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.MEDIA_SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, msg) => { if (!c) fails.push(msg); };

const page = async (mainCfg, heroCfg) => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: false });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ mainCfg, heroCfg }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const h = window.mockHass(); window.__h = h;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Media</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#media';
    const host = bc.querySelector('.inner');
    const mk = (tag, cfg) => { const el = document.createElement(tag); el.setConfig({ type: 'custom:' + tag, ...cfg }); el.hass = h; host.appendChild(el); return el; };
    window.__hero = mk('msh-media-hero-card', heroCfg || {});
    window.__main = mk('msh-media-card', mainCfg || {});
    window.__deep = (sel) => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    await new Promise((q) => setTimeout(q, 700));
  }, { mainCfg, heroCfg });
  return { p, errs };
};
const calls = (p) => p.evaluate(() => window.__calls.map((c) => [c[0], c[1], JSON.stringify(c[2])]));
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; });
const tab = (p, t) => p.evaluate((t) => { window.__main.shadowRoot.querySelector(`.tab[data-t="${t}"]`).click(); return new Promise((q) => setTimeout(q, 400)); }, t);
const cards = (p) => p.evaluate(() => [...window.__hero.shadowRoot.querySelectorAll('.pc')].map((c) => ({
  id: c.dataset.key, h: Math.round(c.getBoundingClientRect().height), txt: c.textContent.replace(/\s+/g, ' ').trim(),
  clamp: getComputedStyle(c.querySelector('.ti')).webkitLineClamp, tiH: Math.round(c.querySelector('.ti').getBoundingClientRect().height),
  chips: [...c.querySelectorAll('.ch')].map((x) => x.textContent.trim()), live: !!c.querySelector('.live'), pg: !!c.querySelector('.pg'),
  overflow: c.scrollHeight - c.clientHeight, mq: !!c.querySelector('.mq,.lv'),
})));
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };

/* 1 · Musikk: kort + volum (Pille ↔ Trinn) */
{
  const { p, errs } = await page({ default_tab: 'musikk' });
  await p.evaluate(() => window.__main.onOpen && window.__main.onOpen());
  await p.waitForTimeout(400);
  const C = await cards(p);
  const jem = C.find((c) => c.id === 'media_player.spotify_jem'), radio = C.find((c) => c.id === 'media_player.kjokken_radio');
  ok(C.length >= 2, 'musikk: for få kort ' + C.length);
  ok(C.every((c) => c.h === 248), 'musikk: høyde ≠ 248: ' + C.map((c) => c.h));
  ok(C.every((c) => !c.mq), 'musikk: gamle nivå-streker/marquee finnes');
  ok(jem && jem.clamp === '2' && jem.tiH <= 50, 'musikk: tittel ikke klemt til 2 linjer ' + (jem && jem.tiH));
  ok(jem && jem.chips.includes('40 %') && jem.chips.some((x) => /^\+ Kjøkken radio/.test(x)) && jem.chips.includes('Spotify · 320 kbps'), 'musikk: chips ' + (jem && jem.chips));
  ok(jem && jem.pg && /1:2\d/.test(jem.txt) && /3:52/.test(jem.txt), 'musikk: fremdrift/tider ' + (jem && jem.txt));
  ok(radio && radio.live && /Neste: NRK P3/.test(radio.txt) && !radio.pg, 'radio: DIREKTE + neste snarvei ' + (radio && radio.txt));
  ok(C.every((c) => c.overflow <= 1), 'musikk: innhold flyter over kortet');
  await shot(p, 'musikk');
  // volum: første spiller i musikk-fanen (valgt) – pille som standard + bryter
  const v0 = await p.evaluate(() => { const r = window.__main.shadowRoot.querySelector('.mvr'); return r && { key: r.dataset.vkey, pill: !!r.querySelector('.mvl'), tog: !!r.querySelector('.mvt'), txt: r.textContent.replace(/\s+/g, ' ').trim() }; });
  ok(v0 && v0.pill && v0.tog, 'volum: pille + bryter mangler ' + JSON.stringify(v0));
  // 18.9: sporet har kortfargen (#3a3a3a + 5 % kant), som kilde-flisene
  const bg0 = await p.evaluate(() => { const c = getComputedStyle(window.__main.shadowRoot.querySelector('.mvl')); return c.backgroundColor + ' ' + c.boxShadow; });
  ok(/^rgb\(58, 58, 58\) rgba\(255, 255, 255, 0\.05\) 0px 0px 0px 1px inset$/.test(bg0), 'volum 18.9: pille-spor ' + bg0);
  // drag på pillen → volume_set (throttlet) + endelig verdi
  await clearCalls(p);
  const bx = await p.evaluate(() => { const e = window.__main.shadowRoot.querySelector('.mvl'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  await p.mouse.move(bx.x + bx.w * 0.2, bx.y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(bx.x + bx.w * (0.2 + i * 0.05), bx.y); await p.waitForTimeout(40); }
  await p.mouse.up(); await p.waitForTimeout(100);
  const vc = (await calls(p)).filter((c) => c[1] === 'volume_set');
  ok(vc.length >= 2 && vc.length <= 6 && /"volume_level":0\.7/.test(vc[vc.length - 1][2]), 'volum: drag-kall ' + JSON.stringify(vc));
  const fillTxt = await p.evaluate(() => window.__main.shadowRoot.querySelector('.mvl .mvn').textContent);
  ok(/70%/.test(fillTxt), 'volum: live verdi under/etter drag ' + fillTxt);
  // bryteren → Trinn, lagret i ki-store media.vol_style
  await p.evaluate(() => window.__main.shadowRoot.querySelector('.mvt').click()); await p.waitForTimeout(300);
  const v1 = await p.evaluate(() => ({ st: window.MSH.store.get('media.vol_style'), trinn: !!window.__main.shadowRoot.querySelector('.mvs'), bars: window.__main.shadowRoot.querySelectorAll('.mvbars span').length }));
  ok(v1.st === 'trinn' && v1.trinn && v1.bars === 16, 'volum: bytte til trinn ' + JSON.stringify(v1));
  const bg1 = await p.evaluate(() => { const R = window.__main.shadowRoot, g = (q) => getComputedStyle(R.querySelector(q)).backgroundColor; return [g('.mvs'), g('.mvs .mvb'), g('.mvbars span:not(.on)')].join(' | '); });
  ok(bg1 === 'rgb(58, 58, 58) | rgb(47, 47, 47) | rgb(47, 47, 47)', 'volum 18.9: trinn-spor/knapper/trinn ' + bg1);
  await clearCalls(p);
  await p.evaluate(() => { const b = window.__main.shadowRoot.querySelector('.mvs [data-vact="up"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); window.__upPt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const up = await p.evaluate(() => window.__upPt);
  await p.mouse.move(up.x, up.y); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(100);
  const pc = (await calls(p)).filter((c) => c[1] === 'volume_set');
  ok(pc.length === 1, 'volum: + gir ett steg ' + JSON.stringify(pc));
  await shot(p, 'musikk-trinn');
  ok(!errs.length, 'musikk: feil ' + errs.join(' | '));
  await p.close();
}

/* 2 · TV: kort + volum (Trinn ↔ Knapper), knapp-volum */
{
  const { p, errs } = await page({ default_tab: 'tv', players: { stue_tv: { volume: 'buttons', volume_up: 'button.tv_opp', volume_down: 'button.tv_ned', watch: ['sensor.stue_tv_skjermtid'] } } });
  await p.evaluate(() => {
    const h = window.__h;
    h.states['button.tv_opp'] = { entity_id: 'button.tv_opp', state: 'unknown', attributes: { friendly_name: 'TV opp' } };
    h.states['button.tv_ned'] = { entity_id: 'button.tv_ned', state: 'unknown', attributes: { friendly_name: 'TV ned' } };
    h.states['sensor.stue_tv_skjermtid'] = { entity_id: 'sensor.stue_tv_skjermtid', state: '2.24', attributes: { unit_of_measurement: 'h' } };
    const s = h.states['media_player.stue_tv'];
    h.states['media_player.stue_tv'] = { ...s, attributes: { ...s.attributes, volume_level: undefined, media_duration: 2640, media_position: 1510, media_position_updated_at: new Date().toISOString(), supported_features: 152461 + 2 } };
    const nh = { ...h, states: { ...h.states } }; window.__h = nh;
    window.__main.hass = nh; window.__hero.hass = nh;
    window.__main.onOpen && window.__main.onOpen();
  });
  await p.waitForTimeout(500);
  const C = await cards(p);
  const st = C.find((c) => c.id === 'media_player.stue_tv'), pr = C.find((c) => c.id === 'media_player.prosjektor');
  ok(C.every((c) => c.h === 248), 'tv: høyde ≠ 248: ' + C.map((c) => c.h));
  ok(st && st.pg && /25:1\d/.test(st.txt) && /19 min igjen/.test(st.txt) && /44:00/.test(st.txt), 'tv: film-fremdrift ' + (st && st.txt));
  ok(st && st.chips.some((x) => /2 t 14 min i dag/.test(x)), 'tv: skjermtid ' + (st && st.chips));
  ok(pr && pr.live && /Neste: Sportsrevyen 19:45/.test(pr.txt) && /Slutter 19:45/.test(pr.txt) && pr.chips.includes('24 %') && pr.chips.includes('HDMI 1'), 'tv: direkte ' + (pr && pr.txt + ' ' + pr.chips));
  ok(C.every((c) => !c.mq && c.overflow <= 1), 'tv: nivå-streker/overflyt');
  await shot(p, 'tv');
  // Stue TV valgt? velg via bussen
  await p.evaluate(() => { window.__main.select('tv', 'media_player.stue_tv'); });
  await p.waitForTimeout(300);
  const v0 = await p.evaluate(() => { const r = window.__main.shadowRoot.querySelector('.mvr'); return r && { key: r.dataset.vkey, trinn: !!r.querySelector('.mvs'), tog: !!r.querySelector('.mvt'), txt: r.textContent.replace(/\s+/g, ' ').trim() }; });
  ok(v0 && v0.key === 'media_player.stue_tv' && v0.trinn && v0.tog, 'tv-volum: trinn som standard ' + JSON.stringify(v0));
  ok(!(await p.evaluate(() => !!window.__main.shadowRoot.querySelector('.vb'))), 'tv-volum: gammel −/Demp/+-stripe finnes');
  // + med knapp-volum → button.press på opp-entiteten; estimat lagres når det finnes et utgangspunkt
  await p.evaluate(() => localStorage.setItem('ki:media:vol_est', JSON.stringify({ 'media_player.stue_tv': 26 })));
  await p.evaluate(() => window.__main.update()); await p.waitForTimeout(200);
  await clearCalls(p);
  const up = await p.evaluate(() => { const e = window.__main.shadowRoot.querySelector('.mvs [data-vact="up"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(up.x, up.y); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(200);
  const bc = (await calls(p)).filter((c) => c[0] === 'button' && /tv_opp/.test(c[2]));
  ok(bc.length >= 2, 'tv-volum: hold + gjentar (≥2 kommandoer) ' + bc.length);
  const est = await p.evaluate(() => ({ n: window.__main.shadowRoot.querySelector('.mvnum').textContent.trim(), ls: JSON.parse(localStorage.getItem('ki:media:vol_est'))['media_player.stue_tv'] }));
  ok(est.ls === 26 + 2 * bc.length && est.n === '≈' + est.ls, 'tv-volum: estimat ' + JSON.stringify(est) + ' n=' + bc.length);
  // drag på strekene: én kommando per 4 %
  await clearCalls(p);
  const bars = await p.evaluate(() => { const e = window.__main.shadowRoot.querySelector('.mvbars'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  await p.mouse.move(bars.x + 5, bars.y); await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(bars.x + 5 + (bars.w * 0.2 * i) / 10, bars.y);
  await p.mouse.up(); await p.waitForTimeout(100);
  const dc = (await calls(p)).filter((c) => c[0] === 'button' && /tv_opp/.test(c[2]));
  ok(dc.length >= 4 && dc.length <= 6, 'tv-volum: drag 20 % ≈ 5 kommandoer ' + dc.length);
  // bryter → Knapper (ki-store media.vol_style_tv)
  await p.evaluate(() => window.__main.shadowRoot.querySelector('.mvt').click()); await p.waitForTimeout(300);
  const v2 = await p.evaluate(() => ({ st: window.MSH.store.get('media.vol_style_tv'), k: window.__main.shadowRoot.querySelectorAll('.mvk button').length }));
  ok(v2.st === 'knapper' && v2.k === 3, 'tv-volum: knapper ' + JSON.stringify(v2));
  await shot(p, 'tv-knapper');
  ok(!errs.length, 'tv: feil ' + errs.join(' | '));
  await p.close();
}

/* 3 · Låst stil i config (ingen bryter) + editor */
{
  const { p, errs } = await page({ default_tab: 'musikk', vol_style: 'trinn' });
  await p.evaluate(() => window.__main.onOpen && window.__main.onOpen()); await p.waitForTimeout(300);
  const v = await p.evaluate(() => ({ trinn: !!window.__main.shadowRoot.querySelector('.mvs'), tog: !!window.__main.shadowRoot.querySelector('.mvt') }));
  ok(v.trinn && !v.tog, 'låst stil: trinn uten bryter ' + JSON.stringify(v));
  // Editor (GUI): TV | Musikk-fane, rekkefølge-rader, ↓ lagrer order.tv, øye lagrer hidden
  const r = await p.evaluate(async () => {
    const ed = window.__main.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-media-card' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 100));
    const out = { changes: [] };
    ed.addEventListener('config-changed', (e) => out.changes.push(e.detail.config));
    const R = ed.shadowRoot;
    const seg = [...R.querySelectorAll('[data-a="fn"][data-t]')].map((b) => b.textContent.trim());
    out.seg = seg;
    const rows = () => [...R.querySelectorAll('[data-key^="mo-"]')].map((x) => x.dataset.key.slice(3));
    // sørg for TV-fanen
    const tvb = R.querySelector('[data-a="fn"][data-t="tv"]'); tvb.click(); await new Promise((q) => setTimeout(q, 50));
    out.tv = rows();
    R.querySelector('[data-key^="mo-"] [data-a="mv"][data-d="1"]').click(); await new Promise((q) => setTimeout(q, 50));
    out.tv2 = rows();
    R.querySelector('[data-key^="mo-"] [data-a="sel"][data-name="hidden"]').click(); await new Promise((q) => setTimeout(q, 50));
    out.secs = [...R.querySelectorAll('details.sec[data-focus^="p_"]')].map((d) => d.dataset.focus);
    R.querySelector('[data-a="fn"][data-t="musikk"]').click(); await new Promise((q) => setTimeout(q, 50));
    out.mus = rows();
    out.secsMus = [...R.querySelectorAll('details.sec[data-focus^="p_"]')].map((d) => d.dataset.focus);
    out.last = out.changes[out.changes.length - 1];
    return out;
  });
  ok(r.seg.join('|') === 'TV|Musikk', 'editor: fanesegment ' + r.seg);
  ok(r.tv.length >= 2 && r.tv2[0] === r.tv[1] && r.tv2[1] === r.tv[0], 'editor: ↓ bytter rekkefølge ' + JSON.stringify([r.tv, r.tv2]));
  ok(r.last && r.last.order && r.last.order.tv && r.last.order.tv[0] === r.tv[1] && r.last.hidden && r.last.hidden[r.tv[1]] === true, 'editor: config order/hidden ' + JSON.stringify(r.last && { order: r.last.order, hidden: r.last.hidden }));
  ok(r.mus.length >= 2 && !r.mus.some((x) => r.tv.includes(x)), 'editor: musikk-fanen viser bare musikk ' + r.mus);
  ok(r.secs.length && r.secsMus.length && !r.secs.some((x) => r.secsMus.includes(x)), 'editor: detaljkort per fane ' + JSON.stringify([r.secs, r.secsMus]));
  // Karusellen følger order/hidden
  await p.evaluate((cfg) => { window.__main.setConfig({ type: 'custom:msh-media-card', default_tab: 'tv', order: cfg.order, hidden: cfg.hidden }); window.__main.onOpen(); }, r.last);
  await p.waitForTimeout(500);
  const ids = await p.evaluate(() => [...window.__hero.shadowRoot.querySelectorAll('.pc')].map((c) => c.dataset.key));
  ok(ids[0] === r.last.order.tv[0] || !ids.includes(r.last.order.tv[0]), 'karusell: rekkefølge ' + ids);
  ok(!ids.includes(Object.keys(r.last.hidden)[0]), 'karusell: skjult spiller vises ' + ids);
  await shot(p, 'editor');
  ok(!errs.length, 'editor: feil ' + errs.join(' | '));
  await p.close();
}
await b.close();
console.log(fails.length ? 'FEIL:\n- ' + fails.join('\n- ') : 'OK – media 17.21–17.25');
process.exit(fails.length ? 1 : 0);
