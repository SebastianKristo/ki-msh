// Genererer docs/kort.md fra kortenes editor-skjema (samme skjema som GUI-editoren).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve('test/.build/docs.js');
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const md = await p.evaluate(() => {
  const hass = window.mockHass();
  const out = [];
  for (const c of window.customCards.filter((x) => x.type.startsWith('msh-'))) {
    const cls = customElements.get(c.type);
    let s = cls.schema; if (typeof s === 'function') { try { s = s(hass, {}); } catch (e) { s = []; } }
    const rows = [];
    const walk = (arr, pre) => (arr || []).forEach((f) => {
      if (!f) return;
      if (f.type === 'section') return walk(f.fields, (pre ? pre + ' › ' : '') + f.label);
      if (f.type === 'overrides') return rows.push([`overrides.{${(f.fields || []).map((x) => x.name).join(', ')}}`, 'bytt entitet', pre]);
      if (f.type === 'lists') { let L = []; try { L = f.lists(hass, {}) || []; } catch (e) { /* */ } return rows.push([`exclude · include.{${L.map((x) => x.key).join(', ')}}`, 'skjul / legg til', pre]); }
      if (f.type === 'order') return rows.push([`${f.name} · ${f.hiddenName}`, `rekkefølge/synlighet: ${(f.options || []).map((o) => o[0]).join(', ')}`, pre]);
      if (f.type === 'gap') return rows.push(['gap', '4 / 8 / 18 px', pre]);
      if (!f.name) return;
      rows.push([f.name, (f.label || '') + (f.options ? ` (${f.options.map((o) => o[0]).join(' | ')})` : '') + (f.type && !['text', 'select'].includes(f.type) ? ` · ${f.type}` : ''), pre]);
    });
    walk(s, '');
    out.push(`## \`${c.type}\`\n\n${c.description || ''}\n\n| Nøkkel | Betydning | Gruppe |\n|---|---|---|\n${rows.map((r) => `| \`${r[0]}\` | ${String(r[1]).replace(/\|/g, '\\|')} | ${r[2] || ''} |`).join('\n')}\n`);
  }
  return out.join('\n');
});
await b.close();
writeFileSync('docs/kort.md', `# Config-nøkler per kort\n\nGenerert fra kortenes editor-skjema (\`node test/docs.mjs\`). Alle kort har i tillegg \`card_id\` (settes automatisk) og kan stå uten config – alt annet autokonfigureres.\n\n${md}`);
console.log('docs/kort.md', md.length);
