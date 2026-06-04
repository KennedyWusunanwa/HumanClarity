const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // Seed an output payload BEFORE navigation so the tool reads it on first mount
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.setItem('hc-humanizer-output', JSON.stringify({
      text: 'The morning sun spilled over the rooftops, turning the city soft and gold. People wandered out of their homes with coffee in hand, blinking at a day that had not yet decided what to be. Somewhere a dog barked. Somewhere a phone rang. Otherwise the streets were quiet, the way streets are when a city is still half-asleep.',
      action: 'humanize',
      wordCount: 56,
    }));
    window.localStorage.setItem('hc-humanizer-input', 'AI-generated paragraph about a city morning.');
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Click the landing "Get Started Free" once to land on the tool view
  const cta = page.getByRole('button', { name: /Get Started Free|Start/i }).first();
  if (await cta.isVisible({ timeout: 1500 })) {
    await cta.click();
    await page.waitForTimeout(900);
  }

  await page.screenshot({ path: 'screenshots/phone-375-tool-with-output.png', fullPage: false });
  console.log('done');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
