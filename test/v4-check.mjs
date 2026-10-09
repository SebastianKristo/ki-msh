// Fiks 60 (prompt v4): Rom-slidere · Vær på Android · Planter/Søvn/3D-printer · lik bakgrunn · mini-spiller uten tidslinje for radio.
//  V1 gardin-sliderne: korte navn på én linje med like lange slidere; langt navn → kortere slidere, aldri kuttet; 360 px uten overflyt
//  V2 Vær: Android = klassisk popup med navbar (uansett lagret stil); PC = lagret stil (scene skjuler navbaren)
//  V3 #planter, #sovn, #3d-printer (og aliaset #3d) finnes, står i «Mer», plante-pillen peker på #planter; engelsk uten norske ord
//  V4 popupene har ingen egen bakgrunn (popupens #282828 synes)
//  V5 mini-spilleren: radio uten tidslinje (lavere kort), musikk med varighet beholder den
// Kjør: node test/v4-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/v4-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 Home Assistant/2024.6';

async function page(vp, ua, pre) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  if (pre) await p.evaluate(pre[0], pre[1]);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.pop = async (hash, cfg) => {
      const tag = cfg.type.replace('custom:', '');
      await customElements.whenDefined(tag);
      const bc = document.createElement('bubble-card');
      bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash });
      bc.innerHTML = '<div class="pop"><div class="hdr">x</div><div class="inner"></div></div>';
      document.getElementById('dash').appendChild(bc);
      location.hash = hash;
      const el = document.createElement(tag); el.setConfig(cfg); el.hass = window.H || (window.H = window.mockHass());
      bc.querySelector('.inner').appendChild(el);
      await new Promise((r) => setTimeout(r, 600));
      return el;
    };
  });
  return { p, ctx, errs };
}

/* ---------------- V1 · gardin-sliderne */
const covers = (names) => [(names) => window.mockExtend(({ add, S }) => {
  const ids = names.map((n, i) => { const id = 'cover.stue_v4_' + i; add(id, 'open', { friendly_name: n, current_position: 40 + i * 10, supported_features: 15, device_class: 'curtain' }, { area: 'stue' }); return id; });
  S['sensor.stue_oversikt'].attributes.gardiner = ids;
}), names];
for (const [label, names, w] of [['korte navn', ['Gardiner Høyre', 'Gardiner Venstre', 'Markise Høyre', 'Markise Venstre'], 420], ['langt navn', ['Gardiner Høyre', 'Gardiner Venstre', 'Markise Høyre', 'Markise terrassen mot hagen'], 420], ['360 px', ['Gardiner Høyre', 'Gardiner Venstre', 'Markise Høyre', 'Markise terrassen mot hagen'], 360]]) {
  const { p, ctx, errs } = await page({ width: w, height: 900 }, null, covers(names));
  const r = await p.evaluate(async () => {
    const el = await window.pop('#stue', { type: 'custom:msh-rom-card' });
    el.shadowRoot.querySelector('[data-act="cvx"]').click();
    await new Promise((q) => setTimeout(q, 500));
    const R = el.shadowRoot, box = R.querySelector('.cvbox').getBoundingClientRect();
    const row = (n, s) => { const nr = n.getBoundingClientRect(), sr = s.getBoundingClientRect(), lh = parseFloat(getComputedStyle(n).lineHeight) || 18; return { name: n.textContent.trim(), lines: Math.round(nr.height / lh), cut: n.scrollWidth > n.clientWidth + 1, sl: Math.round(sr.left), sw: Math.round(sr.width), sr: Math.round(sr.right) }; };
    const main = row(R.querySelector('.cvn'), R.querySelector('.cvr .cvs'));
    const subs = [...R.querySelectorAll('.cvr2')].map((x) => row(R.querySelector(`[data-key="${x.dataset.key}"] .cvn2`) || x.querySelector('.cvn2'), R.querySelector(`.cvs[data-id="${x.dataset.key.slice(3)}"]`)));
    const over = [...R.querySelectorAll('.cvbox *')].some((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > box.right + 0.5 || q.left < box.left - 0.5); });
    return { main, subs, over, boxW: Math.round(box.width) };
  });
  const all = [r.main, ...r.subs];
  if (label === 'korte navn') {
    ok('V1 korte navn: alle på én linje, ingen kutt', all.every((x) => x.lines === 1 && !x.cut), all.map((x) => [x.name, x.lines]));
    ok('V1 underradene: sliderne starter og slutter på samme linje (like lange)', new Set(r.subs.map((x) => x.sl)).size === 1 && new Set(r.subs.map((x) => x.sw)).size === 1, r.subs.map((x) => [x.sl, x.sw]));
    ok('V1 sliderne er minst 96 px', all.every((x) => x.sw >= 96), all.map((x) => x.sw));
    globalThis.__shortW = r.subs[0].sw;
  } else {
    ok(`V1 ${label}: navnet kuttes aldri, slider ≥ 96 px, ingen overflyt i kortet`, all.every((x) => !x.cut && x.sw >= 96) && !r.over, { all: all.map((x) => [x.name, x.lines, x.sw]), over: r.over });
    ok(`V1 ${label}: underradene har like lange slidere`, new Set(r.subs.map((x) => x.sw)).size === 1, r.subs.map((x) => x.sw));
    if (label === 'langt navn') ok('V1 langt navn gir kortere slidere for alle underradene', r.subs[0].sw < globalThis.__shortW, { lang: r.subs[0].sw, kort: globalThis.__shortW });
  }
  ok(`V1 ${label}: ingen sidefeil`, !errs.length, errs);
  await ctx.close();
}

/* ---------------- V2 · Vær på Android */
for (const [label, ua, stil, wantScene] of [['Android, lagret scene', ANDROID, 'scene', false], ['Android, lagret klassisk', ANDROID, 'klassisk', false], ['PC, scene', null, 'scene', true], ['PC, klassisk', null, 'klassisk', false]]) {
  const { p, ctx, errs } = await page({ width: 412, height: 900 }, ua);
  const r = await p.evaluate(async (stil) => {
    window.H = window.mockHass();
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = window.H; document.getElementById('dash').appendChild(nb);
    const el = await window.pop('#vaer', { type: 'custom:msh-vaer-card', card_id: 'pop-vaer', style: stil });
    await new Promise((q) => setTimeout(q, 400));
    location.hash = '#vaer';
    nb._syncHide();
    const popEl = el.closest('.pop') || document.querySelector('bubble-card .pop');
    const host = deep('.bubble-pop-up') || popEl;
    return { hl: nb._hideList(), inl: nb._inline, por: !!nb._portal, hash: location.hash, scene: window.MSH.vaerScene(), navHidden: !!(nb._portal && nb._portal.hasAttribute('data-hidden')), cardScene: el.hasAttribute('data-scene'), force: (window.MSH.POPUP_FORCE['#vaer']({ cards: [{ type: 'custom:msh-vaer-card', card_id: 'pop-vaer' }] }) || {}).margin_top_mobile || 'ark', stilLagret: window.MSH.vaerStil() };
  }, stil);
  ok(`V2 ${label}: ${wantScene ? 'scene (helbakgrunn, navbar skjult)' : 'vanlig popup (navbar synlig)'}`, r.scene === wantScene && r.cardScene === wantScene && r.navHidden === wantScene && (ua ? r.force === 'ark' : true), r);
  if (ua) ok(`V2 ${label}: valget er fortsatt lagret`, r.stilLagret === stil, r.stilLagret);
  ok(`V2 ${label}: ingen sidefeil`, !errs.length, errs);
  await ctx.close();
}

/* ---------------- V3 · Planter, Søvn, 3D-printer */
{
  const { p, ctx, errs } = await page({ width: 412, height: 900 });
  const r = await p.evaluate(async () => {
    const M = window.MSH, H = (window.H = window.mockHass());
    const fn = M.FUNCTION_POPUPS.map((x) => x[0]);
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; document.getElementById('dash').appendChild(nb);
    await new Promise((q) => setTimeout(q, 500));
    const ap = M.allPopups(H).map((x) => x.hash);
    return { fn, canon3d: M.canonHash('#3d'), needs: ['#planter', '#sovn', '#3d-printer'].map((h) => !!M.popupNeeds[h](H)), ap, prosa: (M.prosaPlantSteder ? M.prosaPlantSteder(H).length : 0) };
  });
  ok('V3 #planter, #sovn og #3d-printer er funksjons-popups (autogenereres når entitetene finnes)', ['#planter', '#sovn', '#3d-printer'].every((h) => r.fn.includes(h)) && r.needs.every(Boolean), { needs: r.needs });
  ok('V3 #3d er alias for #3d-printer', r.canon3d === '#3d-printer', r.canon3d);
  ok('V3 de tre står i popup-listen (Tilpass alt → Popuper / velgere)', ['#planter', '#sovn', '#3d-printer'].every((h) => r.ap.includes(h)), r.ap);
  const tapSel = async (sel) => { const pt = await p.evaluate((q) => { const e = deep(q); if (!e) return null; const rr = e.getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 }; }, sel); if (pt) await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(450); return !!pt; };
  await tapSel('nav.nb [data-id="__more"]');
  Object.assign(r, await p.evaluate(() => ({ items: deepAll('.mbox .mi').map((e) => e.dataset.id), moreTxt: deepAll('.mbox .mi').map((e) => e.innerText.trim() || e.getAttribute('aria-label') || '').join(' | ') })));
  await tapSel('.mbox .mi[data-id="planter"]');
  r.moreHash = await p.evaluate(() => location.hash);
  ok('V3 «Mer»-menyen har Planter, Søvn og 3D-printer', ['planter', 'sovn', '3d-printer'].every((x) => r.items.includes(x)), { items: r.items, txt: r.moreTxt.slice(0, 200) });
  ok('V3 trykk på Planter i «Mer» åpner #planter', r.moreHash === '#planter', r.moreHash);
  ok('V3 ingen sidefeil (meny)', !errs.length, errs);
  await ctx.close();
}
for (const [hash, tag, cfgs] of [['#planter', 'msh-planter-card', [{}, { start_tab: 'avansert' }]], ['#sovn', 'msh-sovn-card', [{}, { start_tab: 'wake' }]], ['#3d-printer', 'msh-printer-card', [{}, { start_tab: 'adv' }]]]) {
  for (const cfg of cfgs) {
    const { p, ctx, errs } = await page({ width: 412, height: 900 });
    const r = await p.evaluate(async ({ hash, tag, cfg }) => {
      window.kiSetLang('en');
      const el = await window.pop(hash, { type: 'custom:' + tag, card_id: 'v4-' + tag, ...cfg });
      if (el.onOpen) el.onOpen();
      await new Promise((q) => setTimeout(q, 700));
      const NO = /\b(og|ikke|trenger|vannet|siden|sover|våken|vekking|neste|dager|skriver|varmer|igjen|lag|dyse|plate|kammer|hastighet|vifte|jordfukt|næring|merk|enkel|avansert|søvn|strøm|fortsett|stopp|lys)\b/i;
      const left = [];
      const w = document.createTreeWalker(el.shadowRoot, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const pe = n.parentElement; if (!pe || pe.closest('style,[data-noi18n]')) continue; const s = n.nodeValue.trim(); if (s && NO.test(s)) left.push(s); }
      const bg = getComputedStyle(el.shadowRoot.querySelector('.wrap')).backgroundColor, hostBg = getComputedStyle(el).backgroundColor;
      kiSetLang('no'); await new Promise((q) => setTimeout(q, 400));
      return { left, bg, hostBg, txt: el.shadowRoot.querySelector('.wrap').innerText.slice(0, 120) };
    }, { hash, tag, cfg });
    ok(`V3 ${hash} ${JSON.stringify(cfg)}: engelsk uten norske ord`, !r.left.length, r.left);
    ok(`V4 ${hash}: ingen egen bakgrunn på roten (popupens #282828)`, /rgba\(0, 0, 0, 0\)|transparent/.test(r.bg) && /rgba\(0, 0, 0, 0\)|transparent/.test(r.hostBg), [r.bg, r.hostBg]);
    ok(`V3 ${hash}: tilbake til norsk`, /[æøå]|Neste|Vann|Skriver|sover|Søvn|Klar/.test(r.txt), r.txt);
    ok(`V3 ${hash}: ingen sidefeil`, !errs.length, errs);
    await ctx.close();
  }
}

/* ---------------- V5 · mini-spiller: radio uten tidslinje */
{
  const { p, ctx, errs } = await page({ width: 390, height: 844 });
  const r = await p.evaluate(async () => {
    const H = window.mockHass(), S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    const radio = 'media_player.kjokken_radio';
    S[radio] = { ...S[radio], state: 'playing', attributes: { ...S[radio].attributes, media_content_type: 'radio', media_duration: undefined, media_position: 1278, media_position_updated_at: new Date().toISOString() } };
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; document.getElementById('dash').appendChild(nb);
    await new Promise((q) => setTimeout(q, 600));
    const exp = async () => { nb._mExp = radio; nb._mCur = radio; nb._schedule(true); await new Promise((q) => setTimeout(q, 400)); };
    await exp();
    const m = deep('[data-mini]');
    const a = { seek: !!deep('.mseek'), h: Math.round(m.getBoundingClientRect().height), btn: deepAll('.mxb button').length, nsk: m.classList.contains('nsk') };
    // musikk med varighet → tidslinjen er tilbake
    S[radio] = { ...S[radio], attributes: { ...S[radio].attributes, media_content_type: 'music', media_duration: 232, media_position: 84 } };
    nb.hass = { ...H, states: { ...S } };
    await exp();
    const m2 = deep('[data-mini]');
    const bb = { seek: !!deep('.mseek'), h: Math.round(m2.getBoundingClientRect().height) };
    return { a, b: bb };
  });
  ok('V5 radio: ingen tidslinje, lavere kort (124 px), knapperaden er der', !r.a.seek && r.a.h === 124 && r.a.btn >= 3 && r.a.nsk, r.a);
  ok('V5 musikk med varighet: tidslinjen vises (172 px)', r.b.seek && r.b.h === 172, r.b);
  ok('V5 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

await b.close();
console.log(res.join('\n'));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
