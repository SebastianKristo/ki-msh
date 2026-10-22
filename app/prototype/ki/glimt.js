// Glimt – AI-agenten i Nordlys OS, her som assistent i Home Assistant-appen.
// Merke (ring med konisk gradient + 4-spisset stjerne + to små glimt), tilstander Klar/Tenker/Svarer/Ferdig,
// AI-boble «Glimt · lokal», fullskjerms chat med «Spør Glimt …», Glimt Brief og verktøy mot hass (Claude via window.claude).
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const H = () => window.__H;
  const AND = /android/.test(location.search);
  const LS = 'ki-proto-glimt';
  let CFG; try { CFG = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { CFG = {}; }
  const DEFCFG = { provider: 'claude', ollamaUrl: 'http://homeassistant.local:11434', ollamaModel: 'qwen2.5:7b', model: 'claude-haiku-4-5', control: true, autos: true, brief: true, bubble: true };
  CFG = { ...DEFCFG, ...CFG };
  const reloadCfg = () => { try { CFG = { ...DEFCFG, ...(JSON.parse(localStorage.getItem(LS)) || {}) }; } catch (e) {} };
  window.addEventListener('storage', (e) => { if (e.key === LS) { reloadCfg(); if (window.kiGlimt && window.kiGlimt._vis) window.kiGlimt._vis(); } });
  const OLL_DEMO = [['qwen2.5:7b', '4,7 GB'], ['llama3.2:3b', '2,0 GB'], ['mistral-nemo:12b', '7,1 GB']];
  const provLabel = () => CFG.provider === 'ollama' ? 'Ollama · ' + CFG.ollamaModel : CFG.provider === 'off' ? 'av' : (AI() ? (CFG.model.includes('sonnet') ? 'Sonnet' : 'Haiku') : 'lokal');
  // Ollama: /api/chat med verktøy (samme verktøy som Claude), maks 5 runder
  const ollamaChat = async (hist) => {
    const url = String(CFG.ollamaUrl || '').replace(/\/$/, '');
    const msgs = [{ role: 'system', content: SYSTEM() }, ...hist];
    const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    for (let i = 0; i < 5; i++) {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: CFG.ollamaModel, messages: msgs, tools, stream: false }), signal: ac.signal });
      clearTimeout(tm);
      if (!r.ok) throw new Error('Ollama svarte ' + r.status);
      const j = await r.json(), m = j.message || {};
      msgs.push(m);
      if (m.tool_calls && m.tool_calls.length) {
        for (const c of m.tool_calls) {
          const f = c.function || {}, t = TOOLS.find((x) => x.name === f.name);
          let out; try { out = t ? await t.run(typeof f.arguments === 'string' ? JSON.parse(f.arguments) : f.arguments || {}) : 'Ukjent verktøy'; } catch (e) { out = 'Feil: ' + e.message; }
          msgs.push({ role: 'tool', content: String(out), tool_name: f.name });
        }
        continue;
      }
      return m.content || '';
    }
    return 'Ferdig.';
  };
  const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(CFG)); } catch (e) {} };
  const AI = () => window.claude || (window.parent && window.parent.claude) || (window.top && window.top.claude) || null;
  const haptic = (ms) => { try { navigator.vibrate && navigator.vibrate(ms || 10); } catch (e) {} };

  // ---------------------------------------------------------------- merket
  const STAR = 'M12 1.5C12.9 8.4 15.6 11.1 22.5 12C15.6 12.9 12.9 15.6 12 22.5C11.1 15.6 8.4 12.9 1.5 12C8.4 11.1 11.1 8.4 12 1.5Z';
  const MARK_CSS = `
  .gm{position:relative;display:inline-block;flex:none;width:var(--s,24px);height:var(--s,24px);--dur:6s}
  .gm .r{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#b23a2a,#e8794a,#7a5ad6,#3fbf9a,#b23a2a);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - var(--rw,2.5px)),#000 calc(100% - var(--rw,2.5px)));mask:radial-gradient(farthest-side,transparent calc(100% - var(--rw,2.5px)),#000 calc(100% - var(--rw,2.5px)));animation:gm-spin var(--dur) linear infinite;transition:background .3s}
  .gm .st{position:absolute;left:21%;top:21%;width:58%;height:58%;transition:transform .45s cubic-bezier(.34,1.56,.64,1),opacity .2s}
  .gm .g1,.gm .g2{position:absolute;width:24%;height:24%;animation:gm-tw 2.4s ease-in-out infinite}
  .gm .g1{right:-4%;top:-4%}.gm .g2{left:-2%;bottom:0;width:17%;height:17%;animation-delay:1.2s}
  .gm .ck{position:absolute;left:22%;top:22%;width:56%;height:56%;opacity:0;transform:scale(0)}
  .gm.tenker{--dur:1.4s}.gm.tenker .st{transform:rotate(45deg)}
  .gm.svarer{--dur:2.6s}
  .gm.ferdig .r{background:#3fbf9a;animation:none}
  .gm.ferdig .st,.gm.ferdig .g1,.gm.ferdig .g2{opacity:0}
  .gm.ferdig .ck{animation:gm-pop .45s cubic-bezier(.34,1.56,.64,1) forwards}
  @keyframes gm-spin{to{transform:rotate(360deg)}}
  @keyframes gm-tw{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
  @keyframes gm-pop{0%{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
  @media (prefers-reduced-motion:reduce){.gm .r,.gm .g1,.gm .g2{animation:none}}`;
  let gid = 0;
  const mark = (size, state) => {
    const id = 'gmg' + (++gid), rw = Math.max(1.8, size * 0.1);
    return `<span class="gm ${state || 'klar'}" style="--s:${size}px;--rw:${rw}px"><span class="r"></span>
      <svg class="st" viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb38a"/><stop offset="1" stop-color="#ff5a3c"/></linearGradient></defs><path d="${STAR}" fill="url(#${id})"/></svg>
      <svg class="g1" viewBox="0 0 24 24"><path d="${STAR}" fill="#ffb38a"/></svg><svg class="g2" viewBox="0 0 24 24"><path d="${STAR}" fill="#ffd2b8"/></svg>
      <svg class="ck" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#3fbf9a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  };
  window.glimtMark = mark;

  // ---------------------------------------------------------------- verktøy mot hass
  const areaOf = (id) => { const h = H(), e = h.entities && h.entities[id], a = e && e.area_id && h.areas[e.area_id]; return a ? a.name : ''; };
  const name = (id) => { const s = H().states[id]; return (s && s.attributes.friendly_name) || id; };
  const fmt = (s) => { const u = s.attributes.unit_of_measurement; return s.state + (u ? ' ' + u : ''); };
  const SKIP = /^(update|button|event|tts|conversation|stt|wake_word|assist_satellite|image|text|date|time|datetime|todo|calendar|sun|zone|input_text)\./;
  const listStates = (q, dom) => {
    const h = H(); if (!h) return [];
    const ql = (q || '').toLowerCase();
    return Object.keys(h.states).filter((id) => !SKIP.test(id) && (!dom || id.startsWith(dom + '.')) && (!ql || (id + ' ' + name(id) + ' ' + areaOf(id)).toLowerCase().includes(ql)))
      .slice(0, 70).map((id) => { const s = h.states[id], a = s.attributes; let x = `${id} | ${name(id)} | ${fmt(s)}`; const ar = areaOf(id); if (ar) x += ` | ${ar}`; if (id.startsWith('light.') && s.state === 'on' && a.brightness) x += ` | ${Math.round(a.brightness / 2.55)}%`; if (id.startsWith('climate.')) x += ` | mål ${a.temperature}° nå ${a.current_temperature}°`; return x; });
  };
  const done = [];
  const svc = (domain, service, entity_id, data) => {
    const h = H(); if (!h) return 'Ingen tilkobling';
    if (!CFG.control) return 'Glimt har ikke lov til å styre enheter (Glimt-innstillinger).';
    const ids = [].concat(entity_id || []).filter((id) => h.states[id]);
    if (!ids.length) return 'Fant ingen av entitetene: ' + [].concat(entity_id || []).join(', ');
    h.callService(domain, service, { entity_id: ids, ...(data || {}) });
    const verb = { turn_on: 'Slo på', turn_off: 'Slo av', toggle: 'Byttet', lock: 'Låste', unlock: 'Låste opp', set_temperature: 'Satte temperatur', open_cover: 'Åpnet', close_cover: 'Lukket', set_cover_position: 'Satte posisjon', media_play_pause: 'Spill/pause', alarm_arm_away: 'Slo på alarmen', alarm_disarm: 'Slo av alarmen' }[service] || service;
    done.push({ icon: domain === 'light' ? 'mdi:lightbulb' : domain === 'lock' ? 'mdi:lock' : domain === 'climate' ? 'mdi:thermostat' : domain === 'cover' ? 'mdi:curtains' : domain === 'alarm_control_panel' ? 'mdi:shield-home' : 'mdi:check', text: `${verb} ${ids.map(name).join(', ')}${data && data.temperature ? ' til ' + data.temperature + '°' : data && data.brightness_pct ? ' til ' + data.brightness_pct + ' %' : ''}` });
    return 'OK: ' + service + ' på ' + ids.join(', ');
  };
  const TOOLS = [
    { name: 'finn_entiteter', description: 'Søk etter Home Assistant-entiteter og tilstandene deres. Bruk før du styrer noe eller svarer om status. Returnerer linjer «entity_id | navn | tilstand | område».', input_schema: { type: 'object', properties: { sok: { type: 'string', description: 'Fritekst, f.eks. «stue», «lys», «temperatur». Tom = alt.' }, domene: { type: 'string', description: 'Valgfritt domene, f.eks. light, climate, sensor, lock, cover, media_player, switch, person.' } } },
      run: async (i) => { const L = listStates(i.sok, i.domene); return L.length ? L.join('\n') : 'Ingen treff'; } },
    { name: 'utfor_handling', description: 'Kall en Home Assistant-tjeneste. Eksempler: light.turn_on (data.brightness_pct), light.turn_off, climate.set_temperature (data.temperature), lock.lock, cover.set_cover_position (data.position), media_player.media_play_pause, alarm_control_panel.alarm_arm_away.', input_schema: { type: 'object', properties: { domene: { type: 'string' }, tjeneste: { type: 'string' }, entity_id: { type: 'array', items: { type: 'string' } }, data: { type: 'object' } }, required: ['domene', 'tjeneste', 'entity_id'] },
      run: async (i) => svc(i.domene, i.tjeneste, i.entity_id, i.data) },
    { name: 'lag_automasjon', description: 'Lag en Home Assistant-automasjon. Bruk moderne syntaks: triggers (trigger: state|time|sun|numeric_state|zone), conditions (condition: …), actions (action: domene.tjeneste, target.entity_id, data, eller delay).', input_schema: { type: 'object', properties: { alias: { type: 'string' }, description: { type: 'string' }, triggers: { type: 'array', items: { type: 'object' } }, conditions: { type: 'array', items: { type: 'object' } }, actions: { type: 'array', items: { type: 'object' } } }, required: ['alias', 'triggers', 'actions'] },
      run: async (i) => {
        if (!CFG.autos) return 'Glimt har ikke lov til å lage automasjoner (Glimt-innstillinger).';
        if (!window.kiSettings || !window.kiSettings.addAutomation) return 'Automasjonseditoren er ikke lastet';
        const id = window.kiSettings.addAutomation({ alias: i.alias, description: i.description || 'Laget av Glimt', triggers: i.triggers || [], conditions: i.conditions || [], actions: i.actions || [] });
        done.push({ icon: 'mdi:robot-outline', text: `Laget automasjonen «${i.alias}»`, open: id });
        return 'Automasjonen er lagret med id ' + id;
      } },
    { name: 'apne_visning', description: 'Åpne en popup i dashbordet, f.eks. #stue, #klima, #lys, #strom, #media, #sikkerhet, #kamera, #vaer.', input_schema: { type: 'object', properties: { hash: { type: 'string' } }, required: ['hash'] },
      run: async (i) => { G.pendingHash = i.hash; done.push({ icon: 'mdi:open-in-app', text: 'Åpner ' + i.hash, hash: i.hash }); return 'Åpnes når chatten lukkes'; } }
  ];
  const SYSTEM = () => `Du er Glimt, AI-agenten i Nordlys OS, her koblet til Home Assistant i familiens Companion-app (KI MSH-dashbordet). Svar alltid på norsk bokmål, kort og direkte (1–3 setninger), uten emoji og uten markdown-overskrifter. Bruk verktøyene: finn_entiteter før du svarer om status eller styrer noe; aldri finn på verdier. Forstå klokkeslett som 16:00, 16h, kl 16. Når brukeren ber om noe som skal skje regelmessig eller på et tidspunkt, lag en automasjon med lag_automasjon. Etter en handling: bekreft kort hva du gjorde. Tidspunkt nå: ${new Date().toLocaleString('nb-NO')}.`;

  // Uten Claude: enkel lokal tolkning (lys av/på, temperatur, status)
  const local = async (t) => {
    const s = t.toLowerCase(), h = H();
    const lights = Object.keys(h.states).filter((id) => id.startsWith('light.') && !/status/.test(id));
    const room = (h.areas && Object.values(h.areas).find((a) => s.includes(a.name.toLowerCase()))) || null;
    const inRoom = (ids) => (room ? ids.filter((id) => (h.entities[id] || {}).area_id === room.area_id) : ids);
    if (/lys/.test(s) && /(av|slukk)/.test(s)) { const L = inRoom(lights).filter((id) => h.states[id].state === 'on'); if (!L.length) return 'Alle lysene er allerede av' + (room ? ' i ' + room.name.toLowerCase() : '') + '.'; svc('light', 'turn_off', L); return `Slo av ${L.length} lys${room ? ' i ' + room.name.toLowerCase() : ''}.`; }
    if (/lys/.test(s) && /(på|tenn|slå på)/.test(s)) { const L = inRoom(lights); const m = s.match(/(\d{1,3})\s*%/); svc('light', 'turn_on', L, m ? { brightness_pct: Number(m[1]) } : {}); return `Slo på ${L.length} lys${room ? ' i ' + room.name.toLowerCase() : ''}${m ? ' til ' + m[1] + ' %' : ''}.`; }
    const tm = s.match(/(\d{1,2}([.,]\d)?)\s*(°|grader)/);
    if (tm) { const c = Object.keys(h.states).filter((id) => id.startsWith('climate.')); const L = inRoom(c); if (L.length) { const v = Number(tm[1].replace(',', '.')); svc('climate', 'set_temperature', L, { temperature: v }); return `Satte ${L.map(name).join(' og ')} til ${String(v).replace('.', ',')}°.`; } }
    if (/(varm|temperatur|grader)/.test(s)) { const L = Object.keys(h.states).filter((id) => h.states[id].attributes.device_class === 'temperature' && (!room || (h.entities[id] || {}).area_id === room.area_id)); return L.length ? L.slice(0, 4).map((id) => `${name(id)}: ${h.states[id].state.replace('.', ',')}°`).join(', ') + '.' : 'Fant ingen temperatursensorer.'; }
    if (/(lås|dør)/.test(s)) { const L = Object.keys(h.states).filter((id) => id.startsWith('lock.')); if (/(lås opp)/.test(s)) { svc('lock', 'unlock', L); return 'Låste opp ' + L.map(name).join(', ') + '.'; } if (/lås/.test(s)) { svc('lock', 'lock', L); return 'Låste ' + L.map(name).join(', ') + '.'; } }
    if (/(strøm|watt|effekt)/.test(s)) { const p = h.states['sensor.hele_huset_effekt']; return p ? `Huset bruker ${p.state} W nå.` : 'Fant ikke effektsensoren.'; }
    return 'Jeg er i lokal modus uten språkmodell. Prøv «slå av lysene i stua», «sett stua til 22 grader» eller «hvor varmt er det?».';
  };

  // Glimt Brief: daglig oppsummering fra tilstandene (lokalt, uten modell)
  const brief = () => {
    const h = H(); if (!h) return null;
    const S = h.states, on = Object.keys(S).filter((id) => id.startsWith('light.') && S[id].state === 'on' && !/status/.test(id));
    const w = Object.values(S).find((s) => s.entity_id.startsWith('weather.'));
    const p = S['sensor.hele_huset_effekt'], pr = S['sensor.nordpool_kwh'], lk = Object.keys(S).filter((id) => id.startsWith('lock.'));
    const unl = lk.filter((id) => S[id].state !== 'locked'), al = Object.keys(S).find((id) => id.startsWith('alarm_control_panel.'));
    const home = Object.keys(S).filter((id) => id.startsWith('person.') && S[id].state === 'home').map((id) => name(id));
    const items = [];
    if (w) items.push(['mdi:weather-partly-cloudy', `${Math.round(w.attributes.temperature)}° og ${({ partlycloudy: 'delvis skyet', cloudy: 'skyet', sunny: 'sol', rainy: 'regn' })[w.state] || w.state} ute`]);
    if (p) items.push(['mdi:flash', `${p.state} W nå${pr ? ` · ${(Math.round(parseFloat(pr.state) * 100) / 100).toFixed(2).replace('.', ',')} kr/kWh` : ''}`]);
    items.push(['mdi:lightbulb-group', on.length ? `${on.length} lys på` : 'Alle lys er av']);
    if (unl.length) items.push(['mdi:lock-open-variant', `${unl.map(name).join(', ')} er ulåst`, true]);
    if (al) items.push(['mdi:shield-home', S[al].state === 'disarmed' ? 'Alarmen er av' : 'Alarmen er på']);
    if (home.length) items.push(['mdi:home-account', `Hjemme: ${home.join(', ')}`]);
    return items;
  };

  // ---------------------------------------------------------------- UI
  const PK = 'linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%)';
  const CSS = MARK_CSS + `
  :host{all:initial;font-family:'Space Grotesk',system-ui,sans-serif;color:#fafafa;-webkit-tap-highlight-color:transparent}
  *{box-sizing:border-box}
  button{all:unset;box-sizing:border-box;cursor:pointer;font-family:inherit;-webkit-user-select:none;user-select:none}
  .bub{position:fixed;right:14px;bottom:calc(var(--ki-nav-bottom,8px) + 160px);z-index:30;display:flex;align-items:center;gap:8px;height:44px;padding:0 14px 0 8px;border-radius:22px;background:rgba(40,40,40,.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.08);font-size:13px;font-weight:500;transition:opacity .25s,transform .25s}
  .bub span.t{white-space:nowrap}.bub span.t i{font-style:normal;color:#979797}
  .bub.hid{opacity:0;transform:translateY(12px) scale(.9);pointer-events:none}
  .bub:active{transform:scale(.95)}
  .ch{position:fixed;inset:0;z-index:2147482800;display:flex;flex-direction:column;background:#232323;transform:translateY(100%);visibility:hidden;transition:transform .42s cubic-bezier(.2,.85,.25,1),visibility 0s linear .42s;will-change:transform}
  .ch.open{visibility:visible;transition:transform .42s cubic-bezier(.2,.85,.25,1),visibility 0s}
  .m{animation:gl-in .3s cubic-bezier(.2,.85,.25,1) both}
  @keyframes gl-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.ch,.bub{transition:none}.m{animation:none}}
  .ch.open{transform:none}
  .top{flex:none;height:64px;display:flex;align-items:center;gap:12px;padding:8px 14px 0}
  .ib{width:44px;height:44px;border-radius:22px;background:#2f2f2f;display:grid;place-items:center;--mdc-icon-size:22px;flex:none}
  .ib:active,.chip:active,.send:active,.act:active{transform:scale(.95)}
  .tt{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
  .tt b{font-size:18px;font-weight:500;display:block}.tt span{font-size:12px;color:#979797;display:block;white-space:nowrap}
  .sc{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:10px 16px 16px;display:flex;flex-direction:column;gap:12px}
  .sc::-webkit-scrollbar{display:none}
  .sc>*{flex-shrink:0}
  .brief{border-radius:28px;padding:16px 18px;background:linear-gradient(160deg,rgba(232,121,74,.14),rgba(122,90,214,.10) 55%,rgba(63,191,154,.08)),#2f2f2f;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
  .bh{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:500}.bh small{margin-left:auto;font-size:12px;color:#979797;font-weight:400;white-space:nowrap}
  .bl{display:flex;flex-direction:column;gap:9px;margin-top:12px}
  .bi{display:flex;align-items:center;gap:10px;font-size:14px;color:#e1e1e1;--mdc-icon-size:18px}.bi ha-icon{color:#afafaf}.bi.w{color:#f2b573}.bi.w ha-icon{color:#f2b573}
  .hi{text-align:center;padding:14px 10px 4px;display:flex;flex-direction:column;align-items:center;gap:8px}
  .hi b{display:block;font-size:24px;line-height:1.25;font-weight:500;letter-spacing:-.01em;text-wrap:balance}.hi>span{display:block;font-size:14px;color:#979797;line-height:1.45;max-width:300px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .chip{min-height:38px;padding:8px 14px;border-radius:19px;background:#2f2f2f;font-size:13px;line-height:1.3;color:#e1e1e1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);text-align:center}
  .m{display:flex;gap:10px;max-width:100%}
  .m.u{justify-content:flex-end}
  .m.u .b{background:${PK};color:#2a1720;border-radius:22px 22px 6px 22px}
  .m.a .b{background:#2f2f2f;border-radius:22px 22px 22px 6px}
  .b{max-width:82%;padding:11px 15px;font-size:15px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
  .who{font-size:11px;color:#979797;margin:0 0 4px 2px;display:flex;align-items:center;gap:6px}
  .acts{display:flex;flex-direction:column;gap:6px;margin-top:8px}
  .act{display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 12px 6px 8px;border-radius:18px;background:rgba(63,191,154,.12);color:#8fe0c4;font-size:13px;--mdc-icon-size:16px}
  .act b{font-weight:500;margin-left:auto;color:#fafafa;text-decoration:underline;text-underline-offset:3px}
  .typing{display:flex;align-items:center;gap:10px;color:#979797;font-size:14px}
  .bar{flex:none;padding:10px 14px calc(14px + env(safe-area-inset-bottom));display:flex;gap:10px;align-items:flex-end;background:#232323;box-shadow:0 -1px 0 rgba(255,255,255,.05)}
  .field{flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:52px;border-radius:26px;background:#2f2f2f;padding:6px 8px 6px 14px}
  textarea{flex:1;min-width:0;border:0;outline:none;resize:none;background:none;color:#fafafa;font:15px/1.4 'Space Grotesk',sans-serif;max-height:110px;padding:8px 0}
  textarea::placeholder{color:#7f7f7f}
  .send{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;flex:none;--mdc-icon-size:22px;background:#3a3a3a;color:#7f7f7f;transition:background .2s,color .2s}
  .send.on{background:${PK};color:#2a1720}
  .send.dis{pointer-events:none}
  .set{border-radius:28px;background:#2f2f2f;overflow:hidden}
  .row{display:flex;align-items:center;gap:14px;min-height:60px;padding:8px 16px;border-top:1px solid rgba(255,255,255,.05);width:100%}
  .row:first-child{border-top:0}
  .row .rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.row .rt b{font-size:15px;font-weight:500}.row .rt span{font-size:12.5px;color:#979797}
  .tgl{position:relative;width:50px;height:30px;border-radius:15px;background:#545454;flex:none;transition:background .2s}
  .tgl::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fafafa;transition:left .2s}
  .tgl.on{background:#f285c9}.tgl.on::after{left:23px}
  .seg{display:flex;padding:4px;border-radius:24px;background:#2f2f2f}
  .seg button{flex:1;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:#afafaf;white-space:nowrap}
  .seg button.on{background:${PK};color:#2a1720}
  .lbl{font-size:13px;color:#979797;margin:4px 8px -4px}
  .toast{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483500;display:flex;align-items:center;gap:10px;padding:10px 16px 10px 10px;border-radius:24px;background:#fafafa;color:#232323;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:14px;max-width:88%;transition:opacity .3s,transform .3s}
  .toast b{font-weight:600;margin-right:2px}.toast.hid{opacity:0;transform:translate(-50%,-10px);pointer-events:none}
  `;
  const SUG = ['Slå av alle lysene', 'Hvor varmt er det i stua?', 'Sett stua til 22 grader', 'Tenn utelyset hver dag kl 19', 'Hva bruker mest strøm nå?', 'Lås inngangsdøra'];

  const G = {
    msgs: [], state: 'klar', busy: false, view: 'chat', pendingHash: null,
    init() {
      this.host = document.createElement('div');
      this.root = this.host.attachShadow({ mode: 'open' });
      document.body.appendChild(this.host);
      this.root.innerHTML = `<style>${CSS}</style><button class="bub" aria-label="Spør Glimt">${mark(28)}<span class="t">Glimt <i>· lokal</i></span></button><div class="ch"></div><div class="toast hid"></div>`;
      this.bub = this.root.querySelector('.bub'); this.ch = this.root.querySelector('.ch'); this.tst = this.root.querySelector('.toast');
      this.bub.addEventListener('click', (e) => { if (this._lp) { this._lp = 0; e.preventDefault(); return; } haptic(8); this.open(); });
      // Hold inne på boblen → skjul Glimt-knappen (slås på igjen i Innstillinger → Glimt-knappen på Hjem)
      let lpT = 0; const lpEnd = () => clearTimeout(lpT);
      this.bub.addEventListener('pointerdown', () => { this._lp = 0; clearTimeout(lpT); lpT = setTimeout(() => { this._lp = 1; haptic(12); this.setBubble(false); this.toast('Glimt skjult.', 'Slå på igjen i Innstillinger.'); }, 600); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => this.bub.addEventListener(ev, lpEnd));
      this.bub.addEventListener('contextmenu', (e) => e.preventDefault());
      const vis = () => { const ti = this.bub.querySelector('.t i'); if (ti) ti.textContent = '· ' + (CFG.provider === 'claude' && AI() ? 'sky' : 'lokal'); const open = !!location.hash || (window.kiSettings && window.kiSettings.host.hasAttribute('open')) || this.isOpen; this.bub.classList.toggle('hid', open || CFG.bubble === false || CFG.provider === 'off'); };
      window.addEventListener('hashchange', vis); window.addEventListener('location-changed', vis); window.addEventListener('ki-sheet', vis);
      try { new MutationObserver(vis).observe(window.kiSettings ? window.kiSettings.host : document.body, { attributes: true, attributeFilter: ['open'] }); } catch (e) {}
      this._vis = vis; vis();
    },
    reloadCfg() { reloadCfg(); this._vis && this._vis(); },
    setBubble(on) { CFG.bubble = !!on; saveCfg(); this._vis && this._vis(); },
    open(prefill) { reloadCfg(); this.isOpen = true; this._vis && this._vis(); this.render(); requestAnimationFrame(() => this.ch.classList.add('open')); if (prefill) setTimeout(() => this.send(prefill), 250); },
    close() { this.ch.classList.remove('open'); this.isOpen = false; setTimeout(() => this._vis && this._vis(), 0); if (this.pendingHash) { const h = this.pendingHash; this.pendingHash = null; setTimeout(() => { location.hash = h; }, 350); } },
    toast(title, text) { this.tst.innerHTML = `${mark(24, 'ferdig')}<span><b>${esc(title)}</b> ${esc(text)}</span>`; this.tst.classList.remove('hid'); clearTimeout(this._tt); this._tt = setTimeout(() => this.tst.classList.add('hid'), 2600); },
    setState(s) { this.state = s; this.root.querySelectorAll('.ch .gm').forEach((el) => { el.classList.remove('klar', 'tenker', 'svarer', 'ferdig'); el.classList.add(s); }); },
    async send(text) {
      text = (text || '').trim(); if (!text || this.busy) return;
      this.msgs.push({ r: 'user', t: text }); this.busy = true; done.length = 0; this.render(); this.setState('tenker'); haptic(6);
      let reply = '', note = '';
      if (CFG.provider === 'off') { this.msgs.push({ r: 'a', t: 'Glimt er slått av. Slå på i Glimt-innstillinger (øverst til høyre).' }); this.busy = false; this.render(); this.setState('klar'); return; }
      try {
        const ai = AI();
        if (CFG.provider === 'ollama') {
          const hist = this.msgs.slice(-10).map((m) => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t }));
          setTimeout(() => { if (this.busy) this.setState('svarer'); }, 1600);
          try { reply = await ollamaChat(hist); }
          catch (e) {
            if (ai) { note = 'Ollama svarte ikke · brukte Claude'; reply = await ai.complete({ model: CFG.model, max_tokens: 800, system: SYSTEM(), messages: hist, tools: TOOLS }); }
            else { note = 'Ollama svarte ikke · lokal tolking'; reply = await local(text); }
          }
        } else if (ai) {
          const hist = this.msgs.slice(-10).map((m) => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t }));
          setTimeout(() => { if (this.busy) this.setState('svarer'); }, 1600);
          reply = await ai.complete({ model: CFG.model, max_tokens: 800, system: SYSTEM(), messages: hist, tools: TOOLS });
        } else reply = await local(text);
      } catch (e) {
        try { reply = await local(text); } catch (e2) { reply = 'Noe gikk galt: ' + (e.message || e); }
      }
      this.msgs.push({ r: 'a', t: String(reply || '').trim() || 'Ferdig.', acts: done.slice(), note });
      this.busy = false; this.render(); this.setState('ferdig'); haptic(15);
      if (done.length && !this.isOpen) this.toast('Glimt', done[0].text);
      setTimeout(() => { if (!this.busy) this.setState('klar'); }, 1400);
    },
    renderChat() {
      const items = brief();
      const head = !this.msgs.length ? `
        ${CFG.brief && items ? `<div class="brief"><div class="bh">${mark(22)}Glimt Brief<small>${new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div><div class="bl">${items.map(([ic, t, w]) => `<div class="bi ${w ? 'w' : ''}"><ha-icon icon="${ic}"></ha-icon>${esc(t)}</div>`).join('')}</div></div>` : ''}
        <div class="hi"><b>Hva kan jeg hjelpe med?</b><span>Spør om huset, styr lys, varme og låser, eller be meg lage en automasjon.</span></div>
        <div class="chips">${SUG.map((s) => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
      const msgs = this.msgs.map((m, k) => m.r === 'user' ? `<div class="m u" style="${k < this.msgs.length - 1 ? 'animation:none' : ''}"><div class="b">${esc(m.t)}</div></div>`
        : `<div class="m a" style="${k < this.msgs.length - 1 ? 'animation:none' : ''}"><div style="max-width:86%"><div class="who">${mark(16)}Glimt${m.note ? ` <span style="color:#f2b573">· ${esc(m.note)}</span>` : ''}</div><div class="b" style="max-width:100%">${esc(m.t)}${m.acts && m.acts.length ? `<div class="acts">${m.acts.map((a, k) => `<div class="act"><ha-icon icon="${a.icon}"></ha-icon>${esc(a.text)}${a.open ? `<b data-open="${a.open}">Åpne</b>` : a.hash ? `<b data-hash="${esc(a.hash)}">Vis</b>` : ''}</div>`).join('')}</div>` : ''}</div></div></div>`).join('');
      const typing = this.busy ? `<div class="m a"><div class="typing">${mark(22, 'tenker')}Glimt tenker …</div></div>` : '';
      return `<div class="sc">${head}${msgs}${typing}</div>
        <div class="bar"><div class="field"><textarea rows="1" placeholder="Spør Glimt …" aria-label="Spør Glimt">${esc(this.draft || '')}</textarea></div><button class="send ${this.draft && this.draft.trim() && !this.busy ? 'on' : 'dis'}" aria-label="Send"><ha-icon icon="mdi:arrow-up"></ha-icon></button></div>`;
    },
    renderSettings() {
      const row = (k, t, s) => `<button class="row" data-cfg="${k}"><span class="rt"><b>${t}</b><span>${s}</span></span><span class="tgl ${CFG[k] ? 'on' : ''}"></span></button>`;
      const om = this.ollModels || (/homeassistant\.local:11434/.test(CFG.ollamaUrl) ? OLL_DEMO : []);
      const T = this.ollTest;
      return `<div class="sc">
        <div class="lbl">Kjører på</div>
        <div class="seg">${[['ollama', 'Ollama · lokalt'], ['claude', 'Claude · sky'], ['off', 'Av']].map(([v, l]) => `<button class="${CFG.provider === v ? 'on' : ''}" data-prov="${v}">${l}</button>`).join('')}</div>
        ${CFG.provider === 'ollama' ? `
        <div class="lbl">Ollama-server</div>
        <div style="display:flex;gap:8px"><div class="field" style="min-height:52px"><textarea rows="1" data-ourl style="padding:6px 0" spellcheck="false" autocapitalize="off">${esc(CFG.ollamaUrl)}</textarea></div><button class="chip" data-otest style="height:52px;border-radius:26px;padding:0 18px;font-size:14px">${T === 'busy' ? 'Tester …' : 'Test'}</button></div>
        ${T && T !== 'busy' ? `<div style="font-size:13px;padding:0 10px;line-height:1.4;color:${T.ok ? '#66d19e' : '#f28073'}">${esc(T.msg)}</div>` : ''}
        ${om.length ? `<div class="lbl">Modell</div><div class="chips" style="justify-content:flex-start">${om.map(([n, sz]) => `<button class="chip" data-omodel="${esc(n)}" style="${CFG.ollamaModel === n ? 'background:linear-gradient(145deg,#f285c9 -10%,#f5cdc6 100%);color:#2a1720' : ''}">${esc(n)} <span style="opacity:.6;font-size:11px">${esc(sz)}</span></button>`).join('')}</div>` : ''}
        <div style="font-size:12.5px;color:#979797;padding:0 8px;line-height:1.45">Glimt snakker med Ollama direkte fra telefonen. Ollama må tillate appen (OLLAMA_ORIGINS=*). Svarer ikke Ollama, brukes ${AI() ? 'Claude' : 'lokal tolking'} som reserve.</div>` : ''}
        ${CFG.provider === 'claude' ? `<div class="lbl">Modell</div>
        <div class="seg">${[['claude-haiku-4-5', 'Haiku · rask'], ['claude-sonnet-4-5', 'Sonnet · grundig']].map(([v, l]) => `<button class="${CFG.model === v ? 'on' : ''}" data-model="${v}">${l}</button>`).join('')}</div>` : ''}
        <div class="lbl">Tillatelser</div>
        <div class="set">${row('control', 'Styre enheter', 'Lys, varme, låser, gardiner og media')}${row('autos', 'Lage automasjoner', 'Lagres i Innstillinger → Automasjoner')}</div>
        <div class="lbl">Visning</div>
        <div class="set">${row('brief', 'Glimt Brief', 'Daglig oppsummering øverst i chatten')}${row('bubble', 'AI-boble på Hjem', '«Glimt · lokal» over minispilleren')}</div>
        <div class="set"><button class="row" data-clear><span class="rt"><b>Tøm samtalen</b><span>${this.msgs.length} meldinger</span></span></button></div>
        </div>`;
    },
    render() {
      const sv = this.view === 'set';
      const sc0 = this.ch.querySelector('.sc'); const atBottom = !sc0 || sc0.scrollHeight - sc0.scrollTop - sc0.clientHeight < 40;
      this.ch.innerHTML = `<div class="top"><button class="ib" data-x aria-label="${sv ? 'Tilbake' : 'Lukk'}"><ha-icon icon="${sv ? (AND ? 'mdi:arrow-left' : 'mdi:chevron-left') : 'mdi:close'}"></ha-icon></button>
        <div class="tt">${mark(22, this.state)}<span><b>${sv ? 'Glimt-innstillinger' : 'Glimt'}</b><span>${esc(provLabel())} · Home Assistant</span></span></div>
        ${sv ? '<span style="width:44px"></span>' : '<button class="ib" data-set aria-label="Innstillinger"><ha-icon icon="mdi:tune-variant"></ha-icon></button>'}</div>${sv ? this.renderSettings() : this.renderChat()}`;
      const sc = this.ch.querySelector('.sc'); if (sc && atBottom) sc.scrollTop = sc.scrollHeight;
      this.ch.querySelector('[data-x]').addEventListener('click', () => { if (sv) { this.view = 'chat'; this.render(); } else this.close(); });
      const st = this.ch.querySelector('[data-set]'); if (st) st.addEventListener('click', () => { this.view = 'set'; this.render(); });
      this.ch.querySelectorAll('[data-sug]').forEach((b) => b.addEventListener('click', () => this.send(b.dataset.sug)));
      this.ch.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { this.close(); setTimeout(() => window.kiSettings && window.kiSettings.open('auto', b.dataset.open), 300); }));
      this.ch.querySelectorAll('[data-hash]').forEach((b) => b.addEventListener('click', () => { this.pendingHash = b.dataset.hash; this.close(); }));
      this.ch.querySelectorAll('[data-cfg]').forEach((b) => b.addEventListener('click', () => { CFG[b.dataset.cfg] = !CFG[b.dataset.cfg]; saveCfg(); this.render(); }));
      this.ch.querySelectorAll('[data-model]').forEach((b) => b.addEventListener('click', () => { CFG.model = b.dataset.model; saveCfg(); this.render(); }));
      this.ch.querySelectorAll('[data-prov]').forEach((b) => b.addEventListener('click', () => { CFG.provider = b.dataset.prov; CFG.bubble = CFG.provider !== 'off' ? CFG.bubble : CFG.bubble; saveCfg(); this.render(); this._vis && this._vis(); }));
      this.ch.querySelectorAll('[data-omodel]').forEach((b) => b.addEventListener('click', () => { CFG.ollamaModel = b.dataset.omodel; saveCfg(); this.render(); }));
      const ou = this.ch.querySelector('[data-ourl]'); if (ou) ou.addEventListener('change', () => { CFG.ollamaUrl = ou.value.trim(); this.ollModels = null; this.ollTest = null; saveCfg(); this.render(); });
      const ot = this.ch.querySelector('[data-otest]'); if (ot) ot.addEventListener('click', async () => {
        const inp = this.ch.querySelector('[data-ourl]'); if (inp) CFG.ollamaUrl = inp.value.trim(); saveCfg();
        const u = String(CFG.ollamaUrl).replace(/\/$/, '');
        if (!/^https?:\/\/[^\s/]+/.test(u)) { this.ollTest = { ok: false, msg: 'Adressen må starte med http:// eller https://' }; return this.render(); }
        this.ollTest = 'busy'; this.render();
        try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 5000); const r = await fetch(u + '/api/tags', { signal: ac.signal }); clearTimeout(tm); const j = await r.json(); this.ollModels = (j.models || []).map((m) => [m.name, m.size ? (m.size / 1e9).toFixed(1).replace('.', ',') + ' GB' : '']); this.ollTest = { ok: true, msg: 'Tilkoblet · ' + this.ollModels.length + ' modeller' }; if (this.ollModels[0] && !this.ollModels.some((x) => x[0] === CFG.ollamaModel)) { CFG.ollamaModel = this.ollModels[0][0]; saveCfg(); } }
        catch (e) { this.ollModels = null; this.ollTest = { ok: false, msg: 'Fikk ikke kontakt med Ollama. Sjekk adressen, og at OLLAMA_ORIGINS tillater appen.' }; }
        this.render();
      });
      const clr = this.ch.querySelector('[data-clear]'); if (clr) clr.addEventListener('click', () => { this.msgs = []; this.view = 'chat'; this.render(); });
      const ta = this.ch.querySelector('.bar textarea'), sb = this.ch.querySelector('.bar .send');
      if (ta && sb) {
        const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; };
        fit();
        ta.addEventListener('input', () => { this.draft = ta.value; fit(); const on = !!ta.value.trim() && !this.busy; sb.classList.toggle('on', on); sb.classList.toggle('dis', !on); });
        ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const v = ta.value; this.draft = ''; this.send(v); } });
        sb.addEventListener('click', () => { const v = ta.value; this.draft = ''; this.send(v); });
        if (this.isOpen && !this.busy && !('ontouchstart' in window)) setTimeout(() => ta.focus(), 50);
      }
    }
  };
  window.kiGlimt = G;
  if (document.body) G.init(); else document.addEventListener('DOMContentLoaded', () => G.init());
  window.addEventListener('message', (e) => { if (e.data && e.data.kiGlimt != null) G.open(typeof e.data.kiGlimt === 'string' ? e.data.kiGlimt : ''); });
})();
