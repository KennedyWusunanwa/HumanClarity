// Tiny, dependency-free cookie helpers so the admin routes can stay on the same
// plain Web Request/Response style as the rest of app/api/* (no next/headers).

export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// Serializes a Set-Cookie value. maxAge is in seconds; pass 0 to expire now.
export function serializeCookie(name, value, { maxAge, httpOnly = true, path = '/', sameSite = 'Lax', secure } = {}) {
  // Default `secure` on in production so the session cookie isn't sent over http.
  const isSecure = secure ?? process.env.NODE_ENV === 'production';
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (isSecure) parts.push('Secure');
  if (typeof maxAge === 'number') {
    parts.push(`Max-Age=${maxAge}`);
    // Belt-and-suspenders Expires for older clients.
    const expires = maxAge <= 0 ? new Date(0) : new Date(Date.now() + maxAge * 1000);
    parts.push(`Expires=${expires.toUTCString()}`);
  }
  return parts.join('; ');
}
