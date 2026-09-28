/* KI MSH · Bubble Card-popups: maler, autogenerering og synk av romfarge/-ikon.
 * Mal A = funksjons-popups, Mal B = rom-popups (én per HA-område). Hver popup har nøyaktig ett kort i cards:.
 * - MSH.buildPopups(hass): lager/oppdaterer popups i dashbordet (finnes hashen → bare cards oppdateres,
 *   brukerens styles står urørt; gamle vertical-stack-/flerkort-popups migreres til ett kort).
 * - MSH.syncPopups(lovelaceConfig, lagretKort, hass): kalles av saveCardConfig – romfarge (look.col) og
 *   rom-ikon oppdaterer popupens icon-container / icon i samme lagring.
 */
(function () {
  const M = window.MSH;
  if (!M || M.buildPopups) return;

  const STYLES_A = `.bubble-pop-up-container {
  --vertical-stack-card-gap: 0px!important;
} #header-container > div > div {
  background: var(--gray000)!important;
}
#header-container > button {background: none;}
.icon-container {background-color:var(--gray1000)!important;}
.icon-container > ha-icon {color:var(--black)!important;opacity:1!important}
.bubble-icon {
  --mdc-icon-size: 24px !important;
}
.bubble-name {
  font-size: 30px !important;
  font-weight: 500;
  line-height: 1.4 !important;
  padding: 8px 0 !important;
}
.bubble-close-button {
  background-color: var(--gray200) !important;
  border-radius: 50%;
}
`;
  const stylesB = (col) => `.bubble-pop-up-container {
  --vertical-stack-card-gap: 0px!important;
} #header-container > div > div {
  background: var(--gray200)!important;
}
#header-container > button {background: none;}
.icon-container {background-color:${col}!important;}
.icon-container > ha-icon {color:var(--black)!important;opacity:1!important}
.bubble-icon {
  --mdc-icon-size: 24px !important;
}`;
  const COMMON = { state: null, is_sidebar_hidden: true, margin_top_mobile: '50px', margin_top_desktop: '50px', card_layout: 'large', button_type: 'name', sub_button: { main: [], bottom: [] }, slider_fill_orientation: 'left', slider_value_position: 'right' };
  M.popupTemplateA = ({ name, icon, hash, card }) => ({ type: 'custom:bubble-card', card_type: 'pop-up', name, icon, ...COMMON, hash, styles: STYLES_A, bg_blur: '5', shadow_opacity: '20', bg_opacity: '98', ...((M.POPUP_LOOK && M.POPUP_LOOK[hash]) || {}), cards: card ? [card] : [] }); // POPUP_LOOK: eget utseende per hash (#kart = fullskjerm, 51-kart.js)
  M.popupTemplateB = ({ name, icon, hash, color, card }) => ({ type: 'custom:bubble-card', card_type: 'pop-up', name, icon, ...COMMON, hash, styles: stylesB(color || 'var(--orange)'), bg_blur: '20', shadow_opacity: '20', bg_opacity: '88', cards: card ? [card] : [] });
  // Maler for «Ny popup» i «Tilpass Hjem» → Popups (egne popups kan ha vilkårlige kort i cards:)
  M.newPopupTemplate = function (kind, { name, hash, area, hass } = {}) {
    if (kind === 'rom') {
      const a = (hass && hass.areas && hass.areas[area]) || {};
      return M.popupTemplateB({ name: name || a.name || 'Nytt rom', icon: a.icon || 'mdi:texture-box', hash: hash || '#' + (area || 'rom'), color: M.romColor ? M.romColor(area, hass) : 'var(--orange)', card: { type: 'custom:msh-rom-card', card_id: M.uid(), area } });
    }
    if (kind === 'tom') return { type: 'custom:bubble-card', card_type: 'pop-up', hash: hash || '#ny-popup', name: name || 'Ny popup', icon: 'mdi:card-outline', cards: [] };
    return M.popupTemplateA({ name: name || 'Ny popup', icon: 'mdi:star-outline', hash: hash || '#ny-popup', card: { type: 'markdown', content: 'Innhold her – bytt ut med egne kort.' } });
  };

  // Funksjons-popups i designet (hash → kort). Innholdet = ett kort; toppkortet er innebygd i kortet.
  M.FUNCTION_POPUPS = [
    ['#kamera', 'Kamera', 'mdi:cctv', 'msh-kamera-card'],
    ['#media', 'Media', 'mdi:cast', 'msh-media-card'],
    ['#klima', 'Klima', 'mdi:thermostat', 'msh-klima-card'],
    ['#basseng', 'Basseng', 'mdi:pool', 'msh-basseng-card'],
    ['#ruter', 'Ruter', 'mdi:bus', 'msh-ruter-card'],
    ['#vanning', 'Vanning', 'mdi:sprinkler', 'msh-vanning-card'],
    ['#sikkerhet', 'Sikkerhet', 'mdi:shield-home', 'msh-sikkerhet-card'],
    ['#vaer', 'Vær', 'mdi:weather-partly-cloudy', 'msh-vaer-card'],
    ['#lys', 'Lys', 'mdi:lightbulb-group', 'msh-lys-card'],
    ['#gjoremal', 'Gjøremål', 'mdi:format-list-checks', 'msh-gjoremal-card'],
    ['#dorlas', 'Dørlås', 'mdi:lock', 'msh-las-card'], // fiks 16.7 – bare når lock.* finnes (M.popupNeeds)
    ['#ringeklokke', 'Ringeklokke', 'mdi:doorbell-video', 'msh-ringeklokke-card'], // fiks 19.17 – bare med UniFi Protect-ringeklokke (M.popupNeeds)
    ['#kart', 'Kart', 'mdi:map', 'msh-kart-card'], // fiks 20.22/23.3 – fullskjerm-kart (M.POPUP_LOOK/M.POPUP_FORCE['#kart'], Bubble-header over kartet)
    ['#energi', 'Energi', 'mdi:lightning-bolt', 'msh-energi-card'], // fiks 21.1 – strøm og vann fra HAs Energi-oppsett (52-energi.js)
    ['#kalender', 'Kalender', 'mdi:calendar-month', 'msh-kalender-card'], // fiks 23.8 – kalendere, hytta, Sonarr/Radarr/Plex, bursdager, Posten (55-kalender.js); erstatter den importerte #kalender
  ];
  // Funksjons-popups som bare lages når entitetene finnes (ellers ingen popup, heller ikke via referanser)
  M.popupNeeds = { '#dorlas': (hass) => M.all(hass, 'lock').length > 0, '#ringeklokke': (hass) => !!(M.ringFind && M.ringFind(hass)) };
  const needOk = (hash, hass) => !M.popupNeeds[hash] || !hass || M.popupNeeds[hash](hass);
  // Alle popups som kan velges som mål (navbar, «Mer», Hjem-kort popup_hash, prosa-bobler): [{ hash, name, icon, group, source }]
  // group: rom | fn | egne · source: auto | yaml | custom. Fra siste strategi-generering (MSH.popupReport); uten strategi
  // (manuelt dashbord) → rom/funksjoner/personer fra hass + egne popups i ki-store. opts.hidden: ta med skjulte.
  M.allPopups = function (hass, opts) {
    const R = M.popupReport;
    const inc = (e) => (opts && opts.hidden) || !e.hidden;
    if (R && Array.isArray(R.entries) && R.entries.length) return R.entries.filter(inc).map((e) => ({ hash: e.hash, name: e.name, icon: e.icon, group: e.group, source: e.source, hidden: !!e.hidden }));
    const out = [], seen = new Set();
    const add = (hash, name, icon, group, source) => { if (!hash || seen.has(hash)) return; seen.add(hash); out.push({ hash, name: name || hash, icon: icon || 'mdi:card-outline', group, source }); };
    if (hass) M.areas(hass).forEach((a) => add('#' + a.id, a.name, a.icon || 'mdi:texture-box', 'rom', 'auto'));
    M.FUNCTION_POPUPS.forEach(([h, n, i]) => { if (needOk(h, hass)) add(h, n, i, 'fn', 'auto'); });
    if (hass) M.all(hass, 'person').forEach((p) => add('#person-' + p.split('.')[1], M.name(hass, p), 'mdi:account', 'fn', 'auto'));
    const cp = (M.store && M.store.get('custom_popups')) || [];
    (Array.isArray(cp) ? cp : []).forEach((c) => { if (c && c.hash) add(String(c.hash)[0] === '#' ? c.hash : '#' + c.hash, c.name, c.icon, 'egne', 'custom'); });
    return out;
  };
  // [verdi, etikett]-par for nedtrekkslister (egne popups merkes «Egen · »)
  M.popupOptions = (hass) => M.allPopups(hass).map((p) => [p.hash, (p.group === 'egne' ? 'Egen · ' : '') + p.name]);
  const HERO_OF = () => M.HEROES || {};
  const isPopup = (c) => c && typeof c === 'object' && c.type === 'custom:bubble-card' && c.card_type === 'pop-up';
  const tagOf = (c) => String((c && c.type) || '').replace('custom:', '');

  // Slå sammen gamle kort (hovedkort + separat toppkort) til ett hovedkort; innstillinger flyttes over.
  function mergeCards(cards, mainTag) {
    const list = (cards || []).filter(Boolean);
    const main = list.find((c) => tagOf(c) === mainTag);
    const heroTag = HERO_OF()[mainTag];
    const hero = heroTag && list.find((c) => tagOf(c) === heroTag);
    const out = { ...(hero ? (({ type, card_id, ...r }) => r)(hero) : {}), ...(main || {}), type: 'custom:' + mainTag };
    if (hero && main) {
      const ov = { ...((hero.overrides) || {}), ...((main.overrides) || {}) };
      if (Object.keys(ov).length) out.overrides = ov;
    }
    if (!out.card_id) out.card_id = M.uid();
    return out;
  }
  // vertical-stack [pop-up, …kort] → frittstående pop-up med cards
  function unwrapStack(c) {
    if (c && c.type === 'vertical-stack' && Array.isArray(c.cards) && isPopup(c.cards[0])) {
      const [p, ...rest] = c.cards;
      return { ...p, cards: [...(p.cards || []), ...rest] };
    }
    return c;
  }
  function walk(o, fn, parent, key) {
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) walk(o[i], fn, o, i); return; }
    if (o && typeof o === 'object') { fn(o, parent, key); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') walk(o[k], fn, o, k); }
  }
  function popupsIn(lc) {
    const map = new Map();
    walk(lc, (c, parent, key) => {
      const u = unwrapStack(c);
      if (u !== c && parent) parent[key] = u;
      if (isPopup(u) && u.hash) map.set(u.hash, u);
    });
    return map;
  }
  const areaHasEntities = (hass, id) => {
    const ov = M.kiRom(hass, id, 'oversikt');
    if (ov && Number(ov.state) > 0) return true;
    return Object.keys(hass.entities || {}).some((e) => hass.states[e] && M.areaOf(hass, e) === id);
  };
  // Romfarge/ikon fra eksisterende config (rom-kort look, Hjem-faner rooms.<id>) → ellers standard
  function roomLookFrom(lc, area, hass) {
    let col = null, icon = null;
    walk(lc, (c) => {
      const t = tagOf(c);
      if (t === 'msh-rom-card' && (c.area === area) && c.look) { col = col || c.look.col; icon = icon || c.look.icon; }
      if ((t === 'msh-hjem-faner-card') && c.rooms && c.rooms[area]) { col = col || c.rooms[area].color; icon = icon || c.rooms[area].icon; }
    });
    const a = hass.areas && hass.areas[area], au = M.roomAuto(hass, area);
    return { col: col || (M.romColor ? M.romColor(area, hass) : 'var(--orange)'), icon: icon || (a && a.icon) || (au.A && au.A.ikon) || 'mdi:home' };
  }
  const plainVar = (col) => { const m = /^var\((--[\w-]+)\s*,[^)]*\)$/.exec(String(col || '').trim()); return m ? `var(${m[1]})` : col; };

  // Lag/oppdater alle popups. Returnerer { created, updated }.
  M.buildPopups = async function (hass, { dryRun } = {}) {
    const urlPath = hass.panelUrl && hass.panelUrl !== 'lovelace' ? hass.panelUrl : null;
    let lc;
    try { lc = await hass.callWS({ type: 'lovelace/config', url_path: urlPath, force: true }); } catch (e) { M.toast('Rediger i YAML'); return null; }
    if (!lc || lc.strategy || !Array.isArray(lc.views)) { M.toast('Rediger i YAML'); return null; }
    const existing = popupsIn(lc);
    // målvisning: den som har Hjem/navbar, ellers første sections-visning
    let view = lc.views.find((v) => JSON.stringify(v).includes('msh-hjem-card') || JSON.stringify(v).includes('msh-navbar-card')) || lc.views.find((v) => v.type === 'sections') || lc.views[0];
    if (!view) { view = { title: 'Hjem', path: 'hjem', type: 'sections', sections: [] }; lc.views.push(view); }
    if (view.type === 'sections' || view.sections) {
      view.sections = view.sections || [];
    }
    let target = null;
    const ensureTarget = () => {
      if (target) return target;
      if (view.sections) { target = { type: 'grid', column_span: 1, cards: [] }; view.sections.push(target); }
      else { view.cards = view.cards || []; target = view; }
      return target;
    };
    const res = { created: [], updated: [] };
    const put = (hash, make, mainTag, extra) => {
      const cur = existing.get(hash);
      if (cur) {
        const merged = mergeCards(cur.cards, mainTag);
        if (extra) Object.assign(merged, extra(merged));
        cur.cards = [merged];
        const fx = M.POPUP_FORCE && typeof M.POPUP_FORCE[hash] === 'function' ? M.POPUP_FORCE[hash](cur) : null; // 23.3: #kart-unntaket også på eksisterende popup
        if (fx) { Object.keys(cur).forEach((k) => { if (!(k in fx)) delete cur[k]; }); Object.assign(cur, fx); }
        res.updated.push(hash);
      } else {
        const card = { type: 'custom:' + mainTag, card_id: M.uid(), ...(extra ? extra({}) : {}) };
        ensureTarget().cards.push(make(card));
        res.created.push(hash);
      }
    };
    // Rom (mal B)
    M.areas(hass).filter((a) => areaHasEntities(hass, a.id)).forEach((a) => {
      const look = roomLookFrom(lc, a.id, hass);
      put('#' + a.id, (card) => M.popupTemplateB({ name: a.name, icon: look.icon, hash: '#' + a.id, color: plainVar(look.col), card }), 'msh-rom-card', (m) => (m.area ? {} : { area: a.id }));
    });
    // Funksjoner (mal A)
    M.FUNCTION_POPUPS.forEach(([hash, name, icon, tag]) => { if (needOk(hash, hass)) put(hash, (card) => M.popupTemplateA({ name, icon, hash, card }), tag); });
    // Personer
    M.all(hass, 'person').forEach((pid) => {
      const o = pid.split('.')[1], hash = '#person-' + o;
      put(hash, (card) => M.popupTemplateA({ name: M.name(hass, pid), icon: 'mdi:account', hash, card }), 'msh-person-card', (m) => (m.person ? {} : { person: pid }));
    });
    if (dryRun) return { ...res, config: lc };
    window.__kiSaving = M.saveSnapshot ? M.saveSnapshot() : null;
    try {
      await hass.callWS({ type: 'lovelace/config/save', url_path: urlPath, config: lc });
      M.haptic('success');
      M.toast(`Popups: ${res.created.length} nye, ${res.updated.length} oppdatert`);
    } catch (e) { M.toast('Rediger i YAML'); return null; }
    return res;
  };

  // Romfarge/-ikon endret → oppdater popupen med hash #<area> (styles .icon-container + icon).
  function setRoomLook(lc, area, col, icon) {
    if (!area || (!col && !icon)) return;
    const p = popupsIn(lc).get('#' + area);
    if (!p) return;
    if (icon && p.icon !== icon) p.icon = icon;
    if (col) {
      const v = plainVar(M.color ? M.color(col, col) : col);
      const rx = /(\.icon-container\s*\{\s*background-color\s*:\s*)[^;}]*?(\s*!important)?\s*;/;
      if (typeof p.styles === 'string' && rx.test(p.styles)) p.styles = p.styles.replace(rx, `$1${v}!important;`);
      else p.styles = `${p.styles || ''}\n.icon-container {background-color:${v}!important;}`;
    }
  }
  // Live: romfarge/-ikon lagret i ki-store → oppdater Bubble-popupen som vises nå (strategien bruker det ved neste generering).
  M.syncLivePopups = function (cfg) {
    const t = tagOf(cfg);
    const looks = [];
    if (t === 'msh-rom-card' && cfg.look) looks.push([cfg.area || String(location.hash || '').replace(/^#/, ''), cfg.look.col, cfg.look.icon]);
    if (t === 'msh-hjem-faner-card' && cfg.rooms) Object.keys(cfg.rooms).forEach((a) => looks.push([a, cfg.rooms[a].color, cfg.rooms[a].icon]));
    if (!looks.length) return;
    const bcs = [];
    const w = (r, d) => { if (!r || d > 14 || !r.querySelectorAll) return; r.querySelectorAll('bubble-card').forEach((b) => bcs.push(b)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) w(e.shadowRoot, d + 1); }); };
    w(document, 0);
    looks.forEach(([area, col, icon]) => {
      if (!area || (!col && !icon)) return;
      bcs.forEach((b) => {
        const c = b.config || b._config;
        if (!c || c.card_type !== 'pop-up' || c.hash !== '#' + area) return;
        const lc = { views: [{ cards: [JSON.parse(JSON.stringify(c))] }] };
        setRoomLook(lc, area, col, icon);
        const n = lc.views[0].cards[0];
        if (n.styles !== c.styles || n.icon !== c.icon) { try { b.setConfig(n); } catch (e) { /* */ } }
      });
    });
  };
  M.syncPopups = function (lc, cfg, hass) {
    const t = tagOf(cfg);
    if (t === 'msh-rom-card') {
      let area = cfg.area;
      if (!area) walk(lc, (c) => { if (!area && isPopup(c) && (c.cards || []).some((k) => k && k.card_id === cfg.card_id)) area = String(c.hash || '').replace(/^#/, ''); });
      if (cfg.look) setRoomLook(lc, area, cfg.look.col, cfg.look.icon);
    } else if (t === 'msh-hjem-faner-card' && cfg.rooms) {
      Object.keys(cfg.rooms).forEach((a) => { const r = cfg.rooms[a] || {}; setRoomLook(lc, a, r.color, r.icon); });
    } else if (t === 'msh-hjem-card' && cfg.cards && cfg.cards.faner) {
      M.syncPopups(lc, { ...cfg.cards.faner, type: 'custom:msh-hjem-faner-card' }, hass);
    } else if (t === 'msh-romkort-card' && cfg.area) {
      setRoomLook(lc, cfg.area, cfg.color || (cfg.look && (cfg.look.col || cfg.look.color)), cfg.icon);
    }
  };
})();
