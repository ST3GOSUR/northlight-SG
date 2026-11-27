// Empty forms must say what is wrong, in words, and must not create anything.
const { test, expect } = require('./base');

test('the contact form shows a clear message for each empty field and saves nothing', async ({ page }) => {
  await page.goto('index.html');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#name-error')).toHaveText('Enter your name.');
  await expect(page.locator('#email-error')).toHaveText('Enter your email address.');
  await expect(page.locator('#message-error')).toContainText('Write at least 10 characters');
  await expect(page.getByLabel('Your name')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('northlight-helpdesk-tickets'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('northlight-crm'))).toBeNull();

  await page.getByLabel('Your name').fill('Ann');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Message').fill('Hello, a long enough message.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#email-error')).toContainText('name@example.com');
  await expect(page.locator('#name-error')).toBeHidden();
});

test('the CRM forms say what is missing', async ({ page }) => {
  await page.goto('crm.html');
  await page.getByRole('button', { name: 'Add lead' }).click();
  await expect(page.locator('#msg')).toHaveText("Enter the lead's name.");
  await page.getByRole('button', { name: 'Add case' }).click();
  await expect(page.locator('#msg')).toHaveText('Enter a subject for the case.');
  await expect(page.locator('#leads tr')).toHaveCount(3); // still only the three sample leads
});

test('the help desk and sign-in forms refuse to submit when empty', async ({ page }) => {
  await page.goto('helpdesk.html');
  const before = await page.locator('#tickets > li').count();
  await page.getByRole('button', { name: 'Create ticket' }).click();
  expect(await page.locator('input[name=requester]').evaluate((el) => el.validationMessage), 'browser message').not.toBe('');
  await expect(page.locator('#tickets > li')).toHaveCount(before);

  await page.goto('staff.html');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect(await page.locator('#username').evaluate((el) => el.validationMessage)).not.toBe('');
  await expect(page.locator('#step2')).toBeHidden();
});
