/* KI MSH · Home Assistant-innstillinger, del 1 av de vanlige HA-sidene (bolk 1):
 * enheter og tjenester (integrasjoner · enheter · entiteter), hjelpere, områder/etasjer/soner, personer og brukere, tillegg.
 * Alt leses fra hass (states/entities/devices/areas) og HAs websocket-API, og endringer går til de samme registrene som
 * HA bruker. I demoen fylles det som mangler fra hass-objektet.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || M.ha.panels1) return;
  const esc = M.esc, ui = M.ha.ui, reg = M.ha.reg;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const A = (x, k) => (Array.isArray(x) ? x : x && Array.isArray(x[k]) ? x[k] : []);
  const ws = (c, t, d) => c.ws(t, d).catch(() => null);
  const nameOf = (h, id) => { const s = h && h.states[id]; return (s && s.attributes.friendly_name) || id; };
  const st = (h, id) => { const s = h.states[id]; return s ? (M.formatState ? M.formatState(h, s) : s.state + (s.attributes.unit_of_measurement ? ' ' + s.attributes.unit_of_measurement : '')) : '–'; };
  const dIcon = (h, id) => (h.states[id] && h.states[id].attributes.icon) || (M.domainIcon ? M.domainIcon(id, h.states[id]) : 'mdi:shape-outline');
  const devs = (h, c) => { const L = c.state.devs || Object.values(h.devices || {}); return L; };
  const devArea = (h, d) => d && d.area_id;
  const entArea = (h, id) => { const e = reg.ent(id) || (h.entities && h.entities[id]) || {}; if (e.area_id) return e.area_id; const d = e.device_id && h.devices && h.devices[e.device_id]; return (d && d.area_id) || null; };
  const areaName = (h, a) => (a && h.areas && h.areas[a] ? h.areas[a].name : '');
  const search = (st0) => `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="q" value="${esc(st0.q || '')}" placeholder="${esc(T('Søk', 'Search'))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">${st0.q ? `<button data-a="qx">${ui.ic('mdi:close-circle', 18)}</button>` : ''}</label>`;
  const qm = (q, ...s) => !q || s.join(' ').toLowerCase().includes(q);
  const qInput = (c, el, v) => { if (el.dataset.f === 'q') { c.state.q = v; c.render(); } };
  const DOMAIN_N = { mobile_app: 'Mobile App', met: 'Meteorologisk institutt (Met.no)', zha: 'Zigbee Home Automation', hue: 'Philips Hue', sonos: 'Sonos', cast: 'Google Cast', mqtt: 'MQTT', unifi: 'UniFi Network', unifiprotect: 'UniFi Protect', tesla_fleet: 'Tesla Fleet', nordpool: 'Nord Pool', entur_public_transport: 'Entur', hacs: 'HACS', sun: 'Sol', shopping_list: 'Handleliste' };
  const dn = (d) => DOMAIN_N[d] || String(d).replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
  const brand = (d) => `https://brands.home-assistant.io/_/${encodeURIComponent(d)}/icon.png`;
  const bIc = (d) => `<span class="hi br"><img src="${brand(d)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${esc(String(d)[0] || '?').toUpperCase()}'}))"></span>`;
  const CSS = '<style>.hi.br{background:#fff;overflow:hidden}.hi.br img{width:26px;height:26px;object-fit:contain}.hi.br span{color:#232323;font-weight:700}.li{padding:4px 8px 4px 4px;gap:6px}.li .lm{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px 4px 6px 10px;text-align:left;border-radius:18px}.st0{font-size:13px;color:var(--ki-text-2,#afafaf);white-space:nowrap;max-width:40%;overflow:hidden;text-overflow:ellipsis}</style>';

  /* ============================================================ enheter og tjenester */
  async function loadReg(c) {
    const s = c.state;
    const [ce, dv] = await Promise.all([ws(c, 'config_entries/get'), ws(c, 'config/device_registry/list'), reg.load(c.h)]);
    s.entries = A(ce, 'entries'); s.devs = A(dv, 'devices'); if (!s.devs.length) s.devs = Object.values(c.h.devices || {});
    if (!s.entries.length) { // demo: lag integrasjoner av plattformene i registeret
      const by = {}; Object.values(reg.ents || c.h.entities || {}).forEach((e) => { const p = e.platform || (e.entity_id || '').split('.')[0]; if (!by[p]) by[p] = { entry_id: 'demo_' + p, domain: p, title: dn(p), state: 'loaded', source: 'user' }; });
      s.entries = Object.values(by);
    }
  }
  const entsOfEntry = (c, id) => Object.values(reg.ents || {}).filter((e) => e.config_entry_id === id || (!e.config_entry_id && 'demo_' + e.platform === id));
  const devsOfEntry = (c, id) => devs(c.h, c).filter((d) => arr(d.config_entries).includes(id));
  M.ha.page('devices', {
    title: () => T('Enheter og tjenester', 'Devices and services'),
    haPath: '/config/integrations/dashboard',
    load: (c) => loadReg(c),
    render(c) {
      const s = c.state, h = c.h, tab = s.tab || 'int', q = String(s.q || '').toLowerCase();
      if (!s.entries) return ui.spin();
      let body = '';
      if (tab === 'int') {
        const L = s.entries.filter((e) => qm(q, e.title, e.domain)).sort((a, b) => dn(a.domain).localeCompare(dn(b.domain), 'nb'));
        const bad = L.filter((e) => e.state && !['loaded', 'not_loaded'].includes(e.state) || e.disabled_by);
        const row = (e) => `<button class="hr" data-a="int" data-v="${esc(e.entry_id)}">${bIc(e.domain)}<span class="ht"><b data-noi18n>${esc(e.title || dn(e.domain))}</b><i>${esc(dn(e.domain))} · ${devsOfEntry(c, e.entry_id).length} ${T('enheter', 'devices')} · ${entsOfEntry(c, e.entry_id).length} ${T('entiteter', 'entities')}</i></span>${e.disabled_by ? `<span class="tag">${esc(T('Deaktivert', 'Disabled'))}</span>` : e.state === 'setup_error' || e.state === 'setup_retry' ? `<span class="tag err">${esc(T('Feil', 'Error'))}</span>` : ''}${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3,#7f7f7f)')}</button>`;
        body = `${bad.length ? ui.sec(T('Trenger oppmerksomhet', 'Needs attention')) + ui.group(bad.map(row).join('')) : ''}${ui.sec(`${T('Integrasjoner', 'Integrations')} · ${L.length}`)}${ui.group(L.filter((e) => !bad.includes(e)).map(row).join('')) || ui.empty('mdi:puzzle-outline', T('Ingen treff', 'No matches'))}
          <button class="fab" data-a="ext" data-v="/config/integrations/dashboard?add=1">${ui.ic('mdi:plus', 22)}${esc(T('Legg til integrasjon', 'Add integration'))}</button>`;
      } else if (tab === 'dev') {
        const L = devs(h, c).filter((d) => qm(q, d.name_by_user, d.name, d.manufacturer, d.model, areaName(h, d.area_id))).sort((a, b) => String(a.name_by_user || a.name).localeCompare(String(b.name_by_user || b.name), 'nb'));
        body = ui.group(L.slice(0, 300).map((d) => ui.row({ a: 'dev', v: d.id, icon: 'mdi:devices', title: d.name_by_user || d.name || d.id, sub: [areaName(h, d.area_id), d.manufacturer, d.model].filter(Boolean).join(' · '), chev: true })).join('')) || ui.empty('mdi:devices', T('Ingen enheter', 'No devices'));
      } else {
        const ids = Object.keys(h.states).filter((id) => qm(q, id, nameOf(h, id), areaName(h, entArea(h, id)))).sort((a, b) => nameOf(h, a).localeCompare(nameOf(h, b), 'nb'));
        body = `${ui.group(ids.slice(0, 250).map((id) => `<div class="hr li"><button class="lm" data-a="ent" data-v="${esc(id)}"><span class="hi">${ui.ic(dIcon(h, id), 21)}</span><span class="ht"><b data-noi18n>${esc(nameOf(h, id))}</b><i data-noi18n>${esc(id)}${areaName(h, entArea(h, id)) ? ' · ' + esc(areaName(h, entArea(h, id))) : ''}</i></span><span class="st0" data-noi18n>${esc(st(h, id))}</span></button></div>`).join(''))}${ids.length > 250 ? `<p class="mut" style="text-align:center">${ids.length - 250} ${esc(T('til – søk for å finne dem', 'more – search to find them'))}</p>` : ''}`;
      }
      return `${ui.seg('__tab', tab, [['int', T('Integrasjoner', 'Integrations')], ['dev', T('Enheter', 'Devices')], ['ent', T('Entiteter', 'Entities')]])}${search(s)}${body}${CSS}`;
    },
    input: qInput,
    act(c, a, el) {
      const v = el.dataset.v;
      if (a === 'seg') { c.state.tab = v; c.state.q = ''; M.haptic('selection'); return c.render(); }
      if (a === 'qx') { c.state.q = ''; return c.render(); }
      if (a === 'int') return c.push('integration', { id: v, entries: c.state.entries, devs: c.state.devs });
      if (a === 'dev') return c.push('device', { id: v, devs: c.state.devs });
      if (a === 'ent') return c.push('entity', { id: v });
      return undefined;
    },
  });
  M.ha.page('integration', {
    title: (c, a) => { const e = arr(a.entries).find((x) => x.entry_id === a.id); return e ? e.title || dn(e.domain) : T('Integrasjon', 'Integration'); },
    sub: (c, a) => { const e = arr(a.entries).find((x) => x.entry_id === a.id); return e ? dn(e.domain) : ''; },
    haPath: (c, a) => { const e = arr(a.entries).find((x) => x.entry_id === a.id); return e ? `/config/integrations/integration/${e.domain}` : '/config/integrations/dashboard'; },
    render(c, a) {
      const h = c.h, e = arr(a.entries).find((x) => x.entry_id === a.id); if (!e) return ui.empty('mdi:puzzle-outline', T('Fant ikke integrasjonen', 'Integration not found'));
      const D = arr(a.devs).filter((d) => arr(d.config_entries).includes(e.entry_id)), E = entsOfEntry(c, e.entry_id).filter((x) => !x.device_id || !D.some((d) => d.id === x.device_id));
      const stT = e.disabled_by ? T('Deaktivert', 'Disabled') : { loaded: T('Lastet', 'Loaded'), setup_error: T('Feil ved oppsett', 'Setup error'), setup_retry: T('Prøver igjen', 'Retrying'), not_loaded: T('Ikke lastet', 'Not loaded') }[e.state] || e.state;
      return `<div class="card" style="flex-direction:row;align-items:center;gap:14px">${bIc(e.domain)}<span class="ht"><b data-noi18n>${esc(e.title || dn(e.domain))}</b><i>${esc(stT)}${e.source ? ' · ' + esc(e.source) : ''}</i></span></div>
        ${ui.group([e.supports_options ? ui.row({ a: 'ext', v: `/config/integrations/integration/${e.domain}`, icon: 'mdi:tune-variant', title: T('Alternativer', 'Options'), ext: true }) : '', ui.row({ a: 'reload', icon: 'mdi:reload', title: T('Last inn på nytt', 'Reload') }), ui.row({ a: 'dis', icon: e.disabled_by ? 'mdi:play-circle-outline' : 'mdi:pause-circle-outline', title: e.disabled_by ? T('Aktiver', 'Enable') : T('Deaktiver', 'Disable') }), ui.row({ a: 'del', icon: 'mdi:delete-outline', title: c.armed('del') ? T('Trykk igjen for å slette', 'Tap again to delete') : T('Slett', 'Delete'), cls: 'danger' })].join(''))}
        ${D.length ? ui.sec(`${T('Enheter', 'Devices')} · ${D.length}`) + ui.group(D.map((d) => ui.row({ a: 'dev', v: d.id, icon: 'mdi:devices', title: d.name_by_user || d.name, sub: [areaName(h, d.area_id), d.model].filter(Boolean).join(' · '), chev: true })).join('')) : ''}
        ${E.length ? ui.sec(`${T('Entiteter uten enhet', 'Entities without device')} · ${E.length}`) + ui.group(E.slice(0, 100).map((x) => ui.row({ a: 'ent', v: x.entity_id, icon: dIcon(h, x.entity_id), title: nameOf(h, x.entity_id), sub: x.entity_id, chev: true })).join('')) : ''}${CSS}`;
    },
    act(c, a, el, args) {
      const v = el.dataset.v, id = args.id;
      if (a === 'dev') return c.push('device', { id: v, devs: args.devs });
      if (a === 'ent') return c.push('entity', { id: v });
      if (a === 'reload') return c.ws('config_entries/reload', { entry_id: id }).catch(() => c.api('POST', `config/config_entries/entry/${id}/reload`)).then(() => { M.haptic('success'); c.toast(T('Lastet inn på nytt', 'Reloaded')); }).catch((e) => c.err(e));
      if (a === 'dis') { const e = arr(args.entries).find((x) => x.entry_id === id); return c.ws('config_entries/disable', { entry_id: id, disabled_by: e && e.disabled_by ? null : 'user' }).then(() => { if (e) e.disabled_by = e.disabled_by ? null : 'user'; M.haptic('medium'); c.render(); }).catch((x) => c.err(x)); }
      if (a === 'del') { if (!c.confirm('del')) return undefined; return c.api('DELETE', `config/config_entries/entry/${id}`).then(() => { M.haptic('medium'); c.toast(T('Slettet', 'Deleted')); c.pop(); }).catch((e) => c.err(e)); }
      return undefined;
    },
  });
  M.ha.page('device', {
    title: (c, a) => { const d = arr(a.devs).find((x) => x.id === a.id) || (c.h.devices || {})[a.id]; return d ? d.name_by_user || d.name : T('Enhet', 'Device'); },
    sub: (c, a) => { const d = arr(a.devs).find((x) => x.id === a.id) || (c.h.devices || {})[a.id]; return d ? [d.manufacturer, d.model].filter(Boolean).join(' · ') : ''; },
    haPath: (c, a) => `/config/devices/device/${a.id}`,
    render(c, a) {
      const h = c.h, d = arr(a.devs).find((x) => x.id === a.id) || (h.devices || {})[a.id]; if (!d) return ui.empty('mdi:devices', T('Fant ikke enheten', 'Device not found'));
      const E = Object.values(reg.ents || h.entities || {}).filter((e) => e.device_id === d.id);
      const areas = M.areas ? M.areas(h) : Object.values(h.areas || {});
      return `<div class="card"><div class="kv">${[['Produsent', d.manufacturer], ['Modell', d.model], ['Fastvare', d.sw_version], ['Maskinvare', d.hw_version], ['Tilkoblet via', d.via_device_id && h.devices && h.devices[d.via_device_id] ? h.devices[d.via_device_id].name : null]].filter((x) => x[1]).map(([k, v]) => `<span>${esc(T(k))}</span><b data-noi18n>${esc(v)}</b>`).join('')}</div></div>
        ${ui.field({ f: 'name', value: d.name_by_user || '', label: T('Navn', 'Name'), ph: d.name })}
        ${ui.sec(T('Område', 'Area'))}<div class="chs wrap">${ui.chip(esc(T('Ingen', 'None')), !d.area_id, 'area', '')}${areas.map((ar) => ui.chip(`<span data-noi18n>${esc(ar.name)}</span>`, d.area_id === ar.area_id, 'area', ar.area_id)).join('')}</div>
        ${ui.sec(`${T('Entiteter', 'Entities')} · ${E.length}`)}${ui.group(E.map((e) => `<div class="hr li"><button class="lm" data-a="ent" data-v="${esc(e.entity_id)}"><span class="hi">${ui.ic(dIcon(h, e.entity_id), 21)}</span><span class="ht"><b data-noi18n>${esc(nameOf(h, e.entity_id))}</b><i data-noi18n>${esc(e.entity_id)}${e.disabled_by ? ' · ' + esc(T('deaktivert', 'disabled')) : e.hidden_by ? ' · ' + esc(T('skjult', 'hidden')) : ''}</i></span><span class="st0" data-noi18n>${esc(st(h, e.entity_id))}</span></button></div>`).join('')) || ui.empty('mdi:shape-outline', T('Ingen entiteter', 'No entities'))}${CSS}`;
    },
    input(c, el, v, commit, a) { if (el.dataset.f === 'name' && commit) { const d = arr(a.devs).find((x) => x.id === a.id); c.ws('config/device_registry/update', { device_id: a.id, name_by_user: v || null }).then(() => { if (d) d.name_by_user = v || null; M.haptic('success'); c.render(); }).catch((e) => c.err(e)); } },
    act(c, a, el, args) {
      const v = el.dataset.v, d = arr(args.devs).find((x) => x.id === args.id);
      if (a === 'ent') return c.push('entity', { id: v });
      if (a === 'area') return c.ws('config/device_registry/update', { device_id: args.id, area_id: v || null }).then(() => { if (d) d.area_id = v || null; M.haptic('selection'); c.render(); }).catch((e) => c.err(e));
      return undefined;
    },
  });
  M.ha.page('entity', {
    title: (c, a) => nameOf(c.h, a.id), sub: (c, a) => a.id,
    haPath: (c, a) => `/config/entities?search=${encodeURIComponent(a.id)}`,
    load: async (c, a) => { c.state.e = await ws(c, 'config/entity_registry/get', { entity_id: a.id }); if (!c.state.e || !c.state.e.entity_id) c.state.e = reg.ent(a.id) || { entity_id: a.id }; },
    render(c, a) {
      const h = c.h, e = c.state.e; if (!e) return ui.spin();
      const areas = M.areas ? M.areas(h) : Object.values(h.areas || {}), ar = e.area_id || null, s = h.states[a.id];
      return `<button class="card" data-a="mi" style="flex-direction:row;align-items:center;gap:14px;text-align:left"><span class="hi on">${ui.ic(e.icon || dIcon(h, a.id), 22)}</span><span class="ht"><b data-noi18n>${esc(st(h, a.id))}</b><i>${esc(T('Trykk for kontroll og historikk', 'Tap for controls and history'))}</i></span>${ui.ic('mdi:chevron-right', 22)}</button>
        ${e.unique_id || reg.ent(a.id) ? `${ui.field({ f: 'name', value: e.name || '', label: T('Navn', 'Name'), ph: e.original_name || nameOf(h, a.id) })}
        <div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'eic', value: e.icon || '', placeholder: dIcon(h, a.id), attrs: 'data-f="icon"' }) : ui.field({ f: 'icon', value: e.icon })}</div>
        ${ui.field({ f: 'eid', value: a.id, label: T('Entitets-ID', 'Entity ID'), mono: true })}
        ${ui.sec(T('Område', 'Area'))}<div class="chs wrap">${ui.chip(esc(T('Følg enheten', 'Follow device')), !ar, 'area', '')}${areas.map((x) => ui.chip(`<span data-noi18n>${esc(x.name)}</span>`, ar === x.area_id, 'area', x.area_id)).join('')}</div>
        ${ui.group([ui.row({ a: 'en', icon: 'mdi:power', title: T('Aktivert', 'Enabled'), right: ui.sw(!e.disabled_by, 'en') }), ui.row({ a: 'vis', icon: 'mdi:eye-outline', title: T('Synlig', 'Visible'), right: ui.sw(!e.hidden_by, 'vis') }), ui.row({ a: 'org', icon: 'mdi:label-outline', title: T('Etiketter', 'Labels'), subHtml: arr(e.labels).map((l) => ui.labelChip(reg.label(l))).join('') || esc(T('Ingen', 'None')), chev: true })].join(''))}`
        : `<div class="card"><p>${esc(T('Denne entiteten har ingen unik ID, så den kan ikke endres her. Den er laget i YAML.', 'This entity has no unique ID and cannot be changed here. It is made in YAML.'))}</p></div>`}
        ${s ? `<details class="adv"><summary>${esc(T('Attributter', 'Attributes'))}</summary><pre class="pre" data-noi18n>${esc(JSON.stringify(s.attributes, null, 2))}</pre></details>` : ''}`;
    },
    input(c, el, v, commit, a) {
      const f = el.dataset.f; if (!commit && f !== 'icon') return;
      const patch = f === 'name' ? { name: v || null } : f === 'icon' ? { icon: v || null } : f === 'eid' && v && v !== a.id ? { new_entity_id: v } : null; if (!patch) return;
      c.ws('config/entity_registry/update', { entity_id: a.id, ...patch }).then((r) => { M.haptic('success'); c.state.e = (r && r.entity_entry) || { ...c.state.e, ...patch }; if (patch.new_entity_id) { a.id = patch.new_entity_id; } reg.load(c.h, true); c.render(); }).catch((e) => c.err(e));
    },
    act(c, a, el, args) {
      const e = c.state.e, up = (p) => c.ws('config/entity_registry/update', { entity_id: args.id, ...p }).then((r) => { c.state.e = (r && r.entity_entry) || { ...e, ...p }; M.haptic('selection'); reg.load(c.h, true); c.render(); }).catch((x) => c.err(x));
      if (a === 'mi') return M.moreInfo(null, args.id);
      if (a === 'area') return up({ area_id: el.dataset.v || null });
      if (a === 'en') return up({ disabled_by: e.disabled_by ? null : 'user' });
      if (a === 'vis') return up({ hidden_by: e.hidden_by ? null : 'user' });
      if (a === 'org') return M.ha.orgSheet ? M.ha.orgSheet(c, 'automation', args.id, {}, () => c.render()) : undefined;
      return undefined;
    },
  });

  /* ============================================================ hjelpere */
  const HELP = {
    input_boolean: ['Av/på', 'mdi:toggle-switch-outline', { name: '', icon: '' }],
    input_number: ['Tall', 'mdi:ray-vertex', { name: '', min: 0, max: 100, step: 1, mode: 'slider', unit_of_measurement: '' }],
    input_select: ['Nedtrekksliste', 'mdi:form-dropdown', { name: '', options: ['Valg 1', 'Valg 2'] }],
    input_text: ['Tekst', 'mdi:form-textbox', { name: '', min: 0, max: 100, mode: 'text' }],
    input_datetime: ['Dato og/eller tid', 'mdi:calendar-clock', { name: '', has_date: true, has_time: true }],
    input_button: ['Knapp', 'mdi:gesture-tap-button', { name: '' }],
    counter: ['Teller', 'mdi:counter', { name: '', initial: 0, step: 1 }],
    timer: ['Tidtaker', 'mdi:timer-outline', { name: '', duration: '00:05:00', restore: true }],
    schedule: ['Tidsplan', 'mdi:calendar-week', { name: '' }],
  };
  M.ha.page('helpers', {
    title: () => T('Hjelpere', 'Helpers'), haPath: '/config/helpers',
    sub: (c) => `${Object.keys(c.h.states).filter((id) => HELP[id.split('.')[0]]).length} ${T('totalt', 'in total')}`,
    right: () => `<button class="hb" data-a="cats" aria-label="${esc(T('Mapper', 'Folders'))}">${ui.ic('mdi:folder-cog-outline', 20)}</button>`,
    load: async (c) => { await reg.load(c.h); },
    render(c) {
      const h = c.h, s = c.state, q = String(s.q || '').toLowerCase();
      if (s.group == null) { try { s.group = localStorage.getItem('ki-ha-group-helpers') || 'type'; } catch (e) { s.group = 'type'; } }
      if (!s.fold) s.fold = new Set();
      const R = (id) => reg.ent(id) || {};
      const all = Object.keys(h.states).filter((id) => HELP[id.split('.')[0]]);
      const ids = all.filter((id) => qm(q, id, nameOf(h, id)) && (!s.types || !s.types.length || s.types.includes(id.split('.')[0])) && (!s.labs || !s.labs.length || s.labs.every((l) => arr(R(id).labels).includes(l)))).sort((a, b) => nameOf(h, a).localeCompare(nameOf(h, b), 'nb'));
      const row = (id) => { const d = id.split('.')[0], labs = arr(R(id).labels).map((l) => ui.labelChip(reg.label(l))).join(''); return `<div class="hr li"><button class="lm" data-a="hed" data-v="${esc(id)}"><span class="hi">${ui.ic(h.states[id].attributes.icon || HELP[d][1], 21)}</span><span class="ht"><b data-noi18n>${esc(nameOf(h, id))}</b><i>${s.group === 'type' ? '' : esc(T(HELP[d][0])) + ' · '}<span data-noi18n>${esc(st(h, id))}</span>${labs}</i></span></button><button class="bt sm ic" data-a="org" data-v="${esc(id)}" aria-label="${esc(T('Organiser', 'Organise'))}">${ui.ic('mdi:folder-move-outline', 17)}</button></div>`; };
      let body;
      if (!ids.length) body = ui.empty('mdi:tools', all.length ? T('Ingen treff', 'No matches') : T('Ingen hjelpere ennå', 'No helpers yet'));
      else if (s.group === 'none') body = ui.group(ids.map(row).join(''));
      else {
        const key = (id) => (s.group === 'type' ? id.split('.')[0] : s.group === 'cat' ? ((R(id).categories || {}).helpers || '') : s.group === 'area' ? (entArea(h, id) || '') : (arr(R(id).labels)[0] || ''));
        const meta = (k) => {
          if (s.group === 'type') return [T(HELP[k][0]), HELP[k][1]];
          if (!k) return [s.group === 'cat' ? T('Uten mappe', 'No folder') : s.group === 'area' ? T('Uten område', 'No area') : T('Uten etikett', 'No label'), 'mdi:folder-open-outline'];
          if (s.group === 'cat') { const x = reg.cat('helpers', k); return [x ? x.name : k, (x && x.icon) || 'mdi:folder-outline']; }
          if (s.group === 'area') return [areaName(h, k) || k, 'mdi:sofa-outline'];
          const x = reg.label(k); return [x ? x.name : k, (x && x.icon) || 'mdi:label-outline'];
        };
        const by = new Map(); ids.forEach((id) => { const k = key(id); if (!by.has(k)) by.set(k, []); by.get(k).push(id); });
        const keys = [...by.keys()].sort((p, q2) => (s.group === 'type' ? Object.keys(HELP).indexOf(p) - Object.keys(HELP).indexOf(q2) : (p === '') - (q2 === '') || meta(p)[0].localeCompare(meta(q2)[0], 'nb')));
        body = keys.map((k) => { const [n, ic] = meta(k), open = !s.fold.has(k); return `<button class="fo" data-a="fold" data-v="${esc(k)}" aria-expanded="${open}">${ui.ic(ic, 18)}<span class="g" data-noi18n>${esc(n)}</span><span class="n">${by.get(k).length}</span>${ui.ic('mdi:chevron-down', 18, 'flex:none')}</button>${open ? ui.group(by.get(k).map(row).join('')) : ''}`; }).join('');
      }
      const usedTypes = Object.keys(HELP).filter((d) => all.some((id) => id.startsWith(d + '.')));
      const usedLabs = [...new Set(all.flatMap((id) => arr(R(id).labels)))].map((l) => reg.label(l)).filter(Boolean);
      const gl = { type: ['mdi:shape-outline', 'Type'], cat: ['mdi:folder-outline', 'Mapper'], area: ['mdi:sofa-outline', 'Områder'], label: ['mdi:label-outline', 'Etiketter'], none: ['mdi:format-list-bulleted', 'Liste'] }[s.group];
      return `${search(s)}
        <div class="chs">${ui.chip(`${ui.ic(gl[0], 15)}${esc(T(gl[1]))}${ui.ic('mdi:menu-down', 15)}`, false, 'grp')}${s.group !== 'type' ? usedTypes.map((d) => ui.chip(`${ui.ic(HELP[d][1], 15)}${esc(T(HELP[d][0]))}`, (s.types || []).includes(d), 'ftype', d)).join('') : ''}${usedLabs.map((l) => ui.chip(`<span class="dt" style="--lc:${M.ha.labelColor(l.color)}"></span><span data-noi18n>${esc(l.name)}</span>`, (s.labs || []).includes(l.label_id), 'flab', l.label_id)).join('')}</div>
        ${body}
        <button class="fab" data-a="add">${ui.ic('mdi:plus', 22)}${esc(T('Ny hjelper', 'New helper'))}</button>${CSS}<style>.dt{display:inline-block;width:9px;height:9px;border-radius:5px;background:var(--lc)}</style>`;
    },
    input: qInput,
    act(c, a, el) {
      const s = c.state, v = el.dataset.v;
      if (a === 'qx') { s.q = ''; return c.render(); }
      if (a === 'hed') return c.push('entity', { id: v });
      if (a === 'org') return M.ha.orgSheet ? M.ha.orgSheet(c, 'helpers', v, {}, () => c.render()) : undefined;
      if (a === 'cats') return c.push('cats', { kind: 'helpers' });
      if (a === 'fold') { M.haptic('selection'); if (s.fold.has(v)) s.fold.delete(v); else s.fold.add(v); return c.render(); }
      if (a === 'ftype') { M.haptic('selection'); s.types = (s.types || []).includes(v) ? s.types.filter((x) => x !== v) : [...(s.types || []), v]; return c.render(); }
      if (a === 'flab') { M.haptic('selection'); s.labs = (s.labs || []).includes(v) ? s.labs.filter((x) => x !== v) : [...(s.labs || []), v]; return c.render(); }
      if (a === 'grp') return c.sheet({ title: T('Grupper etter', 'Group by'), html: `<div class="hg">${[['type', 'mdi:shape-outline', 'Type'], ['cat', 'mdi:folder-outline', 'Mapper'], ['area', 'mdi:sofa-outline', 'Områder'], ['label', 'mdi:label-outline', 'Etiketter'], ['none', 'mdi:format-list-bulleted', 'Ingen gruppering']].map(([k, i, t]) => ui.row({ a: 'g', v: k, icon: i, title: T(t), right: s.group === k ? ui.ic('mdi:check', 22, 'color:var(--ki-pink-text, var(--pink,#f285c9))') : '' })).join('')}</div>`, onAct: (x, e2) => { if (x !== 'g') return false; s.group = e2.dataset.v; s.types = []; try { localStorage.setItem('ki-ha-group-helpers', s.group); } catch (e) {} M.haptic('selection'); c.render(); return true; } });
      if (a === 'add') return c.sheet({ title: T('Ny hjelper', 'New helper'), html: `<div class="hg">${Object.entries(HELP).map(([k, [n, i]]) => ui.row({ a: 'k', v: k, icon: i, title: T(n), sub: k, chev: true })).join('')}</div>`, onAct: (x, e2) => { if (x !== 'k') return false; setTimeout(() => c.push('helper', { domain: e2.dataset.v }), 10); return true; } });
      return undefined;
    },
    reload: true,
  });
  M.ha.page('helper', {
    title: (c, a) => `${T('Ny', 'New')} ${T(HELP[a.domain][0]).toLowerCase()}`, sub: (c, a) => a.domain,
    right: (c) => `<button class="hd" data-a="save" ${c.isBusy('save') ? 'disabled' : ''}>${c.isBusy('save') ? '<span class="spn s"></span>' : esc(T('Lagre', 'Save'))}</button>`,
    load: async (c, a) => { c.state.cfg = JSON.parse(JSON.stringify(HELP[a.domain][2])); },
    render(c, a) {
      const f = c.state.cfg; if (!f) return ui.spin();
      const num = (k, l) => ui.field({ f: k, t: 'num', value: f[k], label: T(l), attrs: 'inputmode="decimal"' });
      const extra = {
        input_number: `<div class="r2">${num('min', 'Min')}${num('max', 'Maks')}</div><div class="r2">${num('step', 'Steg')}${ui.field({ f: 'unit_of_measurement', value: f.unit_of_measurement, label: T('Enhet'), ph: '°C' })}</div>${ui.seg('mode', f.mode, [['slider', T('Glidebryter', 'Slider')], ['box', T('Felt', 'Box')]])}`,
        input_select: ui.field({ f: 'options', value: f.options.join('\n'), label: T('Valg (ett per linje)', 'Options (one per line)'), area: true, rows: 4 }),
        input_text: `<div class="r2">${num('min', 'Min lengde')}${num('max', 'Maks lengde')}</div>${ui.seg('mode', f.mode, [['text', T('Tekst', 'Text')], ['password', T('Passord', 'Password')]])}`,
        input_datetime: ui.seg('dt', f.has_date && f.has_time ? 'both' : f.has_date ? 'date' : 'time', [['both', T('Dato og tid', 'Date and time')], ['date', T('Dato', 'Date')], ['time', T('Tid', 'Time')]]),
        counter: `<div class="r2">${num('initial', 'Startverdi')}${num('step', 'Steg')}</div>`,
        timer: ui.field({ f: 'duration', value: f.duration, label: T('Varighet (tt:mm:ss)', 'Duration (hh:mm:ss)'), mono: true }),
      }[a.domain] || '';
      return `<div class="hg"><div class="frm">${ui.field({ f: 'name', value: f.name, label: T('Navn', 'Name'), ph: T('F.eks. Gjestemodus', 'E.g. Guest mode') })}<div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'hic', value: f.icon || '', placeholder: HELP[a.domain][1], attrs: 'data-f="icon"' }) : ui.field({ f: 'icon', value: f.icon })}</div>${extra}</div></div>`;
    },
    input(c, el, v) { const f = c.state.cfg, k = el.dataset.f; if (!f || !k) return; if (k === 'options') f.options = String(v).split('\n').map((x) => x.trim()).filter(Boolean); else if (el.dataset.t === 'num') f[k] = v === '' ? undefined : Number(v); else f[k] = v; },
    act(c, a, el, args) {
      const f = c.state.cfg;
      if (a === 'seg') { const k = el.dataset.f, v = el.dataset.v; if (k === 'dt') { f.has_date = v !== 'time'; f.has_time = v !== 'date'; } else f[k] = v; M.haptic('selection'); return c.render(); }
      if (a === 'save') {
        if (!String(f.name || '').trim()) { M.haptic('warning'); return c.toast(T('Gi den et navn først', 'Give it a name first'), { type: 'error' }); }
        const body = { ...f }; Object.keys(body).forEach((k) => { if (body[k] === '' || body[k] == null) delete body[k]; });
        return c.busy('save', c.ws(`${args.domain}/create`, body)).then(() => { M.haptic('success'); c.toast(T('Hjelperen er laget', 'Helper created')); c.pop(); }).catch((e) => c.err(e, T('Kunne ikke lage hjelperen', 'Could not create the helper')));
      }
      return undefined;
    },
  });

  /* ============================================================ områder, etasjer og soner */
  M.ha.page('areas', {
    title: () => T('Områder, etasjer og soner', 'Areas, floors and zones'), haPath: '/config/areas/dashboard',
    load: async (c) => { const [fl, ar, zo] = await Promise.all([ws(c, 'config/floor_registry/list'), ws(c, 'config/area_registry/list'), ws(c, 'zone/list')]); c.state.floors = A(fl, 'floors'); c.state.areas = A(ar, 'areas'); if (!c.state.areas.length) c.state.areas = M.areas ? M.areas(c.h) : Object.values(c.h.areas || {}); c.state.zones = A(zo, 'zones'); },
    render(c) {
      const s = c.state, h = c.h, tab = s.tab || 'areas'; if (!s.areas) return ui.spin();
      const cnt = (aid) => Object.keys(h.states).filter((id) => entArea(h, id) === aid).length;
      let body;
      if (tab === 'areas') {
        const fl = s.floors.slice().sort((a, b) => (a.level || 0) - (b.level || 0)), grp = [...fl.map((f) => [f.name, f.icon || 'mdi:home-floor-' + (f.level != null ? Math.max(0, Math.min(3, f.level)) : 1), s.areas.filter((x) => x.floor_id === f.floor_id)]), [T('Uten etasje', 'No floor'), 'mdi:home-outline', s.areas.filter((x) => !x.floor_id || !fl.some((f) => f.floor_id === x.floor_id))]].filter((g) => g[2].length);
        body = grp.map(([n, ic, L]) => `<div class="fo" style="pointer-events:none">${ui.ic(ic, 18)}<span class="g" data-noi18n>${esc(n)}</span><span class="n">${L.length}</span></div>${ui.group(L.map((x) => ui.row({ a: 'area', v: x.area_id, icon: x.icon || 'mdi:sofa-outline', title: x.name, sub: `${cnt(x.area_id)} ${T('entiteter', 'entities')}`, chev: true })).join(''))}`).join('') + `<button class="fab" data-a="newarea">${ui.ic('mdi:plus', 22)}${esc(T('Nytt område', 'New area'))}</button>`;
      } else if (tab === 'floors') {
        body = (s.floors.length ? ui.group(s.floors.map((f) => ui.row({ a: 'floor', v: f.floor_id, icon: f.icon || 'mdi:home-floor-1', title: f.name, sub: `${T('Nivå', 'Level')} ${f.level != null ? f.level : '–'} · ${s.areas.filter((x) => x.floor_id === f.floor_id).length} ${T('områder', 'areas')}`, chev: true })).join('')) : ui.empty('mdi:home-floor-1', T('Ingen etasjer', 'No floors'))) + `<button class="fab" data-a="newfloor">${ui.ic('mdi:plus', 22)}${esc(T('Ny etasje', 'New floor'))}</button>`;
      } else {
        const home = h.config || {};
        body = `${ui.group(ui.row({ a: 'ext', v: '/config/general', icon: 'mdi:home', iconBg: 'var(--green,#66d19e)', title: home.location_name || T('Hjem', 'Home'), sub: `${T('Radius', 'Radius')} ${home.radius || 100} m · ${T('fra Generelt', 'from General')}` }))}${s.zones.length ? ui.group(s.zones.map((z) => ui.row({ a: 'zone', v: z.id, icon: z.icon || 'mdi:map-marker-radius', title: z.name, sub: `${T('Radius', 'Radius')} ${z.radius} m${z.passive ? ' · ' + T('passiv', 'passive') : ''}`, chev: true })).join('')) : ''}<button class="fab" data-a="newzone">${ui.ic('mdi:plus', 22)}${esc(T('Ny sone', 'New zone'))}</button>`;
      }
      return `${ui.seg('__tab', tab, [['areas', T('Områder', 'Areas')], ['floors', T('Etasjer', 'Floors')], ['zones', T('Soner', 'Zones')]])}${body}`;
    },
    act(c, a, el) {
      const s = c.state, v = el.dataset.v, re = () => { c.top && (c.top.loaded = false); return M.ha.pages.areas.load(c).then(() => c.render()); };
      if (a === 'seg') { s.tab = v; M.haptic('selection'); return c.render(); }
      const form = (title, fields, vals, save, del) => {
        const o = { ...vals };
        c.sheet({ title, html: `${fields.map(([k, l, t]) => k === 'icon' ? `<div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'aic', value: o.icon || '', attrs: 'data-f="icon"' }) : ui.field({ f: 'icon', value: o.icon })}</div>` : k === 'floor_id' ? `<div class="fd"><span class="fl">${esc(T('Etasje', 'Floor'))}</span><div class="chs wrap">${ui.chip(esc(T('Ingen', 'None')), !o.floor_id, 'fl', '')}${s.floors.map((f) => ui.chip(`<span data-noi18n>${esc(f.name)}</span>`, o.floor_id === f.floor_id, 'fl', f.floor_id)).join('')}</div></div>` : ui.field({ f: k, t, value: o[k], label: T(l), attrs: t === 'num' ? 'inputmode="decimal"' : '' })).join('')}
          <div class="bts" style="justify-content:space-between;margin-top:6px">${del ? ui.btn(T('Slett', 'Delete'), 'del', null, 'warn', 'mdi:delete-outline') : '<span></span>'}${ui.btn(T('Lagre', 'Save'), 'save', null, 'pri')}</div>`,
          onInput: (e2, val) => { const k = e2.dataset.f; o[k] = e2.dataset.t === 'num' ? (val === '' ? undefined : Number(String(val).replace(',', '.'))) : val; },
          onAct: (x, e2) => {
            if (x === 'fl') { o.floor_id = e2.dataset.v || null; e2.parentElement.querySelectorAll('.ch').forEach((b) => b.classList.toggle('on', b === e2)); M.haptic('selection'); return false; }
            if (x === 'save') { if (!String(o.name || '').trim()) { M.haptic('warning'); return false; } save(o).then(() => { M.haptic('success'); re(); }).catch((er) => c.err(er)); return true; }
            if (x === 'del') { if (e2.dataset.arm !== '1') { e2.dataset.arm = '1'; e2.querySelector('span').textContent = T('Sikker?', 'Sure?'); M.haptic('warning'); return false; } del().then(() => { M.haptic('medium'); re(); }).catch((er) => c.err(er)); return true; }
            return false;
          } });
      };
      const AF = [['name', 'Navn'], ['icon'], ['floor_id']], FF = [['name', 'Navn'], ['icon'], ['level', 'Nivå', 'num']], ZF = [['name', 'Navn'], ['icon'], ['latitude', 'Breddegrad', 'num'], ['longitude', 'Lengdegrad', 'num'], ['radius', 'Radius (m)', 'num']];
      if (a === 'newarea') return form(T('Nytt område', 'New area'), AF, {}, (o) => c.ws('config/area_registry/create', { name: o.name, icon: o.icon || null, floor_id: o.floor_id || null }));
      if (a === 'area') { const x = s.areas.find((y) => y.area_id === v); return form(T('Rediger område', 'Edit area'), AF, x, (o) => c.ws('config/area_registry/update', { area_id: v, name: o.name, icon: o.icon || null, floor_id: o.floor_id || null }), () => c.ws('config/area_registry/delete', { area_id: v })); }
      if (a === 'newfloor') return form(T('Ny etasje', 'New floor'), FF, { level: s.floors.length }, (o) => c.ws('config/floor_registry/create', { name: o.name, icon: o.icon || null, level: o.level != null ? o.level : null }));
      if (a === 'floor') { const x = s.floors.find((y) => y.floor_id === v); return form(T('Rediger etasje', 'Edit floor'), FF, x, (o) => c.ws('config/floor_registry/update', { floor_id: v, name: o.name, icon: o.icon || null, level: o.level != null ? o.level : null }), () => c.ws('config/floor_registry/delete', { floor_id: v })); }
      const hc = c.h.config || {};
      if (a === 'newzone') return form(T('Ny sone', 'New zone'), ZF, { latitude: hc.latitude, longitude: hc.longitude, radius: 100, icon: 'mdi:map-marker' }, (o) => c.ws('zone/create', { name: o.name, icon: o.icon || 'mdi:map-marker', latitude: o.latitude, longitude: o.longitude, radius: o.radius || 100, passive: false }));
      if (a === 'zone') { const x = s.zones.find((y) => y.id === v); return form(T('Rediger sone', 'Edit zone'), ZF, x, (o) => c.ws('zone/update', { zone_id: v, name: o.name, icon: o.icon, latitude: o.latitude, longitude: o.longitude, radius: o.radius, passive: !!x.passive }), () => c.ws('zone/delete', { zone_id: v })); }
      return undefined;
    },
    reload: true,
  });

  /* ============================================================ personer og brukere */
  M.ha.page('persons', {
    title: () => T('Personer', 'People'), haPath: '/config/person',
    load: async (c) => { const [p, u] = await Promise.all([ws(c, 'person/list'), ws(c, 'config/auth/list')]); c.state.storage = (p && p.storage) || []; c.state.users = A(u, 'users'); },
    render(c) {
      const h = c.h, s = c.state; if (!s.storage) return ui.spin();
      const ids = Object.keys(h.states).filter((id) => id.startsWith('person.'));
      const L = s.storage.length ? s.storage : ids.map((id) => ({ id: id.split('.')[1], name: nameOf(h, id), device_trackers: arr(h.states[id].attributes.device_trackers), user_id: h.states[id].attributes.user_id }));
      const row = (p) => { const e = 'person.' + p.id, ps = h.states[e], u = s.users.find((x) => x.id === p.user_id); const pic = ps && ps.attributes.entity_picture; return `<button class="hr" data-a="p" data-v="${esc(p.id)}"><span class="hi" style="overflow:hidden;${ps && ps.state === 'home' ? 'background:var(--green,#66d19e);color:#232323' : ''}">${pic ? `<img src="${esc(pic)}" alt="" style="width:100%;height:100%;object-fit:cover">` : ui.ic('mdi:account', 22)}</span><span class="ht"><b data-noi18n>${esc(p.name)}</b><i>${esc(ps ? (ps.state === 'home' ? T('Hjemme', 'Home') : ps.state === 'not_home' ? T('Borte', 'Away') : ps.state) : '–')}${u ? ' · ' + esc(u.group_ids && u.group_ids.includes('system-admin') ? T('administrator', 'administrator') : T('bruker', 'user')) : ' · ' + esc(T('kan ikke logge inn', 'cannot log in'))}</i></span>${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3,#7f7f7f)')}</button>`; };
      return `${ui.group(L.map(row).join('')) || ui.empty('mdi:account-group', T('Ingen personer', 'No people'))}<button class="fab" data-a="new">${ui.ic('mdi:account-plus-outline', 22)}${esc(T('Legg til person', 'Add person'))}</button>`;
    },
    act(c, a, el) {
      const s = c.state, h = c.h, v = el.dataset.v;
      const p = a === 'new' ? { name: '', device_trackers: [] } : (s.storage.find((x) => x.id === v) || { id: v, name: nameOf(h, 'person.' + v), device_trackers: arr((h.states['person.' + v] || { attributes: {} }).attributes.device_trackers) });
      if (a !== 'p' && a !== 'new') return undefined;
      const o = { name: p.name, device_trackers: arr(p.device_trackers).slice() };
      const trk = Object.keys(h.states).filter((id) => id.startsWith('device_tracker.'));
      const html = () => `${ui.field({ f: 'name', value: o.name, label: T('Navn', 'Name') })}${ui.sec(T('Spores av', 'Tracked by'))}<div class="hg">${trk.map((t) => ui.row({ a: 'trk', v: t, icon: 'mdi:cellphone-marker', title: nameOf(h, t), sub: t, right: ui.sw(o.device_trackers.includes(t), 'trk', t) })).join('') || `<p class="mut" style="margin:10px">${esc(T('Ingen sporingsenheter', 'No trackers'))}</p>`}</div>
        <div class="bts" style="justify-content:space-between;margin-top:6px">${a === 'p' && s.storage.some((x) => x.id === v) ? ui.btn(T('Slett', 'Delete'), 'del', null, 'warn', 'mdi:delete-outline') : '<span></span>'}${ui.btn(T('Lagre', 'Save'), 'save', null, 'pri')}</div>`;
      c.sheet({ title: a === 'new' ? T('Ny person', 'New person') : p.name, html: html(),
        onInput: (e2, val) => { if (e2.dataset.f === 'name') o.name = val; },
        onAct: (x, e2) => {
          if (x === 'trk') { const t = e2.dataset.v; o.device_trackers = o.device_trackers.includes(t) ? o.device_trackers.filter((y) => y !== t) : [...o.device_trackers, t]; M.haptic('selection'); M.ha.current.sheetHtml(html()); return false; }
          if (x === 'save') { if (!o.name.trim()) return false; (a === 'new' ? c.ws('person/create', { name: o.name, device_trackers: o.device_trackers }) : c.ws('person/update', { person_id: v, name: o.name, device_trackers: o.device_trackers, user_id: p.user_id || null, picture: p.picture || null })).then(() => { M.haptic('success'); M.ha.pages.persons.load(c).then(() => c.render()); }).catch((er) => c.err(er)); return true; }
          if (x === 'del') { if (e2.dataset.arm !== '1') { e2.dataset.arm = '1'; e2.querySelector('span').textContent = T('Sikker?', 'Sure?'); M.haptic('warning'); return false; } c.ws('person/delete', { person_id: v }).then(() => M.ha.pages.persons.load(c).then(() => c.render())).catch((er) => c.err(er)); return true; }
          return false;
        } });
      return undefined;
    },
  });

  /* ============================================================ tillegg (Supervisor) */
  const sup = (c, endpoint, method, data) => c.ws('supervisor/api', { endpoint, method: method || 'get', ...(data ? { data } : {}) });
  M.ha.page('addons', {
    title: () => T('Tillegg', 'Add-ons'), haPath: '/hassio/dashboard',
    load: async (c) => { const r = await sup(c, '/addons').catch(() => null); c.state.list = r ? A(r, 'addons') : null; c.state.noSup = !r; },
    render(c) {
      const s = c.state; if (s.noSup) return ui.empty('mdi:puzzle-plus-outline', T('Tillegg krever Home Assistant OS eller Supervised', 'Add-ons require Home Assistant OS or Supervised'));
      if (!s.list) return ui.spin();
      return ui.group(s.list.sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<button class="hr" data-a="ad" data-v="${esc(x.slug)}"><span class="hi br">${x.icon ? `<img src="/api/hassio/addons/${esc(x.slug)}/icon" alt="">` : ui.ic('mdi:puzzle', 22)}</span><span class="ht"><b data-noi18n>${esc(x.name)}</b><i>${esc(x.state === 'started' ? T('Kjører', 'Running') : T('Stoppet', 'Stopped'))} · ${esc(x.version)}${x.update_available ? ' · ' + esc(T('oppdatering', 'update')) : ''}</i></span>${x.update_available ? ui.badge('1', true) : ''}${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3,#7f7f7f)')}</button>`).join('')) + CSS;
    },
    act(c, a, el) { if (a === 'ad') return c.push('addon', { slug: el.dataset.v }); return undefined; },
    reload: true,
  });
  M.ha.page('addon', {
    title: (c) => (c.state.info ? c.state.info.name : T('Tillegg', 'Add-on')), sub: (c) => (c.state.info ? c.state.info.version : ''),
    haPath: (c, a) => `/hassio/addon/${a.slug}/info`,
    load: async (c, a) => { c.state.info = await sup(c, `/addons/${a.slug}/info`); },
    render(c) {
      const x = c.state.info; if (!x) return ui.spin(); const run = x.state === 'started';
      return `<div class="card"><p>${esc(x.description || '')}</p><div class="kv"><span>${esc(T('Status', 'Status'))}</span><b class="${run ? 'ok' : ''}">${esc(run ? T('Kjører', 'Running') : T('Stoppet', 'Stopped'))}</b><span>${esc(T('Versjon', 'Version'))}</span><b>${esc(x.version)}${x.update_available ? ` → ${esc(x.version_latest)}` : ''}</b></div></div>
        <div class="bts">${run ? ui.btn(T('Stopp', 'Stop'), 'op', 'stop', '', 'mdi:stop') + ui.btn(T('Start på nytt', 'Restart'), 'op', 'restart', '', 'mdi:restart') : ui.btn(T('Start', 'Start'), 'op', 'start', 'pri', 'mdi:play')}${x.update_available ? ui.btn(T('Oppdater', 'Update'), 'op', 'update', 'pri', 'mdi:update') : ''}${x.ingress ? ui.btn(T('Åpne', 'Open'), 'ext', `/hassio/ingress/${x.slug}`, '', 'mdi:open-in-new') : ''}</div>
        ${ui.group([ui.row({ a: 'tg', v: 'boot', icon: 'mdi:power', title: T('Start ved oppstart', 'Start on boot'), right: ui.sw(x.boot === 'auto', 'tg', 'boot') }), ui.row({ a: 'tg', v: 'watchdog', icon: 'mdi:dog-service', title: T('Vakthund', 'Watchdog'), right: ui.sw(!!x.watchdog, 'tg', 'watchdog') }), ui.row({ a: 'tg', v: 'auto_update', icon: 'mdi:update', title: T('Oppdater automatisk', 'Auto update'), right: ui.sw(!!x.auto_update, 'tg', 'auto_update') })].join(''))}
        <details class="adv"><summary>${esc(T('Logg', 'Log'))}</summary><pre class="pre" data-noi18n data-key="alog">${esc(c.state.log || T('Trykk for å hente …', 'Tap to load …'))}</pre></details>`;
    },
    act(c, a, el, args) {
      const v = el.dataset.v, x = c.state.info;
      if (a === 'op') return c.busy('op', sup(c, `/addons/${args.slug}/${v}`, 'post')).then(() => { M.haptic('success'); return M.ha.pages.addon.load(c, args).then(() => c.render()); }).catch((e) => c.err(e));
      if (a === 'tg') { const val = v === 'boot' ? (x.boot === 'auto' ? 'manual' : 'auto') : !x[v]; return sup(c, `/addons/${args.slug}/options`, 'post', { [v]: val }).then(() => { x[v] = val; M.haptic('selection'); c.render(); }).catch((e) => c.err(e)); }
      return undefined;
    },
  });
  document.addEventListener('toggle', (e) => { const d = e.target; if (!d || !d.matches || !d.matches('details.adv') || !d.open) return; const pre = d.querySelector('[data-key="alog"]'); const cur = M.ha.current; if (!pre || !cur || cur.top.id !== 'addon' || cur.top.st.log) return; sup(cur.ctx, `/addons/${cur.top.args.slug}/logs`).then((t) => { cur.top.st.log = typeof t === 'string' ? t : JSON.stringify(t); pre.textContent = cur.top.st.log; }).catch(() => { pre.textContent = T('Kunne ikke hente loggen', 'Could not load the log'); }); }, true);

  M.ha.panels1 = true;
})();
