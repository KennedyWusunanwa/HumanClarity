import {
  findUserByEmail,
  getUserFromToken,
  createAppeal,
  countOpenAppealsForEmail,
} from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE = 2000;

// POST { email|accessToken, message } → submit a ban appeal. Only accounts that
// are actually banned can appeal, and only one open appeal per account at a time.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const message = String(body.message || '').trim();

    if (!message) {
      return Response.json({ error: 'Please tell us why your account should be reinstated.' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE) {
      return Response.json({ error: 'Your message is too long.' }, { status: 400 });
    }

    let user = null;
    if (accessToken) user = await getUserFromToken(accessToken);
    if (!user && email) user = await findUserByEmail(email);

    if (!user || !user.isBanned) {
      return Response.json({ error: 'No banned account matches that email.' }, { status: 400 });
    }

    // One open appeal at a time — silently treat repeats as success.
    const open = await countOpenAppealsForEmail(user.email);
    if (open > 0) {
      return Response.json({ ok: true, duplicate: true });
    }

    await createAppeal({ userId: user.id, email: user.email, message });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not submit your appeal.' }, { status: 500 });
  }
}
