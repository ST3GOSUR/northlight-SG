// Checks northlight.cloud.json: every resource has the required tags and a valid Azure name. READ-ONLY.
// Run: node tools/check-cloud.js [path/to/design.json]   Exit code 1 if anything is wrong (the deploy then does not run).
const fs = require('fs');
const path = require('path');

// Azure naming rules per resource type (source: Azure naming rules and restrictions).
const TYPES = {
  resourceGroup: {
    ok: (n) => /^[\w().-]{1,90}$/.test(n) && !n.endsWith('.'),
    hint: '1-90 characters: letters, digits, underscore, hyphen, period, parentheses; cannot end with a period.',
  },
  webApp: {
    ok: (n) => /^[A-Za-z0-9][A-Za-z0-9-]{0,58}[A-Za-z0-9]$/.test(n),
    hint: '2-60 characters: letters, digits and hyphens; cannot start or end with a hyphen.',
  },
  storageAccount: {
    ok: (n) => /^[a-z0-9]{3,24}$/.test(n),
    hint: '3-24 characters: lowercase letters and digits only (no hyphens or capitals).',
  },
};
const REQUIRED_TAGS = ['owner', 'env', 'cost-center'];
const ENVS = ['dev', 'test', 'prod'];

// Returns a list of problems (empty = fine). Reports all of them, not just the first.
function check(design) {
  if (!design || typeof design !== 'object') return ['The design file must contain a JSON object.'];
  const errors = [];
  if (typeof design.location !== 'string' || !design.location.trim()) errors.push('Missing "location" (an Azure region such as northeurope).');
  if (!Array.isArray(design.resources) || !design.resources.length) return [...errors, '"resources" must be a non-empty list.'];

  const groups = new Set(design.resources.filter((r) => r && r.type === 'resourceGroup' && typeof r.name === 'string').map((r) => r.name));
  const seen = new Set();

  design.resources.forEach((r, i) => {
    if (!r || typeof r !== 'object') { errors.push(`Resource ${i + 1}: must be an object.`); return; }
    const label = `Resource ${i + 1}${typeof r.name === 'string' ? ` (${r.name})` : ''}`;
    const rule = TYPES[r.type];
    if (!rule) { errors.push(`${label}: unknown type "${r.type}". Use one of: ${Object.keys(TYPES).join(', ')}.`); return; }

    if (typeof r.name !== 'string' || !rule.ok(r.name)) errors.push(`${label}: bad name "${r.name}". Rule: ${rule.hint}`);
    else if (seen.has(`${r.type}:${r.name}`)) errors.push(`${label}: the ${r.type} name is used twice.`);
    seen.add(`${r.type}:${r.name}`);

    const tags = r.tags && typeof r.tags === 'object' ? r.tags : {};
    for (const t of REQUIRED_TAGS) {
      if (typeof tags[t] !== 'string' || !tags[t].trim()) errors.push(`${label}: missing tag "${t}".`);
    }
    if (typeof tags.env === 'string' && tags.env.trim() && !ENVS.includes(tags.env)) {
      errors.push(`${label}: tag "env" is "${tags.env}" but must be one of: ${ENVS.join(', ')}.`);
    }

    if (r.type !== 'resourceGroup') {
      if (!r.resourceGroup) errors.push(`${label}: needs a "resourceGroup".`);
      else if (!groups.has(r.resourceGroup)) errors.push(`${label}: resourceGroup "${r.resourceGroup}" is not defined in this file.`);
    }
  });

  for (const type of Object.keys(TYPES)) {
    if (!design.resources.some((r) => r && r.type === type)) errors.push(`The design needs at least one ${type}.`);
  }
  return errors;
}

function main() {
  const file = process.argv[2] || path.join(__dirname, '..', 'northlight.cloud.json');
  let design;
  try { design = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    console.error(`Cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  const errors = check(design);
  if (errors.length) {
    errors.forEach((e) => console.error('ERROR ' + e));
    console.error(`\n${errors.length} problem(s) found in ${path.basename(file)}.`);
    process.exit(1);
  }
  console.log(`OK: ${design.resources.length} resources checked (names and tags) in ${path.basename(file)}.`);
}

if (require.main === module) main();
module.exports = { check, TYPES, REQUIRED_TAGS };
