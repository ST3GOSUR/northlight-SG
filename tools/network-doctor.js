// READ-ONLY network doctor. Run: node tools/network-doctor.js
// Checks the router, then 1.1.1.1, then a website name, and names the first failing step. Changes no setting.
const { execFileSync, spawnSync } = require('child_process');
const dns = require('dns').promises;
const lib = require('./lib');

if (process.platform !== 'win32') { console.error('network-doctor.js supports Windows only.'); process.exit(2); }

const SITE = 'example.com';

// Host is always a validated IPv4 string or a constant; execFile with no shell means it cannot be injected.
function ping(host) {
  const r = spawnSync('ping', ['-n', '1', '-w', '2000', host], { encoding: 'utf8', timeout: 10000 });
  return lib.pingSucceeded(r.stdout || '');
}

async function main() {
  const routeText = execFileSync('route', ['print', '-4'], { encoding: 'utf8' });
  const gateway = lib.parseDefaultGateway(routeText);

  const routerOk = gateway ? ping(gateway) : false;
  const internetOk = ping('1.1.1.1');
  const results = [
    lib.judgeRouter(gateway, routerOk, internetOk),
    lib.result('Internet (1.1.1.1)', internetOk ? 'PASS' : 'FAIL', internetOk ? 'reachable' : 'not reachable'),
  ];
  try {
    const { address } = await dns.lookup(SITE);
    results.push(lib.result(`Website name (${SITE})`, 'PASS', `resolves to ${address}`));
  } catch (e) {
    results.push(lib.result(`Website name (${SITE})`, 'FAIL', 'name does not resolve'));
  }

  results.forEach((r) => console.log(lib.formatLine(r)));
  const bad = lib.firstFailure(results);
  console.log(bad ? `\nFirst failing step: ${bad.name}` : '\nAll steps passed.');
  process.exitCode = bad ? 1 : 0;
}

main();
