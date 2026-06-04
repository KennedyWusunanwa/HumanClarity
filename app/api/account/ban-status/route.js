import { findUserByEmail, getUserFromToken } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { accessToken?, email? } → { banned }
// Lets the app check whether the current/attempting user is banned. The token
// path is authoritative + cheap; the email path is a fallback for failed sign-ins.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    let user = null;
    if (accessToken) user = await getUserFromToken(accessToken);
    if (!user && email) user = await findUserByEmail(email);

    if (!user) return Response.json({ banned: false });
    return Response.json({ banned: Boolean(user.isBanned), email: user.email });
  } catch (err) {
    // Fail open: a transient lookup error shouldn't lock a legitimate user out of
    // the app. The ban is still enforced by Supabase rejecting their sign-in/refresh.
    return Response.json({ banned: false, error: err.message }, { status: 200 });
  }
}
