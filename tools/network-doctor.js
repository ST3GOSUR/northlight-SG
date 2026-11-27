// READ-ONLY network doctor. Run: node tools/network-doctor.js [--save]  (--save also writes a dated file in reports/)
// Follows the ladder: 1 Look, 2 Address, 3 Ping router, 4 Ping outside, 5 Ping a name. Names the first failing step.
const os = require('os');
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
  const addresses = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
  const route = lib.parseDefaultRoute(execFileSync('route', ['print', '-4'], { encoding: 'utf8' }));
  const gateway = route && route.gateway;
  const routerOk = gateway ? ping(gateway) : false;
  const internetOk = ping('1.1.1.1');

  let nameResult;
  try {
    const { address } = await dns.lookup(SITE);
    nameResult = lib.result(`Ping a name (${SITE})`, 'PASS', `resolves to ${address}`);
  } catch (e) {
    nameResult = lib.result(`Ping a name (${SITE})`, 'FAIL', 'name does not resolve - suspect DNS');
  }

  const results = [
    lib.judgeLook(addresses),
    lib.judgeAddress(addresses, route && route.ip),
    lib.judgeRouter(gateway, routerOk, internetOk),
    lib.result('Ping outside (1.1.1.1)', internetOk ? 'PASS' : 'FAIL', internetOk ? 'works, the link is fine' : 'not reachable'),
    nameResult,
  ].map((r, i) => ({ ...r, name: `${i + 1} ${r.name}` }));

  const bad = lib.firstFailure(results);
  lib.printAndMaybeSave('network-doctor', [
    ...results.map(lib.formatLine),
    '',
    bad ? `First failing step: ${bad.name}` : 'All steps passed.',
  ]);
  process.exitCode = bad ? 1 : 0;
}

main();
