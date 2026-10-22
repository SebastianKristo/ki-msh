/* KI MSH · scene-editor (Fiks 65). En scene i HA = en liste entiteter med lagret tilstand (state + attributter).
 * Arbeidsflyt som i HA, men enklere: legg til entiteter (nåværende tilstand hentes med), juster lys/klima i appen eller
 * HAs more-info (trykk på raden), trykk «Hent nå» per entitet eller «Hent alle», test med «Prøv scenen» (scene.apply)
 * og lagre (config/scene/config/<id>). Hver entitets lagrede tilstand kan også redigeres i YAML.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || !M.ha.blocks || M.ha.scenePage) return;
  const esc = M.esc, ui = M.ha.ui, reg = M.ha.reg, B = M.ha.blocks;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = B.arr;

  // Attributter som gjenskaper tilstanden per domene (resten er måleverdier/metadata som ikke skal lagres)
  const KEEP = {
    light: (a) => { const o = {}; if (a.brightness != null) o.brightness = a.brightness; const cm = a.color_mode; if (cm === 'color_temp' && a.color_temp_kelvin != null) o.color_temp_kelvin = a.color_temp_kelvin; else if (cm === 'hs' && a.hs_color) o.hs_color = a.hs_color; else if (cm === 'rgb' && a.rgb_color) o.rgb_color = a.rgb_color; else if (cm === 'rgbw' && a.rgbw_color) o.rgbw_color = a.rgbw_color; else if (cm === 'rgbww' && a.rgbww_color) o.rgbww_color = a.rgbww_color; else if (cm === 'xy' && a.xy_color) o.xy_color = a.xy_color; if (a.effect && a.effect !== 'none' && a.effect !== 'None') o.effect = a.effect; return o; },
    climate: (a) => { const o = {}; ['temperature', 'target_temp_high', 'target_temp_low', 'fan_mode', 'preset_mode', 'swing_mode', 'humidity'].forEach((k) => { if (a[k] != null) o[k] = a[k]; }); return o; },
    cover: (a) => { const o = {}; if (a.current_position != null) o.current_position = a.current_position; if (a.current_tilt_position != null) o.current_tilt_position = a.current_tilt_position; return o; },
    fan: (a) => { const o = {}; ['percentage', 'preset_mode', 'oscillating', 'direction'].forEach((k) => { if (a[k] != null) o[k] = a[k]; }); return o; },
    media_player: (a) => { const o = {}; ['volume_level', 'is_volume_muted', 'source', 'sound_mode'].forEach((k) => { if (a[k] != null) o[k] = a[k]; }); return o; },
    humidifier: (a) => { const o = {}; ['humidity', 'mode'].forEach((k) => { if (a[k] != null) o[k] = a[k]; }); return o; },
    water_heater: (a) => { const o = {}; ['temperature', 'operation_mode', 'away_mode'].forEach((k) => { if (a[k] != null) o[k] = a[k]; }); return o; },
    vacuum: () => ({}), valve: (a) => (a.current_position != null ? { current_position: a.current_position } : {}),
  };
  const capture = (h, id) => {
    const s = h && h.states[id];
    if (!s) return { state: 'off' };
    const d = id.split('.')[0], k = KEEP[d];
    const base = { state: s.state };
    return s.state === 'off' || !k ? base : { ...base, ...k(s.attributes || {}) };
  };
  const stOf = (v) => (v && typeof v === 'object' ? v : { state: v });
  const ST = { on: 'på', off: 'av', open: 'åpen', closed: 'lukket', locked: 'låst', unlocked: 'ulåst', playing: 'spiller', paused: 'pauset', heat: 'varme', cool: 'kjøling', auto: 'auto', heat_cool: 'varme/kjøling', dry: 'tørking', fan_only: 'vifte' };
  function summary(v) {
    const o = stOf(v), p = [T(ST[o.state] || String(o.state == null ? '–' : o.state))];
    if (o.brightness != null) p.push(Math.round((o.brightness / 255) * 100) + ' %');
    if (o.color_temp_kelvin != null) p.push(o.color_temp_kelvin + ' K');
    if (o.rgb_color || o.hs_color || o.xy_color) p.push(T('farge', 'colour'));
    if (o.temperature != null) p.push(o.temperature + '°');
    if (o.current_position != null) p.push(o.current_position + ' %');
    if (o.percentage != null) p.push(o.percentage + ' %');
    if (o.volume_level != null) p.push(T('volum', 'volume') + ' ' + Math.round(o.volume_level * 100) + ' %');
    if (o.source) p.push(o.source);
    return p.join(' · ');
  }
  const swatch = (o) => { o = stOf(o); if (o.state !== 'on') return ''; let c = null; if (o.rgb_color) c = `rgb(${o.rgb_color.join(',')})`; else if (o.hs_color) c = `hsl(${o.hs_color[0]} ${Math.max(40, o.hs_color[1])}% 60%)`; else if (o.color_temp_kelvin) { const k = o.color_temp_kelvin; c = k < 3000 ? '#ffb46b' : k < 4200 ? '#ffd9a8' : '#e6f0ff'; } else c = '#ffd27a'; return `<span class="sw8" style="background:${c};opacity:${o.brightness != null ? 0.35 + (o.brightness / 255) * 0.65 : 1}"></span>`; };
  const dirty = (st) => JSON.stringify(st.cfg) !== st.orig;
  const nameOf = (h, id) => { const s = h && h.states[id]; return (s && s.attributes.friendly_name) || id; };

  M.ha.page('scene', {
    userTitle: true,
    title: (c, a) => (c.state.cfg && c.state.cfg.name) || (a.isNew ? T('Ny scene', 'New scene') : nameOf(c.h, a.entity)),
    sub: (c, a) => (c.state.cfg ? (dirty(c.state) ? T('Ikke lagret', 'Not saved') : a.isNew ? T('Ny', 'New') : T('Lagret', 'Saved')) : ''),
    haPath: (c, a) => (a.id ? `/config/scene/edit/${a.id}` : '/config/scene/dashboard'),
    right: (c, a) => { const st = c.state; if (!st.cfg) return ''; return `${a.entity ? `<button class="hb" data-a="emore" aria-label="${esc(T('Mer', 'More'))}">${ui.ic('mdi:dots-vertical', 20)}</button>` : ''}<button class="hd" data-a="save" ${dirty(st) && !c.isBusy('save') ? '' : 'disabled'}>${c.isBusy('save') ? '<span class="spn s"></span>' : esc(T('Lagre', 'Save'))}</button>`; },
    async load(c, a) {
      const st = c.state;
      let cfg;
      if (a.isNew && a.copyOf) { cfg = await c.api('GET', `config/scene/config/${a.copyOf}`); cfg = { ...cfg, name: `${cfg.name || ''} (${T('kopi', 'copy')})` }; delete cfg.id; }
      else if (a.isNew) cfg = { name: '', icon: '', entities: {} };
      else cfg = await c.api('GET', `config/scene/config/${a.id}`);
      if (!cfg.entities || typeof cfg.entities !== 'object') cfg.entities = {};
      delete cfg.id;
      st.cfg = cfg; st.orig = a.isNew ? '' : JSON.stringify(cfg); st.org = {}; st.yb = new Set();
    },
    back(c) { const st = c.state; if (st.cfg && dirty(st) && !c.armed('discard')) { c.confirm('discard'); c.toast(T('Ikke lagret – trykk tilbake igjen for å forkaste', 'Not saved – tap back again to discard'), { type: 'error' }); return false; } return true; },
    render(c, a) {
      const st = c.state, h = c.h;
      if (!st.cfg) return ui.spin();
      const cfg = st.cfg, ids = Object.keys(cfg.entities);
      const o = a.entity ? (() => { const r = reg.ent(a.entity) || {}; return { cat: (r.categories || {}).scene, labels: arr(r.labels), area: r.area_id }; })() : { cat: st.org.cat, labels: arr(st.org.labels), area: st.org.area };
      const cat = reg.cat('scene', o.cat), area = o.area && h.areas && h.areas[o.area];
      const rows = ids.map((id) => {
        const v = cfg.entities[id], cur = capture(h, id), same = JSON.stringify(stOf(v)) === JSON.stringify(cur), yb = st.yb.has(id);
        const f = 'ent::' + id, raw = st.raw && st.raw[f];
        return `<div class="se" data-key="se-${esc(id)}"><div class="hr">
            <button class="lm" data-a="mi" data-v="${esc(id)}"><span class="hi">${ui.ic(M.domainIcon(id, h.states[id]), 21)}</span><span class="ht"><b data-noi18n>${esc(nameOf(h, id))}</b><i>${swatch(v)}${esc(summary(v))}${same ? '' : ` · <span class="chg">${esc(T('nå', 'now'))}: ${esc(summary(cur))}</span>`}</i></span></button>
            <button class="bt sm ${same ? '' : 'pri'}" data-a="cap" data-v="${esc(id)}" ${same ? 'disabled' : ''}>${ui.ic('mdi:download', 16)}<span>${esc(T('Hent', 'Capture'))}</span></button>
            <button class="bt sm ic ${yb ? 'on' : ''}" data-a="yb" data-v="${esc(id)}" aria-label="YAML">${ui.ic('mdi:code-braces', 17)}</button>
            <button class="bt sm ic warn" data-a="rm" data-v="${esc(id)}" aria-label="${esc(T('Fjern', 'Remove'))}">${c.armed('rm' + id) ? ui.ic('mdi:check', 17) : ui.ic('mdi:close', 17)}</button></div>
          ${yb ? `<div class="frm">${ui.field({ f, t: 'yaml', value: raw ? raw.text : M.yaml.dump(stOf(v)).replace(/\n$/, ''), area: true, rows: 5, mono: true })}${raw && raw.err ? `<span class="fh err">${esc(raw.err)}</span>` : ''}</div>` : ''}</div>`;
      }).join('');
      const anyDiff = ids.some((id) => JSON.stringify(stOf(cfg.entities[id])) !== JSON.stringify(capture(h, id)));
      return `<div class="hg"><div class="frm">
          ${ui.field({ f: 'name', value: cfg.name, label: T('Navn', 'Name'), ph: T('F.eks. Filmkveld', 'E.g. Movie night') })}
          <div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'scic', value: cfg.icon || '', placeholder: 'mdi:palette', attrs: 'data-f="icon"' }) : ui.field({ f: 'icon', value: cfg.icon })}</div></div>
          <button class="hr" data-a="org">${ui.ic('mdi:folder-outline', 22, 'margin:0 9px')}<span class="ht"><b>${esc(T('Mappe, etiketter og område', 'Folder, labels and area'))}</b><i>${esc([cat ? cat.name : T('Ingen mappe', 'No folder'), area ? area.name : ''].filter(Boolean).join(' · '))}${o.labels.map((l) => ui.labelChip(reg.label(l))).join('')}</i></span>${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3, #7f7f7f)')}</button></div>
        <div class="card" style="padding:12px 14px"><p>${esc(T('Still inn enhetene slik du vil ha dem (trykk på en rad for å styre den), og trykk «Hent» for å lagre tilstanden i scenen.', 'Set the devices the way you want them (tap a row to control it), then tap «Capture» to store the state in the scene.'))}</p>
          <div class="bts">${ui.btn(T('Prøv scenen', 'Try the scene'), 'apply', null, 'sm', 'mdi:play')}${ids.length ? ui.btn(T('Hent alle nå', 'Capture all now'), 'capall', null, `sm ${anyDiff ? 'pri' : ''}`, 'mdi:download-multiple') : ''}</div></div>
        ${ui.sec(`${T('Entiteter', 'Entities')} · ${ids.length}`)}
        ${ids.length ? `<div class="hg">${rows}</div>` : ui.empty('mdi:palette-outline', T('Legg til lys, klima, gardiner og annet som skal være med i scenen', 'Add lights, climate, covers and anything else for the scene'))}
        <div class="fd" style="margin-top:4px">${M.entityPicker ? M.entityPicker.html({ key: 'scadd', value: '', mode: 'add', placeholder: T('Legg til entitet', 'Add entity'), attrs: 'data-f="add" data-mode="add"' }) : ui.field({ f: 'add', ph: 'light.stue' })}</div>
        <style>.se+.se{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}.se .hr{padding:6px 8px 6px 4px;gap:6px}.se .lm{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:4px 4px 4px 10px;text-align:left}
          .sw8{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:2px;vertical-align:-1px;box-shadow:0 0 0 1px rgba(0,0,0,.2)}.chg{color:var(--ki-pink-text, var(--pink,#f285c9))}.bt.on{background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #232323)}</style>`;
    },
    input(c, el, v, commit) {
      const st = c.state, f = el.dataset.f;
      if (!st.cfg) return;
      const soft = () => { const hd = M.ha.current.root.querySelector('.hh .hd'); if (hd) hd.disabled = !dirty(st); };
      if (f === 'name') { st.cfg.name = v; const tt = M.ha.current.root.querySelector('.hh .tt b'); if (tt) tt.textContent = v || T('Ny scene', 'New scene'); return commit ? c.render() : soft(); }
      if (f === 'icon') { if (v) st.cfg.icon = v; else delete st.cfg.icon; return c.render(); }
      if (f === 'add') { if (!v || st.cfg.entities[v]) return undefined; st.cfg.entities[v] = capture(c.h, v); M.haptic('success'); const pk = el; if (pk && 'value' in pk) setTimeout(() => { try { pk.value = ''; } catch (e) { /* */ } }, 0); return c.render(); }
      if (f && f.startsWith('ent::')) {
        const id = f.slice(5); st.raw = st.raw || {};
        try { const p = M.yaml.parse(v); st.cfg.entities[id] = p; st.raw[f] = { text: v }; } catch (e) { st.raw[f] = { text: v, err: e.message }; }
        return commit ? c.render() : soft();
      }
      return undefined;
    },
    act(c, a, el, args) {
      const st = c.state, v = el.dataset.v, h = c.h;
      switch (a) {
        case 'mi': return M.moreInfo(null, v);
        case 'cap': M.haptic('success'); st.cfg.entities[v] = capture(h, v); return c.render();
        case 'capall': M.haptic('success'); Object.keys(st.cfg.entities).forEach((id) => { st.cfg.entities[id] = capture(h, id); }); return c.render();
        case 'yb': if (st.yb.has(v)) st.yb.delete(v); else st.yb.add(v); return c.render();
        case 'rm': if (!c.confirm('rm' + v)) return undefined; delete st.cfg.entities[v]; M.haptic('medium'); return c.render();
        case 'apply': M.haptic('medium'); return c.ws('call_service', { domain: 'scene', service: 'apply', service_data: { entities: st.cfg.entities } }).then(() => c.toast(T('Scenen er brukt', 'Scene applied'))).catch((e) => c.err(e));
        case 'org': return M.ha.orgSheet(c, 'scene', args.entity || null, st.org, () => c.render());
        case 'emore': return M.ha.moreSheet(c, 'scene', args.entity, true);
        case 'save': return save(c, args);
        default: return undefined;
      }
    },
  });
  async function save(c, a) {
    const st = c.state, h = c.h;
    if (!String(st.cfg.name || '').trim()) { M.haptic('warning'); return c.toast(T('Gi scenen et navn først', 'Give the scene a name first'), { type: 'error' }); }
    if (!Object.keys(st.cfg.entities).length) { M.haptic('warning'); return c.toast(T('Legg til minst én entitet', 'Add at least one entity'), { type: 'error' }); }
    const id = a.id || String(Date.now());
    try { await c.busy('save', c.api('POST', `config/scene/config/${id}`, { id, ...st.cfg })); } catch (e) { return c.err(e, T('Kunne ikke lagre', 'Could not save')); }
    M.haptic('success'); c.toast(T('Lagret', 'Saved'));
    st.orig = JSON.stringify(st.cfg);
    if (!a.id) {
      a.id = id; a.isNew = false;
      const find = () => Object.keys(c.h.states).find((x) => x.startsWith('scene.') && String(c.h.states[x].attributes.id) === id);
      for (let i = 0; i < 25 && !find(); i++) await new Promise((r) => setTimeout(r, 200));
      const ent = find();
      if (ent) {
        a.entity = ent;
        const o = st.org || {}, patch = {};
        if (o.cat) patch.categories = { scene: o.cat };
        if (o.labels && o.labels.length) patch.labels = o.labels;
        if (o.area) patch.area_id = o.area;
        if (Object.keys(patch).length) { try { await reg.load(c.h, true); await c.ws('config/entity_registry/update', { entity_id: ent, ...patch }); await reg.load(c.h, true); } catch (e) { c.err(e); } }
      }
    }
    c.render();
    return undefined;
  }
  M.ha.scenePage = true;
})();
