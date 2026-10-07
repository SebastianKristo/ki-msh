// «Sjekk før levering» per popup – mot EKTE Bubble Card (lastes ned til test/.vendor ved første kjøring).
// Popupene hentes fra examples/dashboard.yaml. Kjøres på mobil (390 px) og PC (1400 px, 256 px HA-sidebar).
//   node test/checklist.mjs [navnefilter]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
mkdirSync('test/shots', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/checklist-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { stdio: 'inherit' });
const popups = JSON.parse(execFileSync('python3', ['-c', "import yaml,json,sys;d=yaml.safe_load(open('examples/dashboard.yaml'));print(json.dumps([c for s in d['views'][0]['sections'] for c in s['cards'] if c.get('card_type')=='pop-up']))"]).toString());
const navbarCfg = JSON.parse(execFileSync('python3', ['-c', "import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));print(json.dumps([c for s in d['views'][0]['sections'] for c in s['cards'] if c['type']=='custom:msh-navbar-card'][0]))"]).toString());
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => resolve('test/mock/' + f));
const only = process.argv[2];

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const rows = [];
let fails = 0;
for (const vp of [{ n: 'mobil', w: 390, h: 844, sb: 0 }, { n: 'PC', w: 1400, h: 900, sb: 256 }]) {
  for (const pop of popups) {
    if (only && !pop.name.includes(only) && !pop.hash.includes(only)) continue;
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to load resource|Failed to fetch/.test(m.text())) errors.push(m.text().slice(0, 160)); });
    await page.goto('file://' + resolve('test/harness-bubble.html'));
    for (const m of mocks) await page.addScriptTag({ path: m });
    await page.addScriptTag({ path: bundle });
    await page.addScriptTag({ path: BC, type: 'module' });
    await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
    const r = await page.evaluate(async ({ pop, vp, navbarCfg }) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      document.documentElement.style.setProperty('--sb', vp.sb + 'px');
      const hass = window.mockHass();
      const dash = document.getElementById('dash');
      // navbar som eget kort utenfor popupen
      const nav = document.createElement('msh-navbar-card'); nav.setConfig(navbarCfg); nav.hass = hass; dash.appendChild(nav);
      const bc = document.createElement('bubble-card');
      bc.setConfig(pop); bc.hass = hass; dash.appendChild(bc);
      await wait(400);
      let hapt = 0; window.addEventListener('haptic', () => hapt++);
      const deepAll = () => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
      const popEl = () => deepAll().find((e) => e.classList && e.classList.contains('bubble-pop-up'));
      const res = {};
      // 1. åpnes via hash
      location.hash = pop.hash;
      await wait(1200);
      const P = popEl();
      res.opens = !!P && P.classList.contains('is-popup-opened');
      // 2. Bubble-header synlig (navn + lukk-knapp)
      const all = deepAll();
      const header = all.find((e) => e.classList && e.classList.contains('bubble-header-container'));
      const closeBtn = all.find((e) => e.classList && (e.classList.contains('bubble-close-button') || e.classList.contains('close-pop-up')));
      res.header = !!header && header.getBoundingClientRect().height > 0 && (header.textContent || '').includes(pop.name) && !!closeBtn;
      // Fiks 20.22 · unntak: fullskjerm-popup uten Bubble-header (show_header: false, #kart) – kortets egen × i stedet
      const ownX = () => { const k = all.find((e) => /^msh-.*-card$/.test(e.localName) && e.localName !== 'msh-navbar-card'); return k && k.shadowRoot && k.shadowRoot.querySelector('[data-act="close"]'); };
      if (pop.show_header === false) res.header = (!header || header.getBoundingClientRect().height === 0) && !!ownX() ? 'skjult · egen ×' : false;
      // 3. kort + bredde
      const cards = all.filter((e) => /^msh-.*-card$/.test(e.localName) && e.localName !== 'msh-navbar-card' && !/^msh-/.test(((e.getRootNode() || {}).host || {}).localName || ''));
      const cont = all.find((e) => e.classList && e.classList.contains('bubble-pop-up-container'));
      const ccs = cont && getComputedStyle(cont); const cw = cont ? cont.clientWidth - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight) : 0;
      res.cards = cards.map((c) => c.localName.replace(/^msh-|-card$/g, '')).join('+');
      res.width = cards.length === pop.cards.length && cards.every((c) => Math.abs(c.getBoundingClientRect().width - cw) <= 1) ? `ok ${Math.round(cw)}` : `FEIL ${cards.map((c) => Math.round(c.getBoundingClientRect().width)).join('/')} av ${Math.round(cw)}`;
      // 4. toppkort synlig (første kort har høyde og ligger i visningen)
      const first = cards[0] && cards[0].getBoundingClientRect();
      res.top = !!first && first.height > 40 && first.top < innerHeight;
      const heroTag = (window.MSH.HEROES || {})[cards[0] && cards[0].localName];
      // Fiks 26.24: Vær i stilen «scene» har værscene-toppen (.snw) som toppkort i stedet for msh-vaer-hero-card
      if (heroTag && cards[0].hasAttribute('data-scene')) { const sn = cards[0].shadowRoot.querySelector('.snw'); const sr = sn && sn.getBoundingClientRect(); res.top = res.top && !!sr && sr.height > 40 && sr.top < innerHeight; }
      else if (heroTag) { const he = cards[0].shadowRoot.querySelector('.msh-hero-slot > ' + heroTag); const hr = he && he.getBoundingClientRect(); res.top = res.top && !!hr && hr.height > 40 && Math.abs(hr.top - first.top) < 2; }
      res.oneCard = (pop.cards || []).length === 1;
      const bn = all.find((e) => e.classList && e.classList.contains('bubble-name') && e.getBoundingClientRect().height > 0);
      const ic = all.find((e) => e.classList && e.classList.contains('icon-container') && e.getBoundingClientRect().height > 0);
      const isRoom = /^#(stue|kjokken)/.test(pop.hash);
      res.mal = pop.show_header === false ? 'A fullskjerm' : isRoom ? (ic && getComputedStyle(ic).backgroundColor !== 'rgba(0, 0, 0, 0)' ? 'B' : 'B?') : (bn && getComputedStyle(bn).fontSize === '30px' ? 'A' : 'A? ' + (bn && getComputedStyle(bn).fontSize));
      // 5. ikoner som ikoner
      const txt = cards.map((c) => c.shadowRoot.textContent.replace(/<style[\s\S]*?<\/style>/g, '')).join(' ').replace(/\{[^}]*\}/g, '');
      const icons = cards.flatMap((c) => [...c.shadowRoot.querySelectorAll('ha-icon')]);
      res.icons = !/\b(mdi|hass|phu|hue|fapro|si):[a-z]/.test(txt) && icons.every((i) => i.getAttribute('data-ok') === '1') ? `ok ${icons.length}` : 'FEIL';
      // 6. autokonfig: ingen kortfeil, minst ett kort med innhold utover tom-tilstand
      res.auto = !/Feil i kortet|kortet feilet/.test(txt) && cards.some((c) => c.shadowRoot.querySelectorAll('[data-act]:not([data-act="customize"]), [data-ent]').length > 0);
      // 7. haptic på trykk (første handlingsknapp i kortene)
      const btn = cards.map((c) => c.shadowRoot.querySelector('[data-act]:not([data-act="customize"])')).find(Boolean);
      if (btn) { btn.click(); await wait(80); }
      res.haptic = btn ? hapt >= 1 : 'ingen knapp';
      if (location.hash !== pop.hash) { location.hash = pop.hash; await wait(600); }
      // 8. drag lukker ikke popupen: pointerdown/touchmove på dra-elementer skal ikke nå popupen
      let leaked = 0;
      const spy = () => leaked++;
      ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => P && P.addEventListener(t, spy));
      // Fiks 56 G: retningslås-flater (MSH.dirLock / MSH.hScroll) slipper bevisst vertikale gester (popupen skal scrolle) – testes i scroll56-check
      const drags = cards.flatMap((c) => [...c.shadowRoot.querySelectorAll('*')].filter((e) => !e.__mshDL && !e.__mshHS && (e.__mshGuard || e.__mshSc || !['auto', 'manipulation'].includes(getComputedStyle(e).touchAction))));
      const leakers = [];
      // 56 G: flater merket __mshVPass (Vær-flisene: hold for å flytte, ellers vertikal scroll) slipper touch bevisst –
      // for dem sjekkes bare at pointerdown stoppes (løftet flis/touchmove under dra testes i vaer-sjekkene)
      const vpass = (e) => { for (let n = e; n; n = n.parentElement) if (n.__mshVPass) return true; return false; };
      for (const d of drags.slice(0, 20)) {
        const l0 = leaked;
        const rr = d.getBoundingClientRect(); const x = rr.left + rr.width / 2, y = rr.top + rr.height / 2;
        d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 9 }));
        if (!vpass(d)) try { const t = new Touch({ identifier: 9, target: d, clientX: x, clientY: y + 30 }); d.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [t] })); d.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t] })); } catch (e) { /* */ }
        d.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 9 }));
        if (leaked > l0) leakers.push(`${d.localName}${d.className && typeof d.className === 'string' ? '.' + d.className.trim().split(/\s+/).join('.') : ''}[${getComputedStyle(d).touchAction}]×${leaked - l0}`);
      }
      res.leakDbg = leakers.slice(0, 8).join(' ');
      ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => P && P.removeEventListener(t, spy));
      await wait(100);
      res.drag = drags.length ? (leaked === 0 && location.hash === pop.hash ? `ok ${Math.min(drags.length, 20)}` : `LEKK ${leaked}`) : 'ingen drag';
      // 9. navbar dekker ikke HA-sidebaren
      const np = document.querySelector('.msh-navbar-portal');
      const nv = np && np.shadowRoot && np.shadowRoot.querySelector('[data-nav]');
      const nr = nv && nv.getBoundingClientRect();
      res.navDbg = nr ? `x ${Math.round(nr.left)} b ${Math.round(nr.width)} h ${Math.round(nr.height)}` : '';
      // Fiks 18.7: PC = Fold-oppsettet → vertikal navbar (rail); popupen sentreres på innholdsflaten og dekker ikke railen
      const railOk = vp.w > 800 ? nv.classList.contains('rail') && !!P && P.getBoundingClientRect().left >= nr.right - 1 && Math.abs((P.getBoundingClientRect().left + P.getBoundingClientRect().right) / 2 - (vp.sb + 120 + vp.w) / 2) < 2 : !nv.classList.contains('rail');
      // Fiks 57 C: navbaren (og Now Playing) er bevisst skjult i popups fra hide_in_popups (standard #vaer, data-hidden på
      // portalen) – da kreves ikke synlig navbar/rail, men den skal være usynlig og ikke klikkbar, og popupen (Vær fullskjerm,
      // 56 I) skal ligge innenfor dashbordflaten og aldri over HA-sidebaren.
      const hidNav = !!(np && np.hasAttribute('data-hidden'));
      if (hidNav) {
        const pr = P && P.getBoundingClientRect(), ns = getComputedStyle(nv);
        const inv = Number(ns.opacity) === 0 && ns.pointerEvents === 'none';
        const inside = !!pr && pr.width > 0 && pr.left >= vp.sb - 1 && pr.right <= vp.w + 1;
        res.navDbg = `${res.navDbg} · popup ${pr ? Math.round(pr.left) + '–' + Math.round(pr.right) : '–'} op ${ns.opacity} pe ${ns.pointerEvents}`;
        res.navbar = inv && inside ? `ok (skjult i ${pop.hash}, popup x=${Math.round(pr.left)}–${Math.round(pr.right)})` : !inside ? 'FEIL popup utenfor dashbordflaten / over sidebaren' : 'FEIL skjult navbar er synlig/klikkbar';
      } else res.navbar = nr && nr.width > 0 ? (nr.left >= vp.sb - 1 && nr.right <= vp.w + 1 && railOk ? `ok (${vp.w > 800 ? 'rail' : 'bunn'} x=${Math.round(nr.left)})` : railOk ? 'DEKKER' : `FEIL ${vp.w > 800 ? 'ikke rail / popup over railen' : 'rail på mobil'}`) : 'ikke funnet';
      // 10. GUI-editor (Bubble «Legg til kort») + speiling mot kortets egen editor
      const eds = [];
      for (const c of cards) {
        try {
          const ed = c.constructor.getConfigElement();
          ed.hass = hass; ed.setConfig(c._rawConfig); document.body.appendChild(ed);
          await wait(40);
          let got = null; ed.addEventListener('config-changed', (e) => { got = e.detail.config; });
          const ctl = ed.shadowRoot.querySelector('[data-a="sel"],[data-a="bool"]');
          if (ctl) ctl.click();
          await wait(40);
          let mirror = 'ok';
          if (got) {
            c.setConfig(got); await wait(60);
            if (/Feil i kortet|kortet feilet/.test(c.shadowRoot.textContent)) mirror = 'render-feil';
            // kortets egen tilpasning skal vise samme config
            const before = window.MSH.portals().length;
            c.customize();
            await wait(80);
            const portals = window.MSH.portals();
            const inner = portals.length > before ? [...portals[portals.length - 1].shadowRoot.querySelector('.body').children].find((e) => e.localName !== 'msh-scope-bar') : null; // enhetsvelgeren ligger øverst
            if (!inner || !inner._config || JSON.stringify(inner._config) !== JSON.stringify(got)) mirror = 'ulik';
            portals.forEach((p) => p.remove());
          }
          eds.push(got ? (got.card_id ? mirror : 'mangler card_id') : (ctl ? 'ingen endring' : 'ok'));
          ed.remove();
        } catch (e) { eds.push('FEIL ' + e.message); }
      }
      res.editor = eds.every((x) => x === 'ok') ? 'ok' : eds.join(',');
      // 11. lukk-knapp og tilbake
      location.hash = pop.hash; await wait(500);
      const cb = pop.show_header === false ? ownX() : deepAll().find((e) => e.classList && (e.classList.contains('bubble-close-button') || e.classList.contains('close-pop-up')));
      if (cb) cb.click();
      await wait(900);
      const P2 = popEl();
      res.close = location.hash !== pop.hash && !(P2 && P2.classList.contains('is-popup-opened'));
      location.hash = pop.hash; await wait(800);
      history.back(); await wait(900);
      const P3 = popEl();
      res.back = location.hash !== pop.hash && !(P3 && P3.classList.contains('is-popup-opened'));
      return res;
    }, { pop, vp, navbarCfg });
    if (process.env.SHOT) {
      await page.evaluate((h) => { location.hash = h; }, pop.hash); await page.waitForTimeout(900);
      await page.screenshot({ path: `test/shots/check-${vp.n}-${pop.hash.slice(1)}.png` });
    }
    const ok = r.opens && r.header && r.width.startsWith('ok') && r.top && r.icons.startsWith('ok') && r.auto && r.haptic !== false && !String(r.drag).startsWith('LEKK') && r.navbar.startsWith('ok') && r.editor === 'ok' && r.close && r.back && r.oneCard && !String(r.mal).includes('?') && !errors.length;
    if (!ok) fails++;
    rows.push({ vp: vp.n, pop: `${pop.name} ${pop.hash}`, ...r, errors: errors.slice(0, 2).join(' | '), ok });
    await page.close();
  }
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
const yn = (v) => (v === true ? 'ja' : v === false ? 'NEI' : v);
const lines = rows.map((r) => `| ${r.ok ? '✔' : '✘'} | ${r.vp} | ${r.pop} | ${yn(r.opens)} | ${r.width} | ${yn(r.header)} | ${yn(r.top)} | ${yn(r.close)} / ${yn(r.back)} | ${yn(r.haptic)} | ${r.drag} | ${r.navbar} | ${r.icons} | ${yn(r.auto)} | ${r.editor} | ${r.oneCard ? '1' : 'FLERE'} · mal ${r.mal} |${!r.navbar.startsWith('ok') ? ' ' + r.navDbg : ''}${String(r.drag).startsWith('LEKK') ? ' lekk: ' + r.leakDbg : ''}${r.errors ? ' ' + r.errors : ''}`);
const table = ['| | Visning | Popup | Åpnes via hash | Fyller bredden | Bubble-header | Toppkort | Lukk / tilbake | Haptic | Drag lukker ikke | Navbar ≠ sidebar | Ikoner | Autokonfig | GUI-editor ↔ egen editor | Kort · Bubble-mal |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...lines].join('\n');
console.log(table);
if (!only) writeFileSync('docs/sjekkliste.md', `# Sjekk før levering – resultat\n\nGenerert av \`node test/checklist.mjs\` mot ekte Bubble Card (${new Date().toISOString().slice(0, 10)}), med mock-hass fra \`test/\`. Popupene er de i \`examples/dashboard.yaml\`.\n\n${table}\n`);
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
