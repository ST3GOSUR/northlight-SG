// No browser needed: scans the files in the repository for passwords and keys.
const { test, expect } = require('@playwright/test');
const { scanText, scanFileName, scanRepo } = require('./secrets-scan');

test('the scanner catches known-bad samples (so a pass means something)', () => {
  // Built from pieces at run time so this file does not contain a real-looking secret itself.
  // Pairs of [expected finding, sample text], not an object: "name: 'literal'" would look like a secret to the scanner itself.
  const samples = [
    ['private key block', '-----BEGIN ' + 'RSA PRIVATE KEY-----'],
    ['AWS access key id', 'AK' + 'IAIOSFODNN7EXAMPLE'],
    ['GitHub token', 'gh' + 'p_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
    ['Slack token', 'xo' + 'xb-1234567890-abcdefghij'],
    ['Azure storage key or SAS token', 'Account' + 'Key=' + 'abcdefghijklmnopqrstuvwxyz0123456789+/=='],
    ['password, secret or key assigned a literal value', 'const pass' + 'word = "hunter2hunter2";'],
    ['JSON Web Token', 'ey' + 'Jhbgcioijiuzi1nij9.ey' + 'Jzdwiioixmjm0nta2nzg5.abcdefghijklmnop'],
  ];
  for (const [name, text] of samples) {
    expect(scanText('sample.txt', text).join(' '), name).toContain(name);
  }
  expect(scanFileName('config/.env')).toHaveLength(1);
  expect(scanFileName('deploy/server.pem')).toHaveLength(1);
});

test('the scanner leaves ordinary code and the fake demo accounts alone', () => {
  const harmless = [
    "const password = Array.from(randomBytes(12), (b) => A[b % A.length]).join('');",
    "['ana', 'Ana Novak', 'Design', 'Art Director', 'Ana-demo-1', 'JBSWY3DPEHPK3PXP'],",
    "await checkPassword(users, 'ana', 'Ana-demo-1')",
    '<label>Password <input id="password" type="password"></label>',
    'The one-time code key lives on the phone.',
  ];
  for (const line of harmless) expect(scanText('ok.txt', line), line).toEqual([]);
});

test('the repo contains no password or key', () => {
  expect(scanRepo(), 'passwords or keys found in tracked files').toEqual([]);
});
