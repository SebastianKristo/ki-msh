/* KI MSH · hendelsesbuss for dashbord-editorene.
 *   window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home'|'navbar'|'header'|'room', area, focus } }))
 * Finner kortet som er i bruk (også inni lukkede Bubble-popups), ellers lages en frakoblet instans med
 * strategiens card_id – editoren lagrer uansett i ki-store, så den virker selv om kortet ikke er rendret.
 * Arket rendres i ki-overlay-root (document.body, z-index 9000) via MSH.overlay.
 */
(function () {
  const M = window.MSH;
  if (!M || M.__editorBus) return;
  M.__editorBus = true;

  M.lastHass = M.lastHass || null;
  const liveOf = (tag, pred) => {
    for (const set of (M.liveCards || new Map()).values()) for (const c of set) if (c.localName === tag && c.isConnected && (!pred || pred(c))) return c;
    return null;
  };
  M.liveOf = liveOf;
  const hassNow = () => {
    if (M.lastHass) return M.lastHass;
    const ha = document.querySelector('home-assistant');
    return ha && ha.hass;
  };
  const detached = (tag, cfg) => {
    if (!customElements.get(tag)) return null;
    const el = document.createElement(tag);
    el.setConfig({ type: 'custom:' + tag, ...cfg });
    el.hass = hassNow();
    return el;
  };
  // Standard card_id-er (samme som strategien bruker)
  M.CARD_IDS = { home: 'ki-home', navbar: 'ki-navbar', header: 'ki-home-header', prosa: 'ki-home-prosa', faner: 'ki-home-faner', soppel: 'ki-home-soppel', strom: 'ki-home-strom', gjoremal: 'ki-home-gjoremal', room: (a) => 'room-' + a };

  M.openDashEditor = function ({ editor, area, focus } = {}) {
    let card = null;
    switch (editor) {
      case 'home': {
        if (M.openHomeEditor) return M.openHomeEditor({ focus });
        card = liveOf('msh-hjem-card') || detached('msh-hjem-card', { card_id: M.CARD_IDS.home });
        break;
      }
      case 'navbar':
        card = liveOf('msh-navbar-card') || detached('msh-navbar-card', { card_id: M.CARD_IDS.navbar });
        break;
      case 'header':
        card = liveOf('msh-hjem-header-card') || detached('msh-hjem-header-card', { card_id: M.CARD_IDS.header });
        break;
      case 'room': {
        const a = area || (location.hash || '').replace(/^#/, '');
        if (!a) return null;
        card = liveOf('msh-rom-card', (c) => M.roomArea(c) === a) || detached('msh-rom-card', { card_id: M.CARD_IDS.room(a), area: a });
        break;
      }
      default:
        return null;
    }
    return card ? card.customize(focus) : null;
  };
  window.addEventListener('ki-open-editor', (e) => {
    const d = (e && e.detail) || {};
    M.haptic('light');
    M.openDashEditor(d);
  });
  // Tannhjulet i klima-toppkortet → «Tilpass rom» via bussen
  M.roomCustomize = function (area, section) {
    M.openDashEditor({ editor: 'room', area, focus: section });
    return true;
  };

  /* ------------------------------------------------------------ oppsett per enhet */
  // Øverst i hver «Tilpass …»-meny: «Denne enheten · Alle enheter». Endrer MSH.store.scope og sender 'scope-change'.
  // Har enheten eget oppsett: chip «Eget oppsett», «Bruk felles oppsett» (bekreft) og «Kopier til alle».
  const SCOPE_CSS = `:host{display:block;margin:0 0 12px}
    .seg{display:flex;padding:4px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));gap:4px}
    .seg button{flex:1;height:36px;border-radius:18px;font-size:14px;font-weight:500;color:var(--ki-text-2, var(--gray800,#afafaf));transition:background .2s,color .2s}
    .seg button.on{background:var(--ki-pill-bg, var(--gray1000,#e1e1e1));color:var(--ki-pill-fg, var(--gray000,#232323))}
    .sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 4px 0;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
    .sub .who{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chip{height:22px;padding:0 9px;border-radius:11px;background:rgb(115 185 242);color:#1f2a36;font-size:11px;font-weight:600;display:inline-flex;align-items:center}
    .act{display:flex;gap:6px;margin:8px 0 0}
    .act button{height:32px;padding:0 12px;border-radius:16px;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, var(--white,#fafafa));font-size:13px;font-weight:500}
    .act button.warn{background:rgba(242,128,115,.18);color:var(--ki-red-text, var(--red,#f28073))}`;
  class ScopeBar extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this.shadowRoot.addEventListener('click', (e) => this._click(e)); }
    connectedCallback() { this._off = M.store && M.store.subscribe(() => this._render()); this._render(); }
    disconnectedCallback() { if (this._off) this._off(); clearTimeout(this._ct); }
    // storeKey (ett kort) eller storeKeys (Tilpass Hjem: flere kort + popups)
    _keys() { return [].concat(this.storeKeys || this.storeKey || []).filter(Boolean); }
    _render() {
      const S = M.store; if (!S) return;
      const dev = S.scope === 'device', own = this._keys().some((k) => S.hasOwn(k)), u = (this.hass && this.hass.user && this.hass.user.name) || '';
      const who = `For ${u ? M.esc(u) + ' · ' : ''}${dev ? M.esc(S.deviceName) : 'alle enheter'}`;
      const hint = dev ? `Lagres for ${M.esc(S.deviceName)}` : 'Gjelder alle enheter uten eget oppsett';
      this.shadowRoot.innerHTML = `<style>${M.BASE_CSS}${SCOPE_CSS}</style>
        <div class="seg" role="tablist"><button class="${dev ? 'on' : ''}" data-s="device">Denne enheten</button><button class="${dev ? '' : 'on'}" data-s="shared">Alle enheter</button></div>
        <div class="sub"><span class="who" title="${hint}">${this.noWho ? hint : who + ' · ' + hint}</span>${own ? '<span class="chip">Eget oppsett</span>' : ''}</div>
        ${own ? `<div class="act"><button class="warn" data-a="clear">${this._confirm ? 'Trykk igjen for å bekrefte' : 'Bruk felles oppsett'}</button><button data-a="copy">Kopier til alle</button></div>` : ''}`;
    }
    async _click(e) {
      const b = e.composedPath().find((n) => n.dataset && (n.dataset.s || n.dataset.a));
      if (!b || !M.store) return;
      const S = M.store;
      if (b.dataset.s) {
        if (S.scope === b.dataset.s) return;
        M.haptic('selection'); S.scope = b.dataset.s; this._render();
        this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: S.scope } }));
        return;
      }
      if (b.dataset.a === 'clear') {
        if (!this._confirm) { M.haptic('light'); this._confirm = true; this._render(); clearTimeout(this._ct); this._ct = setTimeout(() => { this._confirm = false; this._render(); }, 3500); return; }
        this._confirm = false;
        const rs = await Promise.all(this._keys().filter((k) => S.hasOwn(k)).map((k) => S.clearOwn(k))), r = rs.find((x) => x && x.ok === false) || rs[0];
        M.haptic(r && r.ok === false ? 'failure' : 'success'); M.toast(r && r.ok === false ? 'Kunne ikke lagre' : 'Bruker felles oppsett');
      } else if (b.dataset.a === 'copy') {
        let r;
        for (const k of this._keys()) if (S.hasOwn(k)) r = await S.copyToAll(k); // etter hverandre: copyToAll leser data
        M.haptic(r && r.ok === false ? 'failure' : 'success'); M.toast(r && r.ok === false ? 'Kunne ikke lagre' : 'Kopiert til alle enheter');
      }
      this._render();
      this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: S.scope } }));
    }
  }
  if (!customElements.get('msh-scope-bar')) customElements.define('msh-scope-bar', ScopeBar);

  /* ------------------------------------------------------------ #settings-popupens kort */
  class Settings extends M.Card {
    static get cardName() { return 'Innstillinger'; }
    static get schema() { return [{ type: 'info', label: 'Snarveier til dashbord-editorene og Home Assistant-innstillingene.' }]; }
    get cardSize() { return 4; }
    render() {
      // Fiks 35 (oppfølging 33.3): view: 'devices' = bare enhetsoversikten – vises i «Enheter»-arket fra Mer → Tilpass
      if (this.config.view === 'devices') return `<div class="st">${this._devices()}</div>`;
      const u = this.hass.user || {};
      const row = (act, icon, label, sub, extra = '') => `<button class="r press" data-act="${act}" ${extra}><span class="ic">${M.icon(icon, 22)}</span><span class="tx"><b>${M.esc(label)}</b><i>${M.esc(sub)}</i></span>${M.icon('chevron_right', 22, 'color:var(--ki-text-3, #7f7f7f)')}</button>`;
      return `<div class="st">
        <div class="grp">
          ${row('ed', 'mdi:view-dashboard-edit', 'Tilpass Hjem', 'Kort, faner, popups og tekst', 'data-e="home"')}
          ${row('ed', 'mdi:dock-bottom', 'Tilpass navbar', 'Knapper, merker og stil', 'data-e="navbar"')}
          ${row('ed', 'mdi:page-layout-header', 'Tilpass header', 'Hilsen, personer og soner', 'data-e="header"')}
        </div>
        <div class="grp">
          ${row('nav', 'mdi:cog', 'Home Assistant', 'Innstillinger', 'data-path="/config"')}
          ${row('nav', 'mdi:texture-box', 'Områder og etasjer', 'Nye rom gir nye popups automatisk', 'data-path="/config/areas/dashboard"')}
        </div>
        ${M.store ? `<div class="gh">Utseende</div><div class="grp"><button class="r press" data-act="glass" role="switch" aria-checked="${M.glassOn()}"><span class="ic">${M.icon('mdi:blur', 22)}</span><span class="tx"><b>Liquid Glass-tema</b><i>Frosted glass i alle Tilpass-ark</i></span><span class="trk ${M.glassOn() ? 'on' : ''}"><i></i></span></button></div>` : ''}
        ${this._devices()}
        <div class="who">${M.esc(u.name || '')} · innstillingene gjelder for deg på alle enhetene dine${M.store ? ' · denne enheten: ' + M.esc(M.store.deviceName) : ''}</div>
      </div>`;
    }
    // Innstillinger → Enheter: enheter med eget oppsett for Kamera/Person (navn, sist sett, antall kort) – gi nytt navn, nullstill, slett.
    // Alle andre kort har én felles config.
    _devices() {
      if (!M.store) return '';
      this.s('zone.__msh_devices');
      const list = M.store.devices().filter((d) => d.own > 0), ed = this.ui.devEdit, cf = this.ui.devConfirm || '';
      if (!list.length) return `<div class="gh">Enheter</div><div class="grp"><div class="r dv"><span class="ic">${M.icon('mdi:devices', 22)}</span><span class="tx"><b>Ingen enheter med eget oppsett</b><i>Kamera og Person kan ha eget oppsett per enhet. Alt annet er felles.</i></span></div></div>`;
      const rows = list.map((d) => {
        const seen = d.current ? 'denne enheten' : d.seen ? M.relTime(new Date(d.seen).toISOString()) : 'aldri sett';
        const own = d.own ? `${d.own} ${d.own === 1 ? 'kort' : 'kort'} med eget oppsett` : 'følger felles oppsett';
        if (ed === d.id) return `<div class="r dv" data-key="dv-${M.esc(d.id)}"><span class="ic">${M.icon('mdi:rename', 22)}</span><form class="tx" data-act="devname" data-id="${M.esc(d.id)}"><input data-input="devname" value="${M.esc(d.name)}" aria-label="Enhetsnavn" autofocus></form><button class="sm" data-act="devname" data-id="${M.esc(d.id)}">Lagre</button></div>`;
        return `<div class="r dv" data-key="dv-${M.esc(d.id)}"><span class="ic">${M.icon(/iphone|android-tel/i.test(d.name) ? 'mdi:cellphone' : /ipad|nettbrett/i.test(d.name) ? 'mdi:tablet' : 'mdi:monitor', 22)}</span>
          <span class="tx"><b>${M.esc(d.name)}${d.current ? ' <em>denne</em>' : ''}</b><i>${M.esc(seen)} · ${M.esc(own)}</i></span>
          <span class="dva">
            <button class="sm" data-act="devren" data-id="${M.esc(d.id)}" aria-label="Gi nytt navn">${M.icon('mdi:pencil', 18)}</button>
            ${d.own ? `<button class="sm ${cf === 'r' + d.id ? 'warn' : ''}" data-act="devreset" data-id="${M.esc(d.id)}" aria-label="Nullstill">${cf === 'r' + d.id ? 'Nullstill?' : M.icon('mdi:backup-restore', 18)}</button>` : ''}
            ${d.current ? '' : `<button class="sm ${cf === 'd' + d.id ? 'warn' : ''}" data-act="devdel" data-id="${M.esc(d.id)}" aria-label="Slett">${cf === 'd' + d.id ? 'Slett?' : M.icon('mdi:delete-outline', 18)}</button>`}
          </span></div>`;
      }).join('');
      return `<div class="gh">Enheter</div><div class="grp">${rows}</div>`;
    }
    onInput(name, el) { if (name === 'devname') this._devName = el.value; }
    connectedCallback() { super.connectedCallback(); if (M.store && !this._devOff) this._devOff = M.store.subscribe((d, p) => { if (!p || /^(devices|theme)(\.|$)/.test(String(p))) this.update(); }); }
    disconnectedCallback() { super.disconnectedCallback(); if (this._devOff) { this._devOff(); this._devOff = null; } }
    async _devAct(name, id) {
      const S = M.store;
      if (name === 'devren') { this._devName = null; return this.setUI({ devEdit: id, devConfirm: null }); }
      if (name === 'devname') {
        const v = (this._devName != null ? this._devName : (this.shadowRoot.querySelector('[data-input="devname"]') || {}).value || '').trim();
        this.setUI({ devEdit: null });
        const r = await S.setDeviceName(v, id);
        return M.haptic(r && r.ok === false ? 'failure' : 'success');
      }
      const tag = (name === 'devreset' ? 'r' : 'd') + id;
      if (this.ui.devConfirm !== tag) { this.setUI({ devConfirm: tag }); clearTimeout(this._dct); this._dct = setTimeout(() => this.setUI({ devConfirm: null }), 3500); return; }
      this.setUI({ devConfirm: null });
      let r;
      if (name === 'devdel') r = await S.removeDevice(id);
      else { const d = S.get('devices.' + id) || {}; const keep = {}; if (d.name) keep.name = d.name; if (d.seen) keep.seen = d.seen; r = await S.set('devices.' + id, keep, { immediate: true }); }
      M.haptic(r && r.ok === false ? 'failure' : 'success');
      M.toast(r && r.ok === false ? 'Kunne ikke lagre' : name === 'devdel' ? 'Enheten er slettet' : 'Enheten følger felles oppsett');
    }
    onAction(name, el, ev) {
      if (name === 'ed') return M.openDashEditor({ editor: el.dataset.e });
      if (name === 'glass') { M.setGlassTheme(!M.glassOn()); return this.update(); } // ki-store theme.liquid_glass (per bruker)
      if (/^dev/.test(name)) return this._devAct(name, el.dataset.id);
      if (name === 'nav') return M.navigate(el.dataset.path);
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `.st{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .grp{border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));overflow:hidden}
        .r{width:100%;display:flex;align-items:center;gap:14px;min-height:66px;padding:8px 16px;text-align:left}
        .r+.r{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .ic{width:44px;height:44px;border-radius:22px;background:var(--ki-surface-2, var(--gray300,#404040));display:grid;place-items:center;flex:none}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.tx b{font-size:15px;font-weight:500}.tx i{font-style:normal;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .who{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));padding:4px 6px}
        .gh{font-size:13px;font-weight:500;color:var(--ki-text-mid, var(--gray700,#979797));padding:8px 8px 0}
        .dv{cursor:default}.tx em{font-style:normal;font-size:11px;font-weight:600;padding:2px 7px;border-radius:9px;background:rgb(115 185 242);color:#1f2a36;margin-left:6px;vertical-align:1px}
        .dva{display:flex;gap:6px;flex:none}
        .sm{min-width:36px;height:36px;padding:0 10px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:500}
        .trk{position:relative;width:50px;height:30px;border-radius:15px;flex:none;background:var(--ki-ctrl, var(--gray400,#545454));transition:background .2s}
        .trk.on{background:${M.SWITCH_ON || 'var(--pink,#f285c9)'}} /* Fiks 26: rosa brytere */
        .trk i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:var(--ki-knob, #fafafa);transition:left .2s}
        .trk.on i{left:23px}
        .sm.warn{background:rgba(242,128,115,.18);color:var(--ki-red-text, var(--red,#f28073))}
        form.tx input{height:40px;border-radius:14px;background:var(--ki-surface-2, var(--gray300,#404040));padding:0 12px;font-size:15px;width:100%}`;
    }
  }
  M.define('msh-settings-card', Settings, 'MSH Innstillinger', 'Innhold i #settings-popupen: snarveier til Tilpass Hjem/navbar/header og HA-innstillinger.');
})();
