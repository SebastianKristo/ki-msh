// Ekte Home Assistant for det innebygde dashbordet: samme hass-objekt som HA-frontenden gir kortene
// (states, register, user, config, services, callService/callWS/callApi, connection), men bygget i appen
// over websocket med tokenet fra onboarding. Bygges til www/demo/ki/live-hass.js (esbuild, IIFE).
import { createConnection, subscribeEntities, subscribeConfig, subscribeServices, ERR_INVALID_AUTH } from 'home-assistant-js-websocket';

const AUTH_KEY = 'ki-app-auth';
const readAuth = () => { try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (e) { return null; } };
const writeAuth = (a) => { try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch (e) { /* */ } };

export class InvalidAuth extends Error {}

// Token-utveksling mot /auth/token (fetch går via CapacitorHttp i appen, så CORS er ikke et problem)
export async function tokenRequest(hassUrl, body) {
  const r = await fetch(hassUrl + '/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (r.status === 400 || r.status === 403) throw new InvalidAuth('Innloggingen er utløpt');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.json();
  return { ...t, expires: Date.now() + t.expires_in * 1000 };
}

export async function exchangeCode(hassUrl, clientId, code) {
  const t = await tokenRequest(hassUrl, { grant_type: 'authorization_code', code, client_id: clientId });
  const a = { hassUrl, clientId, access_token: t.access_token, refresh_token: t.refresh_token, expires: t.expires };
  writeAuth(a);
  return a;
}

// Duck-typet Auth for home-assistant-js-websocket (expired, accessToken, wsUrl, refreshAccessToken)
function makeAuth(data) {
  return {
    data,
    get wsUrl() { return data.hassUrl.replace(/^http/, 'ws') + '/api/websocket'; },
    get accessToken() { return data.access_token; },
    get expired() { return Date.now() > data.expires - 30000; },
    async refreshAccessToken() {
      const t = await tokenRequest(data.hassUrl, { grant_type: 'refresh_token', refresh_token: data.refresh_token, client_id: data.clientId });
      data.access_token = t.access_token; data.expires = t.expires;
      writeAuth(data);
    },
  };
}

const byId = (list, key) => { const o = {}; (list || []).forEach((x) => { o[x[key]] = x; }); return o; };

// Kobler til og gir et hass-objekt. onChange kalles når noe endres (nytt objekt hentes med current()).
export async function connect(onChange) {
  const data = readAuth();
  if (!data || !data.refresh_token) throw new InvalidAuth('Ikke innlogget');
  const auth = makeAuth(data);
  if (auth.expired) await auth.refreshAccessToken();
  let conn;
  try { conn = await createConnection({ auth }); }
  catch (e) { if (e === ERR_INVALID_AUTH) throw new InvalidAuth('Innloggingen er utløpt'); throw new Error('Fikk ikke kontakt med Home Assistant (' + e + ')'); }

  const url = data.hassUrl;
  const abs = (p) => (typeof p === 'string' && p[0] === '/' ? url + p : p);
  const st = { states: {}, entities: {}, devices: {}, areas: {}, floors: {}, config: null, services: {}, user: null, themes: { darkMode: true } };

  const loadRegistries = async () => {
    const [ents, devs, areas, floors] = await Promise.all([
      conn.sendMessagePromise({ type: 'config/entity_registry/list' }).catch(() => []),
      conn.sendMessagePromise({ type: 'config/device_registry/list' }).catch(() => []),
      conn.sendMessagePromise({ type: 'config/area_registry/list' }).catch(() => []),
      conn.sendMessagePromise({ type: 'config/floor_registry/list' }).catch(() => []),
    ]);
    st.entities = {};
    ents.forEach((e) => { st.entities[e.entity_id] = { entity_id: e.entity_id, device_id: e.device_id, area_id: e.area_id, name: e.name, icon: e.icon, platform: e.platform, entity_category: e.entity_category, hidden: !!e.hidden_by, labels: e.labels || [], translation_key: e.translation_key, unique_id: e.unique_id }; });
    st.devices = byId(devs, 'id'); st.areas = byId(areas, 'area_id'); st.floors = byId(floors, 'floor_id');
  };
  await loadRegistries();
  st.user = await conn.sendMessagePromise({ type: 'auth/current_user' }).catch(() => ({ id: '', name: '', is_admin: false }));

  let pending = 0;
  const changed = () => { if (pending) return; pending = setTimeout(() => { pending = 0; onChange && onChange(); }, 30); };
  const ready = new Promise((ok) => {
    let first = true;
    subscribeEntities(conn, (ents) => {
      const S = {};
      for (const id in ents) {
        const s = ents[id], a = s.attributes;
        S[id] = a && typeof a.entity_picture === 'string' && a.entity_picture[0] === '/' ? { ...s, attributes: { ...a, entity_picture: url + a.entity_picture } } : s;
      }
      st.states = S;
      if (first) { first = false; ok(); } else changed();
    });
  });
  subscribeConfig(conn, (c) => { st.config = c; changed(); });
  subscribeServices(conn, (s) => { st.services = s; changed(); });
  ['entity_registry_updated', 'device_registry_updated', 'area_registry_updated', 'floor_registry_updated'].forEach((ev) => {
    conn.subscribeEvents(() => loadRegistries().then(changed), ev).catch(() => {});
  });
  await ready;

  const callWS = (m) => conn.sendMessagePromise(m);
  const callService = (domain, service, serviceData, target) => conn.sendMessagePromise({ type: 'call_service', domain, service, service_data: serviceData || {}, target });
  const callApi = async (method, path, body) => {
    if (auth.expired) await auth.refreshAccessToken();
    const r = await fetch(url + '/api/' + path, { method, headers: { Authorization: 'Bearer ' + auth.accessToken, 'Content-Type': 'application/json' }, body: body != null ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { return t; }
  };
  const formatEntityState = (s) => { const u = s.attributes && s.attributes.unit_of_measurement; return s.state + (u ? ' ' + u : ''); };
  const lang = (navigator.language || 'nb').slice(0, 2);

  const current = () => ({
    states: st.states, entities: st.entities, devices: st.devices, areas: st.areas, floors: st.floors,
    user: st.user, config: st.config || {}, services: st.services, themes: st.themes,
    language: lang === 'en' ? 'en' : 'nb', locale: { language: lang === 'en' ? 'en' : 'nb', number_format: 'language', time_format: '24' },
    panelUrl: 'lovelace', connection: conn, auth: { data: { hassUrl: url } },
    callWS, callService, callApi, formatEntityState,
    hassUrl: (p) => abs(p || ''),
  });
  conn.addEventListener('ready', changed);
  return { current, conn, hassUrl: url };
}

export const hasAuth = () => !!(readAuth() && readAuth().refresh_token);
export const clearAuth = () => { try { localStorage.removeItem(AUTH_KEY); } catch (e) { /* */ } };
