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

  /* ------------------------------------------------------------ #settings-popupens kort */
  class Settings extends M.Card {
    static get cardName() { return 'Innstillinger'; }
    static get schema() { return [{ type: 'info', label: 'Snarveier til dashbord-editorene og Home Assistant-innstillingene.' }]; }
    get cardSize() { return 4; }
    render() {
      const u = this.hass.user || {};
      const row = (act, icon, label, sub, extra = '') => `<button class="r press" data-act="${act}" ${extra}><span class="ic">${M.icon(icon, 22)}</span><span class="tx"><b>${M.esc(label)}</b><i>${M.esc(sub)}</i></span>${M.icon('chevron_right', 22, 'color:#7f7f7f')}</button>`;
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
        <div class="who">${M.esc(u.name || '')} · innstillingene gjelder for deg, på alle enhetene dine</div>
      </div>`;
    }
    onAction(name, el, ev) {
      if (name === 'ed') return M.openDashEditor({ editor: el.dataset.e });
      if (name === 'nav') return M.navigate(el.dataset.path);
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `.st{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .grp{border-radius:28px;background:var(--gray200,#3a3a3a);overflow:hidden}
        .r{width:100%;display:flex;align-items:center;gap:14px;min-height:66px;padding:8px 16px;text-align:left}
        .r+.r{border-top:1px solid rgba(255,255,255,.06)}
        .ic{width:44px;height:44px;border-radius:22px;background:var(--gray300,#404040);display:grid;place-items:center;flex:none}
        .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.tx b{font-size:15px;font-weight:500}.tx i{font-style:normal;font-size:12px;color:var(--gray700,#979797)}
        .who{font-size:12px;color:var(--gray600,#7f7f7f);padding:4px 6px}`;
    }
  }
  M.define('msh-settings-card', Settings, 'MSH Innstillinger', 'Innhold i #settings-popupen: snarveier til Tilpass Hjem/navbar/header og HA-innstillinger.');
})();
