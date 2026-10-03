// Del 44 B · Aktive sensorer på aksentflate (Rom v4 sensors → pill/iconWrap/subStyle/stateStyle):
//  · Rom «Sensorer» (msh-rom-card), romkort-popup fra Hjem (msh-rom-card i Bubble-popup, kombinert rom med rom-chip)
//    og Sikkerhet-popupen (msh-sikkerhet-card: ikon-sirkler i aksentfarge)
//  · aktiv tilstedeværelse / bevegelse / dør: pille var(--green), tittel + ikon mørke, undertekst mørk .78, ikon-sirkel hvit .35,
//    status-chip mørk .14 / mørk tekst 600 – ingen opacity på tekst, kontrast ≥ 4,5:1 (tittel, undertekst, chip, ikon)
//  · stille sensor uendret (ikke s-acc, lys tekst i mørk modus)
//  · mørk + lys modus.   Kjør: node test/sensor44-check.mjs   (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/sens44-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (n, c, i) => { console.log(`${c ? '✔' : '✘'} ${n}${!c && i != null ? ' · ' + JSON.stringify(i).slice(0, 600) : ''}`); if (!c) fail++; };
const SENS = ['binary_sensor.s44_tilstede', 'binary_sensor.s44_bevegelse', 'binary_sensor.s44_dor'];
const QUIET = 'binary_sensor.s44_vindu';

for (const dark of [true, false]) {
  const tag = dark ? 'mørk' : 'lys';
  const p = await b.newPage({ viewport: { width: 390, height: 1400 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async ({ dark, SENS, QUIET }) => {
    const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass(); hass.themes = { ...(hass.themes || {}), darkMode: dark };
    if (M.theme && M.theme.update) M.theme.update(hass);
    if (!dark) document.documentElement.setAttribute('data-ki-theme', 'light');
    const t = new Date(Date.now() - 120000).toISOString();
    const add = (id, state, dc, nm, area) => { hass.states[id] = { entity_id: id, state, attributes: { device_class: dc, friendly_name: nm }, last_changed: t, last_updated: t, context: {} }; hass.entities[id] = { entity_id: id, platform: 'demo', area_id: area || 'stue', device_id: null }; };
    add(SENS[0], 'on', 'occupancy', 'Tilstede');
    add(SENS[1], 'on', 'motion', 'Bevegelse');
    add(SENS[2], 'on', 'door', 'Verandadør');
    add(QUIET, 'off', 'window', 'Vindu');
    const all = [...SENS, QUIET];
    const parse = (s) => {
      s = String(s || '');
      let m = s.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)/);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] != null ? +m[4] : 1];
      m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/);
      return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null;
    };
    const over = (f, bg) => [0, 1, 2].map((i) => f[i] * f[3] + bg[i] * (1 - f[3]));
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const cr = (a, x) => { const p = lum(a), q = lum(x); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
    const cs = (e) => getComputedStyle(e);
    // effektiv opasitet fra elementet opp til (ekskl.) pillen
    const opTo = (e, stop) => { let o = 1; for (let x = e; x && x !== stop; x = x.parentElement || (x.getRootNode() && x.getRootNode().host)) o *= Number(cs(x).opacity); return o; };
    const txt = (e, bg, pill) => { const c = parse(cs(e).color); return { col: cs(e).color, op: opTo(e, pill), cr: +cr(over([c[0], c[1], c[2], c[3] * opTo(e, pill)], bg), bg).toFixed(2) }; };
    const out = {};

    // ---------- Rom (msh-rom-card) + romkort-popup på Hjem (kombinert rom i Bubble-popup)
    const romRows = async (rc) => {
      rc.setUI({ acc: { sens: true } }); await wait(500);
      const R = rc.shadowRoot, rows = {};
      all.forEach((id) => {
        const e = R.querySelector(`[data-key="s-${id}"]`); if (!e) { rows[id] = null; return; }
        const bgc = parse(cs(e).backgroundColor), bg = over(bgc, dark ? [58, 58, 58] : [255, 255, 255]);
        const l = e.querySelector('.u-l'), n = e.querySelector('.u-n'), i = e.querySelector('.u-i'), ic = i.querySelector('ha-icon') || i, tg = e.querySelector('.rtag');
        const circ = parse(cs(i).backgroundColor), circBg = over(circ, bg);
        const icc = parse(cs(ic).color);
        rows[id] = { cls: e.className, bg: cs(e).backgroundColor, title: l && txt(l, bg, e), titleText: l && l.textContent, sub: n && txt(n, bg, e), subText: n && n.textContent.trim(),
          circ: cs(i).backgroundColor, circBorder: cs(i).borderTopWidth, icon: { col: cs(ic).color, cr: +cr(over(icc, circBg), circBg).toFixed(2) },
          chip: tg ? { bg: cs(tg).backgroundColor, fw: cs(tg).fontWeight, ...txt(tg, over(parse(cs(tg).backgroundColor), bg), e) } : null };
      });
      return rows;
    };
    const dash = document.getElementById('dash');
    const rc = document.createElement('msh-rom-card');
    rc.setConfig({ type: 'custom:msh-rom-card', card_id: 's44', area: 'stue', include: { sensorer: all }, exclude: Object.keys(hass.states).filter((k) => /^(binary_)?sensor\./.test(k) && !all.includes(k) && /bevegelse|tilstede|dor|vindu|motion|door|window/.test(k)) });
    rc.hass = hass; dash.appendChild(rc); await wait(500);
    out.rom = await romRows(rc);

    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#stue-kjokken' });
    bc.innerHTML = `<div class="pop" style="background:${dark ? '#282828' : '#f0f0f0'}"><div class="hdr">Stue + Kjøkken</div><div class="inner"></div></div>`;
    dash.appendChild(bc); location.hash = '#stue-kjokken';
    hass.entities[SENS[2]].area_id = 'kjokken';
    const r2 = document.createElement('msh-rom-card');
    r2.setConfig({ type: 'custom:msh-rom-card', card_id: 's44b', area: 'stue-kjokken', rooms: ['stue', 'kjokken'], primary: 'stue', name: 'Stue + Kjøkken', include: { sensorer: all } });
    r2.hass = hass; bc.querySelector('.inner').appendChild(r2); await wait(500);
    out.hjem = await romRows(r2);
    hass.entities[SENS[2]].area_id = 'stue';

    // ---------- Sikkerhet
    const bs = document.createElement('bubble-card');
    bs.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#sikkerhet' });
    bs.innerHTML = `<div class="pop" style="background:${dark ? '#282828' : '#f0f0f0'}"><div class="hdr">Sikkerhet</div><div class="inner"></div></div>`;
    dash.appendChild(bs); location.hash = '#sikkerhet';
    const sk = document.createElement('msh-sikkerhet-card');
    sk.setConfig({ type: 'custom:msh-sikkerhet-card', card_id: 's44s', include: { sensorer: all } });
    sk.hass = hass; bs.querySelector('.inner').appendChild(sk); await wait(700);
    const SR = sk.shadowRoot;
    const stueBtn = [...SR.querySelectorAll('[data-act="room"]')].find((e) => /Stue/i.test(e.dataset.room || ''));
    if (stueBtn) { stueBtn.click(); await wait(400); }
    const circles = [...SR.querySelectorAll('.raic, .smid')].map((e) => {
      const bgc = parse(cs(e).backgroundColor); if (!bgc || bgc[3] < 0.9) return null;
      const ic = e.querySelector('ha-icon') || e, c = parse(cs(ic).color);
      return { cls: e.className, bg: cs(e).backgroundColor, col: cs(ic).color, cr: +cr(over(c, bgc), bgc).toFixed(2) };
    }).filter(Boolean);
    out.sik = { circles, open: !!stueBtn, rolr: SR.querySelectorAll('.rolr').length };
    return out;
  }, { dark, SENS, QUIET });
  if (shots) { mkdirSync(shots, { recursive: true }); await p.screenshot({ path: `${shots}/sensor44-${tag}.png`, fullPage: true }); }

  for (const where of ['rom', 'hjem']) {
    const W = where === 'rom' ? 'Rom' : 'Hjem-romkort (popup, kombinert)';
    const rows = r[where] || {};
    for (const id of SENS) {
      const x = rows[id], k = id.split('_').pop();
      if (!x) { ok(`${tag} · ${W} · ${k}: rad finnes`, false, rows); continue; }
      ok(`${tag} · ${W} · ${k}: aksent-pille (s-acc) med grønn bakgrunn`, /s-acc/.test(x.cls) && /102, 209, 158/.test(x.bg), { cls: x.cls, bg: x.bg });
      ok(`${tag} · ${W} · ${k}: tittel mørk, ingen opacity, kontrast ≥ 4,5`, x.title.op === 1 && x.title.cr >= 4.5, x.title);
      ok(`${tag} · ${W} · ${k}: undertekst mørk .78, ingen opacity, kontrast ≥ 4,5`, x.sub.op === 1 && x.sub.cr >= 4.5, x.sub);
      ok(`${tag} · ${W} · ${k}: ikon-sirkel hvit .35 uten kant, ikon kontrast ≥ 4,5`, /255, 255, 255, 0.35/.test(x.circ) && x.circBorder === '0px' && x.icon.cr >= 4.5, { circ: x.circ, b: x.circBorder, icon: x.icon });
      if (x.chip) ok(`${tag} · ${W} · ${k}: status-chip (rom-tagg) mørk .14, tekst 600, kontrast ≥ 4,5`, x.chip.fw === '600' && x.chip.op === 1 && x.chip.cr >= 4.5 && /color\(srgb|rgba?\(/.test(x.chip.bg), x.chip);
    }
    if (where === 'hjem') ok(`${tag} · ${W}: minst én aktiv rad med status-chip (rom-tagg)`, SENS.some((id) => rows[id] && rows[id].chip), SENS.map((id) => rows[id] && rows[id].chip));
    const q = rows[QUIET];
    ok(`${tag} · ${W} · stille sensor uendret (ingen s-acc, ikke grønn)`, q && !/s-acc/.test(q.cls) && !/102, 209, 158/.test(q.bg), q && { cls: q.cls, bg: q.bg });
    if (q && dark) ok(`${tag} · ${W} · stille sensor: lys tittel i mørk modus`, q.title.cr >= 4.5, q.title);
  }
  const S = r.sik || {};
  ok(`${tag} · Sikkerhet: aktive ikon-sirkler i aksentfarge funnet`, (S.circles || []).length >= 2, S);
  ok(`${tag} · Sikkerhet: mørkt ikon på aksent, kontrast ≥ 4,5`, (S.circles || []).length && S.circles.every((c) => c.cr >= 4.5), S.circles);
  ok(`${tag} · ingen sidefeil`, !errs.length, errs);
  await p.close();
}
await b.close();
rmSync(bundle, { force: true });
console.log(fail ? `\n${fail} feil` : '\nAlle OK');
process.exit(fail ? 1 : 0);
