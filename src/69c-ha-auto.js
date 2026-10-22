/* KI MSH · Home Assistant-innstillinger: hub, automasjoner, scener og skript (Fiks 65).
 * Sider (MSH.ha.page): hub · list (kind: automation|scene|script) · edit (automasjon/skript; scener i 69d) · cats (mapper =
 * HA-kategorier per type) · labels (etiketter, felles for alt) · traces/trace (siste kjøringer med steg).
 * Organisering per element (mappe, etiketter, område) lagres i entitetsregisteret (config/entity_registry/update) – samme
 * felt som HAs egne lister bruker, så alt er likt i appen og i Home Assistant. Nye elementer får organiseringen når HA har
 * registrert entiteten etter lagring.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || !M.ha.blocks || M.ha.autoPages) return;
  const esc = M.esc, ui = M.ha.ui, reg = M.ha.reg, B = M.ha.blocks;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = B.arr, clone = B.clone;
  const KIND = {
    automation: { n: 'Automasjoner', en: 'Automations', addEn: 'New automation', one: 'automasjon', icon: 'mdi:robot', iconOff: 'mdi:robot-off-outline', add: 'Ny automasjon', path: '/config/automation/dashboard' },
    scene: { n: 'Scener', en: 'Scenes', addEn: 'New scene', one: 'scene', icon: 'mdi:palette', add: 'Ny scene', path: '/config/scene/dashboard' },
    script: { n: 'Skript', en: 'Scripts', addEn: 'New script', one: 'skript', icon: 'mdi:script-text', add: 'Nytt skript', path: '/config/script/dashboard' },
  };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } };
  const nameOf = (h, id) => { const s = h && h.states[id]; return (s && s.attributes.friendly_name) || id; };
  const cfgId = (kind, id, s) => (kind === 'script' ? id.split('.')[1] : s && s.attributes ? s.attributes.id : null);
  const items = (h, kind) => Object.keys((h && h.states) || {}).filter((id) => id.startsWith(kind + '.')).map((id) => ({ id, s: h.states[id], name: nameOf(h, id), cid: cfgId(kind, id, h.states[id]), r: reg.ent(id) || {} }));

  /* ------------------------------------------------------------ hub */
  M.ha.page('hub', {
    title: () => T('Innstillinger', 'Settings'),
    sub: (c) => { const h = c.h, cf = (h && h.config) || {}; return [cf.location_name, cf.version ? `Home Assistant ${cf.version}` : ''].filter(Boolean).join(' · '); },
    async load(c) {
      const st = c.state;
      const [rep, bk] = await Promise.all([c.ws('repairs/list_issues').catch(() => null), c.ws('backup/info').catch(() => null)]);
      st.repairs = rep && rep.issues ? rep.issues.filter((i) => !i.ignored).length : null;
      st.backup = bk;
    },
    render(c) {
      const h = c.h, st = c.state;
      const ups = Object.keys((h && h.states) || {}).filter((id) => id.startsWith('update.') && h.states[id].state === 'on').length;
      const cnt = (k) => Object.keys((h && h.states) || {}).filter((id) => id.startsWith(k + '.')).length;
      const tile = (k, i) => `<button class="tile stg" style="animation-delay:${i * 40}ms" data-a="go" data-v="list|${k}" data-key="t-${k}"><span class="hi">${ui.ic(KIND[k].icon, 22)}</span><b>${esc(T(KIND[k].n, KIND[k].en))}</b><i>${cnt(k)}</i></button>`;
      const bk = st.backup, last = bk && (bk.last_completed_automatic_backup || (bk.backups && bk.backups.length ? bk.backups.map((x) => x.date).sort().pop() : null));
      const alert = ups ? `<button class="card stg" data-a="go" data-v="updates" data-key="upal" style="flex-direction:row;align-items:center;gap:12px;text-align:left;background:color-mix(in srgb, var(--pink,#f285c9) 18%, var(--ki-surface, #3a3a3a))"><span class="hi on">${ui.ic('mdi:update', 22)}</span><span class="ht"><b>${esc(ups === 1 ? T('1 oppdatering tilgjengelig', '1 update available') : `${ups} ${T('oppdateringer tilgjengelig', 'updates available')}`)}</b><i>${esc(T('Trykk for å se og installere', 'Tap to review and install'))}</i></span>${ui.ic('mdi:chevron-right', 22)}</button>` : '';
      const ext = [
        ['/config/integrations/dashboard', 'mdi:puzzle', 'Enheter og tjenester', 'Integrasjoner, enheter, entiteter og hjelpere'],
        ['/config/areas/dashboard', 'mdi:sofa', 'Områder, etiketter og soner', 'Rom og etasjer'],
        ['/config/person', 'mdi:account', 'Personer', 'Brukere og sporing'],
        ['/hassio/dashboard', 'mdi:puzzle-plus', 'Tillegg', 'Installer og administrer'],
        ['/config/lovelace/dashboards', 'mdi:view-dashboard', 'Dashbord', 'Visninger og ressurser'],
        ['/config/voice-assistants/assistants', 'mdi:microphone-message', 'Taleassistenter', 'Assist og Alexa/Google'],
        ['/config/tags', 'mdi:nfc-variant', 'Brikker', 'NFC og QR'],
        ['/config/energy', 'mdi:lightning-bolt', 'Energi', 'Energidashbordet'],
        ['/config/network', 'mdi:lan', 'Nettverk', 'Adresser og grensesnitt'],
        ['/config/storage', 'mdi:harddisk', 'Lagringsplass', 'Diskbruk'],
        ['/config/hardware', 'mdi:memory', 'Maskinvare', 'Prosessor og minne'],
      ];
      return `<div class="tiles">${['automation', 'scene', 'script'].map(tile).join('')}</div>
        ${alert}
        ${ui.sec(T('Organisering', 'Organisation'))}
        ${ui.group(ui.row({ a: 'go', v: 'cats', icon: 'mdi:folder-outline', title: T('Mapper', 'Folders'), sub: T('Kategorier for automasjoner, scener og skript', 'Categories for automations, scenes and scripts'), chev: true }) + ui.row({ a: 'go', v: 'labels', icon: 'mdi:label-outline', title: T('Etiketter', 'Labels'), sub: `${reg.labels.length} ${T('etiketter', 'labels')}`, chev: true }))}
        ${ui.sec(T('System', 'System'))}
        ${ui.group([
          ui.row({ a: 'go', v: 'updates', icon: 'mdi:update', title: T('Oppdateringer', 'Updates'), sub: ups ? `${ups} ${T('tilgjengelig', 'available')}` : T('Alt er oppdatert', 'Everything is up to date'), right: ui.badge(ups, true), chev: true }),
          ui.row({ a: 'go', v: 'backups', icon: 'mdi:cloud-upload-outline', title: T('Sikkerhetskopier', 'Backups'), sub: last ? `${T('Siste', 'Last')}: ${M.relTime(last)}` : T('Lag og gjenopprett', 'Create and restore'), chev: true }),
          ui.row({ a: 'go', v: 'repairs', icon: 'mdi:wrench-outline', title: T('Reparasjoner', 'Repairs'), sub: st.repairs ? `${st.repairs} ${T('trenger oppmerksomhet', 'need attention')}` : T('Ingen problemer', 'No issues'), right: ui.badge(st.repairs, true), chev: true }),
          ui.row({ a: 'go', v: 'logs', icon: 'mdi:math-log', title: T('Logger', 'Logs'), sub: T('Feil og advarsler', 'Errors and warnings'), chev: true }),
          ui.row({ a: 'go', v: 'system', icon: 'mdi:power', title: T('Start på nytt og kontroll', 'Restart and checks'), sub: T('Start på nytt, last inn YAML, sjekk konfigurasjon', 'Restart, reload YAML, check configuration'), chev: true }),
          ui.row({ a: 'go', v: 'general', icon: 'mdi:cog-outline', title: T('Generelt', 'General'), sub: T('Navn, sted, enheter og adresser', 'Name, location, units and URLs'), chev: true }),
          ui.row({ a: 'go', v: 'about', icon: 'mdi:information-outline', title: T('Om', 'About'), sub: T('Versjoner og systeminfo', 'Versions and system info'), chev: true }),
        ].join(''))}
        ${ui.sec(T('Mer i Home Assistant', 'More in Home Assistant'))}
        ${ui.group(ext.map(([p, i, t, s]) => ui.row({ a: 'ext', v: p, icon: i, title: T(t), sub: T(s), ext: true })).join(''))}`;
    },
  });

  /* ------------------------------------------------------------ organisering (mappe, etiketter, område) */
  function orgOf(id) { const r = reg.ent(id) || {}; return { cat: (r.categories || {}), labels: arr(r.labels), area: r.area_id || null }; }
  async function regUpdate(c, id, patch) {
    await c.ws('config/entity_registry/update', { entity_id: id, ...patch });
    await reg.load(c.h, true);
    c.render();
  }
  // Velgerark: kind, id (entitet – endres straks) eller pend (nytt element: lagres når entiteten finnes)
  function orgSheet(c, kind, id, pend, onDone) {
    const html = () => {
      const o = id ? orgOf(id) : { cat: { [kind]: pend.cat }, labels: pend.labels || [], area: pend.area || null };
      const cats = reg.cats[kind] || [];
      const cur = o.cat[kind] || null;
      const h = c.h;
      return `${ui.sec(T('Mappe', 'Folder'))}
        <div class="chs wrap">${ui.chip(`${ui.ic('mdi:folder-off-outline', 15)}${esc(T('Ingen', 'None'))}`, !cur, 'cat', '')}${cats.map((x) => ui.chip(`${ui.ic(x.icon || 'mdi:folder-outline', 15)}<span data-noi18n>${esc(x.name)}</span>`, cur === x.category_id, 'cat', x.category_id)).join('')}${ui.chip(`${ui.ic('mdi:plus', 15)}${esc(T('Ny mappe', 'New folder'))}`, false, 'newcat', '')}</div>
        ${ui.sec(T('Etiketter', 'Labels'))}
        <div class="chs wrap">${reg.labels.map((l) => ui.chip(`<span class="dt" style="--lc:${M.ha.labelColor(l.color)}"></span><span data-noi18n>${esc(l.name)}</span>`, o.labels.includes(l.label_id), 'lab', l.label_id)).join('')}${ui.chip(`${ui.ic('mdi:plus', 15)}${esc(T('Ny etikett', 'New label'))}`, false, 'newlab', '')}</div>
        ${ui.sec(T('Område', 'Area'))}
        <div class="chs wrap">${ui.chip(esc(T('Ingen', 'None')), !o.area, 'area', '')}${(M.areas ? M.areas(h) : []).map((a) => ui.chip(`<span data-noi18n>${esc(a.name)}</span>`, o.area === a.area_id, 'area', a.area_id)).join('')}</div>
        <div class="bts" style="justify-content:flex-end;margin-top:6px">${ui.btn(T('Ferdig', 'Done'), 'done', null, 'pri')}</div>`;
    };
    const refresh = () => M.ha.current && M.ha.current.sheetHtml(html());
    const apply = async (patch, local) => {
      try {
        if (id) await regUpdate(c, id, patch);
        else { local(); c.render(); }
        M.haptic('selection'); refresh();
      } catch (e) { c.err(e); }
    };
    c.sheet({
      title: T('Organiser', 'Organise'), sub: id ? nameOf(c.h, id) : T('Lagres sammen med elementet', 'Saved with the item'), html: html(),
      onAct: (a, el) => {
        const v = el.dataset.v;
        if (a === 'done') { if (onDone) onDone(); return true; }
        if (a === 'cat') { apply({ categories: { [kind]: v || null } }, () => { pend.cat = v || null; }); return false; }
        if (a === 'lab') { const L = id ? orgOf(id).labels : arr(pend.labels); const n = L.includes(v) ? L.filter((x) => x !== v) : [...L, v]; apply({ labels: n }, () => { pend.labels = n; }); return false; }
        if (a === 'area') { apply({ area_id: v || null }, () => { pend.area = v || null; }); return false; }
        if (a === 'newcat') { nameSheet(c, T('Ny mappe', 'New folder'), '', 'mdi:folder-outline', async (name, icon) => { const r = await c.ws('config/category_registry/create', { scope: kind, name, icon: icon || null }); await reg.load(c.h, true); if (id) await regUpdate(c, id, { categories: { [kind]: r.category_id } }); else pend.cat = r.category_id; orgSheet(c, kind, id, pend, onDone); }); return false; }
        if (a === 'newlab') { labelSheet(c, null, async (lab) => { if (id) await regUpdate(c, id, { labels: [...orgOf(id).labels, lab.label_id] }); else pend.labels = [...arr(pend.labels), lab.label_id]; orgSheet(c, kind, id, pend, onDone); }); return false; }
        return false;
      },
    });
  }
  // Navn + ikon (mappe)
  function nameSheet(c, title, name, icon, save, del) {
    let n = name || '', ic = icon || '';
    c.sheet({
      title,
      html: `${ui.field({ f: 'n', value: n, label: T('Navn', 'Name'), ph: T('F.eks. Lys', 'E.g. Lights'), attrs: 'enterkeyhint="done"' })}
        <div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'nic', value: ic, attrs: 'data-f="ic"' }) : ui.field({ f: 'ic', value: ic, ph: 'mdi:folder' })}</div>
        <div class="bts" style="justify-content:space-between;margin-top:6px">${del ? ui.btn(T('Slett', 'Delete'), 'del', null, 'warn', 'mdi:delete-outline') : '<span></span>'}${ui.btn(T('Lagre', 'Save'), 'save', null, 'pri')}</div>`,
      onInput: (el, v) => { if (el.dataset.f === 'n') n = v; if (el.dataset.f === 'ic') ic = v; },
      onAct: (a, el) => {
        if (a === 'save') { if (!n.trim()) { M.haptic('warning'); return false; } Promise.resolve(save(n.trim(), ic)).then(() => M.haptic('success')).catch((e) => c.err(e)); return !del; }
        if (a === 'del') { if (el.dataset.arm !== '1') { el.dataset.arm = '1'; el.querySelector('span').textContent = T('Sikker?', 'Sure?'); M.haptic('warning'); return false; } Promise.resolve(del()).catch((e) => c.err(e)); return true; }
        return false;
      },
    });
    setTimeout(() => { const i = M.ha.current && M.ha.current.psEl.querySelector('input[data-f="n"]'); if (i && !name) i.focus(); }, 320);
  }
  // Etikett: navn, ikon, farge, beskrivelse
  function labelSheet(c, lab, after) {
    const L = lab || {};
    let n = L.name || '', ic = L.icon || '', col = L.color || 'indigo', de = L.description || '';
    const colors = () => `<div class="chs wrap">${M.ha.LABEL_COLORS.map((x) => `<button class="cl ${col === x ? 'on' : ''}" data-a="col" data-v="${x}" style="--lc:${M.ha.labelColor(x)}" aria-label="${x}"></button>`).join('')}</div>`;
    const html = () => `${ui.field({ f: 'n', value: n, label: T('Navn', 'Name') })}
      <div class="fd"><span class="fl">${esc(T('Farge', 'Colour'))}</span>${colors()}</div>
      <div class="fd"><span class="fl">${esc(T('Ikon (valgfritt)', 'Icon (optional)'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'lic', value: ic, attrs: 'data-f="ic"' }) : ui.field({ f: 'ic', value: ic })}</div>
      ${ui.field({ f: 'd', value: de, label: T('Beskrivelse (valgfritt)', 'Description (optional)') })}
      <div class="bts" style="justify-content:space-between;margin-top:6px">${lab ? ui.btn(T('Slett', 'Delete'), 'del', null, 'warn', 'mdi:delete-outline') : '<span></span>'}${ui.btn(T('Lagre', 'Save'), 'save', null, 'pri')}</div>
      <style>.cl{width:34px;height:34px;border-radius:17px;background:var(--lc);transition:transform .15s;box-shadow:inset 0 0 0 0 var(--ki-popup,#282828)}.cl.on{box-shadow:inset 0 0 0 3px var(--ki-popup,#282828),0 0 0 2px var(--lc);transform:scale(1.05)}</style>`;
    c.sheet({
      title: lab ? T('Rediger etikett', 'Edit label') : T('Ny etikett', 'New label'), html: html(),
      onInput: (el, v) => { const f = el.dataset.f; if (f === 'n') n = v; if (f === 'ic') ic = v; if (f === 'd') de = v; },
      onAct: (a, el) => {
        if (a === 'col') { col = el.dataset.v; M.haptic('selection'); M.ha.current.sheetHtml(html()); return false; }
        if (a === 'save') {
          if (!n.trim()) { M.haptic('warning'); return false; }
          const body = { name: n.trim(), color: col, icon: ic || null, description: de || null };
          (lab ? c.ws('config/label_registry/update', { label_id: lab.label_id, ...body }) : c.ws('config/label_registry/create', body))
            .then(async (r) => { await reg.load(c.h, true); M.haptic('success'); c.render(); if (after) after(r); }).catch((e) => c.err(e));
          return !after;
        }
        if (a === 'del') { if (el.dataset.arm !== '1') { el.dataset.arm = '1'; el.querySelector('span').textContent = T('Sikker?', 'Sure?'); M.haptic('warning'); return false; } c.ws('config/label_registry/delete', { label_id: lab.label_id }).then(async () => { await reg.load(c.h, true); c.render(); M.haptic('medium'); }).catch((e) => c.err(e)); return true; }
        return false;
      },
    });
  }
  M.ha.orgSheet = orgSheet;

  /* ------------------------------------------------------------ lister */
  function filtered(c, kind, st) {
    const h = c.h, q = String(st.q || '').toLowerCase().trim();
    const L = items(h, kind).filter((x) => {
      if (q && !(x.name + ' ' + x.id + ' ' + (x.s.attributes.description || '')).toLowerCase().includes(q)) return false;
      if (st.f === 'on' && x.s.state !== 'on') return false;
      if (st.f === 'off' && x.s.state !== 'off') return false;
      if (st.labs && st.labs.length && !st.labs.every((l) => arr(x.r.labels).includes(l))) return false;
      return true;
    });
    return L.sort((a, b) => M.cmpNb ? M.cmpNb(a.name, b.name) : a.name.localeCompare(b.name));
  }
  function itemRow(c, kind, x) {
    const s = x.s, on = s.state === 'on', a = s.attributes || {};
    const lt = a.last_triggered, labs = arr(x.r.labels).map((l) => ui.labelChip(reg.label(l))).join('');
    const sub = [kind === 'automation' ? (lt ? `${T('Sist', 'Last')} ${M.relTime(lt)}` : T('Aldri kjørt', 'Never run')) : kind === 'script' ? (on ? T('Kjører …', 'Running …') : lt ? `${T('Sist', 'Last')} ${M.relTime(lt)}` : T('Aldri kjørt', 'Never run')) : s.state && !M.unavailable(s) && s.state !== 'unknown' ? `${T('Sist aktivert', 'Last activated')} ${M.relTime(s.state)}` : T('Aldri aktivert', 'Never activated')];
    const right = kind === 'automation'
      ? ui.sw(on, 'tog', x.id)
      : `<button class="bt sm ic pri" data-a="run" data-v="${esc(x.id)}" aria-label="${esc(T('Kjør', 'Run'))}">${ui.ic(kind === 'scene' ? 'mdi:play' : on ? 'mdi:stop' : 'mdi:play', 18)}</button>`;
    const noEdit = !x.cid;
    return `<div class="hr li ${kind === 'automation' && !on ? 'off' : ''}" data-key="it-${esc(x.id)}">
      <button class="lm" data-a="edit" data-v="${esc(x.id)}" aria-label="${esc(x.name)}"><span class="hi ${kind === 'automation' && on || kind === 'script' && on ? 'on' : ''}">${ui.ic(a.icon || (kind === 'automation' && !on ? KIND[kind].iconOff : KIND[kind].icon), 21)}</span>
      <span class="ht"><b data-noi18n>${esc(x.name)}</b><i>${esc(sub[0])}${noEdit ? ` · <span class="tag">YAML</span>` : ''}${labs}</i></span></button>
      <button class="bt sm ic" data-a="more" data-v="${esc(x.id)}" aria-label="${esc(T('Mer', 'More'))}">${ui.ic('mdi:dots-vertical', 18)}</button>${right}</div>`;
  }
  M.ha.page('list', {
    title: (c, a) => T(KIND[a.kind].n, KIND[a.kind].en),
    sub: (c, a) => `${items(c.h, a.kind).length} ${T('totalt', 'in total')}`,
    haPath: (c, a) => KIND[a.kind].path,
    right: (c, a) => `<button class="hb" data-a="go" data-v="cats|${a.kind}" aria-label="${esc(T('Mapper', 'Folders'))}">${ui.ic('mdi:folder-cog-outline', 20)}</button>`,
    load: async (c) => { await reg.load(c.h); },
    render(c, a) {
      const kind = a.kind, st = c.state, h = c.h;
      if (st.group == null) st.group = lsGet('ki-ha-group-' + kind, 'cat');
      if (st.fold == null) st.fold = new Set(lsGet('ki-ha-fold-' + kind, []));
      const L = filtered(c, kind, st);
      const allLabs = new Set(); items(h, kind).forEach((x) => arr(x.r.labels).forEach((l) => allLabs.add(l)));
      const labChips = [...allLabs].map((l) => reg.label(l)).filter(Boolean).map((l) => ui.chip(`<span class="dt" style="--lc:${M.ha.labelColor(l.color)}"></span><span data-noi18n>${esc(l.name)}</span>`, (st.labs || []).includes(l.label_id), 'flab', l.label_id)).join('');
      const fChips = kind === 'automation' ? [['all', 'Alle'], ['on', 'På'], ['off', 'Av']].map(([v, t]) => ui.chip(esc(T(t)), (st.f || 'all') === v, 'filt', v)).join('') : '';
      let body;
      if (!L.length) body = ui.empty(KIND[kind].icon, st.q || (st.labs && st.labs.length) || (st.f && st.f !== 'all') ? T('Ingen treff', 'No matches') : T('Ingen ennå. Trykk + for å lage den første.', 'None yet. Tap + to create the first one.'));
      else if (st.group === 'none') body = ui.group(L.map((x) => itemRow(c, kind, x)).join(''), 'g-all');
      else {
        const by = new Map();
        const keyOf = (x) => (st.group === 'cat' ? ((x.r.categories || {})[kind] || '') : st.group === 'area' ? (x.r.area_id || '') : (arr(x.r.labels)[0] || ''));
        L.forEach((x) => { const k = keyOf(x); if (!by.has(k)) by.set(k, []); by.get(k).push(x); });
        const meta = (k) => {
          if (!k) return [st.group === 'cat' ? T('Uten mappe', 'No folder') : st.group === 'area' ? T('Uten område', 'No area') : T('Uten etikett', 'No label'), st.group === 'cat' ? 'mdi:folder-open-outline' : 'mdi:tag-off-outline'];
          if (st.group === 'cat') { const x = reg.cat(kind, k); return [x ? x.name : k, (x && x.icon) || 'mdi:folder-outline']; }
          if (st.group === 'area') { const x = h.areas && h.areas[k]; return [x ? x.name : k, (x && x.icon) || 'mdi:sofa-outline']; }
          const x = reg.label(k); return [x ? x.name : k, (x && x.icon) || 'mdi:label-outline'];
        };
        const keys = [...by.keys()].sort((p, q) => (p === '') - (q === '') || meta(p)[0].localeCompare(meta(q)[0], 'nb'));
        body = keys.map((k) => {
          const [n, ic] = meta(k), open = !st.fold.has(k);
          return `<button class="fo" data-a="fold" data-v="${esc(k)}" aria-expanded="${open}" data-key="fo-${esc(k)}">${ui.ic(ic, 18)}<span class="g" data-noi18n>${esc(n)}</span><span class="n">${by.get(k).length}</span>${ui.ic('mdi:chevron-down', 18, 'flex:none')}</button>${open ? ui.group(by.get(k).map((x) => itemRow(c, kind, x)).join(''), 'g-' + k) : ''}`;
        }).join('');
      }
      return `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="q" value="${esc(st.q || '')}" placeholder="${esc(T('Søk', 'Search'))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">${st.q ? `<button data-a="qx">${ui.ic('mdi:close-circle', 18)}</button>` : ''}</label>
        <div class="chs">${ui.chip(`${ui.ic(st.group === 'cat' ? 'mdi:folder-outline' : st.group === 'area' ? 'mdi:sofa-outline' : st.group === 'label' ? 'mdi:label-outline' : 'mdi:format-list-bulleted', 15)}${esc(st.group === 'cat' ? T('Mapper') : st.group === 'area' ? T('Områder') : st.group === 'label' ? T('Etiketter') : T('Liste'))}${ui.ic('mdi:menu-down', 15)}`, false, 'grp')}${fChips}${labChips}</div>
        ${body}
        <button class="fab" data-a="new">${ui.ic('mdi:plus', 22)}${esc(T(KIND[kind].add, KIND[kind].addEn))}</button>
        <style>.li{padding:4px 8px 4px 4px;gap:6px}.li .lm{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px 4px 6px 10px;text-align:left;border-radius:18px}.li .lm:active{background:rgb(var(--ki-wa-c,255 255 255)/.04)}.li .lb{margin-left:2px}</style>`;
    },
    input(c, el, v, commit) { if (el.dataset.f === 'q') { c.state.q = v; c.render(); } },
    act(c, a, el, args) {
      const kind = args.kind, st = c.state, v = el.dataset.v, h = c.h;
      switch (a) {
        case 'qx': st.q = ''; return c.render();
        case 'filt': M.haptic('selection'); st.f = v; return c.render();
        case 'flab': M.haptic('selection'); st.labs = (st.labs || []).includes(v) ? st.labs.filter((x) => x !== v) : [...(st.labs || []), v]; return c.render();
        case 'fold': M.haptic('selection'); if (st.fold.has(v)) st.fold.delete(v); else st.fold.add(v); lsSet('ki-ha-fold-' + kind, [...st.fold]); return c.render();
        case 'grp': return c.sheet({ title: T('Grupper etter', 'Group by'), html: `<div class="hg">${[['cat', 'mdi:folder-outline', 'Mapper'], ['area', 'mdi:sofa-outline', 'Områder'], ['label', 'mdi:label-outline', 'Etiketter'], ['none', 'mdi:format-list-bulleted', 'Ingen gruppering']].map(([k, i, t]) => ui.row({ a: 'g', v: k, icon: i, title: T(t), right: st.group === k ? ui.ic('mdi:check', 22, 'color:var(--ki-pink-text, var(--pink,#f285c9))') : '' })).join('')}</div>`, onAct: (x, e2) => { if (x !== 'g') return false; st.group = e2.dataset.v; lsSet('ki-ha-group-' + kind, st.group); M.haptic('selection'); c.render(); return true; } });
        case 'tog': { const s = h.states[v]; M.haptic('medium'); el.classList.toggle('on'); return c.call('automation', s && s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: v }).catch((e) => { c.err(e); c.render(); }); }
        case 'run': {
          M.haptic('medium'); el.animate && el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.85)' }, { transform: 'scale(1)' }], { duration: 260 });
          const s = h.states[v];
          if (kind === 'scene') return c.call('scene', 'turn_on', { entity_id: v }).then(() => c.toast(T('Scenen er aktivert', 'Scene activated'))).catch((e) => c.err(e));
          return c.call('script', s && s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: v }).catch((e) => c.err(e));
        }
        case 'edit': {
          const s = h.states[v], cid = cfgId(kind, v, s);
          if (!cid) { M.haptic('warning'); return c.toast(T('Laget i YAML – kan bare endres i konfigurasjonsfilene', 'Made in YAML – can only be changed in the configuration files'), { type: 'error' }); }
          return c.push(kind === 'scene' ? 'scene' : 'edit', { kind, entity: v, id: cid });
        }
        case 'new': return c.push(kind === 'scene' ? 'scene' : 'edit', { kind, isNew: true });
        case 'more': return moreSheet(c, kind, v);
        default: return undefined;
      }
    },
    reload: true,
  });
  // ⋯ for ett element: kjør, organiser, dupliser, spor, åpne i HA, slett
  function moreSheet(c, kind, id, inEditor) {
    const h = c.h, s = h.states[id], cid = cfgId(kind, id, s);
    const rows = [
      kind === 'automation' ? ui.row({ a: 'trig', icon: 'mdi:play', title: T('Kjør handlingene nå', 'Run actions now'), sub: T('Hopper over betingelsene', 'Skips the conditions') }) : ui.row({ a: 'run', icon: 'mdi:play', title: kind === 'scene' ? T('Aktiver', 'Activate') : T('Kjør', 'Run') }),
      ui.row({ a: 'org', icon: 'mdi:folder-move-outline', title: T('Mappe, etiketter og område', 'Folder, labels and area') }),
      cid && !inEditor ? ui.row({ a: 'dup', icon: 'mdi:content-copy', title: T('Dupliser', 'Duplicate') }) : '',
      cid && kind !== 'scene' ? ui.row({ a: 'tr', icon: 'mdi:timeline-clock-outline', title: T('Siste kjøringer', 'Recent runs'), sub: T('Spor med alle steg', 'Traces with every step') }) : '',
      ui.row({ a: 'mi', icon: 'mdi:information-outline', title: T('Detaljer og historikk', 'Details and history') }),
      cid ? ui.row({ a: 'del', icon: 'mdi:delete-outline', title: T('Slett', 'Delete'), cls: 'danger' }) : '',
    ].join('');
    c.sheet({
      title: nameOf(h, id), sub: id, html: `<div class="hg">${rows}</div>`,
      onAct: (a, el) => {
        if (a === 'trig') { c.call('automation', 'trigger', { entity_id: id, skip_condition: true }).then(() => { M.haptic('success'); c.toast(T('Kjørt', 'Ran')); }).catch((e) => c.err(e)); return true; }
        if (a === 'run') { c.call(kind, 'turn_on', { entity_id: id }).then(() => M.haptic('success')).catch((e) => c.err(e)); return true; }
        if (a === 'org') { setTimeout(() => orgSheet(c, kind, id, {}), 10); return false; }
        if (a === 'dup') { setTimeout(() => c.push(kind === 'scene' ? 'scene' : 'edit', { kind, isNew: true, copyOf: cid, copyEnt: id }), 10); return true; }
        if (a === 'tr') { setTimeout(() => c.push('traces', { kind, id: cid, entity: id }), 10); return true; }
        if (a === 'mi') { M.moreInfo(null, id); return true; }
        if (a === 'del') {
          if (el.dataset.arm !== '1') { el.dataset.arm = '1'; el.querySelector('b').textContent = T('Trykk igjen for å slette', 'Tap again to delete'); M.haptic('warning'); return false; }
          c.api('DELETE', `config/${kind}/config/${cid}`).then(() => { M.haptic('medium'); c.toast(T('Slettet', 'Deleted')); if (inEditor) c.pop(); else c.render(); }).catch((e) => c.err(e));
          return true;
        }
        return false;
      },
    });
  }
  M.ha.moreSheet = moreSheet;

  /* ------------------------------------------------------------ editor (automasjon og skript) */
  const MODES = [['single', 'Én om gangen'], ['restart', 'Start på nytt'], ['queued', 'Kø'], ['parallel', 'Parallelt']];
  const blank = (kind) => (kind === 'automation' ? { alias: '', description: '', triggers: [], conditions: [], actions: [], mode: 'single' } : { alias: '', description: '', icon: '', mode: 'single', sequence: [] });
  async function loadTr(c) {
    if (M.ha.tr) return;
    try { const r = await c.ws('frontend/get_translations', { language: (c.h && c.h.language) || 'en', category: 'services' }); M.ha.tr = (r && r.resources) || {}; } catch (e) { M.ha.tr = {}; }
  }
  const dirty = (st) => JSON.stringify(st.cfg) !== st.orig;
  M.ha.page('edit', {
    userTitle: true,
    title: (c, a) => { const st = c.state; return (st.cfg && st.cfg.alias) || (a.isNew ? T(KIND[a.kind].add, KIND[a.kind].addEn) : nameOf(c.h, a.entity)); },
    sub: (c, a) => (c.state.cfg ? (dirty(c.state) ? T('Ikke lagret', 'Not saved') : a.isNew ? T('Ny', 'New') : T('Lagret', 'Saved')) : ''),
    haPath: (c, a) => (a.id ? `/config/${a.kind}/edit/${a.id}` : KIND[a.kind].path),
    live: false,
    right: (c, a) => { const st = c.state; if (!st.cfg) return ''; return `<button class="hb" data-a="emore" aria-label="${esc(T('Mer', 'More'))}">${ui.ic('mdi:dots-vertical', 20)}</button><button class="hd" data-a="save" ${dirty(st) && !c.isBusy('save') ? '' : 'disabled'}>${c.isBusy('save') ? '<span class="spn s"></span>' : esc(T('Lagre', 'Save'))}</button>`; },
    async load(c, a) {
      const st = c.state;
      loadTr(c).then(() => c.render());
      let cfg;
      if (a.isNew && a.copyOf) { cfg = await c.api('GET', `config/${a.kind}/config/${a.copyOf}`); cfg = { ...cfg, alias: `${cfg.alias || ''} (${T('kopi', 'copy')})` }; delete cfg.id; }
      else if (a.isNew) cfg = blank(a.kind);
      else cfg = await c.api('GET', `config/${a.kind}/config/${a.id}`);
      st.cfg = B.normalize(cfg, a.kind);
      if (a.kind === 'automation') delete st.cfg.id;
      st.orig = a.isNew ? '' : JSON.stringify(st.cfg);
      st.open = new Set(); st.mode = 'visual';
      st.org = {};
      if (a.isNew && a.copyEnt) { const o = orgOf(a.copyEnt); st.org = { cat: o.cat[a.kind] || null, labels: o.labels, area: o.area }; }
      if (a.isNew) { if (a.kind === 'automation') st.open.add('triggers.0'); }
    },
    back(c) {
      const st = c.state;
      if (st.cfg && dirty(st) && !c.armed('discard')) { c.confirm('discard'); c.toast(T('Ikke lagret – trykk tilbake igjen for å forkaste', 'Not saved – tap back again to discard'), { type: 'error' }); return false; }
      return true;
    },
    render(c, a) {
      const st = c.state, kind = a.kind;
      if (!st.cfg) return ui.spin();
      const cfg = st.cfg;
      if (st.mode === 'yaml') {
        const raw = st.yamlRaw != null ? st.yamlRaw : M.yaml.dump(cfg);
        return `${ui.seg('__mode', 'yaml', [['visual', T('Visuelt', 'Visual')], ['yaml', 'YAML']])}
          <label class="fd"><textarea class="in yaml" data-f="__yaml" data-key="yml" spellcheck="false" autocapitalize="off">${esc(raw)}</textarea></label>
          ${st.yamlErr ? `<div class="fh err">${esc(st.yamlErr)}</div>` : ''}<style>${B.CSS}</style>`;
      }
      const o = a.entity ? orgOf(a.entity) : { cat: { [kind]: st.org.cat }, labels: arr(st.org.labels), area: st.org.area };
      const cat = reg.cat(kind, o.cat[kind]), labs = o.labels.map((l) => ui.labelChip(reg.label(l))).join(''), area = o.area && c.h.areas && c.h.areas[o.area];
      const orgSub = [cat ? cat.name : T('Ingen mappe', 'No folder'), area ? area.name : ''].filter(Boolean).join(' · ');
      const sec = (t, sub, icon) => `<div class="es">${ui.ic(icon, 18)}<span>${esc(t)}</span><i>${esc(sub || '')}</i></div>`;
      const det = `<div class="hg" data-key="det"><div class="frm">
          ${ui.field({ f: '::alias', value: cfg.alias, label: T('Navn', 'Name'), ph: kind === 'automation' ? T('F.eks. Lys på ved solnedgang', 'E.g. Lights on at sunset') : T('F.eks. God natt', 'E.g. Good night') })}
          ${ui.field({ f: '::description', value: cfg.description, label: T('Beskrivelse (valgfritt)', 'Description (optional)'), area: true, rows: 2 })}
          ${kind === 'script' ? `<div class="fd"><span class="fl">${esc(T('Ikon', 'Icon'))}</span>${M.iconPicker ? M.iconPicker.html({ key: 'sic', value: cfg.icon || '', placeholder: 'mdi:script-text', attrs: 'data-f="::icon" data-t="ent"' }) : ui.field({ f: '::icon', value: cfg.icon })}</div>` : ''}
          <div class="r2">${ui.select({ f: '::mode', value: cfg.mode || 'single', label: T('Hvis den allerede kjører', 'If already running'), opts: MODES.map(([v, t]) => [v, T(t)]) })}${cfg.mode === 'queued' || cfg.mode === 'parallel' ? ui.field({ f: '::max', t: 'num', value: cfg.max, label: T('Maks samtidig', 'Max at once'), ph: '10', attrs: 'inputmode="numeric"' }) : '<span></span>'}</div>
        </div>
        <button class="hr" data-a="org">${ui.ic('mdi:folder-outline', 22, 'margin:0 9px')}<span class="ht"><b>${esc(T('Mappe, etiketter og område', 'Folder, labels and area'))}</b><i>${esc(orgSub)}${labs}</i></span>${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3, #7f7f7f)')}</button>
        ${kind === 'script' ? `<details class="adv" style="margin:0 14px 12px"><summary>${esc(T('Felt (inndata til skriptet)', 'Fields (script inputs)'))}</summary><div class="frm" style="padding:8px 0 0">${(() => { const f = '::fields', raw = st.raw && st.raw[f]; return ui.field({ f, t: 'yaml', value: raw ? raw.text : cfg.fields ? M.yaml.dump(cfg.fields).replace(/\n$/, '') : '', area: true, rows: 5, mono: true, ph: 'lysstyrke:\n  name: Lysstyrke\n  selector:\n    number:\n      min: 0\n      max: 100' }) + (raw && raw.err ? `<span class="fh err">${esc(raw.err)}</span>` : ''); })()}</div></details>` : ''}
      </div>`;
      const body = kind === 'automation'
        ? `${sec(T('Når', 'When'), T('Utløsere – én av dem starter automasjonen', 'Triggers – any one starts the automation'), 'mdi:lightning-bolt-outline')}${B.list('trig', 'triggers', cfg.triggers, st, 0)}
           ${sec(T('Og hvis', 'And if'), T('Betingelser – alle må være oppfylt (valgfritt)', 'Conditions – all must pass (optional)'), 'mdi:filter-outline')}${B.list('cond', 'conditions', cfg.conditions, st, 0)}
           ${sec(T('Så', 'Then do'), T('Handlinger – kjøres i rekkefølge', 'Actions – run in order'), 'mdi:play-circle-outline')}${B.list('act', 'actions', cfg.actions, st, 0)}`
        : `${sec(T('Sekvens', 'Sequence'), T('Handlinger – kjøres i rekkefølge', 'Actions – run in order'), 'mdi:play-circle-outline')}${B.list('act', 'sequence', cfg.sequence, st, 0)}`;
      const runs = a.entity && a.id ? ui.group(ui.row({ a: 'traces', icon: 'mdi:timeline-clock-outline', title: T('Siste kjøringer', 'Recent runs'), sub: T('Se hva som skjedde, steg for steg', 'See what happened, step by step'), chev: true })) : '';
      return `${ui.seg('__mode', 'visual', [['visual', T('Visuelt', 'Visual')], ['yaml', 'YAML']])}${det}${body}${runs}${B.datalists(st)}
        <style>${B.CSS}
          .es{display:flex;align-items:baseline;gap:8px;padding:14px 6px 0;flex-wrap:wrap}.es ha-icon{align-self:center;color:var(--ki-text-2, #afafaf)}
          .es span{font-size:17px;font-weight:600}.es i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);flex-basis:100%;padding-left:26px;margin-top:-4px}</style>`;
    },
    input(c, el, v, commit, a) {
      const st = c.state, f = el.dataset.f;
      if (!st.cfg) return;
      const after = (soft) => { if (soft) { const hd = M.ha.current.root.querySelector('.hh .hd'); if (hd) hd.disabled = !dirty(st); const sb = M.ha.current.root.querySelector('.hh .tt i'); if (sb) sb.textContent = dirty(st) ? T('Ikke lagret', 'Not saved') : T('Lagret', 'Saved'); } else c.render(); };
      if (f === '__yaml') {
        st.yamlRaw = v;
        try { const p = M.yaml.parse(v); if (!p || typeof p !== 'object') throw new Error(T('Ugyldig YAML', 'Invalid YAML')); st.cfg = B.normalize(p, a.kind); if (a.kind === 'automation') delete st.cfg.id; st.yamlErr = null; } catch (e) { st.yamlErr = e.message; }
        if (commit) c.render(); else after(true);
        return;
      }
      if (f === '::fields') {
        st.raw = st.raw || {};
        if (!String(v).trim()) { delete st.cfg.fields; delete st.raw[f]; } else { try { st.cfg.fields = M.yaml.parse(v); st.raw[f] = { text: v }; } catch (e) { st.raw[f] = { text: v, err: e.message }; } }
        return after(!commit);
      }
      if (f && f.startsWith('::')) {
        const k = f.slice(2);
        let val = v;
        if (el.dataset.t === 'num') val = v === '' ? undefined : Number(v);
        if (val === '' || val == null) delete st.cfg[k]; else st.cfg[k] = val;
        if (k === 'alias' && !commit) { const tt = M.ha.current.root.querySelector('.hh .tt b'); if (tt) tt.textContent = v || T(KIND[a.kind].add, KIND[a.kind].addEn); }
        return after(!commit && k !== 'mode' && k !== 'icon');
      }
      B.input(c, el, v, commit, st, after);
    },
    act(c, a, el, args) {
      const st = c.state;
      if (a === 'seg' && el.dataset.f === '__mode') {
        if (el.dataset.v === st.mode) return undefined;
        if (st.mode === 'yaml' && st.yamlErr) { M.haptic('warning'); return c.toast(T('Rett YAML-feilen først', 'Fix the YAML error first'), { type: 'error' }); }
        st.mode = el.dataset.v; st.yamlRaw = null; M.haptic('selection'); return c.render();
      }
      if (a === 'save') return save(c, args);
      if (a === 'emore') return args.entity ? moreSheet(c, args.kind, args.entity, true) : c.toast(T('Lagre først', 'Save first'));
      if (a === 'org') return orgSheet(c, args.kind, args.entity || null, st.org, () => c.render());
      if (a === 'traces') return c.push('traces', { kind: args.kind, id: args.id, entity: args.entity });
      const done = (soft) => { if (soft) { const hd = M.ha.current.root.querySelector('.hh .hd'); if (hd) hd.disabled = !dirty(st); } else c.render(); };
      B.act(c, a, el, st, done);
      return undefined;
    },
  });
  const slugify = (s) => (M.slug ? M.slug(s) : String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_')).replace(/^_+|_+$/g, '') || 'skript';
  async function save(c, a) {
    const st = c.state, kind = a.kind, h = c.h;
    if (st.mode === 'yaml' && st.yamlErr) { M.haptic('warning'); return c.toast(T('Rett YAML-feilen først', 'Fix the YAML error first'), { type: 'error' }); }
    if (!String(st.cfg.alias || '').trim()) { M.haptic('warning'); c.toast(T('Gi den et navn først', 'Give it a name first'), { type: 'error' }); const i = M.ha.current.root.querySelector('[data-f="::alias"]'); if (i) i.focus(); return undefined; }
    const out = B.denorm(st.cfg, kind, M.ha.verOf(h));
    let id = a.id;
    if (!id) {
      if (kind === 'automation') id = String(Date.now());
      else { const base = slugify(st.cfg.alias); id = base; let n = 2; while (h.states['script.' + id]) id = `${base}_${n++}`; }
    }
    if (kind === 'automation') out.id = id;
    const p = c.api('POST', `config/${kind}/config/${id}`, out);
    try {
      await c.busy('save', p);
    } catch (e) { return c.err(e, T('Kunne ikke lagre', 'Could not save')); }
    M.haptic('success'); c.toast(T('Lagret', 'Saved'));
    st.orig = JSON.stringify(st.cfg);
    if (!a.id) {
      a.id = id; a.isNew = false;
      // vent på entiteten (HA laster automasjonene/skriptene på nytt etter lagring) og legg på mappe/etiketter/område
      const find = () => { const H2 = c.h; return Object.keys(H2.states).find((x) => (kind === 'script' ? x === 'script.' + id : x.startsWith('automation.') && String(H2.states[x].attributes.id) === id)); };
      for (let i = 0; i < 25 && !find(); i++) await new Promise((r) => setTimeout(r, 200));
      const ent = find();
      if (ent) {
        a.entity = ent;
        const o = st.org || {};
        const patch = {};
        if (o.cat) patch.categories = { [kind]: o.cat };
        if (o.labels && o.labels.length) patch.labels = o.labels;
        if (o.area) patch.area_id = o.area;
        if (Object.keys(patch).length) { await reg.load(c.h, true); try { await regUpdate(c, ent, patch); } catch (e) { c.err(e); } }
      }
    }
    c.render();
    return undefined;
  }

  /* ------------------------------------------------------------ mapper (kategorier) */
  M.ha.page('cats', {
    title: () => T('Mapper', 'Folders'),
    sub: (c, a) => (a.kind ? T(KIND[a.kind].n, KIND[a.kind].en) : T('Kategorier i Home Assistant', 'Categories in Home Assistant')),
    load: async (c) => { await reg.load(c.h, true); },
    render(c, a) {
      const st = c.state;
      const kind = st.kind || a.kind || 'automation';
      const h = c.h, cats = (reg.cats[kind] || []).slice().sort((x, y) => x.name.localeCompare(y.name, 'nb'));
      const n = (cid) => items(h, kind).filter((x) => (x.r.categories || {})[kind] === cid).length;
      return `${a.kind ? '' : ui.seg('__kind', kind, Object.keys(KIND).map((k) => [k, T(KIND[k].n, KIND[k].en)]))}
        <p class="mut" style="margin:0 6px">${esc(T('Mapper er Home Assistants kategorier. Hver type har sine egne mapper.', 'Folders are Home Assistant categories. Each type has its own folders.'))}</p>
        ${cats.length ? ui.group(cats.map((x) => ui.row({ a: 'ed', v: x.category_id, icon: x.icon || 'mdi:folder-outline', title: x.name, sub: `${n(x.category_id)} ${T('elementer', 'items')}`, chev: true })).join('')) : ui.empty('mdi:folder-outline', T('Ingen mapper ennå', 'No folders yet'))}
        <button class="fab" data-a="add">${ui.ic('mdi:folder-plus-outline', 22)}${esc(T('Ny mappe', 'New folder'))}</button>`;
    },
    act(c, a, el, args) {
      const st = c.state, kind = st.kind || args.kind || 'automation';
      if (a === 'seg') { st.kind = el.dataset.v; M.haptic('selection'); return c.render(); }
      if (a === 'add') return nameSheet(c, T('Ny mappe', 'New folder'), '', 'mdi:folder-outline', async (name, icon) => { await c.ws('config/category_registry/create', { scope: kind, name, icon: icon || null }); await reg.load(c.h, true); c.render(); });
      if (a === 'ed') {
        const x = reg.cat(kind, el.dataset.v); if (!x) return undefined;
        return nameSheet(c, T('Rediger mappe', 'Edit folder'), x.name, x.icon, async (name, icon) => { await c.ws('config/category_registry/update', { scope: kind, category_id: x.category_id, name, icon: icon || null }); await reg.load(c.h, true); c.render(); c.closeSheet(); },
          async () => { await c.ws('config/category_registry/delete', { scope: kind, category_id: x.category_id }); await reg.load(c.h, true); M.haptic('medium'); c.render(); });
      }
      return undefined;
    },
  });

  /* ------------------------------------------------------------ etiketter */
  M.ha.page('labels', {
    title: () => T('Etiketter', 'Labels'),
    sub: () => T('Brukes på automasjoner, scener, skript, enheter og mer', 'Used on automations, scenes, scripts, devices and more'),
    haPath: '/config/labels',
    load: async (c) => { await reg.load(c.h, true); },
    render(c) {
      const L = reg.labels.slice().sort((x, y) => x.name.localeCompare(y.name, 'nb'));
      const n = (id) => Object.values(reg.ents || {}).filter((e) => arr(e.labels).includes(id)).length;
      return `${L.length ? ui.group(L.map((l) => ui.row({ a: 'ed', v: l.label_id, icon: l.icon || 'mdi:label', iconBg: M.ha.labelColor(l.color), title: l.name, sub: [l.description, `${n(l.label_id)} ${T('entiteter', 'entities')}`].filter(Boolean).join(' · '), chev: true })).join('')) : ui.empty('mdi:label-outline', T('Ingen etiketter ennå', 'No labels yet'))}
        <button class="fab" data-a="add">${ui.ic('mdi:label-variant-outline', 22)}${esc(T('Ny etikett', 'New label'))}</button>`;
    },
    act(c, a, el) {
      if (a === 'add') return labelSheet(c, null);
      if (a === 'ed') return labelSheet(c, reg.label(el.dataset.v));
      return undefined;
    },
  });

  /* ------------------------------------------------------------ spor (siste kjøringer) */
  const RES = { finished: ['Fullført', 'ok'], failed_conditions: ['Betingelser ikke oppfylt', ''], failed_single: ['Kjørte allerede', ''], failed_max_runs: ['For mange samtidig', ''], error: ['Feil', 'err'], cancelled: ['Avbrutt', ''], aborted: ['Avbrutt', 'err'], running: ['Kjører', ''], timeout: ['Tidsavbrudd', 'err'] };
  const fmtT = (iso) => { try { return new Date(iso).toLocaleString(window.kiLang && window.kiLang() === 'en' ? 'en-GB' : 'nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return iso; } };
  M.ha.page('traces', {
    userTitle: false,
    title: () => T('Siste kjøringer', 'Recent runs'),
    sub: (c, a) => nameOf(c.h, a.entity),
    haPath: (c, a) => `/config/${a.kind}/trace/${a.id}`,
    async load(c, a) { const r = await c.ws('trace/list', { domain: a.kind, item_id: a.id }); c.state.list = (r || []).sort((x, y) => String(y.timestamp && y.timestamp.start).localeCompare(String(x.timestamp && x.timestamp.start))); },
    render(c) {
      const L = c.state.list;
      if (!L) return ui.spin();
      if (!L.length) return ui.empty('mdi:timeline-clock-outline', T('Ingen kjøringer lagret ennå', 'No runs stored yet'));
      return ui.group(L.map((r) => {
        const [t, cls] = RES[r.script_execution] || RES[r.state] || [r.script_execution || r.state || '–', ''];
        const dur = r.timestamp && r.timestamp.finish ? ((new Date(r.timestamp.finish) - new Date(r.timestamp.start)) / 1000).toFixed(1) + ' s' : '';
        return ui.row({ a: 'open', v: r.run_id, icon: cls === 'err' ? 'mdi:alert-circle-outline' : r.script_execution === 'finished' ? 'mdi:check-circle-outline' : 'mdi:minus-circle-outline', title: fmtT(r.timestamp && r.timestamp.start), subHtml: `<span class="${cls}">${esc(T(t))}</span>${r.trigger ? ` · <span data-noi18n>${esc(r.trigger)}</span>` : ''}${dur ? ` · ${dur}` : ''}${r.error ? ` · <span class="err" data-noi18n>${esc(r.error)}</span>` : ''}`, chev: true });
      }).join(''));
    },
    act(c, a, el, args) { if (a === 'open') return c.push('trace', { ...args, run: el.dataset.v }); return undefined; },
  });
  M.ha.page('trace', {
    title: () => T('Kjøring', 'Run'),
    sub: (c) => (c.state.tr && c.state.tr.timestamp ? fmtT(c.state.tr.timestamp.start) : ''),
    async load(c, a) { c.state.tr = await c.ws('trace/get', { domain: a.kind, item_id: a.id, run_id: a.run }); },
    render(c, a) {
      const tr = c.state.tr;
      if (!tr) return ui.spin();
      const cfg = B.normalize(tr.config || {}, a.kind);
      const steps = Object.entries(tr.trace || {}).map(([p, L]) => [p, arr(L)]).sort((x, y) => String(x[1][0] && x[1][0].timestamp).localeCompare(String(y[1][0] && y[1][0].timestamp)));
      const desc = (p) => {
        const P = p.split('/'), root = P[0];
        const map = { trigger: 'triggers', condition: 'conditions', action: 'actions', sequence: 'sequence' };
        const path = [map[root] || root, ...P.slice(1)].join('.');
        const b = B.getAt(cfg, path);
        const kind = root === 'trigger' ? 'trig' : root === 'condition' || P.includes('conditions') || P.includes('if') || P.includes('while') || P.includes('until') ? 'cond' : 'act';
        if (b == null) return p;
        return kind === 'trig' ? B.sumTrig(b) : kind === 'cond' ? B.sumCond(b) : (b.alias || B.sumAct(b));
      };
      const ok = (s) => { const r = s.result || {}; if (s.error) return ['mdi:alert-circle', 'err', s.error]; if (r.result === false) return ['mdi:close-circle-outline', '', T('Ikke oppfylt', 'Did not pass')]; if (r.result === true) return ['mdi:check-circle-outline', 'ok', T('Oppfylt', 'Passed')]; if (r.delay) return ['mdi:timer-sand', '', r.delay]; if (r.wait && r.wait.remaining != null) return ['mdi:timer-sand', '', T('Ventet', 'Waited')]; return ['mdi:check', 'ok', '']; };
      const [t, cls] = RES[tr.script_execution] || RES[tr.state] || [tr.script_execution || '', ''];
      return `<div class="card"><div class="kv"><span>${esc(T('Resultat', 'Result'))}</span><b class="${cls}">${esc(T(t))}</b><span>${esc(T('Utløst av', 'Triggered by'))}</span><b data-noi18n>${esc(tr.trigger || '–')}</b>${tr.error ? `<span>${esc(T('Feil', 'Error'))}</span><b class="err" data-noi18n>${esc(tr.error)}</b>` : ''}</div></div>
        ${ui.sec(T('Steg', 'Steps'))}
        <div class="tl">${steps.map(([p, L], i) => { const s = L[L.length - 1] || {}; const [ic, k, note] = ok(s); return `<div class="ts stg" style="animation-delay:${Math.min(i, 12) * 30}ms"><span class="td ${k}">${ui.ic(ic, 18)}</span><span class="ht"><b data-noi18n>${esc(desc(p))}</b><i><span data-noi18n>${esc(p)}</span>${note ? ` · <span class="${k}" data-noi18n>${esc(String(note))}</span>` : ''}${L.length > 1 ? ` · ${L.length}×` : ''}</i></span></div>`; }).join('')}</div>
        ${tr.context ? `<details class="adv" style="margin:0"><summary>${esc(T('Variabler og kontekst', 'Variables and context'))}</summary><pre class="pre" data-noi18n>${esc(JSON.stringify(Object.values(tr.trace || {})[0] ? arr(Object.values(tr.trace)[0])[0].changed_variables || {} : {}, null, 2))}</pre></details>` : ''}
        <style>.tl{display:flex;flex-direction:column;position:relative;padding-left:4px}.ts{display:flex;gap:12px;padding:8px 0;position:relative}.ts::before{content:'';position:absolute;left:15px;top:38px;bottom:-8px;width:2px;background:rgb(var(--ki-wa-c,255 255 255)/.1)}.ts:last-child::before{display:none}.td{width:32px;height:32px;border-radius:16px;flex:none;display:grid;place-items:center;background:var(--ki-surface, #3a3a3a)}.td.ok{color:var(--ki-green-text, var(--green,#8fd18f))}.td.err{color:var(--ki-red-text, var(--red,#f28073))}${B.CSS}</style>`;
    },
  });

  M.ha.autoPages = true;
})();
