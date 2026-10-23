// Integrasjonen og strategien skal kjenne de samme funksjons-popupene:
// FUNKSJONER i custom_components/ki_msh/const.py (sensor.ki_msh / ki_msh/hus) = M.FUNCTION_POPUPS (src/02-popups.js + 65–67).
// Kjør: node test/funksjoner-sync.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/funksjoner-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const py = JSON.parse(execFileSync('python3', ['-I', '-c',
  'import json,runpy,sys; c=runpy.run_path(sys.argv[1]); print(json.dumps([[f["hash"], f["navn"]] for f in c["FUNKSJONER"]]))',
  resolve('custom_components/ki_msh/const.py')]).toString());
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext()).newPage();
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const js = await p.evaluate(() => window.MSH.FUNCTION_POPUPS.map(([h, n]) => [h, n]));
await b.close();
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const P = new Map(py), J = new Map(js);
const bare = (a, B) => [...a.keys()].filter((h) => !B.has(h));
ok('alle funksjons-popups i strategien finnes i const.py', !bare(J, P).length, bare(J, P));
ok('const.py har ingen popups strategien ikke kjenner', !bare(P, J).length, bare(P, J));
const navn = [...P].filter(([h, n]) => J.has(h) && J.get(h) !== n);
ok('samme navn', !navn.length, navn.map(([h, n]) => `${h}: ${n} ≠ ${J.get(h)}`));
console.log(res.join('\n'));
process.exit(res.some((r) => r.startsWith('✘')) ? 1 : 0);
