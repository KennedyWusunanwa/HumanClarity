const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const c of [
    { name: 'landing-desktop', viewport: { width: 1280, height: 800 } },
    { name: 'landing-phone', viewport: { width: 375, height: 740 } },
  ]) {
    const ctx = await browser.newContext({
      viewport: c.viewport,
      deviceScaleFactor: 2,
      isMobile: c.viewport.width < 768,
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots/${c.name}-top.png`, fullPage: false });
    await page.screenshot({ path: `screenshots/${c.name}-full.png`, fullPage: true });
    await ctx.close();
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
