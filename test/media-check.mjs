// Fiks 17.21–17.25 + 19.4/19.5 · Media-popupen (#media): volum-raden (Pille/Trinn/Knapper + bryter), musikk- og TV-kortet
// (fast høyde 256 (19.5), tittel ≤ 2 linjer, chips, fremdrift/DIREKTE) og editoren (TV | Musikk + rekkefølge/vis-skjul).
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

// Fiks 20.21: standard er Album-kortet – de gamle testene (19.5) kjører mot «Detaljert» (now_playing.style: detailed)
const page = async (mainCfg0, heroCfg, vw, extra) => {
  const mainCfg = { now_playing: { style: 'detailed' }, ...(mainCfg0 || {}) };
  const p = await b.newPage({ viewport: { width: vw || 390, height: 844 }, hasTouch: false });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ mainCfg, heroCfg, extra }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const h = window.mockHass(); window.__h = h;
    Object.entries(extra || {}).forEach(([id, [st, attributes]]) => { h.states[id] = { entity_id: id, state: String(st), attributes: attributes || {}, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() }; });
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
  }, { mainCfg, heroCfg, extra });
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
  ok(C.every((c) => c.h === 256), 'musikk: høyde ≠ 256: ' + C.map((c) => c.h));
  ok(C.every((c) => !c.mq), 'musikk: gamle nivå-streker/marquee finnes');
  ok(jem && jem.clamp === '2' && jem.tiH <= 52, 'musikk: tittel ikke klemt til 2 linjer ' + (jem && jem.tiH));
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
  ok(C.every((c) => c.h === 256), 'tv: høyde ≠ 256: ' + C.map((c) => c.h));
  ok(st && st.pg && /25:1\d/.test(st.txt) && /19 min igjen/.test(st.txt) && /44:00/.test(st.txt), 'tv: film-fremdrift ' + (st && st.txt));
  ok(st && st.chips.some((x) => /2 t 14 min i dag/.test(x)), 'tv: skjermtid ' + (st && st.chips));
  ok(pr && pr.live && /Neste: Sportsrevyen 19:45/.test(pr.txt) && /Slutter 19:45/.test(pr.txt) && pr.chips.includes('24 %') && pr.chips.includes('HDMI 1'), 'tv: direkte ' + (pr && pr.txt + ' ' + pr.chips));
  ok(C.every((c) => !c.mq && c.overflow <= 1), 'tv: nivå-streker/overflyt ' + C.map((c) => c.id + ':' + c.overflow));
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
/* 4 · Fiks 19.5: TV-kortet «spilles nå» – plakat, kicker, tittel, serie, chips, kontrollrad; musikk-kortet samme høyde */
for (const vw of [390, 360]) {
  const { p, errs } = await page({ default_tab: 'tv' }, {}, vw);
  await p.evaluate(() => {
    const h = window.__h, s = h.states['media_player.stue_tv'];
    const cover = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 118"><rect width="84" height="118" fill="#8a3b2b"/></svg>');
    h.states['media_player.stue_tv'] = { ...s, attributes: { ...s.attributes, app_name: 'Plex', source: 'HDMI 2', media_title: 'Episode 7', media_series_title: 'The Bear', media_season: 2, media_episode: 7, media_content_type: 'tvshow', entity_picture: cover, media_duration: 1800, media_position: 420, media_position_updated_at: new Date().toISOString(), video_resolution: '2160p', supported_features: 1 + 2 + 32 + 16384 } };
    const nh = { ...h, states: { ...h.states } }; window.__h = nh; window.__main.hass = nh; window.__hero.hass = nh;
    window.__main.select('tv', 'media_player.stue_tv');
  });
  await p.waitForTimeout(500);
  const g = (id) => p.evaluate((id) => {
    const c = [...window.__hero.shadowRoot.querySelectorAll('.pc')].find((x) => x.dataset.key === id); if (!c) return null;
    const r = c.getBoundingClientRect(), R = (q) => { const e = c.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left - r.left, y: b.top - r.top, w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom - r.top), r: Math.round(r.right - b.right) }; };
    return { h: Math.round(r.height), art: R('.art'), img: !!c.querySelector('.art img'), bdg: (c.querySelector('.bdg') || {}).textContent || '', dl: c.querySelector('.dl') ? c.querySelector('.dl').innerText.replace(/\s+/g, ' ').trim() : '', dlFirst: c.querySelector('.tt') && c.querySelector('.tt').firstElementChild.classList.contains('dl'),
      ti: c.querySelector('.ti').textContent, tiFs: getComputedStyle(c.querySelector('.ti')).fontSize, ar: (c.querySelector('.ar') || {}).textContent || '', pr: getComputedStyle(c.querySelector('.tt')).paddingRight,
      pw: R('.pw'), top: !!c.querySelector('.top'), chs: R('.chs'), chips: [...c.querySelectorAll('.ch')].map((x) => x.textContent.trim()), ctl: R('.ctl'), btns: [...c.querySelectorAll('.ctl button')].map((b) => b.dataset.act + (b.dataset.d || '')), pp: R('.cb.pp'),
      tm: (c.querySelector('.tm .nx') || {}).textContent || '', overflow: c.scrollHeight - c.clientHeight };
  }, id);
  const st = await g('media_player.stue_tv');
  ok(st && st.h === 256, `19.5@${vw}: TV-kort høyde ${st && st.h}`);
  ok(st && st.art && st.art.w === 84 && st.art.h === 118 && st.img, `19.5@${vw}: plakat 84×118 ` + JSON.stringify(st && st.art));
  ok(st && st.bdg === '4K', `19.5@${vw}: oppløsningsmerke ` + (st && st.bdg));
  ok(st && st.dlFirst && /^Stue TV · SERIE · S2 · E7/.test(st.dl), `19.5@${vw}: enhetslinje ` + (st && st.dl));
  ok(st && st.ti === 'Episode 7' && st.tiFs === '22px' && st.ar === 'The Bear', `19.5@${vw}: tittel/serie ` + JSON.stringify(st && [st.ti, st.tiFs, st.ar]));
  ok(st && !st.top && st.pw && Math.round(st.pw.y) === 16 && st.pw.r === 16 && st.pr === '40px', `19.5@${vw}: av/på øverst til høyre ` + JSON.stringify(st && [st.pw, st.pr, st.top]));
  ok(st && st.chs && st.chs.h <= 22 && st.chips.includes('HDMI 2') && !st.chips.some((x) => /slutter|undertekst/i.test(x)), `19.5@${vw}: chips én linje ` + JSON.stringify(st && [st.chs, st.chips]));
  ok(st && /23 min igjen · slutter \d\d:\d\d/.test(st.tm), `19.5@${vw}: tidslinje ` + (st && st.tm));
  ok(st && st.btns.join(',') === 'seek-10,pp,seek30,next' && st.pp && st.pp.w === 48, `19.5@${vw}: kontrollrad ` + JSON.stringify(st && [st.btns, st.pp]));
  ok(st && st.ctl && st.ctl.b <= 256 - 12 && st.overflow <= 1, `19.5@${vw}: kontrollrad kuttes ` + JSON.stringify(st && [st.ctl, st.overflow]));
  // Kontrollraden kaller riktige tjenester
  await clearCalls(p);
  await p.evaluate(() => { const c = [...window.__hero.shadowRoot.querySelectorAll('.pc')].find((x) => x.dataset.key === 'media_player.stue_tv'); c.querySelector('[data-act="seek"][data-d="30"]').click(); c.querySelector('[data-act="pp"]').click(); c.querySelector('[data-act="next"]').click(); });
  const cc = await calls(p);
  ok(cc.some((c) => c[1] === 'media_seek' && /"seek_position":45\d/.test(c[2])) && cc.some((c) => c[1] === 'media_play_pause') && cc.some((c) => c[1] === 'media_next_track'), `19.5@${vw}: tjenester ` + JSON.stringify(cc));
  // Direkte (prosjektor): LIVE-merke, «NRK TV · DIREKTE», Dolby-chip, ingen seek/neste (ikke støttet)
  const pr = await g('media_player.prosjektor');
  ok(pr && pr.bdg === 'LIVE' && /· NRK TV · DIREKTE/.test(pr.dl) && pr.chips.includes('Dolby 5.1') && pr.btns.join(',') === 'pp', `19.5@${vw}: direkte ` + JSON.stringify(pr && [pr.bdg, pr.dl, pr.chips, pr.btns]));
  // Film: «FILM · 2024», aldri «Serie»
  await p.evaluate(() => {
    const h = window.__h, s = h.states['media_player.stue_tv'], st = { ...h.states };
    st['media_player.stue_tv'] = { ...s, attributes: { ...s.attributes, media_title: 'Dune: Part Two', media_series_title: undefined, media_season: undefined, media_episode: 3, media_content_type: 'movie', media_year: 2024, video_resolution: undefined } };
    const nh = { ...h, states: st }; window.__h = nh; window.__main.hass = nh; window.__hero.hass = nh;
  });
  await p.waitForTimeout(300);
  const fm = await g('media_player.stue_tv');
  ok(fm && /· FILM · 2024/.test(fm.dl) && !/SERIE/.test(fm.dl) && fm.bdg === '', `19.5@${vw}: film ` + JSON.stringify(fm && [fm.dl, fm.bdg]));
  await shot(p, 'tv-195-' + vw);
  // Av: ingen kontrollrad
  await p.evaluate(() => { const h = window.__h, st = { ...h.states }; st['media_player.stue_tv'] = { ...h.states['media_player.stue_tv'], state: 'off' }; const nh = { ...h, states: st }; window.__h = nh; window.__main.hass = nh; window.__hero.hass = nh; });
  await p.waitForTimeout(300);
  const off = await g('media_player.stue_tv');
  ok(off && !off.ctl && off.ti === 'Av' && off.h === 256, `19.5@${vw}: av-tilstand ` + JSON.stringify(off && [off.ctl, off.ti]));
  // Musikk: samme høyde, omslag 118, enhetslinje først
  await tab(p, 'musikk');
  await p.waitForTimeout(300);
  const mu = await g('media_player.kjokken_radio');
  ok(mu && mu.h === 256 && mu.art && mu.art.w === 118 && mu.art.h === 118 && mu.dlFirst && /^Kjøkken radio · NRK JAZZ/.test(mu.dl) && mu.tiFs === '22px' && mu.pw && mu.pw.r === 16, `19.5@${vw}: musikk-kort ` + JSON.stringify(mu && [mu.h, mu.art, mu.dl, mu.tiFs, mu.pw]));
  await shot(p, 'musikk-195-' + vw);
  ok(!errs.length, `19.5@${vw}: feil ` + errs.join(' | '));
  await p.close();
}

/* 5 · Fiks 19.4: fjernkontroll Kompakt / Sirkel per TV */
{
  const { p, errs } = await page({ default_tab: 'tv', players: { stue_tv: { remote_style: 'sirkel' } } });
  await p.evaluate(() => { window.__main.onOpen(); window.__main.select('tv', 'media_player.stue_tv'); });
  await p.waitForTimeout(400);
  const R = await p.evaluate(() => {
    const S = window.__main.shadowRoot, sz = (q) => { const e = S.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    return { sp: sz('.sp'), ok: sz('.sok'), rb: [...S.querySelectorAll('.r5 .rb')].map((b) => (b.dataset.c || b.dataset.act) + ':' + Math.round(b.getBoundingClientRect().width)), dp: !!S.querySelector('.dp'), svol: S.querySelectorAll('.svol .mvk button').length, svolH: sz('.svol .mvp'),
      volOutside: [...S.querySelectorAll('.mvr')].filter((r) => !r.closest('.svol')).length, hint: /Sveip på sirkelen/.test(S.textContent) };
  });
  ok(R.sp && R.sp[0] === 260 && R.sp[1] === 260 && R.ok && R.ok[0] === 84 && !R.dp, '19.4: sirkel 260 / OK 84 ' + JSON.stringify(R));
  ok(R.rb.map((x) => x.split(':')[0]).join(',') === 'rpower,back,home,mic,play' && R.rb.every((x) => +x.split(':')[1] >= 58 && +x.split(':')[1] <= 62), '19.4: fem runde knapper (62 px, krymper på smal skjerm) ' + R.rb);
  ok(R.svol === 3 && R.svolH && R.svolH[1] === 62 && R.volOutside === 0 && !R.hint, '19.4: volumlinje ' + JSON.stringify(R));
  await shot(p, 'tv-sirkel');
  if (SHOTS) await p.locator('msh-media-card').first().screenshot({ path: `${SHOTS}/tv-sirkel-kort.png` });
  const pt = (q) => p.evaluate((q) => { const e = window.__main.shadowRoot.querySelector(q); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, q);
  const cmds = async () => (await calls(p)).filter((c) => c[0] === 'remote').map((c) => JSON.parse(c[2]));
  // Trykk på pil + mikrofon
  await clearCalls(p);
  let q = await pt('.sa.su'); await p.mouse.click(q.x, q.y); await p.waitForTimeout(100);
  q = await pt('.rb[data-c="mic"]'); await p.mouse.click(q.x, q.y); await p.waitForTimeout(100);
  let C1 = await cmds();
  ok(C1.map((c) => c.command).join(',') === 'up,voice' && C1.every((c) => c.entity_id === 'remote.stue_tv'), '19.4: pil/mikrofon ' + JSON.stringify(C1));
  // Sveip mot høyre (80 px) → 2 × right, ingen OK
  await clearCalls(p);
  q = await pt('.sp');
  await p.mouse.move(q.x - 40, q.y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(q.x - 40 + i * 10, q.y); await p.waitForTimeout(20); }
  const glow = await p.evaluate(() => getComputedStyle(window.__main).getPropertyValue('--msh-glow-o').trim());
  await p.mouse.up(); await p.waitForTimeout(100);
  C1 = await cmds();
  ok(C1.map((c) => c.command).join(',') === 'right,right' && glow === '1', '19.4: sveip ' + JSON.stringify(C1) + ' glød=' + glow);
  // Hold Hjem 700 ms → plattform-handling (Apple TV: home hold_secs 1), fyll under holdet, klikket etterpå ignoreres
  await clearCalls(p);
  q = await pt('.rb.hh');
  await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.waitForTimeout(200);
  const fill = await p.evaluate(() => window.__main.shadowRoot.querySelector('.rb.hh').classList.contains('fill'));
  await p.waitForTimeout(500); await p.mouse.up(); await p.waitForTimeout(100);
  C1 = await cmds();
  ok(fill && C1.length === 1 && C1[0].command === 'home' && C1[0].hold_secs === 1, '19.4: hold Hjem ' + JSON.stringify(C1) + ' fill=' + fill);
  // Kort trykk på Hjem = vanlig home
  await clearCalls(p);
  await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(100);
  C1 = await cmds();
  ok(C1.length === 1 && C1[0].command === 'home' && !C1[0].hold_secs, '19.4: kort trykk Hjem ' + JSON.stringify(C1));
  // Volumlinjen: + → volume_set, av/på → turn_off
  await clearCalls(p);
  q = await pt('.svol [data-vact="up"]'); await p.mouse.click(q.x, q.y); await p.waitForTimeout(100);
  q = await pt('.rb.pwr'); await p.mouse.click(q.x, q.y); await p.waitForTimeout(100);
  const vc = await calls(p);
  ok(vc.some((c) => c[1] === 'volume_set') && vc.some((c) => c[1] === 'turn_off'), '19.4: volum/av-på ' + JSON.stringify(vc));
  // Editor: Fjernkontroll Kompakt · Sirkel i TV-seksjonen → players.stue_tv.remote_style
  const ed = await p.evaluate(async () => {
    const ed = window.__main.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-media-card' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 100));
    const out = []; ed.addEventListener('config-changed', (e) => out.push(e.detail.config));
    const R = ed.shadowRoot; R.querySelector('[data-a="fn"][data-t="tv"]').click(); await new Promise((q) => setTimeout(q, 50));
    const bs = [...R.querySelectorAll('[data-name="players.stue_tv.remote_style"]')];
    const labels = bs.map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : ''));
    bs.find((b) => b.dataset.v === 'sirkel').click(); await new Promise((q) => setTimeout(q, 50));
    const last = out[out.length - 1];
    ed.remove();
    return { labels, v: last && last.players && last.players.stue_tv && last.players.stue_tv.remote_style };
  });
  ok(ed.labels.join('|') === 'Kompakt*|Sirkel' && ed.v === 'sirkel', '19.4: editor ' + JSON.stringify(ed));
  // Tilbake til Kompakt live (config uten remote_style)
  await p.evaluate(() => { window.__main.setConfig({ type: 'custom:msh-media-card', default_tab: 'tv' }); });
  await p.waitForTimeout(300);
  const k = await p.evaluate(() => ({ dp: !!window.__main.shadowRoot.querySelector('.dp'), sp: !!window.__main.shadowRoot.querySelector('.sp'), keys: window.__main.shadowRoot.querySelectorAll('.keys .key').length, vol: !!window.__main.shadowRoot.querySelector('.mvr') }));
  ok(k.dp && !k.sp && k.keys === 4 && k.vol, '19.4: kompakt ' + JSON.stringify(k));
  ok(!errs.length, '19.4: feil ' + errs.join(' | '));
  await p.close();
}
/* 20.21 · Album-kortet (standard): TV og Musikk, farget/grå bakgrunn, seertid-chip, kontrast, Detaljert = gamle kortet */
{
  const WT = { 'sensor.tv_seertid_i_dag': [2.2334, { unit_of_measurement: 'h' }], 'sensor.tv_seertid_denne_maned': [2883, { unit_of_measurement: 'min' }] };
  const cfg = { default_tab: 'tv', now_playing: { style: 'album' }, watch_time: { 'media_player.stue_tv': { i_dag: 'sensor.tv_seertid_i_dag', maned: 'sensor.tv_seertid_denne_maned' } } };
  const { p, errs } = await page(cfg, null, 390, WT);
  const alb = () => p.evaluate(() => [...window.__hero.shadowRoot.querySelectorAll('.pc')].map((c) => {
    const cs = getComputedStyle(c), wt = c.querySelector('.al-wt'), art = c.querySelector('.al-art'), ar = art && art.getBoundingClientRect(), wr = wt && wt.getBoundingClientRect();
    return { id: c.dataset.key, al: c.classList.contains('al'), off: c.classList.contains('off'), h: Math.round(c.getBoundingClientRect().height), bg: cs.backgroundColor, grid: cs.gridTemplateColumns,
      chip: (c.querySelector('.al-chip') || {}).textContent, ti: (c.querySelector('.al-ti') || {}).textContent, ar: (c.querySelector('.al-ar') || {}).textContent,
      eq: c.querySelectorAll('.al-eq span').length, segs: c.querySelectorAll('.al-seg i').length, segOn: c.querySelectorAll('.al-seg i.on').length,
      btns: [...c.querySelectorAll('.al-b')].map((x) => x.dataset.act), art: ar && [Math.round(ar.width), Math.round(ar.height)],
      wt: wt && wt.textContent.replace(/\s+/g, '').replace('·', ' · '), wtTitle: wt && wt.title, wtBelow: !!(wt && wr.top >= ar.bottom), wtBg: wt && getComputedStyle(wt).backgroundColor };
  }));
  await p.evaluate(() => window.__main.onOpen && window.__main.onOpen());
  await p.waitForTimeout(500);
  let A = await alb();
  const tv = A.find((c) => c.id === 'media_player.stue_tv'), sov = A.find((c) => c.id === 'media_player.soverom_tv');
  ok(A.length && A.every((c) => c.al), '20.21 TV: ikke Album-kort ' + JSON.stringify(A.map((c) => c.id + ':' + c.al)));
  ok(tv && tv.h >= 150 && tv.h <= 190 && / 104px$/.test(tv.grid), '20.21 TV: høyde/grid ' + JSON.stringify(tv && [tv.h, tv.grid]));
  ok(tv && /^Stue TV · Netflix$/.test((tv.chip || '').trim()) && tv.ti === 'Wednesday' && /Sesong 2/.test(tv.ar || ''), '20.21 TV: chip/tittel ' + JSON.stringify(tv));
  ok(tv && tv.btns.join(',') === 'power,pp' && tv.art.join('x') === '104x104', '20.21 TV: knapper/bilde ' + JSON.stringify(tv && [tv.btns, tv.art]));
  ok(tv && tv.wt === '2:14 · 48:03' && tv.wtTitle === 'Seertid i dag · denne måneden' && tv.wtBelow, '20.21 TV: seertid ' + JSON.stringify(tv && [tv.wt, tv.wtBelow]));
  ok(sov && sov.off && sov.bg === 'rgb(58, 58, 58)' && sov.ti === 'Av' && sov.segs === 0 && sov.eq === 0 && !sov.wt, '20.21 TV av: ' + JSON.stringify(sov));
  // Stue TV av → grå, seertid står fortsatt (#4a4a4a)
  await p.evaluate(async () => { const h = window.__h, s = { ...h.states }; s['media_player.stue_tv'] = { ...s['media_player.stue_tv'], state: 'off' }; window.__h = { ...h, states: s }; window.__hero.hass = window.__h; window.__main.hass = window.__h; await new Promise((q) => setTimeout(q, 700)); });
  A = await alb();
  const tvOff = A.find((c) => c.id === 'media_player.stue_tv');
  ok(tvOff && tvOff.off && tvOff.bg === 'rgb(58, 58, 58)' && tvOff.wt === '2:14 · 48:03' && tvOff.wtBg === 'rgb(74, 74, 74)', '20.21 TV av: seertid/grå ' + JSON.stringify(tvOff));
  // Mangler én sensor → «–»
  await p.evaluate(async () => { window.__main.setConfig({ type: 'custom:msh-media-card', default_tab: 'tv', watch_time: { stue_tv: { i_dag: 'sensor.tv_seertid_i_dag' } } }); await new Promise((q) => setTimeout(q, 300)); });
  A = await alb();
  ok((A.find((c) => c.id === 'media_player.stue_tv') || {}).wt === '2:14 · –', '20.21: manglende sensor ≠ «–» ' + JSON.stringify(A[0] && A[0].wt));
  // Musikk: farget bakgrunn når den spiller, eq, neste-knapp, kontrast ≥ 4.5 mot hvitt
  await tab(p, 'musikk'); await p.waitForTimeout(700);
  A = await alb();
  const lum = (c) => { const n = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]; };
  const run = A.filter((c) => !c.off);
  ok(run.length && run.every((c) => c.bg !== 'rgb(58, 58, 58)' && 1.05 / (lum(c.bg) + 0.05) >= 4.5), '20.21 musikk: bakgrunn/kontrast ' + JSON.stringify(run.map((c) => c.bg)));
  const jem = A.find((c) => c.id === 'media_player.spotify_jem');
  ok(jem && jem.eq === 5 && jem.segs === 14 && jem.segOn > 0 && jem.segOn < 14 && jem.btns.join(',') === 'power,next', '20.21 musikk: eq/segmenter/knapper ' + JSON.stringify(jem));
  // kontrast-hjelperen på lyse farger
  const bgs = await p.evaluate(() => ['#ffffff', '#f5cfd0', '#ffeb3b', '#1db954', 'rgb(200, 220, 240)'].map((c) => window.MSH.mediaAlbumBg(c)));
  ok(bgs.every((c) => 1.05 / (lum(c) + 0.05) >= 4.5), '20.21: kontrast ' + JSON.stringify(bgs));
  // Knappene: neste → media_next_track, haptic, ingen videre propagering til kortet (ingen more-info)
  await clearCalls(p);
  await p.evaluate(() => { window.__hap = 0; window.addEventListener('haptic', () => window.__hap++); });
  const nb = await p.evaluate(() => { const b = window.__hero.shadowRoot.querySelector('.pc[data-key="media_player.spotify_jem"] .al-b[data-act="next"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(nb.x, nb.y); await p.waitForTimeout(150);
  const nc = await calls(p);
  ok(nc.some((c) => c[1] === 'media_next_track'), '20.21: neste ' + JSON.stringify(nc));
  ok(await p.evaluate(() => window.__hap >= 1), '20.21: haptic mangler');
  if (SHOTS) await shot(p, 'album-musikk');
  // Detaljert → det gamle kortet (256)
  await p.evaluate(async () => { window.__main.setConfig({ type: 'custom:msh-media-card', default_tab: 'musikk', now_playing: { style: 'detailed' } }); await new Promise((q) => setTimeout(q, 400)); });
  const C2 = await cards(p);
  ok(C2.length && C2.every((c) => c.h === 256) && !(await p.evaluate(() => !!window.__hero.shadowRoot.querySelector('.pc.al'))), '20.21: Detaljert ≠ gamle kortet');
  // Editoren: «Spilles nå-kort» (Album*/Detaljert) + seertid-velgere i TV-seksjonen
  const ed = await p.evaluate(async () => {
    const ed = window.__main.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-media-card' });
    document.body.appendChild(ed); await new Promise((q) => setTimeout(q, 100));
    const out = []; ed.addEventListener('config-changed', (e) => out.push(e.detail.config));
    const R = ed.shadowRoot; R.querySelector('[data-a="fn"][data-t="tv"]').click(); await new Promise((q) => setTimeout(q, 50));
    const bs = [...R.querySelectorAll('[data-name="now_playing.style"]')];
    const labels = bs.map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : ''));
    const html = R.innerHTML;
    const d = bs.find((b) => b.dataset.v === 'detailed'); if (d) d.click(); await new Promise((q) => setTimeout(q, 50));
    const last = out[out.length - 1];
    ed.remove();
    return { labels, wt: /watch_time\.stue_tv\.i_dag/.test(html) && /watch_time\.stue_tv\.maned/.test(html), v: last && last.now_playing && last.now_playing.style };
  });
  ok(ed.labels.join('|') === 'Album*|Detaljert' && ed.wt && ed.v === 'detailed', '20.21: editor ' + JSON.stringify(ed));
  ok(!errs.length, '20.21: feil ' + errs.join(' | '));
  await p.close();
}
/* 21.6 · Apper | Innganger på TV-kortet, lister + chip-felt i editoren (apps/inputs/presets), favoritter via browse_media */
{
  const tvAttr = { friendly_name: 'Stue TV', device_class: 'tv', source_list: ['Netflix', 'NRK TV', 'HDMI 1', 'HDMI 2 (ARC)', 'Antenna'], source: 'Netflix', app_name: 'Netflix', supported_features: 152461 };
  const { p, errs } = await page({ default_tab: 'tv', area: 'stue' }, {}, 390, { 'media_player.stue_tv': ['on', tvAttr] });
  await p.evaluate(() => window.__main.onOpen && window.__main.onOpen());
  await p.waitForTimeout(300);
  const chipsNow = () => p.evaluate(() => ({ seg: [...window.__main.shadowRoot.querySelectorAll('.mseg button')].map((b) => (b.classList.contains('on') ? '*' : '') + b.textContent.trim()),
    ttl: (window.__main.shadowRoot.querySelector('.cs .ttl') || {}).textContent, chips: [...window.__main.shadowRoot.querySelectorAll('.cs .chip')].map((c) => c.textContent.trim()) }));
  const c1 = await chipsNow();
  ok(c1.seg.join('|') === '*Apper|Innganger' && c1.chips.join('|') === 'Netflix|NRK TV', '21.6 TV: apper ' + JSON.stringify(c1));
  await p.evaluate(() => window.__main.shadowRoot.querySelector('.mseg button[data-m="inputs"]').click()); await p.waitForTimeout(200);
  const c2 = await chipsNow();
  ok(c2.seg.join('|') === 'Apper|*Innganger' && c2.chips.join('|') === 'HDMI 1|HDMI 2|Antenne' && c2.ttl === 'Innganger', '21.6 TV: innganger ' + JSON.stringify(c2));
  await clearCalls(p);
  await p.evaluate(() => [...window.__main.shadowRoot.querySelectorAll('.cs .chip')].find((c) => c.textContent.trim() === 'HDMI 2').click()); await p.waitForTimeout(150);
  const k1 = await calls(p);
  ok(k1.some((c) => c[1] === 'select_source' && /"source":"HDMI 2 \(ARC\)"/.test(c[2]) && /stue_tv/.test(c[2])), '21.6 TV: select_source ' + JSON.stringify(k1));
  // Aktiv inngang i TV-infoen
  await p.evaluate(async () => { const h = { ...window.__h, states: { ...window.__h.states } }; const s = h.states['media_player.stue_tv'];
    h.states['media_player.stue_tv'] = { ...s, attributes: { ...s.attributes, source: 'HDMI 2 (ARC)', app_name: undefined, media_title: undefined } }; window.__h = h; window.__hero.hass = h; window.__main.hass = h; await new Promise((q) => setTimeout(q, 300)); });
  const lab = await p.evaluate(() => (window.__hero.shadowRoot.querySelector('.pc[data-key="media_player.stue_tv"]') || {}).textContent);
  ok(/Stue TV\s*·\s*HDMI 2/.test(lab || ''), '21.6 TV-info: aktiv inngang ' + lab);
  // GUI-editoren: lister + chip-felt
  const ed = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms || 60));
    const ed = window.__main.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-media-card' });
    document.body.appendChild(ed); await w(100);
    const out = []; ed.addEventListener('config-changed', (e) => { out.push(e.detail.config); ed.setConfig(e.detail.config); });
    const R = ed.shadowRoot, last = () => out[out.length - 1] || {}, pl = (o) => ((last().players || {})[o] || {});
    const q = (sel) => R.querySelector(sel), qa = (sel) => [...R.querySelectorAll(sel)];
    q('[data-a="fn"][data-t="tv"]').click(); await w();
    const res = {};
    const blk = (o, k) => q(`[data-key="b21-${o}-${k}"]`);
    const names = (o, k) => [...blk(o, k).querySelectorAll('input[data-f="name"]')].map((i) => i.value);
    const chips = (o, k) => [...blk(o, k).querySelectorAll('[data-op="chip"]')].map((c) => (c.getAttribute('aria-pressed') === 'true' ? '✓' : '+') + c.textContent.trim());
    res.apps0 = names('stue_tv', 'apps'); res.appChips = chips('stue_tv', 'apps');
    res.in0 = names('stue_tv', 'inputs'); res.inChips = chips('stue_tv', 'inputs');
    blk('stue_tv', 'apps').querySelector('[data-op="chip"][data-v="NRK TV"]').click(); await w();
    res.apps1 = (pl('stue_tv').apps || []).map((a) => a.name);
    blk('stue_tv', 'apps').querySelector('[data-op="add"]').click(); await w();
    res.apps2 = (pl('stue_tv').apps || []).map((a) => a.name);
    const ni = [...blk('stue_tv', 'apps').querySelectorAll('input[data-f="name"]')].pop(); ni.value = 'Plex'; ni.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w();
    const si = blk('stue_tv', 'apps').querySelector('input[data-f="source"]'); if (si) { si.value = 'Plex'; si.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(); }
    res.apps3 = (pl('stue_tv').apps || []).map((a) => a.name + '/' + (a.source || ''));
    blk('stue_tv', 'apps').querySelector('[data-op="up"][data-i="1"]').click(); await w();
    res.apps4 = (pl('stue_tv').apps || []).map((a) => a.name);
    blk('stue_tv', 'apps').querySelector('[data-op="reset"]').click(); await w();
    res.appsReset = pl('stue_tv').apps === undefined && names('stue_tv', 'apps').join('|') === 'Netflix|NRK TV';
    blk('stue_tv', 'inputs').querySelector('[data-op="chip"][data-v="HDMI 1"]').click(); await w();
    res.in1 = (pl('stue_tv').inputs || []).map((a) => a.name + '/' + a.source);
    blk('stue_tv', 'inputs').querySelector('[data-op="add"]').click(); await w();
    res.in2 = (pl('stue_tv').inputs || []).length;
    blk('stue_tv', 'inputs').querySelector('[data-op="del"][data-i="0"]').click(); await w();
    res.in3 = (pl('stue_tv').inputs || []).map((a) => a.name);
    // Musikk: radio (favoritter) + forsterker (source_list)
    q('[data-a="fn"][data-t="musikk"]').click(); await w(300);
    res.radioTitle = (blk('kjokken_radio', 'presets') || { textContent: '' }).textContent.includes('Radiostasjoner og snarveier');
    res.radio0 = names('kjokken_radio', 'presets');
    res.favChips = chips('kjokken_radio', 'presets');
    blk('kjokken_radio', 'presets').querySelector('[data-op="chip"][data-ty="favorite"][data-n="Montebello"]').click(); await w();
    res.radio1 = (pl('kjokken_radio').presets || []).map((x) => x.type + ':' + x.name + ':' + x.target);
    blk('kjokken_radio', 'presets').querySelector('[data-op="add"][data-ty="favorite"]').click(); await w();
    res.radio2 = (pl('kjokken_radio').presets || []).slice(-1).map((x) => x.type + ':' + x.name);
    const fp = blk('kjokken_radio', 'presets').querySelector('[data-op="fav"][data-n="NRK mP3"]'); if (fp) { fp.click(); await w(); }
    res.radio3 = (pl('kjokken_radio').presets || []).slice(-1).map((x) => x.type + ':' + x.name + ':' + x.target + ':' + x.content_type);
    blk('kjokken_radio', 'presets').querySelector('[data-op="chip"][data-ty="favorite"][data-n="Montebello"]').click(); await w();
    res.radio4 = (pl('kjokken_radio').presets || []).some((x) => x.name === 'Montebello');
    res.ampTitle = (blk('rn602_stue', 'presets') || { textContent: '' }).textContent.includes('Forsterker-innganger og snarveier');
    res.amp0 = names('rn602_stue', 'presets'); res.ampChips = chips('rn602_stue', 'presets');
    blk('rn602_stue', 'presets').querySelector('[data-op="chip"][data-ty="source"][data-v="Phono"]').click(); await w();
    res.amp1 = (pl('rn602_stue').presets || []).map((x) => x.name);
    blk('rn602_stue', 'presets').querySelector('[data-op="add"][data-ty="source"]').click(); await w();
    res.amp2 = (pl('rn602_stue').presets || []).slice(-1).map((x) => x.type);
    res.final = last();
    ed.remove();
    return res;
  });
  ok(ed.apps0.join('|') === 'Netflix|NRK TV' && ed.appChips.join('|') === '✓Netflix|✓NRK TV', '21.6 editor: apper auto ' + JSON.stringify([ed.apps0, ed.appChips]));
  ok(ed.in0.join('|') === 'HDMI 1|HDMI 2|Antenne' && ed.inChips.length === 5 && ed.inChips[0] === '✓HDMI 1', '21.6 editor: innganger auto ' + JSON.stringify([ed.in0, ed.inChips]));
  ok(ed.apps1.join('|') === 'Netflix' && ed.apps2.join('|') === 'Netflix|Ny app' && ed.apps3.join('|') === 'Netflix/Netflix|Plex/Plex' && ed.apps4.join('|') === 'Plex|Netflix' && ed.appsReset, '21.6 editor: apper rediger ' + JSON.stringify([ed.apps1, ed.apps2, ed.apps3, ed.apps4, ed.appsReset]));
  ok(ed.in1.join('|') === 'HDMI 2/HDMI 2 (ARC)|Antenne/Antenna' && ed.in2 === 3 && ed.in3.join('|') === 'Antenne|Ny inngang', '21.6 editor: innganger rediger ' + JSON.stringify([ed.in1, ed.in2, ed.in3]));
  ok(ed.radioTitle && ed.radio0.length === 4 && ed.favChips.join('|') === '+Montebello|+NRK P1|+NRK Jazz|+NRK mP3', '21.6 editor: radio ' + JSON.stringify([ed.radio0, ed.favChips]));
  ok(ed.radio1.length === 5 && ed.radio1[4] === 'favorite:Montebello:item_id:fav0' && ed.radio2[0] === 'favorite:Ny stasjon' && ed.radio3[0] === 'favorite:NRK mP3:item_id:fav3:favorite' && !ed.radio4, '21.6 editor: favoritter ' + JSON.stringify([ed.radio1, ed.radio2, ed.radio3, ed.radio4]));
  ok(ed.ampTitle && ed.amp0.join('|') === 'Spotify|AirPlay|Net Radio|TV|Phono' && ed.ampChips.every((c) => c[0] === '✓') && ed.amp1.join('|') === 'Spotify|AirPlay|Net Radio|TV' && ed.amp2[0] === 'source', '21.6 editor: forsterker ' + JSON.stringify([ed.amp0, ed.ampChips, ed.amp1, ed.amp2]));
  // Kortet bruker lagrede lister: radio-favoritt → play_media, forsterker-input → select_source
  await p.evaluate(async (cfg) => { window.__main.setConfig({ ...cfg, default_tab: 'musikk', area: 'kjokken', now_playing: { style: 'detailed' } }); window.__main.onOpen(); await new Promise((q) => setTimeout(q, 300)); }, ed.final);
  const mc = await p.evaluate(() => [...window.__main.shadowRoot.querySelectorAll('.cs .chip')].map((c) => c.textContent.trim()));
  await clearCalls(p);
  await p.evaluate(() => [...window.__main.shadowRoot.querySelectorAll('.cs .chip')].find((c) => c.textContent.trim() === 'NRK mP3').click()); await p.waitForTimeout(150);
  const k2 = await calls(p);
  ok(mc.includes('NRK mP3') && !mc.includes('Montebello') && k2.some((c) => c[1] === 'play_media' && /item_id:fav3/.test(c[2]) && /kjokken_radio/.test(c[2])), '21.6 radio: play_media ' + JSON.stringify([mc, k2]));
  await p.evaluate(async (cfg) => { window.__main.setConfig({ ...cfg, default_tab: 'musikk', area: 'stue', now_playing: { style: 'detailed' } }); window.__main.onOpen(); await new Promise((q) => setTimeout(q, 300)); }, ed.final);
  const ac = await p.evaluate(() => [...window.__main.shadowRoot.querySelectorAll('.cs .chip')].map((c) => c.textContent.trim()));
  ok(ac.join('|') === 'Spotify|AirPlay|Net Radio|TV|Ny input', '21.6 forsterker: chips ' + JSON.stringify(ac));
  if (SHOTS) await shot(p, '21-6');
  ok(!errs.length, '21.6: feil ' + errs.join(' | '));
  await p.close();
}
await b.close();
console.log(fails.length ? 'FEIL:\n- ' + fails.join('\n- ') : 'OK – media 17.21–17.25 + 19.4/19.5');
process.exit(fails.length ? 1 : 0);
