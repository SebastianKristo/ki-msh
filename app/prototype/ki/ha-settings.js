// HA-innstillinger i appen: profil, personer, soner, integrasjoner, automasjoner (GUI + YAML), servere og om.
// Fullskjerm i KI MSH-stil med egen navigasjonsstabel. Åpnes via MSH.navigate('/config/…'), postMessage { kiSettings } eller window.kiSettings.open().
(function () {
  const AND = /android/.test(location.search);
  const PK = 'linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%)';
  const C = { yellow: '#f2d26f', orange: '#f2b573', red: '#f28073', pink: '#f285c9', blue: '#73b9f2', green: '#66d19e', purple: '#ad99e6', teal: '#5fc4c4' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const H = () => window.__H;
  const LS = 'ki-proto-ha';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const DEF = {
    profile: { name: 'Sebastian', lang: 'nb', theme: 'auto', dash: 'ki-dashboard', advanced: true, time: '24', haptics: true, kiosk: false },
    server: 'hjem',
    servers: [{ id: 'hjem', name: 'Hjem', url: 'http://homeassistant.local:8123', ext: 'https://hjem.ui.nabu.casa', ver: '2026.10.2' }, { id: 'hytta', name: 'Hytta', url: 'https://hytta.ui.nabu.casa', ext: '', ver: '2026.9.4' }],
    zones: [
      { id: 'home', name: 'Hjem', icon: 'mdi:home', r: 100, lat: 59.8721, lon: 10.7978, sys: true, n: 2 },
      { id: 'jobb', name: 'Jobb', icon: 'mdi:briefcase', r: 150, lat: 59.9111, lon: 10.7503, n: 0 },
      { id: 'skole', name: 'Skole', icon: 'mdi:school', r: 120, lat: 59.8804, lon: 10.8071, n: 0 },
      { id: 'hytta', name: 'Hytta', icon: 'mdi:pine-tree', r: 300, lat: 60.4720, lon: 8.4689, n: 0 },
      { id: 'butikk', name: 'Butikken', icon: 'mdi:cart', r: 60, lat: 59.8745, lon: 10.8002, n: 0 }
    ],
    persons: [
      { id: 'sebastian', name: 'Sebastian', user: 'sebastian', admin: true, login: true, trackers: ['device_tracker.sebastians_iphone'] },
      { id: 'kari', name: 'Kari', user: 'kari', admin: false, login: true, trackers: ['device_tracker.karis_telefon'] },
      { id: 'ola', name: 'Ola', user: '', admin: false, login: false, trackers: [] }
    ],
    integrations: [
      { id: 'mobile_app', name: 'Mobile App', icon: 'mdi:cellphone', c: C.blue, dev: 3, ent: 64, note: 'Denne telefonen og 2 til' },
      { id: 'met', name: 'Meteorologisk institutt (Met.no)', icon: 'mdi:weather-partly-cloudy', c: C.blue, dev: 1, ent: 2 },
      { id: 'nordpool', name: 'Nord Pool', icon: 'mdi:flash', c: C.yellow, dev: 1, ent: 6 },
      { id: 'entur', name: 'Entur', icon: 'mdi:train', c: C.red, dev: 2, ent: 4 },
      { id: 'unifi', name: 'UniFi Network', icon: 'mdi:router-wireless', c: C.teal, dev: 14, ent: 212 },
      { id: 'unifiprotect', name: 'UniFi Protect', icon: 'mdi:cctv', c: C.teal, dev: 11, ent: 168 },
      { id: 'tesla', name: 'Tesla Fleet', icon: 'mdi:car-electric', c: C.red, dev: 1, ent: 58, warn: 'Krever ny innlogging' },
      { id: 'sonos', name: 'Sonos', icon: 'mdi:speaker', c: C.orange, dev: 4, ent: 22 },
      { id: 'zha', name: 'Zigbee Home Automation', icon: 'mdi:zigbee', c: C.yellow, dev: 38, ent: 141 },
      { id: 'nibe', name: 'NIBE (myUplink)', icon: 'mdi:heat-pump', c: C.green, dev: 1, ent: 37 },
      { id: 'ki_rom', name: 'KI Rom', icon: 'mdi:texture-box', c: C.pink, dev: 9, ent: 54, hacs: true },
      { id: 'proxmox', name: 'Proxmox VE', icon: 'mdi:server', c: C.purple, dev: 3, ent: 27, off: true }
    ],
    automations: [
      { id: 'a1', alias: 'Utelys i skumringen', description: 'Tenner utelyset når sola går ned', mode: 'single', enabled: true, last: 'i går 19:34',
        triggers: [{ trigger: 'sun', event: 'sunset', offset: '-00:15:00' }], conditions: [], actions: [{ action: 'light.turn_on', target: { entity_id: 'light.stue_tak' }, data: { brightness_pct: 80 } }] },
      { id: 'a2', alias: 'Varsle når vaskemaskinen er ferdig', description: '', mode: 'single', enabled: true, last: 'i dag 14:02',
        triggers: [{ trigger: 'state', entity_id: 'input_select.vaskemaskin_status', to: 'Ferdig' }], conditions: [{ condition: 'state', entity_id: 'person.sebastian', state: 'home' }], actions: [{ action: 'notify.mobile_app_sebastians_iphone', data: { title: 'Vaskemaskin', message: 'Klar til å tømmes' } }] },
      { id: 'a3', alias: 'Natta', description: 'Slår av lys og låser døra', mode: 'single', enabled: true, last: 'i går 23:30',
        triggers: [{ trigger: 'time', at: '23:30:00' }], conditions: [], actions: [{ action: 'light.turn_off', target: { entity_id: 'light.stue_led' } }, { action: 'lock.lock', target: { entity_id: 'lock.inngangsdor' } }] },
      { id: 'a4', alias: 'Alarm på når alle er borte', description: '', mode: 'single', enabled: false, last: 'aldri',
        triggers: [{ trigger: 'state', entity_id: 'person.kari', to: 'not_home', for: '00:10:00' }], conditions: [{ condition: 'state', entity_id: 'person.sebastian', state: 'not_home' }], actions: [{ delay: '00:01:00' }, { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: 'alarm_control_panel.hjem' } }] }
    ]
  };
  let D;
  try { D = JSON.parse(localStorage.getItem(LS)) || null; } catch (e) { D = null; }
  if (!D || !D.automations) D = JSON.parse(JSON.stringify(DEF));
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) {} };

  const TRIG = { state: ['Tilstand', 'mdi:state-machine'], time: ['Tidspunkt', 'mdi:clock-outline'], sun: ['Sol', 'mdi:weather-sunset'], numeric_state: ['Tallverdi', 'mdi:numeric'], homeassistant: ['Home Assistant', 'mdi:home-assistant'], zone: ['Sone', 'mdi:map-marker-radius'] };
  const COND = { state: ['Tilstand', 'mdi:state-machine'], time: ['Tid', 'mdi:clock-outline'], numeric_state: ['Tallverdi', 'mdi:numeric'], sun: ['Sol', 'mdi:weather-sunny'] };
  const ACT = { service: ['Utfør handling', 'mdi:play-circle-outline'], delay: ['Vent', 'mdi:timer-sand'], notify: ['Varsle', 'mdi:bell-outline'], scene: ['Aktiver scene', 'mdi:palette-outline'] };
  const SVCS = ['light.turn_on', 'light.turn_off', 'light.toggle', 'switch.turn_on', 'switch.turn_off', 'cover.open_cover', 'cover.close_cover', 'climate.set_temperature', 'lock.lock', 'lock.unlock', 'media_player.media_pause', 'alarm_control_panel.alarm_arm_away', 'alarm_control_panel.alarm_disarm', 'scene.turn_on', 'script.turn_on'];

  const trigTxt = (t) => {
    const n = (id) => { const s = H() && H().states[id]; return (s && s.attributes.friendly_name) || id || '…'; };
    if (t.trigger === 'state') return `${n(t.entity_id)}${t.to ? ' blir «' + t.to + '»' : ' endres'}${t.for ? ' i ' + t.for : ''}`;
    if (t.trigger === 'time') return `Klokka ${String(t.at || '').slice(0, 5)}`;
    if (t.trigger === 'sun') return `${t.event === 'sunrise' ? 'Soloppgang' : 'Solnedgang'}${t.offset ? ' ' + t.offset : ''}`;
    if (t.trigger === 'numeric_state') return `${n(t.entity_id)} ${t.above != null ? 'over ' + t.above : ''}${t.below != null ? ' under ' + t.below : ''}`;
    if (t.trigger === 'homeassistant') return `Home Assistant ${t.event === 'shutdown' ? 'stopper' : 'starter'}`;
    if (t.trigger === 'zone') return `${n(t.entity_id)} ${t.event === 'leave' ? 'forlater' : 'kommer til'} ${t.zone || 'sone'}`;
    return t.trigger;
  };
  const condTxt = (c) => {
    const n = (id) => { const s = H() && H().states[id]; return (s && s.attributes.friendly_name) || id || '…'; };
    if (c.condition === 'state') return `${n(c.entity_id)} er «${c.state || '…'}»`;
    if (c.condition === 'time') return `Mellom ${c.after || '…'} og ${c.before || '…'}`;
    if (c.condition === 'numeric_state') return `${n(c.entity_id)}${c.above != null ? ' over ' + c.above : ''}${c.below != null ? ' under ' + c.below : ''}`;
    if (c.condition === 'sun') return `${c.after === 'sunset' ? 'Etter solnedgang' : 'Etter soloppgang'}`;
    return c.condition;
  };
  const actKind = (a) => (a.delay != null ? 'delay' : /^notify\./.test(a.action || '') ? 'notify' : a.action === 'scene.turn_on' ? 'scene' : 'service');
  const actTxt = (a) => {
    const k = actKind(a);
    if (k === 'delay') return `Vent ${typeof a.delay === 'string' ? a.delay : JSON.stringify(a.delay)}`;
    if (k === 'notify') return `Send «${(a.data && a.data.message) || '…'}» til ${String(a.action).replace('notify.', '')}`;
    const t = a.target && a.target.entity_id, s = t && H() && H().states[t];
    return `${a.action || '…'}${t ? ' · ' + ((s && s.attributes.friendly_name) || t) : ''}`;
  };
  const toYaml = (a) => {
    const o = { alias: a.alias, description: a.description || '', mode: a.mode || 'single', triggers: a.triggers, conditions: a.conditions, actions: a.actions };
    if (window.jsyaml) return window.jsyaml.dump(o, { lineWidth: 100, noRefs: true });
    return JSON.stringify(o, null, 2);
  };

  const CSS = `
  :host{position:fixed;inset:0;z-index:2147482500;pointer-events:none;font-family:'Space Grotesk',system-ui,sans-serif;color:#fafafa;-webkit-tap-highlight-color:transparent}
  :host([open]){pointer-events:auto}
  *{box-sizing:border-box}
  button{all:unset;box-sizing:border-box;cursor:pointer;font-family:inherit;-webkit-user-select:none;user-select:none}
  .wrap{position:absolute;inset:0;background:#232323;transform:translateY(100%);visibility:hidden;transition:transform .42s cubic-bezier(.2,.85,.25,1),visibility 0s linear .42s;overflow:hidden;will-change:transform}
  :host([open]) .wrap{transform:none;visibility:visible;transition:transform .42s cubic-bezier(.2,.85,.25,1),visibility 0s}
  @media (prefers-reduced-motion:reduce){.wrap,.pg.a-in,.pg.a-back{transition:none;animation:none}}
  .pg{position:absolute;inset:0;display:flex;flex-direction:column;background:#232323}
  .pg.a-in{animation:pin .32s cubic-bezier(.2,.85,.25,1)}
  .pg.a-back{animation:pback .28s cubic-bezier(.2,.85,.25,1)}
  .sc>*{flex-shrink:0}
  @keyframes pin{from{transform:translateX(40%);opacity:0}to{transform:none;opacity:1}}
  @keyframes pback{from{transform:translateX(-25%);opacity:.4}to{transform:none;opacity:1}}
  .top{flex:none;height:60px;display:flex;align-items:center;gap:10px;padding:8px 14px 0}
  .ib{width:44px;height:44px;border-radius:22px;background:#2f2f2f;display:grid;place-items:center;--mdc-icon-size:24px;flex:none}
  .ib:active,.row:active,.btn:active,.chip:active,.blk:active{transform:scale(.97)}
  .tsm{flex:1;min-width:0;text-align:center;font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:var(--tsm,0);transition:opacity .2s}
  .sc{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:4px 18px 120px;display:flex;flex-direction:column;gap:14px}
  .sc::-webkit-scrollbar{display:none}
  h1{margin:4px 4px 2px;font-size:32px;font-weight:500;letter-spacing:-.02em}
  .lead{margin:-6px 4px 2px;font-size:14px;color:#979797;line-height:1.45}
  .lbl{font-size:13px;color:#979797;margin:6px 8px -6px}
  .grp{border-radius:28px;background:#2f2f2f;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
  .row{display:flex;align-items:center;gap:14px;min-height:62px;padding:8px 16px 8px 10px;width:100%;border-top:1px solid rgba(255,255,255,.05);transition:background .15s}
  .grp>.row:first-child,.grp>:first-child .row{border-top:0}
  .ri{width:42px;height:42px;border-radius:21px;flex:none;display:grid;place-items:center;--mdc-icon-size:22px;background:#3a3a3a}
  .rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .rt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rt span{font-size:12.5px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rv{font-size:14px;color:#afafaf;white-space:nowrap}
  .chev{--mdc-icon-size:20px;color:#7f7f7f;flex:none}
  .tgl{position:relative;width:50px;height:30px;border-radius:15px;background:#545454;flex:none;transition:background .2s}
  .tgl::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fafafa;transition:left .2s}
  .tgl.on{background:#f285c9}.tgl.on::after{left:23px}
  .prof{display:flex;align-items:center;gap:16px;padding:18px;border-radius:32px;background:#2f2f2f}
  .av{width:68px;height:68px;border-radius:34px;flex:none;display:grid;place-items:center;font-size:28px;font-weight:600;color:#2a1720;background:${PK};overflow:hidden}
  .av img{width:100%;height:100%;object-fit:cover}
  .in{height:54px;border-radius:27px;background:#2f2f2f;border:0;outline:none;color:#fafafa;font:15px 'Space Grotesk',sans-serif;padding:0 20px;width:100%}
  .in:focus{box-shadow:inset 0 0 0 1.5px #f285c9}
  select.in{appearance:none;-webkit-appearance:none;background:#2f2f2f url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23afafaf' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 20px center;padding-right:44px}
  .fl{display:flex;flex-direction:column;gap:6px}
  .fl>span{font-size:13px;color:#979797;padding:0 10px}
  .seg{display:flex;padding:4px;border-radius:26px;background:#2f2f2f}
  .seg button{flex:1;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;color:#afafaf;--mdc-icon-size:18px;white-space:nowrap}
  .seg button.on{background:${PK};color:#2a1720}
  .btn{height:54px;border-radius:27px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:600;background:${PK};color:#2a1720;--mdc-icon-size:20px;padding:0 22px;white-space:nowrap}
  .btn.sec{background:#2f2f2f;color:#fafafa;font-weight:500}
  .btn.dng{background:rgba(242,128,115,.14);color:#f28073;font-weight:500}
  .fab{position:absolute;right:18px;bottom:28px;height:60px;border-radius:30px;padding:0 22px 0 18px;display:flex;align-items:center;gap:10px;background:${PK};color:#2a1720;font-size:15px;font-weight:600;box-shadow:0 10px 30px rgba(242,133,201,.35);--mdc-icon-size:24px}
  .chip{height:34px;padding:0 14px;border-radius:17px;background:#3a3a3a;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;--mdc-icon-size:16px;white-space:nowrap}
  .chip.on{background:${PK};color:#2a1720}
  .tag{height:22px;padding:0 9px;border-radius:11px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;white-space:nowrap}
  .map{position:relative;height:200px;border-radius:28px;overflow:hidden;background:#1f2023;background-image:linear-gradient(#2a2b2f 1px,transparent 1px),linear-gradient(90deg,#2a2b2f 1px,transparent 1px);background-size:32px 32px}
  .map .z{position:absolute;border-radius:50%;transform:translate(-50%,-50%);background:rgba(242,133,201,.18);box-shadow:inset 0 0 0 2px #f285c9;transition:width .2s,height .2s}
  .map .p{position:absolute;transform:translate(-50%,-100%);color:#f285c9;--mdc-icon-size:30px}
  .map .cap{position:absolute;left:14px;bottom:10px;font:11px ui-monospace,Menlo,monospace;color:#7f7f7f;white-space:nowrap}
  input[type=range]{width:100%;accent-color:#f285c9;height:28px}
  .sec{display:flex;flex-direction:column;gap:8px}
  .sech{display:flex;align-items:center;gap:10px;padding:0 6px;font-size:15px;font-weight:500}
  .sech small{font-size:12px;color:#7f7f7f;font-weight:400}
  .blk{border-radius:24px;background:#2f2f2f;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);overflow:hidden}
  .bh{display:flex;align-items:center;gap:12px;padding:10px 10px 10px 10px;width:100%}
  .bh .ri{width:38px;height:38px}
  .bb{display:flex;flex-direction:column;gap:10px;padding:2px 14px 14px}
  .bb .in{height:48px;border-radius:24px;background:#3a3a3a;font-size:14px}
  .bb select.in{background-color:#3a3a3a}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .add{height:48px;border-radius:24px;box-shadow:inset 0 0 0 1.5px dashed rgba(255,255,255,.18);border:1.5px dashed rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;color:#c7c7c7;--mdc-icon-size:18px}
  .menu{display:flex;flex-wrap:wrap;gap:6px;padding:4px 2px}
  textarea.yml{width:100%;min-height:420px;border:0;outline:none;resize:vertical;border-radius:24px;background:#1c1c1c;color:#e1e1e1;font:12.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;padding:16px 18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);white-space:pre;tab-size:2}
  .err{font-size:13px;color:#f28073;display:flex;gap:6px;align-items:flex-start;padding:0 8px;line-height:1.4;--mdc-icon-size:16px}
  .ok{font-size:13px;color:#66d19e;display:flex;gap:6px;align-items:center;padding:0 8px;--mdc-icon-size:16px}
  .toast{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);padding:12px 18px;border-radius:22px;background:#fafafa;color:#232323;font-size:14px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap;transition:opacity .3s}
  .empty{padding:24px;text-align:center;color:#979797;font-size:14px}
  .mono{font:12px ui-monospace,Menlo,monospace;color:#afafaf}
  `;

  class Settings {
    constructor() {
      this.host = document.createElement('div');
      this.root = this.host.attachShadow({ mode: 'open' });
      this.stack = [{ p: 'root' }];
      this.anim = '';
      this.ui = {};
    }
    get cur() { return this.stack[this.stack.length - 1]; }
    open(page, arg) {
      this.stack = [{ p: 'root' }];
      if (page && page !== 'root') this.stack.push({ p: page, a: arg });
      this.anim = ''; this.render();
      requestAnimationFrame(() => this.host.setAttribute('open', ''));
      if (!window.jsyaml && !this._yl) { this._yl = true; const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js'; s.onload = () => this.render(); document.head.appendChild(s); }
    }
    close() { this.host.removeAttribute('open'); }
    push(p, a) { this.stack.push({ p, a }); this.anim = 'in'; this.render(); }
    pop() { if (this.stack.length <= 1) return this.close(); this.stack.pop(); this.anim = 'back'; this.render(); }
    toast(t) { this.ui.toast = t; const w = this.root.querySelector('.wrap'); if (w) { let el = w.querySelector('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; w.appendChild(el); } el.textContent = t; el.style.opacity = 1; } else this.render(); clearTimeout(this._tt); this._tt = setTimeout(() => { this.ui.toast = ''; const el = this.root.querySelector('.toast'); if (el) el.style.opacity = 0; }, 1800); }
    row(o) {
      return `<button class="row" ${o.attrs || ''}><span class="ri" style="${o.c ? `background:${o.c};color:#232323` : ''}"><ha-icon icon="${o.icon}"></ha-icon></span><span class="rt"><b>${esc(o.t)}</b>${o.s ? `<span>${esc(o.s)}</span>` : ''}</span>${o.v != null ? `<span class="rv">${o.v}</span>` : ''}${o.tgl != null ? `<span class="tgl ${o.tgl ? 'on' : ''}"></span>` : o.nochev ? '' : '<ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>'}</button>`;
    }
    page(title, body, o) {
      o = o || {};
      const back = this.stack.length > 1 || o.closeOnly;
      return `<div class="pg ${this.anim ? 'a-' + this.anim : ''}"><div class="top"><button class="ib" data-a="${this.stack.length > 1 ? 'pop' : 'close'}" aria-label="Tilbake"><ha-icon icon="${this.stack.length > 1 ? (AND ? 'mdi:arrow-left' : 'mdi:chevron-left') : 'mdi:close'}"></ha-icon></button><span class="tsm">${esc(title)}</span>${o.right || '<span style="width:44px"></span>'}</div>
        <div class="sc">${o.noH1 ? '' : `<h1>${esc(title)}</h1>`}${body}</div>${o.fab || ''}</div>`;
    }
    // ---------------------------------------------------------------- sider
    pRoot() {
      const P = D.profile, srv = D.servers.find((s) => s.id === D.server) || D.servers[0];
      const pic = H() && H().states['person.sebastian'] && H().states['person.sebastian'].attributes.entity_picture;
      const warn = D.integrations.filter((i) => i.warn).length;
      return this.page('Innstillinger', `
        <button class="prof" data-a="go" data-p="profile"><span class="av">${pic ? `<img src="${esc(pic)}" alt="">` : esc(P.name[0] || 'S')}</span><span class="rt"><b style="font-size:19px">${esc(P.name)}</b><span>Administrator · ${esc(srv.name)}</span></span><ha-icon class="chev" icon="mdi:chevron-right"></ha-icon></button>
        <div class="grp">
          ${this.row({ icon: 'mdi:puzzle-outline', c: C.blue, t: 'Integrasjoner', s: `${D.integrations.length} integrasjoner · ${D.integrations.reduce((n, i) => n + i.dev, 0)} enheter`, v: warn ? `<span class="tag" style="background:rgba(242,128,115,.18);color:#f28073">${warn}</span>` : null, attrs: 'data-a="go" data-p="integrations"' })}
          ${this.row({ icon: 'mdi:robot-outline', c: C.pink, t: 'Automasjoner', s: `${D.automations.filter((a) => a.enabled).length} av ${D.automations.length} på`, attrs: 'data-a="go" data-p="automations"' })}
          ${this.row({ icon: 'mdi:map-marker-radius-outline', c: C.green, t: 'Soner', s: D.zones.map((z) => z.name).slice(0, 3).join(', ') + (D.zones.length > 3 ? ' …' : ''), attrs: 'data-a="go" data-p="zones"' })}
          ${this.row({ icon: 'mdi:account-group-outline', c: C.orange, t: 'Personer', s: D.persons.map((p) => p.name).join(', '), attrs: 'data-a="go" data-p="persons"' })}
        </div>
        <div class="lbl">Companion-appen</div>
        <div class="grp">
          ${this.row({ icon: 'mdi:server-network', c: C.purple, t: 'Servere', s: `${srv.name} · ${srv.url.replace(/^https?:\/\//, '')}`, attrs: 'data-a="go" data-p="servers"' })}
          ${this.row({ icon: 'mdi:creation', c: '#e8794a', t: 'Glimt AI', s: (() => { try { const c = JSON.parse(localStorage.getItem('ki-proto-glimt') || '{}'); return c.provider === 'ollama' ? 'Ollama · ' + (c.ollamaModel || 'qwen2.5:7b') + ' · lokalt' : c.provider === 'off' ? 'Av' : 'Claude · sky'; } catch (e) { return 'Assistent, modell og tillatelser'; } })(), attrs: 'data-a="glimt"' })}
          ${this.row({ icon: 'mdi:star-four-points-outline', t: 'Glimt-knappen på Hjem', s: 'Vis «Glimt»-boblen over minispilleren', tgl: (() => { try { return JSON.parse(localStorage.getItem('ki-proto-glimt') || '{}').bubble !== false; } catch (e) { return true; } })(), attrs: 'data-a="glimtbub"' })}
          ${this.row({ icon: 'mdi:cellphone-cog', c: C.teal, t: 'Denne enheten', s: AND ? 'Pixel 8 · mobile_app_pixel_8' : 'Sebastians iPhone · mobile_app_sebastians_iphone', attrs: 'data-a="go" data-p="device"' })}
        </div>
        <div class="grp">${this.row({ icon: 'mdi:information-outline', t: 'Om', s: `Home Assistant ${srv.ver} · KI MSH ${window.KI_MSH_VERSION || ''}`, attrs: 'data-a="go" data-p="about"' })}</div>`);
    }
    pProfile() {
      const P = D.profile, seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${P[k] === v ? 'on' : ''}" data-a="prof" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
      return this.page('Profil', `
        <div class="fl"><span>Visningsnavn</span><input class="in" data-in="prof.name" value="${esc(P.name)}"></div>
        <div class="fl"><span>Brukernavn</span><input class="in" value="sebastian" disabled style="color:#979797"></div>
        <div class="fl"><span>Språk</span>${seg('lang', [['nb', 'Norsk'], ['en', 'English']])}</div>
        <div class="fl"><span>Tema</span>${seg('theme', [['auto', 'Auto'], ['dark', 'Mørkt'], ['light', 'Lyst']])}</div>
        <div class="fl"><span>Tidsformat</span>${seg('time', [['24', '24 timer'], ['12', '12 timer']])}</div>
        <div class="fl"><span>Standard dashbord</span><select class="in" data-in="prof.dash"><option value="ki-dashboard" ${P.dash === 'ki-dashboard' ? 'selected' : ''}>KI MSH (custom:ki-dashboard)</option><option value="lovelace" ${P.dash === 'lovelace' ? 'selected' : ''}>Oversikt</option><option value="energy" ${P.dash === 'energy' ? 'selected' : ''}>Energi</option><option value="map" ${P.dash === 'map' ? 'selected' : ''}>Kart</option></select></div>
        <div class="grp">
          ${this.row({ icon: 'mdi:school-outline', t: 'Avansert modus', s: 'Vis YAML, tjenester og utviklerverktøy', tgl: P.advanced, attrs: 'data-a="ptgl" data-k="advanced"' })}
          ${this.row({ icon: 'mdi:vibrate', t: 'Haptisk tilbakemelding', s: 'Én vibrasjon per trykk', tgl: P.haptics, attrs: 'data-a="ptgl" data-k="haptics"' })}
          ${this.row({ icon: 'mdi:fullscreen', t: 'Kiosk-modus', s: 'Skjul HA-header og sidepanel på denne enheten', tgl: P.kiosk, attrs: 'data-a="ptgl" data-k="kiosk"' })}
        </div>
        <div class="grp">${this.row({ icon: 'mdi:key-outline', t: 'Sikkerhet', s: 'Passord, tofaktor og langtidstokener', attrs: 'data-a="toast" data-v="Åpnes i Home Assistant"' })}</div>
        <button class="btn dng" data-a="logout"><ha-icon icon="mdi:logout"></ha-icon>Logg ut</button>`);
    }
    pPersons() {
      return this.page('Personer', `<div class="lead">Personer som sporer hjemme/borte og kan logge inn.</div><div class="grp">${D.persons.map((p) => {
        const s = H() && H().states['person.' + p.id], st = s ? (s.state === 'home' ? 'Hjemme' : s.state === 'not_home' ? 'Borte' : s.state) : '–';
        return this.row({ icon: 'mdi:account', c: s && s.state === 'home' ? C.green : C.blue, t: p.name, s: `${st}${p.admin ? ' · administrator' : ''}${p.login ? '' : ' · kan ikke logge inn'}`, attrs: `data-a="go" data-p="person" data-x="${p.id}"` });
      }).join('')}</div>`, { fab: '<button class="fab" data-a="newperson"><ha-icon icon="mdi:plus"></ha-icon>Legg til person</button>' });
    }
    pPerson(id) {
      const p = D.persons.find((x) => x.id === id); if (!p) return this.pPersons();
      const trk = H() ? Object.keys(H().states).filter((k) => /^device_tracker\./.test(k)) : [];
      const opts = [...new Set([...trk, ...p.trackers, 'device_tracker.sebastians_iphone', 'device_tracker.karis_telefon', 'device_tracker.pixel_8'])];
      return this.page(p.name || 'Ny person', `
        <div class="fl"><span>Navn</span><input class="in" data-in="person.name" data-x="${p.id}" value="${esc(p.name)}"></div>
        <div class="grp">
          ${this.row({ icon: 'mdi:login', t: 'Kan logge inn', s: p.login ? `Bruker: ${p.user || p.id}` : 'Ingen brukerkonto', tgl: p.login, attrs: `data-a="pertgl" data-k="login" data-x="${p.id}"` })}
          ${this.row({ icon: 'mdi:shield-account-outline', t: 'Administrator', s: 'Full tilgang til innstillinger', tgl: p.admin, attrs: `data-a="pertgl" data-k="admin" data-x="${p.id}"` })}
        </div>
        <div class="lbl">Enheter som sporer personen</div>
        <div class="grp">${opts.map((t) => this.row({ icon: 'mdi:cellphone-marker', t: t.replace('device_tracker.', '').replace(/_/g, ' '), s: t, tgl: p.trackers.includes(t), attrs: `data-a="trk" data-x="${p.id}" data-v="${t}"` })).join('')}</div>
        ${p.id !== 'sebastian' ? `<button class="btn dng" data-a="delperson" data-x="${p.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Slett person</button>` : ''}`);
    }
    pZones() {
      return this.page('Soner', `<div class="lead">Soner brukes til hjemme/borte, automasjoner og kartet.</div>
        <div class="map">${D.zones.filter((z) => z.lat > 59.8 && z.lat < 60).map((z) => { const x = 50 + (z.lon - 10.79) * 900, y = 50 - (z.lat - 59.89) * 1500; return `<span class="z" style="left:${x}%;top:${y}%;width:${Math.max(18, z.r / 4)}px;height:${Math.max(18, z.r / 4)}px"></span>`; }).join('')}<span class="cap">kart · Oslo</span></div>
        <div class="grp">${D.zones.map((z) => this.row({ icon: z.icon, c: z.sys ? C.green : null, t: z.name, s: `Radius ${z.r} m${z.n ? ' · ' + z.n + ' personer her' : ''}${z.sys ? ' · fra Generelt' : ''}`, attrs: `data-a="go" data-p="zone" data-x="${z.id}"` })).join('')}</div>`,
        { fab: '<button class="fab" data-a="newzone"><ha-icon icon="mdi:plus"></ha-icon>Legg til sone</button>' });
    }
    pZone(id) {
      const z = D.zones.find((x) => x.id === id); if (!z) return this.pZones();
      const ICONS = ['mdi:home', 'mdi:briefcase', 'mdi:school', 'mdi:pine-tree', 'mdi:cart', 'mdi:dumbbell', 'mdi:hospital-box', 'mdi:soccer'];
      return this.page(z.name || 'Ny sone', `
        <div class="map"><span class="z" style="left:50%;top:50%;width:${Math.min(190, z.r / 2 + 20)}px;height:${Math.min(190, z.r / 2 + 20)}px"></span><span class="p" style="left:50%;top:50%"><ha-icon icon="mdi:map-marker"></ha-icon></span><span class="cap">${z.lat.toFixed(4)}, ${z.lon.toFixed(4)}</span></div>
        <div class="fl"><span>Navn</span><input class="in" data-in="zone.name" data-x="${z.id}" value="${esc(z.name)}" ${z.sys ? 'disabled style="color:#979797"' : ''}></div>
        <div class="fl"><span>Ikon</span><div class="menu">${ICONS.map((i) => `<button class="chip ${z.icon === i ? 'on' : ''}" data-a="zicon" data-x="${z.id}" data-v="${i}" style="width:44px;height:44px;border-radius:22px;padding:0;justify-content:center;--mdc-icon-size:22px"><ha-icon icon="${i}"></ha-icon></button>`).join('')}</div></div>
        <div class="fl"><span>Radius · <b style="color:#fafafa;font-weight:500" data-rv>${z.r} m</b></span><input type="range" min="20" max="1000" step="10" value="${z.r}" data-range="zone.r" data-x="${z.id}"></div>
        <div class="two"><div class="fl"><span>Breddegrad</span><input class="in" data-in="zone.lat" data-x="${z.id}" value="${z.lat}" inputmode="decimal"></div><div class="fl"><span>Lengdegrad</span><input class="in" data-in="zone.lon" data-x="${z.id}" value="${z.lon}" inputmode="decimal"></div></div>
        <div class="grp">${this.row({ icon: 'mdi:eye-off-outline', t: 'Passiv sone', s: 'Bare for automasjoner, ikke hjemme/borte', tgl: !!z.passive, attrs: `data-a="ztgl" data-x="${z.id}"` })}</div>
        ${z.sys ? '<div class="lead" style="margin:0 6px">Hjem-sonen redigeres under Innstillinger → System → Generelt.</div>' : `<button class="btn dng" data-a="delzone" data-x="${z.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Slett sone</button>`}`);
    }
    pIntegrations() {
      const q = (this.ui.iq || '').toLowerCase();
      const L = D.integrations.filter((i) => !q || i.name.toLowerCase().includes(q));
      return this.page('Integrasjoner', `
        <input class="in" data-in="ui.iq" placeholder="Søk i integrasjoner" value="${esc(this.ui.iq || '')}">
        ${D.integrations.some((i) => i.warn) ? `<div class="lbl" style="color:#f28073">Trenger oppmerksomhet</div><div class="grp">${D.integrations.filter((i) => i.warn && (!q || i.name.toLowerCase().includes(q))).map((i) => this.row({ icon: i.icon, c: C.red, t: i.name, s: i.warn, attrs: `data-a="go" data-p="integration" data-x="${i.id}"` })).join('')}</div>` : ''}
        <div class="lbl">Konfigurert</div>
        <div class="grp">${L.filter((i) => !i.warn).map((i) => this.row({ icon: i.icon, c: i.off ? null : i.c, t: i.name, s: i.off ? 'Deaktivert' : `${i.dev} ${i.dev === 1 ? 'enhet' : 'enheter'} · ${i.ent} entiteter${i.hacs ? ' · HACS' : ''}`, attrs: `data-a="go" data-p="integration" data-x="${i.id}"` })).join('') || '<div class="empty">Ingen treff</div>'}</div>`,
        { fab: '<button class="fab" data-a="go" data-p="addint"><ha-icon icon="mdi:plus"></ha-icon>Legg til</button>' });
    }
    pIntegration(id) {
      const i = D.integrations.find((x) => x.id === id); if (!i) return this.pIntegrations();
      const devs = Array.from({ length: Math.min(i.dev, 6) }, (_, k) => i.id === 'mobile_app' ? ['Sebastians iPhone', 'Karis telefon', 'Pixel 8'][k] : i.id === 'unifiprotect' ? ['G4 Doorbell', 'Inngang', 'Garasje', 'Hage', 'Basseng', 'Carport'][k] : i.id === 'zha' ? ['Stue tak', 'Stue LED', 'Bevegelse stue', 'Vindu soverom', 'Dørsensor gang', 'Røykvarsler'][k] : `${i.name} ${k + 1}`);
      return this.page(i.name, `
        <div class="prof"><span class="av" style="background:${i.c};border-radius:22px;--mdc-icon-size:34px;color:#232323"><ha-icon icon="${i.icon}"></ha-icon></span><span class="rt"><b style="font-size:17px;white-space:normal">${esc(i.name)}</b><span>${i.off ? 'Deaktivert' : i.warn ? i.warn : 'Lastet'}${i.hacs ? ' · egendefinert (HACS)' : ''}</span></span></div>
        ${i.warn ? `<button class="btn" data-a="reauth" data-x="${i.id}"><ha-icon icon="mdi:login"></ha-icon>Logg inn på nytt</button>` : ''}
        <div class="lbl">${i.dev} ${i.dev === 1 ? 'enhet' : 'enheter'} · ${i.ent} entiteter</div>
        <div class="grp">${devs.map((d) => this.row({ icon: 'mdi:devices', t: d, s: i.name, nochev: true })).join('')}${i.dev > 6 ? `<div class="row" style="justify-content:center;color:#979797;font-size:13px">+ ${i.dev - 6} til</div>` : ''}</div>
        <div class="grp">
          ${this.row({ icon: 'mdi:tune-variant', t: 'Konfigurer', s: 'Alternativer for integrasjonen', attrs: 'data-a="toast" data-v="Alternativene er lagret"' })}
          ${this.row({ icon: 'mdi:reload', t: 'Last inn på nytt', attrs: `data-a="toast" data-v="${esc(i.name)} er lastet inn på nytt"` })}
          ${this.row({ icon: i.off ? 'mdi:play-circle-outline' : 'mdi:pause-circle-outline', t: i.off ? 'Aktiver' : 'Deaktiver', attrs: `data-a="intoff" data-x="${i.id}"` })}
        </div>
        ${i.id !== 'mobile_app' ? `<button class="btn dng" data-a="delint" data-x="${i.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Slett integrasjon</button>` : ''}`);
    }
    pAddInt() {
      const ALL = [['Philips Hue', 'mdi:lightbulb-group', C.yellow], ['Shelly', 'mdi:alpha-s-box', C.blue], ['Google Cast', 'mdi:cast', C.blue], ['Netatmo', 'mdi:thermometer', C.teal], ['Easee', 'mdi:ev-station', C.green], ['Tibber', 'mdi:flash', C.purple], ['Spotify', 'mdi:spotify', C.green], ['Roborock', 'mdi:robot-vacuum', C.orange], ['Zigbee2MQTT', 'mdi:zigbee', C.yellow], ['MQTT', 'mdi:server-network', C.purple], ['Plex', 'mdi:plex', C.orange], ['Apple TV', 'mdi:apple', '#c7c7c7'], ['Yr', 'mdi:weather-cloudy', C.blue], ['Ring', 'mdi:doorbell-video', C.blue], ['Verisure', 'mdi:shield-home', C.red]];
      const q = (this.ui.aq || '').toLowerCase(), L = ALL.filter(([n]) => !q || n.toLowerCase().includes(q));
      const f = this.ui.flow;
      if (f) {
        return this.page(f.name, `
          <div class="prof"><span class="av" style="background:${f.c};border-radius:22px;--mdc-icon-size:34px;color:#232323"><ha-icon icon="${f.icon}"></ha-icon></span><span class="rt"><b style="font-size:17px">${esc(f.name)}</b><span>${f.step === 2 ? 'Fant 1 enhet' : 'Koble til'}</span></span></div>
          ${f.step === 1 ? `<div class="fl"><span>Vert eller IP-adresse</span><input class="in" data-in="ui.fhost" value="${esc(this.ui.fhost || '')}" placeholder="192.168.1.40"></div>${this.ui.ferr ? `<div class="err"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(this.ui.ferr)}</div>` : ''}<button class="btn" data-a="flow">${this.ui.fbusy ? 'Kobler til …' : 'Send'}</button>`
            : `<div class="fl"><span>Område</span><select class="in"><option>Stue</option><option>Kjøkken</option><option>Gang</option><option>Soverom</option></select></div><div class="ok"><ha-icon icon="mdi:check-circle-outline"></ha-icon>Tilkoblet ${esc(this.ui.fhost || '')}</div><button class="btn" data-a="flowdone">Fullfør</button>`}`);
      }
      return this.page('Legg til integrasjon', `<input class="in" data-in="ui.aq" placeholder="Søk etter merke eller tjeneste" value="${esc(this.ui.aq || '')}">
        <div class="grp">${L.map(([n, ic, c]) => this.row({ icon: ic, c, t: n, attrs: `data-a="flowstart" data-n="${esc(n)}" data-i="${ic}" data-c="${c}"` })).join('') || '<div class="empty">Ingen treff</div>'}</div>`);
    }
    pAutomations() {
      return this.page('Automasjoner', `<div class="lead">Trykk for å redigere. Bryteren slår automasjonen av og på.</div>
        <div class="grp">${D.automations.map((a) => `<div style="display:flex;align-items:center;border-top:1px solid rgba(255,255,255,.05)"><button class="row" style="border-top:0;flex:1;min-width:0" data-a="go" data-p="auto" data-x="${a.id}"><span class="ri" style="${a.enabled ? `background:${C.pink};color:#2a1720` : ''}"><ha-icon icon="mdi:robot-outline"></ha-icon></span><span class="rt"><b>${esc(a.alias || 'Uten navn')}</b><span>${esc(a.triggers[0] ? trigTxt(a.triggers[0]) : 'Ingen utløser')} · sist ${esc(a.last || 'aldri')}</span></span></button><button data-a="atgl" data-x="${a.id}" style="padding:0 16px 0 4px;height:62px;display:flex;align-items:center"><span class="tgl ${a.enabled ? 'on' : ''}"></span></button></div>`).join('') || '<div class="empty">Ingen automasjoner ennå</div>'}</div>`,
        { fab: '<button class="fab" data-a="newauto"><ha-icon icon="mdi:plus"></ha-icon>Ny automasjon</button>' });
    }
    entSel(k, val, dom) {
      const ids = H() ? Object.keys(H().states).filter((x) => !dom || dom.some((d) => x.startsWith(d + '.'))).sort() : [];
      if (val && !ids.includes(val)) ids.unshift(val);
      return `<select class="in" ${k}><option value="">Velg entitet …</option>${ids.map((id) => { const s = H().states[id]; return `<option value="${esc(id)}" ${id === val ? 'selected' : ''}>${esc((s && s.attributes.friendly_name) || id)} · ${esc(id)}</option>`; }).join('')}</select>`;
    }
    blk(kind, i, title, icon, sum, body, col) {
      const open = this.ui.ob === kind + i;
      return `<div class="blk"><button class="bh" data-a="ob" data-v="${kind + i}"><span class="ri" style="background:${col};color:#232323"><ha-icon icon="${icon}"></ha-icon></span><span class="rt"><b>${esc(title)}</b><span>${esc(sum)}</span></span><ha-icon class="chev" icon="${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon></button>${open ? `<div class="bb">${body}<div style="display:flex;gap:8px;justify-content:flex-end"><button class="chip" data-a="bmove" data-k="${kind}" data-i="${i}" data-d="-1"><ha-icon icon="mdi:arrow-up"></ha-icon></button><button class="chip" data-a="bmove" data-k="${kind}" data-i="${i}" data-d="1"><ha-icon icon="mdi:arrow-down"></ha-icon></button><button class="chip" data-a="bdel" data-k="${kind}" data-i="${i}" style="color:#f28073"><ha-icon icon="mdi:delete-outline"></ha-icon>Fjern</button></div></div>` : ''}</div>`;
    }
    fld(label, inner) { return `<div class="fl"><span>${label}</span>${inner}</div>`; }
    inp(path, val, ph) { return `<input class="in" data-ain="${path}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph || '')}">`; }
    pAuto(id) {
      const a = this.ui.draft && this.ui.draft.id === id ? this.ui.draft : (this.ui.draft = JSON.parse(JSON.stringify(D.automations.find((x) => x.id === id) || this.blank(id))));
      const mode = this.ui.amode || 'gui';
      const head = `<div class="seg"><button class="${mode === 'gui' ? 'on' : ''}" data-a="amode" data-v="gui"><ha-icon icon="mdi:view-dashboard-edit-outline"></ha-icon>Visuell</button><button class="${mode === 'yaml' ? 'on' : ''}" data-a="amode" data-v="yaml"><ha-icon icon="mdi:code-braces"></ha-icon>YAML</button></div>`;
      let body;
      if (mode === 'yaml') {
        const y = this.ui.ytxt != null ? this.ui.ytxt : toYaml(a);
        body = `${head}<textarea class="yml" data-yml spellcheck="false" autocapitalize="off">${esc(y)}</textarea>${this.ui.yerr ? `<div class="err"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(this.ui.yerr)}</div>` : '<div class="ok"><ha-icon icon="mdi:check-circle-outline"></ha-icon>Gyldig YAML · endringer vises i den visuelle editoren</div>'}`;
      } else {
        const T = a.triggers.map((t, i) => {
          let b = this.fld('Type', `<select class="in" data-ain="triggers.${i}.trigger">${Object.entries(TRIG).map(([k, [l]]) => `<option value="${k}" ${t.trigger === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`);
          if (t.trigger === 'state' || t.trigger === 'numeric_state' || t.trigger === 'zone') b += this.fld('Entitet', this.entSel(`data-ain="triggers.${i}.entity_id"`, t.entity_id, t.trigger === 'zone' ? ['person', 'device_tracker'] : null));
          if (t.trigger === 'state') b += `<div class="two">${this.fld('Til tilstand', this.inp(`triggers.${i}.to`, t.to, 'on'))}${this.fld('Varighet', this.inp(`triggers.${i}.for`, t.for, '00:05:00'))}</div>`;
          if (t.trigger === 'numeric_state') b += `<div class="two">${this.fld('Over', this.inp(`triggers.${i}.above`, t.above))}${this.fld('Under', this.inp(`triggers.${i}.below`, t.below))}</div>`;
          if (t.trigger === 'time') b += this.fld('Klokkeslett', `<input class="in" type="time" data-ain="triggers.${i}.at" value="${esc(String(t.at || '').slice(0, 5))}">`);
          if (t.trigger === 'sun') b += `<div class="two">${this.fld('Hendelse', `<select class="in" data-ain="triggers.${i}.event"><option value="sunset" ${t.event !== 'sunrise' ? 'selected' : ''}>Solnedgang</option><option value="sunrise" ${t.event === 'sunrise' ? 'selected' : ''}>Soloppgang</option></select>`)}${this.fld('Forskyvning', this.inp(`triggers.${i}.offset`, t.offset, '-00:15:00'))}</div>`;
          if (t.trigger === 'homeassistant') b += this.fld('Hendelse', `<select class="in" data-ain="triggers.${i}.event"><option value="start">Starter</option><option value="shutdown" ${t.event === 'shutdown' ? 'selected' : ''}>Stopper</option></select>`);
          if (t.trigger === 'zone') b += `<div class="two">${this.fld('Sone', `<select class="in" data-ain="triggers.${i}.zone">${D.zones.map((z) => `<option value="zone.${z.id}" ${t.zone === 'zone.' + z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>`)}${this.fld('Når', `<select class="in" data-ain="triggers.${i}.event"><option value="enter">Kommer</option><option value="leave" ${t.event === 'leave' ? 'selected' : ''}>Forlater</option></select>`)}</div>`;
          return this.blk('t', i, (TRIG[t.trigger] || [t.trigger])[0], (TRIG[t.trigger] || [0, 'mdi:flash'])[1], trigTxt(t), b, C.yellow);
        }).join('');
        const Cn = a.conditions.map((c, i) => {
          let b = this.fld('Type', `<select class="in" data-ain="conditions.${i}.condition">${Object.entries(COND).map(([k, [l]]) => `<option value="${k}" ${c.condition === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`);
          if (c.condition === 'state' || c.condition === 'numeric_state') b += this.fld('Entitet', this.entSel(`data-ain="conditions.${i}.entity_id"`, c.entity_id));
          if (c.condition === 'state') b += this.fld('Tilstand', this.inp(`conditions.${i}.state`, c.state, 'home'));
          if (c.condition === 'numeric_state') b += `<div class="two">${this.fld('Over', this.inp(`conditions.${i}.above`, c.above))}${this.fld('Under', this.inp(`conditions.${i}.below`, c.below))}</div>`;
          if (c.condition === 'time') b += `<div class="two">${this.fld('Etter', `<input class="in" type="time" data-ain="conditions.${i}.after" value="${esc(String(c.after || '').slice(0, 5))}">`)}${this.fld('Før', `<input class="in" type="time" data-ain="conditions.${i}.before" value="${esc(String(c.before || '').slice(0, 5))}">`)}</div>`;
          if (c.condition === 'sun') b += this.fld('Etter', `<select class="in" data-ain="conditions.${i}.after"><option value="sunset">Solnedgang</option><option value="sunrise" ${c.after === 'sunrise' ? 'selected' : ''}>Soloppgang</option></select>`);
          return this.blk('c', i, (COND[c.condition] || [c.condition])[0], (COND[c.condition] || [0, 'mdi:help'])[1], condTxt(c), b, C.blue);
        }).join('');
        const A = a.actions.map((x, i) => {
          const k = actKind(x); let b = '';
          if (k === 'delay') b = this.fld('Varighet (tt:mm:ss)', this.inp(`actions.${i}.delay`, x.delay, '00:01:00'));
          else if (k === 'notify') b = this.fld('Mottaker', `<select class="in" data-ain="actions.${i}.action">${['notify.mobile_app_sebastians_iphone', 'notify.mobile_app_karis_telefon', 'notify.mobile_app_pixel_8', 'notify.notify'].map((v) => `<option ${x.action === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`) + this.fld('Tittel', this.inp(`actions.${i}.data.title`, x.data && x.data.title)) + this.fld('Melding', this.inp(`actions.${i}.data.message`, x.data && x.data.message, 'Skriv en melding'));
          else if (k === 'scene') b = this.fld('Scene', this.entSel(`data-ain="actions.${i}.target.entity_id"`, x.target && x.target.entity_id, ['scene']));
          else {
            b = this.fld('Handling', `<select class="in" data-ain="actions.${i}.action">${[...new Set([x.action, ...SVCS].filter(Boolean))].map((v) => `<option ${x.action === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`);
            const dom = String(x.action || '').split('.')[0];
            b += this.fld('Mål', this.entSel(`data-ain="actions.${i}.target.entity_id"`, x.target && x.target.entity_id, dom ? [dom] : null));
            if (x.action === 'light.turn_on') b += this.fld('Lysstyrke (%)', this.inp(`actions.${i}.data.brightness_pct`, x.data && x.data.brightness_pct, '80'));
            if (x.action === 'climate.set_temperature') b += this.fld('Temperatur', this.inp(`actions.${i}.data.temperature`, x.data && x.data.temperature, '21'));
          }
          return this.blk('a', i, ACT[k][0], ACT[k][1], actTxt(x), b, C.green);
        }).join('');
        const addMenu = (kind, map) => this.ui.am === kind ? `<div class="menu">${Object.entries(map).map(([k, [l, ic]]) => `<button class="chip" data-a="badd" data-k="${kind}" data-v="${k}"><ha-icon icon="${ic}"></ha-icon>${l}</button>`).join('')}</div>` : `<button class="add" data-a="am" data-v="${kind}"><ha-icon icon="mdi:plus"></ha-icon>Legg til</button>`;
        body = `${head}
          <div class="fl"><span>Navn</span><input class="in" data-ain="alias" value="${esc(a.alias)}" placeholder="Ny automasjon"></div>
          <div class="fl"><span>Beskrivelse</span><input class="in" data-ain="description" value="${esc(a.description || '')}" placeholder="Valgfritt"></div>
          <div class="sec"><div class="sech"><ha-icon icon="mdi:flash" style="--mdc-icon-size:18px;color:${C.yellow}"></ha-icon>Når<small>utløsere</small></div>${T}${addMenu('t', TRIG)}</div>
          <div class="sec"><div class="sech"><ha-icon icon="mdi:filter-outline" style="--mdc-icon-size:18px;color:${C.blue}"></ha-icon>Og hvis<small>betingelser · valgfritt</small></div>${Cn}${addMenu('c', COND)}</div>
          <div class="sec"><div class="sech"><ha-icon icon="mdi:play" style="--mdc-icon-size:18px;color:${C.green}"></ha-icon>Så gjør<small>handlinger</small></div>${A}${addMenu('a', ACT)}</div>
          <div class="fl"><span>Modus</span><div class="seg">${[['single', 'Én'], ['restart', 'Start på nytt'], ['queued', 'Kø'], ['parallel', 'Parallell']].map(([v, l]) => `<button class="${(a.mode || 'single') === v ? 'on' : ''}" data-a="aset" data-k="mode" data-v="${v}">${l}</button>`).join('')}</div></div>`;
      }
      const exists = D.automations.some((x) => x.id === id);
      body += `<div style="display:grid;grid-template-columns:${exists ? '1fr 1fr' : '1fr'};gap:8px;margin-top:6px">${exists ? '<button class="btn sec" data-a="arun"><ha-icon icon="mdi:play"></ha-icon>Kjør nå</button>' : ''}<button class="btn" data-a="asave"><ha-icon icon="mdi:content-save-outline"></ha-icon>Lagre</button></div>${exists ? '<button class="btn dng" data-a="adel"><ha-icon icon="mdi:delete-outline"></ha-icon>Slett automasjon</button>' : ''}`;
      return this.page(a.alias || 'Ny automasjon', body, { noH1: false });
    }
    blank(id) { return { id, alias: '', description: '', mode: 'single', enabled: true, last: 'aldri', triggers: [{ trigger: 'state', entity_id: '', to: '' }], conditions: [], actions: [{ action: 'light.turn_on', target: { entity_id: '' }, data: {} }] }; }
    pServers() {
      return this.page('Servere', `<div class="lead">Appen kan kobles til flere Home Assistant-servere. Bytt aktiv server her.</div>
        <div class="grp">${D.servers.map((s) => this.row({ icon: 'mdi:home-assistant', c: s.id === D.server ? C.green : null, t: s.name, s: `${s.url.replace(/^https?:\/\//, '')} · ${s.ver}`, v: s.id === D.server ? '<span class="tag" style="background:rgba(102,209,158,.16);color:#66d19e">Aktiv</span>' : null, attrs: `data-a="go" data-p="server" data-x="${s.id}"` })).join('')}</div>
        <button class="btn sec" data-a="addserver"><ha-icon icon="mdi:plus"></ha-icon>Legg til server</button>`);
    }
    pServer(id) {
      const s = D.servers.find((x) => x.id === id); if (!s) return this.pServers();
      return this.page(s.name, `
        <div class="fl"><span>Navn</span><input class="in" data-in="server.name" data-x="${s.id}" value="${esc(s.name)}"></div>
        <div class="fl"><span>Intern URL (hjemme)</span><input class="in" data-in="server.url" data-x="${s.id}" value="${esc(s.url)}"></div>
        <div class="fl"><span>Ekstern URL</span><input class="in" data-in="server.ext" data-x="${s.id}" value="${esc(s.ext)}" placeholder="https://…"></div>
        <div class="grp">${this.row({ icon: 'mdi:wifi', t: 'Hjemmenettverk', s: 'Bruk intern URL på «Hjem-WiFi»', tgl: true, nochev: true })}${this.row({ icon: 'mdi:cloud-outline', t: 'Home Assistant Cloud', s: s.ext.includes('nabu.casa') ? 'Tilkoblet' : 'Ikke i bruk', nochev: true })}</div>
        ${s.id !== D.server ? `<button class="btn" data-a="setserver" data-x="${s.id}"><ha-icon icon="mdi:swap-horizontal"></ha-icon>Bytt til ${esc(s.name)}</button>` : '<div class="ok" style="justify-content:center"><ha-icon icon="mdi:check-circle-outline"></ha-icon>Aktiv server</div>'}
        ${D.servers.length > 1 ? `<button class="btn dng" data-a="delserver" data-x="${s.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Fjern server</button>` : ''}`);
    }
    pDevice() {
      const P = D.profile;
      return this.page('Denne enheten', `
        <div class="fl"><span>Enhetsnavn</span><input class="in" value="${AND ? 'Pixel 8' : 'Sebastians iPhone'}"></div>
        <div class="lbl">Sensorer til Home Assistant</div>
        <div class="grp">${[['mdi:battery-70', 'Batterinivå', '72 %', true], ['mdi:battery-charging', 'Ladestatus', 'Lader ikke', true], ['mdi:map-marker-outline', 'Posisjon', 'Hjem', true], ['mdi:walk', 'Aktivitet', 'Stille', false], ['mdi:wifi', 'Wi-Fi-navn', 'Hjem-WiFi', true], ['mdi:cellphone-lock', 'Skjerm låst', 'Av', false]].map(([ic, t, v, on], k) => this.row({ icon: ic, t, s: v, tgl: (this.ui['sn' + k] != null ? this.ui['sn' + k] : on), attrs: `data-a="sns" data-v="${k}" data-d="${on}"` })).join('')}</div>
        <div class="lbl">Varsler</div>
        <div class="grp">${this.row({ icon: 'mdi:bell-outline', t: 'Push-varsler', s: 'notify.mobile_app_' + (AND ? 'pixel_8' : 'sebastians_iphone'), tgl: true, nochev: true })}${this.row({ icon: 'mdi:message-badge-outline', t: 'Send testvarsel', attrs: 'data-a="toast" data-v="Testvarsel sendt"' })}</div>
        <button class="btn sec" data-a="ob-reset"><ha-icon icon="mdi:restart"></ha-icon>Kjør onboarding på nytt</button>`);
    }
    pAbout() {
      const srv = D.servers.find((s) => s.id === D.server) || D.servers[0];
      return this.page('Om', `<div class="grp">${[['Home Assistant', srv.ver], ['Frontend', '20261008.0'], ['KI MSH', window.KI_MSH_VERSION || '–'], ['Bubble Card', 'fra jsDelivr'], ['Companion-app', AND ? '2026.10.1 (Android)' : '2026.10 (iOS)']].map(([k, v]) => this.row({ icon: 'mdi:information-outline', t: k, v: esc(v), nochev: true })).join('')}</div>
        <div class="lead" style="margin:4px 6px">Dashbordet er KI MSH fra github.com/SebastianKristo/ki-msh, kjørt uendret.</div>`);
    }
    // ---------------------------------------------------------------- render + hendelser
    render() {
      const c = this.cur, map = { root: () => this.pRoot(), profile: () => this.pProfile(), persons: () => this.pPersons(), person: () => this.pPerson(c.a), zones: () => this.pZones(), zone: () => this.pZone(c.a), integrations: () => this.pIntegrations(), integration: () => this.pIntegration(c.a), addint: () => this.pAddInt(), automations: () => this.pAutomations(), auto: () => this.pAuto(c.a), servers: () => this.pServers(), server: () => this.pServer(c.a), device: () => this.pDevice(), about: () => this.pAbout() };
      const sc0 = this.root.querySelector('.sc'), keep = !this.anim && sc0 ? sc0.scrollTop : 0;
      this.root.innerHTML = `<style>${CSS}</style><div class="wrap">${(map[c.p] || map.root)()}${this.ui.toast ? `<div class="toast">${esc(this.ui.toast)}</div>` : ''}</div>`;
      const sc = this.root.querySelector('.sc');
      if (sc) { if (keep) sc.scrollTop = keep; const pg = sc.parentElement; const f = () => pg.style.setProperty('--tsm', sc.scrollTop > 40 ? 1 : 0); sc.addEventListener('scroll', f, { passive: true }); f(); }
      this.anim = '';
      this.bind();
    }
    setPath(o, path, v) { const k = path.split('.'); let x = o; for (let i = 0; i < k.length - 1; i++) { if (x[k[i]] == null) x[k[i]] = /^\d+$/.test(k[i + 1]) ? [] : {}; x = x[k[i]]; } if (v === '' || v == null) delete x[k[k.length - 1]]; else x[k[k.length - 1]] = /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) && !/:/.test(v) ? Number(v) : v; }
    bind() {
      const R = this.root, c = this.cur;
      R.querySelectorAll('[data-a]').forEach((el) => el.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = el.dataset, find = (arr) => arr.find((x) => x.id === d.x);
        if (navigator.vibrate && D.profile.haptics) try { navigator.vibrate(6); } catch (_) {}
        switch (d.a) {
          case 'close': return this.close();
          case 'pop': if (c.p === 'auto') { this.ui.draft = null; this.ui.ytxt = null; this.ui.yerr = ''; this.ui.amode = 'gui'; } if (c.p === 'addint') { this.ui.flow = null; } return this.pop();
          case 'go': if (d.p === 'auto') { this.ui.draft = null; this.ui.ytxt = null; this.ui.yerr = ''; this.ui.amode = 'gui'; this.ui.ob = null; this.ui.am = null; } return this.push(d.p, d.x);
          case 'toast': return this.toast(d.v);
          case 'glimtbub': { let c = {}; try { c = JSON.parse(localStorage.getItem('ki-proto-glimt') || '{}'); } catch (e) {} c.bubble = c.bubble === false; try { localStorage.setItem('ki-proto-glimt', JSON.stringify(c)); } catch (e) {} if (window.kiGlimt && window.kiGlimt.reloadCfg) window.kiGlimt.reloadCfg(); return this.render(); }
          case 'glimt': this.close(); return setTimeout(() => { if (window.kiGlimt) { window.kiGlimt.view = 'set'; window.kiGlimt.open(); } }, 300);
          case 'prof': D.profile[d.k] = d.v; save(); if (d.k === 'theme') this.toast(d.v === 'light' ? 'Lyst tema velges i dashbordet (Tilpass alt → Tema)' : 'Tema lagret'); return this.render();
          case 'ptgl': D.profile[d.k] = !D.profile[d.k]; save(); return this.render();
          case 'logout': this.close(); return window.parent && window.parent.postMessage({ kiLogout: true }, '*');
          case 'pertgl': { const p = find(D.persons); p[d.k] = !p[d.k]; save(); return this.render(); }
          case 'trk': { const p = find(D.persons); p.trackers = p.trackers.includes(d.v) ? p.trackers.filter((t) => t !== d.v) : [...p.trackers, d.v]; save(); return this.render(); }
          case 'newperson': { const id = 'p' + uid(); D.persons.push({ id, name: 'Ny person', user: '', admin: false, login: false, trackers: [] }); save(); return this.push('person', id); }
          case 'delperson': D.persons = D.persons.filter((p) => p.id !== d.x); save(); this.toast('Personen er slettet'); return this.pop();
          case 'newzone': { const id = 'z' + uid(); D.zones.push({ id, name: 'Ny sone', icon: 'mdi:map-marker', r: 100, lat: 59.885, lon: 10.79, n: 0 }); save(); return this.push('zone', id); }
          case 'zicon': find(D.zones).icon = d.v; save(); return this.render();
          case 'ztgl': { const z = find(D.zones); z.passive = !z.passive; save(); return this.render(); }
          case 'delzone': D.zones = D.zones.filter((z) => z.id !== d.x); save(); this.toast('Sonen er slettet'); return this.pop();
          case 'reauth': { const i = find(D.integrations); delete i.warn; save(); this.toast('Logget inn på nytt'); return this.render(); }
          case 'intoff': { const i = find(D.integrations); i.off = !i.off; save(); this.toast(i.off ? `${i.name} er deaktivert` : `${i.name} er aktivert`); return this.render(); }
          case 'delint': D.integrations = D.integrations.filter((i) => i.id !== d.x); save(); this.toast('Integrasjonen er slettet'); return this.pop();
          case 'flowstart': this.ui.flow = { name: d.n, icon: d.i, c: d.c, step: 1 }; this.ui.fhost = ''; this.ui.ferr = ''; this.anim = 'in'; return this.render();
          case 'flow': {
            const v = (this.ui.fhost || '').trim();
            if (!/^[\w.-]+(:\d+)?$/.test(v)) { this.ui.ferr = 'Skriv inn en gyldig vert, f.eks. 192.168.1.40'; return this.render(); }
            this.ui.fbusy = true; this.ui.ferr = ''; this.render();
            return setTimeout(() => { this.ui.fbusy = false; this.ui.flow.step = 2; this.render(); }, 900);
          }
          case 'flowdone': { const f = this.ui.flow; D.integrations.unshift({ id: 'i' + uid(), name: f.name, icon: f.icon, c: f.c, dev: 1, ent: 3 }); save(); this.ui.flow = null; this.toast(`${f.name} er lagt til`); return this.pop(); }
          case 'atgl': { const a = find(D.automations); a.enabled = !a.enabled; save(); return this.render(); }
          case 'newauto': { this.ui.draft = null; this.ui.ytxt = null; this.ui.yerr = ''; this.ui.amode = 'gui'; this.ui.ob = 't0'; return this.push('auto', 'a' + uid()); }
          case 'amode': {
            if (d.v === 'gui' && this.ui.amode === 'yaml') { if (!this.applyYaml()) return this.render(); }
            this.ui.amode = d.v; this.ui.ytxt = null; return this.render();
          }
          case 'ob': this.ui.ob = this.ui.ob === d.v ? null : d.v; return this.render();
          case 'am': this.ui.am = d.v; return this.render();
          case 'badd': {
            const a = this.ui.draft, k = d.k;
            if (k === 't') a.triggers.push(d.v === 'time' ? { trigger: 'time', at: '07:00:00' } : d.v === 'sun' ? { trigger: 'sun', event: 'sunset' } : d.v === 'homeassistant' ? { trigger: 'homeassistant', event: 'start' } : d.v === 'zone' ? { trigger: 'zone', entity_id: 'person.sebastian', zone: 'zone.home', event: 'enter' } : { trigger: d.v, entity_id: '' });
            if (k === 'c') a.conditions.push(d.v === 'time' ? { condition: 'time', after: '22:00:00', before: '06:00:00' } : d.v === 'sun' ? { condition: 'sun', after: 'sunset' } : { condition: d.v, entity_id: '' });
            if (k === 'a') a.actions.push(d.v === 'delay' ? { delay: '00:01:00' } : d.v === 'notify' ? { action: 'notify.mobile_app_sebastians_iphone', data: { message: '' } } : d.v === 'scene' ? { action: 'scene.turn_on', target: { entity_id: '' } } : { action: 'light.turn_on', target: { entity_id: '' }, data: {} });
            const arr = k === 't' ? a.triggers : k === 'c' ? a.conditions : a.actions;
            this.ui.ob = k + (arr.length - 1); this.ui.am = null; return this.render();
          }
          case 'bdel': { const a = this.ui.draft, arr = d.k === 't' ? a.triggers : d.k === 'c' ? a.conditions : a.actions; arr.splice(Number(d.i), 1); this.ui.ob = null; return this.render(); }
          case 'bmove': { const a = this.ui.draft, arr = d.k === 't' ? a.triggers : d.k === 'c' ? a.conditions : a.actions, i = Number(d.i), j = i + Number(d.d); if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; this.ui.ob = d.k + j; return this.render(); }
          case 'aset': this.ui.draft[d.k] = d.v; return this.render();
          case 'asave': {
            if (this.ui.amode === 'yaml' && !this.applyYaml()) return this.render();
            const a = this.ui.draft; if (!a.alias) a.alias = 'Ny automasjon';
            if (!a.triggers.length) { this.toast('Legg til minst én utløser'); return; }
            const i = D.automations.findIndex((x) => x.id === a.id);
            if (i >= 0) D.automations[i] = JSON.parse(JSON.stringify(a)); else D.automations.unshift(JSON.parse(JSON.stringify(a)));
            save(); this.toast('Automasjonen er lagret'); return this.render();
          }
          case 'arun': {
            const a = this.ui.draft, h = H();
            (a.actions || []).forEach((x) => { if (x.action && h) { const [dm, sv] = x.action.split('.'); if (dm !== 'notify') h.callService(dm, sv, { ...(x.data || {}), ...(x.target || {}) }); } });
            const t = D.automations.find((x) => x.id === a.id); if (t) { t.last = 'nå nettopp'; a.last = t.last; save(); }
            this.toast('Kjørt · handlingene er utført'); return this.render();
          }
          case 'adel': D.automations = D.automations.filter((x) => x.id !== this.ui.draft.id); save(); this.ui.draft = null; this.toast('Automasjonen er slettet'); return this.pop();
          case 'setserver': D.server = d.x; save(); this.toast('Byttet server'); return this.render();
          case 'delserver': D.servers = D.servers.filter((s) => s.id !== d.x); if (D.server === d.x) D.server = D.servers[0].id; save(); return this.pop();
          case 'addserver': { const id = 's' + uid(); D.servers.push({ id, name: 'Ny server', url: 'http://', ext: '', ver: '–' }); save(); return this.push('server', id); }
          case 'sns': { const k = 'sn' + d.v, cur = this.ui[k] != null ? this.ui[k] : d.d === 'true'; this.ui[k] = !cur; return this.render(); }
          case 'ob-reset': this.close(); return window.parent && window.parent.postMessage({ kiOnboarding: true }, '*');
        }
      }));
      R.querySelectorAll('[data-in]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        const [o, k] = el.dataset.in.split('.'), v = el.value;
        if (o === 'ui') { this.ui[k] = v; if (k === 'iq' || k === 'aq') { this.render(); const n = this.root.querySelector(`[data-in="${el.dataset.in}"]`); if (n) { n.focus(); n.setSelectionRange(v.length, v.length); } } return; }
        if (o === 'prof') D.profile[k] = v;
        const arr = o === 'person' ? D.persons : o === 'zone' ? D.zones : o === 'server' ? D.servers : null;
        if (arr) { const t = arr.find((x) => x.id === el.dataset.x); if (t) t[k] = (k === 'lat' || k === 'lon') ? (parseFloat(v.replace(',', '.')) || t[k]) : v; }
        save();
        const tsm = this.root.querySelector('.tsm'); if (k === 'name' && tsm) tsm.textContent = v;
      }));
      R.querySelectorAll('[data-range]').forEach((el) => {
        el.addEventListener('input', () => { const z = D.zones.find((x) => x.id === el.dataset.x); z.r = Number(el.value); const rv = this.root.querySelector('[data-rv]'); if (rv) rv.textContent = z.r + ' m'; const zc = this.root.querySelector('.map .z'); if (zc) { const s = Math.min(190, z.r / 2 + 20) + 'px'; zc.style.width = s; zc.style.height = s; } });
        el.addEventListener('change', () => save());
      });
      R.querySelectorAll('[data-ain]').forEach((el) => el.addEventListener('change', () => {
        const a = this.ui.draft; if (!a) return;
        let v = el.value; if (el.type === 'time' && v) v = v.length === 5 ? v + ':00' : v;
        this.setPath(a, el.dataset.ain, v);
        if (/\.trigger$|\.condition$|\.action$/.test(el.dataset.ain)) { const m = el.dataset.ain.match(/^(\w+)\.(\d+)\./); const it = a[m[1]][Number(m[2])]; if (m[1] === 'triggers') Object.keys(it).forEach((kk) => { if (kk !== 'trigger') delete it[kk]; }); if (m[1] === 'conditions') Object.keys(it).forEach((kk) => { if (kk !== 'condition') delete it[kk]; }); }
        if (el.dataset.ain === 'alias') { const tsm = this.root.querySelector('.tsm'); if (tsm) tsm.textContent = v || 'Ny automasjon'; return; }
        this.render();
      }));
      const y = R.querySelector('[data-yml]');
      if (y) {
        y.addEventListener('input', () => { this.ui.ytxt = y.value; clearTimeout(this._yv); this._yv = setTimeout(() => { const ok = this.checkYaml(y.value); const box = this.root.querySelector('.err,.ok'); if (box) { box.className = ok === true ? 'ok' : 'err'; box.innerHTML = ok === true ? '<ha-icon icon="mdi:check-circle-outline"></ha-icon>Gyldig YAML · endringer vises i den visuelle editoren' : `<ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(ok)}`; } }, 350); });
        y.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const s = y.selectionStart; y.value = y.value.slice(0, s) + '  ' + y.value.slice(y.selectionEnd); y.selectionStart = y.selectionEnd = s + 2; this.ui.ytxt = y.value; } });
      }
    }
    checkYaml(t) {
      try { const o = window.jsyaml ? window.jsyaml.load(t) : JSON.parse(t); if (!o || typeof o !== 'object') return 'Forventet et objekt'; if (!Array.isArray(o.triggers || o.trigger)) return 'Mangler «triggers:» (liste)'; if (!Array.isArray(o.actions || o.action)) return 'Mangler «actions:» (liste)'; return true; } catch (e) { return (e.reason || e.message || 'Ugyldig YAML') + (e.mark ? ` (linje ${e.mark.line + 1})` : ''); }
    }
    applyYaml() {
      const t = this.ui.ytxt; if (t == null) return true;
      const ok = this.checkYaml(t); if (ok !== true) { this.ui.yerr = ok; return false; }
      const o = window.jsyaml ? window.jsyaml.load(t) : JSON.parse(t), a = this.ui.draft;
      a.alias = o.alias || ''; a.description = o.description || ''; a.mode = o.mode || 'single';
      a.triggers = (o.triggers || o.trigger || []).map((x) => (x.platform && !x.trigger ? { trigger: x.platform, ...x } : x)); a.triggers.forEach((x) => delete x.platform);
      a.conditions = o.conditions || o.condition || []; a.actions = (o.actions || o.action || []).map((x) => (x.service && !x.action ? { action: x.service, ...x } : x)); a.actions.forEach((x) => delete x.service);
      this.ui.yerr = ''; this.ui.ytxt = null; return true;
    }
  }
  const S = new Settings();
  S.addAutomation = (a) => { const id = 'a' + uid(); D.automations.unshift({ id, mode: 'single', enabled: true, last: 'aldri', conditions: [], ...a }); save(); return id; };
  window.kiSettings = S;
  const mount = () => document.body.appendChild(S.host);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  const PAGE = (p) => (/\/config\/zone/.test(p) ? 'zones' : /\/config\/(integrations|devices|entities)/.test(p) ? 'integrations' : /\/config\/(automation|script|scene)/.test(p) ? 'automations' : /\/config\/(person|users)/.test(p) ? 'persons' : /\/profile/.test(p) ? 'profile' : 'root');
  window.kiSettingsFor = (path) => S.open(PAGE(path || ''));
  window.addEventListener('message', (e) => { if (e.data && e.data.kiSettings != null) S.open(e.data.kiSettings || 'root'); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.host.hasAttribute('open')) S.pop(); });
})();
