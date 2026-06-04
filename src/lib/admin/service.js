import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client. The service key bypasses RLS and unlocks the
// auth admin API (listUsers / updateUserById / ban). It MUST stay server-only —
// it is never imported by any 'use client' file.

let cachedClient = null;

export function getServiceClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add your Supabase service-role key to the environment — see ADMIN_SETUP.md.',
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

// ── End-user (auth.users) helpers ──────────────────────────────────────────

const BAN_FOREVER = '876000h'; // ~100 years
const MAX_USERS_FETCH = 5000; // safety cap when paging through every account

// Local-date key (YYYY-MM-DD), matching todayKey() in src/App.jsx. Note this is
// the server's local day; close enough for an admin glance at "words used today".
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parse one auth.users record into the admin-facing shape, mirroring how the
// app stores data in user_metadata (see normalizeUserState in src/App.jsx).
export function normalizeUserRow(user) {
  const meta = user?.user_metadata || {};
  const appState = meta.app_state || {};
  const sub = appState.subscription || {};
  const profile = appState.profile || {};

  const tier = sub.tier || meta.plan || 'free';
  const isPremium = tier === 'pro';

  const bannedUntil = user?.banned_until || null;
  const isBanned = bannedUntil ? new Date(bannedUntil).getTime() > Date.now() : false;

  // The stored wordsUsed is a running counter scoped to usageDate; the app counts
  // it toward "today" only when usageDate === today. Mirror that so the admin's
  // "Words today" column doesn't show days-old usage.
  const rawWords = Number(sub.wordsUsed ?? meta.usage_words ?? 0);
  const wordsToday = sub.usageDate === todayKey() ? rawWords : 0;

  return {
    id: user.id,
    email: user.email || profile.email || '',
    name: profile.name || meta.display_name || meta.name || '',
    tier,
    isPremium,
    plan: isPremium ? 'Premium' : 'Free',
    wordsUsed: wordsToday,
    usageDate: sub.usageDate || '',
    paymentStatus: sub.paymentStatus || meta.payment_status || 'inactive',
    lastPaymentReference: sub.lastPaymentReference || meta.paystack_reference || '',
    upgradedAt: sub.upgradedAt || meta.upgraded_at || '',
    adminOverride: meta.admin_override || '', // 'granted' | 'revoked' | ''
    isBanned,
    bannedUntil,
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
    createdAt: user.created_at || '',
    lastSignInAt: user.last_sign_in_at || '',
  };
}

// Pages through every account (up to MAX_USERS_FETCH). Fine for this app's scale;
// the route does the searching/sorting/pagination on the returned array.
export async function listAllUsers() {
  const supabase = getServiceClient();
  const perPage = 200;
  let page = 1;
  const all = [];

  while (all.length < MAX_USERS_FETCH) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    all.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return all.map(normalizeUserRow);
}

export async function getRawUser(id) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.getUserById(id);
  if (error) throw error;
  return data?.user || null;
}

// Creates an end-user account with the service role, pre-confirmed (email_confirm:
// true) so they can sign in immediately — this is how signups skip the email
// confirmation step while the server enforces the sign-up policy. Throws if the
// email already exists.
export async function createEndUser({ email, password, name }) {
  const supabase = getServiceClient();
  const subscription = {
    tier: 'free',
    wordsUsed: 0,
    usageDate: '',
    lastPaymentReference: '',
    upgradedAt: '',
    paymentStatus: 'inactive',
  };
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: name || '',
      plan: 'free',
      usage_words: 0,
      app_state: {
        profile: { name: name || '', email },
        history: [],
        saved: [],
        subscription,
      },
    },
  });
  if (error) throw error;
  return data.user;
}

export async function deleteEndUser(id) {
  const supabase = getServiceClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw error;
}

// Enable/disable premium for an end user while preserving the rest of their
// metadata. Sets an admin_override flag the app respects so a manual change
// isn't silently undone by the Paystack auto-restore (see src/App.jsx).
export async function setUserPremium(id, enable, actorUsername) {
  const supabase = getServiceClient();
  const user = await getRawUser(id);
  if (!user) throw new Error('User not found.');

  const meta = user.user_metadata || {};
  const appState = meta.app_state || {};
  const sub = appState.subscription || {};
  const nowIso = new Date().toISOString();

  const nextSub = {
    ...sub,
    tier: enable ? 'pro' : 'free',
    paymentStatus: enable ? 'active' : 'inactive',
    upgradedAt: enable ? sub.upgradedAt || nowIso : sub.upgradedAt || '',
  };

  const nextMeta = {
    ...meta,
    plan: enable ? 'pro' : 'free',
    payment_status: enable ? 'active' : 'inactive',
    admin_override: enable ? 'granted' : 'revoked',
    admin_override_at: nowIso,
    admin_override_by: actorUsername || '',
    app_state: { ...appState, subscription: nextSub },
  };

  const { data, error } = await supabase.auth.admin.updateUserById(id, { user_metadata: nextMeta });
  if (error) throw error;
  return normalizeUserRow(data.user);
}

export async function setUserBan(id, banned) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: banned ? BAN_FOREVER : 'none',
  });
  if (error) throw error;
  return normalizeUserRow(data.user);
}

// Mark a user's email as confirmed (lets them sign in without clicking the link).
// email_confirm: true sets email_confirmed_at via the GoTrue admin API.
export async function confirmUserEmail(id) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.updateUserById(id, { email_confirm: true });
  if (error) throw error;
  return normalizeUserRow(data.user);
}

// ── admin_users helpers ────────────────────────────────────────────────────

function publicAdmin(row) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return rest;
}

export async function countAdmins() {
  const supabase = getServiceClient();
  const { count, error } = await supabase
    .from('admin_users')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

export async function listAdmins() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, role, disabled, created_at, created_by, last_login_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getAdminByUsername(username) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getAdminById(id) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from('admin_users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function createAdmin({ username, passwordHash, role, createdBy }) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('admin_users')
    .insert({ username, password_hash: passwordHash, role, created_by: createdBy || null })
    .select('id, username, role, disabled, created_at, created_by, last_login_at')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAdmin(id, patch) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('admin_users')
    .update(patch)
    .eq('id', id)
    .select('id, username, role, disabled, created_at, created_by, last_login_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdmin(id) {
  const supabase = getServiceClient();
  const { error } = await supabase.from('admin_users').delete().eq('id', id);
  if (error) throw error;
}

export async function touchAdminLogin(id) {
  const supabase = getServiceClient();
  await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', id);
}

export { publicAdmin };

// ── app_config helpers ─────────────────────────────────────────────────────

export async function getConfig(key) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setConfig(key, value, updatedBy) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('app_config')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy || null },
      { onConflict: 'key' },
    )
    .select('value')
    .single();
  if (error) throw error;
  return data.value;
}

// ── End-user lookup by email / token (for ban-status + appeals) ─────────────

// Scans all accounts and returns the normalized row for an email, or null. Fine
// at this app's scale; revisit with a DB function if the user base grows large.
export async function findUserByEmail(email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  const users = await listAllUsers();
  return users.find((u) => u.email.toLowerCase() === target) || null;
}

// Validates an end user's access token and returns their normalized row (with
// fresh banned status), or null if the token is invalid.
export async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  const raw = await getRawUser(data.user.id);
  return raw ? normalizeUserRow(raw) : null;
}

// ── Ban appeals ─────────────────────────────────────────────────────────────

export async function createAppeal({ userId, email, message }) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('ban_appeals')
    .insert({ user_id: userId || null, email, message })
    .select('id, email, status, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listAppeals({ status } = {}) {
  const supabase = getServiceClient();
  let query = supabase.from('ban_appeals').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAppealById(id) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from('ban_appeals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function updateAppeal(id, patch) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from('ban_appeals').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

// Number of still-open appeals for an email — used to avoid duplicate submissions.
export async function countOpenAppealsForEmail(email) {
  const supabase = getServiceClient();
  const { count, error } = await supabase
    .from('ban_appeals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .ilike('email', email);
  if (error) throw error;
  return count || 0;
}
