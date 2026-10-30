// Fiks 64 (prompt v8): PC-dashbord (msh-pc-card i msh-hjem-card). Kjør: node test/v8-check.mjs   (SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/v8-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (n, c, i) => res.push(`${c ? '✔' : '✘'} ${n}${!c && i != null ? ' · ' + JSON.stringify(i) : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(w, mode, ctx0) {
  const ctx = ctx0 || await b.newContext({ viewport: { width: w, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  if (mode) await p.evaluate((m) => localStorage.setItem('ki-pc-oppsett', m), mode);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.H = window.mockHass(); MSH.lastHass = window.H; if (MSH.store && !MSH.store.loaded) MSH.store.load(window.H);
    const el = document.createElement('msh-hjem-card'); el.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); el.hass = window.H;
    document.getElementById('dash').appendChild(el); window.__hj = el;
    await new Promise((r) => setTimeout(r, 1200));
    window.__pc = () => el.shadowRoot.querySelector('msh-pc-card');
    window.__R = (s) => __pc() && __pc().shadowRoot.querySelector(s); window.__A = (s) => (__pc() ? [...__pc().shadowRoot.querySelectorAll(s)] : []);
  });
  return { p, ctx, errs };
}
const tabs = ['oversikt', 'klima', 'energi', 'sikkerhet', 'enheter', 'apper'];
for (const W of [1280, 1920]) {
  const { p, ctx, errs } = await page(W, 'pc');
  ok(`${W}: PC-dashbordet vises med 'pc'`, await p.evaluate(() => !!__pc() && !!__R('.hero') && !!__R('nav.tabs')));
  for (const t of tabs) {
    await p.evaluate((t) => __R(`.tb[data-v="${t}"]`).click(), t); await sleep(400);
    const X = await p.evaluate(() => {
      const cards = __A('.card, .app'), over = cards.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.dataset.key || c.textContent.slice(0, 20));
      const clip = __A('.card *').filter((e) => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'hidden').map((e) => e.textContent.trim());
      return { n: cards.length, over, clip, h1: __R('.ttl h1').textContent };
    });
    ok(`${W}: fanen ${t} har innhold uten avkuttet/overlappende tekst`, X.n > 0 && !X.over.length && !X.clip.length, X);
    if (shots && W === 1280) await p.screenshot({ path: `${shots}/v8-${t}.png`, fullPage: true });
  }
  ok(`${W}: ingen sidefeil`, !errs.length, errs);
  await ctx.close();
}
{
  const { p, ctx } = await page(900, 'pc');
  ok('900 px med pc: mobilvisningen', await p.evaluate(() => !__pc() && !!__hj.shadowRoot.querySelector('.g.mob')));
  await ctx.close();
}
{
  const { p, ctx } = await page(1440, null);
  ok('1440 px uten valg: mobilvisningen', await p.evaluate(() => !__pc()));
  await p.evaluate(async () => { MSH.pc.set('pc'); await new Promise((r) => setTimeout(r, 500)); });
  ok('MSH.pc.set(pc) bytter til PC-dashbordet', await p.evaluate(() => !!__pc()));
  // bredde
  const r = await p.evaluate(() => __R('.hw').getBoundingClientRect());
  await p.mouse.move(r.x + 7, r.y + 300); await p.mouse.down(); await p.mouse.move(r.x + 107, r.y + 300, { steps: 5 }); await p.mouse.up(); await sleep(300);
  const w1 = await p.evaluate(() => [Math.round(__R('.hero').getBoundingClientRect().width), localStorage.getItem('ki-pc-bredde')]);
  ok('helt-panelet dras bredere og lagres', w1[1] === '580' && w1[0] === 580, w1);
  await p.evaluate(() => __R('.hw').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await sleep(300);
  ok('dobbeltklikk nullstiller til 480', await p.evaluate(() => localStorage.getItem('ki-pc-bredde') === '480' && Math.round(__R('.hero').getBoundingClientRect().width) === 480));
  // søk
  await p.evaluate(() => __R('[data-act="search"]').click()); await sleep(300);
  const S = await p.evaluate(async () => { const r = MSH.portals().pop().shadowRoot, i = r.querySelector('[data-q]'); const all = r.querySelectorAll('.hit').length; i.value = 'zzzz'; i.dispatchEvent(new Event('input')); const none = !!r.querySelector('.no'); i.value = 'klima'; i.dispatchEvent(new Event('input')); return { all, none, hit: r.querySelector('.hit .hn').textContent, focus: r.activeElement === i }; });
  ok('søk: treff, «Ingen treff», filtrering og fokus', S.all > 3 && S.none && S.hit === 'Klima' && S.focus, S);
  await p.keyboard.press('Escape'); await sleep(300);
  // Tilpass: toggles
  await p.evaluate(() => __R('[data-act="tilpass"]').click()); await sleep(300);
  await p.evaluate(() => __R('.tb[data-v="oversikt"]').click()); await sleep(100);
  const T = await p.evaluate(async () => { const r = MSH.portals().pop().shadowRoot; const rows = [...r.querySelectorAll('.mr b')].map((x) => x.textContent); r.querySelector('.kr[data-k="fukt"]').click(); await new Promise((q) => setTimeout(q, 300)); return { rows, lang: r.querySelectorAll('.lang [data-ta="lang"]').length, ls: localStorage.getItem('ki-pc-kort'), fukt: !!__R('[data-key="pc-fukt"]') }; });
  ok('Tilpass: meny + «Kort i oversikten» skjuler kort og lagres', T.rows.length === 4 && T.lang === 2 && T.ls === '{"fukt":true}' && !T.fukt, T);
  await p.keyboard.press('Escape'); await sleep(300);
  // Analyse
  await p.evaluate(() => __R('[data-act="ana"]').click()); await sleep(600);
  const A = await p.evaluate(async () => { const r = MSH.portals().pop().shadowRoot; const n0 = [...r.querySelectorAll('.pp')].map((x) => x.textContent); r.querySelector('.pp[data-v="0"]').click(); await new Promise((q) => setTimeout(q, 300)); return { n0, on: r.querySelector('.pp.on').textContent, ch: [...r.querySelectorAll('.ch')].map((c) => c.dataset.n) }; });
  ok('Analyse: periodene og bytte til 7 dager', A.n0.join() === '7 dager,30 dager,90 dager,1 år' && A.on === '7 dager' && A.ch.every((n) => n === '7'), A);
  await p.keyboard.press('Escape'); await sleep(300);
  // Tilbake til mobil
  await p.evaluate(async () => { MSH.pc.set('mobil'); await new Promise((r) => setTimeout(r, 500)); });
  ok('«Dashbord på PC» → mobil gir mobilvisningen', await p.evaluate(() => !__pc()));
  await ctx.close();
}
{
  const { p, ctx, errs } = await page(1440, 'pc');
  await p.evaluate(async () => { kiSetLang('en'); await new Promise((r) => setTimeout(r, 600)); });
  const NO = /\b(Oversikt|Klima|Energi|Sikkerhet|Enheter|Rom og apper|Temperatur i huset|Luftfuktighet|Hjemmescore|Strøm i dag|Luftkvalitet|Hvem er hjemme|Tilpass|Analyser|I dag|Hele huset|Endre|Klimaoversikt)\b/;
  const left = [];
  for (const t of tabs) { await p.evaluate((t) => __R(`.tb[data-v="${t}"]`).click(), t); await sleep(400); const txt = await p.evaluate(() => { const c = __R('.wrap').cloneNode(true); c.querySelectorAll('[data-noi18n]').forEach((e) => e.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; }); const m = txt.match(NO); if (m) left.push(t + ':' + m[0] + ' @ ' + txt.slice(Math.max(0, txt.indexOf(m[0]) - 40), txt.indexOf(m[0]) + 30)); }
  ok('engelsk: ingen norske hovedord igjen', !left.length, left);
  await p.evaluate(() => kiSetLang('no'));
  ok('engelsk: ingen sidefeil', !errs.length, errs);
  await ctx.close();
}
await b.close();
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - bad}/${res.length} OK`);
process.exit(bad ? 1 : 0);
