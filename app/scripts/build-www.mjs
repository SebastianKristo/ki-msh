// Bygger www/ for Capacitor: appens egne sider (web/) + demo-modus med hele src/ og testdataene,
// lagt ut som i prototypen (demo/ki/runtime.html laster ../src/ og ../test/mock/).
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(app, '..');
const www = join(app, 'www');
const demo = join(www, 'demo');

rmSync(www, { recursive: true, force: true });
mkdirSync(demo, { recursive: true });

cpSync(join(app, 'web'), www, { recursive: true });
cpSync(join(app, 'prototype', 'icon.svg'), join(www, 'icon.svg'));
cpSync(join(repo, 'src'), join(demo, 'src'), { recursive: true });
cpSync(join(app, 'prototype', 'src-extra'), join(demo, 'src'), { recursive: true });
cpSync(join(repo, 'test', 'mock-hass.js'), join(demo, 'test', 'mock-hass.js'));
cpSync(join(repo, 'test', 'mock'), join(demo, 'test', 'mock'), { recursive: true });
cpSync(join(app, 'prototype', 'ki'), join(demo, 'ki'), { recursive: true });
cpSync(join(app, 'web', 'native.js'), join(demo, 'ki', 'native.js'));
// Egendefinerte ikonsett i prototypen (phu:tesla-* m.fl., runtime.html laster ../vendor/phu.js)
cpSync(join(app, 'prototype', 'vendor'), join(demo, 'vendor'), { recursive: true });

// SRC-lista i runtime.html genereres fra filene som faktisk ligger i demo/src (som build.mjs: vendor/*-no.js først,
// så navnerekkefølge). Da kan ikke en ny fil i src/ (f.eks. 00-c-tilpass.js, 69*-ha-*.js) mangle i appen.
const srcDir = join(demo, 'src');
const vendor = (existsSync(join(srcDir, 'vendor')) ? readdirSync(join(srcDir, 'vendor')) : []).filter((f) => f.endsWith('-no.js')).sort().map((f) => 'vendor/' + f);
const SRC = [...vendor, ...readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort()];
const rt = join(demo, 'ki', 'runtime.html');
const html = readFileSync(rt, 'utf8');
if (!/const SRC = \[[^\]]*\];/.test(html)) { console.error('fant ikke SRC-lista i runtime.html'); process.exit(1); }
writeFileSync(rt, html.replace(/const SRC = \[[^\]]*\];/, () => `const SRC = ${JSON.stringify(SRC)};`));

// Ikoner og kart lokalt i appen (raskere oppstart, virker uten CDN)
const nm = join(app, 'node_modules');
cpSync(join(nm, '@mdi', 'font', 'css'), join(www, 'vendor', 'mdi', 'css'), { recursive: true });
cpSync(join(nm, '@mdi', 'font', 'fonts'), join(www, 'vendor', 'mdi', 'fonts'), { recursive: true });
cpSync(join(nm, '@mdi', 'js', 'mdi.js'), join(demo, 'vendor', 'mdi.js'));
cpSync(join(nm, 'leaflet', 'dist'), join(demo, 'vendor', 'leaflet'), { recursive: true });

// Ekte HA-tilkobling (home-assistant-js-websocket) som ett skript: brukes av onboarding og dashbordet
for (const out of [join(www, 'live-hass.js'), join(demo, 'ki', 'live-hass.js')]) {
  buildSync({ entryPoints: [join(app, 'web', 'live-hass.js')], bundle: true, format: 'iife', globalName: 'kiLiveHass', target: 'es2020', minify: true, outfile: out, logLevel: 'warning' });
}

for (const f of ['index.html', 'demo/ki/runtime.html', 'demo/src/04-strategy.js']) {
  if (!existsSync(join(www, f))) { console.error('mangler', f); process.exit(1); }
}
console.log('www/ bygget');
