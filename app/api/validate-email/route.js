import { checkEmail } from '@/lib/server/email-check';

export const runtime = 'nodejs';

// Instant email-validation endpoint (used for fast UX feedback). The signup
// route does the same check authoritatively before creating an account.
export async function POST(request) {
  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email || '').trim();
  } catch {
    return Response.json({ ok: false, reason: 'format' }, { status: 400 });
  }

  const result = await checkEmail(email);
  if (result.ok) return Response.json({ ok: true });

  // 'lookup-failed' is a transient DNS issue → 502 so the UI can suggest retry;
  // everything else is a client-correctable problem → 400.
  const status = result.reason === 'lookup-failed' ? 502 : 400;
  return Response.json({ ok: false, reason: result.reason }, { status });
}
