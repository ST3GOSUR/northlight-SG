// Every test uses this instead of @playwright/test directly. It adds one rule to every test:
// the page must never trigger a Content Security Policy violation or an unexpected alert/confirm/prompt.
const base = require('@playwright/test');

const test = base.test.extend({
  page: async ({ page }, use) => {
    const problems = [];
    await page.exposeFunction('__reportCsp', (message) => problems.push(message));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__reportCsp(`CSP ${e.violatedDirective} blocked ${e.blockedURI || 'inline code'}`);
      });
    });
    page.on('dialog', (d) => { problems.push(`unexpected ${d.type()} dialog: ${d.message()}`); d.dismiss(); });
    await use(page);
    base.expect(problems, 'CSP violations or unexpected dialogs').toEqual([]);
  },
});

module.exports = { test, expect: base.expect };
