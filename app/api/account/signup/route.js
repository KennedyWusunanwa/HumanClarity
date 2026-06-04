import { checkEmail } from '@/lib/server/email-check';
import { createEndUser } from '@/lib/admin/service';
import { emailErrorMessage } from '@/lib/email-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-authoritative signup. Validates the email against the sign-up policy
// (allow-list of providers) and creates the account with the service role, so
// the policy can't be bypassed by calling Supabase directly from the browser.
// The account is created pre-confirmed (no email verification step).
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const check = await checkEmail(email);
    if (!check.ok) {
      return Response.json({ error: emailErrorMessage(check.reason), reason: check.reason }, { status: 400 });
    }

    try {
      await createEndUser({ email, password, name });
    } catch (err) {
      const msg = String(err?.message || '');
      if (/already.*registered|already been registered|email.*(exists|registered)|duplicate|already exists/i.test(msg)) {
        return Response.json(
          { error: 'An account with this email already exists. Please sign in instead.', reason: 'exists' },
          { status: 409 },
        );
      }
      // Surface a generic creation error (e.g. Supabase password policy).
      return Response.json({ error: msg || 'Could not create your account.' }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not create your account.' }, { status: 500 });
  }
}
