/* KI MSH · Home Assistant-innstillinger, del 2 av de vanlige HA-sidene (bolk 1):
 * historikk, loggbok, kart, energi, media, gjøremål, kalender, Assist og utviklerverktøy.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || M.ha.panels2) return;
  const esc = M.esc, ui = M.ha.ui;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const A = (x, k) => (Array.isArray(x) ? x : x && Array.isArray(x[k]) ? x[k] : []);
  const nameOf = (h, id) => { const s = h && h.states[id]; return (s && s.attributes.friendly_name) || id; };
  const dIcon = (h, id) => (h.states[id] && h.states[id].attributes.icon) || (M.domainIcon ? M.domainIcon(id, h.states[id]) : 'mdi:shape-outline');
  const loc = () => (window.kiLang && window.kiLang() === 'en' ? 'en-GB' : 'nb-NO');
  const tm = (t) => { try { return new Date(typeof t === 'number' ? t * 1000 : t).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const dt = (t) => { try { return new Date(typeof t === 'number' ? t * 1000 : t).toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  const COL = ['#f285c9', '#73b9f2', '#66d19e', '#f2b573', '#ad99e6', '#f2d26f', '#5fc4c4', '#f28073'];
  const ST = { on: 'på', off: 'av', home: 'hjemme', not_home: 'borte', open: 'åpen', closed: 'lukket', locked: 'låst', unlocked: 'ulåst', playing: 'spiller', paused: 'pauset', idle: 'inaktiv', unavailable: 'utilgjengelig' };
  const stn = (s) => T(ST[s] || s);
  const entPick = (key, ph) => (M.entityPicker ? `<div class="fd">${M.entityPicker.html({ key, value: '', mode: 'add', placeholder: ph, attrs: 'data-f="add"' })}</div>` : ui.field({ f: 'add', ph: 'light.stue', mono: true }));

  /* ============================================================ historikk */
  M.ha.page('history', {
    title: () => T('Historikk', 'History'), haPath: '/history',
    async load(c) {
      const s = c.state; if (!s.ids) s.ids = Object.keys(c.h.states).filter((id) => /^(person|light|climate|binary_sensor|lock)\./.test(id)).slice(0, 4); s.hrs = s.hrs || 24;
      const start = new Date(Date.now() - s.hrs * 3600e3).toISOString();
      s.data = s.ids.length ? await c.ws('history/history_during_period', { start_time: start, entity_ids: s.ids, minimal_response: true, no_attributes: true }).catch(() => ({})) : {};
    },
    render(c) {
      const s = c.state, h = c.h; if (!s.data) return ui.spin();
      const now = Date.now(), t0 = now - s.hrs * 3600e3, X = (t) => Math.max(0, Math.min(100, ((t - t0) / (now - t0)) * 100));
      const rows = s.ids.map((id, i) => {
        const L = arr(s.data[id]).map((x) => ({ s: x.s != null ? x.s : x.state, t: (x.lu || x.lc || 0) * 1000 || Date.parse(x.last_changed) })).filter((x) => x.t); const num = L.length && L.every((x) => !isNaN(parseFloat(x.s)));
        let viz;
        if (num && L.length > 1) { const v = L.map((x) => parseFloat(x.s)), mn = Math.min(...v), mx = Math.max(...v), Y = (y) => 36 - ((y - mn) / ((mx - mn) || 1)) * 32; viz = `<svg viewBox="0 0 100 40" preserveAspectRatio="none" class="hgv"><polyline fill="none" stroke="${COL[i % 8]}" stroke-width="2" vector-effect="non-scaling-stroke" points="${L.map((x, k) => `${X(x.t).toFixed(1)},${Y(v[k]).toFixed(1)}`).join(' ')} 100,${Y(v[v.length - 1]).toFixed(1)}"/></svg><div class="hax"><span>${String(mn).replace('.', ',')}</span><span>${String(mx).replace('.', ',')} ${esc((h.states[id] || { attributes: {} }).attributes.unit_of_measurement || '')}</span></div>`; }
        else { const segs = L.map((x, k) => { const x1 = X(x.t), x2 = k < L.length - 1 ? X(L[k + 1].t) : 100; const on = ['on', 'home', 'open', 'unlocked', 'playing', 'heat'].includes(x.s); return `<span style="left:${x1}%;width:${Math.max(0.4, x2 - x1)}%;background:${on ? COL[i % 8] : 'rgb(var(--ki-wa-c,255 255 255)/.12)'}" title="${esc(stn(x.s))}"></span>`; }).join(''); viz = `<div class="htl">${segs}</div>`; }
        return `<div class="hrow"><div class="hh2"><b data-noi18n>${esc(nameOf(h, id))}</b><i data-noi18n>${esc(stn((h.states[id] || {}).state))}</i><button class="bt sm ic" data-a="rm" data-v="${esc(id)}">${ui.ic('mdi:close', 16)}</button></div>${viz}</div>`;
      }).join('');
      return `<div class="chs">${[[1, '1 t'], [6, '6 t'], [24, '24 t'], [168, '7 d']].map(([v, t]) => ui.chip(t, s.hrs === v, 'hrs', v)).join('')}</div>
        ${s.ids.length ? `<div class="card" style="gap:16px">${rows}<div class="hax"><span>${esc(dt(t0))}</span><span>${esc(T('Nå', 'Now'))}</span></div></div>` : ui.empty('mdi:chart-timeline-variant', T('Velg entiteter under', 'Choose entities below'))}
        ${entPick('hadd', T('Legg til entitet', 'Add entity'))}
        <style>.hrow{display:flex;flex-direction:column;gap:6px}.hh2{display:flex;align-items:center;gap:8px}.hh2 b{font-size:14px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hh2 i{font-style:normal;font-size:12px;color:var(--ki-text-mid,#979797)}.htl{position:relative;height:22px;border-radius:11px;overflow:hidden;background:rgb(var(--ki-wa-c,255 255 255)/.05)}.htl span{position:absolute;top:0;bottom:0}.hgv{width:100%;height:56px;display:block}.hax{display:flex;justify-content:space-between;font-size:11px;color:var(--ki-text-3,#7f7f7f)}</style>`;
    },
    input(c, el, v) { if (el.dataset.f === 'add' && v && !c.state.ids.includes(v)) { c.state.ids.push(v); c.state.data = null; c.render(); M.ha.pages.history.load(c).then(() => c.render()); } },
    act(c, a, el) {
      const s = c.state;
      if (a === 'hrs') { s.hrs = Number(el.dataset.v); s.data = null; c.render(); return M.ha.pages.history.load(c).then(() => c.render()); }
      if (a === 'rm') { s.ids = s.ids.filter((x) => x !== el.dataset.v); M.haptic('selection'); return c.render(); }
      return undefined;
    },
  });

  /* ============================================================ loggbok */
  M.ha.page('logbook', {
    title: () => T('Loggbok', 'Logbook'), haPath: '/logbook',
    async load(c) {
      const r = await c.ws('logbook/get_events', { start_time: new Date(Date.now() - 24 * 3600e3).toISOString() }).catch(() => null);
      let L = A(r, 'events');
      if (!L.length) L = Object.values(c.h.states).filter((s) => !/^(sensor|weather|sun|update|zone)\./.test(s.entity_id)).map((s) => ({ entity_id: s.entity_id, state: s.state, when: Date.parse(s.last_changed) / 1000 })).sort((a, b) => b.when - a.when).slice(0, 80);
      c.state.ev = L.sort((a, b) => b.when - a.when);
    },
    render(c) {
      const s = c.state, h = c.h; if (!s.ev) return ui.spin();
      const q = String(s.q || '').toLowerCase(), L = s.ev.filter((e) => !q || ((e.name || nameOf(h, e.entity_id)) + ' ' + (e.entity_id || '') + ' ' + (e.message || '')).toLowerCase().includes(q));
      let last = '';
      const rows = L.slice(0, 200).map((e) => { const d = new Date(e.when * 1000).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' }); const hd = d !== last ? (last = d, `<div class="fo" style="pointer-events:none"><span class="g">${esc(d)}</span></div>`) : ''; return hd + ui.group(ui.row({ a: e.entity_id ? 'mi' : null, v: e.entity_id, icon: e.icon || (e.entity_id ? dIcon(h, e.entity_id) : 'mdi:information-outline'), titleHtml: `<span data-noi18n>${esc(e.name || nameOf(h, e.entity_id))}</span>`, subHtml: `${esc(tm(e.when))} · <span data-noi18n>${esc(e.message || (e.state != null ? T('ble', 'turned') + ' ' + stn(e.state) : ''))}</span>${e.context_user_id ? '' : ''}` })); }).join('');
      return `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="q" value="${esc(s.q || '')}" placeholder="${esc(T('Søk', 'Search'))}" autocomplete="off"></label>${rows || ui.empty('mdi:format-list-bulleted', T('Ingen hendelser', 'No events'))}`;
    },
    input(c, el, v) { if (el.dataset.f === 'q') { c.state.q = v; c.render(); } },
    act(c, a, el) { if (a === 'mi') return M.moreInfo(null, el.dataset.v); return undefined; },
    reload: true,
  });

  /* ============================================================ kart */
  M.ha.page('map', {
    title: () => T('Kart', 'Map'), haPath: '/map', live: false,
    render(c) {
      const h = c.h, P = Object.keys(h.states).filter((id) => /^(person|device_tracker)\./.test(id) && h.states[id].attributes.latitude != null);
      setTimeout(() => this.draw(c), 30);
      return `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"><div class="card" style="padding:0;overflow:hidden;height:340px"><div data-key="map" class="kmap" style="width:100%;height:100%"></div></div>
        ${ui.group(P.map((id) => { const s = h.states[id]; return ui.row({ a: 'fly', v: id, icon: 'mdi:account', title: nameOf(h, id), sub: s.state === 'home' ? T('Hjemme', 'Home') : s.state === 'not_home' ? T('Borte', 'Away') : s.state }); }).join('')) || ui.empty('mdi:map-marker-off', T('Ingen med posisjon', 'Nobody with a location'))}`;
    },
    draw(c) {
      const L = window.L, el = M.ha.current && M.ha.current.root.querySelector('.kmap'); if (!L || !el || el._m) return;
      const h = c.h, cf = h.config || {}, m = L.map(el, { zoomControl: false, attributionControl: false }).setView([cf.latitude || 59.91, cf.longitude || 10.75], 13); el._m = m;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(m);
      const pts = [];
      Object.values(h.states).filter((s) => s.entity_id.startsWith('zone.')).forEach((z) => { const a = z.attributes; if (a.latitude == null) return; L.circle([a.latitude, a.longitude], { radius: a.radius || 100, color: '#f285c9', weight: 2, fillOpacity: 0.12 }).addTo(m); pts.push([a.latitude, a.longitude]); });
      Object.values(h.states).filter((s) => /^(person|device_tracker)\./.test(s.entity_id) && s.attributes.latitude != null).forEach((s, i) => { const a = s.attributes, ll = [a.latitude, a.longitude]; L.marker(ll, { icon: L.divIcon({ className: '', html: `<div style="width:40px;height:40px;border-radius:20px;border:3px solid ${COL[i % 8]};background:#232323 center/cover${a.entity_picture ? ` url('${a.entity_picture}')` : ''};display:grid;place-items:center;color:#fafafa;font:600 15px system-ui">${a.entity_picture ? '' : esc(String(a.friendly_name || '?')[0])}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(m); pts.push(ll); el['_p_' + s.entity_id] = ll; });
      if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      setTimeout(() => m.invalidateSize(), 200); setTimeout(() => m.invalidateSize(), 700);
    },
    act(c, a, el) { if (a === 'fly') { const mp = M.ha.current.root.querySelector('.kmap'), ll = mp && mp['_p_' + el.dataset.v]; if (mp && mp._m && ll) { mp._m.flyTo(ll, 16); M.haptic('selection'); } } return undefined; },
  });

  /* ============================================================ energi */
  M.ha.page('energy', {
    title: () => T('Energi', 'Energy'), haPath: '/energy',
    async load(c) { c.state.prefs = await c.ws('energy/get_prefs').catch(() => null); },
    render(c) {
      const h = c.h, S = h.states, pr = c.state.prefs;
      const by = (dc) => Object.keys(S).filter((id) => S[id].attributes.device_class === dc && !isNaN(parseFloat(S[id].state)));
      const pw = by('power').sort((a, b) => parseFloat(S[b].state) - parseFloat(S[a].state)), en = by('energy');
      const src = pr ? arr(pr.energy_sources) : [], devices = pr ? arr(pr.device_consumption).map((d) => d.stat_consumption) : [];
      const main = pw.find((id) => /hus|house|total|hele|main/.test(id)) || pw[0];
      const fmt = (id) => `${String(Math.round(parseFloat(S[id].state) * 100) / 100).replace('.', ',')} ${esc(S[id].attributes.unit_of_measurement || '')}`;
      return `${main ? `<div class="card" style="align-items:center;padding:22px"><span class="mut">${esc(T('Effekt nå', 'Power now'))}</span><b style="font-size:46px;font-weight:300;letter-spacing:-.03em" data-noi18n>${fmt(main)}</b><span class="mut" data-noi18n>${esc(nameOf(h, main))}</span></div>` : ''}
        ${src.length ? ui.sec(T('Kilder', 'Sources')) + ui.group(src.map((x) => ui.row({ icon: { grid: 'mdi:transmission-tower', solar: 'mdi:solar-power', battery: 'mdi:battery-charging', gas: 'mdi:fire', water: 'mdi:water' }[x.type] || 'mdi:flash', title: T({ grid: 'Strømnett', solar: 'Sol', battery: 'Batteri', gas: 'Gass', water: 'Vann' }[x.type] || x.type), sub: arr(x.flow_from).map((f) => f.stat_energy_from).concat(x.stat_energy_from || []).filter(Boolean).join(', ') })).join('')) : ''}
        ${ui.sec(T('Største forbrukere nå', 'Biggest consumers now'))}${ui.group(pw.slice(0, 12).map((id) => { const v = parseFloat(S[id].state), mx = parseFloat(S[pw[0]].state) || 1; return ui.row({ a: 'mi', v: id, icon: dIcon(h, id), title: nameOf(h, id), subHtml: `<span class="ebar"><i style="width:${Math.max(2, Math.min(100, (v / mx) * 100))}%"></i></span>`, right: `<span class="st0" data-noi18n>${fmt(id)}</span>` }); }).join('')) || ui.empty('mdi:flash-off', T('Ingen effektsensorer', 'No power sensors'))}
        ${en.length ? ui.sec(T('Energimålere', 'Energy meters')) + ui.group(en.filter((id) => !devices.length || devices.includes(id) || src.length === 0).slice(0, 15).map((id) => ui.row({ a: 'mi', v: id, icon: dIcon(h, id), title: nameOf(h, id), right: `<span class="st0" data-noi18n>${fmt(id)}</span>` })).join('')) : ''}
        <style>.ebar{display:block;height:6px;border-radius:3px;background:rgb(var(--ki-wa-c,255 255 255)/.08);margin-top:6px;overflow:hidden}.ebar i{display:block;height:100%;border-radius:3px;background:var(--yellow,#f2d26f)}.st0{font-size:13px;color:var(--ki-text-2,#afafaf);white-space:nowrap}</style>`;
    },
    act(c, a, el) { if (a === 'mi') return M.moreInfo(null, el.dataset.v); return undefined; },
  });

  /* ============================================================ media */
  M.ha.page('media', {
    title: (c) => (c.state.node && c.state.node.title) || T('Media', 'Media'), haPath: '/media-browser',
    async load(c, a) {
      const s = c.state, pl = Object.keys(c.h.states).filter((id) => id.startsWith('media_player.'));
      s.player = s.player || a.player || pl[0];
      s.node = await c.ws('media_source/browse_media', a.id ? { media_content_id: a.id } : {}).catch(() => null);
      if (!s.node) s.node = { title: T('Media', 'Media'), children: pl.map((id) => ({ title: nameOf(c.h, id), media_class: 'app', can_expand: false, can_play: false, _ent: id, thumbnail: c.h.states[id].attributes.entity_picture })) };
    },
    render(c) {
      const s = c.state, h = c.h; if (!s.node) return ui.spin();
      const pl = Object.keys(h.states).filter((id) => id.startsWith('media_player.'));
      const K = { directory: 'mdi:folder', music: 'mdi:music', album: 'mdi:album', artist: 'mdi:account-music', playlist: 'mdi:playlist-music', movie: 'mdi:movie', video: 'mdi:video', image: 'mdi:image', podcast: 'mdi:podcast', channel: 'mdi:television-classic', app: 'mdi:cast', track: 'mdi:music-note' };
      return `<div class="chs">${pl.map((id) => ui.chip(`${ui.ic('mdi:cast', 15)}<span data-noi18n>${esc(nameOf(h, id))}</span>`, s.player === id, 'pl', id)).join('')}</div>
        <div class="mgrid">${arr(s.node.children).map((x, i) => `<button class="mi2 stg" style="animation-delay:${Math.min(i, 12) * 25}ms" data-a="${x._ent ? 'mi' : x.can_expand ? 'open' : 'play'}" data-v="${esc(x._ent || x.media_content_id || '')}" data-t="${esc(x.media_content_type || '')}"><span class="th">${x.thumbnail ? `<img src="${esc(x.thumbnail)}" alt="" loading="lazy">` : ui.ic(K[x.media_class] || 'mdi:file', 30)}${x.can_play ? `<span class="pb">${ui.ic('mdi:play', 18)}</span>` : ''}</span><b data-noi18n>${esc(x.title)}</b></button>`).join('') || ui.empty('mdi:folder-open-outline', T('Tom mappe', 'Empty folder'))}</div>
        <style>.mgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mi2{display:flex;flex-direction:column;gap:6px;text-align:left}.mi2 .th{position:relative;aspect-ratio:1;border-radius:18px;background:var(--ki-surface,#3a3a3a);display:grid;place-items:center;overflow:hidden;color:var(--ki-text-2,#afafaf)}.mi2 .th img{width:100%;height:100%;object-fit:cover}.mi2 .pb{position:absolute;right:6px;bottom:6px;width:30px;height:30px;border-radius:15px;background:var(--pink,#f285c9);color:#2a1720;display:grid;place-items:center}.mi2 b{font-size:12.5px;font-weight:500;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mi2:active .th{transform:scale(.96)}</style>`;
    },
    act(c, a, el, args) {
      const s = c.state, v = el.dataset.v;
      if (a === 'pl') { s.player = v; M.haptic('selection'); return c.render(); }
      if (a === 'mi') return M.moreInfo(null, v);
      if (a === 'open') return c.push('media', { id: v, player: s.player });
      if (a === 'play') { if (!s.player) return c.toast(T('Velg en spiller først', 'Choose a player first')); M.haptic('medium'); return c.call('media_player', 'play_media', { entity_id: s.player, media_content_id: v, media_content_type: el.dataset.t || 'music' }).then(() => c.toast(`${T('Spiller på', 'Playing on')} ${nameOf(c.h, s.player)}`)).catch((e) => c.err(e)); }
      return undefined;
    },
  });

  /* ============================================================ gjøremål */
  M.ha.page('todo', {
    title: (c, a) => (c.state.list ? nameOf(c.h, c.state.list) : T('Gjøremål', 'To-do lists')), haPath: '/todo',
    async load(c) {
      const s = c.state, L = Object.keys(c.h.states).filter((id) => id.startsWith('todo.')); s.list = s.list && L.includes(s.list) ? s.list : L[0];
      s.items = s.list ? A(await c.ws('todo/item/list', { entity_id: s.list }).catch(() => null), 'items') : [];
    },
    render(c) {
      const s = c.state, h = c.h, L = Object.keys(h.states).filter((id) => id.startsWith('todo.')); if (!s.items) return ui.spin();
      const open = s.items.filter((x) => x.status !== 'completed'), done = s.items.filter((x) => x.status === 'completed');
      const row = (x) => `<div class="hr li"><button class="tck ${x.status === 'completed' ? 'on' : ''}" data-a="tick" data-v="${esc(x.uid)}" aria-label="${esc(T('Ferdig', 'Done'))}">${x.status === 'completed' ? ui.ic('mdi:check', 16) : ''}</button><span class="ht" style="padding:6px 0"><b data-noi18n style="${x.status === 'completed' ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.summary)}</b>${x.due ? `<i>${esc(dt(x.due))}</i>` : ''}</span><button class="bt sm ic" data-a="del" data-v="${esc(x.uid)}">${ui.ic('mdi:close', 16)}</button></div>`;
      return `${L.length > 1 ? `<div class="chs">${L.map((id) => ui.chip(`<span data-noi18n>${esc(nameOf(h, id))}</span>`, s.list === id, 'list', id)).join('')}</div>` : ''}
        <div style="display:flex;gap:8px">${ui.field({ f: 'new', value: s.nw || '', ph: T('Legg til …', 'Add …'), attrs: 'enterkeyhint="done"', cls: 'grow' })}<button class="bt pri ic" data-a="add" style="height:46px;width:46px">${ui.ic('mdi:plus', 22)}</button></div>
        ${open.length ? ui.group(open.map(row).join('')) : ui.empty('mdi:check-all', T('Alt er gjort', 'All done'))}
        ${done.length ? ui.sec(`${T('Ferdig', 'Done')} · ${done.length}`, `<button class="bt sm" data-a="clr">${esc(T('Fjern', 'Clear'))}</button>`) + ui.group(done.map(row).join('')) : ''}
        <style>.grow{flex:1}.li{padding:4px 8px 4px 12px;gap:10px}.tck{width:28px;height:28px;border-radius:14px;flex:none;display:grid;place-items:center;box-shadow:inset 0 0 0 2px rgb(var(--ki-wa-c,255 255 255)/.25)}.tck.on{background:var(--green,#66d19e);color:#232323;box-shadow:none}</style>`;
    },
    input(c, el, v, commit) { if (el.dataset.f === 'new') { c.state.nw = v; if (commit && v.trim()) this.act(c, 'add', el); } },
    act(c, a, el) {
      const s = c.state, v = el.dataset.v, re = () => this.load(c).then(() => c.render());
      if (a === 'list') { s.list = v; s.items = null; c.render(); return re(); }
      if (a === 'add') { const t = String(s.nw || '').trim(); if (!t) return undefined; s.nw = ''; s.items.push({ uid: 'tmp' + Date.now(), summary: t, status: 'needs_action' }); c.render(); M.haptic('light'); return c.call('todo', 'add_item', { entity_id: s.list, item: t }).then(re).catch((e) => c.err(e)); }
      const it = s.items.find((x) => x.uid === v);
      if (a === 'tick' && it) { it.status = it.status === 'completed' ? 'needs_action' : 'completed'; M.haptic('selection'); c.render(); return c.call('todo', 'update_item', { entity_id: s.list, item: it.uid, status: it.status }).catch((e) => c.err(e)); }
      if (a === 'del' && it) { s.items = s.items.filter((x) => x !== it); c.render(); return c.call('todo', 'remove_item', { entity_id: s.list, item: it.uid }).catch((e) => c.err(e)); }
      if (a === 'clr') { s.items = s.items.filter((x) => x.status !== 'completed'); c.render(); return c.call('todo', 'remove_completed_items', { entity_id: s.list }).catch((e) => c.err(e)); }
      return undefined;
    },
    reload: true,
  });

  /* ============================================================ kalender */
  M.ha.page('calendar', {
    title: () => T('Kalender', 'Calendar'), haPath: '/calendar',
    async load(c) {
      const s = c.state, cals = Object.keys(c.h.states).filter((id) => id.startsWith('calendar.')); s.off = s.off || [];
      const st0 = new Date(); st0.setHours(0, 0, 0, 0); const en = new Date(st0.getTime() + 14 * 864e5);
      const res = await Promise.all(cals.map((id) => c.api('GET', `calendars/${id}?start=${st0.toISOString()}&end=${en.toISOString()}`).then((L) => arr(L).map((e) => ({ ...e, _cal: id }))).catch(() => { const a = c.h.states[id].attributes; return a.start_time ? [{ summary: a.message, start: { dateTime: a.start_time }, end: { dateTime: a.end_time }, location: a.location, _cal: id }] : []; })));
      s.ev = res.flat().map((e) => ({ ...e, _s: Date.parse(e.start.dateTime || e.start.date || e.start), _e: Date.parse(e.end.dateTime || e.end.date || e.end), _all: !(e.start.dateTime || typeof e.start === 'string' && e.start.includes('T')) })).sort((a, b) => a._s - b._s); s.cals = cals;
    },
    render(c) {
      const s = c.state, h = c.h; if (!s.ev) return ui.spin();
      const col = (id) => COL[s.cals.indexOf(id) % 8];
      const L = s.ev.filter((e) => !s.off.includes(e._cal)); let last = '';
      const rows = L.map((e) => { const d = new Date(e._s).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'short' }); const hd = d !== last ? (last = d, ui.sec(d)) : ''; return hd + `<div class="cev"><span class="cb" style="background:${col(e._cal)}"></span><span class="ct">${e._all ? esc(T('Hele dagen', 'All day')) : `${tm(e._s)}<br>${tm(e._e)}`}</span><span class="ht"><b data-noi18n>${esc(e.summary || '')}</b><i data-noi18n>${esc([nameOf(h, e._cal), e.location].filter(Boolean).join(' · '))}</i></span></div>`; }).join('');
      return `<div class="chs wrap">${s.cals.map((id) => ui.chip(`<span class="dt" style="--lc:${col(id)}"></span><span data-noi18n>${esc(nameOf(h, id))}</span>`, !s.off.includes(id), 'cal', id)).join('')}</div>${rows || ui.empty('mdi:calendar-blank', T('Ingen avtaler de neste to ukene', 'No events in the next two weeks'))}
        <button class="fab" data-a="new">${ui.ic('mdi:calendar-plus', 22)}${esc(T('Ny avtale', 'New event'))}</button>
        <style>.cev{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:20px;background:var(--ki-surface,#3a3a3a);margin-bottom:6px}.cb{width:4px;align-self:stretch;border-radius:2px;flex:none}.ct{font-size:12px;color:var(--ki-text-2,#afafaf);width:44px;flex:none;font-variant-numeric:tabular-nums}.dt{display:inline-block;width:9px;height:9px;border-radius:5px;background:var(--lc)}</style>`;
    },
    act(c, a, el) {
      const s = c.state, v = el.dataset.v;
      if (a === 'cal') { s.off = s.off.includes(v) ? s.off.filter((x) => x !== v) : [...s.off, v]; M.haptic('selection'); return c.render(); }
      if (a === 'new') {
        const o = { cal: s.cals[0], summary: '', date: new Date().toISOString().slice(0, 10), start: '18:00', end: '19:00' };
        return c.sheet({ title: T('Ny avtale', 'New event'), html: `${ui.field({ f: 'summary', label: T('Tittel', 'Title') })}<div class="chs wrap">${s.cals.map((id, i) => ui.chip(`<span data-noi18n>${esc(nameOf(c.h, id))}</span>`, i === 0, 'ccal', id)).join('')}</div>${ui.field({ f: 'date', type: 'date', value: o.date, label: T('Dato', 'Date') })}<div class="r2">${ui.field({ f: 'start', type: 'time', value: o.start, label: T('Fra', 'From') })}${ui.field({ f: 'end', type: 'time', value: o.end, label: T('Til', 'To') })}</div><div class="bts" style="justify-content:flex-end">${ui.btn(T('Lagre', 'Save'), 'save', null, 'pri')}</div>`,
          onInput: (e2, val) => { o[e2.dataset.f] = val; },
          onAct: (x, e2) => {
            if (x === 'ccal') { o.cal = e2.dataset.v; e2.parentElement.querySelectorAll('.ch').forEach((b) => b.classList.toggle('on', b === e2)); return false; }
            if (x === 'save') { if (!o.summary.trim()) return false; c.call('calendar', 'create_event', { entity_id: o.cal, summary: o.summary, start_date_time: `${o.date} ${o.start}:00`, end_date_time: `${o.date} ${o.end}:00` }).then(() => { M.haptic('success'); c.toast(T('Avtalen er lagt til', 'Event added')); this.load(c).then(() => c.render()); }).catch((er) => c.err(er)); return true; }
            return false;
          } });
      }
      return undefined;
    },
    reload: true,
  });

  /* ============================================================ Assist */
  M.ha.page('assist', {
    title: () => 'Assist', sub: () => T('Snakk med Home Assistant', 'Talk to Home Assistant'), live: false,
    render(c) {
      const s = c.state; s.msgs = s.msgs || [{ me: false, t: T('Hei! Hva kan jeg hjelpe med? Prøv «slå på lyset i stua» eller «hvor varmt er det ute?».', 'Hi! How can I help? Try «turn on the living room lights».') }];
      setTimeout(() => { const sc = M.ha.current && M.ha.current.root.querySelector('.asc'); if (sc) sc.scrollTop = sc.scrollHeight; }, 20);
      return `<div class="asc">${s.msgs.map((m) => `<div class="am ${m.me ? 'me' : ''}"><span data-noi18n>${esc(m.t)}</span></div>`).join('')}${s.busy ? '<div class="am"><span class="spn s"></span></div>' : ''}</div>
        <div class="abar">${ui.field({ f: 'say', value: s.say || '', ph: T('Skriv en kommando …', 'Type a command …'), attrs: 'enterkeyhint="send"', cls: 'grow' })}<button class="bt ic ${'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? '' : 'dis'}" data-a="mic" style="height:46px;width:46px">${ui.ic(s.rec ? 'mdi:microphone' : 'mdi:microphone-outline', 22)}</button><button class="bt pri ic" data-a="send" style="height:46px;width:46px">${ui.ic('mdi:send', 20)}</button></div>
        <style>.asc{display:flex;flex-direction:column;gap:8px;min-height:50vh;max-height:62vh;overflow:auto;padding:4px 2px}.am{max-width:84%;padding:10px 14px;border-radius:20px 20px 20px 6px;background:var(--ki-surface,#3a3a3a);font-size:15px;line-height:1.4;align-self:flex-start}.am.me{align-self:flex-end;border-radius:20px 20px 6px 20px;background:var(--pink,#f285c9);color:#2a1720}.abar{display:flex;gap:8px;align-items:flex-end;position:sticky;bottom:calc(10px + env(safe-area-inset-bottom,0px))}.grow{flex:1}.dis{opacity:.4;pointer-events:none}</style>`;
    },
    input(c, el, v, commit) { if (el.dataset.f === 'say') { c.state.say = v; if (commit && v.trim()) this.act(c, 'send'); } },
    act(c, a) {
      const s = c.state;
      if (a === 'send') {
        const t = String(s.say || '').trim(); if (!t || s.busy) return undefined;
        s.msgs.push({ me: true, t }); s.say = ''; s.busy = true; M.haptic('light'); c.render();
        return c.ws('conversation/process', { text: t, language: (c.h && c.h.language) || 'nb', conversation_id: s.cid || null }).then((r) => { s.cid = r && r.conversation_id; const sp = r && r.response && r.response.speech && r.response.speech.plain; s.msgs.push({ me: false, t: (sp && sp.speech) || T('Ferdig.', 'Done.') }); }).catch(() => { s.msgs.push({ me: false, t: T('Assist er ikke tilgjengelig i demoen. Mot ekte Home Assistant svarer standardagenten her.', 'Assist is not available in the demo.') }); }).finally(() => { s.busy = false; M.haptic('success'); c.render(); });
      }
      if (a === 'mic') {
        const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return undefined;
        const r = new R(); r.lang = (c.h && c.h.language) === 'en' ? 'en-US' : 'nb-NO'; r.interimResults = false; s.rec = true; c.render();
        r.onresult = (e) => { s.say = e.results[0][0].transcript; s.rec = false; this.act(c, 'send'); }; r.onend = () => { s.rec = false; c.render(); }; r.start(); M.haptic('medium');
      }
      return undefined;
    },
  });

  /* ============================================================ utviklerverktøy */
  M.ha.page('devtools', {
    title: () => T('Utviklerverktøy', 'Developer tools'), haPath: '/developer-tools/state', live: false,
    render(c) {
      const s = c.state, h = c.h, tab = s.tab || 'states';
      let body = '';
      if (tab === 'states') {
        const q = String(s.q || '').toLowerCase(), ids = Object.keys(h.states).filter((id) => !q || (id + ' ' + nameOf(h, id) + ' ' + h.states[id].state).toLowerCase().includes(q)).sort();
        body = `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="q" value="${esc(s.q || '')}" placeholder="${esc(T('Filtrer entiteter', 'Filter entities'))}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>${ui.group(ids.slice(0, 150).map((id) => ui.row({ a: 'set', v: id, titleHtml: `<span data-noi18n class="mono">${esc(id)}</span>`, subHtml: `<span data-noi18n>${esc(h.states[id].state)}</span>`, chev: true })).join(''))}`;
      } else if (tab === 'actions') {
        body = `${ui.field({ f: 'svc', value: s.svc || 'light.toggle', label: T('Handling', 'Action'), mono: true, list: 'svcl' })}<datalist id="svcl">${Object.entries(h.services || {}).flatMap(([d, o]) => Object.keys(o).map((k) => `<option value="${esc(d + '.' + k)}"></option>`)).slice(0, 600).join('')}</datalist>
          ${ui.field({ f: 'sdata', value: s.sdata != null ? s.sdata : 'entity_id: light.stue_tak', label: T('Data (YAML)', 'Data (YAML)'), area: true, rows: 6, mono: true })}
          <div class="bts">${ui.btn(T('Utfør', 'Perform'), 'run', null, 'pri', 'mdi:play')}</div>${s.res ? `<pre class="pre ${s.resErr ? 'err' : ''}" data-noi18n>${esc(s.res)}</pre>` : ''}`;
      } else if (tab === 'template') {
        body = `${ui.field({ f: 'tpl', value: s.tpl != null ? s.tpl : '{{ states | count }} entiteter\nKlokka er {{ now().strftime("%H:%M") }}', label: T('Mal (Jinja)', 'Template (Jinja)'), area: true, rows: 7, mono: true })}<div class="bts">${ui.btn(T('Vis resultat', 'Render'), 'render', null, 'pri', 'mdi:code-braces')}</div>${s.out != null ? `<pre class="pre ${s.outErr ? 'err' : ''}" data-noi18n>${esc(s.out)}</pre>` : ''}`;
      } else {
        body = `${ui.field({ f: 'evt', value: s.evt || '', label: T('Hendelsestype', 'Event type'), mono: true, ph: 'ki_test' })}${ui.field({ f: 'edata', value: s.edata || '', label: T('Data (YAML)', 'Data (YAML)'), area: true, rows: 4, mono: true })}<div class="bts">${ui.btn(T('Send hendelse', 'Fire event'), 'fire', null, 'pri', 'mdi:send')}</div>`;
      }
      return `${ui.seg('__tab', tab, [['states', T('Tilstander', 'States')], ['actions', T('Handlinger', 'Actions')], ['template', T('Mal', 'Template')], ['events', T('Hendelser', 'Events')]])}${body}<style>.mono{font-family:ui-monospace,Menlo,monospace;font-size:13px}</style>`;
    },
    input(c, el, v) { const f = el.dataset.f; if (f) c.state[f] = v; if (f === 'q') c.render(); },
    act(c, a, el) {
      const s = c.state, y = (t) => (String(t || '').trim() ? M.yaml.parse(t) : {});
      if (a === 'seg') { s.tab = el.dataset.v; M.haptic('selection'); return c.render(); }
      if (a === 'set') {
        const id = el.dataset.v, cur = c.h.states[id]; let o = { state: cur.state, attr: M.yaml.dump(cur.attributes) };
        return c.sheet({ title: id, sub: T('Sett tilstand (bare i HA til enheten melder ny verdi)', 'Set state (only in HA until the device reports again)'), html: `${ui.field({ f: 'state', value: o.state, label: T('Tilstand', 'State'), mono: true })}${ui.field({ f: 'attr', value: o.attr, label: T('Attributter (YAML)', 'Attributes (YAML)'), area: true, rows: 8, mono: true })}<div class="bts" style="justify-content:space-between">${ui.btn(T('Detaljer', 'Details'), 'mi', null, '', 'mdi:information-outline')}${ui.btn(T('Sett tilstand', 'Set state'), 'save', null, 'pri')}</div>`,
          onInput: (e2, val) => { o[e2.dataset.f] = val; },
          onAct: (x) => { if (x === 'mi') { M.moreInfo(null, id); return true; } if (x === 'save') { let at; try { at = y(o.attr); } catch (e) { c.err(e); return false; } c.api('POST', `states/${id}`, { state: o.state, attributes: at }).then(() => { M.haptic('success'); c.toast(T('Tilstanden er satt', 'State set')); }).catch((e) => c.err(e)); return true; } return false; } });
      }
      if (a === 'run') { const [d, sv] = String(s.svc || 'light.toggle').split('.'); let data; try { data = y(s.sdata != null ? s.sdata : 'entity_id: light.stue_tak'); } catch (e) { s.res = e.message; s.resErr = true; return c.render(); } M.haptic('medium'); return c.call(d, sv, data).then((r) => { s.res = T('Utført', 'Done') + (r && r.response ? '\n' + M.yaml.dump(r.response) : ''); s.resErr = false; c.render(); }).catch((e) => { s.res = c.errText(e); s.resErr = true; c.render(); }); }
      if (a === 'render') { const t = s.tpl != null ? s.tpl : '{{ states | count }} entiteter\nKlokka er {{ now().strftime("%H:%M") }}'; return c.api('POST', 'template', { template: t }).then((r) => { s.out = String(r); s.outErr = false; c.render(); }).catch((e) => { s.out = T('Kunne ikke vise malen', 'Could not render') + ': ' + c.errText(e); s.outErr = true; c.render(); }); }
      if (a === 'fire') { if (!s.evt) return undefined; let data; try { data = y(s.edata); } catch (e) { return c.err(e); } return c.api('POST', `events/${s.evt}`, data).then(() => { M.haptic('success'); c.toast(T('Hendelsen er sendt', 'Event fired')); }).catch((e) => c.err(e)); }
      return undefined;
    },
  });

  /* ============================================================ hub: «Home Assistant» erstatter lenkene ut */
  M.ha.morePanels = () => {
    const P = [
      ['devices', 'mdi:puzzle', 'Enheter og tjenester', 'Integrasjoner, enheter og entiteter'],
      ['helpers', 'mdi:tools', 'Hjelpere', 'Av/på, tall, lister, tidtakere'],
      ['areas', 'mdi:sofa', 'Områder, etasjer og soner', 'Rom, etasjer og kart-soner'],
      ['persons', 'mdi:account', 'Personer', 'Hvem som bor her og sporing'],
      ['addons', 'mdi:puzzle-plus', 'Tillegg', 'Start, stopp og oppdater'],
    ], Q = [
      ['history', 'mdi:chart-box-outline', 'Historikk', 'Grafer og tidslinjer'],
      ['logbook', 'mdi:format-list-bulleted-type', 'Loggbok', 'Hva som har skjedd'],
      ['map', 'mdi:map', 'Kart', 'Personer og soner'],
      ['energy', 'mdi:lightning-bolt', 'Energi', 'Effekt og forbruk'],
      ['media', 'mdi:play-box-multiple', 'Media', 'Bla og spill av'],
      ['todo', 'mdi:clipboard-list', 'Gjøremål', 'Lister'],
      ['calendar', 'mdi:calendar', 'Kalender', 'Avtaler de neste to ukene'],
      ['assist', 'mdi:comment-processing-outline', 'Assist', 'Tekst og tale'],
      ['devtools', 'mdi:hammer', 'Utviklerverktøy', 'Tilstander, handlinger, maler'],
    ];
    const g = (L) => ui.group(L.map(([v, i, t, s]) => ui.row({ a: 'go', v, icon: i, title: T(t), sub: T(s), chev: true })).join(''));
    return `${ui.sec(T('Oppsett', 'Configuration'))}${g(P)}${ui.sec(T('Verktøy', 'Tools'))}${g(Q)}`;
  };

  M.ha.panels2 = true;
})();
