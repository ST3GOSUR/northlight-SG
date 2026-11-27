// Only IT may open the admin section. NOTE: this proves the page behaves correctly, not that it is secure.
// All of this runs in the visitor's browser, so a real system must also enforce it on a server (see RISKS.md).
const { test, expect } = require('./base');
const { signIn } = require('./helpers');

test('a Sales user cannot see the admin section', async ({ page }) => {
  await signIn(page, 'dan', 'Dan-demo-4'); // Dan Moore, Sales
  await expect(page.locator('#who')).toContainText('Sales');
  await expect(page.locator('#admin')).toBeHidden();
  await expect(page.locator('#no-admin')).toBeVisible();
  await expect(page.locator('#no-admin')).toContainText('IT group only');
  // Not just hidden: the admin content is never built for a non-IT user.
  await expect(page.locator('#admin-users tr')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Leaver' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Joiner' })).toBeHidden();
});

test('control: an IT user does see the admin section', async ({ page }) => {
  await signIn(page, 'eli', 'Eli-demo-5'); // Eli Ford, IT
  await expect(page.locator('#admin')).toBeVisible();
  await expect(page.locator('#admin-users tr')).toHaveCount(6);
  await expect(page.locator('#no-admin')).toBeHidden();
});

test('a leaver cannot sign in', async ({ page }) => {
  await signIn(page, 'eli', 'Eli-demo-5');
  await page.locator('#admin-users tr', { hasText: 'Cleo Hart' }).getByRole('button', { name: 'Leaver' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.locator('#username').fill('cleo');
  await page.locator('#password').fill('Cleo-demo-3');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#msg')).toContainText('disabled');
  await expect(page.locator('#step2')).toBeHidden();
});
