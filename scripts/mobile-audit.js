const { chromium } = require('playwright');

const widths = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'small-360', width: 360, height: 780 },
];

(async () => {
  const browser = await chromium.launch();

  for (const w of widths) {
    const ctx = await browser.newContext({
      viewport: { width: w.width, height: w.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const shot = (label) => page.screenshot({ path: `screenshots/mob-${w.name}-${label}.png`, fullPage: true });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    await shot('1-landing');

    // Open the tool from the landing CTA
    const cta = page.getByRole('button', { name: /Get Started|Start|Humanize|Try/i }).first();
    if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cta.click().catch(() => {});
      await page.waitForTimeout(900);
    }
    await shot('2-tool');

    // Type some text to see the workbench with output panel + quota state
    const ta = page.locator('textarea').first();
    if (await ta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await ta.fill('The implementation of the aforementioned methodology demonstrates significant efficacy.');
      await page.waitForTimeout(400);
      await shot('3-tool-typed');
    }

    // Open sign-in modal (signin mode)
    const signInBtn = page.getByRole('button', { name: /^Sign In$/i }).first();
    if (await signInBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await signInBtn.click().catch(() => {});
      await page.waitForTimeout(700);
      await shot('4-signin');
      // Switch to signup (more fields)
      const toSignup = page.getByRole('button', { name: /Create Account/i }).first();
      if (await toSignup.isVisible({ timeout: 1000 }).catch(() => false)) {
        await toSignup.click().catch(() => {});
        await page.waitForTimeout(600);
        await shot('5-signup');
      }
      // close modal
      const close = page.locator('.auth-modal-close').first();
      if (await close.isVisible({ timeout: 1000 }).catch(() => false)) {
        await close.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    // Navigate to pricing via localStorage view state, then reload
    await page.evaluate(() => window.localStorage.setItem('hc-active-view', 'pricing'));
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    // dismiss any modal
    const close2 = page.locator('.auth-modal-close').first();
    if (await close2.isVisible({ timeout: 800 }).catch(() => false)) {
      await close2.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await shot('6-pricing');

    await ctx.close();
  }

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
