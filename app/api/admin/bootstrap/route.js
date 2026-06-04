import { countAdmins, createAdmin, getAdminByUsername, touchAdminLogin } from '@/lib/admin/service';
import { hashPassword, passwordIssue } from '@/lib/admin/passwords';
import { usernameIssue } from '@/lib/admin/validate';
import { sessionCookieHeader } from '@/lib/admin/session';
import { permissionsForRole, ROLE_LABELS } from '@/lib/admin/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → whether the dashboard still needs its first admin account.
export async function GET() {
  try {
    const count = await countAdmins();
    return Response.json({ needsBootstrap: count === 0 });
  } catch (err) {
    return Response.json(
      { error: err.message || 'Could not check setup status.', setupError: true },
      { status: 500 },
    );
  }
}

// POST → create the very first admin (role=admin). Only allowed when no admin
// accounts exist yet; refuses once the dashboard has been set up.
export async function POST(request) {
  try {
    const existing = await countAdmins();
    if (existing > 0) {
      return Response.json(
        { error: 'Setup already complete. Sign in instead.' },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    const uIssue = usernameIssue(username);
    if (uIssue) return Response.json({ error: uIssue }, { status: 400 });
    const pIssue = passwordIssue(password);
    if (pIssue) return Response.json({ error: pIssue }, { status: 400 });

    // Race guard: someone could create a clashing username between the count
    // check and insert. getAdminByUsername + the unique index both protect us.
    const clash = await getAdminByUsername(username);
    if (clash) return Response.json({ error: 'That username is taken.' }, { status: 409 });

    let admin;
    try {
      admin = await createAdmin({
        username,
        passwordHash: hashPassword(password),
        role: 'admin',
        createdBy: 'bootstrap',
      });
    } catch (insertErr) {
      // The single-bootstrap partial unique index rejects a racing second first-admin.
      if (/admin_users_single_bootstrap|duplicate key|unique/i.test(insertErr?.message || '')) {
        return Response.json({ error: 'Setup already complete. Sign in instead.' }, { status: 409 });
      }
      throw insertErr;
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
    return Response.json({ error: err.message || 'Could not complete setup.' }, { status: 500 });
  }
}
