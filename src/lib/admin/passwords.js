import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Password hashing with Node's built-in scrypt — no external dependency, works
// on the Vercel Node runtime. Stored format: "scrypt$<N>$<saltHex>$<hashHex>".

const KEYLEN = 64;
const COST = 16384; // scrypt N — CPU/memory cost factor.

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) return false;

  let actual;
  try {
    actual = scryptSync(String(password), salt, expected.length, { N: cost });
  } catch {
    return false;
  }
  // Lengths are equal by construction, but guard timingSafeEqual anyway.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// Basic strength gate enforced server-side when creating/updating admin accounts.
export function passwordIssue(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) {
    return 'Password is too long.';
  }
  return null;
}
