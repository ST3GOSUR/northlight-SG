// Parsers and judging logic. Pure functions: text in, result out, so the tests can feed fake command output.
// Nothing here runs a command or changes a setting. Parsers avoid translated words (Windows output is localised).

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// `route print -4` output: the default route is the line "0.0.0.0  0.0.0.0  <gateway>  <interface>  <metric>".
// With several default routes (Wi-Fi + VPN) Windows uses the lowest metric, so we do too.
function parseDefaultGateway(routeText) {
  let best = null;
  for (const line of routeText.split(/\r?\n/)) {
    const c = line.trim().split(/\s+/);
    if (c.length >= 5 && c[0] === '0.0.0.0' && c[1] === '0.0.0.0' && IPV4.test(c[2])) {
      const metric = Number(c[4]);
      if (!best || metric < best.metric) best = { gateway: c[2], metric };
    }
  }
  return best && best.gateway;
}

// A ping succeeded if a reply line carries TTL=. "Destination host unreachable" replies have no TTL.
const pingSucceeded = (text) => /TTL=/i.test(text);

// Lines like "Domain=True". Returns { Domain: true, ... }.
function parseFirewall(text) {
  const out = {};
  for (const m of text.matchAll(/^\s*(\w+)=(True|False)\s*$/gim)) out[m[1]] = m[2].toLowerCase() === 'true';
  return out;
}

function parseLastUpdate(text) {
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

const result = (name, status, detail) => ({ name, status, detail }); // status: PASS, FAIL or SKIP

function judgeDisk(freeBytes, totalBytes) {
  const pct = Math.round((100 * freeBytes) / totalBytes);
  const gb = Math.round(freeBytes / 1e9);
  return result('Disk space', pct < 10 ? 'FAIL' : 'PASS', `${gb} GB free (${pct}%)`);
}

// Many routers ignore ping. If the internet works, traffic clearly passes through the router, so that is not a failure.
function judgeRouter(gateway, routerOk, internetOk) {
  if (!gateway) return result('Router', 'FAIL', 'no default route (not connected to any network)');
  if (routerOk) return result('Router', 'PASS', `${gateway} answers`);
  return internetOk
    ? result('Router', 'SKIP', `${gateway} ignores ping, but the internet works`)
    : result('Router', 'FAIL', `${gateway} does not answer`);
}

function judgeFirewall(profiles) {
  const names = Object.keys(profiles);
  if (!names.length) return result('Firewall', 'SKIP', 'could not read firewall status');
  const off = names.filter((n) => !profiles[n]);
  return off.length ? result('Firewall', 'FAIL', `off for: ${off.join(', ')}`) : result('Firewall', 'PASS', 'on for all profiles');
}

function judgeUpdates(lastDate, now = new Date()) {
  if (!lastDate) return result('Updates', 'SKIP', 'could not read update history');
  const days = Math.floor((now - lastDate) / 86400000);
  return result('Updates', days > 60 ? 'FAIL' : 'PASS', `last update installed ${days} day(s) ago`);
}

function firstFailure(results) {
  return results.find((r) => r.status === 'FAIL') || null;
}

const formatLine = (r) => `${r.status.padEnd(4)}  ${r.name}: ${r.detail}`;

module.exports = {
  parseDefaultGateway, pingSucceeded, parseFirewall, parseLastUpdate,
  result, judgeRouter, judgeDisk, judgeFirewall, judgeUpdates, firstFailure, formatLine,
};
