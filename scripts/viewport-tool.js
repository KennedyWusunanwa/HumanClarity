const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const h of [844, 740]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    const cta = page.getByRole('button', { name: /Get Started|Start|Humanize|Try/i }).first();
    if (await cta.isVisible({ timeout: 1500 }).catch(()=>false)) { await cta.click().catch(()=>{}); await page.waitForTimeout(900); }
    await page.screenshot({ path: `screenshots/vp-tool-390x${h}.png`, fullPage: false });
    // measure the gap: footer top vs workbench bottom
    const m = await page.evaluate(() => {
      const foot = document.querySelector('footer');
      const main = document.querySelector('main');
      const secs = main ? main.querySelectorAll(':scope > section') : [];
      const last = secs.length ? secs[secs.length-1].getBoundingClientRect() : null;
      return {
        innerH: window.innerHeight,
        footTop: foot ? Math.round(foot.getBoundingClientRect().top) : null,
        footBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null,
        mainBottom: main ? Math.round(main.getBoundingClientRect().bottom) : null,
        lastSectionBottom: last ? Math.round(last.bottom) : null,
      };
    });
    console.log(`h=${h}`, JSON.stringify(m));
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
