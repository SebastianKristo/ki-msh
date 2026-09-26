// HA-ikoner og -farger for hele dashbordet.
// • Ikoner: alle prefiks Home Assistant støtter – mdi:, hass:, og egne sett (phu:, hue:, fapro:, si: …) via window.customIcons / customIconsets.
//   Et .ms-ikon med tekst «prefiks:navn» tegnes automatisk som HA-ikon (ha-icon i HA, MDI-font i forhåndsvisning).
// • Farger: temafarger (My SmartHome Theme v3, var(--red) …) + HA-navngitte farger (var(--red-color) …) + egen hex.
// API: HAPick.icon({ value, onPick(icon) })  ·  HAPick.color({ value, onPick(css, token) })  ·  HAPick.resolve('var(--red)')
(function () {
  if (window.HAPick) return;
  var MDI_CSS = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
  var MDI_META = 'https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/meta.json';
  var inHA = function () { return !!customElements.get('ha-icon'); };

  var THEME = [['red', '#f28073', 'Rød'], ['orange', '#f2b573', 'Oransje'], ['yellow', '#f2d26f', 'Gul'], ['lime', '#b8e674', 'Lime'], ['green', '#66d19e', 'Grønn'], ['blue', '#73b9f2', 'Blå'], ['light-blue', '#c8ddfa', 'Lyseblå'], ['purple', '#ad99e6', 'Lilla'], ['pink', '#f285c9', 'Rosa'], ['brown', '#8c794d', 'Brun'],
    ['gray000', '#232323', 'Grå 000'], ['gray100', '#2f2f2f', 'Grå 100'], ['gray200', '#3a3a3a', 'Grå 200'], ['gray300', '#404040', 'Grå 300'], ['gray400', '#545454', 'Grå 400'], ['gray500', '#696969', 'Grå 500'], ['gray600', '#7f7f7f', 'Grå 600'], ['gray700', '#979797', 'Grå 700'], ['gray800', '#afafaf', 'Grå 800'], ['gray900', '#c7c7c7', 'Grå 900'], ['gray1000', '#e1e1e1', 'Grå 1000'], ['white', '#fafafa', 'Hvit'], ['black', '#232323', 'Svart']];
  var HAC = [['primary', '#03a9f4', 'Primær'], ['accent', '#ff9800', 'Aksent'], ['red', '#f44336'], ['pink', '#e91e63'], ['purple', '#926bc7'], ['deep-purple', '#6e41ab'], ['indigo', '#3f51b5'], ['blue', '#2196f3'], ['light-blue', '#03a9f4'], ['cyan', '#00bcd4'], ['teal', '#009688'], ['green', '#4caf50'], ['light-green', '#8bc34a'], ['lime', '#cddc39'], ['yellow', '#ffeb3b'], ['amber', '#ffc107'], ['orange', '#ff9800'], ['deep-orange', '#ff5722'], ['brown', '#795548'], ['light-grey', '#bdbdbd'], ['grey', '#9e9e9e'], ['dark-grey', '#606060'], ['blue-grey', '#607d8b'], ['black', '#000000'], ['white', '#ffffff'], ['disabled', '#bdbdbd']];
  var tokT = function (t) { return 'var(--' + t[0] + ', ' + t[1] + ')'; }, tokH = function (t) { return 'var(--' + t[0] + '-color, ' + t[1] + ')'; };

  var css = document.createElement('style');
  var rootVars = THEME.map(function (t) { return '--' + t[0] + ':' + t[1]; }).concat(HAC.map(function (t) { return '--' + t[0] + '-color:' + t[1]; })).join(';');
  css.textContent = ':root{' + rootVars + '}' +
    '.ha-ic{font-size:0!important;line-height:0!important;display:inline-grid!important;place-items:center;width:var(--ic-sz,24px);height:var(--ic-sz,24px);vertical-align:middle}' +
    '.ha-ic.mdi::before{font-size:var(--ic-sz,24px)!important;line-height:1!important}' +
    '.ha-ic>ha-icon{--mdc-icon-size:var(--ic-sz,24px);width:var(--ic-sz,24px);height:var(--ic-sz,24px)}';
  (document.head || document.documentElement).appendChild(css);
  if (!inHA() && !document.querySelector('link[href="' + MDI_CSS + '"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = MDI_CSS; document.head.appendChild(l); }

  function resolve(v) {
    var m = /^var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(String(v || '').trim()); if (!m) return v;
    var r = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim(); return r || (m[2] || '').trim() || v;
  }

  // ---- Tegn «prefiks:navn» i .ms-spans som HA-ikon ----
  var RX = /^([a-z][a-z0-9_-]*):([a-z0-9][a-z0-9_-]*)$/;
  function paint(el) {
    var t = (el.textContent || '').trim(), m = RX.exec(t), prev = el.getAttribute('data-ha-ic');
    if (prev === t) return;
    if (prev) { el.classList.remove('ha-ic', 'mdi'); Array.from(el.classList).forEach(function (c) { if (c.indexOf('mdi-') === 0) el.classList.remove(c); }); var old = el.querySelector(':scope>ha-icon'); old && old.remove(); el.removeAttribute('data-ha-ic'); }
    if (!m) return;
    var fs = parseFloat(getComputedStyle(el).fontSize) || 24;
    el.style.setProperty('--ic-sz', fs + 'px'); el.setAttribute('data-ha-ic', t); el.title = el.title || t; el.classList.add('ha-ic');
    if (inHA()) { var hi = document.createElement('ha-icon'); hi.setAttribute('icon', t); el.appendChild(hi); }
    else el.classList.add('mdi', 'mdi-' + (m[1] === 'mdi' || m[1] === 'hass' ? m[2] : 'puzzle-outline'));
  }
  function scan(root) { (root.querySelectorAll ? root.querySelectorAll('.ms') : []).forEach(paint); if (root.classList && root.classList.contains('ms')) paint(root); }
  var mo = new MutationObserver(function (list) { list.forEach(function (r) { var n = r.target.nodeType === 3 ? r.target.parentElement : r.target; if (n && n.classList && n.classList.contains('ms')) paint(n); r.addedNodes && r.addedNodes.forEach(function (a) { a.nodeType === 1 ? scan(a) : a.parentElement && a.parentElement.classList.contains('ms') && paint(a.parentElement); }); }); });
  var start = function () { scan(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); };
  document.body ? start() : document.addEventListener('DOMContentLoaded', start);

  // ---- Ikonlister ----
  var mdiList = null;
  function loadMdi() {
    if (mdiList) return Promise.resolve(mdiList);
    return fetch(MDI_META).then(function (r) { return r.json(); }).then(function (j) { mdiList = j.map(function (x) { return { n: x.name, k: (x.name + ' ' + (x.aliases || []).join(' ') + ' ' + (x.tags || []).join(' ')).toLowerCase() }; }); return mdiList; })
      .catch(function () { mdiList = 'home sofa bed lightbulb lamp ceiling-light floor-lamp door garage thermometer water-percent fan television speaker lock shield-home cctv bell car ev-station flash solar-power pool robot-vacuum washing-machine dishwasher fridge coffee-maker stove oven kettle toilet shower bathtub weather-sunny weather-rainy weather-snowy leaf flower sprinkler calendar account account-group map-marker bus train tram'.split(' ').map(function (n) { return { n: n, k: n }; }); return mdiList; });
  }
  function customSets() {
    var o = {}; ['customIcons', 'customIconsets'].forEach(function (g) { var s = window[g]; s && Object.keys(s).forEach(function (p) { o[p] = s[p]; }); });
    return o;
  }
  var KNOWN = [['phu', 'Custom Brand Icons'], ['hue', 'Hue Icons'], ['fapro', 'Font Awesome Pro'], ['si', 'Simple Icons'], ['bha', 'Bubble / HA']];

  // ---- Arket ----
  var lastTrig = null; document.addEventListener('pointerdown', function (e) { lastTrig = e.target; }, true);
  function frame() {
    var el = lastTrig, r = null;
    while (el && el !== document.body) { var b = el.getBoundingClientRect(); if (b.width >= 320) { r = b; break; } el = el.parentElement; }
    r = r || document.body.getBoundingClientRect();
    return { l: Math.max(0, r.left), w: Math.min(r.right, innerWidth) - Math.max(0, r.left) };
  }
  function sheet(title) {
    var f = frame(), host = document.createElement('div'), sh = host.attachShadow({ mode: 'open' }), w = Math.min(440, f.w);
    host.style.cssText = 'position:fixed;inset:0;z-index:9999';
    sh.innerHTML = (inHA() ? '' : '<link rel="stylesheet" href="' + MDI_CSS + '">') +
      '<style>*{box-sizing:border-box;font-family:inherit}button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.bd{position:fixed;top:0;bottom:0;left:' + f.l + 'px;width:' + f.w + 'px;background:rgba(0,0,0,.5)}' +
      '.pn{position:fixed;bottom:0;left:' + (f.l + f.w / 2 - w / 2) + 'px;width:' + w + 'px;max-height:78vh;display:flex;flex-direction:column;gap:12px;padding:18px 14px 22px;border-radius:32px 32px 0 0;background:#282828;color:#fafafa;font-size:14px;animation:up .28s cubic-bezier(.2,.9,.3,1)}' +
      '@keyframes up{from{transform:translateY(40px);opacity:0}}' +
      '.hd{display:flex;align-items:center;gap:10px;padding:0 4px}.hd b{flex:1;font-size:18px;font-weight:500}.x{width:36px;height:36px;border-radius:18px;background:#404040;display:grid;place-items:center;font-size:18px}' +
      '.in{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;border-radius:14px;background:#3a3a3a}.in input{flex:1;min-width:0;height:100%;border:0;outline:none;background:transparent;color:#fafafa;font:inherit;font-size:14px}' +
      '.chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}.chip{flex:none;height:32px;padding:0 12px;border-radius:16px;background:#3a3a3a;font-size:12px;font-weight:500;color:#c7c7c7}.chip.on{background:#fafafa;color:#282828}' +
      '.sc{overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:14px;min-height:120px}.lb{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7f7f7f;padding:0 4px}' +
      '.gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:6px}.ic{aspect-ratio:1;border-radius:14px;background:#3a3a3a;display:grid;place-items:center;font-size:24px;overflow:hidden}.ic.on{background:#fafafa;color:#282828}.ic span{font-size:9px;color:#979797;padding:2px;text-align:center;word-break:break-all}' +
      '.sw{display:flex;flex-wrap:wrap;gap:8px}.dot{width:34px;height:34px;border-radius:17px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}.dot.on{box-shadow:0 0 0 2px #282828,0 0 0 4px #fafafa}' +
      '.use{height:42px;border-radius:21px;background:#3a3a3a;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#c7c7c7}.note{font-size:12px;color:#7f7f7f;padding:0 4px;line-height:1.4}</style>' +
      '<div class="bd"></div><div class="pn"><div class="hd"><b>' + title + '</b><button class="x">✕</button></div><div class="body" style="display:contents"></div></div>';
    var close = function () { window.haptic && haptic('light'); host.remove(); };
    sh.querySelector('.bd').onclick = close; sh.querySelector('.x').onclick = close;
    document.body.appendChild(host);
    return { root: sh, body: sh.querySelector('.body'), close: close };
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var glyph = function (full) { var m = RX.exec(full) || []; return inHA() ? '<ha-icon icon="' + esc(full) + '"></ha-icon>' : (m[1] === 'mdi' || m[1] === 'hass') ? '<i class="mdi mdi-' + esc(m[2]) + '"></i>' : '<span>' + esc(full) + '</span>'; };

  function pickIcon(o) {
    o = o || {}; var S = sheet('Velg ikon'), cur = o.value || '', set = /^(\w+):/.test(cur) ? cur.split(':')[0] : 'mdi', q = '';
    S.body.innerHTML = '<div class="in"><i class="mdi mdi-magnify" style="color:#7f7f7f;font-size:18px"></i><input placeholder="Søk eller skriv prefiks:navn – mdi:sofa, phu:…"></div><div class="chips"></div><div class="sc"></div>';
    var inp = S.body.querySelector('input'), chips = S.body.querySelector('.chips'), sc = S.body.querySelector('.sc');
    var choose = function (v) { window.haptic && haptic('success'); o.onPick && o.onPick(v); S.close(); };
    function drawChips() {
      var cs = customSets(), sets = [['mdi', 'Material Design (mdi)'], ['hass', 'hass']].concat(Object.keys(cs).filter(function (p) { return p !== 'mdi' && p !== 'hass'; }).map(function (p) { var k = KNOWN.find(function (x) { return x[0] === p; }); return [p, (k ? k[1] : p) + ' (' + p + ')']; }));
      if (!inHA()) KNOWN.forEach(function (k) { if (!sets.some(function (s) { return s[0] === k[0]; })) sets.push([k[0], k[1] + ' (' + k[0] + ')']); });
      chips.innerHTML = sets.map(function (s) { return '<button class="chip' + (s[0] === set ? ' on' : '') + '" data-s="' + s[0] + '">' + esc(s[1]) + '</button>'; }).join('');
      chips.querySelectorAll('.chip').forEach(function (b) { b.onclick = function () { set = b.dataset.s; window.haptic && haptic('selection'); drawChips(); draw(); }; });
    }
    function grid(names, pre) { return '<div class="gr">' + names.map(function (n) { var f = pre + ':' + n; return '<button class="ic' + (f === cur ? ' on' : '') + '" title="' + esc(f) + '" data-v="' + esc(f) + '">' + glyph(f) + '</button>'; }).join('') + '</div>'; }
    function bind() { sc.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { choose(b.dataset.v); }; }); }
    function draw() {
      var raw = q.trim().toLowerCase(), typed = RX.test(raw) ? raw : null, words = raw.replace(/^\w+:/, '').split(/\s+/).filter(Boolean);
      var head = typed ? '<button class="use" data-v="' + esc(typed) + '">' + glyph(typed).replace('<span>', '<span style="font-size:12px">') + ' Bruk «' + esc(typed) + '»</button>' : '';
      if (set === 'mdi' || set === 'hass') {
        sc.innerHTML = head + '<div class="note">Laster ikoner …</div>'; bind();
        loadMdi().then(function (L) { var hits = words.length ? L.filter(function (x) { return words.every(function (w) { return x.k.indexOf(w) >= 0; }); }) : L; sc.innerHTML = head + '<div class="lb">' + hits.length + ' ikoner</div>' + grid(hits.slice(0, 160).map(function (x) { return x.n; }), set); bind(); });
        return;
      }
      var src = customSets()[set];
      if (src && src.getIconList) {
        sc.innerHTML = head + '<div class="note">Laster ' + set + ' …</div>'; bind();
        Promise.resolve(src.getIconList()).then(function (L) { var ns = (L || []).map(function (x) { return x.name || x; }).filter(function (n) { return words.every(function (w) { return String(n).indexOf(w) >= 0; }); }); sc.innerHTML = head + '<div class="lb">' + ns.length + ' ikoner</div>' + grid(ns.slice(0, 160), set); bind(); });
        return;
      }
      sc.innerHTML = head + '<div class="note">' + (inHA() ? 'Settet «' + set + '» har ingen ikonliste. ' : 'Settet «' + set + '» lastes fra HA-integrasjonen og vises i dashbordet. ') + 'Skriv navnet direkte, f.eks. <b>' + set + ':' + (words[0] || 'navn') + '</b>.</div>' +
        (words.length ? '<button class="use" data-v="' + esc(set + ':' + words.join('-')) + '">Bruk «' + esc(set + ':' + words.join('-')) + '»</button>' : ''); bind();
    }
    inp.value = cur; q = RX.test(cur) ? '' : cur;
    inp.oninput = function () { q = inp.value; var m = /^(\w+):/.exec(q.trim()); if (m && m[1] !== set) { set = m[1]; drawChips(); } draw(); };
    inp.select(); drawChips(); draw();
  }

  function pickColor(o) {
    o = o || {}; var S = sheet('Velg farge'), cur = String(o.value || '').trim();
    var row = function (list, tok) { return '<div class="sw">' + list.map(function (t) { var tk = tok(t); return '<button class="dot' + (cur === tk || cur.replace(/\s*,[^)]*\)$/, ')') === tk.replace(/\s*,[^)]*\)$/, ')') || cur.toLowerCase() === t[1] ? ' on' : '') + '" title="' + esc((t[2] || t[0]) + ' · ' + tk) + '" data-t="' + esc(tk) + '" style="background:' + tk + '"></button>'; }).join('') + '</div>'; };
    S.body.innerHTML = '<div class="sc"><div class="lb">Tema · My SmartHome v3</div>' + row(THEME, tokT) + '<div class="lb">Home Assistant</div>' + row(HAC, tokH) +
      '<div class="lb">Egen</div><div class="in"><input type="color" style="flex:none;width:30px;height:30px;padding:0;border:0;background:none"><input class="hx" placeholder="#rrggbb, rgb(…) eller var(--navn)"><button class="use" style="height:32px;padding:0 14px;background:#404040">Bruk</button></div>' +
      '<div class="note">Temafarger lagres som <b>var(--navn)</b> og følger temaet i HA.</div></div>';
    var choose = function (tok) { window.haptic && haptic('success'); o.onPick && o.onPick(resolve(tok), tok); S.close(); };
    S.body.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { choose(b.dataset.t); }; });
    var ci = S.body.querySelector('input[type=color]'), hx = S.body.querySelector('.hx');
    hx.value = cur; if (/^#[0-9a-f]{6}$/i.test(resolve(cur))) ci.value = resolve(cur);
    ci.oninput = function () { hx.value = ci.value; };
    S.body.querySelector('.in .use').onclick = function () { hx.value.trim() && choose(hx.value.trim()); };
  }

  window.HAPick = { icon: pickIcon, color: pickColor, resolve: resolve, theme: THEME, haColors: HAC };
})();
