const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Pre-seed a Pro subscription in localStorage. The persisted user state shape comes from
  // buildPersistedState; we mirror just enough for the app to read tier === 'pro' on mount.
  const FREE_KEY = 'hc-guest-state'; // The guest/local persisted state key. We'll try both.
  const candidateKeys = ['hc-guest-state', 'hc-user-state', 'hc-persisted-state'];

  for (const tier of ['free', 'pro']) {
    for (const c of [
      { name: `rail-${tier}-desktop`, viewport: { width: 1280, height: 800 } },
      { name: `rail-${tier}-phone`, viewport: { width: 375, height: 740 } },
    ]) {
      const ctx = await browser.newContext({
        viewport: c.viewport,
        deviceScaleFactor: 2,
        isMobile: c.viewport.width < 768,
      });
      const page = await ctx.newPage();
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

      // Seed subscription in localStorage
      await page.evaluate(({ tier, keys }) => {
        const state = {
          profile: { name: '', email: '' },
          history: [],
          saved: [],
          subscription: tier === 'pro'
            ? { tier: 'pro', wordsUsed: 0 }
            : { tier: 'free', wordsUsed: 0 },
        };
        for (const k of keys) window.localStorage.setItem(k, JSON.stringify(state));
      }, { tier, keys: candidateKeys });

      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // Click "Get Started Free"/"Start" to get to tool
      const cta = page.getByRole('button', { name: /Get Started Free|Start/i }).first();
      if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) {
        await cta.click();
        await page.waitForTimeout(700);
      }

      // Expand the rail so we can see the Upgrade box (or absence)
      const railToggle = page.getByRole('button', { name: /Expand navigation/i }).first();
      if (await railToggle.isVisible({ timeout: 1500 }).catch(() => false)) {
        await railToggle.click({ timeout: 1500 });
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: `screenshots/${c.name}.png`, fullPage: false });
      await ctx.close();
    }
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
