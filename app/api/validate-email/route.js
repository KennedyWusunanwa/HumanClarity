import dns from 'node:dns/promises';
import {
  EMAIL_FORMAT,
  DISPOSABLE_DOMAINS,
  extractDomain,
} from '@/lib/email-validation';

export const runtime = 'nodejs';

// Hard cap on the DNS lookup so a slow/broken resolver doesn't stall signup.
const MX_TIMEOUT_MS = 3000;

async function lookupMxWithTimeout(domain) {
  return Promise.race([
    dns.resolveMx(domain),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('mx-timeout')), MX_TIMEOUT_MS),
    ),
  ]);
}

export async function POST(request) {
  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email || '').trim();
  } catch {
    return Response.json({ ok: false, reason: 'format' }, { status: 400 });
  }

  if (!email) {
    return Response.json({ ok: false, reason: 'empty' }, { status: 400 });
  }

  if (!EMAIL_FORMAT.test(email)) {
    return Response.json({ ok: false, reason: 'format' }, { status: 400 });
  }

  const domain = extractDomain(email);
  if (!domain) {
    return Response.json({ ok: false, reason: 'format' }, { status: 400 });
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return Response.json({ ok: false, reason: 'disposable' }, { status: 400 });
  }

  try {
    const records = await lookupMxWithTimeout(domain);
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ ok: false, reason: 'no-mx' }, { status: 400 });
    }
  } catch (err) {
    // ENOTFOUND / ENODATA / NXDOMAIN all mean "no working mail server".
    const code = err?.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      return Response.json({ ok: false, reason: 'no-mx' }, { status: 400 });
    }
    // Anything else (transient DNS issue, timeout) — fail closed so we don't accept
    // unverified emails, but use a distinct reason so the UI can suggest retry.
    return Response.json({ ok: false, reason: 'lookup-failed' }, { status: 502 });
  }

  return Response.json({ ok: true });
}
