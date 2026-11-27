// Writes the current time into health.json as buildDate. Run by the deploy workflow on its own checkout,
// so the repository keeps a placeholder and only the published copy carries the real build date.
const fs = require('fs');
const path = require('path');

function stamp(health, now = new Date()) {
  if (!health || typeof health !== 'object' || Array.isArray(health)) throw new Error('health.json must contain a JSON object.');
  return { ...health, buildDate: now.toISOString() };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'health.json');
  try {
    fs.writeFileSync(file, JSON.stringify(stamp(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2) + '\n');
    console.log(`Stamped build date into ${path.basename(file)}.`);
  } catch (e) {
    console.error(`Cannot stamp ${file}: ${e.message}`);
    process.exit(1);
  }
}
module.exports = { stamp };
