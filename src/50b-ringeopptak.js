/* Ringeopptak (Fiks 61.7) · fasit: «design/Ringeopptak.dc.html». Modal (fast posisjon, z 1200/1201, maks 480 px, sentrert)
 * i ki-overlay-root – åpnes fra ringevarselet i hurtigpanelet, «tapt ringing»-kortet og «Opptak» i det levende ringekortet på
 * Hjem. Topp: ikon, «Det ringte på · Inngang», «Kl. HH:MM · n min siden», lukk (også trykk på bakgrunnen og Esc).
 * Faner Video · Bilder: Video = klipp (~10 s fra ringingen) med spill av/pause, tidslinje med spoling og klokkeslett
 * (HH:MM:SS) i hjørnet; Bilder = fire bilder (+0, +2, +4, +6 s): stort bilde + miniatyrer. Merker (Person, Pakke) fra
 * deteksjonene rundt ringingen. Knapper: Se live (→ #ringeklokke), Lagre (laster ned), Del (del/kopier lenke).
 * Kilder (Ringeklokke-kortets config, ellers standard):
 *   rec_clip   URL til klippet (standard /local/ringeklokke/klipp.mp4 – lages av en automasjon med camera.record ved ringing,
 *              eller et Frigate/Reolink-klipp)
 *   rec_snaps  fire URL-er eller image.*-entiteter (standard: image.* med ringeklokke/doorbell + snap/bilde i ID-en, ellers
 *              /local/ringeklokke/bilde_0.jpg … bilde_3.jpg – camera.snapshot på +0/+2/+4/+6 s)
 *   Mangler filen → plassholder («Klipp fra ringeklokka» / «Bilde +2 s»), aldri mock.
 * Tapt ringing: går det levende ringekortet ut uten å bli avvist, huskes ringetidspunktet (localStorage ki:ring-missed) og
 * Hjem viser «Det ringte på»-kortet til X trykkes (MSH.ringMissedT / ringMissedClear).
 */
(function () {
  const M = window.MSH;
  if (!M || M.ringRec) return;
  const esc = M.esc, C = M.C;
  const LEN = 10, OFFS = [0, 2, 4, 6];
  const PINKC = 'rgb(242 133 201)';
  const TH = M.theme || {};
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(255 255 255 / ${a})`);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const hms = (t) => { const d = new Date(t); return `${hm(t)}:${pad(d.getSeconds())}`; };
  const mmss = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  const url = (h, u) => (u && u[0] === '/' && h && h.hassUrl ? h.hassUrl(u) : u);
  const bust = (u, t) => (u ? u + (u.includes('?') ? '&' : '?') + 'r=' + Math.floor((t || 0) / 1000) : u);

  /* ------------------------------------------------------------ tapt ringing */
  const MK = 'ki:ring-missed';
  const getMissed = () => { try { const v = JSON.parse(localStorage.getItem(MK) || 'null'); return v && v.t ? Number(v.t) : 0; } catch (e) { return 0; } };
  const setMissed = (t) => { try { if (t) localStorage.setItem(MK, JSON.stringify({ t })); else localStorage.removeItem(MK); } catch (e) { /* */ } };
  M.ringMissedT = () => getMissed();
  M.ringMissedClear = () => { setMissed(0); emit(); };
  M.ringMissedSet = (t) => { setMissed(t || Date.now()); emit(); }; // test / designets «simuler»
  const emit = () => { try { window.dispatchEvent(new CustomEvent('ki-doorbell', { detail: { missed: getMissed() } })); } catch (e) { /* */ } };
  // Det levende kortet gikk ut (ikke avvist) → tapt ringing. Ny ringing fjerner den gamle.
  let lastT = 0;
  const check = () => {
    const R = M.ring || {};
    if (R.t && R.t !== lastT && M.ringActive && M.ringActive()) { lastT = R.t; if (getMissed() && getMissed() < R.t) setMissed(0); }
    if (R.t && !R.dismissed && isFinite(R.until) && R.until && Date.now() >= R.until && getMissed() < R.t) { setMissed(R.t); emit(); }
  };
  window.addEventListener('ki-doorbell', () => setTimeout(check, 60));
  setInterval(check, 5000);
  // Hjem viser kortet også for tapt ringing (samme «Når det ringer»: Kort / Begge)
  const show0 = M.ringShowCard;
  M.ringShowCard = () => (show0 ? show0() : false) || (!!getMissed() && /^(card|both)$/.test(M.doorbellMode ? M.doorbellMode() : 'card'));

  /* ------------------------------------------------------------ kilder */
  const cfg = () => (M.ringCfg ? M.ringCfg() : {});
  function snapSrc(h, i) {
    const c = cfg(), L = Array.isArray(c.rec_snaps) ? c.rec_snaps : null;
    const v = L && L[i];
    if (v && /^image\./.test(v)) { const s = h && h.states[v]; return s && s.attributes.entity_picture ? s.attributes.entity_picture : null; }
    if (v) return v;
    const imgs = h ? M.all(h, 'image', (s, id) => /ring|doorbell|inngang/.test(id) && /snap|bilde|_\d$/.test(id)).sort() : [];
    if (imgs[i]) { const s = h.states[imgs[i]]; return s.attributes.entity_picture || null; }
    return `/local/ringeklokke/bilde_${i}.jpg`;
  }
  const clipSrc = () => cfg().rec_clip || '/local/ringeklokke/klipp.mp4';
  M.ringRecSources = (h) => ({ clip: clipSrc(), snaps: OFFS.map((_, i) => snapSrc(h, i)) });

  /* ------------------------------------------------------------ modal */
  const CSS = `
    ${TH.CSS || ''}
    :host{all:initial}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    ha-icon{--mdc-icon-size:inherit;display:inline-flex}
    .wrap{font-family:${M.FONT};color:var(--ki-text, #fafafa)}
    .bg{position:fixed;inset:0;z-index:1200;background:rgba(10,10,10,0.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)} /* ki-hex-ok: bakteppe */
    .md{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1201;width:calc(100% - 24px);max-width:480px;max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:32px;background:var(--ki-surface, #2f2f2f);box-shadow:0 30px 70px rgba(0,0,0,0.6),inset 0 1px 0 ${WA(0.08)};animation:rIn .25s cubic-bezier(.34,1.3,.64,1)}
    @keyframes rIn{from{opacity:0;transform:translate(-50%,-48%) scale(.97)}}
    .md::-webkit-scrollbar{display:none}
    .hd{display:flex;align-items:center;gap:12px;padding:2px 2px 0 4px}
    .ic{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:rgb(242 181 115);color:var(--ki-on-accent, #232323);font-size:22px}
    .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .t1{font-size:18px;font-weight:600}
    .t2{font-size:13px;color:var(--ki-text-2, #a8a8a8)}
    .x{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #404040);font-size:20px}
    .tabs{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;border-radius:22px;background:var(--ki-surface-3, #232323);touch-action:pan-y}
    .tb{height:40px;border-radius:20px;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--ki-text-1, #c7c7c7);font-size:14px}
    .tb ha-icon{font-size:18px}
    .tb.on{background:${C.accent};color:var(--ki-on-accent, #2a1720)}
    .st{position:relative;aspect-ratio:16/10;border-radius:22px;overflow:hidden;background:#1c1c1c;color:#fafafa} /* ki-hex-ok: kameraflate (mørk øy) */
    .st video,.st img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
    .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#7f7f7f;font-size:12px;text-align:center;padding:12px} /* ki-hex-ok */
    .ph ha-icon{font-size:30px}
    .stamp{position:absolute;left:10px;top:10px;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:11px;background:rgba(0,0,0,0.55);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;pointer-events:none} /* ki-hex-ok */
    .pb{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:32px;display:grid;place-items:center;background:rgba(0,0,0,0.5);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:opacity .2s;font-size:30px} /* ki-hex-ok */
    .pb.on{opacity:.35}
    .pb[disabled]{display:none}
    .sk{display:flex;align-items:center;gap:10px;padding:0 4px}
    .tn{font-size:12px;color:var(--ki-text-2, #a8a8a8);font-variant-numeric:tabular-nums;width:34px}
    .tn.r{text-align:right}
    .bar{position:relative;flex:1;height:24px;cursor:pointer;touch-action:none}
    .bar .tr{position:absolute;left:0;right:0;top:10px;height:4px;border-radius:2px;background:var(--ki-ctrl, #484848)}
    .bar .fi{position:absolute;left:0;top:10px;height:4px;border-radius:2px;background:${PINKC}}
    .bar .kn{position:absolute;top:5px;width:14px;height:14px;border-radius:7px;background:var(--ki-knob, #fafafa);box-shadow:0 1px 4px rgba(0,0,0,0.4)}
    .fr{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .2s}
    .fr.on{opacity:1;pointer-events:auto}
    .th{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .tm{position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:#1c1c1c;color:#fafafa} /* ki-hex-ok */
    .tm.on{box-shadow:inset 0 0 0 2px ${PINKC}}
    .tm img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .tm .ci{position:absolute;inset:0;display:grid;place-items:center;color:#7f7f7f;font-size:20px} /* ki-hex-ok */
    .tm .lb{position:absolute;left:0;right:0;bottom:0;padding:3px 0;background:rgba(0,0,0,0.55);font-size:11px;font-weight:500;text-align:center} /* ki-hex-ok */
    .tm.on .lb{box-shadow:none}
    .dets{display:flex;gap:6px;flex-wrap:wrap;padding:0 2px}
    .dt{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px 0 8px;border-radius:14px;background:var(--ki-surface-2, #404040);font-size:12px;color:var(--ki-text-1, #d0d0d0)}
    .dt ha-icon{font-size:15px}
    .acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ac{height:48px;border-radius:24px;font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--ki-surface-2, #404040)}
    .ac ha-icon{font-size:18px}
    .ac:active,.tm:active,.tb:active{transform:scale(.97)}
    .msg{align-self:center;font-size:12px;color:var(--ki-text-2, #a8a8a8)}
  `;
  let cur = null;
  function open(o) {
    if (cur) cur.close(true);
    const h = M.lastHass, t = (o && o.t) || getMissed() || (M.ring && M.ring.t) || Date.now();
    const A = M.ringAuto ? M.ringAuto(h, cfg()) : {};
    const area = M.ringAreaLabel ? M.ringAreaLabel(h, A) : 'Inngang';
    const src = M.ringRecSources(h);
    const host = document.createElement('div');
    host.className = 'msh-ringrec';
    host.setAttribute('data-ki-sheet-like', '');
    const root = host.attachShadow({ mode: 'open' });
    (M.overlayRoot ? M.overlayRoot() : document.body).appendChild(host);
    const S = { mode: 'video', fr: 0, playing: false, pos: 0, dur: LEN, vErr: false, sErr: {}, msg: '' };
    // Merker: deteksjoner som slo inn innen ±60 s fra ringingen
    const dets = (M.ringDetDefs || []).filter(([k]) => ['person', 'package'].includes(k) && A.det && A.det[k] && h && h.states[A.det[k]] && Math.abs(new Date(h.states[A.det[k]].last_changed).getTime() - t) < 60000).map(([k, label, icon]) => ({ k, label: k === 'person' && A.face ? A.face : label, icon }));
    const ago = () => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'nå' : `${m} min siden`; };
    const vid = () => root.querySelector('video');
    const draw = () => {
      const p = S.dur ? S.pos / S.dur : 0;
      const video = `<div class="st" data-ki-island data-key="stv">${S.vErr ? `<div class="ph">${M.icon('mdi:video-off-outline', 30)}<span>Klipp fra ringeklokka</span><span>Fant ikke klippet</span></div>` : `<video data-nomorph data-key="vid" src="${esc(url(h, bust(src.clip, t)))}" playsinline preload="metadata"></video>`}
          <span class="stamp">${hms(t + S.pos * 1000)}</span>
          <button class="pb${S.playing ? ' on' : ''}" data-a="play" ${S.vErr ? 'disabled' : ''} aria-label="${S.playing ? 'Pause' : 'Spill av'}">${M.icon(S.playing ? 'mdi:pause' : S.pos >= S.dur - 0.05 && S.pos > 0 ? 'mdi:replay' : 'mdi:play', 30)}</button></div>
        <div class="sk"><span class="tn">${mmss(S.pos)}</span><div class="bar" data-seek><div class="tr"></div><div class="fi" style="width:${(p * 100).toFixed(1)}%"></div><span class="kn" style="left:calc(${(p * 100).toFixed(1)}% - 7px)"></span></div><span class="tn r">${mmss(S.dur)}</span></div>`;
      const im = (i) => (S.sErr[i] || !src.snaps[i] ? '' : `<img src="${esc(url(h, bust(src.snaps[i], t)))}" alt="" data-snap="${i}">`);
      const snaps = `<div class="st" data-ki-island data-key="sts">${OFFS.map((sec, i) => `<div class="fr${S.fr === i ? ' on' : ''}">${im(i) || `<div class="ph">${M.icon('mdi:image-outline', 30)}<span>Bilde +${sec} s</span></div>`}</div>`).join('')}<span class="stamp">${hms(t + OFFS[S.fr] * 1000)}</span></div>
        <div class="th">${OFFS.map((sec, i) => `<button class="tm${S.fr === i ? ' on' : ''}" data-a="fr" data-i="${i}" data-ki-island><span class="ci">${M.icon('mdi:camera', 20)}</span>${im(i)}<span class="lb">+${sec} s</span></button>`).join('')}</div>`;
      const html = `<style>${CSS}</style><div class="wrap"><div class="bg" data-a="close"></div>
        <div class="md" data-nodrag data-qs-scroll role="dialog" aria-label="Ringeopptak">
          <div class="hd"><span class="ic">${M.icon('mdi:doorbell', 22)}</span><div class="tt"><span class="t1">Det ringte på · ${esc(area)}</span><span class="t2">Kl. ${hm(t)} · ${ago()}</span></div><button class="x" data-a="close" aria-label="Lukk">${M.icon('mdi:close', 20)}</button></div>
          <div class="tabs" role="tablist">${[['video', 'mdi:movie-open', 'Video'], ['snap', 'mdi:image-multiple', 'Bilder']].map(([k, ic, l]) => `<button class="tb${S.mode === k ? ' on' : ''}" role="tab" aria-selected="${S.mode === k}" data-a="mode" data-v="${k}">${M.icon(ic, 18)}${l}</button>`).join('')}</div>
          ${S.mode === 'video' ? video : snaps}
          ${dets.length ? `<div class="dets">${dets.map((d) => `<span class="dt">${M.icon(d.icon, 15)}${esc(d.label)}</span>`).join('')}</div>` : ''}
          <div class="acts"><button class="ac" data-a="live">${M.icon('mdi:video', 18)}Se live</button><button class="ac" data-a="save">${M.icon('mdi:download', 18)}Lagre</button><button class="ac" data-a="share">${M.icon('mdi:share-variant', 18)}Del</button></div>
          ${S.msg ? `<span class="msg">${esc(S.msg)}</span>` : ''}
        </div></div>`;
      if (!root.firstChild) root.innerHTML = html; else M.morph(root, html);
      bindMedia();
    };
    let bound = null;
    const bindMedia = () => {
      root.querySelectorAll('img[data-snap]').forEach((img) => { if (!img.__b) { img.__b = 1; img.addEventListener('error', () => { S.sErr[img.dataset.snap] = true; draw(); }); } });
      const v = vid();
      if (!v || v === bound) return;
      bound = v;
      v.addEventListener('loadedmetadata', () => { if (isFinite(v.duration) && v.duration > 0) { S.dur = v.duration; draw(); } });
      v.addEventListener('timeupdate', () => { S.pos = v.currentTime; draw(); });
      v.addEventListener('ended', () => { S.playing = false; draw(); });
      v.addEventListener('error', () => { S.vErr = true; S.playing = false; draw(); });
    };
    let msgT = 0;
    const say = (m) => { S.msg = m; draw(); clearTimeout(msgT); msgT = setTimeout(() => { S.msg = ''; draw(); }, 1800); };
    const setPlay = (on) => { const v = vid(); if (!v) return; if (on) { if (S.pos >= S.dur - 0.05) v.currentTime = 0; v.play().then(() => { S.playing = true; draw(); }).catch(() => { S.playing = false; draw(); }); } else { v.pause(); S.playing = false; draw(); } };
    const click = (e) => {
      const b = e.composedPath().find((n) => n && n.dataset && n.dataset.a);
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') { M.haptic('light'); return api.close(); }
      if (a === 'mode') { M.haptic('selection'); setPlay(false); S.mode = b.dataset.v; return draw(); }
      if (a === 'play') { M.haptic('light'); return setPlay(!S.playing); }
      if (a === 'fr') { M.haptic('selection'); S.fr = Number(b.dataset.i); return draw(); }
      if (a === 'live') { M.haptic('light'); setPlay(false); api.close(); if (o && o.onLive) return o.onLive(); return M.openPopup ? M.openPopup('#ringeklokke') : (location.hash = '#ringeklokke'); }
      if (a === 'save') {
        M.haptic('light');
        const u = S.mode === 'video' ? (S.vErr ? null : src.clip) : (S.sErr[S.fr] ? null : src.snaps[S.fr]);
        if (!u) return say(kiT('Ingenting å lagre', 'Nothing to save'));
        const el = document.createElement('a'); el.href = url(h, u); el.download = `ringeklokke-${hm(t).replace(':', '')}${S.mode === 'video' ? '.mp4' : `-${OFFS[S.fr]}s.jpg`}`; document.body.appendChild(el); el.click(); el.remove();
        return say(kiT('Lagret', 'Saved'));
      }
      if (a === 'share') {
        M.haptic('light');
        const u = new URL(url(h, S.mode === 'video' ? src.clip : src.snaps[S.fr]) || location.href, location.href).href;
        if (navigator.share) { navigator.share({ title: 'Ringeklokke', url: u }).catch(() => {}); return undefined; }
        try { navigator.clipboard.writeText(u).then(() => say(kiT('Delingslenke kopiert', 'Share link copied')), () => say(u)); } catch (x) { say(u); }
      }
      return undefined;
    };
    // Spoling: dra på tidslinja (touch-action: none + stopPropagation – fallgruve 2)
    let sk = null;
    const seekAt = (e) => { const bar = root.querySelector('[data-seek]'), v = vid(); if (!bar || !v) return; const r = bar.getBoundingClientRect(), q = M.clamp((e.clientX - r.left) / r.width, 0, 1); S.pos = q * S.dur; try { v.currentTime = S.pos; } catch (x) { /* */ } draw(); };
    const down = (e) => { const bar = e.composedPath().find((n) => n && n.hasAttribute && n.hasAttribute('data-seek')); if (!bar) return; e.stopPropagation(); sk = e.pointerId; try { bar.setPointerCapture(e.pointerId); } catch (x) { /* */ } seekAt(e); };
    const move = (e) => { if (sk === e.pointerId) { e.stopPropagation(); seekAt(e); } };
    const up = (e) => { if (sk === e.pointerId) { sk = null; M.haptic('selection'); } };
    root.addEventListener('click', click);
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    const kd = (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } };
    window.addEventListener('keydown', kd, true);
    const tick = setInterval(() => { if (!S.playing) draw(); }, 30000);
    const api = cur = {
      host, root, S,
      close(silent) { clearInterval(tick); clearTimeout(msgT); window.removeEventListener('keydown', kd, true); const v = vid(); if (v) try { v.pause(); } catch (x) { /* */ } host.remove(); if (cur === api) cur = null; if (!silent && o && o.onClose) o.onClose(); },
    };
    draw();
    return api;
  }
  M.ringRec = { open, close: () => cur && cur.close(), get current() { return cur; }, snapUrl: (h, i, t) => { const s = snapSrc(h, i); return s ? url(h, bust(s, t)) : ''; } };
})();
