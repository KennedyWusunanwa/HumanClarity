const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const c of [
    { name: 'loader-desktop', viewport: { width: 1280, height: 800 } },
    { name: 'loader-phone', viewport: { width: 375, height: 740 } },
  ]) {
    const ctx = await browser.newContext({
      viewport: c.viewport,
      deviceScaleFactor: 2,
      isMobile: c.viewport.width < 768,
    });
    const page = await ctx.newPage();

    // Slow the /api/process response so we can capture the loading state
    await page.route('**/api/process', async route => {
      await new Promise(r => setTimeout(r, 10000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: 'A nice human-sounding rewrite would appear here once the real call returns.',
          wordCount: 14,
          score: 88,
          provider: 'Test',
        }),
      });
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const cta = page.getByRole('button', { name: /Get Started Free|Start/i }).first();
    if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cta.click();
      await page.waitForTimeout(700);
    }

    await page.locator('textarea').first().fill('In todays rapidly evolving technological landscape we should adopt cutting edge solutions.');
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /Humanize Now|Humanizing/i }).click();
    await page.waitForTimeout(2500);

    await page.screenshot({ path: `screenshots/${c.name}.png`, fullPage: false });

    // Also get a close-up on the output box for mobile
    if (c.name === 'loader-phone') {
      const out = page.locator('text=Output').first();
      const box = await out.boundingBox();
      if (box) {
        await page.screenshot({
          path: `screenshots/${c.name}-output-zoom.png`,
          clip: { x: 0, y: box.y - 4, width: c.viewport.width, height: 280 },
        });
      }
    }

    await ctx.close();
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
