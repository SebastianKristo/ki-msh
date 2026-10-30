/* KI MSH · Home Assistant-innstillinger: oppdateringer, sikkerhetskopier, reparasjoner, logger, system, generelt, om (Fiks 65).
 * Oppdateringer = update.*-entitetene (core, OS, supervisor, tillegg, HACS, fastvare …): installer (med backup først der
 * HA støtter det), utgivelsesnotater (update/release_notes), hopp over, «Oppdater alt» (backup → tillegg/øvrige → core sist).
 * Sikkerhetskopier = backup-API-et fra HA 2025.1: liste, lag (automatiske innstillinger eller egendefinert), last ned
 * (auth/sign_path), gjenopprett, slett, automatisk plan/oppbevaring/innhold/steder (backup/config/update). Fremdrift via
 * backup/subscribe_events mens siden er åpen.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || M.ha.sysPages) return;
  const esc = M.esc, ui = M.ha.ui;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const loc = () => (window.kiLang && window.kiLang() === 'en' ? 'en-GB' : 'nb-NO');
  const fmtD = (iso, o) => { try { return new Date(iso).toLocaleString(loc(), o || { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso || '–'; } };
  const fmtSize = (b) => { if (b == null) return ''; const n = Number(b); if (n >= 1073741824) return (n / 1073741824).toFixed(1).replace('.', ',') + ' GB'; if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; return Math.max(1, Math.round(n / 1024)) + ' kB'; };
  const hasSup = (h) => !!(h && h.config && arr(h.config.components).includes('hassio'));
  // enkel markdown → HTML (overskrifter, lister, lenker, fet, kode) – teksten escapes først
  function md(s) {
    const L = esc(String(s || '')).split('\n');
    let out = '', inList = false;
    const inline = (t) => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    L.forEach((l) => {
      const hm = /^(#{1,4})\s+(.*)$/.exec(l), li = /^\s*[-*]\s+(.*)$/.exec(l);
      if (li) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${inline(li[1])}</li>`; return; }
      if (inList) { out += '</ul>'; inList = false; }
      if (hm) out += `<h${hm[1].length + 1}>${inline(hm[2])}</h${hm[1].length + 1}>`;
      else if (l.trim()) out += `<p>${inline(l)}</p>`;
    });
    if (inList) out += '</ul>';
    return out;
  }
  const signOpen = async (c, path) => { const r = await c.ws('auth/sign_path', { path, expires: 300 }); const u = (c.h && c.h.hassUrl) ? c.h.hassUrl(r.path) : r.path; window.open(u, '_blank'); };

  /* ============================================================ oppdateringer */
  const F_INSTALL = 1, F_BACKUP = 8, F_NOTES = 16, F_PROGRESS = 4;
  const ups = (h) => Object.keys((h && h.states) || {}).filter((id) => id.startsWith('update.')).map((id) => ({ id, s: h.states[id] }));
  const rank = (x) => { const id = x.id; return /home_assistant_core/.test(id) ? 9 : /home_assistant_operating_system|_os$/.test(id) ? 8 : /supervisor/.test(id) ? 7 : 1; };
  async function makeBackup(c, onEv) {
    // backup med automatiske innstillinger; vent til managerens tilstand er tilbake til idle (eller 20 min)
    let unsub = null, done, fail;
    const fin = new Promise((res, rej) => { done = res; fail = rej; });
    try {
      unsub = await c.h.connection.subscribeMessage((ev) => {
        if (onEv) onEv(ev);
        if (ev && ev.manager_state === 'create_backup' && ev.state === 'completed') done();
        if (ev && ev.manager_state === 'create_backup' && ev.state === 'failed') fail(new Error(ev.reason || T('Sikkerhetskopien feilet', 'Backup failed')));
        if (ev && ev.manager_state === 'idle' && ev.__seen) done();
      }, { type: 'backup/subscribe_events' });
    } catch (e) { /* eldre HA: ingen hendelser */ }
    try {
      await c.ws('backup/generate_with_automatic_settings');
    } catch (e) { if (unsub) unsub(); throw e; }
    if (!unsub) { await new Promise((r) => setTimeout(r, 15000)); return; }
    await Promise.race([fin, new Promise((r) => setTimeout(r, 20 * 60 * 1000))]);
    unsub();
  }
  M.ha.makeBackup = makeBackup;
  M.ha.page('updates', {
    title: () => T('Oppdateringer', 'Updates'),
    sub: (c) => { const n = ups(c.h).filter((x) => x.s.state === 'on').length; return n ? `${n} ${T('tilgjengelig', 'available')}` : T('Alt er oppdatert', 'Everything is up to date'); },
    haPath: '/config/updates',
    right: (c) => `<button class="hb" data-a="check" aria-label="${esc(T('Se etter oppdateringer', 'Check for updates'))}">${c.isBusy('check') ? '<span class="spn s"></span>' : ui.ic('mdi:refresh', 20)}</button>`,
    render(c) {
      const h = c.h, st = c.state, L = ups(h);
      st.bk = st.bk || {};
      const av = L.filter((x) => x.s.state === 'on').sort((a, b) => rank(b) - rank(a));
      const skipped = L.filter((x) => x.s.state === 'off' && x.s.attributes.skipped_version);
      const row = (x) => {
        const a = x.s.attributes, open = st.open === x.id, sf = a.supported_features || 0, prog = a.in_progress;
        const pct = typeof a.update_percentage === 'number' ? a.update_percentage : typeof prog === 'number' ? prog : null;
        const bkOn = st.bk[x.id] !== false;
        const pic = a.entity_picture ? `<img src="${esc(c.h.hassUrl ? c.h.hassUrl(a.entity_picture) : a.entity_picture)}" alt="" loading="lazy" style="width:26px;height:26px;border-radius:6px">` : ui.ic(a.icon || 'mdi:package-up', 21);
        return `<div class="up" data-key="up-${esc(x.id)}"><button class="hr" data-a="uo" data-v="${esc(x.id)}" aria-expanded="${open}"><span class="hi ${prog ? 'on' : ''}">${pic}</span>
            <span class="ht"><b data-noi18n>${esc(a.title || a.friendly_name || x.id)}</b><i><span data-noi18n>${esc(a.installed_version || '–')}</span> → <b class="nv" data-noi18n>${esc(a.latest_version || '–')}</b>${prog ? ` · ${esc(T('Installerer …', 'Installing …'))}${pct != null ? ` ${pct} %` : ''}` : ''}</i></span>${ui.ic('mdi:chevron-down', 20, 'flex:none;transition:transform .25s;' + (open ? 'transform:rotate(180deg)' : ''))}</button>
          ${prog ? `<div class="pb ${pct == null ? 'ind' : ''}" style="margin:0 14px 12px"><i style="width:${pct != null ? pct : 35}%"></i></div>` : ''}
          ${open ? `<div class="frm">
            ${st.notes && st.notes[x.id] != null ? `<div class="md" data-noi18n>${md(st.notes[x.id]) || esc(T('Ingen notater', 'No notes'))}</div>` : a.release_summary ? `<div class="md" data-noi18n>${md(a.release_summary)}</div>` : sf & F_NOTES ? ui.spin(T('Henter utgivelsesnotater …', 'Loading release notes …')) : ''}
            ${a.release_url ? `<a class="mut" href="${esc(a.release_url)}" target="_blank" rel="noopener">${esc(T('Les mer om denne versjonen', 'Read more about this version'))} ↗</a>` : ''}
            ${sf & F_BACKUP ? `<div class="tr"><span>${esc(T('Ta sikkerhetskopi først', 'Back up first'))}<small>${esc(T('Anbefalt – du kan gå tilbake hvis noe går galt', 'Recommended – lets you roll back if something breaks'))}</small></span>${ui.sw(bkOn, 'bk', x.id)}</div>` : ''}
            <div class="bts">${sf & F_INSTALL ? ui.btn(prog ? T('Installerer …', 'Installing …') : T('Installer', 'Install'), 'inst', x.id, 'pri', 'mdi:download', prog ? 'disabled' : '') : `<span class="mut">${esc(T('Installeres utenfor Home Assistant', 'Installed outside Home Assistant'))}</span>`}${ui.btn(T('Hopp over', 'Skip'), 'skip', x.id, '', 'mdi:debug-step-over')}</div>
          </div>` : ''}</div>`;
      };
      const all = av.filter((x) => (x.s.attributes.supported_features || 0) & F_INSTALL);
      const run = st.run;
      return `${run ? `<div class="card"><h3>${esc(T('Oppdaterer alt', 'Updating everything'))}</h3><p>${esc(run.msg || '')}</p><div class="pb ${run.pct == null ? 'ind' : ''}"><i style="width:${run.pct || 35}%"></i></div></div>` : ''}
        ${av.length ? `${all.length > 1 && !run ? `<button class="card" data-a="all" style="flex-direction:row;align-items:center;gap:12px;text-align:left"><span class="hi on">${ui.ic('mdi:update', 22)}</span><span class="ht"><b>${esc(T('Ta backup og oppdater alt', 'Back up and update everything'))}</b><i>${all.length} ${esc(T('oppdateringer · Home Assistant Core installeres sist', 'updates · Home Assistant Core is installed last'))}</i></span>${ui.ic('mdi:chevron-right', 22)}</button>` : ''}
          <div class="hg">${av.map(row).join('')}</div>` : `<div class="card" style="align-items:center;text-align:center;padding:28px 16px"><span class="hi on" style="width:56px;height:56px">${ui.ic('mdi:check-bold', 28)}</span><h3>${esc(T('Alt er oppdatert', 'Everything is up to date'))}</h3><p>${L.length} ${esc(T('komponenter kontrollert', 'components checked'))}</p></div>`}
        ${skipped.length ? `${ui.sec(T('Hoppet over', 'Skipped'))}${ui.group(skipped.map((x) => ui.row({ icon: 'mdi:debug-step-over', title: x.s.attributes.title || x.s.attributes.friendly_name, sub: `${x.s.attributes.skipped_version}`, right: ui.btn(T('Angre', 'Undo'), 'unskip', x.id, 'sm') })).join(''))}` : ''}
        <style>.up+.up{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}.nv{font-weight:600;color:var(--ki-pink-text, var(--pink,#f285c9))}.up .frm{animation:stg .3s backwards}</style>`;
    },
    act(c, a, el) {
      const st = c.state, v = el.dataset.v, h = c.h;
      switch (a) {
        case 'check': M.haptic('light'); return c.busy('check', c.call('homeassistant', 'update_entity', { entity_id: ups(h).map((x) => x.id) }).then(() => c.toast(T('Sjekket', 'Checked'))).catch((e) => c.err(e)));
        case 'uo': {
          M.haptic('selection'); st.open = st.open === v ? null : v; c.render();
          const s = h.states[v], sf = (s && s.attributes.supported_features) || 0;
          if (st.open === v && sf & F_NOTES && !(st.notes && st.notes[v] != null)) c.ws('update/release_notes', { entity_id: v }).then((r) => { st.notes = { ...(st.notes || {}), [v]: r || '' }; c.render(); }).catch(() => { st.notes = { ...(st.notes || {}), [v]: '' }; c.render(); });
          return undefined;
        }
        case 'bk': M.haptic('selection'); st.bk[v] = st.bk[v] === false; return c.render();
        case 'inst': {
          if (!c.confirm('in' + v)) { el.querySelector('span').textContent = T('Trykk igjen for å installere', 'Tap again to install'); return undefined; }
          const s = h.states[v], sf = s.attributes.supported_features || 0, data = { entity_id: v };
          if (sf & F_BACKUP && st.bk[v] !== false) data.backup = true;
          M.haptic('medium'); c.toast(T('Installerer …', 'Installing …'), { type: 'busy' });
          return c.call('update', 'install', data).then(() => { M.haptic('success'); c.toast(T('Oppdatert', 'Updated')); }).catch((e) => c.err(e));
        }
        case 'skip': M.haptic('light'); return c.call('update', 'skip', { entity_id: v }).catch((e) => c.err(e));
        case 'unskip': M.haptic('light'); return c.call('update', 'clear_skipped', { entity_id: v }).catch((e) => c.err(e));
        case 'all': return allSheet(c);
        default: return undefined;
      }
    },
  });
  function allSheet(c) {
    let bk = true;
    const html = () => `<div class="tr"><span>${esc(T('Ta full sikkerhetskopi først', 'Take a full backup first'))}<small>${esc(T('Med innstillingene for automatisk backup', 'Using the automatic backup settings'))}</small></span>${ui.sw(bk, 'bk')}</div>
      <p class="mut" style="margin:0">${esc(T('Tilleggene og resten oppdateres først. Home Assistant Core installeres sist og starter Home Assistant på nytt.', 'Add-ons and the rest are updated first. Home Assistant Core is installed last and restarts Home Assistant.'))}</p>
      <div class="bts" style="justify-content:flex-end">${ui.btn(T('Start', 'Start'), 'go', null, 'pri', 'mdi:update')}</div>`;
    c.sheet({
      title: T('Oppdater alt', 'Update everything'), html: html(),
      onAct: (a) => {
        if (a === 'bk') { bk = !bk; M.haptic('selection'); M.ha.current.sheetHtml(html()); return false; }
        if (a === 'go') { runAll(c, bk); return true; }
        return false;
      },
    });
  }
  async function runAll(c, bk) {
    const st = c.state, set = (msg, pct) => { st.run = { msg, pct }; c.render(); };
    const L = ups(c.h).filter((x) => x.s.state === 'on' && (x.s.attributes.supported_features || 0) & F_INSTALL).sort((a, b) => rank(a) - rank(b));
    try {
      M.haptic('medium');
      if (bk) { set(T('Tar sikkerhetskopi …', 'Creating backup …'), null); await makeBackup(c, (ev) => { if (ev && ev.stage) set(`${T('Tar sikkerhetskopi', 'Creating backup')} · ${ev.stage}`, null); }); }
      for (let i = 0; i < L.length; i++) {
        const x = L[i];
        set(`${i + 1}/${L.length} · ${x.s.attributes.title || x.s.attributes.friendly_name}`, Math.round((i / L.length) * 100));
        await c.call('update', 'install', { entity_id: x.id }).catch((e) => c.err(e, x.s.attributes.title || x.id));
      }
      st.run = null; M.haptic('success'); c.toast(T('Alt er oppdatert', 'Everything is updated')); c.render();
    } catch (e) { st.run = null; c.err(e); c.render(); }
  }

  /* ============================================================ sikkerhetskopier */
  const AG = (c, id) => { const a = (c.state.agents || []).find((x) => x.agent_id === id); return a ? a.name || id : id === 'backup.local' ? T('Denne enheten', 'This device') : id === 'hassio.local' ? T('Denne enheten', 'This device') : id.replace(/^[^.]+\./, ''); };
  const bkSize = (b) => { if (b.size != null) return b.size; const s = Object.values(b.agents || {}).map((x) => x.size).filter((x) => x != null); return s.length ? Math.max(...s) : null; };
  M.ha.page('backups', {
    title: () => T('Sikkerhetskopier', 'Backups'),
    haPath: '/config/backup',
    right: () => `<button class="hb" data-a="cfg" aria-label="${esc(T('Innstillinger', 'Settings'))}">${ui.ic('mdi:cog-outline', 20)}</button>`,
    reload: true,
    async load(c) {
      const st = c.state;
      const [info, cfg, ag] = await Promise.all([c.ws('backup/info'), c.ws('backup/config/info').catch(() => null), c.ws('backup/agents/info').catch(() => null)]);
      st.info = info; st.cfg = cfg && cfg.config; st.agents = ag && ag.agents;
      if (!st.sub && c.h.connection) {
        try { st.sub = await c.h.connection.subscribeMessage((ev) => { st.ev = ev; if (ev && ev.manager_state === 'idle') { st.ev = null; c.ws('backup/info').then((r) => { st.info = r; c.render(); }).catch(() => {}); } c.render(); }, { type: 'backup/subscribe_events' }); } catch (e) { /* */ }
      }
    },
    render(c) {
      const st = c.state;
      if (!st.info) return ui.spin();
      const L = (st.info.backups || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const cfg = st.cfg || {}, sch = cfg.schedule || {};
      const plan = !cfg.automatic_backups_configured && sch.recurrence === 'never' ? T('Ikke satt opp', 'Not set up') : sch.recurrence === 'daily' ? `${T('Daglig', 'Daily')}${sch.time ? ` ${T('kl.', 'at')} ${String(sch.time).slice(0, 5)}` : ''}` : sch.recurrence === 'custom_days' ? `${arr(sch.days).join(', ')}${sch.time ? ` ${String(sch.time).slice(0, 5)}` : ''}` : T('Av', 'Off');
      const ev = st.ev && st.ev.manager_state && st.ev.manager_state !== 'idle' ? st.ev : null;
      const evTxt = ev ? ({ create_backup: T('Lager sikkerhetskopi', 'Creating backup'), restore_backup: T('Gjenoppretter', 'Restoring'), receive_backup: T('Laster opp', 'Uploading') }[ev.manager_state] || ev.manager_state) + (ev.stage ? ` · ${ev.stage}` : '') : '';
      const last = st.info.last_completed_automatic_backup || cfg.last_completed_automatic_backup;
      const next = st.info.next_automatic_backup || cfg.next_automatic_backup;
      return `<div class="card">
          <div style="display:flex;align-items:center;gap:12px"><span class="hi ${ev ? 'on' : ''}">${ev ? '<span class="spn s"></span>' : ui.ic('mdi:cloud-check-outline', 22)}</span><span class="ht"><b>${esc(ev ? evTxt : T('Automatisk sikkerhetskopi', 'Automatic backup'))}</b><i>${esc(plan)}</i></span></div>
          ${ev ? '<div class="pb ind"><i></i></div>' : `<div class="kv"><span>${esc(T('Siste vellykkede', 'Last successful'))}</span><b>${esc(last ? fmtD(last) : '–')}</b><span>${esc(T('Neste', 'Next'))}</span><b>${esc(next ? fmtD(next) : '–')}</b></div>`}
          <div class="bts">${ui.btn(T('Lag sikkerhetskopi nå', 'Back up now'), 'new', null, 'pri', 'mdi:plus', ev ? 'disabled' : '')}${ui.btn(T('Innstillinger', 'Settings'), 'cfg', null, '', 'mdi:cog-outline')}</div></div>
        ${ui.sec(`${T('Sikkerhetskopier', 'Backups')} · ${L.length}`)}
        ${L.length ? ui.group(L.map((b) => ui.row({ a: 'open', v: b.backup_id, icon: b.with_automatic_settings ? 'mdi:backup-restore' : 'mdi:content-save-outline', title: b.name || fmtD(b.date), subHtml: `${esc(fmtD(b.date))}${bkSize(b) != null ? ` · ${esc(fmtSize(bkSize(b)))}` : ''} · <span class="tag">${esc(b.with_automatic_settings ? T('Automatisk', 'Automatic') : T('Manuell', 'Manual'))}</span>${Object.keys(b.agents || {}).length ? ` · ${esc(Object.keys(b.agents).map((x) => AG(c, x)).join(', '))}` : ''}`, chev: true })).join('')) : ui.empty('mdi:cloud-outline', T('Ingen sikkerhetskopier ennå', 'No backups yet'))}`;
    },
    act(c, a, el) {
      if (a === 'cfg') return c.push('bkcfg');
      if (a === 'open') return c.push('backup', { id: el.dataset.v });
      if (a === 'new') return newBackupSheet(c);
      return undefined;
    },
  });
  function newBackupSheet(c) {
    const st = c.state, cfg = (st.cfg && st.cfg.create_backup) || {};
    const o = { mode: 'auto', name: '', db: true, addons: true, folders: arr(cfg.include_folders), agents: arr(cfg.agent_ids).length ? arr(cfg.agent_ids) : (st.agents || []).map((x) => x.agent_id).slice(0, 1), pw: '' };
    const FOLD = [['share', 'Share'], ['media', 'Media'], ['ssl', 'SSL'], ['addons/local', T('Lokale tillegg', 'Local add-ons')]];
    const sup = hasSup(c.h);
    const html = () => `${ui.seg('mode', o.mode, [['auto', T('Som automatisk', 'Like automatic')], ['custom', T('Egendefinert', 'Custom')]])}
      ${o.mode === 'auto' ? `<p class="mut" style="margin:0 4px">${esc(T('Bruker samme innhold og steder som den automatiske sikkerhetskopien.', 'Uses the same content and locations as the automatic backup.'))}</p>` : `
      ${ui.field({ f: 'name', value: o.name, label: T('Navn (valgfritt)', 'Name (optional)'), ph: fmtD(new Date().toISOString()) })}
      <div class="tr"><span>${esc(T('Historikk (database)', 'History (database)'))}</span>${ui.sw(o.db, 'db')}</div>
      ${sup ? `<div class="tr"><span>${esc(T('Alle tillegg', 'All add-ons'))}</span>${ui.sw(o.addons, 'ad')}</div>
      <div class="fd"><span class="fl">${esc(T('Mapper', 'Folders'))}</span><div class="chs wrap">${FOLD.map(([k, t]) => ui.chip(esc(t), o.folders.includes(k), 'fo', k)).join('')}</div></div>` : ''}
      <div class="fd"><span class="fl">${esc(T('Lagres på', 'Stored at'))}</span><div class="chs wrap">${(st.agents || []).map((x) => ui.chip(esc(AG(c, x.agent_id)), o.agents.includes(x.agent_id), 'ag', x.agent_id)).join('')}</div></div>
      ${ui.field({ f: 'pw', value: o.pw, label: T('Passord (valgfritt)', 'Password (optional)'), type: 'password', hint: T('Kreves for å gjenopprette. Ta vare på det.', 'Needed to restore. Keep it safe.') })}`}
      <div class="bts" style="justify-content:flex-end">${ui.btn(T('Lag sikkerhetskopi', 'Create backup'), 'go', null, 'pri', 'mdi:content-save-outline')}</div>`;
    const re = () => M.ha.current.sheetHtml(html());
    c.sheet({
      title: T('Ny sikkerhetskopi', 'New backup'), html: html(),
      onInput: (el, v) => { if (el.dataset.f === 'name') o.name = v; if (el.dataset.f === 'pw') o.pw = v; },
      onAct: (a, el) => {
        const v = el.dataset.v;
        if (a === 'seg') { o.mode = v; re(); return false; }
        if (a === 'db') { o.db = !o.db; re(); return false; }
        if (a === 'ad') { o.addons = !o.addons; re(); return false; }
        if (a === 'fo') { o.folders = o.folders.includes(v) ? o.folders.filter((x) => x !== v) : [...o.folders, v]; re(); return false; }
        if (a === 'ag') { o.agents = o.agents.includes(v) ? o.agents.filter((x) => x !== v) : [...o.agents, v]; re(); return false; }
        if (a === 'go') {
          M.haptic('medium');
          const p = o.mode === 'auto' ? c.ws('backup/generate_with_automatic_settings') : c.ws('backup/generate', { agent_ids: o.agents, include_database: o.db, include_all_addons: sup ? o.addons : undefined, include_folders: sup && o.folders.length ? o.folders : undefined, include_homeassistant: true, name: o.name || undefined, password: o.pw || undefined });
          p.then(() => c.toast(T('Sikkerhetskopien er startet', 'Backup started'))).catch((e) => c.err(e));
          return true;
        }
        return false;
      },
    });
  }
  M.ha.page('backup', {
    title: (c) => (c.state.b ? c.state.b.name || T('Sikkerhetskopi', 'Backup') : T('Sikkerhetskopi', 'Backup')),
    sub: (c) => (c.state.b ? fmtD(c.state.b.date) : ''),
    async load(c, a) { const r = await c.ws('backup/details', { backup_id: a.id }); c.state.b = r && r.backup; const ag = await c.ws('backup/agents/info').catch(() => null); c.state.agents = ag && ag.agents; if (!c.state.b) throw new Error(T('Fant ikke sikkerhetskopien', 'Backup not found')); },
    render(c) {
      const b = c.state.b;
      if (!b) return ui.spin();
      const ags = Object.keys(b.agents || {});
      const prot = ags.some((x) => b.agents[x].protected) || b.protected;
      return `<div class="card"><div class="kv">
          <span>${esc(T('Dato', 'Date'))}</span><b>${esc(fmtD(b.date))}</b>
          <span>${esc(T('Størrelse', 'Size'))}</span><b>${esc(fmtSize(bkSize(b)) || '–')}</b>
          <span>${esc(T('Home Assistant', 'Home Assistant'))}</span><b data-noi18n>${esc(b.homeassistant_version || '–')}</b>
          <span>${esc(T('Historikk', 'History'))}</span><b>${esc(b.database_included ? T('Med', 'Included') : T('Uten', 'Not included'))}</b>
          <span>${esc(T('Passord', 'Password'))}</span><b>${esc(prot ? T('Ja', 'Yes') : T('Nei', 'No'))}</b>
          <span>${esc(T('Type', 'Type'))}</span><b>${esc(b.with_automatic_settings ? T('Automatisk', 'Automatic') : T('Manuell', 'Manual'))}</b></div></div>
        ${arr(b.addons).length ? `${ui.sec(T('Tillegg', 'Add-ons'))}${ui.group(arr(b.addons).map((x) => ui.row({ icon: 'mdi:puzzle-outline', title: x.name || x.slug, sub: x.version || '' })).join(''))}` : ''}
        ${arr(b.folders).length ? `${ui.sec(T('Mapper', 'Folders'))}<div class="chs wrap">${arr(b.folders).map((x) => `<span class="ch">${esc(x)}</span>`).join('')}</div>` : ''}
        ${ui.sec(T('Lagret på', 'Stored at'))}
        ${ui.group(ags.map((x) => ui.row({ a: 'dl', v: x, icon: /local/.test(x) ? 'mdi:harddisk' : 'mdi:cloud-outline', title: AG(c, x), sub: fmtSize(b.agents[x].size) || '', right: ui.ic('mdi:download', 20) })).join(''))}
        <div class="bts" style="margin-top:6px">${ui.btn(T('Gjenopprett', 'Restore'), 'restore', null, 'pri', 'mdi:backup-restore')}${ui.btn(c.armed('del') ? T('Trykk igjen for å slette', 'Tap again to delete') : T('Slett', 'Delete'), 'del', null, 'warn', 'mdi:delete-outline')}</div>`;
    },
    act(c, a, el, args) {
      const b = c.state.b;
      if (a === 'dl') { M.haptic('light'); return signOpen(c, `/api/backup/download/${encodeURIComponent(b.backup_id)}?agent_id=${encodeURIComponent(el.dataset.v)}`).catch((e) => c.err(e)); }
      if (a === 'del') { if (!c.confirm('del')) return undefined; return c.ws('backup/delete', { backup_id: b.backup_id }).then(() => { M.haptic('medium'); c.toast(T('Slettet', 'Deleted')); c.pop(); }).catch((e) => c.err(e)); }
      if (a === 'restore') return restoreSheet(c, b);
      return undefined;
    },
  });
  function restoreSheet(c, b) {
    const ags = Object.keys(b.agents || {});
    const o = { ha: true, db: !!b.database_included, addons: arr(b.addons).map((x) => x.slug), folders: arr(b.folders), agent: ags.find((x) => /local/.test(x)) || ags[0], pw: '', armed: false };
    const prot = ags.some((x) => b.agents[x].protected) || b.protected;
    const html = () => `<p class="mut" style="margin:0 4px">${esc(T('Home Assistant starter på nytt etterpå. Det som er gjort etter sikkerhetskopien går tapt for delene du velger.', 'Home Assistant restarts afterwards. Changes made after the backup are lost for the parts you choose.'))}</p>
      <div class="tr"><span>${esc(T('Innstillinger og oppsett', 'Settings and configuration'))}</span>${ui.sw(o.ha, 'ha')}</div>
      ${b.database_included ? `<div class="tr"><span>${esc(T('Historikk (database)', 'History (database)'))}</span>${ui.sw(o.db, 'db')}</div>` : ''}
      ${arr(b.addons).length ? `<div class="fd"><span class="fl">${esc(T('Tillegg', 'Add-ons'))}</span><div class="chs wrap">${arr(b.addons).map((x) => ui.chip(esc(x.name || x.slug), o.addons.includes(x.slug), 'ad', x.slug)).join('')}</div></div>` : ''}
      ${arr(b.folders).length ? `<div class="fd"><span class="fl">${esc(T('Mapper', 'Folders'))}</span><div class="chs wrap">${arr(b.folders).map((x) => ui.chip(esc(x), o.folders.includes(x), 'fo', x)).join('')}</div></div>` : ''}
      ${ags.length > 1 ? `<div class="fd"><span class="fl">${esc(T('Hent fra', 'Restore from'))}</span><div class="chs wrap">${ags.map((x) => ui.chip(esc(AG(c, x)), o.agent === x, 'ag', x)).join('')}</div></div>` : ''}
      ${prot ? ui.field({ f: 'pw', value: o.pw, label: T('Passord', 'Password'), type: 'password' }) : ''}
      <div class="bts" style="justify-content:flex-end">${ui.btn(o.armed ? T('Trykk igjen for å gjenopprette', 'Tap again to restore') : T('Gjenopprett', 'Restore'), 'go', null, o.armed ? 'warn' : 'pri', 'mdi:backup-restore')}</div>`;
    const re = () => M.ha.current.sheetHtml(html());
    c.sheet({
      title: T('Gjenopprett', 'Restore'), sub: b.name || fmtD(b.date), html: html(),
      onInput: (el, v) => { if (el.dataset.f === 'pw') o.pw = v; },
      onAct: (a, el) => {
        const v = el.dataset.v;
        const tog = (k, x) => { o[k] = o[k].includes(x) ? o[k].filter((y) => y !== x) : [...o[k], x]; };
        if (a === 'ha') { o.ha = !o.ha; re(); return false; }
        if (a === 'db') { o.db = !o.db; re(); return false; }
        if (a === 'ad') { tog('addons', v); re(); return false; }
        if (a === 'fo') { tog('folders', v); re(); return false; }
        if (a === 'ag') { o.agent = v; re(); return false; }
        if (a === 'go') {
          if (!o.armed) { o.armed = true; M.haptic('warning'); re(); return false; }
          M.haptic('heavy');
          c.ws('backup/restore', { backup_id: b.backup_id, agent_id: o.agent, password: o.pw || undefined, restore_homeassistant: o.ha, restore_database: o.db, restore_addons: o.addons, restore_folders: o.folders })
            .then(() => c.toast(T('Gjenoppretter – Home Assistant starter på nytt', 'Restoring – Home Assistant will restart'))).catch((e) => c.err(e));
          return true;
        }
        return false;
      },
    });
  }
  M.ha.page('bkcfg', {
    title: () => T('Automatisk sikkerhetskopi', 'Automatic backup'),
    sub: (c) => (c.state.saving ? T('Lagrer …', 'Saving …') : ''),
    async load(c) { const [cfg, ag] = await Promise.all([c.ws('backup/config/info'), c.ws('backup/agents/info').catch(() => null)]); c.state.cfg = cfg.config; c.state.agents = ag && ag.agents; },
    render(c) {
      const st = c.state, cfg = st.cfg;
      if (!cfg) return ui.spin();
      const sch = cfg.schedule || {}, ret = cfg.retention || {}, cb = cfg.create_backup || {};
      const DAYS = [['mon', 'Man'], ['tue', 'Tir'], ['wed', 'Ons'], ['thu', 'Tor'], ['fri', 'Fre'], ['sat', 'Lør'], ['sun', 'Søn']];
      const rm = ret.copies != null ? 'copies' : ret.days != null ? 'days' : 'forever';
      const sup = hasSup(c.h);
      const FOLD = [['share', 'Share'], ['media', 'Media'], ['ssl', 'SSL'], ['addons/local', T('Lokale tillegg', 'Local add-ons')]];
      return `${ui.sec(T('Plan', 'Schedule'))}<div class="hg"><div class="frm">
          ${ui.seg('rec', sch.recurrence || 'never', [['never', T('Aldri', 'Never')], ['daily', T('Daglig', 'Daily')], ['custom_days', T('Valgte dager', 'Chosen days')]])}
          ${sch.recurrence === 'custom_days' ? `<div class="chs wrap">${DAYS.map(([v, t]) => ui.chip(esc(T(t)), arr(sch.days).includes(v), 'day', v)).join('')}</div>` : ''}
          ${sch.recurrence && sch.recurrence !== 'never' ? ui.field({ f: 'time', value: sch.time ? String(sch.time).slice(0, 5) : '', type: 'time', label: T('Tidspunkt (tomt = HA velger)', 'Time (empty = HA chooses)') }) : ''}
        </div></div>
        ${ui.sec(T('Behold', 'Keep'))}<div class="hg"><div class="frm">
          ${ui.seg('ret', rm, [['copies', T('Antall', 'Copies')], ['days', T('Dager', 'Days')], ['forever', T('Alle', 'All')]])}
          ${rm !== 'forever' ? ui.field({ f: 'retv', t: 'num', value: rm === 'copies' ? ret.copies : ret.days, label: rm === 'copies' ? T('Antall sikkerhetskopier', 'Number of backups') : T('Antall dager', 'Number of days'), attrs: 'inputmode="numeric"' }) : ''}
        </div></div>
        ${ui.sec(T('Innhold', 'Content'))}<div class="hg"><div class="frm">
          <div class="tr"><span>${esc(T('Historikk (database)', 'History (database)'))}</span>${ui.sw(cb.include_database !== false, 'db')}</div>
          ${sup ? `<div class="tr"><span>${esc(T('Alle tillegg', 'All add-ons'))}</span>${ui.sw(!!cb.include_all_addons, 'ad')}</div>
          <div class="fd"><span class="fl">${esc(T('Mapper', 'Folders'))}</span><div class="chs wrap">${FOLD.map(([k, t]) => ui.chip(esc(t), arr(cb.include_folders).includes(k), 'fo', k)).join('')}</div></div>` : ''}
        </div></div>
        ${ui.sec(T('Steder', 'Locations'))}<div class="hg"><div class="frm"><div class="chs wrap">${(st.agents || []).map((x) => ui.chip(`${ui.ic(/local/.test(x.agent_id) ? 'mdi:harddisk' : 'mdi:cloud-outline', 15)}${esc(AG(c, x.agent_id))}`, arr(cb.agent_ids).includes(x.agent_id), 'ag', x.agent_id)).join('')}</div>
          <span class="fh">${esc(T('Nye steder (Google Drive, Nabu Casa, nettverkslagring …) legges til som integrasjoner i Home Assistant.', 'New locations (Google Drive, Nabu Casa, network storage …) are added as integrations in Home Assistant.'))}</span></div></div>`;
    },
    input(c, el, v, commit) {
      if (!commit) return;
      const cfg = c.state.cfg;
      if (el.dataset.f === 'time') return put(c, { schedule: { ...pickSch(cfg), time: v ? v + ':00' : null } });
      if (el.dataset.f === 'retv') { const n = v === '' ? null : Math.max(1, Number(v)); const ret = cfg.retention || {}; return put(c, { retention: ret.days != null ? { copies: null, days: n } : { copies: n, days: null } }); }
      return undefined;
    },
    act(c, a, el) {
      const cfg = c.state.cfg, v = el.dataset.v, cb = cfg.create_backup || {};
      const cbSet = (patch) => put(c, { create_backup: { agent_ids: arr(cb.agent_ids), include_database: cb.include_database !== false, include_all_addons: !!cb.include_all_addons, include_folders: arr(cb.include_folders), ...patch } });
      if (a === 'seg' && el.dataset.f === 'rec') return put(c, { schedule: { ...pickSch(cfg), recurrence: v, days: v === 'custom_days' ? arr(cfg.schedule && cfg.schedule.days).length ? cfg.schedule.days : ['mon', 'thu'] : [] } });
      if (a === 'seg' && el.dataset.f === 'ret') return put(c, { retention: v === 'copies' ? { copies: 3, days: null } : v === 'days' ? { copies: null, days: 7 } : { copies: null, days: null } });
      if (a === 'day') { const D = arr(cfg.schedule.days); return put(c, { schedule: { ...pickSch(cfg), days: D.includes(v) ? D.filter((x) => x !== v) : [...D, v] } }); }
      if (a === 'db') return cbSet({ include_database: !(cb.include_database !== false) });
      if (a === 'ad') return cbSet({ include_all_addons: !cb.include_all_addons });
      if (a === 'fo') { const F = arr(cb.include_folders); return cbSet({ include_folders: F.includes(v) ? F.filter((x) => x !== v) : [...F, v] }); }
      if (a === 'ag') { const A = arr(cb.agent_ids); return cbSet({ agent_ids: A.includes(v) ? A.filter((x) => x !== v) : [...A, v] }); }
      return undefined;
    },
  });
  const pickSch = (cfg) => { const s = cfg.schedule || {}; return { recurrence: s.recurrence || 'never', days: arr(s.days), time: s.time || null }; };
  async function put(c, patch) {
    const st = c.state;
    M.haptic('selection');
    st.cfg = { ...st.cfg, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { ...(st.cfg[k] || {}), ...v }])) };
    st.saving = true; c.render();
    try { await c.ws('backup/config/update', patch); const r = await c.ws('backup/config/info'); st.cfg = r.config; c.toast(T('Lagret', 'Saved')); } catch (e) { c.err(e); }
    st.saving = false; c.render();
  }

  /* ============================================================ reparasjoner */
  async function issueTr(c, domains) {
    const lang = (c.h && c.h.language) || 'en';
    try { const r = await c.ws('frontend/get_translations', { language: lang, category: 'issues', integration: domains }); return (r && r.resources) || {}; } catch (e) { return {}; }
  }
  const fill = (s, ph) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (ph && ph[k] != null ? ph[k] : m));
  M.ha.page('repairs', {
    title: () => T('Reparasjoner', 'Repairs'),
    haPath: '/config/repairs',
    reload: true,
    async load(c) { const r = await c.ws('repairs/list_issues'); const L = (r && r.issues) || []; c.state.L = L; c.state.tr = await issueTr(c, [...new Set(L.map((i) => i.domain))]); },
    render(c) {
      const st = c.state;
      if (!st.L) return ui.spin();
      const L = st.L.filter((i) => st.showIgn || !i.ignored);
      const ign = st.L.filter((i) => i.ignored).length;
      const tr = st.tr || {};
      const SEV = { critical: ['mdi:alert-octagon', 'err'], error: ['mdi:alert-circle', 'err'], warning: ['mdi:alert', ''] };
      return `${L.length ? `<div class="hg">${L.map((i) => {
        const key = `component.${i.domain}.issues.${i.translation_key || i.issue_id}`;
        const title = fill(tr[key + '.title'], i.translation_placeholders) || i.issue_id.replace(/_/g, ' ');
        const desc = fill(tr[key + '.description'] || tr[key + '.fix_flow.step.init.description'] || tr[key + '.fix_flow.step.confirm.description'], i.translation_placeholders);
        const open = st.open === i.issue_id, [ic, cls] = SEV[i.severity] || SEV.warning;
        return `<div class="up" data-key="rp-${esc(i.issue_id)}"><button class="hr ${i.ignored ? 'off' : ''}" data-a="o" data-v="${esc(i.issue_id)}"><span class="hi ${cls}">${ui.ic(ic, 21)}</span><span class="ht"><b data-noi18n>${esc(title)}</b><i><span data-noi18n>${esc(i.domain)}</span>${i.ignored ? ` · ${esc(T('ignorert', 'ignored'))}` : ''}</i></span>${ui.ic('mdi:chevron-down', 20, 'flex:none;transition:transform .25s;' + (open ? 'transform:rotate(180deg)' : ''))}</button>
          ${open ? `<div class="frm">${desc ? `<div class="md" data-noi18n>${md(desc)}</div>` : ''}<div class="bts">${i.is_fixable ? ui.btn(T('Reparer i Home Assistant', 'Fix in Home Assistant'), 'fix', i.issue_id, 'pri', 'mdi:wrench') : ''}${i.learn_more_url ? `<a class="bt" href="${esc(i.learn_more_url)}" target="_blank" rel="noopener">${ui.ic('mdi:open-in-new', 18)}<span>${esc(T('Les mer', 'Learn more'))}</span></a>` : ''}${i.dismissible !== false ? ui.btn(i.ignored ? T('Ikke ignorer', 'Unignore') : T('Ignorer', 'Ignore'), 'ign', i.issue_id, '', 'mdi:eye-off-outline') : ''}</div></div>` : ''}</div>`;
      }).join('')}</div>` : `<div class="card" style="align-items:center;text-align:center;padding:28px 16px"><span class="hi on" style="width:56px;height:56px">${ui.ic('mdi:check-bold', 28)}</span><h3>${esc(T('Ingen problemer', 'No issues'))}</h3><p>${esc(T('Home Assistant har ingenting å melde', 'Home Assistant has nothing to report'))}</p></div>`}
        ${ign ? `<button class="fo" data-a="si">${ui.ic(st.showIgn ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 18)}<span class="g">${esc(st.showIgn ? T('Skjul ignorerte', 'Hide ignored') : `${T('Vis ignorerte', 'Show ignored')} (${ign})`)}</span></button>` : ''}
        <style>.up+.up{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}.hi.err{color:var(--ki-red-text, var(--red,#f28073))}</style>`;
    },
    act(c, a, el) {
      const st = c.state, v = el.dataset.v;
      if (a === 'o') { M.haptic('selection'); st.open = st.open === v ? null : v; return c.render(); }
      if (a === 'si') { st.showIgn = !st.showIgn; return c.render(); }
      if (a === 'fix') return c.nav('/config/repairs');
      if (a === 'ign') { const i = st.L.find((x) => x.issue_id === v); return c.ws('repairs/ignore_issue', { domain: i.domain, issue_id: i.issue_id, ignore: !i.ignored }).then(() => { i.ignored = !i.ignored; M.haptic('light'); c.render(); }).catch((e) => c.err(e)); }
      return undefined;
    },
  });

  /* ============================================================ logger */
  M.ha.page('logs', {
    title: () => T('Logger', 'Logs'),
    haPath: '/config/logs',
    right: (c) => `<button class="hb" data-a="rl" aria-label="${esc(T('Oppdater', 'Refresh'))}">${ui.ic('mdi:refresh', 20)}</button>`,
    async load(c) { c.state.L = await c.ws('system_log/list'); },
    render(c) {
      const st = c.state;
      if (!st.L) return ui.spin();
      const lv = st.lv || 'all', q = String(st.q || '').toLowerCase();
      const LV = { CRITICAL: ['mdi:alert-octagon', 'err'], ERROR: ['mdi:alert-circle', 'err'], WARNING: ['mdi:alert', ''], INFO: ['mdi:information-outline', ''], DEBUG: ['mdi:bug-outline', ''] };
      const L = st.L.filter((e) => (lv === 'all' || (lv === 'err' ? /ERROR|CRITICAL/.test(e.level) : e.level === 'WARNING')) && (!q || (arr(e.message).join(' ') + ' ' + e.name).toLowerCase().includes(q))).sort((a, b) => b.timestamp - a.timestamp);
      return `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="q" value="${esc(st.q || '')}" placeholder="${esc(T('Søk i loggen', 'Search the log'))}" autocomplete="off"></label>
        ${ui.seg('lv', lv, [['all', `${T('Alle', 'All')} · ${st.L.length}`], ['err', T('Feil', 'Errors')], ['warn', T('Advarsler', 'Warnings')]])}
        ${L.length ? `<div class="hg">${L.map((e, i) => {
          const k = e.name + e.timestamp, open = st.open === k, [ic, cls] = LV[e.level] || LV.INFO;
          return `<div class="up" data-key="lg-${i}-${esc(e.name)}"><button class="hr" data-a="o" data-v="${esc(k)}"><span class="hi ${cls}">${ui.ic(ic, 20)}</span><span class="ht"><b class="lm2" data-noi18n>${esc(arr(e.message)[0] || '')}</b><i><span data-noi18n>${esc(e.name)}</span> · ${esc(M.relTime(new Date(e.timestamp * 1000).toISOString()))}${e.count > 1 ? ` · ${e.count}×` : ''}</i></span></button>
            ${open ? `<div class="frm"><pre class="pre" data-noi18n>${esc(arr(e.message).join('\n\n'))}${e.exception ? '\n\n' + esc(e.exception) : ''}</pre><span class="mut" data-noi18n>${esc(arr(e.source).join(':'))} · ${esc(T('første gang', 'first'))} ${esc(fmtD(new Date(e.first_occurred * 1000).toISOString()))}</span></div>` : ''}</div>`;
        }).join('')}</div>` : ui.empty('mdi:check-circle-outline', T('Ingen meldinger', 'No messages'))}
        <div class="bts">${ui.btn(T('Tøm', 'Clear'), 'clear', null, '', 'mdi:notification-clear-all')}${ui.btn(T('Last ned hele loggen', 'Download full log'), 'full', null, '', 'mdi:download')}${ui.btn(T('Rå logg i HA', 'Raw log in HA'), 'ext2', null, '', 'mdi:open-in-new')}</div>
        <style>.up+.up{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}.hi.err{color:var(--ki-red-text, var(--red,#f28073))}.lm2{white-space:normal!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:14px!important}</style>`;
    },
    input(c, el, v) { if (el.dataset.f === 'q') { c.state.q = v; c.render(); } },
    act(c, a, el) {
      const st = c.state;
      if (a === 'seg') { st.lv = el.dataset.v; M.haptic('selection'); return c.render(); }
      if (a === 'o') { st.open = st.open === el.dataset.v ? null : el.dataset.v; M.haptic('selection'); return c.render(); }
      if (a === 'rl') { st.L = null; c.render(); return c.ws('system_log/list').then((r) => { st.L = r; c.render(); }).catch((e) => c.err(e)); }
      if (a === 'clear') { if (!c.confirm('clear')) return undefined; return c.call('system_log', 'clear', {}).then(() => { st.L = []; M.haptic('medium'); c.render(); }).catch((e) => c.err(e)); }
      if (a === 'full') return signOpen(c, '/api/error_log').catch((e) => c.err(e));
      if (a === 'ext2') return c.nav('/config/logs?provider=core&raw=true');
      return undefined;
    },
  });

  /* ============================================================ start på nytt og kontroll */
  const RELOAD = [['automation', 'Automasjoner'], ['script', 'Skript'], ['scene', 'Scener'], ['group', 'Grupper'], ['template', 'Mal-entiteter'], ['input_boolean', 'Av/på-hjelpere'], ['input_number', 'Tall-hjelpere'], ['input_select', 'Nedtrekk-hjelpere'], ['input_text', 'Tekst-hjelpere'], ['input_datetime', 'Dato/tid-hjelpere'], ['input_button', 'Knapp-hjelpere'], ['timer', 'Tidtakere'], ['counter', 'Tellere'], ['schedule', 'Tidsplaner'], ['person', 'Personer'], ['zone', 'Soner'], ['homeassistant:reload_core_config', 'Grunnoppsett (sted, enheter)'], ['frontend:reload_themes', 'Temaer']];
  M.ha.page('system', {
    title: () => T('Start på nytt og kontroll', 'Restart and checks'),
    haPath: '/developer-tools/yaml',
    render(c) {
      const h = c.h, st = c.state, sup = hasSup(h), sv = (d, s) => !!(h.services && h.services[d] && h.services[d][s]);
      const cr = st.check;
      const btn = (a, icon, t, s, cls) => ui.row({ a, icon, title: c.armed(a) ? T('Trykk igjen for å bekrefte', 'Tap again to confirm') : T(t), sub: T(s), cls: cls || '', right: c.isBusy(a) ? '<span class="spn s"></span>' : '' });
      return `${ui.group([
          btn('quick', 'mdi:auto-fix', 'Hurtiglast inn', 'Leser inn YAML-endringer uten å starte på nytt'),
          btn('restart', 'mdi:restart', 'Start Home Assistant på nytt', 'Avbryter alle automasjoner og skript som kjører'),
          sv('homeassistant', 'restart') ? btn('safe', 'mdi:shield-refresh-outline', 'Start på nytt i sikker modus', 'Uten egne integrasjoner og kort') : '',
          sup ? btn('reboot', 'mdi:power-cycle', 'Start systemet på nytt', 'Hele maskinen Home Assistant kjører på', 'danger') : '',
          sup ? btn('shutdown', 'mdi:power', 'Slå av systemet', 'Må slås på igjen manuelt', 'danger') : '',
        ].join(''))}
        ${ui.sec(T('Konfigurasjon', 'Configuration'))}
        <div class="card"><div style="display:flex;align-items:center;gap:12px"><span class="hi ${cr && cr.result === 'valid' ? 'on' : ''}">${ui.ic(cr ? (cr.result === 'valid' ? 'mdi:check-bold' : 'mdi:alert-circle') : 'mdi:file-check-outline', 22)}</span><span class="ht"><b>${esc(cr ? (cr.result === 'valid' ? T('Konfigurasjonen er gyldig', 'Configuration is valid') : T('Konfigurasjonen har feil', 'Configuration has errors')) : T('Sjekk konfigurasjonen', 'Check configuration'))}</b><i>${esc(T('Gjøres også før omstart', 'Also done before restarting'))}</i></span></div>
          ${cr && cr.errors ? `<pre class="pre err" data-noi18n>${esc(cr.errors)}</pre>` : ''}${cr && cr.warnings ? `<pre class="pre" data-noi18n>${esc(cr.warnings)}</pre>` : ''}
          <div class="bts">${ui.btn(T('Sjekk nå', 'Check now'), 'check', null, '', c.isBusy('check') ? '' : 'mdi:play', c.isBusy('check') ? 'disabled' : '')}</div></div>
        ${ui.sec(T('Last inn YAML på nytt', 'Reload YAML'))}
        <div class="chs wrap">${RELOAD.filter(([k]) => { const [d, s] = k.includes(':') ? k.split(':') : [k, 'reload']; return sv(d, s); }).map(([k, t]) => ui.chip(`${c.isBusy('rl' + k) ? '<span class="spn s"></span>' : ui.ic('mdi:reload', 15)}${esc(T(t))}`, false, 'rl', k)).join('')}</div>`;
    },
    act(c, a, el) {
      const st = c.state;
      const check = async () => { const r = await c.api('POST', 'config/core/check_config'); st.check = r; c.render(); return r; };
      const guarded = (key, fn) => { if (!c.confirm(key)) return undefined; return c.busy(key, (async () => { const r = await check(); if (r && r.result !== 'valid') { M.haptic('failure'); c.toast(T('Konfigurasjonen har feil – startet ikke på nytt', 'Configuration has errors – did not restart'), { type: 'error' }); return; } M.haptic('heavy'); await fn(); })().catch((e) => c.err(e))); };
      switch (a) {
        case 'quick': if (!c.confirm('quick')) return undefined; return c.busy('quick', c.call('homeassistant', 'reload_all', {}).then(() => { M.haptic('success'); c.toast(T('Lest inn', 'Reloaded')); }).catch((e) => c.err(e)));
        case 'restart': return guarded('restart', () => c.call('homeassistant', 'restart', {}).catch(() => {}).then(() => c.toast(T('Starter på nytt …', 'Restarting …'), { type: 'busy' })));
        case 'safe': return guarded('safe', () => c.call('homeassistant', 'restart', { safe_mode: true }).catch(() => {}).then(() => c.toast(T('Starter i sikker modus …', 'Restarting in safe mode …'), { type: 'busy' })));
        case 'reboot': if (!c.confirm('reboot')) return undefined; M.haptic('heavy'); return c.call('hassio', 'host_reboot', {}).catch(() => {}).then(() => c.toast(T('Starter systemet på nytt …', 'Rebooting …'), { type: 'busy' }));
        case 'shutdown': if (!c.confirm('shutdown')) return undefined; M.haptic('heavy'); return c.call('hassio', 'host_shutdown', {}).catch(() => {}).then(() => c.toast(T('Slår av …', 'Shutting down …'), { type: 'busy' }));
        case 'check': M.haptic('light'); return c.busy('check', check().then((r) => M.haptic(r.result === 'valid' ? 'success' : 'failure')).catch((e) => c.err(e)));
        case 'rl': { const k = el.dataset.v, [d, s] = k.includes(':') ? k.split(':') : [k, 'reload']; M.haptic('light'); return c.busy('rl' + k, c.call(d, s, {}).then(() => c.toast(T('Lest inn', 'Reloaded'))).catch((e) => c.err(e))); }
        default: return undefined;
      }
    },
  });

  /* ============================================================ generelt */
  const CORE_F = ['location_name', 'latitude', 'longitude', 'elevation', 'unit_system', 'time_zone', 'currency', 'country', 'language', 'internal_url', 'external_url', 'radius'];
  M.ha.page('general', {
    title: () => T('Generelt', 'General'),
    sub: (c) => (c.state.dirty ? T('Ikke lagret', 'Not saved') : ''),
    haPath: '/config/general',
    live: false,
    right: (c) => `<button class="hd" data-a="save" ${c.state.dirty && !c.isBusy('save') ? '' : 'disabled'}>${c.isBusy('save') ? '<span class="spn s"></span>' : esc(T('Lagre', 'Save'))}</button>`,
    render(c) {
      const st = c.state, cf = (c.h && c.h.config) || {};
      if (!st.v) { st.v = {}; CORE_F.forEach((k) => { st.v[k] = k === 'unit_system' ? (cf.unit_system && cf.unit_system.length === 'mi' ? 'us_customary' : 'metric') : cf[k] == null ? '' : cf[k]; }); }
      const v = st.v;
      let tz = []; try { tz = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []; } catch (e) { /* */ }
      return `<div class="hg"><div class="frm">
          ${ui.field({ f: 'location_name', value: v.location_name, label: T('Navn på hjemmet', 'Home name') })}
          ${ui.select({ f: 'unit_system', value: v.unit_system, label: T('Enhetssystem', 'Unit system'), opts: [['metric', T('Metrisk', 'Metric')], ['us_customary', T('Amerikansk', 'US customary')]] })}
          <div class="r2">${ui.field({ f: 'currency', value: v.currency, label: T('Valuta', 'Currency'), ph: 'NOK' })}${ui.field({ f: 'country', value: v.country, label: T('Land', 'Country'), ph: 'NO' })}</div>
          <div class="r2">${ui.field({ f: 'time_zone', value: v.time_zone, label: T('Tidssone', 'Time zone'), list: 'ha-tz' })}${ui.field({ f: 'language', value: v.language, label: T('Språk (HA)', 'Language (HA)'), ph: 'nb' })}</div>
        </div></div>
        ${ui.sec(T('Sted', 'Location'))}<div class="hg"><div class="frm">
          <div class="r2">${ui.field({ f: 'latitude', t: 'num', value: v.latitude, label: T('Breddegrad', 'Latitude'), attrs: 'inputmode="decimal"' })}${ui.field({ f: 'longitude', t: 'num', value: v.longitude, label: T('Lengdegrad', 'Longitude'), attrs: 'inputmode="decimal"' })}</div>
          <div class="r2">${ui.field({ f: 'elevation', t: 'num', value: v.elevation, label: T('Høyde over havet (m)', 'Elevation (m)'), attrs: 'inputmode="numeric"' })}${ui.field({ f: 'radius', t: 'num', value: v.radius, label: T('Radius hjem (m)', 'Home radius (m)'), attrs: 'inputmode="numeric"' })}</div>
          <div class="bts">${ui.btn(T('Bruk posisjonen min', 'Use my location'), 'gps', null, 'sm', 'mdi:crosshairs-gps')}</div>
        </div></div>
        ${ui.sec(T('Adresser', 'URLs'))}<div class="hg"><div class="frm">
          ${ui.field({ f: 'internal_url', value: v.internal_url, label: T('Lokal adresse', 'Local URL'), ph: 'http://homeassistant.local:8123', mono: true })}
          ${ui.field({ f: 'external_url', value: v.external_url, label: T('Ekstern adresse', 'External URL'), ph: 'https://…', mono: true })}
        </div></div>
        <datalist id="ha-tz">${tz.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
    },
    input(c, el, v) {
      const st = c.state, f = el.dataset.f;
      st.v[f] = el.dataset.t === 'num' ? (v === '' ? '' : Number(String(v).replace(',', '.'))) : v;
      st.dirty = true;
      const hd = M.ha.current.root.querySelector('.hh .hd'); if (hd) hd.disabled = false;
    },
    act(c, a) {
      const st = c.state;
      if (a === 'gps') {
        if (!navigator.geolocation) return c.toast(T('Posisjon er ikke tilgjengelig', 'Location is not available'), { type: 'error' });
        return navigator.geolocation.getCurrentPosition((p) => { st.v.latitude = +p.coords.latitude.toFixed(5); st.v.longitude = +p.coords.longitude.toFixed(5); st.dirty = true; M.haptic('success'); c.render(); }, () => c.toast(T('Fikk ikke posisjonen', 'Could not get the location'), { type: 'error' }));
      }
      if (a === 'save') {
        const cf = c.h.config || {}, out = {};
        CORE_F.forEach((k) => { const v = st.v[k]; const old = k === 'unit_system' ? (cf.unit_system && cf.unit_system.length === 'mi' ? 'us_customary' : 'metric') : cf[k]; if (String(v == null ? '' : v) !== String(old == null ? '' : old)) out[k] = v === '' ? null : v; });
        if (!Object.keys(out).length) { st.dirty = false; return c.render(); }
        return c.busy('save', c.ws('config/core/update', out)).then(() => { st.dirty = false; M.haptic('success'); c.toast(T('Lagret', 'Saved')); c.render(); }).catch((e) => c.err(e, T('Kunne ikke lagre', 'Could not save')));
      }
      return undefined;
    },
  });

  /* ============================================================ om */
  M.ha.page('about', {
    title: () => T('Om', 'About'),
    haPath: '/config/info',
    async load(c) {
      if (!hasSup(c.h)) return;
      const g = (p) => c.ws('supervisor/api', { endpoint: p, method: 'get' }).catch(() => null);
      const [sup, os, host, core] = await Promise.all([g('/supervisor/info'), g('/os/info'), g('/host/info'), g('/core/info')]);
      c.state.s = { sup, os, host, core };
    },
    render(c) {
      const h = c.h, cf = (h && h.config) || {}, s = c.state.s || {};
      const kv = (rows) => `<div class="card"><div class="kv">${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => `<span>${esc(T(k))}</span><b data-noi18n>${esc(v)}</b>`).join('')}</div></div>`;
      const disk = s.host && s.host.disk_total ? `${(s.host.disk_used || 0).toFixed(1)} / ${s.host.disk_total.toFixed(1)} GB` : '';
      return `${kv([['Home Assistant', cf.version], ['Supervisor', s.sup && s.sup.version], ['Operativsystem', s.os && s.os.version ? `${s.host && s.host.operating_system ? s.host.operating_system : 'HAOS'} ${s.os.version}` : s.host && s.host.operating_system], ['Maskin', s.core && s.core.machine], ['Hovedkort', s.os && s.os.board], ['Disk', disk], ['Tidssone', cf.time_zone], ['Integrasjoner', String(arr(cf.components).filter((x) => !x.includes('.')).length)], ['Konfigurasjon', cf.config_dir], ['KI MSH', window.KI_MSH_VERSION]])}
        ${ui.group([
          ui.row({ a: 'ext', v: '/config/info', icon: 'mdi:information-outline', title: T('Full systeminfo i Home Assistant', 'Full system info in Home Assistant'), ext: true }),
          ui.row({ a: 'ext', v: '/config/hardware', icon: 'mdi:memory', title: T('Maskinvare', 'Hardware'), ext: true }),
        ].join(''))}`;
    },
  });

  M.ha.sysPages = true;
})();
