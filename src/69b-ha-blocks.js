/* KI MSH · blokk-editor for automasjoner og skript (Fiks 65) – utløsere, betingelser og handlinger som kort.
 * Brukes av editoren i 69c-ha-auto.js. Hver blokk er et kort med ikon, type og en lesbar oppsummering («Når Stue lys blir
 * på i 5 min»); trykk utvider skjemaet. Verktøylinje per blokk: opp/ned, dupliser, slå av/på (enabled: false), test
 * (betingelse: test_condition · handling: execute_script), YAML for blokken, slett. Nøstede blokker (hvis/så/ellers,
 * velg, gjenta, parallelt, sekvens, og/eller/ikke, vent på utløser) tegnes rekursivt med egne «Legg til»-knapper.
 * Typer appen ikke har skjema for (enhet o.l.) redigeres i YAML i blokken – ingenting går tapt.
 *
 * Stier: 'triggers.0', 'actions.2.then.1', 'actions.1.choose.0.sequence.3' … (st.cfg er utkastet).
 * Felt bindes med data-f="<sti>::<nøkkel>" og data-t="<widget>" (text, num, dur, tpl, yaml, list, lines, bool, sel, ents, ent, days, areas).
 * Lagringsformat: nytt (triggers/conditions/actions, trigger:, action:) fra HA 2024.10; eldre HA får gamle nøkler ved lagring.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || M.ha.blocks) return;
  const esc = M.esc, ui = M.ha.ui;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  /* ------------------------------------------------------------ stier */
  const parts = (p) => String(p).split('.').filter((x) => x !== '').map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  function getAt(o, p) { let c = o; for (const k of parts(p)) { if (c == null) return undefined; c = c[k]; } return c; }
  function setAt(o, p, v) {
    const P = parts(p); let c = o;
    for (let i = 0; i < P.length - 1; i++) { const k = P[i]; if (c[k] == null || typeof c[k] !== 'object') c[k] = typeof P[i + 1] === 'number' ? [] : {}; c = c[k]; }
    const last = P[P.length - 1];
    if (v === undefined) { if (Array.isArray(c) && typeof last === 'number') c.splice(last, 1); else delete c[last]; } else c[last] = v;
  }
  const parentOf = (p) => { const P = String(p).split('.'); const i = Number(P.pop()); return { list: P.join('.'), i }; };

  /* ------------------------------------------------------------ format (nytt ↔ gammelt) */
  function normTrig(t) { if (!isObj(t)) return t; if (t.platform && !t.trigger) { t.trigger = t.platform; delete t.platform; } return t; }
  function normAct(a) {
    if (!isObj(a)) return a;
    if (a.service && !a.action) { a.action = a.service; delete a.service; }
    if (a.wait_for_trigger) a.wait_for_trigger = arr(a.wait_for_trigger).map(normTrig);
    if (a.then) a.then = arr(a.then).map(normAct);
    if (a.else) a.else = arr(a.else).map(normAct);
    if (a.choose) a.choose = arr(a.choose).map((o) => ({ ...o, sequence: arr(o.sequence).map(normAct), conditions: arr(o.conditions) }));
    if (a.default) a.default = arr(a.default).map(normAct);
    if (a.repeat && a.repeat.sequence) a.repeat.sequence = arr(a.repeat.sequence).map(normAct);
    if (Array.isArray(a.parallel)) a.parallel = a.parallel.map(normAct);
    if (Array.isArray(a.sequence)) a.sequence = a.sequence.map(normAct);
    return a;
  }
  function normalize(cfg, kind) {
    const c = clone(cfg) || {};
    if (kind === 'automation') {
      c.triggers = arr(c.triggers != null ? c.triggers : c.trigger).map(normTrig); delete c.trigger;
      c.conditions = arr(c.conditions != null ? c.conditions : c.condition); delete c.condition;
      c.actions = arr(c.actions != null ? c.actions : c.action).map(normAct); delete c.action;
    } else if (kind === 'script') c.sequence = arr(c.sequence).map(normAct);
    return c;
  }
  // For HA før 2024.10 (trigger: → platform:, flertall → entall) og før 2024.8 (action: → service:)
  function denorm(cfg, kind, ver) {
    const c = clone(cfg);
    if (ver >= 202410) return c;
    const svc = ver < 202408;
    const trig = (t) => { if (isObj(t) && t.trigger && !t.platform) { t.platform = t.trigger; delete t.trigger; } return t; };
    const act = (a) => {
      if (!isObj(a)) return a;
      if (svc && typeof a.action === 'string') { a.service = a.action; delete a.action; }
      if (a.wait_for_trigger) a.wait_for_trigger = arr(a.wait_for_trigger).map(trig);
      ['then', 'else', 'default', 'parallel', 'sequence'].forEach((k) => { if (Array.isArray(a[k])) a[k] = a[k].map(act); });
      if (a.choose) a.choose = arr(a.choose).map((o) => ({ ...o, sequence: arr(o.sequence).map(act) }));
      if (a.repeat && a.repeat.sequence) a.repeat.sequence = arr(a.repeat.sequence).map(act);
      return a;
    };
    if (kind === 'automation') {
      c.trigger = arr(c.triggers).map(trig); delete c.triggers;
      c.condition = arr(c.conditions); delete c.conditions;
      c.action = arr(c.actions).map(act); delete c.actions;
    } else if (kind === 'script') c.sequence = arr(c.sequence).map(act);
    return c;
  }

  /* ------------------------------------------------------------ katalog */
  const TRIG = {
    state: ['Tilstand', 'mdi:state-machine', 'Når en entitet endrer tilstand'],
    numeric_state: ['Numerisk verdi', 'mdi:numeric', 'Når en verdi går over eller under'],
    time: ['Tidspunkt', 'mdi:clock-outline', 'Et fast klokkeslett'],
    time_pattern: ['Tidsmønster', 'mdi:timer-sync-outline', 'Hvert 5. minutt o.l.'],
    sun: ['Sol', 'mdi:weather-sunset', 'Soloppgang eller solnedgang'],
    zone: ['Sone', 'mdi:map-marker-radius', 'Kommer til eller forlater'],
    homeassistant: ['Home Assistant', 'mdi:home-assistant', 'Starter eller stopper'],
    template: ['Mal', 'mdi:code-braces', 'Når en mal blir sann'],
    event: ['Hendelse', 'mdi:gesture-double-tap', 'En hendelse på hendelsesbussen'],
    calendar: ['Kalender', 'mdi:calendar', 'Start eller slutt på en avtale'],
    conversation: ['Setning', 'mdi:message-text-outline', 'Når du sier noe til Assist'],
    webhook: ['Webhook', 'mdi:webhook', 'Et kall utenfra'],
    tag: ['NFC-brikke', 'mdi:nfc-variant', 'Når en brikke skannes'],
    mqtt: ['MQTT', 'mdi:swap-horizontal', 'En melding på et emne'],
    device: ['Enhet', 'mdi:devices', 'Enhetsutløser (YAML)'],
  };
  const COND = {
    state: ['Tilstand', 'mdi:state-machine', 'Entiteten er i en tilstand'],
    numeric_state: ['Numerisk verdi', 'mdi:numeric', 'Over eller under en verdi'],
    time: ['Tid og ukedag', 'mdi:clock-outline', 'Mellom klokkeslett, bestemte dager'],
    sun: ['Sol', 'mdi:weather-sunset', 'Før/etter soloppgang og solnedgang'],
    zone: ['Sone', 'mdi:map-marker-radius', 'Noen er i en sone'],
    template: ['Mal', 'mdi:code-braces', 'En mal er sann'],
    trigger: ['Utløst av', 'mdi:identifier', 'Hvilken utløser startet'],
    and: ['Og', 'mdi:ampersand', 'Alle må være sanne'],
    or: ['Eller', 'mdi:gate-or', 'Minst én må være sann'],
    not: ['Ikke', 'mdi:gate-not', 'Ingen kan være sanne'],
    device: ['Enhet', 'mdi:devices', 'Enhetsbetingelse (YAML)'],
  };
  const ACT = {
    call: ['Utfør handling', 'mdi:play-circle-outline', 'Slå på, still inn, send …'],
    scene: ['Aktiver scene', 'mdi:palette-outline', 'scene.turn_on'],
    script: ['Kjør skript', 'mdi:script-text-outline', 'script.turn_on'],
    notify: ['Varsling', 'mdi:bell-outline', 'Send en melding'],
    delay: ['Vent', 'mdi:timer-sand', 'Pause i en tid'],
    wait_template: ['Vent på mal', 'mdi:timer-outline', 'Til en mal blir sann'],
    wait_for_trigger: ['Vent på utløser', 'mdi:timer-play-outline', 'Til noe skjer'],
    condition: ['Betingelse', 'mdi:filter-outline', 'Stopp hvis ikke oppfylt'],
    if: ['Hvis, så', 'mdi:call-split', 'Hvis … så … ellers'],
    choose: ['Velg', 'mdi:arrow-decision-outline', 'Flere valg med betingelser'],
    repeat: ['Gjenta', 'mdi:repeat', 'Antall, mens, til, for hver'],
    parallel: ['Parallelt', 'mdi:format-list-group', 'Kjør samtidig'],
    sequence: ['Sekvens', 'mdi:format-list-numbered', 'Grupper handlinger'],
    variables: ['Variabler', 'mdi:variable', 'Definer variabler'],
    event: ['Utløs hendelse', 'mdi:gesture-double-tap', 'Send en hendelse'],
    stop: ['Stopp', 'mdi:stop-circle-outline', 'Avslutt her'],
    set_conversation_response: ['Svar (Assist)', 'mdi:message-reply-text-outline', 'Svar på en setning'],
    device: ['Enhet', 'mdi:devices', 'Enhetshandling (YAML)'],
    unknown: ['Annet', 'mdi:code-json', 'Rediger i YAML'],
  };
  const condType = (c) => (typeof c === 'string' ? 'template' : (c && c.condition) || 'unknown');
  const trigType = (t) => (t && (t.trigger || t.platform)) || 'unknown';
  function actType(a) {
    if (!isObj(a)) return 'unknown';
    for (const k of ['if', 'choose', 'repeat', 'parallel', 'sequence', 'delay', 'wait_template', 'wait_for_trigger', 'variables', 'stop', 'event', 'scene', 'set_conversation_response']) if (k in a) return k === 'scene' ? 'scene_short' : k;
    if ('condition' in a) return 'condition';
    if (a.device_id && !a.action) return 'device';
    if (a.action || a.service) return 'call';
    return 'unknown';
  }
  const NEW_TRIG = (k) => ({ state: { trigger: 'state', entity_id: [] }, numeric_state: { trigger: 'numeric_state', entity_id: [] }, time: { trigger: 'time', at: '07:00:00' }, time_pattern: { trigger: 'time_pattern', minutes: '/5' }, sun: { trigger: 'sun', event: 'sunset' }, zone: { trigger: 'zone', entity_id: '', zone: 'zone.home', event: 'enter' }, homeassistant: { trigger: 'homeassistant', event: 'start' }, template: { trigger: 'template', value_template: '' }, event: { trigger: 'event', event_type: '' }, calendar: { trigger: 'calendar', event: 'start', entity_id: '' }, conversation: { trigger: 'conversation', command: [] }, webhook: { trigger: 'webhook', webhook_id: 'ki_' + Math.random().toString(36).slice(2, 10), local_only: true }, tag: { trigger: 'tag', tag_id: '' }, mqtt: { trigger: 'mqtt', topic: '' }, device: { trigger: 'device', device_id: '', domain: '', type: '' } }[k]);
  const NEW_COND = (k) => ({ state: { condition: 'state', entity_id: [], state: '' }, numeric_state: { condition: 'numeric_state', entity_id: [] }, time: { condition: 'time', after: '', before: '' }, sun: { condition: 'sun', after: 'sunset' }, zone: { condition: 'zone', entity_id: '', zone: 'zone.home' }, template: { condition: 'template', value_template: '' }, trigger: { condition: 'trigger', id: [] }, and: { condition: 'and', conditions: [] }, or: { condition: 'or', conditions: [] }, not: { condition: 'not', conditions: [] }, device: { condition: 'device', device_id: '', domain: '', type: '' } }[k]);
  const NEW_ACT = (k) => ({ call: { action: '', target: {}, data: {} }, scene: { action: 'scene.turn_on', target: { entity_id: '' } }, script: { action: 'script.turn_on', target: { entity_id: '' } }, notify: { action: 'notify.notify', data: { title: '', message: '' } }, delay: { delay: '00:01:00' }, wait_template: { wait_template: '', timeout: '', continue_on_timeout: true }, wait_for_trigger: { wait_for_trigger: [], timeout: '' }, condition: { condition: 'state', entity_id: [], state: '' }, if: { if: [], then: [] }, choose: { choose: [{ conditions: [], sequence: [] }] }, repeat: { repeat: { count: 2, sequence: [] } }, parallel: { parallel: [] }, sequence: { sequence: [] }, variables: { variables: {} }, event: { event: '', event_data: {} }, stop: { stop: '' }, set_conversation_response: { set_conversation_response: '' }, device: { device_id: '', domain: '', type: '' } }[k]);

  /* ------------------------------------------------------------ navn og verdier */
  const H = () => M.lastHass;
  const nm = (id) => { const h = H(); const s = h && h.states && h.states[id]; return (s && s.attributes.friendly_name) || id; };
  const names = (v) => { const L = arr(v).filter(Boolean); if (!L.length) return '…'; const n = L.slice(0, 2).map(nm).join(', '); return L.length > 2 ? `${n} +${L.length - 2}` : n; };
  const U = (n, e) => T(n, e);
  const durStr = (d) => {
    if (d == null || d === '') return '';
    if (typeof d === 'number') return `${d} s`;
    if (typeof d === 'string') { const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(d); if (!m) return d; const h = +m[1], mi = +m[2], s = +(m[3] || 0); return [h ? `${h} ${U('t', 'h')}` : '', mi ? `${mi} min` : '', s ? `${s} s` : ''].filter(Boolean).join(' ') || '0 s'; }
    if (isObj(d)) return [d.days ? `${d.days} d` : '', d.hours ? `${d.hours} ${U('t', 'h')}` : '', d.minutes ? `${d.minutes} min` : '', d.seconds ? `${d.seconds} s` : '', d.milliseconds ? `${d.milliseconds} ms` : ''].filter(Boolean).join(' ') || '0 s';
    return String(d);
  };
  const durVal = (d) => { if (d == null) return ''; if (isObj(d)) { const p = (n) => String(n || 0).padStart(2, '0'); return `${p((d.days || 0) * 24 + (d.hours || 0))}:${p(d.minutes)}:${p(d.seconds)}`; } return String(d); };
  const stName = (s) => (window.kiLang && window.kiLang() === 'en' ? String(s).replace(/_/g, ' ') : ({ on: 'på', off: 'av', home: 'hjemme', not_home: 'borte', open: 'åpen', closed: 'lukket', locked: 'låst', unlocked: 'ulåst', playing: 'spiller', paused: 'pauset', idle: 'inaktiv', unavailable: 'utilgjengelig', unknown: 'ukjent', heat: 'varme', cool: 'kjøling', auto: 'auto', armed_away: 'aktivert borte', armed_home: 'aktivert hjemme', disarmed: 'deaktivert', triggered: 'utløst', above_horizon: 'over horisonten', below_horizon: 'under horisonten' }[s] || s));
  const DAYS = [['mon', 'Man'], ['tue', 'Tir'], ['wed', 'Ons'], ['thu', 'Tor'], ['fri', 'Fre'], ['sat', 'Lør'], ['sun', 'Søn']];
  const svcName = (s) => {
    const tr = M.ha.tr || {};
    const [d, v] = String(s || '').split('.');
    return tr[`component.${d}.services.${v}.name`] || s;
  };

  function sumTrig(t) {
    const k = trigType(t), fo = t.for ? ` ${T('i', 'for')} ${durStr(t.for)}` : '';
    switch (k) {
      case 'state': return `${names(t.entity_id)}${t.attribute ? ` (${t.attribute})` : ''}${t.from != null && t.from !== '' ? ` ${T('fra', 'from')} ${arr(t.from).map(stName).join('/')}` : ''}${t.to != null && t.to !== '' ? ` ${T('blir', 'becomes')} ${arr(t.to).map(stName).join('/')}` : ` ${T('endres', 'changes')}`}${fo}`;
      case 'numeric_state': return `${names(t.entity_id)}${t.attribute ? ` (${t.attribute})` : ''}${t.above != null && t.above !== '' ? ` ${T('over', 'above')} ${t.above}` : ''}${t.below != null && t.below !== '' ? ` ${T('under', 'below')} ${t.below}` : ''}${fo}`;
      case 'time': return `${T('Kl.', 'At')} ${arr(t.at).map((x) => (typeof x === 'string' && x.includes('.') ? nm(x) : String(x).replace(/:00$/, ''))).join(', ') || '…'}`;
      case 'time_pattern': return ['hours', 'minutes', 'seconds'].filter((x) => t[x] != null && t[x] !== '').map((x) => `${T({ hours: 'time', minutes: 'minutt', seconds: 'sekund' }[x], { hours: 'hour', minutes: 'minute', seconds: 'second' }[x])} ${t[x]}`).join(', ') || T('Tidsmønster', 'Time pattern');
      case 'sun': return `${t.event === 'sunrise' ? T('Soloppgang', 'Sunrise') : T('Solnedgang', 'Sunset')}${t.offset ? ` ${t.offset}` : ''}`;
      case 'zone': return `${names(t.entity_id)} ${t.event === 'leave' ? T('forlater', 'leaves') : T('kommer til', 'enters')} ${t.zone ? nm(t.zone) : '…'}`;
      case 'homeassistant': return t.event === 'shutdown' ? T('Home Assistant stopper', 'Home Assistant stops') : T('Home Assistant starter', 'Home Assistant starts');
      case 'template': return String(t.value_template || '…').slice(0, 80);
      case 'event': return t.event_type || '…';
      case 'calendar': return `${t.event === 'end' ? T('Slutt', 'End') : T('Start', 'Start')} ${T('på avtale i', 'of event in')} ${t.entity_id ? nm(t.entity_id) : '…'}${t.offset ? ` (${t.offset})` : ''}`;
      case 'conversation': return arr(t.command).map((x) => `«${x}»`).join(', ') || '…';
      case 'webhook': return t.webhook_id || '…';
      case 'tag': return t.tag_id || '…';
      case 'mqtt': return t.topic || '…';
      default: return k;
    }
  }
  function sumCond(c) {
    const k = condType(c);
    if (typeof c === 'string') return c.slice(0, 80);
    switch (k) {
      case 'state': return `${names(c.entity_id)}${c.attribute ? ` (${c.attribute})` : ''} ${T('er', 'is')} ${arr(c.state).map(stName).join(` ${T('eller', 'or')} `) || '…'}${c.for ? ` ${T('i', 'for')} ${durStr(c.for)}` : ''}`;
      case 'numeric_state': return `${names(c.entity_id)}${c.above != null && c.above !== '' ? ` ${T('over', 'above')} ${c.above}` : ''}${c.below != null && c.below !== '' ? ` ${T('under', 'below')} ${c.below}` : ''}`;
      case 'time': { const d = arr(c.weekday); return [c.after ? `${T('etter', 'after')} ${String(c.after).replace(/:00$/, '')}` : '', c.before ? `${T('før', 'before')} ${String(c.before).replace(/:00$/, '')}` : '', d.length && d.length < 7 ? DAYS.filter(([v]) => d.includes(v)).map(([, n]) => T(n).toLowerCase()).join(', ') : ''].filter(Boolean).join(', ') || T('Når som helst', 'Any time'); }
      case 'sun': return [c.after ? `${T('etter', 'after')} ${c.after === 'sunrise' ? T('soloppgang', 'sunrise') : T('solnedgang', 'sunset')}` : '', c.before ? `${T('før', 'before')} ${c.before === 'sunrise' ? T('soloppgang', 'sunrise') : T('solnedgang', 'sunset')}` : ''].filter(Boolean).join(` ${T('og', 'and')} `) || T('Sol', 'Sun');
      case 'zone': return `${names(c.entity_id)} ${T('er i', 'is in')} ${c.zone ? nm(c.zone) : '…'}`;
      case 'template': return String(c.value_template || '…').slice(0, 80);
      case 'trigger': return `${T('Utløser', 'Trigger')} ${arr(c.id).join(', ') || '…'}`;
      case 'and': case 'or': case 'not': return `${arr(c.conditions).length} ${T('betingelser', 'conditions')}`;
      default: return k;
    }
  }
  function sumAct(a) {
    const k = actType(a);
    switch (k) {
      case 'call': { const tg = a.target || {}; const e = arr(tg.entity_id || (a.data && a.data.entity_id) || a.entity_id); const ar = arr(tg.area_id).map((x) => M.areaName(H(), x)); const fl = arr(tg.floor_id); const dv = arr(tg.device_id); return `${svcName(a.action || a.service) || '…'}${e.length ? ' · ' + names(e) : ''}${ar.length ? ' · ' + ar.join(', ') : ''}${fl.length ? ' · ' + fl.join(', ') : ''}${dv.length ? ` · ${dv.length} ${T('enhet(er)', 'device(s)')}` : ''}`; }
      case 'scene_short': return nm(a.scene);
      case 'delay': return durStr(a.delay);
      case 'wait_template': return `${String(a.wait_template || '…').slice(0, 60)}${a.timeout ? ` · ${T('maks', 'max')} ${durStr(a.timeout)}` : ''}`;
      case 'wait_for_trigger': return `${arr(a.wait_for_trigger).map(sumTrig).join(` ${T('eller', 'or')} `) || '…'}${a.timeout ? ` · ${T('maks', 'max')} ${durStr(a.timeout)}` : ''}`;
      case 'condition': return sumCond(a);
      case 'if': return `${T('Hvis', 'If')} ${arr(a.if).length ? arr(a.if).map((c) => sumCond(c)).join(` ${T('og', 'and')} `) : '…'}`;
      case 'choose': return `${arr(a.choose).length} ${T('valg', 'options')}${a.default ? ` + ${T('standard', 'default')}` : ''}`;
      case 'repeat': { const r = a.repeat || {}; return r.count != null ? `${r.count} ${T('ganger', 'times')}` : r.while ? T('Mens …', 'While …') : r.until ? T('Til …', 'Until …') : r.for_each ? T('For hver …', 'For each …') : T('Gjenta', 'Repeat'); }
      case 'parallel': return `${arr(a.parallel).length} ${T('samtidig', 'at once')}`;
      case 'sequence': return `${arr(a.sequence).length} ${T('handlinger', 'actions')}`;
      case 'variables': return Object.keys(a.variables || {}).join(', ') || '…';
      case 'event': return a.event || '…';
      case 'stop': return a.stop || (a.error ? T('Feil', 'Error') : T('Stopp', 'Stop'));
      case 'set_conversation_response': return String(a.set_conversation_response || '…').slice(0, 80);
      default: return k;
    }
  }

  /* ------------------------------------------------------------ verdiforslag for tilstander */
  function stateOpts(ids) {
    const h = H(); const out = new Set();
    arr(ids).forEach((id) => {
      const s = h && h.states && h.states[id]; if (!s) return;
      const d = id.split('.')[0], a = s.attributes || {};
      out.add(s.state);
      if (['light', 'switch', 'input_boolean', 'binary_sensor', 'fan', 'automation', 'siren', 'remote', 'script'].includes(d)) ['on', 'off'].forEach((x) => out.add(x));
      if (d === 'person' || d === 'device_tracker') ['home', 'not_home'].forEach((x) => out.add(x));
      if (d === 'cover') ['open', 'closed', 'opening', 'closing'].forEach((x) => out.add(x));
      if (d === 'lock') ['locked', 'unlocked', 'jammed', 'open'].forEach((x) => out.add(x));
      if (d === 'media_player') ['playing', 'paused', 'idle', 'off', 'on'].forEach((x) => out.add(x));
      if (d === 'alarm_control_panel') ['disarmed', 'armed_home', 'armed_away', 'armed_night', 'triggered', 'pending'].forEach((x) => out.add(x));
      if (d === 'climate' || d === 'water_heater') arr(a.hvac_modes || a.operation_list).forEach((x) => out.add(x));
      if (d === 'sun') ['above_horizon', 'below_horizon'].forEach((x) => out.add(x));
      arr(a.options).forEach((x) => out.add(x));
    });
    ['unavailable', 'unknown'].forEach((x) => out.add(x));
    return [...out].filter((x) => x != null && x !== '');
  }

  /* ------------------------------------------------------------ felt-widgets */
  const F = (path, key) => `${path}::${key}`;
  function w(path, o, val, st) {
    const f = F(path, o.k), lab = o.l ? T(o.l) : '';
    switch (o.w) {
      case 'ents': return `<div class="fd">${lab ? `<span class="fl">${esc(lab)}</span>` : ''}${ui.entMulti({ key: 'em-' + f, f, value: arr(val).filter(Boolean), domains: o.d || '', label: arr(val).filter(Boolean).length ? names(val) : T('Velg entiteter', 'Choose entities'), icon: 'mdi:shape-outline', hint: ' ' })}</div>`;
      case 'ent': return `<div class="fd">${lab ? `<span class="fl">${esc(lab)}</span>` : ''}${ui.entPick({ key: 'ep-' + f, f, value: Array.isArray(val) ? val[0] : val, domains: o.d || '', t: 'ent' })}</div>`;
      case 'dur': return ui.field({ f, t: 'dur', value: durVal(val), label: lab, ph: o.ph || '00:05:00', mono: true, hint: o.h });
      case 'num': return ui.field({ f, t: 'num', value: val, label: lab, ph: o.ph || '', type: 'text', attrs: 'inputmode="decimal"', hint: o.h });
      case 'tpl': return ui.field({ f, t: 'text', value: val, label: lab, ph: o.ph || "{{ states('sensor.x') | float > 20 }}", area: true, rows: 3, mono: true, hint: o.h });
      case 'yaml': { const raw = st && st.raw && st.raw[f]; return `${ui.field({ f, t: 'yaml', value: raw != null ? raw.text : val == null || (isObj(val) && !Object.keys(val).length) ? '' : M.yaml.dump(val).replace(/\n$/, ''), label: lab, ph: o.ph || 'nøkkel: verdi', area: true, rows: o.rows || 4, mono: true, hint: o.h })}${raw && raw.err ? `<span class="fh err">${esc(raw.err)}</span>` : ''}`; }
      case 'lines': return ui.field({ f, t: 'lines', value: arr(val).join('\n'), label: lab, ph: o.ph || '', area: true, rows: 3, hint: o.h || T('Én per linje', 'One per line') });
      case 'list': return ui.field({ f, t: 'list', value: arr(val).join(', '), label: lab, ph: o.ph || '', hint: o.h, list: o.dl });
      case 'bool': return `<div class="tr"><span>${esc(lab)}${o.h ? `<small>${esc(T(o.h))}</small>` : ''}</span>${ui.sw(val === true || (o.def === true && val == null), 'bool', f)}</div>`;
      case 'sel': return ui.select({ f, t: o.num ? 'num' : 'text', value: val == null ? '' : val, label: lab, opts: o.o.map(([v, t]) => [v, T(t)]) });
      case 'days': { const D = arr(val); return `<div class="fd">${lab ? `<span class="fl">${esc(lab)}</span>` : ''}<div class="chs wrap">${DAYS.map(([v, t]) => ui.chip(esc(T(t)), D.includes(v), 'day', v, `data-f="${esc(f)}"`)).join('')}</div></div>`; }
      case 'time': return ui.field({ f, t: 'text', value: val == null ? '' : val, label: lab, ph: o.ph || '07:00:00', mono: true, hint: o.h || T('Klokkeslett (TT:MM:SS) eller en input_datetime-/sensor-entitet', 'Time (HH:MM:SS) or an input_datetime/sensor entity'), list: 'ha-dl-times' });
      default: return ui.field({ f, t: 'text', value: val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : val, label: lab, ph: o.ph || '', hint: o.h, list: o.dl, mono: o.mono });
    }
  }
  const TF = {
    state: [{ k: 'entity_id', w: 'ents', l: 'Entitet' }, { k: 'attribute', l: 'Attributt (valgfritt)', ph: 'f.eks. brightness' }, { k: 'from', w: 'list', l: 'Fra', ph: 'valgfritt', dl: 'ha-dl-st' }, { k: 'to', w: 'list', l: 'Til', ph: 'valgfritt = enhver endring', dl: 'ha-dl-st' }, { k: 'for', w: 'dur', l: 'I minst', ph: '00:00:00' }],
    numeric_state: [{ k: 'entity_id', w: 'ents', l: 'Entitet' }, { k: 'attribute', l: 'Attributt (valgfritt)' }, { k: 'above', w: 'num', l: 'Over' }, { k: 'below', w: 'num', l: 'Under' }, { k: 'for', w: 'dur', l: 'I minst' }, { k: 'value_template', w: 'tpl', l: 'Verdimal (valgfritt)', ph: '{{ state.attributes.x }}' }],
    time: [{ k: 'at', w: 'time', l: 'Klokkeslett' }],
    time_pattern: [{ k: 'hours', l: 'Timer', ph: 'f.eks. /2 eller 7' }, { k: 'minutes', l: 'Minutter', ph: 'f.eks. /5 eller 30' }, { k: 'seconds', l: 'Sekunder', ph: 'f.eks. 0' }],
    sun: [{ k: 'event', w: 'sel', l: 'Hendelse', o: [['sunrise', 'Soloppgang'], ['sunset', 'Solnedgang']] }, { k: 'offset', l: 'Forskyvning', ph: '-00:30:00', mono: true }],
    zone: [{ k: 'entity_id', w: 'ents', l: 'Person eller sporer', d: 'person,device_tracker' }, { k: 'zone', w: 'ent', l: 'Sone', d: 'zone' }, { k: 'event', w: 'sel', l: 'Hendelse', o: [['enter', 'Kommer til'], ['leave', 'Forlater']] }],
    homeassistant: [{ k: 'event', w: 'sel', l: 'Hendelse', o: [['start', 'Starter'], ['shutdown', 'Stopper']] }],
    template: [{ k: 'value_template', w: 'tpl', l: 'Mal' }, { k: 'for', w: 'dur', l: 'I minst' }],
    event: [{ k: 'event_type', l: 'Hendelsestype', ph: 'f.eks. zha_event', mono: true }, { k: 'event_data', w: 'yaml', l: 'Hendelsesdata (valgfritt)' }],
    calendar: [{ k: 'entity_id', w: 'ent', l: 'Kalender', d: 'calendar' }, { k: 'event', w: 'sel', l: 'Hendelse', o: [['start', 'Start'], ['end', 'Slutt']] }, { k: 'offset', l: 'Forskyvning', ph: '-00:15:00', mono: true }],
    conversation: [{ k: 'command', w: 'lines', l: 'Setninger', ph: 'Slå på alt lyset\nGod natt' }],
    webhook: [{ k: 'webhook_id', l: 'Webhook-ID', mono: true }, { k: 'local_only', w: 'bool', l: 'Bare fra lokalt nett', def: true }],
    tag: [{ k: 'tag_id', l: 'Brikke-ID', mono: true }],
    mqtt: [{ k: 'topic', l: 'Emne', mono: true }, { k: 'payload', l: 'Innhold (valgfritt)', mono: true }],
  };
  const CF = {
    state: [{ k: 'entity_id', w: 'ents', l: 'Entitet' }, { k: 'attribute', l: 'Attributt (valgfritt)' }, { k: 'state', w: 'list', l: 'Tilstand', ph: 'on eller flere: on, home', dl: 'ha-dl-st' }, { k: 'for', w: 'dur', l: 'I minst' }],
    numeric_state: [{ k: 'entity_id', w: 'ents', l: 'Entitet' }, { k: 'attribute', l: 'Attributt (valgfritt)' }, { k: 'above', w: 'num', l: 'Over' }, { k: 'below', w: 'num', l: 'Under' }],
    time: [{ k: 'after', w: 'time', l: 'Etter', ph: '22:00:00' }, { k: 'before', w: 'time', l: 'Før', ph: '06:00:00' }, { k: 'weekday', w: 'days', l: 'Ukedager (ingen = alle)' }],
    sun: [{ k: 'after', w: 'sel', l: 'Etter', o: [['', '–'], ['sunrise', 'Soloppgang'], ['sunset', 'Solnedgang']] }, { k: 'after_offset', l: 'Forskyvning etter', mono: true, ph: '-01:00:00' }, { k: 'before', w: 'sel', l: 'Før', o: [['', '–'], ['sunrise', 'Soloppgang'], ['sunset', 'Solnedgang']] }, { k: 'before_offset', l: 'Forskyvning før', mono: true }],
    zone: [{ k: 'entity_id', w: 'ents', l: 'Person eller sporer', d: 'person,device_tracker' }, { k: 'zone', w: 'ent', l: 'Sone', d: 'zone' }],
    template: [{ k: 'value_template', w: 'tpl', l: 'Mal' }],
    trigger: [{ k: 'id', w: 'list', l: 'Utløser-ID', dl: 'ha-dl-tid', h: 'Gi utløserne en ID under «Når» for å bruke dem her' }],
  };

  /* ------------------------------------------------------------ handling (action:) med tjenestefelt */
  function svcDef(s) { const h = H(); const [d, v] = String(s || '').split('.'); return (h && h.services && h.services[d] && h.services[d][v]) || null; }
  function svcFields(s) {
    const D = svcDef(s); if (!D || !D.fields) return [];
    const out = [];
    Object.entries(D.fields).forEach(([k, f]) => { if (f && f.fields && !f.selector) Object.entries(f.fields).forEach(([k2, f2]) => out.push([k2, f2 || {}, true])); else out.push([k, f || {}, false]); });
    return out;
  }
  const isSimpleSel = (sel) => !!(sel && (sel.number || sel.boolean || sel.select || sel.text || sel.color_temp));
  const simpleKeysOf = (b) => { const D = isObj(b.data) ? b.data : {}; return new Set(svcFields(b.action || b.service).filter(([k, fd]) => isSimpleSel(fd.selector) && (D[k] == null || typeof D[k] !== 'object')).map(([k]) => k)); };
  const fieldLabel = (s, k, f) => { const tr = M.ha.tr || {}; const [d, v] = String(s).split('.'); return tr[`component.${d}.services.${v}.fields.${k}.name`] || f.name || k.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()); };
  function renderCall(path, a, st) {
    const s = a.action || a.service || '', tg = isObj(a.target) ? a.target : {}, data = isObj(a.data) ? a.data : {};
    const dom = String(s).split('.')[0];
    const flds = svcFields(s), simple = {}, simpleKeys = new Set();
    flds.forEach(([k, f]) => { if (isSimpleSel(f.selector) && (data[k] == null || typeof data[k] !== 'object')) { simple[k] = f; simpleKeys.add(k); } });
    const ents = arr(tg.entity_id), areas = arr(tg.area_id);
    const h = H();
    const D = svcDef(s);
    const targetOn = !!(D ? D.target : dom && !['notify', 'tts', 'persistent_notification', 'system_log', 'logbook', 'homeassistant'].includes(dom) || ents.length || areas.length);
    const entDoms = D && D.target && D.target.entity ? [].concat(...arr(D.target.entity).map((e) => arr(e.domain))).filter(Boolean).join(',') : dom && !['homeassistant', 'notify'].includes(dom) ? dom : '';
    const areaChips = (M.areas ? M.areas(h) : []).map((ar) => ui.chip(esc(ar.name), areas.includes(ar.area_id), 'area', ar.area_id, `data-f="${esc(F(path, 'target.area_id'))}"`)).join('');
    const shown = Object.keys(data).filter((k) => simpleKeys.has(k));
    const rest = {}; Object.keys(data).forEach((k) => { if (!simpleKeys.has(k)) rest[k] = data[k]; });
    const fieldW = (k) => {
      const f = simple[k], sel = f.selector || {}, v = data[k], lab = fieldLabel(s, k, f), ff = F(path, 'data.' + k);
      const del = `<button class="bt sm ic" data-a="dfdel" data-v="${esc(ff)}" aria-label="${esc(T('Fjern', 'Remove'))}">${ui.ic('mdi:close', 16)}</button>`;
      let inner;
      if (sel.boolean) inner = `<div class="tr"><span>${esc(lab)}</span>${ui.sw(v === true, 'bool', ff)}${del}</div>`;
      else if (sel.select) { const O = arr(sel.select.options).map((o) => (isObj(o) ? [o.value, o.label || o.value] : [o, o])); inner = `<div class="fdr">${ui.select({ f: ff, value: v, label: lab, opts: [['', '–'], ...O] })}${del}</div>`; }
      else if (sel.number || sel.color_temp) { const n = sel.number || {}; const mn = n.min != null ? n.min : sel.color_temp ? sel.color_temp.min || 2000 : 0, mx = n.max != null ? n.max : sel.color_temp ? sel.color_temp.max || 6500 : 100; const step = n.step === 'any' ? 'any' : n.step || 1; const u = n.unit_of_measurement || (sel.color_temp ? 'K' : ''); const num = typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))); inner = `<div class="fd"><span class="fl">${esc(lab)}${u ? ` (${esc(u)})` : ''}</span><div class="nrow">${num ? `<input class="rng" type="range" min="${mn}" max="${mx}" step="${step}" value="${esc(v)}" data-f="${esc(ff)}" data-t="num" data-key="rg-${esc(ff)}" style="--p:${Math.round(((Number(v) - mn) / ((mx - mn) || 1)) * 100)}%">` : ''}<input class="in nin" value="${esc(v == null ? '' : v)}" data-f="${esc(ff)}" data-t="num" inputmode="decimal" data-key="ni-${esc(ff)}" placeholder="${mn}–${mx}">${del}</div></div>`; }
      else inner = `<div class="fdr">${ui.field({ f: ff, t: 'text', value: v, label: lab, area: !!(sel.text && sel.text.multiline), rows: 2 })}${del}</div>`;
      return inner;
    };
    const avail = flds.filter(([k]) => data[k] == null).map(([k, f]) => ui.chip(`${ui.ic('mdi:plus', 14)}${esc(fieldLabel(s, k, f))}`, false, 'dfadd', F(path, 'data.' + k), `data-ex="${esc(f.example != null && typeof f.example !== 'object' ? f.example : '')}" data-sel="${esc(Object.keys(f.selector || {})[0] || '')}"`)).join('');
    return `${ui.field({ f: F(path, 'action'), t: 'svc', value: s, label: T('Handling', 'Action'), ph: 'light.turn_on', mono: true, list: 'ha-dl-svc', hint: D && D.description ? D.description : '' })}
      ${targetOn ? `<div class="fd"><span class="fl">${esc(T('Mål · entiteter', 'Target · entities'))}</span>${ui.entMulti({ key: 'em-' + F(path, 'target.entity_id'), f: F(path, 'target.entity_id'), value: ents, domains: entDoms, label: ents.length ? names(ents) : T('Velg entiteter', 'Choose entities') })}</div>
      ${areaChips ? `<div class="fd"><span class="fl">${esc(T('Mål · områder', 'Target · areas'))}</span><div class="chs">${areaChips}</div></div>` : ''}
      ${arr(tg.device_id).length || arr(tg.floor_id).length || arr(tg.label_id).length ? `<span class="fh">${esc(T('Enheter, etasjer og etiketter som mål vises i YAML for blokken', 'Device, floor and label targets are shown in the block YAML'))}</span>` : ''}` : ''}
      ${shown.map(fieldW).join('')}
      ${avail ? `<div class="fd"><span class="fl">${esc(T('Legg til felt', 'Add field'))}</span><div class="chs">${avail}</div></div>` : ''}
      ${w(path, { k: '__rest', w: 'yaml', l: shown.length || avail ? 'Annen data (YAML)' : 'Data (YAML)', ph: 'brightness_pct: 60' }, Object.keys(rest).length ? rest : null, st)}
      ${w(path, { k: 'response_variable', l: 'Svarvariabel (valgfritt)', ph: 'svar' }, a.response_variable, st)}`;
  }

  /* ------------------------------------------------------------ blokker */
  const isOpen = (st, p) => st.open && st.open.has(p);
  const fold = (p) => `<button class="bt sm ic" data-a="bk-tog" data-v="${esc(p)}">${ui.ic('mdi:chevron-up', 18)}</button>`;
  function toolbar(path, kind, b, st, idx, len) {
    const off = b && b.enabled === false;
    const can = (k) => !(st.__busy && st.__busy[k]);
    return `<div class="btb">
      <button class="bt sm ic" data-a="bk-up" data-v="${esc(path)}" ${idx === 0 ? 'disabled' : ''} aria-label="${esc(T('Flytt opp', 'Move up'))}">${ui.ic('mdi:arrow-up', 18)}</button>
      <button class="bt sm ic" data-a="bk-down" data-v="${esc(path)}" ${idx >= len - 1 ? 'disabled' : ''} aria-label="${esc(T('Flytt ned', 'Move down'))}">${ui.ic('mdi:arrow-down', 18)}</button>
      <button class="bt sm ic" data-a="bk-dup" data-v="${esc(path)}" aria-label="${esc(T('Dupliser', 'Duplicate'))}">${ui.ic('mdi:content-copy', 17)}</button>
      ${kind !== 'opt' ? `<button class="bt sm ic" data-a="bk-en" data-v="${esc(path)}" aria-label="${esc(off ? T('Slå på', 'Enable') : T('Slå av', 'Disable'))}">${ui.ic(off ? 'mdi:play-circle-outline' : 'mdi:pause-circle-outline', 18)}</button>` : ''}
      ${kind === 'cond' || kind === 'act' ? `<button class="bt sm ic" data-a="bk-test" data-v="${esc(path)}" data-k="${kind}" ${can('t' + path) ? '' : 'disabled'} aria-label="${esc(kind === 'cond' ? T('Test betingelsen', 'Test condition') : T('Kjør handlingen', 'Run action'))}">${can('t' + path) ? ui.ic(kind === 'cond' ? 'mdi:check-decagram-outline' : 'mdi:play', 18) : '<span class="spn s"></span>'}</button>` : ''}
      ${kind !== 'opt' ? `<button class="bt sm ic ${st.yb && st.yb.has(path) ? 'on' : ''}" data-a="bk-yaml" data-v="${esc(path)}" aria-label="YAML">${ui.ic('mdi:code-braces', 18)}</button>` : ''}
      <span class="sp"></span>
      <button class="bt sm ic warn" data-a="bk-del" data-v="${esc(path)}" aria-label="${esc(T('Slett', 'Delete'))}">${ui.ic('mdi:delete-outline', 18)}</button>
    </div>`;
  }
  function blockYaml(path, b, st) {
    const f = F(path, '__self'), raw = st.raw && st.raw[f];
    return `${ui.field({ f, t: 'yaml', value: raw != null ? raw.text : M.yaml.dump(b).replace(/\n$/, ''), area: true, rows: 8, mono: true })}${raw && raw.err ? `<span class="fh err">${esc(raw.err)}</span>` : ''}`;
  }
  function block(kind, path, b, st, idx, len, depth) {
    const t = kind === 'trig' ? trigType(b) : kind === 'cond' ? condType(b) : actType(b);
    const cat = kind === 'trig' ? TRIG : kind === 'cond' ? COND : ACT;
    const meta = cat[t === 'scene_short' ? 'scene' : t] || (kind === 'act' && t === 'call' ? ACT.call : null) || [t, 'mdi:code-json', ''];
    let title = meta[0] === 'Varsling' ? T('Varsling', 'Notification') : T(meta[0]), icon = meta[1];
    if (kind === 'act' && t === 'call') { const s = b.action || b.service || ''; const D = String(s).split('.')[0]; if (s === 'scene.turn_on') { title = T('Aktiver scene'); icon = ACT.scene[1]; } else if (D === 'script' || /^script\./.test(s)) { title = T('Kjør skript'); icon = ACT.script[1]; } else if (D === 'notify') { title = T('Varsling', 'Notification'); icon = ACT.notify[1]; } else if (/turn_on$/.test(s)) icon = 'mdi:toggle-switch'; else if (/turn_off$/.test(s)) icon = 'mdi:toggle-switch-off-outline'; }
    if (kind === 'act' && t === 'condition') { const c = COND[condType(b)]; if (c) icon = c[1]; title = `${T('Betingelse')} · ${T(c ? c[0] : condType(b))}`; }
    const open = isOpen(st, path), off = b && b.enabled === false;
    const sum = b && (b.alias || '') ? b.alias : kind === 'trig' ? sumTrig(b) : kind === 'cond' ? sumCond(b) : sumAct(b);
    const idTag = kind === 'trig' && b && b.id ? `<span class="tag">${esc(b.id)}</span>` : '';
    const head = `<button class="bh" data-a="bk-tog" data-v="${esc(path)}" aria-expanded="${open}"><span class="hi ${kind}">${ui.ic(icon, 20)}</span><span class="ht"><b>${esc(title)}${off ? ` <span class="tag">${esc(T('av', 'off'))}</span>` : ''}</b><i data-noi18n>${esc(sum)}</i></span>${idTag}${ui.ic('mdi:chevron-down', 20, 'color:var(--ki-text-3, #7f7f7f);flex:none;transition:transform .25s;' + (open ? 'transform:rotate(180deg)' : ''))}</button>`;
    let body = '';
    if (open) {
      const yb = st.yb && st.yb.has(path);
      body = `<div class="bb">${toolbar(path, kind, b, st, idx, len)}${yb ? blockYaml(path, b, st) : form(kind, t, path, b, st, depth)}</div>`;
    }
    return `<div class="blk ${off ? 'off' : ''} ${open ? 'open' : ''} d${Math.min(depth, 3)}" data-key="bk-${esc(path)}">${head}${body}</div>`;
  }
  function common(kind, path, b, st) {
    if (kind === 'trig') return `<details class="adv"><summary>${esc(T('Avansert', 'Advanced'))}</summary><div class="frm">${w(path, { k: 'id', l: 'Utløser-ID', ph: 'f.eks. morgen', h: 'Brukes i «Utløst av»-betingelser og i maler (trigger.id)' }, b.id, st)}${w(path, { k: 'variables', w: 'yaml', l: 'Variabler' }, b.variables, st)}</div></details>`;
    if (kind === 'cond') return `<details class="adv"><summary>${esc(T('Avansert', 'Advanced'))}</summary><div class="frm">${w(path, { k: 'alias', l: 'Navn (valgfritt)' }, b.alias, st)}</div></details>`;
    return `<details class="adv"><summary>${esc(T('Avansert', 'Advanced'))}</summary><div class="frm">${w(path, { k: 'alias', l: 'Navn (valgfritt)', h: 'Vises i stedet for oppsummeringen' }, b.alias, st)}${w(path, { k: 'continue_on_error', w: 'bool', l: 'Fortsett ved feil' }, b.continue_on_error, st)}</div></details>`;
  }
  function form(kind, t, path, b, st, depth) {
    let inner = '';
    if (kind === 'trig') inner = TF[t] ? TF[t].map((o) => w(path, o, b[o.k], st)).join('') : blockYaml(path, b, st);
    else if (kind === 'cond' || (kind === 'act' && t === 'condition')) {
      const ct = condType(b);
      if (['and', 'or', 'not'].includes(ct)) inner = list('cond', path + '.conditions', b.conditions, st, depth + 1);
      else inner = CF[ct] ? CF[ct].map((o) => w(path, o, b[o.k], st)).join('') : blockYaml(path, b, st);
    } else {
      switch (t) {
        case 'call': inner = renderCall(path, b, st); break;
        case 'scene_short': inner = w(path, { k: 'scene', w: 'ent', l: 'Scene', d: 'scene' }, b.scene, st); break;
        case 'delay': inner = w(path, { k: 'delay', w: 'dur', l: 'Varighet', ph: '00:01:00' }, b.delay, st); break;
        case 'wait_template': inner = w(path, { k: 'wait_template', w: 'tpl', l: 'Vent til' }, b.wait_template, st) + w(path, { k: 'timeout', w: 'dur', l: 'Maks ventetid (valgfritt)' }, b.timeout, st) + w(path, { k: 'continue_on_timeout', w: 'bool', l: 'Fortsett når tiden går ut', def: true }, b.continue_on_timeout, st); break;
        case 'wait_for_trigger': inner = list('trig', path + '.wait_for_trigger', b.wait_for_trigger, st, depth + 1) + w(path, { k: 'timeout', w: 'dur', l: 'Maks ventetid (valgfritt)' }, b.timeout, st) + w(path, { k: 'continue_on_timeout', w: 'bool', l: 'Fortsett når tiden går ut', def: true }, b.continue_on_timeout, st); break;
        case 'if': inner = `<div class="nl"><div class="nh">${esc(T('Hvis', 'If'))}</div>${list('cond', path + '.if', b.if, st, depth + 1)}</div><div class="nl"><div class="nh">${esc(T('Så', 'Then'))}</div>${list('act', path + '.then', b.then, st, depth + 1)}</div>${b.else ? `<div class="nl"><div class="nh">${esc(T('Ellers', 'Else'))}<button data-a="bk-rmkey" data-v="${esc(path)}" data-k="else">${esc(T('Fjern', 'Remove'))}</button></div>${list('act', path + '.else', b.else, st, depth + 1)}</div>` : `<button class="addl" data-a="bk-addkey" data-v="${esc(path)}" data-k="else">${ui.ic('mdi:plus', 16)}${esc(T('Legg til «ellers»', 'Add «else»'))}</button>`}`; break;
        case 'choose': inner = arr(b.choose).map((o, i) => `<div class="nl opt" data-key="opt-${esc(path)}-${i}"><div class="nh">${esc(T('Valg', 'Option'))} ${i + 1}${o.alias ? ` · <span data-noi18n>${esc(o.alias)}</span>` : ''}<button data-a="bk-del" data-v="${esc(path + '.choose.' + i)}">${esc(T('Fjern', 'Remove'))}</button></div>${w(path + '.choose.' + i, { k: 'alias', l: 'Navn (valgfritt)' }, o.alias, st)}<div class="nh s">${esc(T('Hvis', 'If'))}</div>${list('cond', `${path}.choose.${i}.conditions`, o.conditions, st, depth + 1)}<div class="nh s">${esc(T('Så', 'Then'))}</div>${list('act', `${path}.choose.${i}.sequence`, o.sequence, st, depth + 1)}</div>`).join('')
          + `<button class="addl" data-a="bk-addopt" data-v="${esc(path)}">${ui.ic('mdi:plus', 16)}${esc(T('Legg til valg', 'Add option'))}</button>`
          + (b.default ? `<div class="nl"><div class="nh">${esc(T('Ellers (standard)', 'Otherwise (default)'))}<button data-a="bk-rmkey" data-v="${esc(path)}" data-k="default">${esc(T('Fjern', 'Remove'))}</button></div>${list('act', path + '.default', b.default, st, depth + 1)}</div>` : `<button class="addl" data-a="bk-addkey" data-v="${esc(path)}" data-k="default">${ui.ic('mdi:plus', 16)}${esc(T('Legg til standardvalg', 'Add default'))}</button>`); break;
        case 'repeat': {
          const r = b.repeat || {}, mode = r.count != null ? 'count' : r.while ? 'while' : r.until ? 'until' : r.for_each ? 'for_each' : 'count';
          inner = `${ui.seg(path + '.repeat::__mode', mode, [['count', T('Antall', 'Count')], ['while', T('Mens', 'While')], ['until', T('Til', 'Until')], ['for_each', T('For hver', 'For each')]])}`
            + (mode === 'count' ? w(path + '.repeat', { k: 'count', w: 'num', l: 'Antall ganger' }, r.count, st) : mode === 'for_each' ? w(path + '.repeat', { k: 'for_each', w: 'yaml', l: 'Liste (YAML)', ph: '- stue\n- kjokken' }, r.for_each, st) : `<div class="nl"><div class="nh">${esc(mode === 'while' ? T('Mens', 'While') : T('Til', 'Until'))}</div>${list('cond', `${path}.repeat.${mode}`, r[mode], st, depth + 1)}</div>`)
            + `<div class="nl"><div class="nh">${esc(T('Gjør', 'Do'))}</div>${list('act', path + '.repeat.sequence', r.sequence, st, depth + 1)}</div>`;
          break;
        }
        case 'parallel': inner = list('act', path + '.parallel', b.parallel, st, depth + 1); break;
        case 'sequence': inner = list('act', path + '.sequence', b.sequence, st, depth + 1); break;
        case 'variables': inner = w(path, { k: 'variables', w: 'yaml', l: 'Variabler', ph: 'lysstyrke: 60', rows: 5 }, b.variables, st); break;
        case 'event': inner = w(path, { k: 'event', l: 'Hendelse', mono: true }, b.event, st) + w(path, { k: 'event_data', w: 'yaml', l: 'Hendelsesdata' }, b.event_data, st); break;
        case 'stop': inner = w(path, { k: 'stop', l: 'Grunn' }, b.stop, st) + w(path, { k: 'error', w: 'bool', l: 'Stopp som feil' }, b.error, st) + w(path, { k: 'response_variable', l: 'Svarvariabel (valgfritt)' }, b.response_variable, st); break;
        case 'set_conversation_response': inner = w(path, { k: 'set_conversation_response', w: 'tpl', l: 'Svartekst', ph: 'Ok, alt lys er slått av' }, b.set_conversation_response, st); break;
        default: inner = blockYaml(path, b, st);
      }
    }
    const isCondInAct = kind === 'act' && t === 'condition';
    return `<div class="frm">${inner}</div>${common(isCondInAct ? 'cond' : kind, path, b, st)}`;
  }
  function list(kind, path, items, st, depth) {
    const L = arr(items);
    const lab = kind === 'trig' ? T('Legg til utløser', 'Add trigger') : kind === 'cond' ? T('Legg til betingelse', 'Add condition') : T('Legg til handling', 'Add action');
    return `<div class="bl" data-key="bl-${esc(path)}">${L.map((b, i) => block(kind, `${path}.${i}`, b, st, i, L.length, depth || 0)).join('')}
      <button class="addl" data-a="bk-add" data-v="${esc(path)}" data-k="${kind}">${ui.ic('mdi:plus', 16)}${esc(lab)}</button></div>`;
  }

  /* ------------------------------------------------------------ typevelger */
  function pickerHtml(kind, q) {
    const cat = kind === 'trig' ? TRIG : kind === 'cond' ? COND : ACT;
    const qq = String(q || '').toLowerCase();
    const items = Object.entries(cat).filter(([k]) => k !== 'unknown' && k !== 'device').filter(([k, [n, , d]]) => !qq || (T(n) + ' ' + d + ' ' + k).toLowerCase().includes(qq));
    return `<label class="sq">${ui.ic('mdi:magnify', 20)}<input data-f="__pq" value="${esc(q || '')}" placeholder="${esc(T('Søk', 'Search'))}" autocomplete="off"></label>
      <div class="tg">${items.map(([k, [n, i, d]]) => `<button class="ty" data-a="pick" data-v="${k}"><span class="hi">${ui.ic(i, 20)}</span><span class="ht"><b>${esc(T(n))}</b><i>${esc(T(d))}</i></span></button>`).join('')}</div>
      <button class="ty" data-a="pick" data-v="__yaml" style="width:100%"><span class="hi">${ui.ic('mdi:code-json', 20)}</span><span class="ht"><b>${esc(T('Lim inn YAML', 'Paste YAML'))}</b><i>${esc(T('Enhetsblokker og alt annet', 'Device blocks and anything else'))}</i></span></button>`;
  }

  /* ------------------------------------------------------------ handlinger fra editoren */
  // ctx: side-ctx (69-ha-config), st: sidetilstand med st.cfg, done: kalles etter endring (dirty + render)
  function act(ctx, a, el, st, done) {
    const p = el.dataset.v;
    const L = (lp) => { let x = getAt(st.cfg, lp); if (!Array.isArray(x)) { x = arr(x); setAt(st.cfg, lp, x); } return x; };
    st.open = st.open || new Set();
    switch (a) {
      case 'bk-tog': M.haptic('selection'); if (st.open.has(p)) st.open.delete(p); else st.open.add(p); return ctx.render(), true;
      case 'bk-up': case 'bk-down': {
        const { list: lp, i } = parentOf(p), X = L(lp), j = a === 'bk-up' ? i - 1 : i + 1;
        if (j < 0 || j >= X.length) return true;
        [X[i], X[j]] = [X[j], X[i]];
        st.open = new Set([...st.open].filter((o) => !o.startsWith(lp + '.')));
        st.open.add(`${lp}.${j}`);
        M.haptic('selection'); done(); return true;
      }
      case 'bk-dup': { const { list: lp, i } = parentOf(p), X = L(lp); const c = clone(X[i]); if (isObj(c) && c.id && getAt(st.cfg, lp) === st.cfg.triggers) c.id = c.id + '_2'; X.splice(i + 1, 0, c); st.open.add(`${lp}.${i + 1}`); M.haptic('light'); done(); return true; }
      case 'bk-en': { const b = getAt(st.cfg, p); if (!isObj(b)) return true; if (b.enabled === false) delete b.enabled; else b.enabled = false; M.haptic('selection'); done(); return true; }
      case 'bk-del': {
        if (!ctx.confirm('del' + p)) return true;
        const { list: lp, i } = parentOf(p), X = L(lp); X.splice(i, 1);
        st.open = new Set([...st.open].filter((o) => !o.startsWith(lp + '.')));
        M.haptic('medium'); done(); return true;
      }
      case 'bk-yaml': { st.yb = st.yb || new Set(); if (st.yb.has(p)) st.yb.delete(p); else st.yb.add(p); ctx.render(); return true; }
      case 'bk-addkey': { const b = getAt(st.cfg, p); b[el.dataset.k] = []; done(); return true; }
      case 'bk-rmkey': { const b = getAt(st.cfg, p); delete b[el.dataset.k]; done(); return true; }
      case 'bk-addopt': { const b = getAt(st.cfg, p); b.choose = arr(b.choose); b.choose.push({ conditions: [], sequence: [] }); M.haptic('light'); done(); return true; }
      case 'bk-test': {
        const b = getAt(st.cfg, p), k = el.dataset.k;
        const run = k === 'cond' || actType(b) === 'condition'
          ? ctx.ws('test_condition', { condition: b }).then((r) => { M.haptic(r && r.result ? 'success' : 'warning'); ctx.toast(r && r.result ? T('Betingelsen er oppfylt', 'Condition passes') : T('Betingelsen er ikke oppfylt', 'Condition does not pass'), { icon: r && r.result ? 'mdi:check' : 'mdi:close' }); })
          : ctx.ws('execute_script', { sequence: [b] }).then(() => { M.haptic('success'); ctx.toast(T('Handlingen er kjørt', 'Action ran')); });
        ctx.busy('t' + p, run.catch((e) => ctx.err(e)));
        return true;
      }
      case 'bk-add': {
        const kind = el.dataset.k;
        const title = kind === 'trig' ? T('Ny utløser', 'New trigger') : kind === 'cond' ? T('Ny betingelse', 'New condition') : T('Ny handling', 'New action');
        let q = '';
        ctx.sheet({
          title, html: pickerHtml(kind, q),
          onInput: (inp, v) => { if (inp.dataset.f === '__pq') { q = v; M.ha.current.sheetHtml(pickerHtml(kind, q)); const i = M.ha.current.psEl.querySelector('input[data-f="__pq"]'); if (i) { i.focus(); i.setSelectionRange(q.length, q.length); } } },
          onAct: (pa, pel) => {
            if (pa !== 'pick') return false;
            const k = pel.dataset.v;
            const nb = k === '__yaml' ? {} : kind === 'trig' ? NEW_TRIG(k) : kind === 'cond' ? NEW_COND(k) : NEW_ACT(k);
            const X = L(p); X.push(nb);
            const np = `${p}.${X.length - 1}`;
            st.open.add(np);
            if (k === '__yaml') { st.yb = st.yb || new Set(); st.yb.add(np); }
            M.haptic('success'); done();
            setTimeout(() => { const e2 = M.ha.current && M.ha.current.root.querySelector(`[data-key="bk-${window.CSS.escape(np)}"]`); if (e2) e2.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
            return true;
          },
        });
        return true;
      }
      case 'bool': { const [bp, k] = p.split('::'); const b = getAt(st.cfg, bp) || {}; const cur = getAt(b, k); setAt(b, k, !(cur === true || (cur == null && el.classList.contains('on')))); M.haptic('selection'); done(); return true; }
      case 'day': { const [bp, k] = el.dataset.f.split('::'); const b = getAt(st.cfg, bp); const D = arr(b[k]); const i = D.indexOf(p); if (i >= 0) D.splice(i, 1); else D.push(p); const o = DAYS.map(([v]) => v).filter((v) => D.includes(v)); if (o.length) b[k] = o; else delete b[k]; M.haptic('selection'); done(); return true; }
      case 'area': { const [bp, k] = el.dataset.f.split('::'); const b = getAt(st.cfg, bp); const cur = arr(getAt(b, k)); const i = cur.indexOf(p); if (i >= 0) cur.splice(i, 1); else cur.push(p); if (!isObj(b.target)) b.target = {}; if (cur.length) setAt(b, k, cur); else setAt(b, k, undefined); M.haptic('selection'); done(); return true; }
      case 'dfadd': { const [bp, k] = p.split('::'); const b = getAt(st.cfg, bp); const ex = el.dataset.ex, sel = el.dataset.sel; let v = sel === 'boolean' ? true : ex !== '' && !isNaN(Number(ex)) ? Number(ex) : ex || ''; if (sel === 'number' && v === '') v = 0; if (!isObj(b.data)) b.data = {}; setAt(b, k, v); M.haptic('light'); done(); return true; }
      case 'dfdel': { const [bp, k] = p.split('::'); const b = getAt(st.cfg, bp); setAt(b, k, undefined); M.haptic('light'); done(); return true; }
      case 'seg': {
        const [bp, k] = el.dataset.f.split('::');
        if (k === '__mode') { const r = getAt(st.cfg, bp); const seq = r.sequence || []; ['count', 'while', 'until', 'for_each'].forEach((x) => delete r[x]); if (p === 'count') r.count = 2; else if (p === 'for_each') r.for_each = []; else r[p] = []; r.sequence = seq; M.haptic('selection'); done(); return true; }
        return false;
      }
      default: return false;
    }
  }
  // Felt-endring: data-f="<sti>::<nøkkel>", data-t = widget
  function input(ctx, el, val, commit, st, done) {
    const f = el.dataset.f; if (!f || !f.includes('::')) return false;
    const [bp, k] = f.split('::'), t = el.dataset.t || 'text';
    const b = bp === '' ? st.cfg : getAt(st.cfg, bp);
    if (!b || typeof b !== 'object') return true;
    const clean = (v) => (v === '' || v == null || (Array.isArray(v) && !v.length) ? undefined : v);
    let v;
    switch (t) {
      case 'num': v = val === '' ? undefined : !isNaN(Number(String(val).replace(',', '.'))) ? Number(String(val).replace(',', '.')) : val; break;
      case 'list': { if (val == null || Array.isArray(val)) { v = val; break; } const L = String(val).split(',').map((x) => x.trim()).filter(Boolean); v = L.length > 1 ? L : L[0]; break; }
      case 'lines': v = String(val).split('\n').map((x) => x.trim()).filter(Boolean); break;
      case 'dur': { const s = String(val).trim(); v = /^\d+$/.test(s) ? Number(s) : s; break; }
      case 'ent': v = val || undefined; break;
      case 'yaml': {
        st.raw = st.raw || {};
        const txt = String(val);
        if (!txt.trim()) { delete st.raw[f]; v = undefined; break; }
        try { v = M.yaml.parse(txt); delete st.raw[f]; } catch (e) { st.raw[f] = { text: txt, err: e.message }; if (commit) ctx.render(); return true; }
        if (k === '__self') { const { list: lp, i } = parentOf(bp); const X = getAt(st.cfg, lp); if (Array.isArray(X)) X[i] = v; st.raw[f] = { text: txt }; done(!commit); return true; }
        if (k === '__rest') { const keep = {}; const D = isObj(b.data) ? b.data : {}; const sk = simpleKeysOf(b); Object.keys(D).forEach((x) => { if (sk.has(x)) keep[x] = D[x]; }); const nd = { ...keep, ...(isObj(v) ? v : {}) }; if (Object.keys(nd).length) b.data = nd; else delete b.data; st.raw[f] = { text: txt }; done(!commit); return true; }
        break;
      }
      case 'svc': v = String(val).trim() || undefined; if (b.service && !b.action) delete b.service; break;
      default: v = val;
    }
    if (t === 'list' && el.dataset.f.endsWith('::entity_id')) v = arr(v);
    if (k === '__rest' && v === undefined) { const keep = {}; const D = isObj(b.data) ? b.data : {}; const sk = simpleKeysOf(b); Object.keys(D).forEach((x) => { if (sk.has(x)) keep[x] = D[x]; }); if (Object.keys(keep).length) b.data = keep; else delete b.data; done(!commit); return true; }
    setAt(b, k, clean(v));
    if (k.startsWith('target.') && isObj(b.target) && !Object.keys(b.target).length) delete b.target;
    if (k.startsWith('data.') && isObj(b.data) && !Object.keys(b.data).length) delete b.data;
    if (el.classList && el.classList.contains('rng')) { const n = el.parentNode && el.parentNode.querySelector('.nin'); if (n) n.value = val; const mn = Number(el.min), mx = Number(el.max); el.style.setProperty('--p', Math.round(((Number(val) - mn) / ((mx - mn) || 1)) * 100) + '%'); }
    done(!commit && t !== 'ent' && t !== 'list' && t !== 'sel');
    return true;
  }

  /* ------------------------------------------------------------ datalister (tjenester, tilstander, utløser-ID-er) */
  function datalists(st) {
    const h = H(); const svcs = [];
    if (h && h.services) Object.keys(h.services).sort().forEach((d) => Object.keys(h.services[d]).sort().forEach((s) => svcs.push(`${d}.${s}`)));
    const ids = new Set(); const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (isObj(o)) { Object.values(o).forEach(walk); } };
    walk(st.cfg);
    const tids = arr(st.cfg && st.cfg.triggers).map((t) => t && t.id).filter(Boolean);
    const ents = new Set(); const we = (o) => { if (Array.isArray(o)) o.forEach(we); else if (isObj(o)) { if (o.entity_id) arr(o.entity_id).forEach((e) => ents.add(e)); Object.values(o).forEach(we); } };
    we(st.cfg);
    const times = Object.keys((h && h.states) || {}).filter((x) => /^input_datetime\./.test(x) || (/^sensor\./.test(x) && h.states[x].attributes.device_class === 'timestamp'));
    return `<datalist data-noi18n id="ha-dl-svc">${svcs.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <datalist data-noi18n id="ha-dl-st">${stateOpts([...ents]).map((s) => `<option value="${esc(s)}">${esc(stName(s))}</option>`).join('')}</datalist>
      <datalist data-noi18n id="ha-dl-tid">${tids.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <datalist data-noi18n id="ha-dl-times">${times.map((s) => `<option value="${esc(s)}">${esc(nm(s))}</option>`).join('')}</datalist>`;
  }

  const CSS = `
    .blk{border-radius:20px;background:var(--ki-surface, #3a3a3a);overflow:hidden;transition:box-shadow .25s, opacity .2s}
    .blk.open{box-shadow:0 0 0 1.5px color-mix(in srgb, var(--pink,#f285c9) 45%, transparent)}
    .blk.off{opacity:.6}
    .blk .blk{background:var(--ki-surface-2, #404040)}
    .blk .blk .blk{background:var(--ki-surface, #3a3a3a)}
    .blk .ch{background:var(--ki-surface-2, #404040)}
    .blk .blk .ch,.blk .blk .in,.blk .blk .bt{background:var(--ki-surface-3, #2f2f2f)}
    .blk .blk .blk .ch,.blk .blk .blk .in,.blk .blk .blk .bt{background:var(--ki-surface-2, #404040)}
    .blk .ch.on{background:var(--ki-pill-bg, #e1e1e1)}
    .blk .bt.warn{background:rgba(242,128,115,.16)}
    .bh{width:100%;display:flex;align-items:center;gap:10px;min-height:58px;padding:8px 12px;text-align:left;box-sizing:border-box}
    .bh .hi{width:36px;height:36px}
    .bh .hi.trig{background:color-mix(in srgb, var(--blue,#73b9f2) 22%, transparent);color:var(--ki-blue-text, var(--blue,#73b9f2))}
    .bh .hi.cond{background:color-mix(in srgb, var(--yellow,#ffd166) 22%, transparent);color:var(--ki-yellow-text, var(--yellow,#ffd166))}
    .bh .hi.act{background:color-mix(in srgb, var(--pink,#f285c9) 22%, transparent);color:var(--ki-pink-text, var(--pink,#f285c9))}
    .bh .ht i{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bb{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)));animation:bbIn .25s cubic-bezier(.2,.8,.2,1)}
    @keyframes bbIn{from{opacity:0;transform:translate3d(0,-4px,0)}to{opacity:1;transform:none}}
    .btb{display:flex;align-items:center;gap:6px;padding:10px 12px 0;flex-wrap:wrap}
    .btb .sp{flex:1}
    .btb .bt.on{background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #232323)}
    .bl{display:flex;flex-direction:column;gap:8px}
    .addl{display:flex;align-items:center;justify-content:center;gap:6px;height:44px;border-radius:16px;border:1.5px dashed rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.18*var(--ki-wa-k,1)),var(--ki-wa-max,1)));font-size:14px;font-weight:500;color:var(--ki-text-2, #afafaf);transition:background .2s, transform .15s}
    .addl:active{transform:scale(.98);background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.04*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .nl{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:18px;background:rgb(0 0 0/.12)}
    .nh{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;color:var(--ki-text-2, #afafaf);text-transform:none;padding:0 4px}
    .nh.s{margin-top:2px}
    .nh button{font-size:12px;font-weight:500;color:var(--ki-red-text, var(--red,#f28073))}
    details.adv{margin:0 14px 12px;border-radius:14px}
    details.adv summary{cursor:pointer;font-size:13px;color:var(--ki-text-mid, #979797);padding:4px 2px;list-style:none;display:flex;align-items:center;gap:6px}
    details.adv summary::before{content:'›';display:inline-block;transition:transform .2s;font-size:16px}
    details.adv[open] summary::before{transform:rotate(90deg)}
    details.adv .frm{padding:8px 0 0}
    .fdr{display:flex;align-items:flex-end;gap:8px}.fdr>.fd{flex:1}
    .nrow{display:flex;align-items:center;gap:8px}
    .nin{width:84px;flex:none;text-align:center}
    .rng{flex:1;-webkit-appearance:none;appearance:none;height:30px;border-radius:15px;background:linear-gradient(90deg, var(--pink,#f285c9) var(--p,50%), var(--ki-surface-3, #2f2f2f) var(--p,50%));outline:none;touch-action:pan-y}
    .rng::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:13px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 4px rgba(0,0,0,.35)}
    .rng::-moz-range-thumb{width:26px;height:26px;border-radius:13px;background:var(--ki-knob, #fafafa);border:0}
  `;

  M.ha.blocks = { list, act, input, normalize, denorm, datalists, sumTrig, sumCond, sumAct, getAt, setAt, CSS, TRIG, COND, ACT, durStr, clone, arr };
})();
