// Fiks 35 (brukervalg) · #server lages når Home Assistant Supervisor (hassio) finnes alene, men ikke når bare UniFi Protect finnes.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/serverstrat-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const r = await p.evaluate(async () => {
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const HOMELAB = ['unifi', 'unifiprotect', 'proxmoxve', 'proxmox_sensors', 'unraid', 'glances'];
  // hass der bare de gitte homelab-plattformene finnes i registeret (andre plattformer urørt)
  const med = (keep) => {
    const h = window.mockHass();
    const ents = {};
    for (const [id, e] of Object.entries(h.entities || {})) {
      const pl = e.platform;
      if ((HOMELAB.includes(pl) || pl === 'hassio') && !keep.includes(pl)) continue;
      ents[id] = e;
    }
    h.entities = ents;
    return h;
  };
  const harServer = async (h) => {
    const dash = await S.generate({}, h);
    const pops = (dash.views[0].cards[0].cards || []);
    return pops.some((c) => c.hash === '#server');
  };
  const plats = Object.values(window.mockHass().entities || {}).map((e) => e.platform);
  return {
    mockHarHassio: plats.includes('hassio'),
    bareHassio: await harServer(med(['hassio'])),
    bareProtect: await harServer(med(['unifiprotect'])),
    ingen: await harServer(med([])),
    alle: await harServer(window.mockHass()),
  };
});
const res = [
  ['mocken har hassio-entiteter', r.mockHarHassio],
  ['#server lages med bare Home Assistant Supervisor (hassio)', r.bareHassio],
  ['#server lages ikke med bare UniFi Protect', !r.bareProtect],
  ['#server lages ikke uten homelab-integrasjoner', !r.ingen],
  ['#server lages med alle integrasjonene', r.alle],
  ['ingen sidefeil', !errs.length],
];
await b.close();
let fail = 0;
for (const [k, v] of res) { console.log(v ? '✔' : '✘', k); if (!v) fail++; }
if (!res.at(-1)[1]) console.log(errs.slice(0, 3));
console.log(fail ? `${fail} feilet` : 'Alt OK');
process.exit(fail ? 1 : 0);
