// A Content Security Policy limits what a page may load or run, which limits the damage if text is ever injected.
// GitHub Pages cannot send HTTP headers, so each page carries the policy in a meta tag.
const { test, expect } = require('./base');
const { pages } = require('./helpers');

const META = 'meta[http-equiv="Content-Security-Policy"]';

for (const name of pages) {
  test(`${name} has a strict content security policy meta tag`, async ({ page }) => {
    await page.goto(name);
    expect(await page.locator(META).count(), 'a CSP meta tag is present').toBe(1);
    const csp = await page.locator(META).getAttribute('content');

    const policy = Object.fromEntries(csp.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [directive, ...values] = s.split(/\s+/);
      return [directive, values];
    }));
    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['script-src'], 'scripts only from this site: no inline, no eval, no outside scripts').toEqual(["'self'"]);
    expect(policy['style-src'], 'styles only from this site: no inline styles').toEqual(["'self'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'self'"]);
    expect(policy['form-action']).toEqual(["'self'"]);
    expect(csp).not.toContain('unsafe-eval');

    // The policy only protects what comes after it, so it must come before the first script.
    const firstInOrder = await page.evaluate((selector) => {
      const meta = document.querySelector(selector);
      const script = document.querySelector('script');
      return !script || Boolean(meta.compareDocumentPosition(script) & Node.DOCUMENT_POSITION_FOLLOWING);
    }, META);
    expect(firstInOrder, 'the CSP meta tag comes before any script').toBe(true);

    await page.waitForLoadState('networkidle'); // the shared fixture fails the test on any CSP violation while loading
  });
}

// The policy forbids inline styles, so none may creep back in. Checked in the source, not only in the browser,
// because a style that only appears after some click would not show up on page load.
test('no page or script uses inline styles', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const files = fs.readdirSync(root).filter((n) => /\.(html|js)$/.test(n) && n !== 'playwright.config.js' && !n.endsWith('.test.js'));
  const found = [];
  for (const file of files) {
    fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
      // style.setProperty(...) is allowed: the policy blocks style markup (a style tag or attribute), not setting a CSS
      // variable from script, and theme.js uses exactly that for its scroll and pointer effects.
      if (/<style[\s>]|\sstyle=|\.style\.(?!setProperty\()|\.cssText|setAttribute\(\s*['"]style/.test(line)) found.push(`${file}:${i + 1}`);
    });
  }
  expect(found, 'inline styles found').toEqual([]);
});

test('features still work under the policy: form send, rules loading and both downloads', async ({ page }) => {
  await page.goto('index.html');
  await page.getByLabel('Your name').fill('Csp Check');
  await page.getByLabel('Email address').fill('csp@example.com');
  await page.getByLabel('Message').fill('Checking that the policy allows loading rules.json');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#form-status')).toContainText('Thank you');

  await page.goto('settings.html');
  await expect(page.locator('#h-version')).toHaveText(/\d+\.\d+\.\d+/); // health.json was fetched
  const [exportDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export all data' }).click()]);
  expect(exportDownload.suggestedFilename()).toMatch(/^northlight-export-\d{4}-\d{2}-\d{2}\.json$/);

  await page.goto('automation.html');
  await expect(page.locator('#rules li').first()).toBeVisible(); // rules.json was fetched
  const [snapshotDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export snapshot' }).click()]);
  expect(snapshotDownload.suggestedFilename()).toBe('snapshot.json');
});
