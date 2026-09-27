// Fiks 16.9/16.12 · MSH.getGlobals + MSH.resolveTemplates (src/03-templates.js) uten nettleser:
// button-card-arv (template_sensor_big → universal_base), state-fletting, syklus, decluttering-variabler, paper-buttons-preset.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const ctx = { window: { MSH: {} }, console: { ...console, warn: () => {} } };
vm.createContext(ctx);
for (const f of ['02-yaml.js', '03-templates.js']) vm.runInContext(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'), ctx);
const M = ctx.window.MSH, Y = M.yaml;
const J = (v) => JSON.parse(JSON.stringify(v));
let fail = 0, n = 0;
const t = (name, fn) => { n++; try { fn(); console.log('✔', name); } catch (e) { fail++; console.log('✘', name, '\n  ', e.message.split('\n').slice(0, 12).join('\n   ')); } };

const depsYaml = readFileSync(new URL('../examples/import/dependencies_dash.yaml', import.meta.url), 'utf8');
const depsHtml = readFileSync(new URL('./fixtures/dependencies_dash.html', import.meta.url), 'utf8');
const store = { dashboard_globals: { yaml: depsYaml } };
M.store = { get: (p) => (p ? store[p] : store) };

t('getGlobals: ki-store dashboard_globals { yaml } → 40 / 6 / paper_buttons_row (weather, button)', () => {
  const G = M.getGlobals(), I = M.globalsInfo();
  assert.equal(I.err, null);
  assert.equal(Object.keys(G.button_card_templates).length, 40);
  assert.equal(Object.keys(G.decluttering_templates).length, 6);
  assert.deepEqual(Object.keys(G.paper_buttons_row.presets), ['weather', 'button']);
  assert.deepEqual(J(I.counts), { bct: 40, dct: 6, pbr: 2 });
  assert.equal(M.globalsSummary(I.counts), '40 button-card-maler, 6 decluttering-maler, 2 paper-buttons-presets');
  assert.ok(M.getGlobals() === G, 'mellomlagret (samme objekt)');
  assert.ok(M.getGlobals({ yaml: depsYaml }) === G, 'mellomlagret på teksten');
  store.dashboard_globals = { yaml: Y.toText(depsHtml) };
  assert.equal(Object.keys(M.getGlobals().button_card_templates).length, 40, 'Cocoa-HTML konvertert gir det samme');
  store.dashboard_globals = { yaml: depsYaml };
  assert.deepEqual(J(M.getGlobals({ yaml: 'a: [1\n' })), {});
  assert.ok(M.globalsInfo({ yaml: 'a: [1\n' }).err.line, 'YAML-feil med linjenummer');
  assert.deepEqual(J(M.getGlobals({ button_card_templates: { x: { color: 'red' } }, views: [] })), { button_card_templates: { x: { color: 'red' } } });
});

const G0 = M.getGlobals();
const snap = JSON.stringify(G0);

t('missingTemplates: alle popupene i popups.yaml finner malene (også via arv)', () => {
  const docs = Y.splitDocs(readFileSync(new URL('../examples/import/popups.yaml', import.meta.url), 'utf8')).map((d) => Y.parse(d.text));
  assert.equal(docs.length, 10);
  assert.deepEqual(J(M.missingTemplates(docs, G0)), []);
  const G = J(G0); delete G.button_card_templates.universal_base;
  assert.deepEqual(J(M.missingTemplates([{ type: 'custom:button-card', template: 'universal_sensor_ny' }], G)), ['universal_base'], 'arv sjekkes');
  assert.deepEqual(J(M.missingTemplates([{ type: 'custom:decluttering-card', template: 'finnes_ikke' }, { type: 'custom:button-card', template: [' universal_bar '] }], G0)), ['finnes_ikke']);
});

t('template_sensor_big → universal_base (button-card-semantikk)', () => {
  const G = J(G0), B = G.button_card_templates;
  B.template_sensor_big.template = 'universal_base'; // arv slik brukerens mal gjør
  const ub = B.universal_base, big = B.template_sensor_big;
  const card = { type: 'custom:button-card', template: 'template_sensor_big', entity: 'sensor.strom', variables: { text_main: 'Strøm' }, styles: { card: [{ height: '120px' }] } };
  const r = M.resolveTemplates(card, G);
  assert.ok(!('template' in r), 'template fjernet');
  assert.equal(r.type, 'custom:button-card');
  assert.equal(r.entity, 'sensor.strom');
  // variables: universal_base ← template_sensor_big ← kortet
  assert.deepEqual(J(r.variables), J({ ...ub.variables, ...big.variables, text_main: 'Strøm' }));
  // lister legges etter hverandre (eldste først), som button-card mergeDeep
  assert.deepEqual(J(r.styles.card), J([...(ub.styles.card || []), ...big.styles.card, { height: '120px' }]));
  assert.deepEqual(J(r.styles.grid), J([...(ub.styles.grid || []), ...big.styles.grid]));
  // nøkler bare i universal_base beholdes, [[[ ]]] uendret
  assert.deepEqual(J(r.tap_action), J(ub.tap_action));
  assert.equal(r.icon, '[[[ return variables.icon ]]]');
  assert.equal(r.custom_fields.tap, big.custom_fields.tap);
  if (ub.state) assert.ok(Array.isArray(r.state));
  assert.equal(JSON.stringify(G), JSON.stringify(J(G)), 'malene er ikke endret');
  assert.equal(r === card, false);
  assert.equal(card.template, 'template_sensor_big', 'kortet er ikke endret');
});

t('universal_sensor_ny → universal_base fra fixturen (liste-arv)', () => {
  const r = M.resolveTemplates({ type: 'custom:button-card', template: 'universal_sensor_ny', variables: { entity: 'sensor.a' } }, G0);
  const B = G0.button_card_templates;
  assert.ok(!('template' in r));
  assert.equal(r.variables.mode, 'sensor');
  assert.equal(r.variables.entity, 'sensor.a');
  assert.equal(r.variables.badge_text, B.universal_base.variables.badge_text);
  assert.equal(JSON.stringify(G0), snap, 'globals uendret');
});

t('state: per id, ellers per value/operator; nyere vinner; extra_styles fra alle nivåer', () => {
  const G = { button_card_templates: {
    b: { variables: { x: 0, y: 2, n: { b: 2 } }, state: [{ value: 'off', color: 'grey' }], extra_styles: '.b{}', show_name: false },
    a: { template: 'b', variables: { x: 1, n: { a: 1 } }, state: [{ id: 'on', value: 'on', styles: { card: [{ color: 'red' }] } }, { value: 'off', icon: 'mdi:x' }], show_name: true },
  } };
  const r = M.resolveTemplates({ type: 'custom:button-card', template: ['a'], name: '[[[ return 1 ]]]', state: [{ id: 'on', icon: 'mdi:on' }, { value: 'off', operator: '==', name: 'Av' }, { value: 'unavailable', color: 'red' }], extra_styles: '.c{}' }, G);
  assert.deepEqual(J(r), {
    variables: { x: 1, y: 2, n: { b: 2, a: 1 } },
    show_name: true,
    type: 'custom:button-card',
    name: '[[[ return 1 ]]]',
    state: [
      { value: 'off', color: 'grey', icon: 'mdi:x', name: 'Av', operator: '==' },
      { id: 'on', value: 'on', styles: { card: [{ color: 'red' }] }, icon: 'mdi:on' },
      { value: 'unavailable', color: 'red' },
    ],
    extra_styles: '.b{}\n.c{}',
  });
});

t('syklus-vakt og manglende mal', () => {
  const warns = [];
  const G = { button_card_templates: { c: { template: 'd', color: 'c' }, d: { template: 'c', size: '10%' } } };
  const r = M.resolveTemplates({ type: 'custom:button-card', template: 'c' }, G, { warn: (m) => warns.push(m) });
  assert.ok(!('template' in r));
  assert.equal(r.color, 'c');
  assert.equal(r.size, '10%');
  assert.ok(warns.some((w) => /arver seg selv/.test(w)), 'advarsel: ' + warns);
  const orig = { type: 'custom:button-card', template: 'nope', entity: 'x' }, w2 = [];
  assert.ok(M.resolveTemplates(orig, G, { warn: (m) => w2.push(m) }) === orig, 'uendret når malen mangler');
  assert.ok(w2.some((w) => /nope/.test(w)));
});

t('decluttering-card: [[var]] byttes (variables + default:), button-card-maler inni løses', () => {
  const r = M.resolveTemplates({ type: 'custom:decluttering-card', template: 'ki_number_row', variables: [{ entity: 'input_number.temp' }, { icon: 'mdi:thermometer' }, { name: 'Mål' }, { decimals: 2 }] }, G0);
  assert.equal(r.type, 'custom:button-card');
  assert.equal(r.entity, 'input_number.temp');
  assert.equal(r.icon, 'mdi:thermometer');
  assert.equal(r.name, 'Mål');
  assert.ok(/toFixed\(2\) \+ ''/.test(r.label), 'tall + default symbol: ' + r.label);
  assert.ok(/^\[\[\[/.test(r.label.trim()), '[[[ ]]] beholdt');
  assert.deepEqual(J(r.styles.card.find((x) => 'background' in x)), { background: 'var(--gray200)' }, 'default: background');
  assert.equal(r.custom_fields.btn.card.buttons[0].tap_action.target.entity_id, 'input_number.temp');
  assert.ok(!JSON.stringify(r).includes('[[entity]]'));
  const G = J(G0);
  G.decluttering_templates.kort = { default: [{ farge: 'blue' }], card: { type: 'custom:button-card', template: 'template_sensor_small', entity: '[[e]]', variables: { background: '[[farge]]', on: '[[flag]]', obj: '[[o]]' } } };
  const r2 = M.resolveTemplates({ type: 'custom:decluttering-card', template: 'kort', variables: [{ e: 'sensor.b' }, { flag: true }, { o: { a: [1, 2] } }, { farge: 'red' }] }, G);
  assert.ok(!('template' in r2));
  assert.equal(r2.entity, 'sensor.b');
  assert.equal(r2.variables.background, 'red', 'variables før default');
  assert.equal(r2.variables.on, true);
  assert.deepEqual(J(r2.variables.obj), { a: [1, 2] });
  assert.ok(Array.isArray(r2.styles.card), 'template_sensor_small slått inn');
});

t('paper-buttons-row: preset (rad og knapp) flettes inn, preset fjernes', () => {
  const P = G0.paper_buttons_row.presets;
  const r = M.resolveTemplates({ type: 'custom:paper-buttons-row', preset: 'weather', buttons: [{ entity: 'weather.hjem', styles: { button: { width: '90px' } } }, 'sensor.ute', { entity: 'light.a', preset: 'button' }, { entity: 'light.b', preset: 'mushroom' }] }, G0);
  assert.ok(!('preset' in r));
  const [a, b, c, d] = r.buttons;
  assert.equal(a.entity, 'weather.hjem');
  assert.equal(a.styles.button.width, '90px', 'knappen vinner');
  assert.equal(a.styles.state['font-size'], P.weather.styles.state['font-size']);
  assert.ok(!('preset' in a) && b.entity === 'sensor.ute' && b.styles.icon.width === P.weather.styles.icon.width, 'streng-knapp');
  assert.deepEqual(J(c.styles), J(P.button.styles), 'egen preset');
  assert.equal(d.preset, 'mushroom', 'innebygd preset beholdes');
  const rows = M.resolveTemplates({ type: 'custom:paper-buttons-row', buttons: [[{ entity: 'x', preset: 'button' }], [{ entity: 'y' }]] }, G0);
  assert.ok(!('preset' in rows.buttons[0][0]) && rows.buttons[0][0].styles && !rows.buttons[1][0].styles, 'rader (liste av lister)');
});

t('rekursivt: stacks, conditional, expander-card, Bubble Card, custom_fields, elements', () => {
  const bc = { type: 'custom:button-card', template: 'template_sensor_small', entity: 'sensor.x' };
  const cfg = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#t', cards: [{ type: 'vertical-stack', cards: [
    { type: 'conditional', conditions: [], card: bc },
    { type: 'custom:expander-card', cards: [bc], 'title-card': bc },
    { type: 'picture-elements', elements: [bc] },
    { type: 'custom:button-card', custom_fields: { a: { card: bc } } },
    { type: 'custom:decluttering-card', template: 'ki_number_row', variables: [{ entity: 'input_number.y' }] },
    { type: 'entities', entities: [{ type: 'custom:paper-buttons-row', buttons: [{ entity: 'z', preset: 'button' }] }] },
  ] }] };
  const before = JSON.stringify(cfg);
  const r = M.resolveTemplates(cfg, G0);
  assert.equal(JSON.stringify(cfg), before, 'originalen røres ikke');
  const left = [];
  const walk = (v) => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) return v.forEach(walk); if (/button-card|decluttering-card/.test(v.type || '') && 'template' in v) left.push(v.type); if ('preset' in v) left.push('preset'); Object.values(v).forEach(walk); };
  walk(r);
  assert.deepEqual(left, []);
  assert.equal(r.hash, '#t');
  const same = { type: 'vertical-stack', cards: [{ type: 'custom:msh-rom-card', area: 'stue' }] };
  assert.ok(M.resolveTemplates(same, G0) === same, 'uten maler: samme objekt');
});

console.log(`${n - fail}/${n} ${fail ? '✘' : '✔'}`);
process.exit(fail ? 1 : 0);
