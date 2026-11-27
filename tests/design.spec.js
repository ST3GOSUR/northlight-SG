// The Field Journal design (ui-prompt.md): look, navigation, motion, and the "rules" from section 8.
const { test, expect } = require('./base');
const { pages } = require('./helpers');

const withJump = ['helpdesk.html', 'crm.html', 'automation.html', 'settings.html', 'staff.html'];
const HOME_SECTIONS = ['services', 'tools', 'faq', 'contact'];

test.describe('look', () => {
  test('Georgia for reading, system sans for buttons, expedition red on snow paper', async ({ page }) => {
    await page.goto('index.html');
    const heading = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(heading).toContain('Georgia');
    const body = await page.locator('body').evaluate((el) => ({ size: getComputedStyle(el).fontSize, family: getComputedStyle(el).fontFamily, bg: getComputedStyle(el).backgroundColor }));
    expect(body.size).toBe('18px');
    expect(body.family).toContain('Georgia');
    expect(body.bg).toBe('rgb(244, 241, 232)'); // #F4F1E8
    const button = await page.getByRole('button', { name: 'Send message' }).evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, family: s.fontFamily, shadow: s.boxShadow, transform: s.textTransform };
    });
    expect(button.bg).toBe('rgb(168, 50, 42)'); // #A8322A
    expect(button.family).not.toContain('Georgia');
    expect(button.shadow).not.toBe('none');
    expect(button.transform).toBe('uppercase');
  });

  test('every page has the masthead, the same bar with the current page marked, and the footer contents', async ({ page }) => {
    for (const name of pages) {
      await page.goto(name);
      await expect(page.locator('.mast-title')).toContainText('Northlight Field Journal');
      await expect(page.locator('.bar-main a[aria-current="page"]')).toHaveAttribute('href', name);
      await expect(page.locator('.bar-main a:not(.bar-brand)'), `${name}: pages in the bar`).toHaveCount(pages.length);
      await expect(page.locator('.site-footer nav a'), `${name}: pages in the footer`).toHaveCount(pages.length);
      await expect(page.locator('.site-footer nav a[aria-current="page"]')).toHaveAttribute('href', name);
    }
  });

  test('the home page is a two-column spread, then plates, contents, Q and A and a telegram', async ({ page }) => {
    await page.goto('index.html');
    const columns = await page.locator('.spread').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
    await expect(page.locator('.pin')).toBeVisible();
    await expect(page.locator('.stamp')).toHaveAttribute('alt', /Expedition ready/);
    expect(await page.locator('.sec').evaluateAll((els) => els.map((e) => e.id))).toEqual(HOME_SECTIONS);
    await expect(page.locator('.plate')).toHaveCount(3);
    await expect(page.locator('.toc li')).toHaveCount(6);
    await expect(page.locator('.qa details')).toHaveCount(4);
    await expect(page.locator('#contact-form .tele-title')).toHaveText('Telegram');
  });
});

test.describe('easy to look around', () => {
  test('the bar stays on screen while you scroll, and shows the brand once the masthead has gone', async ({ page }) => {
    await page.goto('crm.html');
    await expect(page.locator('.bar')).not.toHaveClass(/is-stuck/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => (await page.locator('.bar').boundingBox()).y).toBeLessThanOrEqual(1);
    await expect(page.locator('.bar')).toHaveClass(/is-stuck/);
    await expect(page.locator('.bar-brand')).toBeVisible();
  });

  test('the home page highlights the section being read', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // jumps land at once instead of gliding
    await page.goto('index.html');
    for (const id of HOME_SECTIONS) {
      await page.locator(`.bar-page a[href="#${id}"]`).click();
      await expect(page.locator(`.bar-page a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location');
      await expect(page.locator('.bar-page a[aria-current="location"]')).toHaveCount(1);
    }
  });

  for (const name of withJump) {
    test(`${name}: each "Jump to" link lands on its section, below the sticky bar`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(name);
      const hrefs = await page.locator('.jump a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        const id = href.slice(1);
        expect(await page.locator(`[id="${id}"]`).count(), `target ${id} exists once`).toBe(1);
        await page.locator(`.jump a[href="${href}"]`).click();
        await expect.poll(() => page.evaluate((target) => {
          const top = document.getElementById(target).getBoundingClientRect().top;
          return top >= document.querySelector('.bar').getBoundingClientRect().bottom - 2 && top < window.innerHeight;
        }, id), `${id} is in view, not hidden under the bar`).toBe(true);
      }
    });
  }

  test('keyboard users can skip straight to the main content', async ({ page }) => {
    await page.goto('index.html');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip');
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox()).y).toBeGreaterThanOrEqual(0); // visible when focused
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('the Top button appears after scrolling and takes you back up', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('crm.html');
    await expect(page.locator('.totop')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(page.locator('.totop')).toBeVisible();
    await page.locator('.totop').click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    await expect(page.locator('.totop')).toBeHidden();
  });

  test('every link in the bar goes to a page that exists', async ({ page, request }) => {
    await page.goto('index.html');
    const hrefs = await page.locator('.bar-main a').evaluateAll((els) => els.map((e) => e.href));
    for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);
  });
});

test.describe('motion', () => {
  test('snow drifts, the route is drawn and the stamp thunks onto the page', async ({ page }) => {
    await page.goto('index.html');
    expect(await page.locator('.snow i').count()).toBeGreaterThanOrEqual(20);
    const names = await page.evaluate(() => ({
      snow: getComputedStyle(document.querySelector('.snow i')).animationName,
      route: getComputedStyle(document.querySelector('.route-draw')).animationName,
      stamp: getComputedStyle(document.querySelector('.stamp')).animationName,
    }));
    expect(names).toEqual({ snow: 'fall', route: 'draw', stamp: 'thunk' });
  });

  test('plates are tilted like pinned paper, then straighten and lift on hover', async ({ page }) => {
    await page.goto('index.html');
    const plate = page.locator('.plate').first();
    await plate.scrollIntoViewIfNeeded();
    const matrix = () => plate.evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return { tilt: Math.abs(m.b), lift: m.m42 }; });
    await expect.poll(async () => (await matrix()).tilt).toBeGreaterThan(0.01); // tilted once it has been dealt
    await plate.hover();
    await expect.poll(async () => (await matrix()).lift).toBeLessThan(-4);
    await expect.poll(async () => (await matrix()).tilt).toBeLessThan(0.005);
  });

  test('the pinned map tilts toward the pointer', async ({ page }) => {
    await page.goto('index.html');
    const box = await page.locator('.spread').boundingBox();
    await page.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.5);
    await expect.poll(() => page.locator('.pin').evaluate((el) => parseFloat(el.style.getPropertyValue('--ry')))).toBeGreaterThan(2);
  });

  test('nothing moves for visitors who ask to reduce motion, and everything is still there', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('index.html');
    const state = await page.evaluate(() => ({
      anim: [...document.querySelectorAll('.snow i, .route-draw, .stamp')].map((el) => getComputedStyle(el).animationName),
      snow: getComputedStyle(document.querySelector('.snow')).display,
      routeDash: getComputedStyle(document.querySelector('.route-draw')).strokeDashoffset,
      motion: document.documentElement.classList.contains('motion-ok'),
      hidden: [...document.querySelectorAll('.sec > *')].filter((el) => getComputedStyle(el).opacity !== '1').length,
    }));
    expect(new Set(state.anim)).toEqual(new Set(['none']));
    expect(state.snow).toBe('none');
    expect(state.routeDash).toBe('0px'); // the route is fully drawn, not hidden
    expect(state.motion).toBe(false);
    expect(state.hidden).toBe(0);
  });

  test('tables and forms never move, even with motion allowed', async ({ page }) => {
    await page.goto('crm.html');
    // Position on the page, not on the screen: hovering may scroll the element into view.
    const place = (target) => target.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + window.scrollY), w: Math.round(b.width), h: Math.round(b.height) }; });
    for (const selector of ['.scroll >> nth=0', '#lead-form']) {
      const target = page.locator(selector);
      const before = await place(target);
      await target.hover();
      await page.waitForTimeout(400);
      expect(await place(target), selector).toEqual(before);
    }
  });
});

test.describe('phones (375px wide)', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const name of pages) {
    test(`${name}: nothing scrolls sideways and every link and control is at least 44px tall`, async ({ page }) => {
      await page.goto(name);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'sideways overflow').toBeLessThanOrEqual(0);
      const small = await page.evaluate(() => [...document.querySelectorAll('button, .btn, .bar a, .jump a, .site-footer nav a, .choices a, .toc a, .totop, summary, input, select, textarea')]
        .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => ({ el: el.tagName + (el.textContent.trim().slice(0, 20) ? ' "' + el.textContent.trim().slice(0, 20) + '"' : ''), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((x) => x.h < 44));
      expect(small, 'targets shorter than 44px').toEqual([]);
    });
  }

  test('the bar is one row that scrolls sideways and opens at the current page', async ({ page }) => {
    await page.goto('troubleshoot.html'); // the last page in the row
    const row = page.locator('.bar-main');
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth), 'the row is wider than the screen').toBe(true);
    const current = await page.locator('.bar-main a[aria-current="page"]').boundingBox();
    expect(current.x).toBeGreaterThanOrEqual(0);
    expect(current.x + current.width).toBeLessThanOrEqual(375);
  });
});
