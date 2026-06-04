const { chromium } = require('playwright');

const widths = [320, 360, 390, 414];

(async () => {
  const browser = await chromium.launch();
  for (const width of widths) {
    const ctx = await browser.newContext({
      viewport: { width, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);

    async function report(label) {
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const overflowers = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 1 && rect.width > 0 && rect.left >= 0) {
            overflowers.push({
              tag: el.tagName,
              cls: (el.className && el.className.toString().slice(0, 40)) || '',
              right: Math.round(rect.right),
              text: (el.textContent || '').trim().slice(0, 30),
            });
          }
        });
        return {
          scrollW: de.scrollWidth, innerW: window.innerWidth,
          overflowers: overflowers.slice(0, 6),
        };
      });
      const horiz = r.scrollW > r.innerW + 1;
      console.log(`[w=${width}] ${label}: scrollWidth=${r.scrollW} viewport=${r.innerW} ${horiz ? 'HORIZONTAL-OVERFLOW' : 'ok'}`);
      if (horiz && r.overflowers.length) {
        r.overflowers.forEach(o => console.log(`    ↳ <${o.tag} class="${o.cls}"> right=${o.right} "${o.text}"`));
      }
    }

    await report('landing');
    // go to tool
    const cta = page.getByRole('button', { name: /Get Started|Start|Humanize|Try/i }).first();
    if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) { await cta.click().catch(()=>{}); await page.waitForTimeout(800); }
    await report('tool');
    // pricing
    await page.evaluate(() => window.localStorage.setItem('hc-active-view', 'pricing'));
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const close = page.locator('.auth-modal-close').first();
    if (await close.isVisible({ timeout: 600 }).catch(() => false)) { await close.click({ force: true }).catch(()=>{}); await page.waitForTimeout(300); }
    await report('pricing');

    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
