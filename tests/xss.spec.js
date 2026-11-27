// Text that looks like code, typed into the forms, must be shown as plain text and must never run.
const { test, expect } = require('./base');

const IMG = '<img src=x onerror="window.__xss=1">';
const SCRIPT = '<script>window.__xss=1</script>';

test('script-like text from the website form is shown as plain text everywhere it appears', async ({ page }) => {
  await page.goto('index.html');
  await page.getByLabel('Your name').fill(IMG);
  await page.getByLabel('Email address').fill('xss@example.com');
  await page.getByLabel('Message').fill(`${SCRIPT} please help with our site`);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#form-status')).toContainText('Thank you');
  await expect(page.locator('#form-status img')).toHaveCount(0);

  // The same text now lives in the help desk, the CRM and the automation log. Each must show it literally.
  const places = [
    ['helpdesk.html', '#tickets', SCRIPT],
    ['helpdesk.html', '#tickets', IMG],
    ['crm.html', '#leads', IMG],
    ['automation.html', '#log', IMG],
  ];
  for (const [url, area, text] of places) {
    await page.goto(url);
    await expect(page.locator(area)).toContainText(text);
    await expect(page.locator(`${area} img, ${area} script`)).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss), `${url}: injected code ran`).toBeUndefined();
  }
});

test('script-like text typed into the help desk form and a reply is shown as plain text', async ({ page }) => {
  await page.goto('helpdesk.html');
  await page.locator('input[name=requester]').fill(IMG);
  await page.locator('textarea[name=issue]').fill(`${SCRIPT} <b>not bold</b>`);
  await page.getByRole('button', { name: 'Create ticket' }).click();

  const ticket = page.locator('#tickets > li').filter({ hasText: 'not bold' });
  await expect(ticket).toContainText(SCRIPT);
  await expect(ticket).toContainText(IMG);

  await ticket.locator('input[placeholder=Name]').fill(IMG);
  await ticket.locator('input[placeholder=Reply]').fill(`${SCRIPT} <i>reply</i>`);
  await ticket.getByRole('button', { name: 'Reply' }).click();

  const list = page.locator('#tickets');
  await expect(list).toContainText(`${SCRIPT} <i>reply</i>`);
  await expect(page.locator('#tickets img, #tickets script, #tickets b, #tickets i')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss), 'injected code ran').toBeUndefined();
});
