// Fiks 50 · Server (#server, msh-server-card) del E, F, G og K (underfane-navn):
//   E · qBittorrent-fanen: autokonfig via plattform + translation_key (ikke entitets-ID), toppkort (chip, Ned/Opp/Aktive bytter graf),
//       prosa, underfaner Torrenter | Statistikk, formatering (MB/s, TB, ratio, «Ingen»), alternativ hastighet (switch.toggle,
//       haptic medium), trykk → more-info, manglende entitet → «–», mangler hele integrasjonen → fanen skjult (qbit_force viser),
//       overrides, kortvelger-ring (100 % = 20 MB/s), Tilpass/GUI-editoren har feltene.
//   F · fanelinjen som karusell: overflyt → scroll (flex 1 0 auto, min 84, padding 0 16, snap x proximity, skjult scrollbar,
//       overscroll contain, touch-action pan-x), fade bare på siden med skjult innhold (scroll + resize), trykk sentrerer
//       (smooth), aktiv sentrert ved åpning, ingen lekkasje av pointerdown/touchstart/touchmove til popupen, ingen sideveis
//       side-scroll, hold + dra omorganiserer (auto-scroll mot kanten); kort-modus er også karusell.
//   G · Internett-kortet (SpeedTest): Ned/Opp Mbit/s, «Ping 6 ms · målt 14:10» / «i går 22:10» / «3. okt», «Kjør test» →
//       homeassistant.update_entity (3 sensorer) eller speedtestdotnet.speedtest, måling («–», «Måler …», grå knapp),
//       ferdig → haptic success + toast «Speedtest ferdig», haptic medium ved start, flis → more-info.
//   K · underfaner UDM · Enheter · Switch (gammel «internett» → UDM), UDM = Internett-kortet øverst + M.serverUnifi.html(…, 'udm'),
//       Enheter/Switch fra M.serverUnifi når den finnes (vert-grensesnittet: go/setUI/confirm/moreInfo/render).
//   node test/server50-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/s50-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const FIX = resolve('test/fixtures/server50-mock.js');
const errs = [];
// opt: { fix: true (qBittorrent + SpeedTest), vp, su: true (stub for M.serverUnifi), pre }
async function page(cfg, opt) {
  opt = opt || {};
  const p = await b.newPage({ viewport: opt.vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  if (opt.fix !== false) await p.addScriptTag({ path: FIX });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, su }) => {
    // spioner: haptic / toast / more-info
    window.__hap = []; window.__toast = []; window.__more = [];
    const M = window.MSH, h0 = M.haptic, t0 = M.toast;
    M.haptic = (t) => { window.__hap.push(t); return h0(t); };
    M.toast = (t, o) => { window.__toast.push(t); return t0(t, o); };
    M.moreInfo = (el, id) => { window.__more.push(id); };
    if (su) {
      window.__suBind = [];
      M.serverUnifi = {
        css: '.su-box{display:block;padding:12px;border-radius:28px;background:var(--ki-surface, #3a3a3a)}',
        html: (host, sub, R) => `<div class="su-box su-${sub}" data-n="${R && R.unifi ? R.unifi.enheter.length : -1}">${sub}</div>`,
        bind: (host, el, sub) => { window.__suBind.push(sub); window.__host = host; },
        prosa: () => 'Prosa fra <span class="pp">serverUnifi</span>.',
      };
    }
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#server' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Server</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#server';
    const c = document.createElement('msh-server-card');
    c.setConfig({ type: 'custom:msh-server-card', card_id: 'pop-server-50', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__R = (s) => c.shadowRoot.querySelector(s); window.__A = (s) => [...c.shadowRoot.querySelectorAll(s)];
    window.__t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    // ny hass med endrede states (som HA: nye objekter)
    window.__set = (patch) => { const S = { ...window.__h.states }; Object.entries(patch).forEach(([id, v]) => { if (v == null) delete S[id]; else S[id] = { ...(S[id] || { entity_id: id, attributes: {} }), ...v }; }); window.__h = { ...window.__h, states: S }; c.hass = window.__h; };
    await new Promise((q) => setTimeout(q, 900));
  }, { cfg, su: !!opt.su });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/server50-${n}.png`, fullPage: true }); };
const click = async (p, sel, ms = 250) => { const r = await p.evaluate((sel) => { const e = window.__R(sel); if (!e) return false; e.click(); return true; }, sel); await wait(p, ms); return r; };
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').map((c) => `${c[0]}.${c[1]}:${JSON.stringify(c[2])}`));
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; window.__toast.length = 0; window.__more.length = 0; });
const tabs = (p) => p.evaluate(() => __A('.trow .tb').map((x) => x.dataset.v));

try {
/* ================================================================ E · qBittorrent: autokonfig */
let p = await page({}, { fix: true });
let X = await p.evaluate(() => { const Q = MSH.server.oppdagQB(window.__h, {}); return { found: Q.found, ids: Q.ids }; });
ok('E autokonfig: qBittorrent funnet via plattform + translation_key (fart med egne entitets-ID-er)', X.found && X.ids.down === 'sensor.torrentserver_nedlasting' && X.ids.up === 'sensor.torrentserver_opplasting'
  && X.ids.downLim === 'sensor.qbittorrent_download_speed_limit' && X.ids.upLim === 'sensor.qbittorrent_upload_speed_limit' && X.ids.conn === 'sensor.qbittorrent_connection_status' && X.ids.status === 'sensor.qbittorrent_status'
  && X.ids.active === 'sensor.qbittorrent_active_torrents' && X.ids.inactive === 'sensor.qbittorrent_inactive_torrents' && X.ids.all === 'sensor.qbittorrent_all_torrents' && X.ids.alt === 'switch.qbittorrent_alternative_speed'
  && X.ids.dlTot === 'sensor.qbittorrent_all_time_download' && X.ids.ratio === 'sensor.qbittorrent_global_ratio', X);
X = await p.evaluate(() => {
  // unique_id-suffiks alene (uten translation_key) og objekt-ID-mønster som reserve
  const E = { ...window.__h.entities };
  const strip = (id, keepUid) => { E[id] = { ...E[id], translation_key: null, unique_id: keepUid ? E[id].unique_id : null }; };
  strip('sensor.torrentserver_nedlasting', true); strip('sensor.qbittorrent_global_ratio', false);
  const Q = MSH.server.oppdagQB({ ...window.__h, entities: E }, {});
  return { down: Q.ids.down, ratio: Q.ids.ratio };
});
ok('E autokonfig: unique_id-suffiks (<entry>-download_speed) og objekt-ID-mønster som reserve', X.down === 'sensor.torrentserver_nedlasting' && X.ratio === 'sensor.qbittorrent_global_ratio', X);
ok('E/F fanelinjen: Nettverk · Proxmox · Unraid · HA · qBittorrent (qBit etter HA)', (await tabs(p)).join() === 'net,proxmox,unraid,ha,qbit' && (await p.evaluate(() => __t(__R('.tb[data-v="qbit"]')))) === 'qBittorrent', await tabs(p));

/* ================================================================ E · toppkort, prosa, underfaner */
await clearCalls(p);
await click(p, '.tb[data-v="qbit"]', 500);
X = await p.evaluate(() => ({ on: (__R('.trow .tb.on') || {}).dataset?.v, title: __t(__R('.hero .hn')), chip: __t(__R('.hero .chip')), chipCls: __R('.hero .chip').className, big: __t(__R('.hero .big')), bu: __t(__R('.hero .bu')),
  svs: __A('.hero .sv').map(__t), when: __t(__R('.hero .when')), stroke: __R('.hero .graph path:nth-child(2)').style.stroke, prose: __t(__R('.prose')), pills: __A('.prose .pp').map(__t), subs: __A('.subs .sb').map(__t) }));
ok('E toppkort: «qBittorrent» + chip «Tilkoblet» (grønn), Ned 9,2 MB/s stor, Opp 2,4 MB/s og 6 aktive små', X.on === 'qbit' && X.title === 'qBittorrent' && X.chip === 'Tilkoblet' && /ok/.test(X.chipCls) && X.big === '9,2' && X.bu === 'MB/s' && X.svs.join('|') === '2,4 MB/s|6 aktive' && X.when === 'nå · ned' && /115, 185, 242|73b9f2/.test(X.stroke), X);
ok('E prosa: «qBittorrent laster ned med [9,2 MB/s] og har [6 aktive torrenter].»', X.prose === 'qBittorrent laster ned med 9,2 MB/s og har 6 aktive torrenter.' && X.pills.join('|') === '9,2 MB/s|6 aktive torrenter', X);
ok('E underfaner: Torrenter | Statistikk', X.subs.join() === 'Torrenter,Statistikk', X.subs);
const hist = await p.evaluate(() => window.__calls.filter((c) => c[1] === 'history/history_during_period').map((c) => c[2].entity_ids.join()).pop());
ok('E graf: 24 t historikk for ned/opp/aktive', /torrentserver_nedlasting/.test(hist || '') && /torrentserver_opplasting/.test(hist || '') && /active_torrents/.test(hist || ''), hist);
await click(p, '.hero .sv[data-v="up"]');
X = await p.evaluate(() => ({ big: __t(__R('.hero .big')), when: __t(__R('.hero .when')), stroke: __R('.hero .graph path:nth-child(2)').style.stroke }));
await click(p, '.hero .sv[data-v="act"]');
X.act = await p.evaluate(() => ({ big: __t(__R('.hero .big')), bu: __t(__R('.hero .bu')), stroke: __R('.hero .graph path:nth-child(2)').style.stroke }));
ok('E trykk på verdi bytter graf: Opp (grønn) → Aktive (lilla)', X.big === '2,4' && X.when === 'nå · opp' && /102, 209, 158|66d19e/.test(X.stroke) && X.act.big === '6' && /174, 150, 230|ad99e6|ae96e6/.test(X.act.stroke), X);
await click(p, '.hero .sv[data-v="down"]');
await shot(p, 'qbit-torrenter');

X = await p.evaluate(() => ({ tot: __t(__R('.qbt .cs')), bar: __A('.qbar>span').length, tiles: __A('.qbt .qt').map((t) => __t(t.querySelector('.ql')) + '=' + __t(t.querySelector('.qn'))), speed: __A('.qbt .qs').map((t) => __t(t.querySelector('.qsv')) + ' ' + __t(t.querySelector('.qsl'))),
  tileBg: getComputedStyle(__R('.qt')).backgroundColor, tileR: getComputedStyle(__R('.qt')).borderTopLeftRadius, card: getComputedStyle(__R('.qbt')).backgroundColor, cardR: getComputedStyle(__R('.qbt')).borderTopLeftRadius,
  barH: __R('.qbar').getBoundingClientRect().height, qn: getComputedStyle(__R('.qn')).fontSize + '/' + getComputedStyle(__R('.qn')).fontWeight, qsi: __R('.qsi').getBoundingClientRect().width,
  alt: __t(__R('.qalt b')) + ' ' + __t(__R('.qalt .col>span')), altH: __R('.qalt').getBoundingClientRect().height, trk: [__R('.qtr').getBoundingClientRect().width, __R('.qtr').getBoundingClientRect().height] }));
ok('E Torrenter: kort #3a3a3a r28, «42 totalt», stablet bar 10 px (4 deler), 2×2 fliser #404040 r18 (24/300)', X.tot === '42 totalt' && X.bar === 4 && X.barH === 10 && X.card === 'rgb(58, 58, 58)' && X.cardR === '28px' && X.tileBg === 'rgb(64, 64, 64)' && X.tileR === '18px' && X.qn === '24px/300'
  && X.tiles.join('|') === 'Aktive=6|Inaktive=31|Pauset=4|Feil=1', X);
ok('E Torrenter: hastighetsfliser (ikon-sirkel 32 px) «9,2 MB/s Ned» / «2,4 MB/s Opp»', X.speed.join('|') === '9,2 MB/s Ned|2,4 MB/s Opp' && X.qsi === 32, X.speed);
ok('E Alternativ hastighet: rad 68 px, bryter 52×32, «Av · bruker vanlige grenser»', /Alternativ hastighet Av · bruker vanlige grenser/.test(X.alt) && X.altH === 68 && X.trk.join() === '52,32', X);
await clearCalls(p);
await click(p, '.qalt');
X = await p.evaluate(() => ({ c: window.__calls.filter((c) => c[0] !== 'ws').map((c) => c[0] + '.' + c[1] + ':' + c[2].entity_id), hap: window.__hap.slice(), on: __R('.qalt').classList.contains('on'), toast: window.__toast.slice(), bg: getComputedStyle(__R('.qalt .qtr')).backgroundImage }));
ok('E Alternativ hastighet: trykk → switch.toggle, haptic «medium» (én), rosa gradient (optimistisk)', X.c.join() === 'switch.toggle:switch.qbittorrent_alternative_speed' && X.hap.join() === 'medium' && X.on && /gradient/.test(X.bg) && X.toast.includes('Alternativ hastighet på'), X);
await p.evaluate(() => window.__set({ 'switch.qbittorrent_alternative_speed': { state: 'on' }, 'sensor.qbittorrent_download_speed_limit': { state: '1000' }, 'sensor.qbittorrent_upload_speed_limit': { state: '488.28125' } }));
await wait(p, 200);
X = await p.evaluate(() => __t(__R('.qalt .col>span')));
ok('E Alternativ hastighet på: undertekst med grensene («På · 1 MB/s ned · 0,5 MB/s opp»)', X === 'På · 1 MB/s ned · 0,5 MB/s opp', X);
await clearCalls(p);
await click(p, '.qt[data-key="qt-paused"]');
await click(p, '.qs[data-key="qs-Ned"]');
X = await p.evaluate(() => ({ more: window.__more.slice(), hap: window.__hap.slice() }));
ok('E trykk på flis → more-info for sin entitet, haptic «light»', X.more.join() === 'sensor.qbittorrent_paused_torrents,sensor.torrentserver_nedlasting' && X.hap.join() === 'light,light', X);

await click(p, '.sb[data-v="statistikk"]');
X = await p.evaluate(() => ({ cells: __A('.qst .qx').map((x) => __t(x.querySelector('span:last-child')) + '=' + __t(x.querySelector('.num'))), bg: getComputedStyle(__R('.qx')).backgroundColor, r: getComputedStyle(__R('.qx')).borderTopLeftRadius, cols: getComputedStyle(__R('.qst')).gridTemplateColumns.split(' ').length }));
ok('E Statistikk: 2 kolonner (#404040 r16): 4,82 TB · 11,3 TB · 2,34 · 42 · grense ned 1 MB/s · grense opp 0,5 MB/s', X.cols === 2 && X.bg === 'rgb(64, 64, 64)' && X.r === '16px'
  && X.cells.join('|') === 'Totalt lastet ned=4,82 TB|Totalt lastet opp=11,3 TB|Ratio=2,34|Alle torrenter=42|Grense ned=1 MB/s|Grense opp=0,5 MB/s', X);
await p.evaluate(() => window.__set({ 'sensor.qbittorrent_download_speed_limit': { state: '0' }, 'sensor.qbittorrent_upload_speed_limit': { state: '4883' } }));
await wait(p, 200);
X = await p.evaluate(() => __A('.qst .qx').slice(4).map((x) => __t(x.querySelector('.num'))));
ok('E Statistikk: grense 0 → «Ingen», 4883 KiB/s → «5 MB/s»', X.join('|') === 'Ingen|5 MB/s', X);
await shot(p, 'qbit-statistikk');
// manglende entitet → «–», flisen beholdes
await p.evaluate(() => window.__set({ 'sensor.qbittorrent_global_ratio': null, 'sensor.qbittorrent_errored_torrents': null }));
await wait(p, 200);
X = { ratio: await p.evaluate(() => __t(__A('.qst .qx')[2].querySelector('.num'))), n: await p.evaluate(() => __A('.qst .qx').length) };
await click(p, '.sb[data-v="torrenter"]');
X.err = await p.evaluate(() => __t(__R('.qt[data-key="qt-errored"] .qn')));
ok('E manglende entitet → «–», flisen beholdes', X.ratio === '–' && X.n === 6 && X.err === '–', X);
// chip-varianter
await p.evaluate(() => window.__set({ 'sensor.qbittorrent_connection_status': { state: 'firewalled' } }));
await wait(p, 150);
X = await p.evaluate(() => ({ t: __t(__R('.hero .chip')), c: __R('.hero .chip').className }));
await p.evaluate(() => window.__set({ 'sensor.qbittorrent_connection_status': { state: 'disconnected' } }));
await wait(p, 150);
X.d = await p.evaluate(() => __t(__R('.hero .chip')));
ok('E chip: «Brannmur» / «Frakoblet» oransje', X.t === 'Brannmur' && /warn/.test(X.c) && X.d === 'Frakoblet', X);
await p.close();

/* ---------------- E · overrides, kortvelger-ring, hele integrasjonen mangler */
p = await page({ start_tab: 'qbit', overrides: { qbit_down: 'sensor.qbittorrent_upload_speed_limit' } }, { fix: true });
X = await p.evaluate(() => ({ on: (__R('.trow .tb.on') || {}).dataset?.v, big: __t(__R('.hero .big')) }));
ok('E overrides.qbit_down (Tilpass/GUI) brukes i stedet for autovalget', X.on === 'qbit' && X.big === '5,0', X);
await p.close();
p = await page({ velger: 'kort' }, { fix: true });
X = await p.evaluate(() => { const c = __R('.hc[data-v="qbit"]'); return { n: __A('.hcards .hc').length, sub: __t(c.querySelector('.hcb span')), dash: c.querySelector('.rfl').getAttribute('stroke-dasharray'), dot: c.querySelector('.dot').className }; });
ok('E kortvelger: qBittorrent-kort «9,2 MB/s ned», ring 46 % (100 % = 20 MB/s), grønn prikk', X.n === 5 && X.sub === '9,2 MB/s ned' && X.dash === `${(0.46 * 106.8).toFixed(1)} 106.8` && /ok/.test(X.dot), X);
await p.close();
p = await page({}, { fix: false });
X = { tabs: await tabs(p) };
await p.close();
p = await page({ qbit_force: true }, { fix: false });
X.forced = await tabs(p);
await click(p, '.tb[data-v="qbit"]', 400);
X.chip = await p.evaluate(() => __t(__R('.hero .chip')));
X.big = await p.evaluate(() => __t(__R('.hero .big')));
X.tiles = await p.evaluate(() => __A('.qt .qn').map(__t).join());
ok('E uten qBittorrent-integrasjon: fanen skjult automatisk; qbit_force viser den («–» overalt, ingen mock)', X.tabs.join() === 'net,proxmox,unraid,ha' && X.forced.join() === 'net,proxmox,unraid,ha,qbit' && X.chip === 'Ikke koblet' && X.big === '–' && X.tiles === '–,–,–,–', X);
// Tilpass: Faner har «Vis qBittorrent-fanen …», Avansert har qBittorrent- og SpeedTest-seksjonene
await p.evaluate(() => window.__c.customize('qbit'));
await wait(p, 700);
X = await p.evaluate(() => { const o = window.MSH.portals().pop(), er = o && o.shadowRoot && o.shadowRoot.querySelector('msh-editor'); const r = er && er.shadowRoot; if (!r) return null; return { q: !!r.querySelector('[data-name="overrides.qbit_down"]') || /Hastighet ned/.test(r.textContent), st: /Internett \(SpeedTest\)/.test(r.textContent), alt: /Alternativ hastighet \(bryter\)/.test(r.textContent) }; });
ok('E/G Tilpass Server → Avansert: qBittorrent- og SpeedTest-entiteter kan overstyres', X && X.q && X.st && X.alt, X);
await p.close();
X = await (async () => {
  const q = await b.newPage();
  await q.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await q.addScriptTag({ path: m });
  await q.addScriptTag({ path: FIX });
  await q.addScriptTag({ path: bundle });
  const r = await q.evaluate(async () => {
    const el = customElements.get('msh-server-card').getConfigElement(); el.hass = window.mockHass(); el.setConfig({ type: 'custom:msh-server-card', card_id: 'x' }); document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 300));
    const sr = el.shadowRoot, txt = () => sr.textContent;
    const tabsT = [...sr.querySelectorAll('[data-a="tab"]')];
    const fan = tabsT.find((t) => /Faner/.test(t.textContent)); if (fan) fan.click(); await new Promise((r) => setTimeout(r, 200));
    const force = /Vis qBittorrent-fanen selv om integrasjonen mangler/.test(txt()), qRow = /qBittorrent/.test(txt());
    const av = [...sr.querySelectorAll('[data-a="tab"]')].find((t) => /Avansert/.test(t.textContent)); if (av) av.click(); await new Promise((r) => setTimeout(r, 200));
    return { force, qRow, adv: /Internett \(SpeedTest\)/.test(txt()) && /qBittorrent/.test(txt()) };
  });
  await q.close(); return r;
})();
ok('E GUI-editor (getConfigElement): Faner har qBittorrent + «Vis qBittorrent-fanen …», Avansert har seksjonene', X.force && X.qRow && X.adv, X);

/* ================================================================ F · fanelinjen som karusell */
p = await page({}, { fix: true });
const car = () => p.evaluate(() => {
  const sc = __R('.trow .tabs'), cs = getComputedStyle(sc), bs = __A('.trow .tb'), r = sc.getBoundingClientRect();
  return { sw: sc.scrollWidth, cw: sc.clientWidth, sl: Math.round(sc.scrollLeft), snap: cs.scrollSnapType, ta: cs.touchAction, osb: cs.overscrollBehaviorX, sbw: cs.scrollbarWidth, ox: cs.overflowX, fade: sc.dataset.fade, mask: sc.style.maskImage || sc.style.webkitMaskImage,
    tb: bs.map((x) => { const c = getComputedStyle(x); return { w: Math.round(x.getBoundingClientRect().width), fl: c.flexGrow + ' ' + c.flexShrink, mw: c.minWidth, pad: c.paddingLeft, sa: c.scrollSnapAlign }; }),
    act: (() => { const a = __R('.trow .tb.on'), ar = a.getBoundingClientRect(); return { v: a.dataset.v, off: Math.round((ar.left + ar.width / 2) - (r.left + r.width / 2)) }; })(),
    gear: (() => { const g = __R('.trow .gear').getBoundingClientRect(); return Math.round(g.right) <= Math.round(__R('.trow').getBoundingClientRect().right) && g.left >= r.right; })(),
    page: document.scrollingElement.scrollWidth <= window.innerWidth, track: getComputedStyle(__R('.tbox')).backgroundColor };
});
X = await car();
ok('F karusell: 5 faner flyter over (390 px) → scroll, flex 1 0 auto, min 84, padding 0 16, snap x proximity / center', X.sw > X.cw + 10 && X.ox === 'auto' && /^x( proximity)?$/.test(X.snap) && X.tb.every((t) => t.fl === '1 0' && t.mw === '84px' && t.pad === '16px' && t.sa.includes('center') && t.w >= 84), X);
ok('F karusell: skjult scrollbar, overscroll-behavior-x contain, touch-action pan-x, spor #3a3a3a, tannhjul fast til høyre, ingen sideveis side-scroll', X.sbw === 'none' && X.osb === 'contain' && X.ta === 'pan-x' && X.track === 'rgb(58, 58, 58)' && X.gear && X.page, X);
ok('F fade: bare høyre kant ved start (venstre har ingen skjult innhold)', X.sl === 0 && X.fade === 'r' && /transparent 100%/.test(X.mask) && !/transparent 0/.test(X.mask), { fade: X.fade, mask: X.mask });
await p.evaluate(() => { const sc = __R('.trow .tabs'); sc.style.scrollSnapType = 'none'; sc.scrollLeft = Math.round((sc.scrollWidth - sc.clientWidth) / 2); });
await wait(p, 120);
X = await car();
await p.evaluate(() => { __R('.trow .tabs').style.scrollSnapType = ''; });
ok('F fade: midt i → begge kanter (oppdateres ved scroll)', X.fade === 'lr' && X.sl > 2 && /transparent 0/.test(X.mask) && /transparent 100%/.test(X.mask), { fade: X.fade, sl: X.sl });
await p.evaluate(() => { const sc = __R('.trow .tabs'); sc.scrollLeft = sc.scrollWidth; });
await wait(p, 120);
X = await car();
ok('F fade: helt til høyre → bare venstre kant', X.fade === 'l', { fade: X.fade, sl: X.sl, sw: X.sw, cw: X.cw });
await p.evaluate(() => { const sc = __R('.trow .tabs'); sc.scrollLeft = 0; });
await clearCalls(p);
await click(p, '.tb[data-v="ha"]', 900);
X = await car();
const hap1 = await p.evaluate(() => window.__hap.slice());
ok('F trykk på fane → aktiv + sentrert (smooth scroll), én haptic', X.act.v === 'ha' && Math.abs(X.act.off) <= 2 && X.sl > 0 && hap1.length === 1, { act: X.act, sl: X.sl, hap: hap1 });
// ingen lekkasje til popupen (fallgruve 2)
X = await p.evaluate(() => {
  const got = []; const bc = document.querySelector('bubble-card');
  ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => bc.addEventListener(t, () => got.push(t)));
  const tb = __R('.tb[data-v="unraid"]'), sc = __R('.trow .tabs');
  tb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 9, pointerType: 'touch', isPrimary: true }));
  tb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 9, pointerType: 'touch', isPrimary: true }));
  try {
    const t = new Touch({ identifier: 3, target: tb, clientX: 10, clientY: 10 });
    tb.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [t], changedTouches: [t] }));
    tb.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t], changedTouches: [t] }));
    tb.dispatchEvent(new TouchEvent('touchend', { bubbles: true, composed: true, touches: [], changedTouches: [t] }));
    sc.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t], changedTouches: [t] }));
  } catch (e) { got.push('err:' + e.message); }
  return got;
});
ok('F gester: pointerdown/touchstart/touchmove på fanelinjen når aldri popupen (stopPropagation)', X.length === 0, X);
await wait(p, 600);
// bredere popup: alt får plass → ingen fade, fanene fyller bredden likt
await p.setViewportSize({ width: 900, height: 900 });
await wait(p, 400);
X = await car();
ok('F uten overflyt (900 px): ingen fade (oppdateres ved resize), fanene fyller bredden', X.sw <= X.cw + 1 && X.fade === '' && (X.mask === 'none' || X.mask === '') && Math.abs(X.tb.reduce((a, t) => a + t.w, 0) + 4 * 2 + 8 - X.cw) <= 6, { sw: X.sw, cw: X.cw, fade: X.fade, w: X.tb.map((t) => t.w) });
await p.setViewportSize({ width: 390, height: 900 });
await wait(p, 400);
// hold + dra (mus): første fane helt til høyre kant → auto-scroll + ny rekkefølge lagret i tab_order
await p.evaluate(() => { __R('.trow .tabs').scrollLeft = 0; });
await wait(p, 200);
const r0 = await p.evaluate(() => { const b = __R('.tb[data-v="net"]').getBoundingClientRect(), s = __R('.trow .tabs').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, right: s.right }; });
await p.mouse.move(r0.x, r0.y);
await p.mouse.down();
await wait(p, 520);
for (let i = 1; i <= 12; i++) { await p.mouse.move(r0.x + ((r0.right - 6 - r0.x) * i) / 12, r0.y); await wait(p, 30); }
const slMid = await p.evaluate(() => Math.round(__R('.trow .tabs').scrollLeft));
await wait(p, 700);
await p.mouse.up();
await wait(p, 700);
X = { slMid, order: await tabs(p), cfg: await p.evaluate(() => (window.__c._rawConfig.tab_order || []).join()) };
ok('F hold + dra omorganiserer fortsatt (auto-scroll mot kanten, lagret i tab_order)', X.slMid > 0 && X.order[0] !== 'net' && X.order.indexOf('net') >= 3 && X.cfg.split(',').indexOf('net') >= 3, X);
await shot(p, 'karusell');
await p.close();
// aktiv fane sentrert ved åpning
p = await page({ start_tab: 'ha' }, { fix: true });
X = await car();
ok('F ved åpning: aktiv fane (startfanen HA) sentrert uten animasjon', X.act.v === 'ha' && Math.abs(X.act.off) <= 2, X.act);
await p.close();
// kort-modus: samme karusell
p = await page({ velger: 'kort', start_tab: 'qbit' }, { fix: true });
X = await p.evaluate(() => { const sc = __R('.hcards'), cs = getComputedStyle(sc), a = __R('.hc.on'), r = sc.getBoundingClientRect(), ar = a.getBoundingClientRect();
  return { sw: sc.scrollWidth, cw: sc.clientWidth, ox: cs.overflowX, ta: cs.touchAction, snap: cs.scrollSnapType, fade: sc.dataset.fade, act: a.dataset.v, edge: Math.round(sc.scrollLeft + sc.clientWidth - sc.scrollWidth), tr: !!sc.__tabReorder }; });
ok('F kortvelger (velger: kort): karusell når kortene ikke får plass, aktiv inn i bildet, fade, omorganisering', X.sw > X.cw && X.ox === 'auto' && X.ta === 'pan-x' && /^x( proximity)?$/.test(X.snap) && X.act === 'qbit' && X.edge === 0 && X.fade === 'l' && X.tr, X);
await p.close();

/* ================================================================ G · Internett-kortet (SpeedTest) + K · underfaner */
p = await page({}, { fix: true });
X = await p.evaluate(() => ({ subs: __A('.subs .sb').map(__t), keys: __A('.subs .sb').map((x) => x.dataset.v), on: __t(__R('.subs .sb.on')), first: __R('.pane').firstElementChild.className,
  tiles: __A('.wan .wt').map((t) => __t(t.querySelector('.wl')) + ' ' + __t(t.querySelector('.wv .num')) + ' ' + __t(t.querySelector('.wv>span:last-child'))), title: __t(__R('.wan .ct')), meta: __t(__R('.wan .wmeta')), btn: __t(__R('.wan .strun')), btnBg: getComputedStyle(__R('.strun')).backgroundImage, btnH: __R('.strun').getBoundingClientRect().height,
  hm: new Date(window.__h.states['sensor.speedtest_download'].last_updated).toTimeString().slice(0, 5) }));
ok('K underfaner: UDM · Enheter · Switch, UDM først', X.subs.join() === 'UDM,Enheter,Switch' && X.keys.join() === 'udm,enheter,switch' && X.on === 'UDM', X);
ok('G Internett-kort øverst i UDM: Ned 912 / Opp 486 Mbit/s (SpeedTest, avrundet)', /card wan/.test(X.first) && X.title === 'Internett' && X.tiles.join('|') === 'Ned 912 Mbit/s|Opp 486 Mbit/s', X);
ok('G meta: «Ping 6 ms · målt HH:MM» (i dag) + rosa «Kjør test» 32 px', X.meta === `Ping 6 ms · målt ${X.hm}` && X.btn === 'Kjør test' && /gradient/.test(X.btnBg) && X.btnH === 32, X);
X = await p.evaluate(() => { const f = MSH.server.maltTxt, now = new Date(2026, 9, 4, 15, 0); return [f(new Date(2026, 9, 4, 14, 10).toISOString(), now), f(new Date(2026, 9, 3, 22, 10).toISOString(), now), f(new Date(2026, 9, 3, 8, 5).toISOString(), new Date(2026, 9, 5, 9, 0)), f(new Date(2026, 0, 31, 9, 0).toISOString(), now)]; });
ok('G «målt»-varianter: «14:10» · «i går 22:10» · «3. okt» · «31. jan»', X.join('|') === '14:10|i går 22:10|3. okt|31. jan', X);
await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(22, 10, 0, 0); window.__set({ 'sensor.speedtest_download': { last_updated: d.toISOString() } }); });
await wait(p, 200);
ok('G meta i går: «Ping 6 ms · målt i går 22:10»', (await p.evaluate(() => __t(__R('.wan .wmeta')))) === 'Ping 6 ms · målt i går 22:10', await p.evaluate(() => __t(__R('.wan .wmeta'))));
await clearCalls(p);
await click(p, '.wan .wt[data-key="wt-Ned"]');
await click(p, '.wan .wmeta');
X = await p.evaluate(() => window.__more.slice());
ok('G trykk på flis → more-info download, ping-teksten → more-info ping', X.join() === 'sensor.speedtest_download,sensor.speedtest_ping', X);
await clearCalls(p);
await click(p, '.wan .strun', 200);
X = await p.evaluate(() => ({ c: window.__calls.filter((c) => c[0] !== 'ws').map((c) => `${c[0]}.${c[1]}:${JSON.stringify(c[2])}`), hap: window.__hap.slice(), meta: __t(__R('.wan .wmeta')), tiles: __A('.wan .wt .num').map(__t), run: __R('.strun').classList.contains('run'), dis: __R('.strun').disabled, bg: getComputedStyle(__R('.strun')).backgroundColor, img: getComputedStyle(__R('.strun')).backgroundImage }));
ok('G «Kjør test» → homeassistant.update_entity på de tre sensorene, haptic «medium» (én)', X.c.length === 1 && X.c[0] === 'homeassistant.update_entity:{"entity_id":["sensor.speedtest_download","sensor.speedtest_upload","sensor.speedtest_ping"]}' && X.hap.join() === 'medium', X);
ok('G under måling: «–» i flisene, «Måler …», grå knapp (deaktivert)', X.tiles.join() === '–,–' && X.meta === 'Måler …' && X.run && X.dis && X.img === 'none' && /64, 64, 64/.test(X.bg), X);
await clearCalls(p);
await click(p, '.wan .strun', 100);
ok('G nytt trykk under måling gjør ingenting', (await calls(p)).length === 0, await calls(p));
await p.evaluate(() => { const t = new Date().toISOString(); window.__set({ 'sensor.speedtest_download': { state: '934.7', last_updated: t }, 'sensor.speedtest_upload': { state: '491.2', last_updated: t }, 'sensor.speedtest_ping': { state: '5', last_updated: t } }); });
await wait(p, 300);
X = await p.evaluate(() => ({ hap: window.__hap.slice(), toast: window.__toast.slice(), tiles: __A('.wan .wt .num').map(__t), meta: __t(__R('.wan .wmeta')), run: __R('.strun').classList.contains('run') }));
ok('G ferdig: nye verdier, haptic «success» + toast «Speedtest ferdig»', X.hap.join() === 'success' && X.toast.includes('Speedtest ferdig') && X.tiles.join() === '935,491' && /^Ping 5 ms · målt \d\d:\d\d$/.test(X.meta) && !X.run, X);
// speedtestdotnet.speedtest når tjenesten finnes
await clearCalls(p);
await p.evaluate(() => { window.__h = { ...window.__h, services: { speedtestdotnet: { speedtest: {} }, homeassistant: { update_entity: {} } } }; window.__c.hass = window.__h; });
await click(p, '.wan .strun', 150);
ok('G «Kjør test» bruker speedtestdotnet.speedtest når tjenesten finnes', (await calls(p)).join() === 'speedtestdotnet.speedtest:{}', await calls(p));
await shot(p, 'internett');
// legacy UI-tilstand «internett» → UDM
await p.evaluate(() => { window.__c.setUI({ sub: { net: 'internett' } }); });
await wait(p, 200);
ok('K lagret underfane «internett» (før Fiks 50) → UDM', (await p.evaluate(() => __t(__R('.subs .sb.on')))) === 'UDM');
await p.close();
// mangler SpeedTest → «–» + «Velg entitet», knappen grå
p = await page({}, { fix: false });
X = await p.evaluate(() => ({ tiles: __A('.wan .wt .num').map(__t), meta: __t(__R('.wan .wmeta')), dis: __R('.strun').disabled }));
ok('G uten SpeedTest-integrasjon: «–» + «Velg entitet», ingen mock, knappen deaktivert', X.tiles.join() === '–,–' && X.meta === '– · Velg entitet' && X.dis, X);
await p.close();

/* ================================================================ K · M.serverUnifi (S2) via vert-grensesnittet */
p = await page({}, { fix: true, su: true });
X = await p.evaluate(() => ({ kids: [...__R('.pane').children].map((x) => x.className), bind: window.__suBind.slice(), prose: __t(__R('.prose')), css: [...__c.shadowRoot.querySelectorAll('style')].some((s) => s.textContent.includes('.su-box')) }));
ok('K UDM: Internett-kortet øverst, så M.serverUnifi.html(host, «udm», R); bind kalles; CSS i shadow-roten; prosa fra M.serverUnifi', X.kids.length === 2 && /wan/.test(X.kids[0]) && /su-udm/.test(X.kids[1]) && X.bind.includes('udm') && X.css && X.prose === 'Prosa fra serverUnifi.', X);
await click(p, '.sb[data-v="enheter"]');
X = { en: await p.evaluate(() => [...__R('.pane').children].map((x) => x.className).join()) };
await click(p, '.sb[data-v="switch"]');
X.sw = await p.evaluate(() => [...__R('.pane').children].map((x) => x.className).join());
X.bind = await p.evaluate(() => window.__suBind.slice(-1)[0]);
ok('K Enheter / Switch tegnes av M.serverUnifi', X.en === 'su-box su-enheter' && X.sw === 'su-box su-switch' && X.bind === 'switch', X);
X = await p.evaluate(async () => {
  const H = window.__host, out = { has: ['hass', 'config', 'ui', 'setUI', 'render', 'haptic', 'moreInfo', 'setCfg', 'go', 'confirm'].every((k) => k in H) };
  H.go('net', 'udm'); await new Promise((r) => setTimeout(r, 150));
  out.udm = __t(__R('.subs .sb.on'));
  H.go('net', 'switch', { dev: 'dev_usw' }); await new Promise((r) => setTimeout(r, 150));
  out.sw = __t(__R('.subs .sb.on')); out.dev = H.ui.dev; out.swSel = H.ui.swSel;
  H.moreInfo('sensor.udm_pro_state'); out.more = window.__more.slice(-1)[0];
  const pr = H.confirm('Slå av port 5? Enheten mister nett.');
  await new Promise((r) => setTimeout(r, 400));
  const o = MSH.portals().pop(), r = o && o.shadowRoot; out.ctext = r && (r.querySelector('.cf p') || {}).textContent;
  r.querySelector('[data-c="1"]').click(); out.yes = await pr;
  const pr2 = H.confirm('Start på nytt?'); await new Promise((r) => setTimeout(r, 400));
  MSH.portals().pop().shadowRoot.querySelector('[data-c="0"]').click(); out.no = await pr2;
  await H.setCfg({ show_prose: false }); await new Promise((r) => setTimeout(r, 200)); out.prose = !!__R('.prose');
  return out;
});
ok('K vert-grensesnitt: go(tab, sub, extra), moreInfo, confirm → Promise<bool> (portalt ark), setCfg lagrer', X.has && X.udm === 'UDM' && X.sw === 'Switch' && X.dev === 'dev_usw' && X.swSel === 'dev_usw' && X.more === 'sensor.udm_pro_state' && X.ctext === 'Slå av port 5? Enheten mister nett.' && X.yes === true && X.no === false && X.prose === false, X);
await p.close();

ok('ingen sidefeil', errs.length === 0, errs.slice(0, 5));
} catch (e) { fail.push('krasj: ' + e.message); console.error(e); }
await b.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '✔' : '✘', k, v === 'OK' ? '' : JSON.stringify(v[1]));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlle OK');
process.exit(fail.length ? 1 : 0);
