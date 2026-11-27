// Run: node tools/cloud.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { check } = require('./check-cloud.js');
const { stamp } = require('./stamp-health.js');
const root = path.join(__dirname, '..');

const good = () => JSON.parse(fs.readFileSync(path.join(root, 'northlight.cloud.json'), 'utf8'));
const [RG, APP, ST] = [0, 1, 2];
const withChange = (fn) => { const d = good(); fn(d); return check(d); };
const has = (errors, re) => errors.some((e) => re.test(e));

// The committed design passes
assert.deepEqual(check(good()), []);

// Missing tags: each one, on each resource, is named in the error
for (const tag of ['owner', 'env', 'cost-center']) {
  for (const i of [RG, APP, ST]) {
    const errs = withChange((d) => delete d.resources[i].tags[tag]);
    assert.ok(has(errs, new RegExp(`${d0(i)}.*missing tag "${tag}"`)), `missing ${tag} on resource ${i + 1}`);
  }
}
function d0(i) { return good().resources[i].name; }
assert.ok(has(withChange((d) => { d.resources[APP].tags.owner = '   '; }), /missing tag "owner"/), 'blank tag counts as missing');
assert.ok(has(withChange((d) => { delete d.resources[ST].tags; }), /missing tag "owner"/), 'no tags object at all');
assert.ok(has(withChange((d) => { d.resources[RG].tags.env = 'production'; }), /must be one of: dev, test, prod/));
assert.equal(withChange((d) => { for (const r of d.resources) delete r.tags['cost-center']; }).length, 3, 'all problems reported, not only the first');

// Bad names, per Azure rules
const bad = (i, name) => withChange((d) => { d.resources[i].name = name; });
assert.ok(has(bad(ST, 'st-northlight'), /bad name.*lowercase letters and digits/), 'storage: hyphen');
assert.ok(has(bad(ST, 'StNorthlight'), /bad name/), 'storage: capitals');
assert.ok(has(bad(ST, 'ab'), /bad name/), 'storage: too short');
assert.ok(has(bad(ST, 'a'.repeat(25)), /bad name/), 'storage: 25 chars');
assert.deepEqual(bad(ST, 'a'.repeat(24)), [], 'storage: 24 chars is fine');
assert.ok(has(bad(APP, '-app-northlight'), /bad name.*hyphen/), 'web app: leading hyphen');
assert.ok(has(bad(APP, 'app-northlight-'), /bad name/), 'web app: trailing hyphen');
assert.ok(has(bad(APP, 'app_northlight'), /bad name/), 'web app: underscore');
assert.ok(has(bad(APP, 'a'.repeat(61)), /bad name/), 'web app: 61 chars');
assert.deepEqual(bad(APP, 'a'.repeat(60)), [], 'web app: 60 chars is fine');
assert.ok(has(bad(RG, 'rg northlight'), /bad name/), 'resource group: space');
assert.ok(has(bad(RG, 'rg-northlight.'), /bad name.*period/), 'resource group: trailing period');
assert.ok(has(withChange((d) => { d.resources[RG].name = 5; }), /bad name/), 'name must be text');

// Structure
assert.ok(has(withChange((d) => { d.resources[APP].type = 'vm'; }), /unknown type "vm"/));
assert.ok(has(withChange((d) => { d.resources.push({ ...d.resources[ST] }); }), /used twice/));
assert.ok(has(withChange((d) => { d.resources.splice(ST, 1); }), /needs at least one storageAccount/));
assert.ok(has(withChange((d) => { d.resources[APP].resourceGroup = 'rg-elsewhere'; }), /"rg-elsewhere" is not defined/));
assert.ok(has(withChange((d) => { delete d.resources[ST].resourceGroup; }), /needs a "resourceGroup"/));
assert.ok(has(withChange((d) => { delete d.location; }), /Missing "location"/));
assert.ok(has(check({ location: 'x', resources: [] }), /non-empty list/));
assert.ok(has(check(null), /JSON object/));
assert.ok(has(withChange((d) => { d.resources.push(null); }), /must be an object/));

// Command line: exit code is what stops the deploy
const run = (design) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-')), 'design.json');
  fs.writeFileSync(file, typeof design === 'string' ? design : JSON.stringify(design));
  return spawnSync(process.execPath, [path.join(__dirname, 'check-cloud.js'), file], { encoding: 'utf8' });
};
let r = run(good());
assert.equal(r.status, 0);
assert.match(r.stdout, /^OK: 3 resources checked/);
const broken = good(); delete broken.resources[APP].tags['cost-center'];
r = run(broken);
assert.equal(r.status, 1, 'a missing tag fails the check');
assert.match(r.stderr, /missing tag "cost-center"/);
assert.equal(run('{ not json').status, 1, 'unreadable file fails the check');
assert.equal(spawnSync(process.execPath, [path.join(__dirname, 'check-cloud.js'), path.join(os.tmpdir(), 'nope.json')], { encoding: 'utf8' }).status, 1);
assert.equal(spawnSync(process.execPath, [path.join(__dirname, 'check-cloud.js')], { encoding: 'utf8' }).status, 0, 'default file passes');

// health.json and the stamp
const health = JSON.parse(fs.readFileSync(path.join(root, 'health.json'), 'utf8'));
assert.deepEqual(Object.keys(health).sort(), ['buildDate', 'name', 'version']);
assert.match(health.version, /^\d+\.\d+\.\d+$/);
assert.ok(!Number.isNaN(Date.parse(health.buildDate)));
const s = stamp(health, new Date(Date.UTC(2030, 0, 2, 3, 4, 5)));
assert.equal(s.buildDate, '2030-01-02T03:04:05.000Z');
assert.equal(s.name, health.name);
assert.throws(() => stamp(null), /JSON object/);
assert.throws(() => stamp([]), /JSON object/);
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'health-')), 'health.json');
fs.writeFileSync(tmp, JSON.stringify(health));
assert.equal(spawnSync(process.execPath, [path.join(__dirname, 'stamp-health.js'), tmp]).status, 0);
assert.notEqual(JSON.parse(fs.readFileSync(tmp, 'utf8')).buildDate, health.buildDate, 'stamp script changes the build date');

// Workflow: the checker runs in its own job and deploy waits for it; the stamp comes before the upload
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy.yml'), 'utf8');
assert.match(wf, /jobs:\s*\n\s*check:/);
assert.match(wf, /run: node tools\/check-cloud\.js/);
assert.match(wf, /deploy:\s*\n\s*needs: check/);
assert.ok(wf.indexOf('stamp-health.js') < wf.indexOf('upload-pages-artifact'), 'stamp before upload');
assert.ok(wf.indexOf('check-cloud.js') < wf.indexOf('deploy-pages'), 'check before deploy');
assert.match(wf, /branches: \[main\]/);
assert.ok(!/pages: write/.test(wf.split('deploy:')[0]), 'the check job has no pages permission');

// Cost write-up lists every priced item from the design
const cost = fs.readFileSync(path.join(root, 'cost-estimate.md'), 'utf8');
for (const word of ['Resource group', 'App Service Basic B1', 'Hot LRS', 'pricing calculator', '2026-11-27']) assert.ok(cost.includes(word), word);
const parts = [...cost.matchAll(/\| ([\d.]+) \|\r?\n/g)].map((m) => Number(m[1]));
assert.ok(Math.abs(parts.reduce((a, b) => a + b, 0) - 12.7335) < 1e-9, 'line items add up to the total');

console.log('all tests passed');
