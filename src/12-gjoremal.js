/* msh-gjoremal-card · Gjøremål-popup (#gjoremal). Kilde: Gjøremål.dc.html.
 * Faner = todo.*-lister (alle, eller config.entities; exclude/include som ellers). Data via
 * hass.connection.subscribeMessage({type:'todo/item/subscribe'}) kun mens popupen er åpen (fallback todo/item/list).
 * Legg til: todo.add_item · fullfør/gjenåpne: todo.update_item (status) · slett: todo.remove_item.
 * Prioritet finnes ikke i HA: lagres som prefiks i beskrivelsen – «[h] …», «[m] …», «[l] …» (Høy/Medium/Lav).
 * Mangler prefiks (eller listen støtter ikke beskrivelse) → «Medium». Resten av beskrivelsen vises som «hvem».
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const PR = { h: ['Høy', C.red], m: ['Medium', C.orange], l: ['Lav', C.blue] };
  const ORD = { h: 0, m: 1, l: 2 };
  const F_DESC = 64, F_CREATE = 1, F_DELETE = 2, F_UPDATE = 4; // TodoListEntityFeature
  const parse = (it) => {
    const d = String((it && it.description) || '');
    const m = /^\s*\[(h|m|l)\]\s*/i.exec(d);
    return { prio: m ? m[1].toLowerCase() : 'm', who: (m ? d.slice(m[0].length) : d).trim() };
  };
  const dueTxt = (due) => {
    if (!due) return '';
    const d = new Date(due.length <= 10 ? due + 'T00:00:00' : due);
    if (isNaN(d)) return '';
    const t = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
    return 'Frist ' + t + (due.length > 10 ? ' ' + M.pad(d.getHours()) + ':' + M.pad(d.getMinutes()) : '');
  };

  class Gjoremal extends M.Card {
    static get cardName() { return 'Gjøremål'; }
    static get defaults() { return { filter: 'open', priority: true, show_who: true }; }
    static get schema() {
      return [
        { type: 'entities', name: 'entities', label: 'Lister i rekkefølge (tomt = alle todo.*)', domain: 'todo' },
        { type: 'lists', label: 'Vis / skjul lister', lists: (h) => [{ key: 'lister', label: 'Gjøremålslister', ids: M.all(h, 'todo'), domains: ['todo'] }] },
        { type: 'section', label: 'Visning', icon: 'mdi:format-list-checks', fields: [
          { type: 'select', name: 'filter', label: 'Standardfilter', options: [['open', 'Åpne'], ['high', 'Høy'], ['done', 'Fullført'], ['all', 'Alle']], default: 'open' },
          { type: 'boolean', name: 'priority', label: 'Prioritet Høy/Medium/Lav', help: 'Lagres som [h]/[m]/[l] først i oppgavens beskrivelse (krever at listen støtter beskrivelse).', default: true },
          { type: 'boolean', name: 'show_who', label: 'Vis beskrivelse («hvem») og frist', default: true },
          { type: 'gap' },
        ] },
      ];
    }
    get cardSize() { return 8; }

    _lists() {
      const c = this.config, h = this.hass;
      const base = Array.isArray(c.entities) && c.entities.length ? c.entities.filter((id) => h.states[id]) : M.all(h, 'todo');
      return M.applyLists(c, 'lister', base);
    }
    onOpen() { this._schedule(true); }
    onClose() { this._unsub(); }
    disconnectedCallback() { super.disconnectedCallback(); this._unsub(); }

    // Abonner på aktiv liste (kun mens popupen er åpen).
    _sub(id) {
      if (this._subId === id) return;
      this._unsub();
      this._subId = id;
      this._items = null;
      if (!id || !this.hass) return;
      const conn = this.hass.connection;
      const cb = (m) => { if (this._subId !== id) return; this._items = (m && m.items) || []; this.update(); };
      if (conn && conn.subscribeMessage) {
        let p;
        try { p = conn.subscribeMessage(cb, { type: 'todo/item/subscribe', entity_id: id }); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then((u) => { if (this._subId !== id) { try { u && u(); } catch (e) { /* */ } } else this._unsubFn = u; }).catch(() => this._list(id));
      } else this._list(id);
    }
    _list(id) {
      this.hass.callWS({ type: 'todo/item/list', entity_id: id })
        .then((r) => { if (this._subId === id) { this._items = (r && r.items) || []; this.update(); } })
        .catch(() => { if (this._subId === id) { this._items = []; this.update(); } });
    }
    _unsub() {
      if (this._unsubFn) { try { const r = this._unsubFn(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* */ } }
      this._unsubFn = null;
      this._subId = null;
    }

    render() {
      const c = this.config, ui = this.ui, lists = this._lists();
      if (!lists.length) return M.emptyState('Fant ingen gjøremålslister (todo.*)', 'entities');
      const tab = lists.includes(ui.tab) ? ui.tab : lists[0];
      const st = this.s(tab);
      if (this.isOpen) this._sub(tab);
      const feat = Number((st && st.attributes.supported_features) || 0);
      const canDesc = c.priority !== false && !!(feat & F_DESC);
      const items = (this._items || []).map((it, i) => ({ ...it, ...parse(it), i, done: it.status === 'completed' }));
      const loaded = this._items != null;
      const done = items.filter((x) => x.done).length, open = items.length - done;
      const filter = ui.filter || c.filter || 'open';
      const shown = items.filter((x) => filter === 'all' || (filter === 'open' ? !x.done : filter === 'done' ? x.done : x.prio === 'h' && !x.done))
        .sort((p, q) => (p.done - q.done) || (c.priority !== false ? ORD[p.prio] - ORD[q.prio] : 0) || p.i - q.i);
      const prio = ui.prio || 'm';
      const tag = (p) => `font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;background:${M.alpha(PR[p][1], 0.18)};color:${PR[p][1]};white-space:nowrap`;
      const headline = !loaded ? '–' : open ? `${open} gjenstår` : 'Alt er gjort';
      const subline = !loaded ? (this.isOpen ? 'Henter oppgaver …' : '–') : `${items.length} oppgaver · ${done} fullført`;
      const pct = loaded && items.length ? (done / items.length) * 100 : 0;
      const cols = lists.length <= 3 ? `grid-template-columns:repeat(${lists.length},minmax(0,1fr))` : 'grid-auto-flow:column;grid-auto-columns:minmax(130px,1fr);overflow-x:auto';
      const tabs = lists.map((id) => {
        const act = id === tab, s = this.s(id);
        const n = act && loaded ? open : s && M.isNum(s.state) ? Number(s.state) : '–';
        return `<button class="tab press ${act ? 'on' : ''}" data-key="${esc(id)}" data-act="tab" data-id="${esc(id)}" data-haptic="selection" data-ent="${esc(id)}"><span class="ell">${esc(M.name(this.hass, id))}</span><span class="cnt num">${esc(n)}</span></button>`;
      }).join('');
      const rows = shown.map((x, i) => {
        const meta = [x.done ? 'Fullført' : '', c.show_who !== false ? x.who : '', c.show_who !== false ? dueTxt(x.due) : ''].filter(Boolean).join(' · ');
        return `<div class="it ${x.done ? 'done' : ''}" data-key="${esc(x.uid)}" style="border-top:${i ? '1px solid rgba(255,255,255,0.05)' : 'none'}">
          <button class="box" data-act="check" data-uid="${esc(x.uid)}" data-haptic="success" title="${x.done ? 'Marker som ikke fullført' : 'Fullfør'}">${M.icon('check', 18, 'color:#282828')}</button>
          <div class="tx">
            <span class="t">${esc(x.summary)}</span>
            ${c.priority !== false || meta ? `<div class="mt">${c.priority !== false ? `<button class="pt" ${canDesc ? `data-act="cycle" data-uid="${esc(x.uid)}" data-haptic="selection" title="Bytt prioritet"` : 'disabled'} style="${tag(x.prio)}">${PR[x.prio][0]}</button>` : ''}${meta ? `<span class="who">${esc(meta)}</span>` : ''}</div>` : ''}
          </div>
          ${feat & F_DELETE ? `<button class="rm" data-act="remove" data-uid="${esc(x.uid)}" title="Slett">${M.icon('close', 18)}</button>` : ''}
        </div>`;
      }).join('');
      return `<div class="wrap">
        <section class="head">
          <div class="hl">${esc(headline)}</div>
          <div class="sl">${esc(subline)}</div>
          <div class="prog"><div style="width:${pct}%"></div></div>
        </section>
        <div class="tabs noscroll" style="${cols}">${tabs}</div>
        ${feat & F_CREATE || !st ? `<form class="add" data-act="add" data-haptic="off">
          ${M.icon('add', 20, 'color:var(--gray500,#696969)')}
          <input data-input="draft" placeholder="Ny oppgave" enterkeyhint="done" autocomplete="off">
          ${canDesc ? `<button type="button" class="dp press" data-act="prio" data-haptic="selection" style="${tag(prio)};height:32px;padding:0 12px;border-radius:16px;font-size:12px">${PR[prio][0]}</button>` : ''}
        </form>` : ''}
        <div class="flt">${[['open', 'Åpne'], ['high', 'Høy'], ['done', 'Fullført'], ['all', 'Alle']].map(([k, l]) => `<button class="f press ${filter === k ? 'on' : ''}" data-act="filter" data-v="${k}" data-haptic="selection">${l}</button>`).join('')}</div>
        <section class="list">
          ${rows}
          ${loaded && !shown.length ? '<div class="none">Ingen oppgaver her</div>' : ''}
          ${!loaded ? `<div class="none">${this.isOpen ? 'Henter …' : '–'}</div>` : ''}
        </section>
      </div>`;
    }

    _upd(uid, f) { if (this._items) { this._items = this._items.map((x) => (x.uid === uid ? { ...x, ...f(x) } : x)); this.update(); } }

    onAction(name, el, ev) {
      const h = this.hass, lists = this._lists(), tab = lists.includes(this.ui.tab) ? this.ui.tab : lists[0];
      const it = el.dataset.uid && this._items ? this._items.find((x) => x.uid === el.dataset.uid) : null;
      switch (name) {
        case 'tab': return this.setUI({ tab: el.dataset.id });
        case 'filter': return this.setUI({ filter: el.dataset.v });
        case 'prio': return this.setUI({ prio: { l: 'm', m: 'h', h: 'l' }[this.ui.prio || 'm'] });
        case 'add': {
          if (!ev || ev.type !== 'submit') return undefined; // klikk inni skjemaet (f.eks. i feltet) er ikke «legg til»
          const inp = this.shadowRoot.querySelector('input[data-input="draft"]');
          const t = inp ? inp.value.trim() : '';
          if (!t || !tab) return undefined;
          M.haptic('success');
          const feat = Number((h.states[tab] && h.states[tab].attributes.supported_features) || 0);
          const data = { entity_id: tab, item: t };
          const p = this.ui.prio || 'm';
          if (this.config.priority !== false && feat & F_DESC) data.description = `[${p}]`;
          inp.value = '';
          if (this._items) this._items = [{ uid: '__new' + Date.now(), summary: t, status: 'needs_action', description: data.description }, ...this._items];
          this.setUI({ filter: 'open' });
          return M.call(h, 'todo', 'add_item', data).catch(() => {});
        }
        case 'check': {
          if (!it) return undefined;
          const status = it.status === 'completed' ? 'needs_action' : 'completed';
          this._upd(it.uid, () => ({ status }));
          return M.call(h, 'todo', 'update_item', { entity_id: tab, item: it.uid, status }).catch(() => {});
        }
        case 'cycle': {
          if (!it) return undefined;
          const p = parse(it), np = { l: 'm', m: 'h', h: 'l' }[p.prio];
          const description = `[${np}]${p.who ? ' ' + p.who : ''}`;
          this._upd(it.uid, () => ({ description }));
          return M.call(h, 'todo', 'update_item', { entity_id: tab, item: it.uid, description }).catch(() => {});
        }
        case 'remove': {
          if (!it) return undefined;
          if (this._items) { this._items = this._items.filter((x) => x.uid !== it.uid); this.update(); }
          return M.call(h, 'todo', 'remove_item', { entity_id: tab, item: [it.uid] }).catch(() => {});
        }
        default:
      }
      return super.onAction(name, el, ev);
    }

    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,20px)}
        .head{display:flex;flex-direction:column;gap:6px;padding:0 4px}
        .hl{font-size:24px;font-weight:500;letter-spacing:-0.015em}
        .sl{font-size:14px;color:var(--gray600,#7f7f7f)}
        .prog{height:6px;border-radius:3px;background:var(--gray200,#3a3a3a);overflow:hidden;margin-top:8px}
        .prog>div{height:100%;border-radius:3px;background:${C.green};transition:width .4s}
        .tabs{display:grid;gap:2px;padding:4px;border-radius:20px;background:var(--gray200,#3a3a3a)}
        .tab{height:40px;min-width:0;padding:0 10px;border-radius:16px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500;background:transparent;color:var(--gray700,#979797);transition:background .25s,color .25s}
        .tab.on{background:${C.accent};color:var(--gray200,#3a3a3a)}
        .cnt{min-width:20px;height:20px;padding:0 5px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:600;background:var(--gray300,#404040);flex:none}
        .tab.on .cnt{background:rgba(42,23,32,0.14)}
        .add{display:flex;align-items:center;gap:10px;height:52px;padding:0 8px 0 16px;border-radius:26px;background:var(--gray200,#3a3a3a);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05)}
        .add input{flex:1;min-width:0;height:100%;font-size:14px}
        .dp{flex:none}
        .flt{display:flex;gap:6px;flex-wrap:wrap}
        .f{height:32px;padding:0 13px;border-radius:16px;font-size:12px;font-weight:500;background:var(--gray200,#3a3a3a);color:var(--gray800,#afafaf);transition:background .2s,color .2s}
        .f.on{background:var(--white,#fafafa);color:#282828}
        .list{display:flex;flex-direction:column}
        .it{display:flex;align-items:flex-start;gap:12px;padding:12px 4px;transition:opacity .2s}
        .it.done{opacity:.55}
        .box{width:26px;height:26px;border-radius:9px;flex:none;margin-top:1px;display:grid;place-items:center;background:transparent;box-shadow:inset 0 0 0 1.5px var(--gray400,#545454);transition:background .2s}
        .box ha-icon{opacity:0;transition:opacity .2s}
        .it.done .box{background:${C.green};box-shadow:none}
        .it.done .box ha-icon{opacity:1}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .t{font-size:14px;line-height:1.4;text-wrap:pretty;overflow-wrap:anywhere}
        .it.done .t{text-decoration:line-through}
        .mt{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .pt[disabled]{cursor:default}
        .who{font-size:11px;color:var(--gray500,#696969)}
        .rm{width:32px;height:32px;border-radius:16px;display:grid;place-items:center;color:var(--gray500,#696969);flex:none}
        .none{padding:30px 0;text-align:center;font-size:14px;color:var(--gray500,#696969)}
      `;
    }
  }
  M.define('msh-gjoremal-card', Gjoremal, 'MSH Gjøremål', 'Alle todo.*-lister som faner: legg til, fullfør, slett, filtre og prioritet ([h]/[m]/[l] i beskrivelsen).');
})();
