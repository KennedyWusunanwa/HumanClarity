const { chromium } = require('playwright');

// localStorage seed for a signed-in-looking user (no Supabase session — pages relying on
// signed-in state will still gate behind AuthWall, which is fine; we want to verify shell layout).
const cases = [
  { name: 'phone-375', viewport: { width: 375, height: 740 } },
  { name: 'desktop-1280', viewport: { width: 1280, height: 800 } },
];

const views = ['tool', 'dashboard', 'history', 'saved', 'settings', 'pricing', 'profile'];

(async () => {
  const browser = await chromium.launch();
  for (const c of cases) {
    const ctx = await browser.newContext({
      viewport: c.viewport,
      deviceScaleFactor: 2,
      isMobile: c.viewport.width < 768,
      hasTouch: c.viewport.width < 768,
    });
    const page = await ctx.newPage();

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    // Skip the landing page — click "Get Started Free"/"Start"
    const cta = page.getByRole('button', { name: /Get Started Free|Start/i }).first();
    if (await cta.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cta.click();
      await page.waitForTimeout(700);
    }

    async function dismissModal() {
      try {
        const close = page.locator('.auth-modal-close, .auth-modal-back').first();
        if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
          await close.click({ timeout: 1000, force: true });
          await page.waitForTimeout(400);
        }
      } catch {}
    }

    const labelMap = { tool: 'Humanizer', dashboard: 'Dashboard', history: 'History', saved: 'Saved Docs', settings: 'Settings', pricing: 'Upgrade to Premium', profile: 'Profile' };
    for (const v of views) {
      await dismissModal();
      const labelName = labelMap[v];
      try {
        const btn = page.getByTitle(labelName, { exact: true }).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click({ timeout: 2000, force: true });
          await page.waitForTimeout(700);
        }
      } catch {}
      // dismiss any signin modal triggered by guard so we can see the underlying shell + AuthWall
      await dismissModal();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/${c.name}-${v}.png`, fullPage: false });
    }

    await ctx.close();
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
