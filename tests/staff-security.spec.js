// Sign-in hardening. Like the other staff tests this checks the page's behaviour in the browser only.
// A real system must enforce lockouts and one-time codes on a server (see RISKS.md).
const { test, expect } = require('./base');
const { signIn, startSignIn } = require('./helpers');

// One password attempt. The page clears the password field when it has finished checking, so wait for that:
// the previous message stays on screen and would otherwise make the next attempt start too early.
async function tryPassword(page, username, password) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#password')).toHaveValue('');
}

test('five wrong passwords lock the account, even for the right password', async ({ page }) => {
  await page.goto('staff.html');
  await expect(page.locator('#demo-users tr')).toHaveCount(6);
  for (let i = 0; i < 5; i++) {
    await tryPassword(page, 'eli', 'wrong-' + i);
    await expect(page.locator('#msg')).toHaveText('Wrong username or password.');
  }
  await tryPassword(page, 'eli', 'Eli-demo-5'); // the correct password
  await expect(page.locator('#msg')).toContainText('Too many failed attempts');
  await expect(page.locator('#step2')).toBeHidden();

  await tryPassword(page, 'dan', 'wrong'); // a different username is not locked
  await expect(page.locator('#msg')).toHaveText('Wrong username or password.');
});

test('a one-time code cannot be used twice', async ({ page }) => {
  const code = await signIn(page, 'eli', 'Eli-demo-5');
  await page.getByRole('button', { name: 'Sign out' }).click();

  await startSignIn(page, 'eli', 'Eli-demo-5');
  await page.locator('#code').fill(code); // the very same code, still inside its 30 second window
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#msg')).toContainText('already been used');
  await expect(page.locator('#signed')).toBeHidden();
});
