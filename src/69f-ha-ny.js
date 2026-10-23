/* KI MSH · Home Assistant-innstillinger: «Lag ny» med maler, og egne sider for én etikett og én mappe.
 * Sider (MSH.ha.page):
 *   new   { kind }        tom, eller start fra en mal. Automasjon/skript: ferdige oppsett med vent, valg, gjenta,
 *                         parallelt, utløser-ID-er og felt. Scene: fra et rom (nåværende tilstand hentes) eller alle lys av.
 *   label { id }          alt med etiketten, gruppert på automasjoner, scener og skript. Legg til/fjern, rediger etikett.
 *   cat   { kind, cid }   alt i en mappe. Legg til/fjern, gi nytt navn, slett.
 * Malene fyller inn entiteter som finnes (første bevegelsessensor, lys, lås …), resten velges i editoren.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || !M.ha.KIND || M.ha.nyPages) return;
  const esc = M.esc, ui = M.ha.ui, reg = M.ha.reg, KIND = M.ha.KIND, items = M.ha.items;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const KINDS = ['automation', 'scene', 'script'];

  /* ------------------------------------------------------------ entitetsoppslag for maler */
  const ents = (h, dom, test) => Object.keys((h && h.states) || {}).filter((id) => id.startsWith(dom + '.') && (!test || test(id, h.states[id]))).sort();
  const dc = (c) => (id, s) => s.attributes.device_class === c;
  const one = (L) => (L[0] ? [L[0]] : []);
  const areaOf = (h, id) => { const e = reg.ent(id) || (h.entities && h.entities[id]) || {}; if (e.area_id) return e.area_id; const d = e.device_id && h.devices && h.devices[e.device_id]; return (d && d.area_id) || null; };
  function pick(h) {
    const has = (id, w) => w.some((x) => id.includes(x) || String(h.states[id].attributes.friendly_name || '').toLowerCase().includes(x));
    return {
      motion: one(ents(h, 'binary_sensor', (id, s) => ['motion', 'occupancy', 'presence'].includes(s.attributes.device_class))),
      lux: one(ents(h, 'sensor', dc('illuminance'))),
      light: one(ents(h, 'light', (id) => !/status|indikator/.test(id))),
      window: one(ents(h, 'binary_sensor', (id, s) => ['window', 'door', 'opening'].includes(s.attributes.device_class))),
      outT: one(ents(h, 'sensor', (id, s) => s.attributes.device_class === 'temperature' && has(id, ['ute', 'outdoor', 'outside', 'yr', 'met']))).concat([]).slice(0, 1),
      climate: one(ents(h, 'climate')),
      lock: ents(h, 'lock'),
      alarm: one(ents(h, 'alarm_control_panel')),
      persons: ents(h, 'person'),
      price: one(ents(h, 'sensor', (id, s) => has(id, ['nordpool', 'strompris', 'strømpris', 'tibber', 'price']) || /kr\/kwh|nok\/kwh/i.test(s.attributes.unit_of_measurement || ''))),
      boiler: one(ents(h, 'switch', (id) => has(id, ['varmtvann', 'bereder', 'boiler', 'water_heater']))).concat(one(ents(h, 'switch'))).slice(0, 1),
    };
  }

  /* ------------------------------------------------------------ maler */
  const TAG = { wait: ['Vent på', 'mdi:timer-play-outline'], choose: ['Valg', 'mdi:arrow-decision-outline'], repeat: ['Gjenta', 'mdi:repeat'], parallel: ['Parallelt', 'mdi:format-list-group'], ids: ['Utløser-ID', 'mdi:identifier'], or: ['Eller', 'mdi:gate-or'], if: ['Hvis, så', 'mdi:call-split'], fields: ['Felt', 'mdi:form-textbox'], tpl: ['Mal', 'mdi:code-braces'], restart: ['Start på nytt', 'mdi:restart'] };
  const AUTO = [
    { id: 'motion', icon: 'mdi:motion-sensor', n: 'Lys ved bevegelse', d: 'Slår på lyset når det er mørkt, og av igjen etter 3 minutter uten bevegelse.', tags: ['wait', 'or', 'restart'],
      make: (p) => ({ alias: 'Lys ved bevegelse', description: 'Lys på ved bevegelse når det er mørkt, av etter 3 min uten bevegelse', mode: 'restart',
        triggers: [{ trigger: 'state', entity_id: p.motion, to: 'on' }],
        conditions: [{ condition: 'or', conditions: [{ condition: 'sun', after: 'sunset' }, { condition: 'sun', before: 'sunrise' }, ...(p.lux.length ? [{ condition: 'numeric_state', entity_id: p.lux, below: 30 }] : [])] }],
        actions: [{ action: 'light.turn_on', target: { entity_id: p.light }, data: { brightness_pct: 80 } }, { wait_for_trigger: [{ trigger: 'state', entity_id: p.motion, to: 'off', for: { minutes: 3 } }] }, { action: 'light.turn_off', target: { entity_id: p.light } }] }) },
    { id: 'window', icon: 'mdi:window-open-variant', n: 'Vindu åpent mens det er kaldt', d: 'Varsler hvert kvarter til vinduet lukkes, når det er under 5° ute.', tags: ['repeat', 'tpl'],
      make: (p) => ({ alias: 'Vindu åpent mens det er kaldt', description: '', mode: 'single',
        triggers: [{ trigger: 'state', entity_id: p.window, to: 'on', for: { minutes: 10 } }],
        conditions: p.outT.length ? [{ condition: 'numeric_state', entity_id: p.outT, below: 5 }] : [],
        actions: [{ repeat: { sequence: [{ action: 'notify.notify', data: { title: 'Vindu åpent', message: "{{ state_attr(trigger.entity_id, 'friendly_name') }} står fortsatt åpent" } }, { delay: { minutes: 15 } }], until: [{ condition: 'state', entity_id: p.window, state: 'off' }] } }] }) },
    { id: 'morning', icon: 'mdi:weather-sunset-up', n: 'Morgenrutine for hverdag og helg', d: 'To utløsere med ID. Hverdag og helg får hver sin sekvens med mykt lys og varme.', tags: ['ids', 'choose'],
      make: (p) => ({ alias: 'Morgenrutine', description: 'Hverdag 06:30, helg 08:30', mode: 'single',
        triggers: [{ trigger: 'time', at: '06:30:00', id: 'hverdag' }, { trigger: 'time', at: '08:30:00', id: 'helg' }],
        conditions: [],
        actions: [{ choose: [
          { conditions: [{ condition: 'trigger', id: ['hverdag'] }, { condition: 'time', weekday: ['mon', 'tue', 'wed', 'thu', 'fri'] }], sequence: [{ action: 'light.turn_on', target: { entity_id: p.light }, data: { brightness_pct: 40, transition: 300 } }, ...(p.climate.length ? [{ action: 'climate.set_temperature', target: { entity_id: p.climate }, data: { temperature: 21 } }] : [])] },
          { conditions: [{ condition: 'trigger', id: ['helg'] }, { condition: 'time', weekday: ['sat', 'sun'] }], sequence: [{ action: 'light.turn_on', target: { entity_id: p.light }, data: { brightness_pct: 25, transition: 600 } }] },
        ] }] }) },
    { id: 'away', icon: 'mdi:home-export-outline', n: 'Når alle har dratt', d: 'Én utløser per person. Når alle er borte: lys av, lås og alarm samtidig, og et varsel.', tags: ['ids', 'parallel'],
      make: (p) => ({ alias: 'Når alle har dratt', description: '', mode: 'single',
        triggers: (p.persons.length ? p.persons : ['']).map((x) => ({ trigger: 'state', entity_id: x ? [x] : [], to: 'not_home', for: { minutes: 5 }, id: x ? x.split('.')[1] : 'person' })),
        conditions: p.persons.map((x) => ({ condition: 'state', entity_id: [x], state: 'not_home' })),
        actions: [{ parallel: [{ action: 'light.turn_off', target: { entity_id: 'all' } }, ...(p.lock.length ? [{ action: 'lock.lock', target: { entity_id: p.lock } }] : []), ...(p.alarm.length ? [{ action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: p.alarm } }] : [])] }, { action: 'notify.notify', data: { title: 'Huset er sikret', message: 'Alle har dratt. Lysene er slått av.' } }] }) },
    { id: 'dim', icon: 'mdi:brightness-6', n: 'Demp lyset gradvis om kvelden', d: 'Senker lysstyrken 10 % hvert femte minutt, og slår av når det er nesten mørkt.', tags: ['repeat', 'if'],
      make: (p) => ({ alias: 'Demp lyset om kvelden', description: '', mode: 'restart',
        triggers: [{ trigger: 'time', at: '22:00:00' }],
        conditions: [{ condition: 'state', entity_id: p.light, state: 'on' }],
        actions: [{ repeat: { count: 8, sequence: [{ action: 'light.turn_on', target: { entity_id: p.light }, data: { brightness_step_pct: -10 } }, { delay: { minutes: 5 } }] } }, { if: [{ condition: 'numeric_state', entity_id: p.light, attribute: 'brightness', below: 30 }], then: [{ action: 'light.turn_off', target: { entity_id: p.light } }] }] }) },
    { id: 'price', icon: 'mdi:cash-clock', n: 'Varmtvann av når strømmen er dyr', d: 'Slår av ved høy pris, venter til prisen er lav (maks 4 timer) og slår på igjen.', tags: ['wait'],
      make: (p) => ({ alias: 'Varmtvann av når strømmen er dyr', description: '', mode: 'single',
        triggers: [{ trigger: 'numeric_state', entity_id: p.price, above: 2 }],
        conditions: [],
        actions: [{ action: 'switch.turn_off', target: { entity_id: p.boiler } }, { wait_for_trigger: [{ trigger: 'numeric_state', entity_id: p.price, below: 1.5 }], timeout: { hours: 4 }, continue_on_timeout: true }, { action: 'switch.turn_on', target: { entity_id: p.boiler } }] }) },
  ];
  const SCRIPT = [
    { id: 'night', icon: 'mdi:weather-night', n: 'God natt', d: 'Lys av, lås og nattemperatur samtidig. Varsler hvis et vindu står åpent.', tags: ['parallel', 'if'],
      make: (p) => ({ alias: 'God natt', icon: 'mdi:weather-night', description: '', mode: 'single',
        sequence: [{ parallel: [{ action: 'light.turn_off', target: { entity_id: 'all' } }, ...(p.lock.length ? [{ action: 'lock.lock', target: { entity_id: p.lock } }] : []), ...(p.climate.length ? [{ action: 'climate.set_temperature', target: { entity_id: p.climate }, data: { temperature: 18 } }] : [])] },
          ...(p.window.length ? [{ if: [{ condition: 'state', entity_id: p.window, state: 'on' }], then: [{ action: 'notify.notify', data: { message: 'Et vindu står fortsatt åpent' } }] }] : [])] }) },
    { id: 'notify', icon: 'mdi:bell-ring-outline', n: 'Send varsel', d: 'Skript med felt for tittel og melding, så automasjoner og knapper kan gjenbruke det.', tags: ['fields', 'tpl'],
      make: () => ({ alias: 'Send varsel', icon: 'mdi:bell-ring-outline', description: 'Gjenbrukbart varsel', mode: 'parallel',
        fields: { melding: { name: 'Melding', required: true, selector: { text: {} } }, tittel: { name: 'Tittel', selector: { text: {} } } },
        sequence: [{ action: 'notify.notify', data: { title: "{{ tittel | default('KI MSH') }}", message: '{{ melding }}' } }] }) },
    { id: 'lights', icon: 'mdi:lightbulb-group-outline', n: 'Sett lys med lysstyrke', d: 'Velg lys og lysstyrke når skriptet kjøres.', tags: ['fields'],
      make: () => ({ alias: 'Sett lys', icon: 'mdi:lightbulb-group-outline', description: '', mode: 'restart',
        fields: { lys: { name: 'Lys', required: true, selector: { entity: { domain: 'light', multiple: true } } }, lysstyrke: { name: 'Lysstyrke', default: 60, selector: { number: { min: 1, max: 100, unit_of_measurement: '%' } } } },
        sequence: [{ action: 'light.turn_on', target: { entity_id: '{{ lys }}' }, data: { brightness_pct: '{{ lysstyrke }}', transition: 2 } }] }) },
  ];
  const SCENE_DOMS = ['light', 'cover', 'climate', 'fan', 'media_player', 'switch', 'valve', 'humidifier'];

  /* ------------------------------------------------------------ «Lag ny» */
  const tagHtml = (t) => { const x = TAG[t]; return x ? `<span class="tg">${ui.ic(x[1], 13)}${esc(T(x[0]))}</span>` : ''; };
  const tplCard = (t, i) => `<button class="tc stg" style="animation-delay:${i * 35}ms" data-a="tpl" data-v="${t.id}"><span class="hi">${ui.ic(t.icon, 22)}</span><span class="ht"><b>${esc(T(t.n))}</b><i>${esc(T(t.d))}</i><span class="tgs">${t.tags.map(tagHtml).join('')}</span></span></button>`;
  M.ha.page('new', {
    title: (c, a) => T(KIND[a.kind].add, KIND[a.kind].addEn),
    sub: (c, a) => (a.kind === 'scene' ? T('Tom, fra et rom eller alle lys av', 'Empty, from a room or all lights off') : T('Tom, eller start fra en mal', 'Empty, or start from a template')),
    load: async (c) => { await reg.load(c.h); },
    render(c, a) {
      const kind = a.kind, h = c.h;
      const blank = ui.group(ui.row({ a: 'blank', icon: 'mdi:file-outline', title: kind === 'automation' ? T('Tom automasjon', 'Empty automation') : kind === 'script' ? T('Tomt skript', 'Empty script') : T('Tom scene', 'Empty scene'), sub: T('Bygg alt selv i visuell editor eller YAML', 'Build it yourself in the visual editor or YAML'), chev: true }));
      let body = '';
      if (kind === 'scene') {
        const areas = (M.areas ? M.areas(h) : Object.values(h.areas || {})).map((ar) => ({ ar, ids: Object.keys(h.states).filter((id) => SCENE_DOMS.includes(id.split('.')[0]) && areaOf(h, id) === ar.area_id) })).filter((x) => x.ids.length);
        const lights = ents(h, 'light');
        body = `${ui.sec(T('Fra et rom', 'From a room'))}
          <p class="mut" style="margin:-2px 6px 2px">${esc(T('Tar med lys, gardiner, klima og media i rommet slik de står nå. Juster og trykk «Hent» før du lagrer.', 'Includes lights, covers, climate and media in the room as they are now. Adjust and tap «Capture» before saving.'))}</p>
          ${areas.length ? ui.group(areas.map(({ ar, ids }) => ui.row({ a: 'room', v: ar.area_id, icon: ar.icon || 'mdi:sofa-outline', title: ar.name, sub: `${ids.length} ${T('entiteter', 'entities')} · ${ids.filter((id) => h.states[id].state === 'on').length} ${T('på nå', 'on now')}`, chev: true })).join('')) : ui.empty('mdi:sofa-outline', T('Ingen rom med lys eller klima', 'No rooms with lights or climate'))}
          ${ui.sec(T('Ferdige', 'Ready-made'))}
          ${ui.group(ui.row({ a: 'alloff', icon: 'mdi:lightbulb-off-outline', title: T('Alle lys av', 'All lights off'), sub: `${lights.length} ${T('lys', 'lights')}`, chev: true }))}`;
      } else {
        const L = kind === 'automation' ? AUTO : SCRIPT;
        body = `${ui.sec(T('Fra mal', 'From a template'))}
          <p class="mut" style="margin:-2px 6px 2px">${esc(T('Malene bruker entiteter du har. Alt kan endres etterpå, og ingenting lagres før du trykker Lagre.', 'Templates use entities you have. Everything can be changed, and nothing is saved until you tap Save.'))}</p>
          <div class="tcs">${L.map(tplCard).join('')}</div>`;
      }
      return `${blank}${body}
        <style>.tcs{display:flex;flex-direction:column;gap:8px}.tc{display:flex;gap:12px;align-items:flex-start;text-align:left;padding:14px 14px 14px 12px;border-radius:24px;background:var(--ki-surface, #3a3a3a);transition:transform .2s cubic-bezier(.34,1.45,.64,1),background .15s}.tc:active{transform:scale(.98);background:rgb(var(--ki-wa-c,255 255 255)/.08)}.tc .ht{gap:4px}.tc .ht i{white-space:normal;line-height:1.4}
        .tgs{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.tg{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:11px;font-size:11px;font-weight:500;background:rgb(var(--ki-wa-c,255 255 255)/.07);color:var(--ki-text-2, #c7c7c7)}</style>`;
    },
    act(c, a, el, args) {
      const kind = args.kind, h = c.h, v = el.dataset.v;
      if (a === 'blank') return c.replace(kind === 'scene' ? 'scene' : 'edit', { kind, isNew: true });
      if (a === 'tpl') {
        const t = (kind === 'automation' ? AUTO : SCRIPT).find((x) => x.id === v); if (!t) return undefined;
        M.haptic('medium');
        return c.replace('edit', { kind, isNew: true, tpl: t.make(pick(h)) });
      }
      if (a === 'room') {
        const ar = (h.areas && h.areas[v]) || (M.areas ? M.areas(h).find((x) => x.area_id === v) : null);
        const ids = Object.keys(h.states).filter((id) => SCENE_DOMS.includes(id.split('.')[0]) && areaOf(h, id) === v);
        const entities = {}; ids.forEach((id) => { entities[id] = M.ha.sceneCapture(h, id); });
        M.haptic('medium');
        return c.replace('scene', { kind: 'scene', isNew: true, tpl: { name: ar ? ar.name : '', icon: (ar && ar.icon) || 'mdi:palette', entities }, org: { area: v } });
      }
      if (a === 'alloff') {
        const entities = {}; ents(h, 'light').forEach((id) => { entities[id] = { state: 'off' }; });
        return c.replace('scene', { kind: 'scene', isNew: true, tpl: { name: T('Alle lys av', 'All lights off'), icon: 'mdi:lightbulb-off-outline', entities } });
      }
      return undefined;
    },
  });

  /* ------------------------------------------------------------ felles: rader for elementer med fjern-knapp */
  const openArgs = (h, kind, id) => { const s = h.states[id]; const cid = kind === 'script' ? id.split('.')[1] : s && s.attributes.id; return cid ? [kind === 'scene' ? 'scene' : 'edit', { kind, entity: id, id: cid }] : null; };
  const memberRow = (kind, x, rmA) => `<div class="hr li" data-key="m-${esc(x.id)}"><button class="lm" data-a="open" data-v="${kind}|${esc(x.id)}"><span class="hi ${x.s.state === 'on' && kind !== 'scene' ? 'on' : ''}">${ui.ic(x.s.attributes.icon || KIND[kind].icon, 21)}</span><span class="ht"><b data-noi18n>${esc(x.name)}</b><i data-noi18n>${esc(x.id)}</i></span></button><button class="bt sm ic" data-a="${rmA}" data-v="${kind}|${esc(x.id)}" aria-label="${esc(T('Fjern', 'Remove'))}">${ui.ic('mdi:close', 17)}</button></div>`;
  const LI_CSS = '<style>.li{padding:4px 8px 4px 4px;gap:6px}.li .lm{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px 4px 6px 10px;text-align:left;border-radius:18px}.li .lm:active{background:rgb(var(--ki-wa-c,255 255 255)/.04)}.pk{display:flex;flex-direction:column;max-height:52vh;overflow:auto;margin:0 -4px}.pk .hr{min-height:54px}</style>';
  // Velg flere elementer av én type (checkliste) – onToggle(id, on) lagrer straks
  function pickSheet(c, title, kind, isOn, onToggle) {
    let q = '';
    const html = () => {
      const L = items(c.h, kind).filter((x) => !q || (x.name + ' ' + x.id).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
      return `${ui.field({ f: 'q', value: q, ph: T('Søk', 'Search') })}<div class="pk">${L.length ? L.map((x) => { const on = isOn(x); return ui.row({ a: 'tg', v: x.id, icon: x.s.attributes.icon || KIND[kind].icon, title: x.name, sub: x.id, right: `<span class="ck ${on ? 'on' : ''}">${on ? ui.ic('mdi:check', 16) : ''}</span>` }); }).join('') : ui.empty(KIND[kind].icon, T('Ingen treff', 'No matches'))}</div>
        <div class="bts" style="justify-content:flex-end;margin-top:6px">${ui.btn(T('Ferdig', 'Done'), 'done', null, 'pri')}</div>${LI_CSS}
        <style>.ck{width:26px;height:26px;border-radius:13px;flex:none;display:grid;place-items:center;box-shadow:inset 0 0 0 2px rgb(var(--ki-wa-c,255 255 255)/.25);transition:background .15s,box-shadow .15s}.ck.on{background:var(--pink,#f285c9);color:var(--ki-on-accent,#2a1720);box-shadow:none}</style>`;
    };
    const refresh = () => { if (!M.ha.current) return; const sc = M.ha.current.psEl.querySelector('.pk'), top = sc ? sc.scrollTop : 0; M.ha.current.sheetHtml(html()); const s2 = M.ha.current.psEl.querySelector('.pk'); if (s2) s2.scrollTop = top; };
    c.sheet({
      title, sub: T(KIND[kind].n, KIND[kind].en), html: html(),
      onInput: (el, v) => { if (el.dataset.f === 'q') { q = String(v).toLowerCase().trim(); refresh(); const i = M.ha.current.psEl.querySelector('input[data-f="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } },
      onAct: (a, el) => {
        if (a === 'done') return true;
        if (a === 'tg') { const x = items(c.h, kind).find((y) => y.id === el.dataset.v); if (!x) return false; M.haptic('selection'); Promise.resolve(onToggle(x.id, !isOn(x))).then(refresh).catch((e) => c.err(e)); return false; }
        return false;
      },
    });
  }
  const upd = async (c, id, patch) => { await M.ha.regUpdate(c, id, patch); };
  const labsOf = (id) => arr((reg.ent(id) || {}).labels);

  /* ------------------------------------------------------------ én etikett */
  M.ha.page('label', {
    title: (c, a) => { const l = reg.label(a.id); return l ? l.name : T('Etikett', 'Label'); },
    sub: (c, a) => { const l = reg.label(a.id); return (l && l.description) || T('Automasjoner, scener og skript med etiketten', 'Automations, scenes and scripts with the label'); },
    haPath: '/config/labels',
    right: () => `<button class="hb" data-a="edl" aria-label="${esc(T('Rediger', 'Edit'))}">${ui.ic('mdi:pencil-outline', 20)}</button>`,
    load: async (c) => { await reg.load(c.h, true); },
    render(c, a) {
      const l = reg.label(a.id), h = c.h;
      if (!l) return ui.empty('mdi:label-off-outline', T('Etiketten finnes ikke lenger', 'The label no longer exists'));
      const other = Object.values(reg.ents || {}).filter((e) => arr(e.labels).includes(a.id) && !KINDS.includes(e.entity_id.split('.')[0])).length;
      const head = `<div class="card" style="flex-direction:row;align-items:center;gap:14px"><span class="hi" style="background:${M.ha.labelColor(l.color)};color:var(--ki-on-accent,#2a1720)">${ui.ic(l.icon || 'mdi:label', 22)}</span><span class="ht"><b data-noi18n>${esc(l.name)}</b><i>${esc(other ? `${other} ${T('andre entiteter har også etiketten', 'other entities also have the label')}` : T('Brukes bare her', 'Only used here'))}</i></span></div>`;
      const secs = KINDS.map((k) => {
        const L = items(h, k).filter((x) => arr(x.r.labels).includes(a.id)).sort((p, q) => p.name.localeCompare(q.name, 'nb'));
        return `${ui.sec(`${T(KIND[k].n, KIND[k].en)} · ${L.length}`, `<button class="bt sm" data-a="add" data-v="${k}">${ui.ic('mdi:plus', 16)}<span>${esc(T('Legg til', 'Add'))}</span></button>`)}
          ${L.length ? ui.group(L.map((x) => memberRow(k, x, 'rm')).join('')) : `<p class="mut" style="margin:0 6px">${esc(T('Ingen ennå', 'None yet'))}</p>`}`;
      }).join('');
      return `${head}${secs}${LI_CSS}`;
    },
    act(c, a, el, args) {
      const v = el.dataset.v || '', [kind, id] = v.split('|');
      if (a === 'edl') return M.ha.labelSheet(c, reg.label(args.id), () => { if (!reg.label(args.id)) c.pop(); else c.render(); });
      if (a === 'open') { const o = openArgs(c.h, kind, id); if (!o) { M.haptic('warning'); return c.toast(T('Laget i YAML – kan bare endres i konfigurasjonsfilene', 'Made in YAML – can only be changed in the configuration files'), { type: 'error' }); } return c.push(o[0], o[1]); }
      if (a === 'rm') { M.haptic('medium'); return upd(c, id, { labels: labsOf(id).filter((x) => x !== args.id) }); }
      if (a === 'add') { const l = reg.label(args.id); return pickSheet(c, `${T('Etikett', 'Label')}: ${l ? l.name : ''}`, v, (x) => labsOf(x.id).includes(args.id), (eid, on) => upd(c, eid, { labels: on ? [...labsOf(eid), args.id] : labsOf(eid).filter((x) => x !== args.id) })); }
      return undefined;
    },
    reload: true,
  });

  /* ------------------------------------------------------------ én mappe */
  M.ha.page('cat', {
    title: (c, a) => { const x = reg.cat(a.kind, a.cid); return x ? x.name : T('Mappe', 'Folder'); },
    sub: (c, a) => `${T('Mappe', 'Folder')} · ${T(KIND[a.kind].n, KIND[a.kind].en)}`,
    right: () => `<button class="hb" data-a="edc" aria-label="${esc(T('Rediger', 'Edit'))}">${ui.ic('mdi:pencil-outline', 20)}</button>`,
    load: async (c) => { await reg.load(c.h, true); },
    render(c, a) {
      const x = reg.cat(a.kind, a.cid);
      if (!x) return ui.empty('mdi:folder-off-outline', T('Mappen finnes ikke lenger', 'The folder no longer exists'));
      const L = items(c.h, a.kind).filter((y) => (y.r.categories || {})[a.kind] === a.cid).sort((p, q) => p.name.localeCompare(q.name, 'nb'));
      return `<div class="card" style="flex-direction:row;align-items:center;gap:14px"><span class="hi on">${ui.ic(x.icon || 'mdi:folder-outline', 22)}</span><span class="ht"><b data-noi18n>${esc(x.name)}</b><i>${L.length} ${esc(T(KIND[a.kind].n, KIND[a.kind].en).toLowerCase())}</i></span></div>
        ${ui.sec(T('I mappen', 'In the folder'), `<button class="bt sm" data-a="add">${ui.ic('mdi:plus', 16)}<span>${esc(T('Legg til', 'Add'))}</span></button>`)}
        ${L.length ? ui.group(L.map((y) => memberRow(a.kind, y, 'rm')).join('')) : ui.empty('mdi:folder-open-outline', T('Tom mappe. Trykk «Legg til» for å flytte noe hit.', 'Empty folder. Tap «Add» to move something here.'))}
        <button class="fab" data-a="new">${ui.ic('mdi:plus', 22)}${esc(T(KIND[a.kind].add, KIND[a.kind].addEn))}</button>${LI_CSS}`;
    },
    act(c, a, el, args) {
      const kind = args.kind, cid = args.cid, v = el.dataset.v || '', id = v.split('|')[1];
      const catOf = (eid) => ((reg.ent(eid) || {}).categories || {})[kind] || null;
      if (a === 'edc') {
        const x = reg.cat(kind, cid); if (!x) return undefined;
        return M.ha.nameSheet(c, T('Rediger mappe', 'Edit folder'), x.name, x.icon, async (name, icon) => { await c.ws('config/category_registry/update', { scope: kind, category_id: cid, name, icon: icon || null }); await reg.load(c.h, true); c.closeSheet(); c.render(); },
          async () => { await c.ws('config/category_registry/delete', { scope: kind, category_id: cid }); await reg.load(c.h, true); M.haptic('medium'); c.pop(); });
      }
      if (a === 'open') { const o = openArgs(c.h, kind, id); if (!o) { M.haptic('warning'); return c.toast(T('Laget i YAML – kan bare endres i konfigurasjonsfilene', 'Made in YAML – can only be changed in the configuration files'), { type: 'error' }); } return c.push(o[0], o[1]); }
      if (a === 'rm') { M.haptic('medium'); return upd(c, id, { categories: { [kind]: null } }); }
      if (a === 'add') { const x = reg.cat(kind, cid); return pickSheet(c, `${T('Flytt til', 'Move to')} ${x ? x.name : ''}`, kind, (y) => catOf(y.id) === cid, (eid, on) => upd(c, eid, { categories: { [kind]: on ? cid : null } })); }
      if (a === 'new') return c.push('new', { kind, org: { cat: cid } });
      return undefined;
    },
    reload: true,
  });

  // «Ny» fra en mappe tar med mappen videre til editoren
  const P = M.ha.pages.new, act0 = P.act;
  P.act = function (c, a, el, args) {
    if (args.org && (a === 'blank' || a === 'tpl' || a === 'room' || a === 'alloff')) {
      const rep = c.replace; c.replace = (id, x) => { c.replace = rep; return rep.call(c, id, { ...x, org: { ...(x.org || {}), ...args.org } }); };
      try { return act0.call(this, c, a, el, args); } finally { if (c.replace !== rep) c.replace = rep; }
    }
    return act0.call(this, c, a, el, args);
  };

  M.ha.nyPages = true;
})();
