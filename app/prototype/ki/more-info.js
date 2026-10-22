// Mer info-ark for appen (HAs «hass-more-info»): ett bunnark per entitet i KI MSH-stil.
// Lytter på hass-more-info (fra MSH.moreInfo og langt trykk), leser window.__H og oppdateres ved hver ny hass (ki-hass).
(function () {
  const C = { yellow: '#f2d26f', orange: '#f2b573', red: '#f28073', pink: '#f285c9', blue: '#73b9f2', green: '#66d19e', purple: '#ad99e6' };
  const PK = 'linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%)';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
  const ST = { on: 'På', off: 'Av', locked: 'Låst', unlocked: 'Ulåst', locking: 'Låser …', unlocking: 'Låser opp …', open: 'Åpen', opening: 'Åpner …', closed: 'Lukket', closing: 'Lukker …', playing: 'Spiller', paused: 'Pauset', idle: 'Inaktiv', standby: 'Hvilemodus', home: 'Hjemme', not_home: 'Borte', heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Auto', dry: 'Avfukting', fan_only: 'Vifte', disarmed: 'Avslått', armed_away: 'Borte', armed_home: 'Hjemme', armed_night: 'Natt', armed_vacation: 'Ferie', triggered: 'Utløst', arming: 'Slår på …', pending: 'Venter', cleaning: 'Rengjør', docked: 'Ladestasjon', returning: 'På vei hjem', unavailable: 'Utilgjengelig', unknown: 'Ukjent', partlycloudy: 'Delvis skyet', cloudy: 'Skyet', sunny: 'Sol', rainy: 'Regn', recording: 'Tar opp', streaming: 'Strømmer' };
  const BIN = { door: ['Åpen', 'Lukket'], window: ['Åpent', 'Lukket'], garage_door: ['Åpen', 'Lukket'], opening: ['Åpen', 'Lukket'], motion: ['Bevegelse', 'Ingen bevegelse'], occupancy: ['Til stede', 'Ingen'], presence: ['Hjemme', 'Borte'], moisture: ['Vått', 'Tørt'], smoke: ['Røyk!', 'OK'], battery: ['Lavt', 'Normalt'], problem: ['Problem', 'OK'], connectivity: ['Tilkoblet', 'Frakoblet'] };
  const HVAC = { off: 'Av', heat: 'Varme', cool: 'Kjøling', auto: 'Auto', heat_cool: 'Auto', dry: 'Avfukting', fan_only: 'Vifte' };
  const DICON = { light: 'mdi:lightbulb', switch: 'mdi:toggle-switch-variant', input_boolean: 'mdi:toggle-switch-variant', fan: 'mdi:fan', cover: 'mdi:curtains', climate: 'mdi:thermostat', lock: 'mdi:lock', media_player: 'mdi:cast', alarm_control_panel: 'mdi:shield-home', sensor: 'mdi:eye', binary_sensor: 'mdi:checkbox-blank-circle-outline', person: 'mdi:account', device_tracker: 'mdi:map-marker', camera: 'mdi:cctv', weather: 'mdi:weather-partly-cloudy', scene: 'mdi:palette', script: 'mdi:script-text-outline', automation: 'mdi:robot-outline', vacuum: 'mdi:robot-vacuum', valve: 'mdi:valve', todo: 'mdi:format-list-checks', input_select: 'mdi:form-dropdown', number: 'mdi:ray-vertex', input_number: 'mdi:ray-vertex' };
  const DCLASS = { temperature: 'mdi:thermometer', humidity: 'mdi:water-percent', power: 'mdi:flash', energy: 'mdi:lightning-bolt', illuminance: 'mdi:brightness-5', battery: 'mdi:battery', door: 'mdi:door', window: 'mdi:window-closed-variant', motion: 'mdi:motion-sensor', moisture: 'mdi:water-alert', smoke: 'mdi:smoke-detector', ph: 'mdi:ph', garage: 'mdi:garage' };
  const ON = (s) => ['on', 'open', 'playing', 'unlocked', 'heat', 'cool', 'auto', 'heat_cool', 'cleaning', 'home', 'armed_away', 'armed_home', 'armed_night', 'triggered'].includes(s.state);
  const COLOR = { light: C.yellow, switch: C.green, input_boolean: C.green, fan: C.blue, cover: C.pink, climate: C.orange, lock: C.green, media_player: C.pink, alarm_control_panel: C.red, vacuum: C.green, valve: C.blue, person: C.green, sensor: C.blue, binary_sensor: C.yellow };

  const CSS = `
  :host{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:'Space Grotesk',system-ui,sans-serif;color:#fafafa;-webkit-tap-highlight-color:transparent}
  :host([open]){pointer-events:auto}
  *{box-sizing:border-box}
  button{all:unset;box-sizing:border-box;cursor:pointer;font-family:inherit;-webkit-user-select:none;user-select:none}
  .bd{position:absolute;inset:0;background:rgba(0,0,0,.55);opacity:0;transition:opacity .3s}
  :host([open]) .bd{opacity:1}
  .sh{position:absolute;inset:0;display:flex;flex-direction:column;background:#232323;border-radius:0;padding-top:env(safe-area-inset-top);will-change:transform;transform:translateY(105%);transition:transform .42s cubic-bezier(.2,.85,.25,1)}
  :host([open]) .sh{transform:translateY(var(--dy,0px))}
  .sh.drag{transition:none}
  .grab{flex:none;padding:8px 0 2px;display:flex;justify-content:center;touch-action:none;cursor:grab}
  .grab i{display:block;width:40px;height:5px;border-radius:3px;background:#545454}
  .hd{flex:none;display:flex;align-items:center;gap:12px;padding:8px 18px 14px;touch-action:none}
  .ic{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;transition:background .25s,color .25s;--mdc-icon-size:24px}
  .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .tt b{font-size:19px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tt span{font-size:13px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .x{width:48px;height:48px;border-radius:24px;background:#3a3a3a;display:grid;place-items:center;flex:none;--mdc-icon-size:22px}
  .x:active,.cb:active,.big:active,.chip:active{transform:scale(.94)}
  .seg{flex:none;margin:0 18px;display:flex;padding:4px;border-radius:26px;background:#2f2f2f;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
  .seg button{flex:1;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;color:#afafaf;transition:background .2s,color .2s}
  .seg button.on{background:${PK};color:#2a1720}
  .bdy>*{animation:mi-in .28s cubic-bezier(.2,.85,.25,1) both}
  @keyframes mi-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.sh{transition:none}.bdy>*{animation:none}}
  .bdy{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:22px 18px calc(40px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;justify-content:safe center}
  .bdy::-webkit-scrollbar{display:none}
  .val{text-align:center;font-size:54px;font-weight:300;letter-spacing:-.04em;line-height:1}
  .val small{font-size:20px;color:#afafaf;letter-spacing:0;margin-left:4px}
  .sub{text-align:center;font-size:14px;color:#979797;margin-top:-4px}
  .vs{position:relative;align-self:center;width:140px;height:min(380px,46vh);border-radius:40px;background:#3a3a3a;overflow:hidden;touch-action:none;cursor:ns-resize;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
  .vs .f{position:absolute;left:0;right:0;bottom:0;transition:height .08s}
  .vs .k{position:absolute;left:50%;width:44px;height:5px;border-radius:3px;background:rgba(0,0,0,.35);transform:translateX(-50%)}
  .vs .lab{position:absolute;left:0;right:0;bottom:18px;text-align:center;--mdc-icon-size:28px;pointer-events:none}
  .tg{position:relative;align-self:center;width:140px;height:300px;border-radius:40px;background:#3a3a3a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);transition:background .25s}
  .tg .kn{position:absolute;left:8px;right:8px;height:118px;border-radius:32px;background:#fafafa;display:grid;place-items:center;color:#232323;--mdc-icon-size:32px;transition:top .3s cubic-bezier(.34,1.4,.64,1)}
  .row{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
  .cb{width:64px;height:64px;border-radius:32px;background:#3a3a3a;display:grid;place-items:center;--mdc-icon-size:26px;transition:background .2s,transform .12s}
  .cb.pri{background:#fafafa;color:#232323;width:76px;height:76px;border-radius:38px;--mdc-icon-size:34px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
  .chip{white-space:nowrap;height:44px;padding:0 18px;border-radius:22px;background:#3a3a3a;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#e1e1e1;--mdc-icon-size:18px;transition:background .2s}
  .chip.on{background:${PK};color:#2a1720}
  .sw{width:44px;height:44px;border-radius:22px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}
  .sw.on{box-shadow:0 0 0 3px #282828,0 0 0 5px #fafafa}
  .card{border-radius:28px;background:#3a3a3a;padding:16px 18px}
  .big{align-self:center;width:168px;height:168px;border-radius:84px;display:grid;place-items:center;--mdc-icon-size:56px;transition:background .3s,color .3s,transform .12s}
  .hs{position:relative;height:44px;touch-action:none;cursor:pointer;display:flex;align-items:center;flex:1}
  .hs .t{position:relative;width:100%;height:8px;border-radius:4px;background:#2a2a2a}
  .hs .t i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:${PK}}
  .hs .t b{position:absolute;top:50%;width:24px;height:24px;border-radius:12px;background:#fafafa;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .line{display:flex;align-items:center;gap:14px}
  .art{aspect-ratio:1;width:220px;align-self:center;border-radius:32px;background:repeating-linear-gradient(135deg,#333 0 10px,#383838 10px 20px);display:grid;place-items:center;font:11px ui-monospace,Menlo,monospace;color:#979797;overflow:hidden}
  .art img{width:100%;height:100%;object-fit:cover}
  .mt{text-align:center}.mt b{display:block;font-size:20px;font-weight:500}.mt span{font-size:14px;color:#979797}
  .kv{display:flex;flex-direction:column}
  .kv div{display:flex;justify-content:space-between;gap:14px;padding:12px 2px;border-top:1px solid rgba(255,255,255,.06);font-size:14px}
  .kv div:first-child{border-top:0}
  .kv span{color:#979797;flex:none}
  .kv code{font:12px ui-monospace,Menlo,monospace;text-align:right;overflow-wrap:anywhere;color:#e1e1e1}
  .chart{height:150px;position:relative}
  .chart svg{width:100%;height:100%;display:block;overflow:visible}
  .ax{display:flex;justify-content:space-between;font-size:11px;color:#7f7f7f;margin-top:6px;white-space:nowrap}
  .tl{display:flex;height:28px;border-radius:14px;overflow:hidden;gap:2px}
  .note{font-size:13px;color:#979797;text-align:center;line-height:1.45}
  .ph{height:170px;border-radius:28px;background:repeating-linear-gradient(135deg,#333 0 10px,#383838 10px 20px);display:grid;place-items:center;font:11px ui-monospace,Menlo,monospace;color:#979797}
  .acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .act{height:64px;border-radius:32px;background:#3a3a3a;display:flex;align-items:center;gap:12px;padding:0 16px 0 8px;font-size:15px;font-weight:500;transition:background .2s}
  .act .ai{width:48px;height:48px;border-radius:24px;background:#2f2f2f;display:grid;place-items:center;--mdc-icon-size:22px}
  .act.on{background:${PK};color:#2a1720}.act.on .ai{background:rgba(255,255,255,.35)}
  `;

  class KiMoreInfo {
    constructor() { this.host = document.createElement('div'); this.host.className = 'ki-more-info'; this.shadowRoot = this.host.attachShadow({ mode: 'open' }); this.tab = 'ctl'; this.eid = null; this.hist = {}; }
    setAttribute(k, v) { this.host.setAttribute(k, v); } removeAttribute(k) { this.host.removeAttribute(k); } hasAttribute(k) { return this.host.hasAttribute(k); } get style() { return this.host.style; }
    get hass() { return window.__H; }
    open(id) {
      if (!this.hass || !this.hass.states[id]) return;
      this.eid = id; this.tab = 'ctl'; this.style.setProperty('--dy', '0px');
      this._sig = null; this.render();
      requestAnimationFrame(() => requestAnimationFrame(() => this.setAttribute('open', '')));
      this.loadHist(id);
    }
    close() { this.removeAttribute('open'); this.style.setProperty('--dy', '0px'); this._drag = null; }
    call(d, s, data) { const h = this.hass; if (h) h.callService(d, s, { entity_id: this.eid, ...(data || {}) }); }
    async loadHist(id) {
      const h = this.hass; if (!h || this.hist[id]) return;
      try { const r = await h.callWS({ type: 'history/history_during_period', entity_ids: [id] }); this.hist[id] = (r && r[id]) || []; if (this.eid === id) this.render(); } catch (e) { /* */ }
    }
    area(id) { const h = this.hass, e = h.entities && h.entities[id], a = e && e.area_id && h.areas[e.area_id]; return a ? a.name : ''; }
    icon(s) { const d = s.entity_id.split('.')[0]; return s.attributes.icon || DCLASS[s.attributes.device_class] || (d === 'lock' && s.state === 'unlocked' ? 'mdi:lock-open-variant' : d === 'cover' && s.state === 'open' ? 'mdi:curtains' : DICON[d]) || 'mdi:information-outline'; }
    stateTxt(s) {
      const d = s.entity_id.split('.')[0], a = s.attributes;
      if (d === 'binary_sensor') { const b = BIN[a.device_class]; return b ? (s.state === 'on' ? b[0] : b[1]) : ST[s.state] || s.state; }
      if (d === 'light' && s.state === 'on' && a.brightness != null) return Math.round(a.brightness / 2.55) + ' %';
      if (d === 'cover' && a.current_position != null) return (s.state === 'closed' ? 'Lukket' : a.current_position + ' % åpen');
      if (d === 'climate') return (HVAC[s.state] || s.state) + (a.current_temperature != null ? ' · ' + nf(a.current_temperature, 1) + '°' : '');
      if (d === 'person' || d === 'device_tracker') return ST[s.state] || s.state;
      if (!isNaN(parseFloat(s.state)) && isFinite(s.state)) return s.state.replace('.', ',') + (a.unit_of_measurement ? ' ' + a.unit_of_measurement : '');
      return ST[s.state] || s.state;
    }
    ago(s) { const t = new Date(s.last_changed).getTime(), m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'nå nettopp' : m < 60 ? `${m} min siden` : m < 1440 ? `${Math.round(m / 60)} t siden` : `${Math.round(m / 1440)} d siden`; }

    vslider(key, pct, col, icon, invert) {
      return `<div class="vs" data-vs="${key}" data-inv="${invert ? 1 : 0}"><div class="f" style="height:${pct}%;background:${col}"></div><div class="k" style="bottom:calc(${pct}% - 14px);opacity:${pct > 6 ? 1 : 0}"></div><div class="lab" style="color:${pct > 14 ? '#232323' : '#afafaf'}"><ha-icon icon="${icon}"></ha-icon></div></div>`;
    }
    hslider(key, pct) { return `<div class="hs" data-hs="${key}"><div class="t"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div></div>`; }

    ctl(s) {
      const d = s.entity_id.split('.')[0], a = s.attributes, on = ON(s), col = COLOR[d] || C.pink;
      if (d === 'light') {
        const b = s.state === 'on' ? Math.round((a.brightness || 255) / 2.55) : 0;
        const modes = a.supported_color_modes || [];
        const rgb = modes.some((m) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m)), ct = modes.includes('color_temp') || rgb;
        const sw = [];
        if (ct) sw.push(['ct', 2700, '#ffc48a'], ['ct', 4000, '#fff1dc'], ['ct', 6000, '#dbe8ff']);
        if (rgb) sw.push(['rgb', [242, 133, 201], C.pink], ['rgb', [115, 185, 242], C.blue], ['rgb', [102, 209, 158], C.green], ['rgb', [242, 181, 115], C.orange]);
        const cur = a.rgb_color ? a.rgb_color.join(',') : a.color_temp_kelvin ? String(a.color_temp_kelvin) : '';
        const fill = a.rgb_color && s.state === 'on' ? `rgb(${a.rgb_color.join(',')})` : C.yellow;
        return `<div class="val">${b ? b : 'Av'}${b ? '<small>%</small>' : ''}</div><div class="sub">${s.state === 'on' ? 'Dra for lysstyrke' : 'Trykk eller dra for å slå på'}</div>
          ${this.vslider('bri', b, fill, 'mdi:lightbulb')}
          <div class="row"><button class="cb" data-a="toggle" style="${on ? `background:${C.yellow};color:#232323` : ''}"><ha-icon icon="mdi:power"></ha-icon></button></div>
          ${sw.length ? `<div class="chips">${sw.map(([k, v, c]) => `<button class="sw ${String(v) === cur ? 'on' : ''}" data-a="color" data-k="${k}" data-v="${Array.isArray(v) ? v.join(',') : v}" style="background:${c}" aria-label="Farge"></button>`).join('')}</div>` : ''}`;
      }
      if (d === 'fan') {
        const p = s.state === 'on' ? a.percentage || 0 : 0;
        return `<div class="val">${p ? p : 'Av'}${p ? '<small>%</small>' : ''}</div>${this.vslider('fan', p, C.blue, 'mdi:fan')}
          <div class="row"><button class="cb" data-a="toggle" style="${on ? `background:${C.blue};color:#232323` : ''}"><ha-icon icon="mdi:power"></ha-icon></button></div>`;
      }
      if (d === 'cover') {
        const p = a.current_position != null ? a.current_position : s.state === 'open' ? 100 : 0;
        return `<div class="val">${p}<small>%</small></div><div class="sub">${s.state === 'closed' ? 'Lukket' : 'Åpen'}</div>${this.vslider('pos', p, C.pink, 'mdi:curtains')}
          <div class="row"><button class="cb" data-a="svc" data-s="open_cover"><ha-icon icon="mdi:arrow-up"></ha-icon></button><button class="cb" data-a="svc" data-s="stop_cover"><ha-icon icon="mdi:stop"></ha-icon></button><button class="cb" data-a="svc" data-s="close_cover"><ha-icon icon="mdi:arrow-down"></ha-icon></button></div>`;
      }
      if (['switch', 'input_boolean', 'automation'].includes(d)) {
        return `<div class="val" style="font-size:40px">${on ? 'På' : 'Av'}</div>
          <button class="tg" data-a="toggle" style="${on ? `background:${C.green}` : ''}"><span class="kn" style="top:${on ? 8 : 174}px"><ha-icon icon="${this.icon(s)}"></ha-icon></span></button>
          ${a.current_power_w != null ? `<div class="sub">${a.current_power_w} W</div>` : ''}`;
      }
      if (d === 'scene' || d === 'script') {
        return `<button class="big" data-a="svc" data-s="turn_on" style="background:${PK};color:#2a1720"><ha-icon icon="${this.icon(s)}"></ha-icon></button><div class="note">${d === 'scene' ? 'Trykk for å aktivere scenen' : 'Trykk for å kjøre skriptet'}</div>`;
      }
      if (d === 'climate') {
        const t = a.temperature, modes = a.hvac_modes || ['off', 'heat'], act = a.hvac_action;
        return `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 18px">
            <span style="font-size:13px;color:${act === 'heating' ? C.red : '#979797'};display:flex;align-items:center;gap:6px;--mdc-icon-size:16px"><ha-icon icon="${act === 'heating' ? 'mdi:fire' : 'mdi:thermostat'}"></ha-icon>${act === 'heating' ? 'Varmer' : act === 'idle' ? 'Holder' : HVAC[s.state] || s.state}</span>
            <div style="display:flex;align-items:center;gap:18px;margin:6px 0"><button class="cb" data-a="temp" data-d="-1"><ha-icon icon="mdi:minus"></ha-icon></button><span class="val" style="min-width:150px">${t != null ? nf(t, 1) : '–'}<small>°</small></span><button class="cb" data-a="temp" data-d="1"><ha-icon icon="mdi:plus"></ha-icon></button></div>
            <span style="font-size:14px;color:#afafaf">Nå ${a.current_temperature != null ? nf(a.current_temperature, 1) + '°' : '–'}${a.current_humidity != null ? ' · ' + a.current_humidity + ' %' : ''}</span></div>
          <div class="chips">${modes.map((m) => `<button class="chip ${s.state === m ? 'on' : ''}" data-a="hvac" data-v="${m}"><ha-icon icon="${m === 'off' ? 'mdi:power' : m === 'heat' ? 'mdi:fire' : m === 'cool' ? 'mdi:snowflake' : 'mdi:thermostat-auto'}"></ha-icon>${HVAC[m] || m}</button>`).join('')}</div>`;
      }
      if (d === 'lock') {
        const lk = s.state === 'locked';
        return `<button class="big" data-a="lock" style="background:${lk ? C.green : C.red};color:#232323"><ha-icon icon="${lk ? 'mdi:lock' : 'mdi:lock-open-variant'}"></ha-icon></button><div class="val" style="font-size:34px">${ST[s.state] || s.state}</div><div class="note">Trykk for å ${lk ? 'låse opp' : 'låse'}</div>`;
      }
      if (d === 'media_player') {
        const pl = s.state === 'playing', vol = Math.round((a.volume_level || 0) * 100), src = a.source_list || [];
        return `<div class="art">${a.entity_picture ? `<img src="${esc(a.entity_picture)}" alt="">` : 'cover art'}</div>
          <div class="mt"><b>${esc(a.media_title || ST[s.state] || s.state)}</b><span>${esc(a.media_artist || a.app_name || '')}</span></div>
          <div class="row" style="align-items:center"><button class="cb" data-a="svc" data-s="media_previous_track"><ha-icon icon="mdi:skip-previous"></ha-icon></button><button class="cb pri" data-a="svc" data-s="media_play_pause"><ha-icon icon="${pl ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button><button class="cb" data-a="svc" data-s="media_next_track"><ha-icon icon="mdi:skip-next"></ha-icon></button></div>
          <div class="card line" style="padding:8px 20px;border-radius:32px"><button data-a="mute" style="--mdc-icon-size:22px;display:grid"><ha-icon icon="${a.is_volume_muted ? 'mdi:volume-off' : 'mdi:volume-high'}"></ha-icon></button>${this.hslider('vol', a.is_volume_muted ? 0 : vol)}<span style="width:44px;text-align:right;font-size:14px">${vol} %</span></div>
          ${src.length ? `<div class="chips">${src.map((x) => `<button class="chip ${a.source === x ? 'on' : ''}" data-a="source" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
          <div class="row"><button class="chip" data-a="svc" data-s="${s.state === 'off' ? 'turn_on' : 'turn_off'}"><ha-icon icon="mdi:power"></ha-icon>${s.state === 'off' ? 'Slå på' : 'Slå av'}</button></div>`;
      }
      if (d === 'alarm_control_panel') {
        const A = [['alarm_arm_home', 'Hjemme', 'mdi:home-lock', 'armed_home'], ['alarm_arm_away', 'Borte', 'mdi:shield-lock', 'armed_away'], ['alarm_arm_night', 'Natt', 'mdi:weather-night', 'armed_night'], ['alarm_disarm', 'Av', 'mdi:shield-off-outline', 'disarmed']];
        const armed = s.state !== 'disarmed';
        return `<div class="big" style="background:${armed ? C.red : '#3a3a3a'};color:${armed ? '#232323' : '#fafafa'}"><ha-icon icon="${armed ? 'mdi:shield-lock' : 'mdi:shield-off-outline'}"></ha-icon></div><div class="val" style="font-size:34px">${ST[s.state] || s.state}</div>
          <div class="acts">${A.map(([sv, l, ic, stt]) => `<button class="act ${s.state === stt ? 'on' : ''}" data-a="svc" data-s="${sv}"><span class="ai"><ha-icon icon="${ic}"></ha-icon></span>${l}</button>`).join('')}</div>`;
      }
      if (d === 'vacuum') {
        return `<div class="big" style="background:${s.state === 'cleaning' ? C.green : '#3a3a3a'};color:${s.state === 'cleaning' ? '#232323' : '#fafafa'}"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div><div class="val" style="font-size:34px">${ST[s.state] || s.state}</div>${a.battery_level != null ? `<div class="sub">Batteri ${a.battery_level} %</div>` : ''}
          <div class="acts"><button class="act" data-a="svc" data-s="start"><span class="ai"><ha-icon icon="mdi:play"></ha-icon></span>Start</button><button class="act" data-a="svc" data-s="return_to_base"><span class="ai"><ha-icon icon="mdi:home-import-outline"></ha-icon></span>Til lading</button></div>`;
      }
      if (d === 'valve') {
        const op = s.state === 'open';
        return `<button class="tg" data-a="valve" style="${op ? `background:${C.blue}` : ''}"><span class="kn" style="top:${op ? 8 : 174}px"><ha-icon icon="mdi:valve"></ha-icon></span></button><div class="val" style="font-size:34px">${op ? 'Åpen' : 'Lukket'}</div>`;
      }
      if (d === 'camera') return `<div class="ph">${a.entity_picture ? `<img src="${esc(a.entity_picture)}" style="width:100%;height:100%;object-fit:cover;border-radius:28px" alt="">` : 'kamerastrøm (krever ekte HA)'}</div><div class="note">${ST[s.state] || s.state}</div>`;
      if (d === 'person' || d === 'device_tracker') {
        const hm = s.state === 'home';
        return `<div class="big" style="background:${hm ? C.green : C.blue};color:#232323;overflow:hidden">${a.entity_picture ? `<img src="${esc(a.entity_picture)}" style="width:100%;height:100%;object-fit:cover" alt="">` : '<ha-icon icon="mdi:account"></ha-icon>'}</div><div class="val" style="font-size:34px">${ST[s.state] || s.state}</div><div class="ph" style="height:140px">kart · ${esc(a.friendly_name || '')}</div>`;
      }
      if (d === 'weather') return `<div class="val">${a.temperature != null ? nf(a.temperature, 0) : '–'}<small>°</small></div><div class="sub">${ST[s.state] || s.state}</div><div class="card kv">${[['Fukt', a.humidity != null ? a.humidity + ' %' : '–'], ['Vind', a.wind_speed != null ? nf(a.wind_speed, 1) + ' m/s' : '–'], ['Trykk', a.pressure != null ? a.pressure + ' hPa' : '–']].map(([k, v]) => `<div><span>${k}</span><b style="font-weight:500">${v}</b></div>`).join('')}</div>`;
      if (d === 'input_select' || d === 'select') return `<div class="chips">${(a.options || []).map((o) => `<button class="chip ${s.state === o ? 'on' : ''}" data-a="select" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      const num = parseFloat(s.state);
      if (!isNaN(num) && isFinite(s.state)) return `<div class="val">${esc(s.state.replace('.', ','))}${a.unit_of_measurement ? `<small>${esc(a.unit_of_measurement)}</small>` : ''}</div><div class="sub">Oppdatert ${this.ago(s)}</div>${this.chart(s)}`;
      return `<div class="big" style="background:${on ? col : '#3a3a3a'};color:${on ? '#232323' : '#fafafa'}"><ha-icon icon="${this.icon(s)}"></ha-icon></div><div class="val" style="font-size:34px">${esc(this.stateTxt(s))}</div><div class="sub">Endret ${this.ago(s)}</div>`;
    }
    chart(s) {
      const H = this.hist[s.entity_id] || [], v = H.map((x) => parseFloat(x.s)).filter((x) => !isNaN(x));
      if (v.length < 2) return `<div class="card"><div class="note">Henter historikk …</div></div>`;
      const mn = Math.min(...v), mx = Math.max(...v), lo = mn - (mx - mn) * 0.15 - 0.01, hi = mx + (mx - mn) * 0.15 + 0.01;
      const pts = v.map((x, i) => `${(i / (v.length - 1) * 300).toFixed(1)},${(100 - (x - lo) / (hi - lo) * 100).toFixed(1)}`).join(' ');
      const u = s.attributes.unit_of_measurement || '', d = Math.abs(mx) < 10 ? 1 : 0;
      return `<div class="card"><div style="display:flex;justify-content:space-between;font-size:13px;color:#afafaf;margin-bottom:10px"><span>Siste 24 timer</span><span>${nf(mn, d)}–${nf(mx, d)} ${esc(u)}</span></div>
        <div class="chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none"><polyline points="0,100 ${pts} 300,100" fill="rgba(115,185,242,.18)"></polyline><polyline points="${pts}" fill="none" stroke="${C.blue}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"></polyline></svg></div>
        <div class="ax"><span>−24 t</span><span>−12 t</span><span>Nå</span></div></div>`;
    }
    histTab(s) {
      const num = !isNaN(parseFloat(s.state)) && isFinite(s.state);
      if (num) return this.chart(s);
      const on = ON(s), col = COLOR[s.entity_id.split('.')[0]] || C.pink, hrs = Math.max(1, Math.min(23, Math.round((Date.now() - new Date(s.last_changed).getTime()) / 3600000)));
      const seg = (w, c, t) => `<span style="flex:${w};background:${c}" title="${t}"></span>`;
      return `<div class="card"><div style="font-size:13px;color:#afafaf;margin-bottom:12px">Siste 24 timer</div><div class="tl">${seg(9, on ? '#545454' : col, '')}${seg(5, on ? col : '#545454', '')}${seg(24 - 14 - hrs > 0 ? 24 - 14 - hrs : 1, on ? '#545454' : col, '')}${seg(hrs, on ? col : '#545454', '')}</div><div class="ax"><span>−24 t</span><span>−12 t</span><span>Nå</span></div>
        <div class="kv" style="margin-top:12px"><div><span>Nå</span><b style="font-weight:500">${esc(this.stateTxt(s))}</b></div><div><span>Endret</span><b style="font-weight:500">${this.ago(s)}</b></div></div></div>`;
    }
    detTab(s) {
      const a = s.attributes, skip = ['friendly_name', 'entity_picture', 'supported_features', 'icon'];
      const rows = [['Entitet', s.entity_id], ['Tilstand', s.state], ['Område', this.area(s.entity_id) || '–'], ...Object.keys(a).filter((k) => !skip.includes(k)).map((k) => [k, Array.isArray(a[k]) ? a[k].slice(0, 8).join(', ') + (a[k].length > 8 ? ' …' : '') : typeof a[k] === 'object' && a[k] ? JSON.stringify(a[k]).slice(0, 80) : String(a[k])])];
      return `<div class="card kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><code>${esc(v)}</code></div>`).join('')}</div>`;
    }
    render() {
      const h = this.hass, s = h && this.eid && h.states[this.eid];
      if (!s) { this.shadowRoot.innerHTML = `<style>${CSS}</style>`; return; }
      const d = s.entity_id.split('.')[0], on = ON(s), col = COLOR[d] || C.pink;
      const icBg = on ? (d === 'light' && s.attributes.rgb_color ? `rgb(${s.attributes.rgb_color.join(',')})` : col) : '#3a3a3a';
      const ar = this.area(s.entity_id);
      const sc = this.shadowRoot.querySelector('.bdy'), top = sc ? sc.scrollTop : 0;
      const body = this.tab === 'hist' ? this.histTab(s) : this.tab === 'det' ? this.detTab(s) : this.ctl(s);
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="bd" data-a="close"></div>
        <div class="sh"><div class="grab"><i></i></div>
          <div class="hd"><span class="ic" style="background:${icBg};color:${on ? '#232323' : '#fafafa'}"><ha-icon icon="${this.icon(s)}"></ha-icon></span>
            <span class="tt"><b>${esc((n => n.charAt(0).toUpperCase() + n.slice(1))(String(s.attributes.friendly_name || s.entity_id)))}</b><span>${esc([ar, this.stateTxt(s)].filter(Boolean).join(' · '))}</span></span>
            <button class="x" data-a="close" aria-label="Lukk"><ha-icon icon="mdi:close"></ha-icon></button></div>
          <div class="seg">${[['ctl', 'Kontroll'], ['hist', 'Historikk'], ['det', 'Detaljer']].map(([k, l]) => `<button class="${this.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>
          <div class="bdy">${body}</div></div>`;
      const nb = this.shadowRoot.querySelector('.bdy'); if (nb && top) nb.scrollTop = top;
      this.bind();
    }
    bind() { this.bindBody(true); this.bindSheet(); }
    bindBody(all) {
      const R = this.shadowRoot, s = this.hass.states[this.eid];
      (all ? R : R.querySelector('.bdy')).querySelectorAll('[data-a]').forEach((el) => el.addEventListener('click', (e) => {
        const x = el.dataset, a = s.attributes;
        e.stopPropagation();
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) { /* */ }
        switch (x.a) {
          case 'close': return this.close();
          case 'tab': this.tab = x.v; R.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === x.v)); return this.renderBody();
          case 'toggle': return this.call(s.entity_id.split('.')[0] === 'light' || s.entity_id.split('.')[0] === 'fan' ? s.entity_id.split('.')[0] : 'homeassistant', 'toggle');
          case 'svc': return this.call(s.entity_id.split('.')[0], x.s);
          case 'color': return this.call('light', 'turn_on', x.k === 'ct' ? { color_temp_kelvin: Number(x.v), rgb_color: undefined } : { rgb_color: x.v.split(',').map(Number) });
          case 'temp': return this.call('climate', 'set_temperature', { temperature: Math.max(a.min_temp || 5, Math.min(a.max_temp || 30, Math.round(((a.temperature || 20) + Number(x.d) * (a.target_temp_step || 0.5)) * 10) / 10)) });
          case 'hvac': return this.call('climate', 'set_hvac_mode', { hvac_mode: x.v });
          case 'lock': return this.call('lock', s.state === 'locked' ? 'unlock' : 'lock');
          case 'mute': return this.call('media_player', 'volume_mute', { is_volume_muted: !a.is_volume_muted });
          case 'source': return this.call('media_player', 'select_source', { source: x.v });
          case 'select': return this.call(s.entity_id.split('.')[0], 'select_option', { option: x.v });
          case 'valve': return this.call('valve', s.state === 'open' ? 'close_valve' : 'open_valve');
        }
      }));
      const drag = (el, axis, fn) => {
        let on = false;
        const pos = (e) => { const r = el.getBoundingClientRect(); const p = axis === 'y' ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; return Math.round(Math.max(0, Math.min(1, p)) * 100); };
        const vis = (p) => {
          if (axis === 'y') { const f = el.querySelector('.f'), k = el.querySelector('.k'), lab = el.querySelector('.lab'); f.style.height = p + '%'; k.style.bottom = `calc(${p}% - 14px)`; k.style.opacity = p > 6 ? 1 : 0; lab.style.color = p > 14 ? '#232323' : '#afafaf'; const v = R.querySelector('.val'); if (v) v.innerHTML = p ? `${p}<small>%</small>` : (el.dataset.vs === 'pos' ? '0<small>%</small>' : 'Av'); }
          else { el.querySelector('i').style.width = p + '%'; el.querySelector('b').style.left = p + '%'; }
        };
        el.addEventListener('pointerdown', (e) => { on = true; this._sliding = true; el.setPointerCapture(e.pointerId); vis(pos(e)); e.stopPropagation(); });
        el.addEventListener('pointermove', (e) => { if (on) vis(pos(e)); });
        el.addEventListener('pointerup', (e) => { if (!on) return; on = false; fn(pos(e)); setTimeout(() => { this._sliding = false; this.refresh(); }, 250); });
        el.addEventListener('pointercancel', () => { on = false; this._sliding = false; });
      };
      R.querySelectorAll('[data-vs]').forEach((el) => drag(el, 'y', (p) => {
        const k = el.dataset.vs;
        if (k === 'bri') this.call('light', p ? 'turn_on' : 'turn_off', p ? { brightness_pct: p } : {});
        else if (k === 'fan') this.call('fan', p ? 'set_percentage' : 'turn_off', p ? { percentage: p } : {});
        else if (k === 'pos') this.call('cover', 'set_cover_position', { position: p });
      }));
      R.querySelectorAll('[data-hs]').forEach((el) => drag(el, 'x', (p) => this.call('media_player', 'volume_set', { volume_level: p / 100 })));
    }
    bindSheet() {
      const R = this.shadowRoot;
      // Dra arket ned for å lukke (håndtak og header)
      const sh = R.querySelector('.sh');
      R.querySelectorAll('.grab,.hd').forEach((g) => {
        g.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-a]')) return; this._drag = { y: e.clientY, dy: 0 }; sh.classList.add('drag'); g.setPointerCapture(e.pointerId); });
        g.addEventListener('pointermove', (e) => { if (!this._drag) return; this._drag.dy = Math.max(0, e.clientY - this._drag.y); this.style.setProperty('--dy', this._drag.dy + 'px'); });
        const end = () => { if (!this._drag) return; const dy = this._drag.dy; this._drag = null; sh.classList.remove('drag'); if (dy > 110) this.close(); else this.style.setProperty('--dy', '0px'); };
        g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
      });
    }
    refresh() {
      if (!this.hasAttribute('open') || this._drag || this._sliding) return;
      const s = this.hass && this.eid && this.hass.states[this.eid]; if (!s) return;
      const sig = s.state + JSON.stringify(s.attributes);
      if (sig === this._sig) return;
      this._sig = sig;
      clearTimeout(this._rt); this._rt = setTimeout(() => this.renderBody(), 60);
    }
    renderBody() {
      const R = this.shadowRoot, s = this.hass.states[this.eid], b = R.querySelector('.bdy'), hd = R.querySelector('.hd');
      if (!b || !s) return this.render();
      const d = s.entity_id.split('.')[0], on = ['on', 'open', 'playing', 'unlocked', 'heat', 'cool', 'auto', 'heat_cool', 'cleaning', 'home', 'armed_away', 'armed_home', 'armed_night', 'triggered'].includes(s.state);
      const top = b.scrollTop;
      b.innerHTML = this.tab === 'hist' ? this.histTab(s) : this.tab === 'det' ? this.detTab(s) : this.ctl(s);
      b.scrollTop = top;
      const sub = hd && hd.querySelector('.tt span'); if (sub) sub.textContent = [this.area(s.entity_id), this.stateTxt(s)].filter(Boolean).join(' · ');
      const ic = hd && hd.querySelector('.ic');
      if (ic) { const col = { light: '#f2d26f', switch: '#66d19e', input_boolean: '#66d19e', fan: '#73b9f2', cover: '#f285c9', climate: '#f2b573', lock: '#66d19e', media_player: '#f285c9', alarm_control_panel: '#f28073', vacuum: '#66d19e', valve: '#73b9f2', person: '#66d19e', sensor: '#73b9f2', binary_sensor: '#f2d26f' }[d] || '#f285c9'; ic.style.background = on ? (d === 'light' && s.attributes.rgb_color ? 'rgb(' + s.attributes.rgb_color.join(',') + ')' : col) : '#3a3a3a'; ic.style.color = on ? '#232323' : '#fafafa'; }
      this.bindBody();
    }
  }
  const mi = new KiMoreInfo();
  window.__kiMore = mi;
  const mount = () => document.body.appendChild(mi.host);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('hass-more-info', (e) => { const id = e.detail && e.detail.entityId; if (id) mi.open(id); else mi.close(); });
  window.addEventListener('ki-hass', () => mi.refresh());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') mi.close(); });
})();
