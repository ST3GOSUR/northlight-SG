// Run: node staff.test.js (fake data only)
const assert = require('assert');
const s = require('./staff.js');

(async () => {
  // TOTP against RFC 6238 test vectors (secret "12345678901234567890", 8 digits).
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  for (const [t, code] of vectors) assert.equal(await s.totp(secret, t * 1000, 8), code, `RFC vector t=${t}`);
  assert.equal(await s.totp(secret, 59000), '287082'); // 6-digit form
  assert.ok(await s.verifyTotp(secret, '287082', 59000 + 30000), 'previous step accepted');
  assert.ok(!(await s.verifyTotp(secret, '287082', 59000 + 90000)), 'too old rejected');

  // Password hashing
  const salt = Buffer.from('0123456789abcdef').toString('base64');
  const h = await s.hashPassword('pw', salt);
  assert.equal(h, await s.hashPassword('pw', salt));
  assert.notEqual(h, await s.hashPassword('pw2', salt));
  assert.notEqual(h, await s.hashPassword('pw', Buffer.from('fedcba9876543210').toString('base64')));

  // Seed data and the two-step sign-in
  const users = await s.seedUsers();
  assert.equal(users.length, 6);
  assert.deepEqual([...new Set(users.map((u) => u.group))].sort(), ['Design', 'IT', 'Sales']);
  assert.ok(users.every((u) => !JSON.stringify(u).includes('demo')), 'no plaintext password stored');
  assert.ok((await s.checkPassword(users, 'ana', 'Ana-demo-1')).user);
  assert.equal((await s.checkPassword(users, 'ana', 'wrong')).error, 'Wrong username or password.');
  assert.equal((await s.checkPassword(users, 'nobody', 'x')).error, 'Wrong username or password.');
  const ana = users.find((u) => u.username === 'ana');
  assert.ok((await s.checkCode(ana, await s.totp(ana.secret))).user);
  assert.equal((await s.checkCode(ana, '000000', 0)).error, 'Wrong code.');

  // Admin is IT only, enforced in the logic
  const [eli, fay] = ['eli', 'fay'].map((n) => users.find((u) => u.username === n));
  assert.ok(s.canAdmin(eli) && s.canAdmin(fay) && !s.canAdmin(ana) && !s.canAdmin(null));
  await assert.rejects(() => s.joiner(users, ana, 'Zed Test', 'Design'), /Only IT/);
  assert.throws(() => s.leaver(users, ana, 'ben'), /Only IT/);

  // Joiner: can sign in with password + code; bad input rejected
  const { user: zed, password } = await s.joiner(users, eli, 'Zed Test', 'Sales');
  assert.equal(zed.username, 'zedtest');
  assert.ok((await s.checkPassword(users, 'zedtest', password)).user);
  assert.ok((await s.checkCode(zed, await s.totp(zed.secret))).user);
  await assert.rejects(() => s.joiner(users, eli, 'Zed Test', 'Sales'), /already exists/);
  await assert.rejects(() => s.joiner(users, eli, '!!!', 'Sales'), /Enter a name/);
  await assert.rejects(() => s.joiner(users, eli, 'Q', 'Admins'), /Unknown group/);

  // Leaver cannot sign in at either step, and cannot lock IT out by removing themselves
  assert.throws(() => s.leaver(users, eli, 'eli'), /yourself/);
  s.leaver(users, eli, 'zedtest');
  assert.match((await s.checkPassword(users, 'zedtest', password)).error, /disabled/);
  assert.match((await s.checkCode(zed, await s.totp(zed.secret))).error, /disabled/);
  assert.equal((await s.checkPassword(users, 'zedtest', 'wrong')).error, 'Wrong username or password.'); // no leaver hint without the password
  s.leaver(users, eli, 'fay');
  assert.ok(!s.canAdmin(fay), 'a leaver loses admin');
  await assert.rejects(() => s.joiner(users, fay, 'Late Joiner', 'IT'), /Only IT/);

  console.log('all tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
