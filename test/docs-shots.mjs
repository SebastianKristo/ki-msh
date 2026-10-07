// Dokumentasjonsbilder: Hjem + popupene fra strategien (custom:ki-dashboard; alle funksjons-popups, rommene i DOC_ROOMS og
// personen i DOC_PERSONS) mot ekte Bubble Card og mock-hass (+ __docsData: ingen ekte navn, emoji-avatarer, header i
// «Stor hilsen»), i iPhone-ramme (390×844 @3x) og PC-vindu (1440×900), på en myk bakgrunn i My SmartHome-paletten.
//   npm run shots                  → docs/images/iphone/<popup>.webp, docs/images/pc/<popup>.webp + README-bildene
//   node test/docs-shots.mjs vaer  → bare popups som matcher filteret (hash/navn)
//   DEVICES=iphone|pc              → bare én enhet
// Ikoner: ekte MDI-stier (test/.vendor/mdi.js, lastes ned første gang). Fonter: Google Fonts via curl-cache.
// Flyt per bilde: skjermbilde av dashbordet → rammeside (data-URL inni rammen) → skjermbilde av rammesiden.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, statSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
for (const d of ['test/.build', 'test/.vendor/fonts', 'docs/images/iphone', 'docs/images/pc']) mkdirSync(R + d, { recursive: true });

/* ---------------------------------------------------------------- avhengigheter (Bubble Card, MDI, bundle) */
const BC = R + 'test/.vendor/bubble-card.js';
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const MDI = R + 'test/.vendor/mdi.js';
if (!existsSync(MDI)) execFileSync('curl', ['-sSL', '-o', MDI, 'https://raw.githubusercontent.com/Templarian/MaterialDesign-JS/master/mdi.js']);
const mdiMap = {};
for (const m of readFileSync(MDI, 'utf8').matchAll(/export var mdi(\w+) = "([^"]+)"/g)) mdiMap[m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])([0-9])/g, '$1-$2').toLowerCase()] = m[2];
const bundle = R + `test/.build/docs-shots-${process.pid}.js`;
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);

// Harness: test/harness-bubble.html, men ha-icon tegner ekte MDI-ikoner (stubben viser grå klosser)
const HARNESS = R + `test/.build/harness-shots-${process.pid}.html`;
const ICON = `customElements.define('ha-icon', class extends HTMLElement {
  static get observedAttributes() { return ['icon']; }
  connectedCallback() { this._r(); } attributeChangedCallback() { this._r(); }
  set icon(v) { this.setAttribute('icon', v || ''); } get icon() { return this.getAttribute('icon') || ''; }
  _r() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const i = this.getAttribute('icon') || ''; this.setAttribute('data-ok', /^[a-z]+:[a-z0-9-]+$/.test(i) ? '1' : '0');
    const n = i.replace(/^(mdi|hass):/, ''), d = (window.__MDI || {})[n] || (window.__MDI || {})['help-circle-outline'] || '';
    this.shadowRoot.innerHTML = '<style>:host{display:inline-flex;align-items:center;justify-content:center;position:relative;vertical-align:middle;fill:currentcolor;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;pointer-events:none;display:block}</style><svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" role="img" aria-hidden="true"><path d="' + d + '"></path></svg>';
  }
});`;
{
  let h = readFileSync(R + 'test/harness-bubble.html', 'utf8');
  h = h.replace(/customElements\.define\('ha-icon'[^\n]*\n/, ICON + '\n');
  h = h.replace('<script src="mock-hass.js">', '<script src="../mock-hass.js">');
  // HA arver dashbordfonten (Bubble-headeren bruker var(--ha-font-family-body, inherit)) – ikke nettleserens serif.
  // HA-temaets variabler (My SmartHome v3): Bubble regner popupens flate fra --ha-card-background/--card-background-color
  // (bg_opacity 98 %) – uten dem blir popupen svart i stedet for #282828 som i HA.
  h = h.replace('</style>', `  html,body{font-family:'Space Grotesk',system-ui,sans-serif}
  :root{--primary-background-color:#232323;--card-background-color:#282828;--ha-card-background:#282828;--primary-text-color:#fafafa;--secondary-text-color:#afafaf;--divider-color:#3a3a3a}
  :root[data-ki-theme=light]{--primary-background-color:#e6e6e6;--card-background-color:#ffffff;--ha-card-background:#ffffff;--primary-text-color:#212121;--secondary-text-color:#727272;--divider-color:#e0e0e0}
</style>`);
  writeFileSync(HARNESS, h);
}

/* ---------------------------------------------------------------- dokumentasjonsdata (oppå test/mock) */
// Popupene som tas: alle funksjons-popups, et utvalg rom (ikke alle ni) og én person-popup.
const DOC_ROOMS = ['#stue', '#kjokken', '#soverom', '#basseng'], DOC_PERSONS = ['#person-kari'];
// Kjøres i siden før dashbordet bygges: ingen ekte navn i popupene (Cybele → Kari, Rune → Ola, Emma ut – tre personer i
// headeren som i designet; Sebastian byttes til Jonas i popup-tekster av scrub()), emoji-avatarer, header i «Stor hilsen»
// (overlappende bilder + ▾ for stedsmenyen) via ki-store, og prosaen uten vaskemaskin/planter. Hilsenen «👋 Sebastian!»
// (hass.user.name) røres ikke.
const DOCS_DATA = `window.__docsData = function (hass) {
  const S = hass.states, E = hass.entities || {};
  const seg = (k) => new RegExp('(^|[._])' + k + '(?=[._]|$)');
  const ren = (from, to) => {
    Object.keys(S).forEach((id) => {
      if (!seg(from).test(id)) return;
      const nid = id.replace(seg(from), '$1' + to);
      S[nid] = S[id]; delete S[id]; S[nid].entity_id = nid;
      if (E[id]) { E[nid] = { ...E[id], entity_id: nid }; delete E[id]; }
    });
    const Cap = from[0].toUpperCase() + from.slice(1), ToCap = to[0].toUpperCase() + to.slice(1);
    const sub = (v) => typeof v === 'string'
      ? v.replace(new RegExp('\\\\b' + Cap + '\\\\b', 'g'), ToCap).replace(new RegExp('(^|[._\\\\s])' + from + '(?=[._\\\\s]|$)', 'g'), '$1' + to)
      : Array.isArray(v) ? v.map(sub) : v;
    Object.values(S).forEach((st) => { const a = st.attributes || {}; Object.keys(a).forEach((k) => { a[k] = sub(a[k]); }); });
  };
  Object.keys(S).forEach((id) => { if (seg('emma').test(id)) { delete S[id]; delete E[id]; } });
  ren('cybele', 'kari'); ren('rune', 'ola');
  // Status som i designet: Kari og Sebastian hjemme, Ola på reise (✈)
  const set = (id, state, attrs) => { if (S[id]) { if (state !== undefined) S[id].state = state; Object.assign(S[id].attributes, attrs || {}); } };
  set('person.kari', 'home'); set('input_boolean.kari_sover', 'off'); set('binary_sensor.kari_sover', 'off');
  set('person.ola', 'Reise'); set('input_boolean.ola_hjemme', 'off');
  // Emoji-avatarer (ingen ekte bilder) på myk gradient – entity_picture som data-URL
  const avatar = (emoji, c1, c2) => {
    const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 192, 192); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, 192, 192);
    g.font = '118px "Noto Color Emoji","Apple Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 96, 108);
    return c.toDataURL('image/png');
  };
  set('person.kari', undefined, { entity_picture: avatar('👩🏼', '#f285c9', '#ad99e6') });
  set('person.ola', undefined, { entity_picture: avatar('👨🏻', '#73b9f2', '#66d19e') });
  set('person.sebastian', undefined, { entity_picture: avatar('🧑🏽', '#f2b573', '#f28073') });
  // Prosa: vaskemaskinen står, ingen planter trenger vann
  set('input_select.vaskemaskin_status', 'Av');
  Object.values(S).forEach((st) => {
    const a = st.attributes || {}; if (a.integrasjon !== 'ki_planter') return;
    if (a.type === 'sted') { st.state = '0'; a.trenger_vann = []; a.trenger_vann_tekst = ''; } else if (a.type === 'plante') st.state = 'off';
  });
  // ki-store (frontend/get_user_data): header i «Stor hilsen»; på telefon 26 px tittel så «👋 Sebastian! ▾» og de tre
  // bildene står på én linje (30 px bryter navnet på 390 px)
  const ws = hass.callWS;
  hass.callWS = (m) => (m && m.type === 'frontend/get_user_data' && m.key === 'ki_dashboard')
    ? Promise.resolve({ value: { cards: { 'ki-home-header': { mode: 'stor', per_screen: { phone: { size: 26 } } } } } }) : ws(m);
};`;

/* ---------------------------------------------------------------- nett (fonter, Leaflet, kartfliser) via curl-cache */
// Chromium i testen går ikke via proxyen: Google Fonts og kartfliser hentes med curl (mellomlagret i test/.vendor),
// Leaflet fra npm-tarballen. Når en kartflis ikke kan hentes, brukes en nøytral mørk flis (bare rutenett, ingen kartdata).
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const cached = (url, dir) => {
  mkdirSync(R + 'test/.vendor/' + dir, { recursive: true });
  const f = R + 'test/.vendor/' + dir + '/' + createHash('sha1').update(url).digest('hex');
  if (!existsSync(f)) { try { execFileSync('curl', ['-sSLf', '-A', UA, '-o', f, url], { timeout: 20000, stdio: 'ignore' }); } catch (e) { try { unlinkSync(f); } catch (e2) { /* */ } return null; } }
  return readFileSync(f);
};
const LEAF = R + 'test/.vendor/leaflet';
function leafletFile(name) {
  if (!existsSync(LEAF + '/package/dist/leaflet.js')) {
    try { mkdirSync(LEAF, { recursive: true }); execFileSync('curl', ['-sSLf', '-o', LEAF + '/leaflet.tgz', 'https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz']); execFileSync('tar', ['-xzf', LEAF + '/leaflet.tgz', '-C', LEAF]); } catch (e) { return null; }
  }
  const f = LEAF + '/package/dist/' + name;
  return existsSync(f) ? readFileSync(f) : null;
}
const TILE = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${dark ? '#1f2023' : '#e9e9ec'}"/><path d="M0 .5H256M.5 0V256M0 128.5H256M128.5 0V256" stroke="${dark ? '#2a2b2f' : '#dcdce0'}" stroke-width="1"/></svg>`;
async function routeNet(ctx) {
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url(), b = cached(url, 'fonts');
    if (!b) return route.abort();
    await route.fulfill({ status: 200, contentType: /googleapis/.test(url) ? 'text/css' : 'font/woff2', body: b, headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/leaflet@[^/]+\/dist\//, async (route) => {
    const name = route.request().url().split('/dist/')[1].split('?')[0], b = leafletFile(name);
    if (!b) return route.abort();
    await route.fulfill({ status: 200, contentType: /\.css$/.test(name) ? 'text/css' : /\.js$/.test(name) ? 'application/javascript' : 'image/png', body: b, headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route(/^https:\/\/([a-z0-9-]+\.)*(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com)\//, async (route) => {
    const url = route.request().url(), b = cached(url, 'tiles');
    if (b) return route.fulfill({ status: 200, contentType: 'image/png', body: b, headers: { 'access-control-allow-origin': '*' } });
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TILE(!/light/.test(url)), headers: { 'access-control-allow-origin': '*' } });
  });
}

/* ---------------------------------------------------------------- rammer */
const PALETTE = { pink: '#f285c9', blue: '#73b9f2', purple: '#ad99e6', orange: '#f2b573', green: '#66d19e', red: '#f28073' };
const BG = (light) => `
  .bg{position:absolute;inset:0;overflow:hidden;background:${light ? '#eceaf0' : '#141217'}}
  .bg i{position:absolute;border-radius:50%;filter:blur(90px);opacity:${light ? 0.55 : 0.42}}
  .bg i:nth-child(1){width:62%;height:48%;left:-14%;top:-10%;background:${PALETTE.pink}}
  .bg i:nth-child(2){width:58%;height:46%;right:-16%;top:18%;background:${PALETTE.blue}}
  .bg i:nth-child(3){width:56%;height:44%;left:-8%;bottom:-14%;background:${PALETTE.purple}}
  .bg i:nth-child(4){width:40%;height:30%;right:2%;bottom:-6%;background:${PALETTE.orange};opacity:${light ? 0.45 : 0.3}}
  .bg::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%, transparent 40%, ${light ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.35)'})}`;
const BGHTML = '<div class="bg"><i></i><i></i><i></i><i></i></div>';

// iPhone (390×844-skjerm): titanramme, svart kant, Dynamic Island, statuslinje (klokke, signal, wifi, batteri), hjemindikator
const PHONE = { canvasW: 640, canvasH: 1040, statusH: 47 };
function phoneHTML(img, o) {
  const fg = o.light ? '#111' : '#fff';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${PHONE.canvasW}px;height:${PHONE.canvasH}px;overflow:hidden;font-family:-apple-system,'SF Pro Text','Inter','Liberation Sans',system-ui,sans-serif}
  ${BG(o.light)}
  .ph{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${390 + 2 * 15}px;height:${844 + 2 * 15}px;border-radius:69px;
    background:linear-gradient(145deg,#c9c4bd 0%,#8d8881 18%,#5f5b56 46%,#9a958e 74%,#d2cdc6 100%);
    box-shadow:0 50px 90px -30px rgba(0,0,0,.65),0 30px 60px -40px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.35),inset 0 0 2px 2px rgba(0,0,0,.35)}
  .ph::before{content:'';position:absolute;inset:3px;border-radius:66px;background:#050505;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
  .btn{position:absolute;width:4px;border-radius:2px;background:linear-gradient(90deg,#6c6862,#b7b2ab 60%,#7a756f)}
  .scr{position:absolute;left:15px;top:15px;width:390px;height:844px;border-radius:55px;overflow:hidden;background:${o.top}}
  .scr img{position:absolute;left:0;top:${PHONE.statusH}px;width:390px;height:${844 - PHONE.statusH}px;display:block}
  .sb{position:absolute;left:0;right:0;top:0;height:${PHONE.statusH}px;color:${fg};z-index:2}
  .tm{position:absolute;left:52px;top:15px;font-weight:600;font-size:17px;letter-spacing:-.2px}
  .ic{position:absolute;right:30px;top:18px;display:flex;gap:6px;align-items:center}
  .di{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:125px;height:37px;border-radius:20px;background:#000;z-index:3}
  .di::after{content:'';position:absolute;right:20px;top:12px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#2b3a55,#0b0f18 60%)}
  .hi{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:${fg};opacity:.85;z-index:2}
  .gl{position:absolute;inset:15px;border-radius:55px;pointer-events:none;background:linear-gradient(125deg,rgba(255,255,255,.07),transparent 32%);z-index:4}
  </style></head><body>${BGHTML}
  <div class="ph">
    <div class="btn" style="left:-3px;top:150px;height:32px"></div><div class="btn" style="left:-3px;top:210px;height:62px"></div><div class="btn" style="left:-3px;top:286px;height:62px"></div><div class="btn" style="right:-3px;top:230px;height:98px"></div>
    <div class="scr"><img src="${img}">
      <div class="sb"><div class="tm">9:41</div><div class="ic">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="${fg}"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="${fg}"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.5 1.5 10.9.4 8 .4S2.5 1.5.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2zm0 3.4c1.5 0 2.8.5 3.9 1.5l1.2-1.3C11.7 4.5 9.9 3.8 8 3.8s-3.7.7-5.1 2l1.2 1.3c1.1-1 2.4-1.5 3.9-1.5zm0 3.4c-.7 0-1.3.3-1.8.7L8 11.6l1.8-1.9C9.3 9.3 8.7 9 8 9z"/></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="${fg}" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="9" rx="2.4" fill="${fg}"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="${fg}" fill-opacity=".45"/></svg>
      </div></div>
      <div class="di"></div><div class="hi"></div>
    </div>
    <div class="gl"></div>
  </div></body></html>`;
}

// PC: nettleservindu (trafikklys, adressefelt), avrundede hjørner, skygge
const WIN = { canvasW: 1680, canvasH: 1124, barH: 40 };
function pcHTML(img, o) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${WIN.canvasW}px;height:${WIN.canvasH}px;overflow:hidden;font-family:-apple-system,'Inter','Liberation Sans',system-ui,sans-serif}
  ${BG(o.light)}
  .w{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:1440px;height:${900 + WIN.barH}px;border-radius:14px;overflow:hidden;background:#1d1d1f;
     box-shadow:0 60px 120px -40px rgba(0,0,0,.7),0 24px 48px -24px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.12)}
  .bar{position:absolute;left:0;right:0;top:0;height:${WIN.barH}px;background:${o.light ? '#e9e8ec' : '#2a2a2d'};border-bottom:1px solid ${o.light ? '#d4d3d8' : '#000'};display:flex;align-items:center}
  .dots{display:flex;gap:8px;margin-left:16px}.dots i{width:12px;height:12px;border-radius:50%;display:block}
  .url{position:absolute;left:50%;transform:translateX(-50%);width:460px;height:26px;border-radius:8px;background:${o.light ? '#fff' : '#1c1c1e'};color:${o.light ? '#555' : '#a1a1a6'};font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px}
  .w img{position:absolute;left:0;top:${WIN.barH}px;width:1440px;height:900px;display:block}
  </style></head><body>${BGHTML}
  <div class="w"><div class="bar"><div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
    <div class="url"><svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor"><path d="M2 5V3.5a3.5 3.5 0 0 1 7 0V5h.5A1.5 1.5 0 0 1 11 6.5v4A1.5 1.5 0 0 1 9.5 12h-8A1.5 1.5 0 0 1 0 10.5v-4A1.5 1.5 0 0 1 1.5 5H2zm1.5 0h4V3.5a2 2 0 0 0-4 0V5z"/></svg>homeassistant.local:8123/ki-dashboard${o.hash || ''}</div></div>
    <img src="${img}"></div></body></html>`;
}

const DEVICES = {
  iphone: { vp: { width: 390, height: 844 - PHONE.statusH }, dpr: 3, touch: true, mobile: true, frame: phoneHTML, canvas: { width: PHONE.canvasW, height: PHONE.canvasH }, outDpr: 2.5 },
  pc: { vp: { width: 1440, height: 900 }, dpr: 2, touch: false, mobile: false, frame: pcHTML, canvas: { width: WIN.canvasW, height: WIN.canvasH }, outDpr: 2000 / WIN.canvasW },
};
const only = process.argv[2];
const devs = (process.env.DEVICES || 'iphone,pc').split(',');
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const report = [];
const slug = (h) => h.replace(/^#/, '').replace(/[^a-z0-9_-]+/gi, '-');

// Rammeside: legg skjermbildet inn og ta bilde (statuslinjens bakgrunn = fargen øverst i skjermbildet)
async function compose(dev, png, out, o) {
  const ctx = await browser.newContext({ viewport: dev.canvas, deviceScaleFactor: dev.outDpr });
  const p = await ctx.newPage();
  const url = 'data:image/png;base64,' + png.toString('base64');
  await p.setContent(dev.frame(url, { ...o, top: o.top || '#232323' }));
  await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));
  await p.waitForTimeout(150);
  // WebP (kvalitet .9) i stedet for PNG: ~1/8 av størrelsen, samme skarphet på tekst; GitHub viser WebP i README/docs
  const shot = await p.screenshot();
  const webp = await p.evaluate(async (data) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.9).split(',')[1];
  }, shot.toString('base64'));
  writeFileSync(out, Buffer.from(webp, 'base64'));
  await ctx.close();
}

async function openDashboard(dev, light) {
  const ctx = await browser.newContext({ viewport: dev.vp, deviceScaleFactor: dev.dpr, hasTouch: dev.touch, isMobile: dev.mobile });
  await routeNet(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  if (process.env.DBG) { page.on('console', (m) => console.log('  ·', m.type(), m.text().slice(0, 200))); page.on('request', (r) => { if (!/^(file|data):/.test(r.url())) console.log('  →', r.url().slice(0, 140)); }); page.on('requestfailed', (r) => console.log('  ✘', r.url().slice(0, 140), r.failure() && r.failure().errorText)); }
  await page.goto('file://' + HARNESS);
  await page.addScriptTag({ content: 'window.__MDI = ' + JSON.stringify(mdiMap) + ';' });
  // Ekte Leaflet før mockene (test/mock/51-kart.js legger inn en Leaflet-stub bare når window.L mangler)
  const lj = leafletFile('leaflet.js');
  if (lj) await page.addScriptTag({ content: lj.toString() });
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ content: DOCS_DATA });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const pops = await page.evaluate(async (light) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    document.documentElement.style.setProperty('--sb', '0px');
    const hass = window.mockHass();
    window.__docsData(hass);
    hass.themes = { ...(hass.themes || {}), darkMode: !light };
    window.__H = hass;
    if (light) document.documentElement.style.background = document.body.style.background = '#e6e6e6';
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    const root = document.getElementById('dash');
    for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    await wait(1200);
    try { await document.fonts.ready; } catch (e) { /* */ }
    return stack.cards.filter((c) => c.card_type === 'pop-up').map((c) => ({ hash: c.hash, name: c.name || c.hash, icon: c.icon || '', group: hass.areas[c.hash.slice(1)] ? 'rom' : /^#person-/.test(c.hash) ? 'person' : 'fn' }));
  }, !!light);
  return { ctx, page, pops, errs };
}

// Rydd: lukk ark/editorer, toasts og more-info før skjermbildet
const tidy = (page) => page.evaluate(async () => {
  const M = window.MSH;
  try { M.portals().forEach((x) => x.remove()); } catch (e) { /* */ }
  try { const r = M.overlayRoot(); r.querySelectorAll('#msh-toast').forEach((t) => t.remove()); } catch (e) { /* */ }
  document.querySelectorAll('ha-more-info-dialog,dialog-box').forEach((d) => d.remove());
  try { await document.fonts.ready; } catch (e) { /* */ }
});
// Ingen ekte navn i popupene: tekstnoder (også i shadow DOM) får Jonas/Kari/Ola/Nora – alt unntatt Hjem-headeren
// (hilsenen «👋 Sebastian!» er designet). Fanger det mock-dataene ikke dekker (f.eks. standard kursnavn i Strøm).
const scrub = (page) => page.evaluate(() => {
  const MAP = [[/Sebastian/g, 'Jonas'], [/Cybele/g, 'Kari'], [/\bRune\b/g, 'Ola'], [/\bEmma\b/g, 'Nora']];
  const walk = (root) => {
    const it = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = it.nextNode())) { const t = n.nodeValue; let u = t; MAP.forEach(([r, s]) => { u = u.replace(r, s); }); if (u !== t) n.nodeValue = u; }
    root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot && e.tagName !== 'MSH-HJEM-HEADER-CARD') walk(e.shadowRoot); });
  };
  walk(document);
});
const topColor = (page) => page.evaluate(() => {
  const deep = (root, out) => { root.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) deep(e.shadowRoot, out); }); return out; };
  const open = deep(document, []).some((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  return { open };
});

for (const dn of devs) {
  const dev = DEVICES[dn];
  if (!dev) continue;
  const shots = [];
  // Hjem (mørk + lys)
  for (const light of [false, true]) {
    if (only && !'hjem'.includes(only)) break;
    const { ctx, page } = await openDashboard(dev, light);
    await page.waitForTimeout(800); await tidy(page); await scrub(page);
    const png = await page.screenshot();
    const out = R + `docs/images/${dn}/hjem${light ? '-lys' : ''}.webp`;
    await compose(dev, png, out, { light, top: light ? '#e6e6e6' : '#232323' });
    shots.push({ hash: '', name: light ? 'Hjem (lys modus)' : 'Hjem', file: out });
    await ctx.close();
  }
  // Popups (mørk) – ny side per popup, så ingen tilstand lekker mellom dem
  const { ctx: c0, pops } = await openDashboard(dev, false);
  await c0.close();
  for (const pop of pops) {
    if (only && !pop.hash.includes(only) && !pop.name.toLowerCase().includes(only.toLowerCase())) continue;
    if ((pop.group === 'rom' && !DOC_ROOMS.includes(pop.hash)) || (pop.group === 'person' && !DOC_PERSONS.includes(pop.hash))) continue;
    const { ctx, page, errs } = await openDashboard(dev, false);
    await page.evaluate((h) => { location.hash = h; }, pop.hash);
    await page.waitForTimeout(2200);
    await tidy(page); await scrub(page);
    const st = await topColor(page);
    await page.waitForTimeout(200);
    const png = await page.screenshot();
    const out = R + `docs/images/${dn}/${slug(pop.hash)}.webp`;
    await compose(dev, png, out, { light: false, top: '#151515', hash: pop.hash });
    shots.push({ ...pop, file: out, opened: st.open, errs: errs.slice(0, 2) });
    await ctx.close();
  }
  report.push(...shots.map((s) => ({ dev: dn, ...s, kb: Math.round(statSync(s.file).size / 1024) })));
}
await browser.close();
try { unlinkSync(bundle); unlinkSync(HARNESS); } catch (e) { /* */ }

// README-bildene (rammede versjoner) + rydd bort bilder som ikke lenger tas (rom/personer utenfor utvalget)
if (!only) {
  for (const dn of devs) {
    const keep = new Set(report.filter((r) => r.dev === dn).map((r) => r.file));
    for (const f of readdirSync(R + 'docs/images/' + dn)) { const p = R + 'docs/images/' + dn + '/' + f; if (!keep.has(p)) unlinkSync(p); }
  }
  const cp = (src, dst) => { if (existsSync(R + src)) copyFileSync(R + src, R + dst); };
  const firstRoom = report.find((r) => r.dev === 'iphone' && r.hash === '#stue');
  cp('docs/images/iphone/hjem.webp', 'docs/images/hjem.webp');
  if (firstRoom) cp('docs/images/iphone/stue.webp', 'docs/images/rom.webp');
  for (const n of ['basseng', 'vanning', 'varmepumpe', 'innstillinger', 'server']) {
    const r = report.find((x) => x.dev === 'iphone' && (x.hash === '#' + n || (n === 'innstillinger' && x.hash === '#settings')));
    if (r) cp(r.file.replace(R, ''), `docs/images/${n}.webp`);
  }
  cp('docs/images/pc/hjem.webp', 'docs/images/hjem-desktop.webp');
  writeFileSync(R + 'test/.build/docs-shots-report.json', JSON.stringify(report, null, 1));
  writeGallery();
}

// docs/galleri.md (alle bilder per popup) + galleriblokken i README.md (mellom <!-- shots:start/end -->)
function writeGallery() {
  const ip = report.filter((r) => r.dev === 'iphone'), pc = report.filter((r) => r.dev === 'pc');
  const key = (r) => (r.hash || (r.name.includes('lys') ? 'hjem-lys' : 'hjem'));
  const rel = (r, pre) => pre + r.file.replace(R + 'docs/', '');
  const pcOf = (r) => pc.find((x) => key(x) === key(r));
  const GROUPS = [['Hjem', (r) => !r.hash], ['Rom', (r) => r.group === 'rom'], ['Funksjoner', (r) => r.group === 'fn'], ['Personer', (r) => r.group === 'person']];
  const title = (r) => `${r.name}${r.hash ? ` · \`${r.hash}\`` : ''}`;
  let md = `# Galleri\n\nHjem og popupene fra strategien (\`custom:ki-dashboard\`) – alle funksjons-popups, et utvalg rom og én person-popup – tatt med\n\`npm run shots\` (\`test/docs-shots.mjs\`) mot ekte Bubble Card og testdataene i \`test/mock\` – mørkt tema, Hjem også i lyst.\niPhone: 390×844 @3x i iPhone-ramme. PC: 1440×900 hi-DPI i nettleservindu. Ingen ekte personer, adresser eller kameraer.\n`;
  for (const [g, f] of GROUPS) {
    const rows = ip.filter(f);
    if (!rows.length) continue;
    md += `\n## ${g}\n`;
    for (const r of rows) {
      const p = pcOf(r);
      md += `\n### ${title(r)}\n\n| iPhone | PC |\n|:---:|:---:|\n| <img src="${rel(r, '')}" alt="${r.name} – iPhone" width="260"> | ${p ? `<img src="${rel(p, '')}" alt="${r.name} – PC" width="560">` : '–'} |\n`;
    }
  }
  writeFileSync(R + 'docs/galleri.md', md);
  // README: rutenett med iPhone-bilder (4 per rad) + PC-seksjon
  const cells = ip.filter((r) => key(r) !== 'hjem-lys');
  let rd = `<!-- shots:start · generert av npm run shots -->\n`;
  for (let i = 0; i < cells.length; i += 4) {
    const row = cells.slice(i, i + 4);
    rd += `\n| ${row.map((r) => r.name).join(' | ')} |\n|${row.map(() => ':---:').join('|')}|\n| ${row.map((r) => `<img src="${rel(r, 'docs/')}" alt="${r.name}" width="190">`).join(' | ')} |\n`;
  }
  const pcPick = ['hjem', '#stue', '#strom', '#vaer', '#media', '#server'].map((k) => pc.find((x) => key(x) === k)).filter(Boolean);
  rd += `\n### PC\n\n<img src="${rel(pcPick[0], 'docs/')}" alt="Hjem på PC" width="100%">\n\n| ${pcPick.slice(1).map((r) => r.name).join(' | ')} |\n|${pcPick.slice(1).map(() => ':---:').join('|')}|\n| ${pcPick.slice(1).map((r) => `<img src="${rel(r, 'docs/')}" alt="${r.name} på PC" width="300">`).join(' | ')} |\n\nAlle bilder (iPhone og PC for hver popup, og Hjem i lyst tema): [docs/galleri.md](docs/galleri.md).\n<!-- shots:end -->`;
  const readme = readFileSync(R + 'README.md', 'utf8');
  if (/<!-- shots:start[\s\S]*?<!-- shots:end -->/.test(readme)) writeFileSync(R + 'README.md', readme.replace(/<!-- shots:start[\s\S]*?<!-- shots:end -->/, rd));
}
for (const r of report) console.log(`${r.opened === false ? '✘' : '✔'} ${r.dev.padEnd(6)} ${(r.hash || 'hjem').padEnd(16)} ${r.name.padEnd(22)} ${String(r.kb).padStart(5)} KB${r.errs && r.errs.length ? ' · ' + r.errs.join(' | ') : ''}`);
