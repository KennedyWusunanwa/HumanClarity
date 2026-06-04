import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { listAdmins, getAdminByUsername, createAdmin } from '@/lib/admin/service';
import { hashPassword, passwordIssue } from '@/lib/admin/passwords';
import { usernameIssue, roleIssue } from '@/lib/admin/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → list admin dashboard accounts (view access; password hashes excluded).
export async function GET(request) {
  const { response } = await guard(request, PERMISSIONS.VIEW);
  if (response) return response;

  try {
    const admins = await listAdmins();
    return Response.json({ admins });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not load admin accounts.' }, { status: 500 });
  }
}

// POST → create a new admin dashboard account (manage_admins / admin only).
export async function POST(request) {
  const { admin, response } = await guard(request, PERMISSIONS.MANAGE_ADMINS);
  if (response) return response;

  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || '');

    const uIssue = usernameIssue(username);
    if (uIssue) return Response.json({ error: uIssue }, { status: 400 });
    const pIssue = passwordIssue(password);
    if (pIssue) return Response.json({ error: pIssue }, { status: 400 });
    const rIssue = roleIssue(role);
    if (rIssue) return Response.json({ error: rIssue }, { status: 400 });

    const clash = await getAdminByUsername(username);
    if (clash) return Response.json({ error: 'That username is taken.' }, { status: 409 });

    const created = await createAdmin({
      username,
      passwordHash: hashPassword(password),
      role,
      createdBy: admin.username,
    });

    return Response.json({ ok: true, admin: created });
  } catch (err) {
    // Unique-index violation if two creates race past the clash check.
    if (/duplicate key|unique/i.test(err?.message || '')) {
      return Response.json({ error: 'That username is taken.' }, { status: 409 });
    }
    return Response.json({ error: err.message || 'Could not create admin account.' }, { status: 500 });
  }
}
