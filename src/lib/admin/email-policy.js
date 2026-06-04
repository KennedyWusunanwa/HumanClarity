import { getConfig, setConfig } from './service.js';
import { DEFAULT_ALLOWED_DOMAINS } from '../email-validation.js';

export const EMAIL_POLICY_KEY = 'email_policy';

// mode 'allowlist' → only allowedDomains may sign up; 'any' → any real domain
// (MX-validated) may sign up. Default restricts to the major providers.
export const DEFAULT_EMAIL_POLICY = {
  mode: 'allowlist',
  allowedDomains: [...DEFAULT_ALLOWED_DOMAINS],
};

export function normalizeEmailPolicy(value) {
  const v = value || {};
  const mode = v.mode === 'any' ? 'any' : 'allowlist';

  let domains = Array.isArray(v.allowedDomains) ? v.allowedDomains : DEFAULT_ALLOWED_DOMAINS;
  domains = domains
    .map((d) => String(d || '').trim().toLowerCase().replace(/^@+/, ''))
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)); // basic domain shape
  domains = [...new Set(domains)];

  // Never persist an empty allow-list in allowlist mode — that would lock out
  // every signup. Fall back to the defaults instead.
  if (mode === 'allowlist' && domains.length === 0) {
    domains = [...DEFAULT_ALLOWED_DOMAINS];
  }
  return { mode, allowedDomains: domains };
}

// Reads the live policy, degrading to defaults if the config row/table is missing.
export async function getEmailPolicy() {
  try {
    const value = await getConfig(EMAIL_POLICY_KEY);
    return normalizeEmailPolicy(value ?? DEFAULT_EMAIL_POLICY);
  } catch (err) {
    if (/relation .*app_config.* does not exist/i.test(err?.message || '')) {
      return { ...DEFAULT_EMAIL_POLICY };
    }
    throw err;
  }
}

export async function saveEmailPolicy(input, updatedBy) {
  const normalized = normalizeEmailPolicy(input);
  const saved = await setConfig(EMAIL_POLICY_KEY, normalized, updatedBy);
  return normalizeEmailPolicy(saved);
}
