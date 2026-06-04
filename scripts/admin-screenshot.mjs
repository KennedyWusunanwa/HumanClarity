// Renders the /admin dashboard with mocked admin API responses so we can verify
// the responsive UI (table↔cards, tabs, forms) without a live Supabase backend.
import { chromium } from 'playwright';

const BASE = process.env.ADMIN_BASE || 'http://localhost:3137';

const SESSION = {
  admin: { id: 'me', username: 'owner', role: 'admin', roleLabel: 'Admin', permissions: ['view', 'edit_pricing', 'manage_users', 'manage_admins'] },
};
const USERS = {
  users: [
    { id: '1', email: 'ada.lovelace@gmail.com', name: 'Ada Lovelace', tier: 'pro', isPremium: true, plan: 'Premium', wordsUsed: 0, paymentStatus: 'active', isBanned: false, emailConfirmed: true, createdAt: '2025-12-01', lastSignInAt: '2026-06-01' },
    { id: '2', email: 'grace.hopper@outlook.com', name: 'Grace Hopper', tier: 'free', isPremium: false, plan: 'Free', wordsUsed: 320, paymentStatus: 'inactive', isBanned: false, emailConfirmed: true, createdAt: '2026-01-15', lastSignInAt: '2026-05-29' },
    { id: '3', email: 'spammer@temp-mail.org', name: '', tier: 'free', isPremium: false, plan: 'Free', wordsUsed: 500, paymentStatus: 'inactive', isBanned: true, emailConfirmed: true, createdAt: '2026-03-02', lastSignInAt: '2026-03-02' },
    { id: '4', email: 'newuser@yahoo.com', name: 'New User', tier: 'free', isPremium: false, plan: 'Free', wordsUsed: 40, paymentStatus: 'inactive', isBanned: false, emailConfirmed: false, createdAt: '2026-05-30', lastSignInAt: '' },
  ],
  page: 1, perPage: 25, total: 4, totalPages: 1,
  stats: { total: 128, premium: 37, banned: 3 },
  viewerRole: 'admin',
};
const PRICING = { pricing: { proPriceGhs: 50, proPriceUsdEstimate: 4.44, currency: 'GHS', freeWordLimit: 500, billingPeriod: 'month' } };
const ADMINS = {
  admins: [
    { id: 'me', username: 'owner', role: 'admin', disabled: false, created_at: '2025-11-01', created_by: 'bootstrap', last_login_at: '2026-06-03T09:00:00Z' },
    { id: 'a2', username: 'price-editor', role: 'editor', disabled: false, created_at: '2026-02-10', created_by: 'owner', last_login_at: '2026-05-20T14:00:00Z' },
    { id: 'a3', username: 'viewer', role: 'guest', disabled: true, created_at: '2026-04-01', created_by: 'owner', last_login_at: null },
  ],
};
const APPEALS = {
  appeals: [
    { id: 'p1', email: 'ss@gsg.com', message: 'I think this was a mistake — I only signed up to try the tool. Please reinstate my account.', status: 'open', created_at: '2026-06-04T01:20:00Z', resolved_at: null, resolved_by: null },
    { id: 'p2', email: 'grace.hopper@outlook.com', message: 'Sorry for the spam, it won’t happen again.', status: 'resolved', created_at: '2026-05-30T10:00:00Z', resolved_at: '2026-05-31T09:00:00Z', resolved_by: 'owner' },
  ],
  counts: { open: 1, total: 2 },
};

async function mock(page) {
  await page.route('**/api/admin/**', (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes('/api/admin/session')) body = SESSION;
    else if (url.includes('/api/admin/users')) body = USERS;
    else if (url.includes('/api/admin/pricing')) body = PRICING;
    else if (url.includes('/api/admin/appeals')) body = APPEALS;
    else if (url.includes('/api/admin/admins')) body = ADMINS;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

const viewports = [
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 850 },
];
const tabs = [
  { key: 'Users', label: 'Users' },
  { key: 'Pricing', label: 'Pricing' },
  { key: 'Admins', label: 'Admins' },
  { key: 'Appeals', label: 'Appeals' },
];

(async () => {
  const browser = await chromium.launch();
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: vp.width < 768, hasTouch: vp.width < 768 });
    const page = await ctx.newPage();
    await mock(page);
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    for (const t of tabs) {
      const btn = page.getByRole('button', { name: new RegExp('^' + t.label) }).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: `screenshots/admin-${vp.name}-${t.key.toLowerCase()}.png`, fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
  console.log('admin screenshots done');
})().catch((e) => { console.error(e); process.exit(1); });
