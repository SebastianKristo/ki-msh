// Fiks 23.1: person-hurtigarket (Hjemme/Borte · Våken/Sover) – avataren (96, top −48, ring) vises alltid helt, arket
// ligger i ki-overlay-root (ingen transform/overflow/contain over seg), innenfor dashbordflaten og ledig flate
// (--ki-nav-occ-*, 23.3), dekkes ikke av navbaren eller HA-sidebaren; lav skjerm → innholdet under navnet scroller.
// Enheter: telefon, liggende telefon, Pixel Fold lukket/åpen, PC med HA-sidebar.
// Kjør: node test/fiks23-person-check.mjs   (SHOT_DIR=… for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f23p-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOT = process.env.SHOT_DIR;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);

const DEV = [
  ['telefon', { width: 390, height: 844 }, true, 0],
  ['telefon liggende', { width: 844, height: 390 }, true, 0],
  ['telefon liggende lav', { width: 740, height: 340 }, true, 0],
  ['Fold lukket', { width: 412, height: 892 }, true, 0],
  ['Fold åpen', { width: 840, height: 880 }, true, 0],
  ['PC + HA-sidebar', { width: 1440, height: 900 }, false, 256],
];
for (const [name, vp, touch, sb] of DEV) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const persons = await p.evaluate(async (sb) => {
    if (sb) document.documentElement.style.setProperty('--sb', sb + 'px');
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    const h = window.mockHass(); window.__h = h;
    const d = document.getElementById('dash');
    const c = document.createElement('msh-hjem-card');
    c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); c.hass = h; d.appendChild(c);
    const n = document.createElement('msh-navbar-card');
    n.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', mini: { on: false } }); n.hass = h; d.appendChild(n);
    await new Promise((q) => setTimeout(q, 1200));
    return Object.keys(h.states).filter((k) => k.startsWith('person.'));
  }, sb);
  ok(`${name}: fant personer`, persons.length > 0, persons);
  let first = true;
  for (const pid of persons) {
    const m = await p.evaluate(async (pid) => {
      const H = deepAll('msh-hjem-header-card').find((e) => e.getBoundingClientRect().width > 0) || deepAll('msh-hjem-header-card')[0];
      const sheet = H._quick(pid);
      await new Promise((q) => setTimeout(q, 600));
      const host = sheet.ov.host, sr = sheet.ov.root, sh = sr.querySelector('.sh'), orb = sr.querySelector('.orb'), nm = sr.querySelector('.nm'), scr = sr.querySelector('.scr');
      const R = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
      const dash = document.getElementById('dash').getBoundingClientRect(), occ = MSH.navOcc();
      const navEl = deepAll('nav.nb')[0], nav = navEl ? R(navEl) : null;
      // Ingen forelder med transform/filter/contain/overflow mellom arket og document.body
      const chain = []; let n = host;
      while (n && n !== document.body) { const cs = getComputedStyle(n); chain.push({ tag: n.tagName, tf: cs.transform, fi: cs.filter, ct: cs.contain, ov: cs.overflow }); n = n.parentNode && n.parentNode.host ? n.parentNode.host : n.parentNode; }
      const bad = chain.filter((x) => x.tf !== 'none' || x.fi !== 'none' || (x.ct !== 'none' && x.ct !== '') || (x.ov !== 'visible' && x.ov !== ''));
      const scs = getComputedStyle(sh);
      const o = R(orb), cx = (o.l + o.r) / 2;
      // Hit-test øverst i avataren og ringen (klippet → treffer ikke orb)
      const hitTop = sr.elementFromPoint(cx, o.t + 2), hitOrb = !!hitTop && (hitTop === orb || orb.contains(hitTop));
      const out = { sh: R(sh), orb: o, nm: R(nm), nav, occ, dash: { l: Math.round(dash.left), t: Math.round(Math.max(0, dash.top)), r: Math.round(dash.right), b: innerHeight },
        shOverflow: scs.overflow, shContain: scs.contain, bad, hitOrb, scr: scr ? { sh: scr.scrollHeight, ch: scr.clientHeight, ov: getComputedStyle(scr).overflowY } : null,
        doneH: Math.round(sr.querySelector('.done').getBoundingClientRect().height), inRoot: !!host.closest && host.parentNode && host.getRootNode().host && host.getRootNode().host.localName === 'ki-overlay-root' };
      // Rull innholdet under navnet: navnet og avataren står i ro
      if (scr && scr.scrollHeight > scr.clientHeight + 1) { const nt = nm.getBoundingClientRect().top; scr.scrollTop = 999; out.scrolled = scr.scrollTop > 0; out.nmStill = Math.abs(nm.getBoundingClientRect().top - nt) < 1; out.doneVis = (() => { const d = sr.querySelector('.more').getBoundingClientRect(), s2 = scr.getBoundingClientRect(); return d.bottom <= s2.bottom + 1; })(); }
      window.__sheet = sheet;
      return out;
    }, pid);
    if (SHOT && first) await p.screenshot({ path: `${SHOT}/f23-person-${name.replace(/\W+/g, '_')}.png` });
    first = false;
    const ringTop = m.orb.t - 6; // ringen (box-shadow 4 + 2 px) utenfor 96 px-bildet
    const L = m.dash.l + m.occ.left, Rr = m.dash.r - m.occ.right, T = m.dash.t + m.occ.top, B = m.dash.b - m.occ.bottom;
    const tag = `${name} · ${pid}`;
    ok(`${tag}: i ki-overlay-root, ingen transform/filter/contain/overflow over arket`, m.inRoot && !m.bad.length, m.bad);
    ok(`${tag}: arket klipper ikke (overflow visible, contain none)`, m.shOverflow === 'visible' && (m.shContain === 'none' || m.shContain === ''), { o: m.shOverflow, c: m.shContain });
    ok(`${tag}: avataren 96×96, 48 px over arket, helt synlig (hit-test øverst)`, m.orb.w === 96 && m.orb.h === 96 && Math.abs(m.orb.t - (m.sh.t - 48)) <= 1 && m.hitOrb, { orb: m.orb, sh: m.sh, hit: m.hitOrb });
    ok(`${tag}: avatar + ring innenfor dashbordet og under navbaren/toppen`, ringTop >= Math.max(0, T), { ringTop, T });
    ok(`${tag}: arket innenfor ledig flate (venstre/høyre/bunn, ikke over HA-sidebaren)`, m.sh.l >= L && m.sh.r <= Rr && m.sh.b <= B && m.sh.l >= m.dash.l, { sh: m.sh, L, Rr, B, occ: m.occ });
    ok(`${tag}: dekkes ikke av navbaren`, !m.nav || m.nav.r <= m.sh.l || m.nav.l >= m.sh.r || m.nav.b <= ringTop || m.nav.t >= m.sh.b, { nav: m.nav, sh: m.sh });
    ok(`${tag}: knappene krymper ikke (Ferdig 52 px)`, m.doneH === 52, m.doneH);
    ok(`${tag}: bredde 300 (eller 100 % − 40)`, m.sh.w === 300 || m.sh.w <= Rr - L - 40, m.sh.w);
    if (m.scr && m.scr.sh > m.scr.ch + 1) ok(`${tag}: lav skjerm – innholdet under navnet scroller, navnet/avataren står`, m.scr.ov === 'auto' && m.scrolled && m.nmStill && m.doneVis, m);
    if (name.includes('liggende')) ok(`${tag}: liggende – innholdet scroller (lav skjerm)`, m.scr && m.scr.sh > m.scr.ch + 1, m.scr);
    await p.evaluate(async () => { window.__sheet.ov.close(); await new Promise((q) => setTimeout(q, 300)); });
  }
  ok(`${name}: ingen sidefeil`, !errs.length, errs);
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
