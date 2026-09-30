/* KI MSH · felles søkbar ikonvelger (Fiks 15.7). Referanse: design/ha-picker.js (HAPick.icon).
 * Brukes i dashbordets egne ark («Tilpass navbar», inline msh-editor, popup-editoren …). I HAs GUI-editor (ikke-inline
 * msh-editor) brukes HAs egen ha-icon-picker i stedet.
 *
 * Arket (MSH.overlay i ki-overlay-root): søkefelt → faner per ikonsett (MDI · hass · phu · hue · fapro · si · Alle, Fiks 17.8)
 * → «Nylig brukt» (ki-store icon_recent + localStorage, maks 12) → virtualisert rutenett (6 kolonner, 48 px-celler, <ha-icon>)
 * → «Skriv inn selv» (fritekst med live forhåndsvisning). Trykk velger og lagrer full ID (mdi:robot-vacuum).
 * Søket (debounce 120 ms) matcher navn og nøkkelord (mdi: aliaser + tagger; egne sett: keywords), uten at man skriver
 * prefikset, og forstår noen norske ord (støvsuger → robot-vacuum, seng → bed …). Skriver man «prefiks:navn» tilbys «Bruk …».
 *
 * Ikonlister – lastes lazy første gang arket åpnes og mellomlagres i minnet (lasting deles mellom alle velgere):
 *   mdi  → @mdi/svg meta.json fra jsDelivr (MDI_META, samme versjon som design/ha-picker.js): navn + aliaser + tagger.
 *          Valgt fordi HA ikke eksponerer sin egen ikonliste: ha-icon-picker importerer build/mdi/iconList.json som en
 *          hash-navngitt JS-chunk (ingen stabil URL), og /static/mdi/*.json er bare sti-chunker uten nøkkelord.
 *          Fila er versjonert og immutable → nettleserens HTTP-cache gjør senere lastinger gratis.
 *          Feiler hentingen (offline / blokkert CDN) → innebygd liste (FALLBACK, ~200 vanlige ikoner) + fritekst.
 *   egne → window.customIcons[prefix].getIconList() (HA-standard for egne sett: [{ name, keywords? }] eller strenger).
 *          Prefiks som bare finnes i window.customIconsets (ingen liste) får en chip med «skriv navnet»-hint.
 *
 * API (window.MSH.iconPicker):
 *   open({ value, onPick(icon), title }) → Promise<full ID | '' (tømt) | null (avbrutt)> med .close()
 *       – åpner arket; onPick (alias onChange/onSelect) kalles også ved valg. Brukes av popup-editoren (28) via Promise.
 *   html({ name, value, placeholder, key, attrs })   → '<msh-icon-field …>' (morph-trygg: data-nomorph + data-key)
 *   load() → Promise<[{ prefix, label, icons: [{ n, k }] | null }]>   · search(q, prefix) → Promise<[full ID]>
 *   recent() → [full ID] · addRecent(id)             · tag: 'msh-icon-field'
 * <msh-icon-field value placeholder>: viser ikon + navn, × tømmer, trykk åpner arket. Hendelse: value-changed { value }
 *   (bubbles, composed) – msh-editor lagrer den via data-name, andre verter lytter selv.
 */
(function () {
  const M = window.MSH;
  if (!M || M.iconPicker) return;
  const esc = M.esc;
  const MDI_META = 'https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/meta.json';
  const RECENT_KEY = 'ki:icons:recent', RECENT_MAX = 12, RECENT_STORE = 'icon_recent'; // Fiks 17.8: maks 12, ki-store (synkes)
  const COLS = 6, CELL = 48, GAP = 8, ROW = CELL + GAP;
  // Fiks 17.8: fanene i fast rekkefølge MDI · hass · phu · hue · fapro · si (· andre sett) · Alle. Faner uten sett skjules.
  const TAB_ORDER = ['mdi', 'hass', 'phu', 'hue', 'fapro', 'si'];
  const RX = /^([a-z][a-z0-9_-]*):([a-z0-9][a-z0-9_-]*)$/;
  const KNOWN = { mdi: 'Material Design', hass: 'hass', phu: 'Custom Brand Icons', hue: 'Hue Icons', fapro: 'Font Awesome Pro', fab: 'Font Awesome Brands', fas: 'Font Awesome', si: 'Simple Icons', bha: 'Bubble / HA' };
  const FALLBACK = ('home home-outline sofa bed bed-outline lightbulb lightbulb-outline lightbulb-group lamp ceiling-light floor-lamp desk-lamp led-strip door door-open door-closed garage garage-open gate '
    + 'window-closed window-open blinds curtains roller-shade thermometer thermostat radiator fire snowflake fan air-conditioner air-purifier water water-percent water-pump water-boiler '
    + 'television speaker cast music play pause lock lock-open shield-home shield alarm-light cctv camera video bell doorbell motion-sensor smoke-detector '
    + 'car car-electric ev-station ev-plug-type2 flash lightning-bolt solar-power solar-panel battery battery-charging power power-plug power-socket-eu meter-electric '
    + 'pool hot-tub sprinkler sprinkler-variant flower flower-outline leaf tree grass robot-mower robot-vacuum robot washing-machine tumble-dryer dishwasher fridge fridge-outline '
    + 'coffee-maker stove microwave kettle toaster-oven toilet shower bathtub mirror hanger iron vacuum '
    + 'weather-sunny weather-night weather-cloudy weather-partly-cloudy weather-rainy weather-pouring weather-snowy weather-windy weather-fog weather-lightning umbrella '
    + 'calendar calendar-clock clock clock-outline timer alarm bell-ring format-list-checks checkbox-marked-circle-outline trash-can trash-can-outline recycle delete '
    + 'account account-group account-child human-male human-female baby-face dog cat paw map-marker home-map-marker bus train tram bike walk airplane ferry '
    + 'router-wireless wifi lan server desktop-tower laptop cellphone tablet printer gamepad-variant controller-classic '
    + 'star star-outline heart cog tune palette brush chart-line chart-bar gauge speedometer information-outline alert alert-circle help-circle-outline '
    + 'magnify plus minus close check menu dots-horizontal arrow-left arrow-right chevron-down chevron-up link card-outline view-dashboard').split(' ');
  // Norske søkeord → engelske ikonord (mdi-navn/aliaser er engelske)
  const NO_KW = {
    'støvsuger': 'robot-vacuum vacuum', sofa: 'sofa couch', seng: 'bed', soverom: 'bed', stue: 'sofa', kjøkken: 'stove fridge kitchen', bad: 'shower bathtub', dusj: 'shower', toalett: 'toilet',
    lys: 'lightbulb lamp light', lampe: 'lamp lightbulb', taklampe: 'ceiling-light', 'dør': 'door', port: 'gate garage', garasje: 'garage', vindu: 'window', gardin: 'curtains blinds', persienne: 'blinds',
    varme: 'fire radiator heat', ovn: 'radiator stove oven', termostat: 'thermostat', temperatur: 'thermometer', fukt: 'water-percent', vann: 'water', vifte: 'fan', kjøling: 'snowflake air-conditioner',
    tv: 'television', musikk: 'music', 'høyttaler': 'speaker', kamera: 'cctv camera', 'lås': 'lock', alarm: 'shield alarm', ringeklokke: 'doorbell bell', bevegelse: 'motion', røyk: 'smoke',
    bil: 'car', lader: 'ev-station ev-plug', elbil: 'car-electric ev', 'strøm': 'flash lightning power', sol: 'weather-sunny solar', solcelle: 'solar', batteri: 'battery', stikkontakt: 'power-socket power-plug',
    basseng: 'pool', boblebad: 'hot-tub', vanning: 'sprinkler water', hage: 'flower tree grass', plen: 'grass', gressklipper: 'robot-mower mower', blomst: 'flower',
    vaskemaskin: 'washing-machine', 'tørketrommel': 'tumble-dryer', oppvask: 'dishwasher', 'kjøleskap': 'fridge', fryser: 'fridge snowflake', kaffe: 'coffee', mikro: 'microwave',
    regn: 'weather-rainy weather-pouring', 'snø': 'weather-snowy snowflake', vind: 'weather-windy', sky: 'weather-cloudy', 'vær': 'weather', natt: 'weather-night', 'tåke': 'weather-fog', torden: 'weather-lightning',
    kalender: 'calendar', klokke: 'clock', 'søppel': 'trash-can delete recycle', 'gjøremål': 'format-list-checks checkbox', person: 'account human', barn: 'account-child baby', hund: 'dog', katt: 'cat',
    buss: 'bus', tog: 'train', trikk: 'tram', sykkel: 'bike', fly: 'airplane', 'båt': 'ferry boat', hjem: 'home', hus: 'home', kontor: 'desk office', nettverk: 'router wifi lan', ruter: 'router',
    innstillinger: 'cog', stjerne: 'star', hjerte: 'heart',
  };
  const lc = (s) => String(s == null ? '' : s).toLowerCase();

  /* ------------------------------------------------------------ ikonlister */
  let mdiP = null, mdiSrc = '';
  function loadMdi() {
    if (mdiP) return mdiP;
    const fb = () => { mdiSrc = 'fallback'; return FALLBACK.map((n) => ({ n, k: n })); };
    mdiP = (window.fetch ? fetch(MDI_META).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }) : Promise.reject(new Error('fetch')))
      .then((j) => {
        if (!Array.isArray(j) || !j.length) return fb();
        mdiSrc = 'meta';
        return j.filter((x) => x && x.name && !x.deprecated).map((x) => ({ n: x.name, k: lc(x.name + ' ' + (x.aliases || []).join(' ') + ' ' + (x.tags || []).join(' ')) }));
      })
      .catch(() => fb());
    return mdiP;
  }
  const custP = new Map();
  function customSets() {
    const out = {};
    ['customIcons', 'customIconsets'].forEach((g) => { const s = window[g]; if (s && typeof s === 'object') Object.keys(s).forEach((p) => { if (p !== 'mdi' && !(p in out)) out[p] = null; }); });
    const ci = window.customIcons || {};
    Object.keys(ci).forEach((p) => { if (ci[p] && typeof ci[p].getIconList === 'function') out[p] = ci[p]; });
    return out;
  }
  function loadCustom(p, src) {
    if (custP.has(p)) return custP.get(p);
    const pr = Promise.resolve().then(() => src.getIconList()).then((L) => (Array.isArray(L) ? L : []).map((x) => {
      const n = typeof x === 'string' ? x : x && (x.name || x.icon);
      if (!n) return null;
      const nm = String(n).replace(new RegExp('^' + p + ':'), '');
      const kw = x && typeof x === 'object' ? [].concat(x.keywords || [], x.tags || [], x.aliases || []).join(' ') : '';
      return { n: nm, k: lc(nm + ' ' + kw) };
    }).filter(Boolean)).catch(() => []);
    custP.set(p, pr);
    return pr;
  }
  // [{ prefix, label, icons | null }] – null = settet har ingen liste (bare customIconsets)
  function load() {
    const cs = customSets();
    const pfx = Object.keys(cs).sort((a, b) => { const i = TAB_ORDER.indexOf(a), j = TAB_ORDER.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || (a < b ? -1 : 1); });
    return Promise.all([loadMdi(), ...pfx.map((p) => (cs[p] ? loadCustom(p, cs[p]) : Promise.resolve(null)))]).then(([mdi, ...rest]) => [
      { prefix: 'mdi', label: KNOWN.mdi, icons: mdi },
      ...pfx.map((p, i) => ({ prefix: p, label: KNOWN[p] || p, icons: rest[i] })),
    ]);
  }

  // Søk: alle ord må treffe (navn eller nøkkelord, norske ord utvides). Rangering: eksakt navn → starter med → del av navn → nøkkelord.
  function expand(w) {
    const out = [w];
    if (w.length >= 2) Object.keys(NO_KW).forEach((k) => { if (k.startsWith(w)) out.push(...NO_KW[k].split(' ')); });
    return [...new Set(out)];
  }
  function match(sets, q, only) {
    const raw = lc(q).trim();
    const typed = RX.exec(raw.replace(/\s+/g, ''));
    let pfx = only && only !== 'alle' ? only : null, text = raw;
    if (typed || /^[a-z][a-z0-9_-]*:/.test(raw)) { const i = raw.indexOf(':'); const p = raw.slice(0, i); if (sets.some((s) => s.prefix === p)) pfx = p; text = raw.slice(i + 1); }
    const words = text.split(/[\s]+/).filter(Boolean).map(expand);
    const hits = [];
    sets.forEach((s) => {
      if (!s.icons || (pfx && s.prefix !== pfx)) return;
      s.icons.forEach((x) => {
        if (!words.every((alts) => alts.some((w) => x.k.includes(w)))) return;
        let sc = 0;
        if (words.length) {
          const w = words[0][0];
          sc = x.n === w ? 0 : x.n.startsWith(w) ? 1 : ('-' + x.n).includes('-' + w) ? 2 : x.n.includes(w) ? 3 : words[0].some((a) => x.n.includes(a)) ? 4 : 5;
        }
        hits.push({ id: s.prefix + ':' + x.n, sc, l: x.n.length });
      });
    });
    if (words.length) hits.sort((a, b) => a.sc - b.sc || a.l - b.l || (a.id < b.id ? -1 : 1));
    return hits.map((h) => h.id);
  }
  const search = (q, prefix) => load().then((sets) => match(sets, q, prefix));

  // «Nylig brukt»: ki-store (icon_recent, per HA-bruker) med localStorage som cache/reserve
  function recent() {
    let a = null;
    try { a = M.store && M.store.get(RECENT_STORE); } catch (e) { a = null; }
    if (!Array.isArray(a)) { try { a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { a = []; } }
    return Array.isArray(a) ? a.filter((x) => RX.test(x)).slice(0, RECENT_MAX) : [];
  }
  function addRecent(id) {
    if (!RX.test(String(id || ''))) return;
    const l = [id, ...recent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(l)); } catch (e) { /* */ }
    // now: lagres straks også mens «Tilpass Hjem» har et utkast åpent (hører ikke til utkastet)
    try { if (M.store) M.store.set(RECENT_STORE, l, { now: true }); } catch (e) { /* */ }
  }

  /* ------------------------------------------------------------ arket */
  const SHEET_CSS = `
    .sh{display:flex;flex-direction:column;overflow:hidden!important;height:min(680px, calc(100% - 24px - env(safe-area-inset-top, 0px)))}
    .sh>.body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden} /* 26.9: bare .sc scroller */
    .body>*{flex:none}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    input{cursor:text;outline:none;-webkit-user-select:text;user-select:text}
    .hd{display:flex;align-items:center;gap:10px;min-height:40px}
    .hd b{flex:1;font-size:18px;font-weight:500;color:#fafafa}
    .hd .x{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa}
    .sr{display:flex;align-items:center;gap:8px;height:44px;padding:0 6px 0 14px;border-radius:14px;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa;flex:none}
    .sr input{flex:1;min-width:0;height:100%;font-size:16px}
    .sr input::placeholder{color:#7f7f7f}
    .sr .qx{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:#979797}
    .chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;flex:none;padding:0 1px}
    .chips::-webkit-scrollbar{display:none}
    .chip{flex:none;height:32px;padding:0 12px;border-radius:16px;background:var(--ki-sheet-grp,#3a3a3a);font-size:12px;font-weight:500;color:#c7c7c7;white-space:nowrap}
    .chip.on{background:#fafafa;color:#282828}
    .body>.sc{flex:1 1 0;min-height:120px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:none;display:flex;flex-direction:column;gap:10px;padding-bottom:4px}
    .sc::-webkit-scrollbar{display:none}
    .lb{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7f7f7f;padding:0 2px;flex:none}
    .gr{display:grid;grid-template-columns:repeat(${COLS}, ${CELL}px);justify-content:space-between;row-gap:${GAP}px}
    .vg{position:relative;flex:none}
    .vg .gr{position:absolute;left:0;right:0}
    .ic{width:${CELL}px;height:${CELL}px;border-radius:14px;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa;display:grid;place-items:center}
    .ic:active{transform:scale(.94)}
    .ic.on{background:#fafafa;color:#282828}
    .ic ha-icon{--mdc-icon-size:26px;width:26px;height:26px;display:inline-flex}
    .use{min-height:44px;border-radius:22px;background:var(--ki-sheet-grp,#3a3a3a);display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;font-size:13px;color:#fafafa;flex:none}
    .note{font-size:12px;color:#979797;line-height:1.45;padding:0 2px}
    .note b{color:#fafafa;font-weight:500}
    .man{display:flex;gap:8px;align-items:center;flex:none}
    .man .pv{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa}
    .man .pv ha-icon{--mdc-icon-size:24px;width:24px;height:24px;display:inline-flex}
    .manl{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7f7f7f;padding:0 2px;flex:none}
    .man input{flex:1;min-width:0;height:44px;border-radius:14px;padding:0 12px;background:var(--ki-sheet-grp,#3a3a3a);color:#fafafa;font-size:15px}
    .man .ok{height:44px;padding:0 16px;border-radius:22px;background:var(--pink,#f285c9);color:#2f2f2f;font-weight:600;font-size:14px}
    .ft{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:32px}
    .lnk{font-size:13px;color:var(--pink,#f285c9);font-weight:500;padding:6px 2px}
    .cur{font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    :host([data-glass]) .ic:not(.on),:host([data-glass]) .sr,:host([data-glass]) .chip:not(.on),:host([data-glass]) .use,:host([data-glass]) .man input,:host([data-glass]) .man .pv,:host([data-glass]) .hd .x{background:rgba(0,0,0,0.25)}
  `;
  const cellHTML = (id, cur) => `<button class="ic${id === cur ? ' on' : ''}" data-v="${esc(id)}" title="${esc(id)}">${M.icon(id, 24)}</button>`;

  function open(o = {}) {
    const cur = String(o.value || '').trim();
    const cp = (RX.exec(cur) || [])[1];
    const st = { q: '', set: cp || 'mdi', sets: null, hits: [], win: -1 }; // standardfane: settet til nåverdien, ellers MDI
    const S = M.overlay({ css: SHEET_CSS, maxWidth: 440, html: `
      <div class="hd"><b>${esc(o.title || 'Velg ikon')}</b><button class="x" data-p="close" title="Lukk">${M.icon('mdi:close', 20)}</button></div>
      <div class="sr">${M.icon('mdi:magnify', 20, 'color:#7f7f7f')}<input class="q" placeholder="Søk ikon – robot, sofa, støvsuger …" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search"><button class="qx" data-p="qx" title="Tøm">${M.icon('mdi:close-circle', 18)}</button></div>
      <div class="chips"></div>
      <div class="sc"></div>
      <div class="manl">Skriv inn selv</div>
      <div class="man"><span class="pv">${M.icon(cur || 'mdi:help-circle-outline', 24, cur ? '' : 'opacity:.4')}</span><input class="mi" placeholder="prefiks:navn – mdi:sofa, phu:…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(cur)}"><button class="ok" data-p="manok">Bruk</button></div>
      <div class="ft"><span class="cur">${cur ? 'Nå: ' + esc(cur) : 'Ikke valgt'}</span><span style="display:flex;gap:14px">${cur ? '<button class="lnk" data-p="clear">Tøm</button>' : ''}</span></div>` });
    const R = S.root, qi = R.querySelector('.q'), sc = R.querySelector('.sc'), chips = R.querySelector('.chips');
    const cb = o.onPick || o.onChange || o.onSelect;
    let picked = null, resolveP;
    const P = new Promise((r) => { resolveP = r; });
    S.onClosed = () => resolveP(picked); // avbrutt (lukket uten valg) → null
    const done = (v) => { M.haptic('success'); if (v) addRecent(v); picked = v || ''; S.close(); if (cb) cb(v); };
    const drawChips = () => {
      const list = [...(st.sets || [{ prefix: 'mdi', label: KNOWN.mdi }]).map((s) => [s.prefix, s.prefix === 'mdi' ? 'MDI' : s.prefix, s.label]), ['alle', 'Alle', 'Alle ikonsett']];
      chips.innerHTML = list.map(([k, l, t]) => `<button class="chip${st.set === k ? ' on' : ''}" data-p="set" data-v="${esc(k)}" title="${esc(t)}">${esc(l)}</button>`).join('');
    };
    // Virtualisert rutenett: bare radene i synsfeltet (± 4) rendres
    const paintWin = (force) => {
      const vg = sc.querySelector('.vg');
      if (!vg) return;
      const top = sc.scrollTop - vg.offsetTop, h = sc.clientHeight || 500;
      const first = Math.max(0, Math.floor(top / ROW) - 4), last = Math.min(Math.ceil(st.hits.length / COLS), Math.ceil((top + h) / ROW) + 4);
      if (!force && first === st.win && last === st.winL) return;
      st.win = first; st.winL = last;
      const g = vg.querySelector('.gr');
      g.style.top = first * ROW + 'px';
      g.innerHTML = st.hits.slice(first * COLS, last * COLS).map((id) => cellHTML(id, cur)).join('');
    };
    const draw = () => {
      if (!st.sets) { sc.innerHTML = '<div class="note">Laster ikoner …</div>'; return; }
      const raw = st.q.trim(), typed = RX.test(lc(raw).replace(/\s+/g, '')) ? lc(raw).replace(/\s+/g, '') : '';
      st.hits = match(st.sets, raw, st.set);
      const sel = st.sets.find((s) => s.prefix === st.set);
      let html = '';
      if (typed && !st.hits.includes(typed)) html += `<button class="use" data-v="${esc(typed)}">${M.icon(typed, 20)}Bruk «${esc(typed)}»</button>`;
      const rc = recent();
      if (!raw && rc.length) html += `<div class="lb">Nylig brukt</div><div class="gr">${rc.map((id) => cellHTML(id, cur)).join('')}</div>`;
      if (sel && !sel.icons) {
        html += `<div class="note">Settet <b>${esc(sel.label)}</b> har ingen ikonliste i HA. Skriv navnet direkte, f.eks. <b>${esc(sel.prefix)}:${esc(raw.replace(/^\w+:/, '') || 'navn')}</b>, eller bruk «Skriv inn manuelt».</div>`;
        if (raw && !typed) { const g = `${sel.prefix}:${lc(raw).replace(/^\w+:/, '').trim().replace(/\s+/g, '-')}`; html += `<button class="use" data-v="${esc(g)}">${M.icon(g, 20)}Bruk «${esc(g)}»</button>`; }
      } else {
        const rows = Math.ceil(st.hits.length / COLS);
        html += `<div class="lb">${raw ? `${st.hits.length} treff` : `${st.hits.length} ikoner`}${mdiSrc === 'fallback' && (st.set === 'alle' || st.set === 'mdi') ? ' · utvalg (full liste utilgjengelig)' : ''}</div>`;
        html += st.hits.length ? `<div class="vg" style="height:${Math.max(0, rows * ROW - GAP)}px"><div class="gr"></div></div>` : `<div class="note">Ingen treff${raw ? ` for «${esc(raw)}»` : ''}. Prøv et engelsk ord (mdi-navn), eller «Skriv inn manuelt».</div>`;
      }
      sc.innerHTML = html;
      sc.scrollTop = 0; st.win = -1;
      paintWin(true);
    };
    let t = null;
    qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = qi.value; const m = /^([a-z][a-z0-9_-]*):/.exec(lc(st.q)); if (m && st.sets && st.sets.some((s) => s.prefix === m[1]) && st.set !== m[1]) { st.set = m[1]; drawChips(); } draw(); }, 120); });
    sc.addEventListener('scroll', () => paintWin(false), { passive: true });
    // Fiks 26.9: listen eier scroll-gesten (touch, hjul, trackpad) – aldri preventDefault
    ['touchstart', 'touchmove', 'wheel'].forEach((ty) => sc.addEventListener(ty, (e) => e.stopPropagation(), { passive: true }));
    // «Skriv inn selv»: live forhåndsvisning av prefiks:navn
    const mi = R.querySelector('.mi'), pv = R.querySelector('.man .pv');
    mi.addEventListener('input', () => { const v = mi.value.trim(), id = v ? (v.indexOf(':') > 0 ? v : 'mdi:' + v) : ''; pv.innerHTML = M.icon(id || 'mdi:help-circle-outline', 24, id ? '' : 'opacity:.4'); });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); M.haptic('light'); S.close(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      if (e.target.classList.contains('mi')) { const v = e.target.value.trim(); if (v) done(v); return; }
      clearTimeout(t); st.q = qi.value;
      if (st.sets) draw();
      const first = sc.querySelector('[data-v]');
      if (first) done(first.dataset.v);
    };
    R.addEventListener('keydown', onKey);
    R.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n.dataset && (n.dataset.v != null || n.dataset.p));
      if (!b) return;
      const p = b.dataset.p;
      if (!p && b.dataset.v) return done(b.dataset.v);
      if (p === 'close') { M.haptic('light'); return S.close(); }
      if (p === 'qx') { qi.value = ''; st.q = ''; M.haptic('selection'); draw(); qi.focus(); return; }
      if (p === 'set') { st.set = b.dataset.v; M.haptic('selection'); drawChips(); draw(); return; }
      if (p === 'clear') return done('');
      if (p === 'manok') { const v = R.querySelector('.mi').value.trim(); if (v) done(v.indexOf(':') > 0 ? v : 'mdi:' + v); }
    });
    drawChips(); draw();
    requestAnimationFrame(() => { try { qi.focus({ preventScroll: true }); } catch (e) { qi.focus(); } });
    load().then((sets) => { if (S.closed) return; st.sets = sets; if (st.set !== 'alle' && !sets.some((x) => x.prefix === st.set)) st.set = 'mdi'; drawChips(); draw(); });
    P.close = S.close; P.sheet = S;
    return P;
  }

  /* ------------------------------------------------------------ feltet <msh-icon-field> */
  const FIELD_CSS = `
    :host{display:block;font-family:${M.FONT};color:#fafafa;min-width:0}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .f{display:flex;align-items:center;gap:6px;height:var(--msh-if-h,48px);padding:0 4px 0 4px;border-radius:14px;background:var(--msh-if-bg,#282828);min-width:0}
    .pk{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:10px;padding:0 4px;text-align:left}
    .pk:active{transform:scale(.99)}
    .ci{width:38px;height:38px;border-radius:19px;flex:none;display:grid;place-items:center;background:var(--msh-if-ic,#3a3a3a)}
    .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .nm b{font-weight:500;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm i{font-style:normal;font-size:11px;line-height:1.2;color:#7f7f7f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nm.ph b{color:#979797}
    .x{width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;color:#979797}
  `;
  const pretty = (id) => { const n = String(id).split(':').pop().replace(/[-_]+/g, ' '); return n.charAt(0).toUpperCase() + n.slice(1); };
  class MshIconField extends HTMLElement {
    static get observedAttributes() { return ['value', 'placeholder', 'label']; }
    constructor() {
      super();
      const sr = this.attachShadow({ mode: 'open' });
      sr.addEventListener('click', (e) => {
        const b = e.composedPath().find((n) => n.dataset && n.dataset.p);
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.p === 'x') { M.haptic('light'); return this._emit(''); }
        M.haptic('light');
        this._sheet = open({ value: this.value, title: this.getAttribute('label') || 'Velg ikon', onPick: (v) => this._emit(v) });
      });
    }
    get value() { return this.getAttribute('value') || ''; }
    set value(v) { this.setAttribute('value', v || ''); }
    connectedCallback() { this._render(); }
    attributeChangedCallback(n, o, v) { if (o !== v) this._render(); }
    _emit(v) {
      this.setAttribute('value', v || '');
      this.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v || '' }, bubbles: true, composed: true }));
    }
    _render() {
      const v = this.value, ph = this.getAttribute('placeholder') || '';
      const shown = v || ph;
      const html = `<style>${FIELD_CSS}</style><div class="f"><button class="pk" data-p="open" title="Velg ikon"><span class="ci">${M.icon(shown || 'mdi:magnify', 22, v ? '' : 'opacity:.55')}</span>`
        + `<span class="nm${v ? '' : ' ph'}"><b>${esc(v ? pretty(v) : ph ? 'Standard · ' + pretty(ph) : 'Velg ikon …')}</b><i>${esc(v || (ph ? M.iconName(ph) : 'Søk i mdi og egne ikonsett'))}</i></span>${M.icon('mdi:chevron-down', 20, 'color:#979797')}</button>`
        + `${v ? `<button class="x" data-p="x" title="Tøm">${M.icon('mdi:close', 18)}</button>` : ''}</div>`;
      if (!this._did) { this.shadowRoot.innerHTML = html; this._did = true; } else M.morph(this.shadowRoot, html);
    }
  }
  if (!customElements.get('msh-icon-field')) customElements.define('msh-icon-field', MshIconField);

  M.iconPicker = {
    tag: 'msh-icon-field',
    open, load, search, recent, addRecent,
    source: () => mdiSrc,
    // HTML for innbygging i en vert som bruker MSH.morph (data-nomorph: feltet eier sin egen shadow DOM)
    html(o = {}) {
      return `<msh-icon-field data-nomorph ${o.key ? `data-key="${esc(o.key)}"` : ''} ${o.name ? `data-name="${esc(o.name)}"` : ''} value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}"${o.label ? ` label="${esc(o.label)}"` : ''} ${o.attrs || ''}></msh-icon-field>`;
    },
  };
})();
