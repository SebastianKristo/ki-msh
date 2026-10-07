// Fiks 31.3 · Vær · «Neste timer»: samme høyde i Temperatur, Nedbør og Vind (0 px forskjell), timekolonnene 152 px
// (box-sizing: border-box), faste px-høyder, vindgrafen absolutt nederst, ingen høydeanimasjon ved fanebytte.
// Kjøres på 390 px og 1280 px, med ulike font-fallbacker og line-height (etterligner ulik fontmetrikk i iOS WebKit og
// Chrome) – og i WebKit hvis Playwright har den installert.   node test/vaer31-check.mjs   (SHOTS=<mappe>)
// Uavhengig av dato/klokkeslett.
import { createRequire } from 'node:module';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/vaer31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

const browsers = [['Chromium', await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })]];
try {
  const wk = pw.webkit.executablePath && pw.webkit.executablePath();
  if (wk && existsSync(wk)) browsers.push(['WebKit', await pw.webkit.launch()]);
} catch (e) { /* WebKit er ikke installert */ }
if (browsers.length === 1) console.log('(Playwright WebKit finnes ikke i /opt/pw-browsers – Chromium med ulike font-fallbacker/line-height i stedet)');

// font-varianter: ulik fallback og fontmetrikk på dokumentnivå (arves inn i kortets shadow DOM)
const FONTS = [['standard', ''], ['serif', 'html,body,#dash{font-family:"DejaVu Serif",Georgia,serif!important}'], ['mono · line-height 2', 'html,body,#dash{font-family:monospace!important;line-height:2!important}'], ['system-ui · 1.15', 'html,body,#dash{font-family:-apple-system,system-ui,sans-serif!important;line-height:1.15!important}']];

for (const [bn, b] of browsers) {
  for (const vp of [{ width: 390, height: 900, tag: '390' }, { width: 1280, height: 900, tag: 'PC' }]) {
    for (const [fn, css] of FONTS) {
      if (vp.tag === 'PC' && fn !== 'standard') continue;
      const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
      p.on('pageerror', (e) => errs.push(`${bn}: ${e.message}`));
      await p.goto('file://' + resolve('test/harness.html'));
      if (css) await p.addStyleTag({ content: css });
      for (const m of mocks) await p.addScriptTag({ path: m });
      await p.addScriptTag({ path: bundle });
      const R = await p.evaluate(async () => {
        const w = (ms) => new Promise((q) => setTimeout(q, ms));
        const h = window.mockHass();
        const bc = document.createElement('bubble-card');
        bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
        bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container"></div></div>';
        document.getElementById('dash').appendChild(bc);
        location.hash = '#vaer';
        const c = document.createElement('msh-vaer-card');
        c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer-31', anim: false });
        c.hass = h;
        bc.querySelector('.inner').appendChild(c);
        await w(900);
        const sr = c.shadowRoot;
        const meas = () => {
          const card = sr.querySelector('.hcard'), cols = [...sr.querySelectorAll('.hcard .hc')], sc = sr.querySelector('.hcard .hsc'), nxt = card && card.closest('[data-sec]') && card.closest('[data-sec]').nextElementSibling;
          const cs = cols[0] ? getComputedStyle(cols[0]) : {};
          const wch = sr.querySelector('.hcard .wch'), hin = sr.querySelector('.hcard .hin');
          const overflow = cols.some((col) => [...col.children].some((x) => x.getBoundingClientRect().bottom > col.getBoundingClientRect().bottom + 0.5));
          return {
            metric: card && card.dataset.metric, card: card ? card.getBoundingClientRect().height : 0, sc: sc ? sc.getBoundingClientRect().height : 0, n: cols.length,
            colH: [...new Set(cols.map((x) => Math.round(x.getBoundingClientRect().height * 100) / 100))], box: cs.boxSizing, next: nxt ? nxt.getBoundingClientRect().top - card.getBoundingClientRect().top : null,
            // høyde-overgang = transition-property height/all med varighet > 0 (standardverdien «all 0s» er ingen animasjon)
            trans: [card, sc, card && card.closest('[data-sec]')].filter(Boolean).some((x) => { const cs = getComputedStyle(x), P = cs.transitionProperty.split(','), D = cs.transitionDuration.split(','); return P.some((pp, i) => /height|all/.test(pp) && parseFloat(D[i % D.length]) > 0); }), spacer: !!sr.querySelector('.hcard .hwsp'), overflow,
            wch: wch && hin ? { pos: getComputedStyle(wch).position, h: Math.round(wch.getBoundingClientRect().height), gap: Math.round(hin.getBoundingClientRect().bottom - wch.getBoundingClientRect().bottom) } : null,
            pct: cols[0] ? [...sr.querySelectorAll('.hcard *')].some((x) => /%$/.test(x.style.height || '') && !x.classList.contains('rf')) : false,
          };
        };
        const out = {};
        const anim = [];
        for (const k of ['temp', 'rain', 'wind', 'temp']) {
          const btn = sr.querySelector(`.hcard .mb[data-k="${k}"]`);
          if (btn && !btn.classList.contains('on')) {
            btn.click();
            // høyden rett etter byttet (ingen animasjon: samme som etter 400 ms)
            await w(20); anim.push(sr.querySelector('.hcard').getBoundingClientRect().height);
            await w(400); anim.push(sr.querySelector('.hcard').getBoundingClientRect().height);
          }
          out[k + (out[k] ? '2' : '')] = meas();
        }
        out.anim = anim;
        return out;
      });
      const T = `${bn} ${vp.tag} · ${fn}`;
      const hs = ['temp', 'rain', 'wind', 'temp2'].map((k) => R[k].card), nx = ['temp', 'rain', 'wind'].map((k) => R[k].next);
      ok(`${T}: «Neste timer» har samme høyde i Temperatur, Nedbør og Vind (0 px forskjell)`, R.temp.n > 0 && Math.max(...hs) - Math.min(...hs) === 0 && new Set(nx).size === 1, { hs, nx });
      ok(`${T}: alle timekolonner er 152 px (border-box) i alle tre fanene, innholdet går ikke utenfor`, ['temp', 'rain', 'wind'].every((k) => R[k].colH.length === 1 && R[k].colH[0] === 152 && R[k].box === 'border-box' && !R[k].overflow) && R.temp.sc === 152, ['temp', 'rain', 'wind'].map((k) => [k, R[k].colH, R[k].box, R[k].overflow, R[k].sc]));
      ok(`${T}: Vind – grafen (58 px) ligger absolutt nederst i scrollraden, ingen 58 px-spacer i kolonnen`, R.wind.metric === 'wind' && R.wind.wch && R.wind.wch.pos === 'absolute' && R.wind.wch.h === 58 && R.wind.wch.gap === 0 && !R.wind.spacer, R.wind);
      ok(`${T}: ingen høydeanimasjon ved fanebytte (samme høyde 20 ms og 400 ms etter), ingen prosent-høyder`, R.anim.length >= 4 && Math.max(...R.anim) - Math.min(...R.anim) === 0 && !R.temp.trans && !R.temp.pct, { anim: R.anim, trans: R.temp.trans });
      if (shots) {
        for (const k of ['temp', 'rain', 'wind']) {
          await p.evaluate((k) => { const sr = document.querySelector('msh-vaer-card').shadowRoot; const b = sr.querySelector(`.hcard .mb[data-k="${k}"]`); if (b && !b.classList.contains('on')) b.click(); }, k);
          await p.waitForTimeout(300);
          const box = await p.evaluate(() => { const r = document.querySelector('msh-vaer-card').shadowRoot.querySelector('.hcard').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height + 30 }; });
          await p.evaluate((y) => window.scrollTo(0, 0), 0);
          await p.screenshot({ path: `${shots}/vaer31-${bn}-${vp.tag}-${fn.replace(/[^a-z0-9]+/gi, '_')}-${k}.png`, clip: box });
        }
      }
      await p.close();
    }
  }
  await b.close();
}

ok('ingen sidefeil', !errs.length, errs);
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
