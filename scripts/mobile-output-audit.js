const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const cta = page.getByRole('button', { name: /Get Started|Start|Humanize|Try/i }).first();
  if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cta.click().catch(() => {});
    await page.waitForTimeout(900);
  }

  const ta = page.locator('textarea').first();
  await ta.fill('The implementation of the aforementioned methodology demonstrates significant efficacy across a wide range of operational contexts and use cases.');
  await page.waitForTimeout(300);

  const humanize = page.getByRole('button', { name: /Humanize Now/i }).first();
  await humanize.click({ force: true }).catch(() => {});

  // loading state
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/mob-iphone-390-7-loading.png', fullPage: true });

  // wait for output (poll for the AI-Humanized status or up to 40s)
  await page.waitForFunction(() => /AI-Humanized/i.test(document.body.innerText), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/mob-iphone-390-8-output.png', fullPage: true });

  await ctx.close();
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
