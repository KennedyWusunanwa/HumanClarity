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
      deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    const shot = (label) => page.screenshot({ path: `screenshots/mob-${w.name}-${label}.png`, fullPage: false });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);

    // Click any "Sign in" control (header on landing)
    const signin = page.getByText(/sign in/i).first();
    if (await signin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signin.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await shot('4-signin-modal');

    // Switch to signup via the "Create Account" toggle inside the modal
    const toSignup = page.getByRole('button', { name: /create account/i }).first();
    if (await toSignup.isVisible({ timeout: 1500 }).catch(() => false)) {
      await toSignup.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await shot('5-signup-modal');

    await ctx.close();
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
