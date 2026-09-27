/* KI MSH · liten YAML-parser/-serialiserer for Bubble Card-config (egne popups, «Tilpass Hjem» → Popups).
 * HA-frontenden har js-yaml innebygd, men eksponerer det ikke globalt (ha-yaml-editor parser internt og gir bare
 * isValid, uten linjenummer vi kan stole på på tvers av versjoner). Derfor en egen, avhengighetsfri implementasjon av
 * undersettet dashbord-YAML bruker:
 *   blokk-mapper og -lister (også «- key: v»-elementer og lister på samme innrykk som nøkkelen), kommentarer,
 *   skalarer (plain / 'enkel' / "dobbel" med escapes), null/~, true/false, tall, blokkskalarer | |- |+ > >- (+ innrykk-tall),
 *   flyt-samlinger [a, b] og {a: 1} (også over flere linjer), «---» øverst.
 * Ikke støttet (gir feil med linjenummer): ankre/aliaser (&, *), tagger (!!), tab-innrykk, «? »-nøkler.
 *   MSH.yaml.parse(tekst)  → verdi; kaster MSH.yaml.YAMLError { message, line } (line er 1-basert)
 *   MSH.yaml.dump(verdi)   → YAML-tekst (2 mellomrom, flerlinjestrenger som |-blokk, strenger som ser ut som tall
 *                            quotes – f.eks. bg_opacity: '98' – så typene overlever rundturen)
 */
(function () {
  const M = window.MSH;
  if (!M || M.yaml) return;

  class YAMLError extends Error {
    constructor(message, line) { super(line ? `Linje ${line}: ${message}` : message); this.reason = message; this.line = line || null; }
  }

  /* ------------------------------------------------------------ skalarer */
  const resolvePlain = (s) => {
    if (s === '' || s === '~' || /^(null|Null|NULL)$/.test(s)) return null;
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^[-+]?(0|[1-9][0-9]*)$/.test(s)) return Number(s);
    if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
    if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
    if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return Number(s);
    if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return s[0] === '-' ? -Infinity : Infinity;
    if (/^\.(nan|NaN|NAN)$/.test(s)) return NaN;
    return s;
  };
  const DQ = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', 0: '\0', b: '\b', f: '\f', e: '\x1b', ' ': ' ', N: '\x85', _: '\xa0', L: ' ', P: ' ', a: '\x07', v: '\x0b' };
  // Les quotet streng fra s[i] (i peker på ' eller "); returnerer [verdi, indeks etter slutt-quote]
  function readQuoted(s, i, line) {
    const q = s[i];
    let out = '', j = i + 1;
    while (j < s.length) {
      const ch = s[j];
      if (q === "'") {
        if (ch === "'") { if (s[j + 1] === "'") { out += "'"; j += 2; continue; } return [out, j + 1]; }
        out += ch; j++;
      } else {
        if (ch === '"') return [out, j + 1];
        if (ch === '\\') {
          const e = s[j + 1];
          if (e === 'x' || e === 'u' || e === 'U') {
            const n = e === 'x' ? 2 : e === 'u' ? 4 : 8, hex = s.substr(j + 2, n);
            if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== n) throw new YAMLError('Ugyldig escape i streng', line);
            out += String.fromCodePoint(parseInt(hex, 16)); j += 2 + n; continue;
          }
          if (e === '\n') { j += 2; while (s[j] === ' ') j++; continue; }
          if (!(e in DQ)) throw new YAMLError(`Ukjent escape «\\${e || ''}» i streng`, line);
          out += DQ[e]; j += 2; continue;
        }
        out += ch; j++;
      }
    }
    throw new YAMLError('Streng mangler avsluttende ' + q, line);
  }
  // Fjern kommentar (« #…») utenfor quotes; returnerer innholdet trimmet i slutten
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) { if (q === "'" && s[i + 1] === "'") { i++; continue; } q = null; } else if (q === '"' && ch === '\\') i++; continue; }
      if ((ch === "'" || ch === '"') && (i === 0 || /[\s[{,:]/.test(s[i - 1]))) { q = ch; continue; }
      if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).replace(/\s+$/, '');
    }
    return s.replace(/\s+$/, '');
  }
  // Finn «: » / «:» på slutten som skiller nøkkel og verdi (utenfor quotes/flyt). -1 = ingen.
  function findColon(s) {
    let q = null, depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) { if (q === "'" && s[i + 1] === "'") { i++; continue; } q = null; } else if (q === '"' && ch === '\\') i++; continue; }
      if ((ch === "'" || ch === '"') && (i === 0 || /[\s[{,:]/.test(s[i - 1]))) { q = ch; continue; }
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ':' && depth === 0 && (i === s.length - 1 || s[i + 1] === ' ')) return i;
    }
    return -1;
  }
  function scalar(raw, line) {
    const s = raw.trim();
    if (!s) return null;
    if (s[0] === '"' || s[0] === "'") {
      const [v, end] = readQuoted(s, 0, line);
      if (s.slice(end).trim()) throw new YAMLError(`Uventet tekst etter streng: «${s.slice(end).trim()}»`, line);
      return v;
    }
    if (s[0] === '[' || s[0] === '{') return parseFlow(s, line);
    if (s[0] === '&' || s[0] === '*') throw new YAMLError('Ankre/aliaser (& og *) støttes ikke – skriv verdien ut', line);
    if (s[0] === '!') throw new YAMLError('Tagger (!…) støttes ikke', line);
    if (s[0] === '@' || s[0] === '`') throw new YAMLError(`«${s[0]}» kan ikke starte en verdi – sett den i anførselstegn`, line);
    if (/^[|>]/.test(s)) throw new YAMLError('Blokkskalar må stå sist på linjen', line);
    if (s[0] === '%') throw new YAMLError('Direktiver (%) støttes ikke', line);
    return resolvePlain(s);
  }

  /* ------------------------------------------------------------ flyt-samlinger */
  function parseFlow(src, line) {
    let i = 0;
    const ws = () => { while (i < src.length && /[\s]/.test(src[i])) i++; };
    const err = (m) => { throw new YAMLError(m, line); };
    function value(stop) {
      ws();
      const ch = src[i];
      if (ch === '[') return seq();
      if (ch === '{') return map();
      if (ch === '"' || ch === "'") { const [v, e] = readQuoted(src, i, line); i = e; return v; }
      let j = i;
      while (j < src.length && !stop.includes(src[j]) && !(src[j] === ':' && (src[j + 1] === ' ' || stop.includes(src[j + 1] || '')))) j++;
      const raw = src.slice(i, j).trim(); i = j;
      return raw === '' ? null : scalar(raw, line);
    }
    function seq() {
      i++; const out = [];
      ws();
      if (src[i] === ']') { i++; return out; }
      for (;;) {
        ws();
        const v = value(',]');
        ws();
        if (src[i] === ':') { i++; const vv = value(',]'); out.push({ [String(v)]: vv }); ws(); } else out.push(v);
        if (src[i] === ',') { i++; ws(); if (src[i] === ']') { i++; return out; } continue; }
        if (src[i] === ']') { i++; return out; }
        err('Liste mangler «]» eller «,»');
      }
    }
    function map() {
      i++; const out = {};
      ws();
      if (src[i] === '}') { i++; return out; }
      for (;;) {
        ws();
        const k = value(',:}');
        ws();
        let v = null;
        if (src[i] === ':') { i++; v = value(',}'); ws(); }
        const key = String(k);
        if (Object.prototype.hasOwnProperty.call(out, key)) err(`Dobbel nøkkel «${key}»`);
        out[key] = v;
        if (src[i] === ',') { i++; ws(); if (src[i] === '}') { i++; return out; } continue; }
        if (src[i] === '}') { i++; return out; }
        err('Objekt mangler «}» eller «,»');
      }
    }
    const v = value('');
    ws();
    if (i < src.length) err(`Uventet tekst: «${src.slice(i).trim()}»`);
    return v;
  }
  const flowBalance = (s) => {
    let q = null, d = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) { if (q === "'" && s[i + 1] === "'") { i++; continue; } q = null; } else if (q === '"' && ch === '\\') i++; continue; }
      if (ch === '"' || ch === "'") q = ch; else if (ch === '[' || ch === '{') d++; else if (ch === ']' || ch === '}') d--;
    }
    return d;
  };

  /* ------------------------------------------------------------ blokk-parser */
  function parse(text) {
    const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    const raw = src.split('\n');
    // Linjeliste: { n (1-basert), ind, text (uten innrykk/kommentar), raw }
    const L = [];
    let started = false;
    for (let n = 0; n < raw.length; n++) {
      const r = raw[n];
      if (/^ *\t/.test(r) && r.trim()) throw new YAMLError('Tab kan ikke brukes til innrykk – bruk mellomrom', n + 1);
      const body = stripComment(r);
      if (!body.trim()) { L.push({ n: n + 1, blank: true, raw: r }); continue; }
      if (!started && /^---(\s|$)/.test(body)) { started = true; const rest = body.slice(3).trim(); if (rest) L.push({ n: n + 1, ind: 0, text: rest, raw: r }); continue; }
      if (/^\.\.\.\s*$/.test(body)) break;
      if (/^---(\s|$)/.test(body)) throw new YAMLError('Flere dokumenter (---) støttes ikke', n + 1);
      started = true;
      const ind = body.length - body.replace(/^ +/, '').length;
      L.push({ n: n + 1, ind, text: body.slice(ind), raw: r });
    }
    let p = 0;
    const next = () => { while (p < L.length && L[p].blank) p++; return L[p]; };

    // Blokkskalar (| eller >) etter linje ln; parentInd = innrykket til nøkkelen/«-»
    function blockScalar(header, ln, parentInd) {
      const m = /^([|>])([+-]?)([1-9]?)([+-]?)$/.exec(header.trim());
      if (!m) throw new YAMLError(`Ugyldig blokkskalar «${header.trim()}»`, ln);
      const style = m[1], chomp = m[2] || m[4], explicit = m[3] ? Number(m[3]) : 0;
      const lines = [];
      let ind = explicit ? parentInd + explicit : 0;
      // bruk rålinjer (kommentarer er innhold her)
      while (p < L.length) {
        const l = L[p], r = l.raw;
        // tom linje; mellomrom utover blokkens innrykk er innhold (som PyYAML/js-yaml)
        if (!r.trim()) { lines.push(ind && r.length > ind ? r.slice(ind) : ''); p++; continue; }
        const li = r.length - r.replace(/^ +/, '').length;
        if (!ind) { if (li <= parentInd) break; ind = li; }
        if (li < ind) break;
        lines.push(r.slice(ind)); p++;
      }
      // tomme linjer på slutten
      let trail = 0;
      while (lines.length && lines[lines.length - 1] === '') { lines.pop(); trail++; }
      let body;
      if (style === '|') body = lines.join('\n');
      else {
        body = '';
        lines.forEach((x, i) => {
          if (i === 0) { body = x; return; }
          const prev = lines[i - 1];
          if (x === '' ) body += '\n';
          else if (prev === '' || /^\s/.test(x) || /^\s/.test(prev)) body += (prev === '' ? '' : '\n') + x;
          else body += ' ' + x;
        });
      }
      if (!lines.length) return chomp === '+' ? '\n'.repeat(trail) : '';
      if (chomp === '-') return body;
      if (chomp === '+') return body + '\n' + '\n'.repeat(trail);
      return body + '\n';
    }
    // Verdi i linjen (etter «key:» eller «- »): kan være tom (→ nestet blokk), blokkskalar, flyt over flere linjer, skalar
    function inlineValue(rest, l, ownInd) {
      const r = rest.trim();
      if (r === '') {
        const nx = next();
        if (!nx) return null;
        if (nx.ind > ownInd) return block(nx.ind);
        if (nx.ind === ownInd && /^-( |$)/.test(nx.text) && l.isKey) return block(nx.ind);
        return null;
      }
      if (/^[|>]/.test(r)) return blockScalar(r, l.n, ownInd);
      if ((r[0] === '[' || r[0] === '{') && flowBalance(r) > 0) {
        let acc = r;
        while (flowBalance(acc) > 0) {
          const nx = L[p];
          if (!nx) throw new YAMLError('Flyt-samling mangler avslutning', l.n);
          p++;
          if (!nx.blank) acc += ' ' + nx.text;
        }
        return parseFlow(acc, l.n);
      }
      if ((r[0] === '"' || r[0] === "'")) {
        // quotet streng over flere linjer
        let acc = r, tries = 0;
        for (;;) {
          try { return scalar(acc, l.n); } catch (e) {
            if (!/mangler avsluttende/.test(e.message) || p >= L.length || tries > 200) throw e;
            const nx = L[p]; p++; tries++;
            acc += nx.blank ? '\n' : ' ' + (nx.raw.trim());
          }
        }
      }
      // plain skalar kan fortsette på flere linjer (mer innrykket)
      let acc = r;
      for (;;) {
        const nx = L[p];
        if (!nx || nx.blank || nx.ind <= ownInd || findColon(nx.text) >= 0 || /^-( |$)/.test(nx.text)) break;
        acc += ' ' + nx.text; p++;
      }
      return scalar(acc, l.n);
    }
    function block(ind) {
      const l = next();
      if (!l) return null;
      if (/^-( |$)/.test(l.text)) return seq(ind);
      return map(ind);
    }
    function seq(ind) {
      const out = [];
      for (;;) {
        const l = next();
        if (!l || l.ind < ind) break;
        if (l.ind > ind) throw new YAMLError('Feil innrykk', l.n);
        if (!/^-( |$)/.test(l.text)) break;
        p++;
        const rest = l.text.slice(1);
        const inner = rest.replace(/^ +/, '');
        if (!inner) { out.push(inlineValue('', { ...l, isKey: false }, ind)); continue; }
        const childInd = ind + (l.text.length - inner.length);
        // «- key: v» → objekt med innrykk childInd; «- - x» → nestet liste
        if (/^-( |$)/.test(inner) || findColon(inner) >= 0) {
          L.splice(p, 0, { n: l.n, ind: childInd, text: inner, raw: ' '.repeat(childInd) + inner });
          out.push(block(childInd));
        } else out.push(inlineValue(inner, { ...l, isKey: false }, ind));
      }
      return out;
    }
    function map(ind) {
      const out = {};
      for (;;) {
        const l = next();
        if (!l || l.ind < ind) break;
        if (l.ind > ind) throw new YAMLError('Feil innrykk', l.n);
        if (/^-( |$)/.test(l.text)) break;
        if (/^\? /.test(l.text)) throw new YAMLError('Komplekse nøkler (?) støttes ikke', l.n);
        const c = findColon(l.text);
        if (c < 0) throw new YAMLError(`Mangler «:» etter nøkkelen «${l.text.slice(0, 30)}»`, l.n);
        const kraw = l.text.slice(0, c).trim();
        let key;
        if (kraw[0] === '"' || kraw[0] === "'") { const [v, e] = readQuoted(kraw, 0, l.n); if (kraw.slice(e).trim()) throw new YAMLError('Ugyldig nøkkel', l.n); key = v; }
        else { if (/^[&*!]/.test(kraw)) throw new YAMLError('Ankre/aliaser/tagger støttes ikke', l.n); key = kraw; }
        if (Object.prototype.hasOwnProperty.call(out, key)) throw new YAMLError(`Dobbel nøkkel «${key}»`, l.n);
        p++;
        out[key] = inlineValue(l.text.slice(c + 1), { ...l, isKey: true }, ind);
      }
      return out;
    }
    const first = next();
    if (!first) return null;
    let v;
    if (findColon(first.text) < 0 && !/^-( |$)/.test(first.text)) { p++; v = inlineValue(first.text, first, -1); }
    else v = block(first.ind);
    const rest = next();
    if (rest) throw new YAMLError(rest.ind > 0 ? 'Feil innrykk' : `Uventet innhold: «${rest.text.slice(0, 30)}»`, rest.n);
    return v;
  }

  /* ------------------------------------------------------------ serialiserer */
  const RESERVED = /^(null|Null|NULL|~|true|True|TRUE|false|False|FALSE|y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)$/;
  const needsQuote = (s) => s === '' || RESERVED.test(s) || resolvePlain(s) !== s || /^[\s]|[\s]$/.test(s) || /^[-?:,[\]{}#&*!|>'"%@`]/.test(s) || /: |:$| #|\t/.test(s) || /[\x00-\x1f\x7f]/.test(s);
  const quote = (s) => (/[\x00-\x1f\x7f]/.test(s) ? JSON.stringify(s) : "'" + s.replace(/'/g, "''") + "'");
  const keyStr = (k) => (needsQuote(k) || /\n/.test(k) ? quote(k) : k);
  function scalarStr(v, ind) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return Number.isNaN(v) ? '.nan' : v === Infinity ? '.inf' : v === -Infinity ? '-.inf' : String(v);
    const s = String(v);
    if (s.includes('\n') && !/[\x00-\x09\x0b-\x1f\x7f]/.test(s) && !/[ ]+\n|[ ]+$/.test(s.replace(/\n+$/, ''))) {
      const trail = (/\n+$/.exec(s) || [''])[0].length;
      const body = s.replace(/\n+$/, '');
      const chomp = trail === 0 ? '-' : trail === 1 ? '' : '+';
      const pad = ' '.repeat(ind);
      const hint = /^ /.test(body) ? String(2) : '';
      const lines = (trail > 1 ? s.slice(0, -1) : body).split('\n');
      return `|${hint}${chomp}\n` + lines.map((x) => (x ? pad + x : '')).join('\n');
    }
    return needsQuote(s) ? quote(s) : s;
  }
  function dumpNode(v, ind) {
    const pad = ' '.repeat(ind);
    if (Array.isArray(v)) {
      if (!v.length) return ' []';
      return '\n' + v.map((x) => {
        if (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length) {
          const inner = dumpMap(x, ind + 2);
          return pad + '- ' + inner.slice(ind + 2);
        }
        if (Array.isArray(x) && x.length) return pad + '-' + dumpNode(x, ind + 2).replace(/^\n/, '\n');
        return pad + '-' + (x && typeof x === 'object' ? dumpNode(x, ind + 2) : ' ' + scalarStr(x, ind + 2));
      }).join('\n');
    }
    if (v && typeof v === 'object') {
      if (!Object.keys(v).length) return ' {}';
      return '\n' + dumpMap(v, ind);
    }
    return ' ' + scalarStr(v, ind);
  }
  function dumpMap(o, ind) {
    const pad = ' '.repeat(ind);
    return Object.keys(o).filter((k) => o[k] !== undefined).map((k) => {
      const v = o[k];
      if (Array.isArray(v) && v.length) return pad + keyStr(k) + ':' + dumpNode(v, ind); // lister på samme innrykk som nøkkelen (som HA)
      return pad + keyStr(k) + ':' + dumpNode(v, ind + 2);
    }).join('\n');
  }
  function dump(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).length ? dumpMap(v, 0) + '\n' : '{}\n';
    if (Array.isArray(v)) return v.length ? dumpNode(v, 0).replace(/^\n/, '') + '\n' : '[]\n';
    return scalarStr(v, 0) + '\n';
  }

  /* ------------------------------------------------------------ import: TextEdit/Cocoa-HTML og flere dokumenter (fiks 15.5/15.8) */
  // YAML lagret som «Cocoa HTML Writer» (TextEdit): én linje per <p>, <p …><br></p> = tom linje,
  // <span class="Apple-converted-space"> og &nbsp;/U+00A0 → vanlige mellomrom, entiteter dekodes, andre tagger fjernes.
  const isCocoaHtml = (t) => /<p[\s>]/i.test(t) && (/Cocoa HTML Writer/i.test(t) || /^\s*(<!DOCTYPE|<html)/i.test(t));
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decode = (s) => s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n === 160 ? ' ' : String.fromCodePoint(n); }
    return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
  });
  function fromCocoaHtml(html) {
    const src = String(html == null ? '' : html);
    const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(src) || [null, src])[1];
    const out = [];
    const rx = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = rx.exec(body))) {
      const inner = m[1].replace(/\r?\n/g, '');
      if (/^\s*<br\s*\/?>\s*$/i.test(inner)) { out.push(''); continue; }
      const txt = decode(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/ /g, ' ');
      txt.split('\n').forEach((l) => out.push(l));
    }
    return out.join('\n') + '\n';
  }
  // Tekst fra fil/innliming → YAML-tekst (HTML-eksport konverteres, ellers uendret bortsett fra linjeskift/BOM)
  const toText = (t) => { const s = String(t == null ? '' : t).replace(/^﻿/, ''); return isCocoaHtml(s) ? fromCocoaHtml(s) : s.replace(/\r\n?/g, '\n'); };
  /* Del en tekst i flere dokumenter: ved «---» og ved hver rotlinje som matcher `startRx` (standard
   * «type: custom:bubble-card» på rotnivå). Kommentarer/tomme linjer rett før en start følger det nye dokumentet.
   * → [{ text, line }] (line = 1-basert startlinje i originalen), tomme dokumenter hoppes over. */
  function splitDocs(text, startRx) {
    const rx = startRx || /^type:\s*['"]?custom:bubble-card['"]?\s*(#.*)?$/;
    const L = String(text).split('\n');
    const docs = [];
    let cur = null;
    const flush = () => { if (cur && cur.lines.some((l) => l.trim() && !/^\s*#/.test(l))) docs.push({ text: cur.lines.join('\n').replace(/\n*$/, '\n'), line: cur.line }); cur = null; };
    L.forEach((l, i) => {
      if (/^(---|\.\.\.)(\s|$)/.test(l)) { flush(); return; }
      if (rx.test(l) && cur && cur.lines.some((x) => rx.test(x))) {
        // flytt kommentar-/tomlinjer på slutten av forrige dokument over til det nye
        const tail = [];
        while (cur.lines.length && (!cur.lines[cur.lines.length - 1].trim() || /^#/.test(cur.lines[cur.lines.length - 1]))) tail.unshift(cur.lines.pop());
        while (tail.length && !tail[0].trim()) tail.shift();
        flush();
        cur = { line: i + 1 - tail.length, lines: [...tail, l] };
        return;
      }
      if (!cur) cur = { line: i + 1, lines: [] };
      cur.lines.push(l);
    });
    flush();
    return docs;
  }

  M.yaml = { parse, dump, YAMLError, fromCocoaHtml, isCocoaHtml, toText, splitDocs };
})();
