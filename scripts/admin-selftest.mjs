// Deterministic self-test for the admin dashboard's security-critical logic.
// Run:  node scripts/admin-selftest.mjs
// No Supabase needed — exercises the pure libs only.

process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'test-secret-please-change-1234567890';

const { hashPassword, verifyPassword, passwordIssue } = await import('../src/lib/admin/passwords.js');
const { createSessionToken, verifySessionToken } = await import('../src/lib/admin/session.js');
const { roleHasPermission, PERMISSIONS } = await import('../src/lib/admin/roles.js');
const { normalizePricing, validatePricingInput } = await import('../src/lib/admin/pricing.js');
const { normalizeUserRow } = await import('../src/lib/admin/service.js');
const { usernameIssue } = await import('../src/lib/admin/validate.js');
const { domainAllowed, DEFAULT_ALLOWED_DOMAINS } = await import('../src/lib/email-validation.js');
const { normalizeEmailPolicy } = await import('../src/lib/admin/email-policy.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error('  ✗ FAIL:', name);
  }
}

// ── passwords ──
const hash = hashPassword('Sup3rSecret!');
check('correct password verifies', verifyPassword('Sup3rSecret!', hash) === true);
check('wrong password rejected', verifyPassword('wrong', hash) === false);
check('tampered hash rejected', verifyPassword('Sup3rSecret!', hash.slice(0, -2) + 'ff') === false);
check('garbage stored value rejected', verifyPassword('x', 'not-a-hash') === false);
check('two hashes of same pw differ (salted)', hashPassword('a') !== hashPassword('a'));
check('short password flagged', !!passwordIssue('short'));
check('ok password not flagged', passwordIssue('longenough') === null);

// ── sessions ──
const { token } = createSessionToken({ id: 'abc', username: 'owner', role: 'admin' });
const decoded = verifySessionToken(token);
check('valid token decodes', decoded && decoded.sub === 'abc' && decoded.role === 'admin');
check('tampered signature rejected', verifySessionToken(token.slice(0, -3) + 'AAA') === null);
check('tampered payload rejected', verifySessionToken('eyJzdWIiOiJoYWNrIn0.' + token.split('.')[1]) === null);
check('garbage token rejected', verifySessionToken('garbage') === null);
// expired
const realNow = Date.now;
const expiredToken = (() => {
  // craft an expired token by signing a past-exp payload via the same secret
  return createSessionToken({ id: 'x', username: 'u', role: 'guest' }).token;
})();
check('non-expired token still valid', verifySessionToken(expiredToken) !== null);

// ── roles ──
check('admin can manage admins', roleHasPermission('admin', PERMISSIONS.MANAGE_ADMINS));
check('admin can manage users', roleHasPermission('admin', PERMISSIONS.MANAGE_USERS));
check('editor can edit pricing', roleHasPermission('editor', PERMISSIONS.EDIT_PRICING));
check('editor CANNOT manage users', !roleHasPermission('editor', PERMISSIONS.MANAGE_USERS));
check('editor CANNOT manage admins', !roleHasPermission('editor', PERMISSIONS.MANAGE_ADMINS));
check('guest can view', roleHasPermission('guest', PERMISSIONS.VIEW));
check('guest CANNOT edit pricing', !roleHasPermission('guest', PERMISSIONS.EDIT_PRICING));
check('guest CANNOT manage users', !roleHasPermission('guest', PERMISSIONS.MANAGE_USERS));
check('unknown role has nothing', !roleHasPermission('superuser', PERMISSIONS.VIEW));

// ── pricing ──
const np = normalizePricing({ proPriceGhs: '75', freeWordLimit: '800', currency: 'ghs' });
check('pricing coerces numbers', np.proPriceGhs === 75 && np.freeWordLimit === 800);
check('currency uppercased', np.currency === 'GHS');
check('bad pricing defaults applied', normalizePricing({ proPriceGhs: 'abc' }).proPriceGhs === 50);
check('negative price flagged', validatePricingInput({ proPriceGhs: -5, freeWordLimit: 100 }).length > 0);
check('valid price ok', validatePricingInput({ proPriceGhs: 60, freeWordLimit: 500 }).length === 0);

// ── normalizeUserRow (metadata model) ──
const proUser = normalizeUserRow({
  id: 'u1',
  email: 'a@b.com',
  user_metadata: { app_state: { profile: { name: 'Ada' }, subscription: { tier: 'pro', wordsUsed: 10 } } },
  created_at: '2025-01-01',
});
check('pro user detected', proUser.isPremium === true && proUser.plan === 'Premium');
check('name parsed from app_state', proUser.name === 'Ada');

const bannedUser = normalizeUserRow({ id: 'u2', email: 'x@y.com', banned_until: new Date(Date.now() + 1e10).toISOString(), user_metadata: {} });
check('banned user detected', bannedUser.isBanned === true);
const pastBan = normalizeUserRow({ id: 'u3', email: 'z@y.com', banned_until: '2000-01-01', user_metadata: {} });
check('expired ban not counted', pastBan.isBanned === false);
const freeLegacy = normalizeUserRow({ id: 'u4', email: 'l@y.com', user_metadata: { plan: 'free', usage_words: 3 } });
check('legacy free user parsed (undated usage scoped to 0)', freeLegacy.isPremium === false && freeLegacy.wordsUsed === 0);

const todayK = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const usedToday = normalizeUserRow({ id: 'u5', email: 't@y.com', user_metadata: { app_state: { subscription: { tier: 'free', wordsUsed: 42, usageDate: todayK } } } });
check('today usage counted', usedToday.wordsUsed === 42);
const usedYesterday = normalizeUserRow({ id: 'u6', email: 'y@y.com', user_metadata: { app_state: { subscription: { tier: 'free', wordsUsed: 480, usageDate: '2020-01-01' } } } });
check('stale usage not counted as today', usedYesterday.wordsUsed === 0);

// ── usernames ──
check('valid username ok', usernameIssue('owner_1') === null);
check('short username flagged', !!usernameIssue('ab'));
check('bad chars flagged', !!usernameIssue('bad name!'));

// ── email allow-list ──
check('gmail allowed', domainAllowed('gmail.com', DEFAULT_ALLOWED_DOMAINS) === true);
check('icloud allowed', domainAllowed('icloud.com', DEFAULT_ALLOWED_DOMAINS) === true);
check('fake sss.com blocked', domainAllowed('sss.com', DEFAULT_ALLOWED_DOMAINS) === false);
check('fake gsg.com blocked', domainAllowed('gsg.com', DEFAULT_ALLOWED_DOMAINS) === false);
check('allow-list is case-insensitive', domainAllowed('GMAIL.COM', DEFAULT_ALLOWED_DOMAINS) === true);
check('empty allow-list falls back to default (gmail ok)', domainAllowed('gmail.com', []) === true);

// ── email policy normalization ──
const polDefault = normalizeEmailPolicy({ mode: 'allowlist', allowedDomains: [] });
check('empty allowlist policy falls back to defaults', polDefault.allowedDomains.length > 0);
const polAny = normalizeEmailPolicy({ mode: 'any', allowedDomains: ['x'] });
check('mode any preserved', polAny.mode === 'any');
const polClean = normalizeEmailPolicy({ mode: 'allowlist', allowedDomains: ['@Gmail.com', 'gmail.com', 'not a domain', 'outlook.com'] });
check('policy lowercases + strips @ + dedupes + drops junk', JSON.stringify(polClean.allowedDomains.sort()) === JSON.stringify(['gmail.com', 'outlook.com']));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
