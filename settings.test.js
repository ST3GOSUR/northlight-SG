// Run: node settings.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const { exportAll } = require('./settings.js');
const cfg = require('./config.js');

const fake = (obj) => { // minimal localStorage stand-in
  const keys = Object.keys(obj);
  return { length: keys.length, key: (i) => keys[i], getItem: (k) => obj[k] };
};

// Export includes every record, parses JSON, keeps plain text, sorts keys
const out = exportAll(fake({
  'northlight-staff-users': JSON.stringify([{ username: 'ana' }]),
  'northlight-crm': JSON.stringify({ leads: [] }),
  'plain-note': 'hello world',
  'a-number': '42',
}), new Date(Date.UTC(2026, 10, 27, 10, 0)));
assert.equal(out.recordCount, 4);
assert.equal(out.exportedAt, '2026-11-27T10:00:00.000Z');
assert.equal(out.site, cfg.siteName);
assert.deepEqual(Object.keys(out.data), ['a-number', 'northlight-crm', 'northlight-staff-users', 'plain-note']);
assert.deepEqual(out.data['northlight-staff-users'], [{ username: 'ana' }]);
assert.equal(out.data['plain-note'], 'hello world');
assert.equal(out.data['a-number'], 42);
assert.doesNotThrow(() => JSON.parse(JSON.stringify(out)), 'result is valid JSON');

// Empty and corrupt storage
assert.deepEqual(exportAll(fake({})).data, {});
assert.equal(exportAll(fake({})).recordCount, 0);
assert.equal(exportAll(fake({ broken: '{{oops' })).data.broken, '{{oops');
assert.equal(exportAll(fake({ gone: null })).data.gone, null, 'a record that vanished mid-read does not crash');

// Settings
assert.deepEqual(Object.keys(cfg).sort(), ['exportFilePrefix', 'healthUrl', 'siteName']);
assert.ok(Object.isFrozen(cfg));
assert.ok(fs.existsSync(__dirname + '/' + cfg.healthUrl), 'healthUrl points at a real file');

// Page wiring: ids used by settings.js exist; scripts load in order; index links to the page
const html = fs.readFileSync(__dirname + '/settings.html', 'utf8');
const js = fs.readFileSync(__dirname + '/settings.js', 'utf8');
for (const id of new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]))) assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
assert.ok(html.includes('id="settings-page"'));
assert.ok(html.indexOf('src="config.js"') > 0 && html.indexOf('src="config.js"') < html.indexOf('src="settings.js"'), 'config.js loads first');
assert.ok(/Keep the file private/.test(html), 'privacy warning is on the page');
assert.ok(fs.readFileSync(__dirname + '/index.html', 'utf8').includes('href="settings.html"'), 'index links to settings');

console.log('all tests passed');
