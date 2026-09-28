// Testdata for Kart (#kart, msh-kart-card, fiks 20.22/23.3): posisjoner for personer/soner, en Tesla (device_tracker gps),
// en Leaflet-stub (window.L – CDN/OSM er ikke nåbar i sandkassen) og Entur-svar (bare kartets egne spørringer:
// kartLinjer/kartLinje/kartStopp + vehicles-API-et; Ruter-kortets spørringer går videre som før).
window.mockExtend(({ add, S }) => {
  const HOME = [59.9139, 10.7522];
  if (S['zone.home']) Object.assign(S['zone.home'].attributes, { latitude: HOME[0], longitude: HOME[1], radius: 100 });
  else add('zone.home', 0, { friendly_name: 'Hjem', icon: 'mdi:home', latitude: HOME[0], longitude: HOME[1], radius: 100 });
  add('zone.marka', 0, { friendly_name: 'Marka', icon: 'mdi:pine-tree', latitude: 59.975, longitude: 10.69, radius: 900 });
  if (S['person.sebastian']) Object.assign(S['person.sebastian'].attributes, { latitude: HOME[0], longitude: HOME[1], gps_accuracy: 12 });
  if (S['person.cybele']) Object.assign(S['person.cybele'].attributes, { latitude: 59.9275, longitude: 10.7016, gps_accuracy: 30 });
  if (S['person.rune']) Object.assign(S['person.rune'].attributes, { latitude: 59.905, longitude: 10.73, speed: 11.5, gps_accuracy: 8 });
  if (S['device_tracker.sebastian_iphone']) Object.assign(S['device_tracker.sebastian_iphone'].attributes, { latitude: HOME[0], longitude: HOME[1], battery_level: 81 });
  add('device_tracker.tesla_location', 'home', { friendly_name: 'Tesla', source_type: 'gps', latitude: HOME[0] + 0.0001, longitude: HOME[1] + 0.0001, battery_level: 68, gps_accuracy: 5 }, { platform: 'tesla_fleet' });
});

// ---- Leaflet-stub: samme API-bit som kartet bruker, markører som ekte DOM-elementer (klikkbare i testene)
if (!window.L) (function () {
  const log = (window.__leaf = { calls: [], maps: [] });
  const Ev = (o) => Object.assign(o, { _h: {}, on(t, f) { (this._h[t] = this._h[t] || []).push(f); return this; }, fire(t, e) { (this._h[t] || []).forEach((f) => f(e || {})); return this; } });
  const layer = (kind, extra) => Ev({ kind, _map: null, _el: null, addTo(g) { g.addLayer(this); return this; }, _add(map) { this._map = map; if (this._mk) this._mk(map); }, _rm() { if (this._el) this._el.remove(); this._el = null; this._map = null; }, ...extra });
  const L = {
    version: 'stub',
    DomEvent: { stopPropagation() {} },
    map(el, o) {
      o = o || {};
      // som ekte Leaflet: klassene som leaflet.css bruker for touch-action (23.3), kart-pane med flis-pane + markør-pane
      el.classList.add('leaflet-container', 'leaflet-touch', 'leaflet-grab');
      if (o.dragging !== false) el.classList.add('leaflet-touch-drag');
      if (o.touchZoom !== false) el.classList.add('leaflet-touch-zoom');
      const mp = document.createElement('div'); mp.className = 'leaflet-pane leaflet-map-pane';
      mp.innerHTML = '<div class="leaflet-pane leaflet-tile-pane"><div class="leaflet-layer"><div class="leaflet-tile-container"><div class="leaflet-tile leaflet-tile-loaded" style="width:256px;height:256px"></div></div></div></div>';
      el.appendChild(mp);
      const pane = document.createElement('div'); pane.className = 'leaflet-marker-pane'; pane.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      el.appendChild(pane);
      const hd = (on) => ({ _on: on, enabled() { return this._on; }, enable() { this._on = true; return this; }, disable() { this._on = false; return this; } });
      const m = Ev({ el, pane, o, center: [0, 0], zoom: 10, layers: new Set(), _loaded: true,
        dragging: hd(o.dragging !== false), touchZoom: hd(o.touchZoom !== false), doubleClickZoom: hd(o.doubleClickZoom !== false), scrollWheelZoom: hd(o.scrollWheelZoom !== false),
        getContainer() { return el; }, getSize() { const r = el.getBoundingClientRect(); return { x: el.clientWidth || r.width, y: el.clientHeight || r.height }; }, invalidated: 0,
        setView(c, z) { this.center = c; if (z != null) this.zoom = z; log.calls.push(['setView', c, z]); return this; },
        flyTo(c, z) { this.center = c; if (z != null) this.zoom = z; log.calls.push(['flyTo', c, z]); return this; },
        fitBounds(b, o) { log.calls.push(['fitBounds', b.pts.length, o && o.paddingTopLeft, o && o.paddingBottomRight]); return this; },
        flyToBounds(b, o) { log.calls.push(['flyToBounds', b.pts.length, o && o.paddingTopLeft, o && o.paddingBottomRight]); return this; },
        zoomIn() { this.zoom++; log.calls.push(['zoomIn']); return this; }, zoomOut() { this.zoom--; log.calls.push(['zoomOut']); return this; },
        getZoom() { return this.zoom; }, getCenter() { return this.center; }, invalidateSize() { this.invalidated++; return this; },
        addLayer(l) { this.layers.add(l); l._add(this); return this; }, removeLayer(l) { this.layers.delete(l); if (l._rmAll) l._rmAll(); else l._rm(); return this; }, hasLayer(l) { return this.layers.has(l); }, remove() {} });
      el.addEventListener('click', (e) => { if (!(e.target.closest && e.target.closest('.msh-mk'))) m.fire('click', { originalEvent: e }); });
      log.maps.push(m);
      return m;
    },
    tileLayer(url, o) { log.calls.push(['tileLayer', url, o && o.className, o && o.attribution]); return layer('tile', { url, options: o || {} }); },
    layerGroup() {
      const g = layer('group', { items: new Set(),
        addLayer(l) { this.items.add(l); if (this._map) l._add(this._map); return this; },
        removeLayer(l) { this.items.delete(l); l._rm(); return this; },
        clearLayers() { this.items.forEach((l) => l._rm()); this.items.clear(); return this; } });
      g._mk = (map) => g.items.forEach((l) => l._add(map));
      g._rmAll = () => { g.items.forEach((l) => l._rm()); g._map = null; };
      return g;
    },
    divIcon(o) { return { options: o }; },
    marker(ll, o) {
      const mk = layer('marker', { ll, options: o,
        setLatLng(p) { this.ll = p; return this; }, getLatLng() { return this.ll; },
        setIcon(i) { this.options.icon = i; if (this._el) this._el.innerHTML = i.options.html; return this; }, getElement() { return this._el; } });
      mk._mk = (map) => {
        const el = document.createElement('div'); el.className = 'msh-mk leaflet-marker-icon'; el.style.pointerEvents = 'auto'; el.innerHTML = mk.options.icon.options.html;
        el.addEventListener('click', (e) => mk.fire('click', { originalEvent: e }));
        map.pane.appendChild(el); mk._el = el;
      };
      return mk;
    },
    circle(ll, o) { return layer('circle', { ll, options: o, setLatLng(p) { this.ll = p; return this; }, setRadius(r) { this.options.radius = r; return this; } }); },
    polyline(pts, o) { return layer('polyline', { pts, options: o }); },
    latLngBounds(pts) { return { pts, isValid: () => pts.length > 0 }; },
  };
  window.L = L;
})();

// ---- Entur: kartets spørringer (journey-planner med operasjonsnavn kart*, og vehicles-API-et)
(function () {
  if (window.__kartFetch) return;
  const log = (window.__kartFetch = { jp: 0, veh: 0, bodies: [] });
  const enc = (pts) => { let out = '', pl = 0, pn = 0; const e = (v) => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); }; pts.forEach(([a, b]) => { const la = Math.round(a * 1e5), lo = Math.round(b * 1e5); out += e(la - pl) + e(lo - pn); pl = la; pn = lo; }); return out; };
  const LINES = { 'RUT:Line:17': { id: 'RUT:Line:17', publicCode: '17', transportMode: 'tram', presentation: { colour: '0B91EF', textColour: 'FFFFFF' } }, 'RUT:Line:45': { id: 'RUT:Line:45', publicCode: '45', transportMode: 'bus', presentation: { colour: 'E60000', textColour: 'FFFFFF' } } };
  const orig = window.fetch ? window.fetch.bind(window) : null;
  const json = (d) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(d) });
  window.fetch = function (url, opts) {
    const u = String(url || ''), body = opts && typeof opts.body === 'string' ? opts.body : '';
    if (/api\.entur\.io\/realtime\/v2\/vehicles/.test(u)) {
      log.veh++; log.bodies.push(body);
      const now = new Date().toISOString(), t = Date.now() / 60000;
      return json({ data: {
        v0: [{ vehicleId: 'tram-1', lastUpdated: now, bearing: 90, delay: 120, occupancyStatus: 'manySeatsAvailable', destinationName: 'Grefsen st.', mode: 'TRAM', line: { lineRef: 'RUT:Line:17', publicCode: '17' }, location: { latitude: 59.9255 + (t % 1) * 0.001, longitude: 10.7325 }, monitoredCall: { stopPointRef: 'NSR:Quay:11969' } },
          { vehicleId: 'tram-2', lastUpdated: now, bearing: 270, delay: 0, occupancyStatus: 'fewSeatsAvailable', destinationName: 'Rikshospitalet', mode: 'TRAM', line: { lineRef: 'RUT:Line:17', publicCode: '17' }, location: { latitude: 59.918, longitude: 10.745 }, monitoredCall: { stopPointRef: 'NSR:Quay:11970' } }],
        v1: [{ vehicleId: 'bus-1', lastUpdated: now, bearing: 0, delay: -30, occupancyStatus: 'standingRoomOnly', destinationName: 'Voksen skog', mode: 'BUS', line: { lineRef: 'RUT:Line:45', publicCode: '45' }, location: { latitude: 59.9295, longitude: 10.7102 }, monitoredCall: { stopPointRef: 'NSR:Quay:7333' } },
          { vehicleId: 'bus-gammel', lastUpdated: new Date(Date.now() - 180000).toISOString(), bearing: 0, destinationName: 'Gammel', mode: 'BUS', line: { lineRef: 'RUT:Line:45', publicCode: '45' }, location: { latitude: 59.92, longitude: 10.72 } }, // 22.5: > 2 min → skjules
          { vehicleId: 'bus-2', lastUpdated: now, bearing: 180, delay: 300, occupancyStatus: null, destinationName: 'Majorstuen', mode: 'BUS', line: { lineRef: 'RUT:Line:45', publicCode: '45' }, location: { latitude: 59.9101, longitude: 10.7401 }, monitoredCall: null }],
      } });
    }
    if (/api\.entur\.io\/journey-planner/.test(u) && /query kart(Linjer|Linje|Stopp)\b/.test(body)) {
      log.jp++;
      const b = JSON.parse(body), v = b.variables || {};
      if (/kartLinjer/.test(b.query)) return json({ data: { stopPlace: { id: v.id, estimatedCalls: Object.values(LINES).map((l) => ({ serviceJourney: { line: l } })) } } });
      if (/kartLinje/.test(b.query)) {
        const l = LINES[v.id] || null;
        const pts = v.id === 'RUT:Line:17' ? [[59.935, 10.76], [59.925, 10.733], [59.918, 10.745], [59.91, 10.75]] : [[59.94, 10.70], [59.9295, 10.7102], [59.9101, 10.7401]];
        return json({ data: { line: l && { ...l, journeyPatterns: [{ directionType: 'outbound', pointsOnLink: { points: enc(pts) } }, { directionType: 'inbound', pointsOnLink: { points: enc(pts.slice().reverse()) } }] } } });
      }
      if (/kartStopp/.test(b.query)) return json({ data: { quay: { id: v.id, name: 'Bislett', estimatedCalls: [{ expectedArrivalTime: new Date(Date.now() + 120000).toISOString(), serviceJourney: { line: { id: 'RUT:Line:17' } } }] } } });
    }
    return orig ? orig(url, opts) : Promise.reject(new Error('fetch mangler'));
  };
})();
