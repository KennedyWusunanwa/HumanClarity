import { getAdminByUsername, touchAdminLogin } from '@/lib/admin/service';
import { verifyPassword, hashPassword } from '@/lib/admin/passwords';
import { sessionCookieHeader } from '@/lib/admin/session';
import { permissionsForRole, ROLE_LABELS } from '@/lib/admin/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Decoy hash computed once at module load. We always run one scrypt verification
// (against this when the username is unknown) so login latency doesn't reveal
// whether a username exists — closing a timing-based enumeration side-channel.
const DECOY_HASH = hashPassword('decoy-password-not-in-use');

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return Response.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const admin = await getAdminByUsername(username);

    // Always perform the scrypt work, even for unknown users, then decide. This
    // keeps timing constant and returns the same generic message either way so we
    // don't leak which usernames are valid.
    const passwordOk = verifyPassword(password, admin ? admin.password_hash : DECOY_HASH);
    const ok = Boolean(admin) && !admin.disabled && passwordOk;
    if (!ok) {
      return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    await touchAdminLogin(admin.id);

    return Response.json(
      {
        ok: true,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          roleLabel: ROLE_LABELS[admin.role] || admin.role,
          permissions: permissionsForRole(admin.role),
        },
      },
      { headers: { 'Set-Cookie': sessionCookieHeader(admin) } },
    );
  } catch (err) {
    return Response.json({ error: err.message || 'Could not sign in.' }, { status: 500 });
  }
}
