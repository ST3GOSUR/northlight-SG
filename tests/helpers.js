const fs = require('fs');
const path = require('path');
const { expect } = require('./base');
const { totp } = require('../staff.js'); // same one-time-code maths the staff page uses

// Every HTML page in the repo, so a new page is tested automatically.
const pages = fs.readdirSync(path.join(__dirname, '..')).filter((n) => n.endsWith('.html')).sort();

// Step 1 on staff.html (already open and seeded): username and password, up to the one-time code prompt.
async function startSignIn(page, username, password) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#step2')).toBeVisible();
}

// Opens staff.html and signs in with password and one-time code (computed from the user's stored key).
// Returns the code that was used.
async function signIn(page, username, password) {
  await page.goto('staff.html');
  await expect(page.locator('#demo-users tr')).toHaveCount(6); // wait until the six demo users are seeded
  await startSignIn(page, username, password);
  const users = await page.evaluate(() => JSON.parse(localStorage.getItem('northlight-staff-users')));
  const code = await totp(users.find((u) => u.username === username).secret);
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#signed')).toBeVisible();
  return code;
}

module.exports = { pages, signIn, startSignIn };
