// Stretch: an automatic accessibility check (axe-core) on every page. Serious and critical problems fail the test.
// Moderate and minor ones are listed in the report as annotations. Automatic checks find only part of the problems.
const axeModule = require('@axe-core/playwright');
const AxeBuilder = axeModule.default || axeModule.AxeBuilder || axeModule;
const { test, expect } = require('./base');
const { pages } = require('./helpers');

for (const name of pages) {
  test(`${name} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(name);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    const describe = (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`;
    for (const v of violations.filter((x) => !['serious', 'critical'].includes(x.impact))) {
      test.info().annotations.push({ type: 'axe ' + v.impact, description: describe(v) });
    }
    expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map(describe)).toEqual([]);
  });
}
