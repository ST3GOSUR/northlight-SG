// Tests with FAKE command output only, so they run on any machine. Run: node tools/test.js
const assert = require('assert');
const lib = require('./lib');

// route print: Wi-Fi default route (metric 35) must beat the VPN one (metric 281). Includes a non-default row.
const route = `
===========================================================================
IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      26.0.0.1      26.75.204.167    281
          0.0.0.0          0.0.0.0      192.168.1.1   192.168.1.20      35
        192.168.1.0    255.255.255.0         On-link     192.168.1.20     291
`;
assert.equal(lib.parseDefaultGateway(route), '192.168.1.1');
assert.equal(lib.parseDefaultGateway('Network Destination Netmask\n 192.168.1.0 255.255.255.0 On-link 192.168.1.20 291'), null);
assert.equal(lib.parseDefaultGateway(''), null);

// ping: English, Czech, timeout, and "unreachable" (reply without TTL) must be told apart.
assert.ok(lib.pingSucceeded('Reply from 1.1.1.1: bytes=32 time=10ms TTL=57'));
assert.ok(lib.pingSucceeded('Odpoved z 1.1.1.1: bajty=32 cas=10 ms TTL=57'));
assert.ok(!lib.pingSucceeded('Request timed out.'));
assert.ok(!lib.pingSucceeded('Reply from 192.168.1.20: Destination host unreachable.'));
assert.ok(!lib.pingSucceeded(''));

// firewall
const fw = lib.parseFirewall('Domain=True\r\nPrivate=True\r\nPublic=False\r\n');
assert.deepEqual(fw, { Domain: true, Private: true, Public: false });
assert.equal(lib.judgeFirewall(fw).status, 'FAIL');
assert.match(lib.judgeFirewall(fw).detail, /Public/);
assert.equal(lib.judgeFirewall(lib.parseFirewall('Domain=True\nPrivate=True\nPublic=True')).status, 'PASS');
assert.equal(lib.judgeFirewall(lib.parseFirewall('')).status, 'SKIP');

// updates
const now = new Date(Date.UTC(2026, 10, 27));
assert.equal(lib.judgeUpdates(lib.parseLastUpdate('2026-11-10\r\n'), now).status, 'PASS');
assert.equal(lib.judgeUpdates(lib.parseLastUpdate('2026-05-01'), now).status, 'FAIL');
assert.equal(lib.judgeUpdates(lib.parseLastUpdate(''), now).status, 'SKIP');

// disk
assert.equal(lib.judgeDisk(50e9, 500e9).status, 'PASS');   // 10% free is the edge: still PASS
assert.equal(lib.judgeDisk(33e9, 476e9).status, 'FAIL');   // 7%

// router: ignoring ping is only a failure when the internet is also down
assert.equal(lib.judgeRouter('192.168.1.1', true, true).status, 'PASS');
assert.equal(lib.judgeRouter('192.168.1.1', false, true).status, 'SKIP');
assert.equal(lib.judgeRouter('192.168.1.1', false, false).status, 'FAIL');
assert.equal(lib.judgeRouter(null, false, false).status, 'FAIL');

// first failing step
const steps = [lib.result('Router', 'PASS', ''), lib.result('Internet', 'FAIL', ''), lib.result('Website', 'FAIL', '')];
assert.equal(lib.firstFailure(steps).name, 'Internet');
assert.equal(lib.firstFailure([lib.result('Router', 'PASS', '')]), null);
assert.equal(lib.formatLine(lib.result('Router', 'PASS', '192.168.1.1 answers')), 'PASS  Router: 192.168.1.1 answers');

console.log('all tests passed');
