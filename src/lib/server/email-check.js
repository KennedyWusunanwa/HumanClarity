import dns from 'node:dns/promises';

import {
  EMAIL_FORMAT,
  DISPOSABLE_DOMAINS,
  extractDomain,
  domainAllowed,
} from '../email-validation.js';
import { getEmailPolicy, DEFAULT_EMAIL_POLICY } from '../admin/email-policy.js';

// Authoritative server-side email check shared by /api/validate-email and the
// signup route. Returns { ok, reason }. Enforces: format, disposable block,
// and the admin sign-up policy (allow-list of providers, or MX in 'any' mode).

const MX_TIMEOUT_MS = 3000;

async function lookupMxWithTimeout(domain) {
  return Promise.race([
    dns.resolveMx(domain),
    new Promise((_, reject) => setTimeout(() => reject(new Error('mx-timeout')), MX_TIMEOUT_MS)),
  ]);
}

export async function checkEmail(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!EMAIL_FORMAT.test(trimmed)) return { ok: false, reason: 'format' };

  const domain = extractDomain(trimmed);
  if (!domain) return { ok: false, reason: 'format' };
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: 'disposable' };

  let policy = DEFAULT_EMAIL_POLICY;
  try {
    policy = await getEmailPolicy();
  } catch {
    policy = DEFAULT_EMAIL_POLICY;
  }

  if (policy.mode === 'allowlist') {
    return domainAllowed(domain, policy.allowedDomains)
      ? { ok: true }
      : { ok: false, reason: 'domain-not-allowed' };
  }

  // 'any' mode → require a real mail server.
  try {
    const records = await lookupMxWithTimeout(domain);
    if (!Array.isArray(records) || records.length === 0) {
      return { ok: false, reason: 'no-mx' };
    }
  } catch (err) {
    const code = err?.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      return { ok: false, reason: 'no-mx' };
    }
    return { ok: false, reason: 'lookup-failed' };
  }

  return { ok: true };
}
