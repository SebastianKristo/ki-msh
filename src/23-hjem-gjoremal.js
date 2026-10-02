/* msh-hjem-gjoremal-card · Hjem-visningen, gjøremål-seksjonen. Kilde: Hjem v2.dc.html (L.todo-seksjonen: todos/todoMeta).
 * Data: alle todo.* (entiteter.md «Gjøremål»), elementer via abonnement todo/item/subscribe
 * (fallback: callWS todo/item/list). Avkrysning → todo.update_item. Trykk på rad/overskrift åpner #gjoremal.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const dueText = (d) => {
    if (!d) return '';
    const x = new Date(d), t = new Date();
    if (isNaN(x)) return '';
    const a = new Date(x); a.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
    const n = Math.round((a - t) / 86400000);
    if (n === 0) return 'i dag';
    if (n === 1) return 'i morgen';
    if (n === -1) return 'i går';
    return x.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  };
  class Gjoremal extends M.Card {
    constructor() { super(); this._items = {}; this._subs = {}; this._pending = {}; }
    static get cardName() { return 'Hjem · gjøremål'; }
    static get defaults() { return { title: 'Gjøremål', popup_hash: '#gjoremal', max_items: 6, show_completed: true }; }
    static getConfigElement() { return M.hjemEditorEl ? M.hjemEditorEl(this) : super.getConfigElement(); }
    static get schema() {
      return [
        { type: 'text', name: 'title', label: 'Overskrift', placeholder: 'Gjøremål' },
        { type: 'hash', name: 'popup_hash', label: 'Popup-hash', placeholder: '#gjoremal' },
        { type: 'number', name: 'max_items', label: 'Maks antall rader', min: 1, max: 30, placeholder: '6' },
        { type: 'boolean', name: 'show_completed', label: 'Vis ferdige gjøremål', default: true },
        { type: 'lists', label: 'Gjøremålslister', lists: (h) => [{ key: 'lister', label: 'Lister (todo.*)', ids: M.all(h, 'todo'), domains: ['todo'] }] },
      ];
    }
    get cardSize() { return 4; }
    customize(focus) { return M.hjemCustomize ? M.hjemCustomize(this, focus) : super.customize(focus); }
    _lists() { return this.hass ? M.applyLists(this.config, 'lister', M.all(this.hass, 'todo')) : []; }
    _sync() {
      const h = this.hass;
      if (!h || !this.isConnected) return;
      const want = new Set(this._lists());
      Object.keys(this._subs).forEach((id) => { if (!want.has(id)) { const u = this._subs[id]; delete this._subs[id]; delete this._items[id]; Promise.resolve(u).then((f) => typeof f === 'function' && f()).catch(() => {}); } });
      want.forEach((id) => {
        if (this._subs[id]) return;
        const set = (items) => { this._items[id] = Array.isArray(items) ? items : []; this.update(); };
        if (h.connection && h.connection.subscribeMessage) {
          this._subs[id] = h.connection.subscribeMessage((m) => set(m && m.items), { type: 'todo/item/subscribe', entity_id: id }).catch(() => {
            h.callWS({ type: 'todo/item/list', entity_id: id }).then((r) => set(r && r.items)).catch(() => set([]));
            return null;
          });
        } else {
          this._subs[id] = true;
          h.callWS({ type: 'todo/item/list', entity_id: id }).then((r) => set(r && r.items)).catch(() => set([]));
        }
      });
    }
    connectedCallback() { super.connectedCallback(); setTimeout(() => this._sync(), 0); }
    disconnectedCallback() {
      super.disconnectedCallback();
      Object.values(this._subs).forEach((u) => Promise.resolve(u).then((f) => typeof f === 'function' && f()).catch(() => {}));
      this._subs = {};
    }
    render() {
      const c = this.config, lists = this._lists();
      lists.forEach((id) => this.s(id));
      this._sync();
      const title = c.title || 'Gjøremål';
      const head = (meta) => `<button class="hd" data-act="open"><span class="t">${esc(title)}</span><span class="m">${esc(meta)}</span></button>`;
      if (!lists.length) return `<section class="sec">${head('–')}${M.emptyState('Fant ingen gjøremålslister (todo.*)', 'entities')}</section>`;
      const multi = lists.length > 1;
      let all = [];
      lists.forEach((id) => (this._items[id] || []).forEach((it) => {
        const p = this._pending[id + '|' + it.uid];
        all.push({ ...it, status: p || it.status, list: id });
      }));
      const loaded = lists.some((id) => this._items[id]);
      const done = all.filter((t) => t.status === 'completed').length;
      const open = all.filter((t) => t.status !== 'completed');
      const fin = c.show_completed === false ? [] : all.filter((t) => t.status === 'completed');
      const max = Number(c.max_items) || 6;
      const pool = [...open, ...fin], rows = pool.slice(0, max), more = pool.length - rows.length;
      const meta = loaded ? `${done} av ${all.length} ferdige` : '–';
      const body = rows.map((t, i) => {
        const d = t.status === 'completed';
        const who = dueText(t.due) || (multi ? M.name(this.hass, t.list) : '');
        return `<div class="rw" data-key="${esc(t.list + '|' + t.uid)}" style="border-top:${i ? '1px solid ' + M.theme.whiteA(0.05) : 'none'}">
          <button class="bx press" data-act="check" data-haptic="success" data-list="${esc(t.list)}" data-uid="${esc(t.uid)}" data-s="${d ? 'needs_action' : 'completed'}" aria-label="${d ? 'Merk som ikke ferdig' : 'Merk som ferdig'}" style="background:${d ? C.green : 'transparent'};box-shadow:${d ? 'none' : 'inset 0 0 0 1.5px var(--ki-text-3, var(--gray400,#545454))'}">${M.icon('check', 16, `color:var(--ki-on-accent, #232323);opacity:${d ? 1 : 0};transition:opacity .2s`)}</button>
          <button class="tt" data-act="open" data-ent="${esc(t.list)}"><span class="nm ${d ? 'dn' : ''}">${esc(t.summary || '–')}</span>${who ? `<span class="who">${esc(who)}</span>` : ''}</button>
        </div>`;
      }).join('');
      return `<section class="sec">${head(meta)}
        <div class="lst">${body || `<button class="rw emp" data-act="open">${loaded ? 'Ingen gjøremål' : 'Laster …'}</button>`}
        ${more > 0 ? `<button class="rw emp" data-act="open" style="border-top:1px solid ${M.theme.whiteA(0.05)}">+ ${more} til</button>` : ''}</div></section>`;
    }
    onAction(name, el, ev) {
      if (name === 'open') return M.openPopup(this.config.popup_hash || '#gjoremal');
      if (name === 'check') {
        const d = el.dataset, key = d.list + '|' + d.uid;
        this._pending[key] = d.s;
        this.update();
        M.call(this.hass, 'todo', 'update_item', { entity_id: d.list, item: d.uid, status: d.s })
          .catch(() => {})
          .finally(() => setTimeout(() => { delete this._pending[key]; this.update(); }, 1500));
        return;
      }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .sec{display:flex;flex-direction:column;gap:8px}
        .hd{display:flex;justify-content:space-between;align-items:baseline;padding:0 4px;width:100%;text-align:left;gap:10px}
        .hd .t{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .hd .m{font-size:12px;color:var(--ki-text-lo, var(--gray500,#696969));white-space:nowrap}
        .lst{display:flex;flex-direction:column}
        .rw{display:flex;align-items:center;gap:12px;padding:0 4px;width:100%;text-align:left;min-height:44px}
        .rw.emp{font-size:14px;color:var(--ki-text-lo, var(--gray500,#696969));padding:11px 4px}
        .bx{width:22px;height:22px;border-radius:7px;flex:none;display:grid;place-items:center;transition:background .2s,box-shadow .2s;position:relative}
        .bx::after{content:'';position:absolute;inset:-11px}
        .tt{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:11px 0;text-align:left}
        .nm{flex:1;min-width:0;font-size:14px;color:var(--ki-text, var(--white,#fafafa));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .2s}
        .nm.dn{color:var(--ki-text-lo, var(--gray500,#696969));text-decoration:line-through}
        .who{font-size:12px;color:var(--ki-text-lo, var(--gray500,#696969));white-space:nowrap}
      `;
    }
  }
  M.define('msh-hjem-gjoremal-card', Gjoremal, 'MSH Hjem · gjøremål', 'Gjøremål fra alle todo.*-lister med avkrysning. Trykk åpner #gjoremal.');
})();
