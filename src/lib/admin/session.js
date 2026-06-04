import { createHmac, timingSafeEqual } from 'node:crypto';

import { parseCookies, serializeCookie } from './cookies.js';

// Stateless, signed admin session tokens (a minimal JWT-like scheme) carried in
// an httpOnly cookie. Format:  base64url(payloadJSON) . base64url(HMAC-SHA256)

export const ADMIN_COOKIE = 'hc_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'ADMIN_SESSION_SECRET is not set (or too short). Add a long random value to your environment — see ADMIN_SETUP.md.',
    );
  }
  return secret;
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payloadB64) {
  return b64urlEncode(createHmac('sha256', getSecret()).update(payloadB64).digest());
}

// Returns { token, maxAge }.
export function createSessionToken(admin) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: admin.id,
    username: admin.username,
    role: admin.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  return { token: `${payloadB64}.${sign(payloadB64)}`, maxAge: SESSION_TTL_SECONDS };
}

// Returns the decoded payload if the token is valid and unexpired, else null.
export function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  let expectedSig;
  try {
    expectedSig = sign(payloadB64);
  } catch {
    return null; // missing secret
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export function readSession(request) {
  const token = parseCookies(request)[ADMIN_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieHeader(admin) {
  const { token, maxAge } = createSessionToken(admin);
  return serializeCookie(ADMIN_COOKIE, token, { maxAge, httpOnly: true, sameSite: 'Lax' });
}

export function clearSessionCookieHeader() {
  return serializeCookie(ADMIN_COOKIE, '', { maxAge: 0, httpOnly: true, sameSite: 'Lax' });
}
