import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { listAdmins, getAdminById, updateAdmin, deleteAdmin } from '@/lib/admin/service';
import { hashPassword, passwordIssue } from '@/lib/admin/passwords';
import { roleIssue } from '@/lib/admin/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Number of enabled accounts that still have the 'admin' role — used to prevent
// locking everyone out of the dashboard. (The DB trigger is the atomic backstop;
// this gives a friendly message in the common, non-racy case.)
function enabledAdminCount(admins) {
  return admins.filter((a) => a.role === 'admin' && !a.disabled).length;
}

const LAST_ADMIN_MSG = 'This is the last active admin — promote or enable another admin first.';

// The DB raises 'last_active_admin' if a concurrent change would remove the last
// active admin past our JS check. Surface it as a clean 400 instead of a 500.
function isLastAdminError(err) {
  return /last_active_admin/i.test(err?.message || '');
}

// PATCH → update an admin account's role, disabled flag, and/or password.
export async function PATCH(request, { params }) {
  const { admin: actor, response } = await guard(request, PERMISSIONS.MANAGE_ADMINS);
  if (response) return response;

  try {
    const { id } = await params;
    const target = await getAdminById(id);
    if (!target) return Response.json({ error: 'Admin account not found.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const patch = {};

    if (typeof body.role === 'string' && body.role !== target.role) {
      const rIssue = roleIssue(body.role);
      if (rIssue) return Response.json({ error: rIssue }, { status: 400 });
      patch.role = body.role;
    }

    if (typeof body.disabled === 'boolean' && body.disabled !== target.disabled) {
      if (body.disabled && target.id === actor.id) {
        return Response.json({ error: "You can't disable your own account." }, { status: 400 });
      }
      patch.disabled = body.disabled;
    }

    if (body.password != null && body.password !== '') {
      const pIssue = passwordIssue(String(body.password));
      if (pIssue) return Response.json({ error: pIssue }, { status: 400 });
      patch.password_hash = hashPassword(String(body.password));
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    // Lockout guard: if this change removes the target from the enabled-admin
    // pool (disable or demote a current admin), make sure someone else remains.
    const removesAdminCoverage =
      target.role === 'admin' &&
      !target.disabled &&
      ((patch.role && patch.role !== 'admin') || patch.disabled === true);

    if (removesAdminCoverage) {
      const admins = await listAdmins();
      if (enabledAdminCount(admins) <= 1) {
        return Response.json(
          { error: 'This is the last active admin — promote or enable another admin first.' },
          { status: 400 },
        );
      }
    }

    const updated = await updateAdmin(id, patch);
    return Response.json({ ok: true, admin: updated });
  } catch (err) {
    if (isLastAdminError(err)) {
      return Response.json({ error: LAST_ADMIN_MSG }, { status: 400 });
    }
    return Response.json({ error: err.message || 'Could not update admin account.' }, { status: 500 });
  }
}

// DELETE → remove an admin account.
export async function DELETE(request, { params }) {
  const { admin: actor, response } = await guard(request, PERMISSIONS.MANAGE_ADMINS);
  if (response) return response;

  try {
    const { id } = await params;
    const target = await getAdminById(id);
    if (!target) return Response.json({ error: 'Admin account not found.' }, { status: 404 });

    if (target.id === actor.id) {
      return Response.json({ error: "You can't delete your own account." }, { status: 400 });
    }

    if (target.role === 'admin' && !target.disabled) {
      const admins = await listAdmins();
      if (enabledAdminCount(admins) <= 1) {
        return Response.json(
          { error: 'This is the last active admin — you cannot delete it.' },
          { status: 400 },
        );
      }
    }

    await deleteAdmin(id);
    return Response.json({ ok: true });
  } catch (err) {
    if (isLastAdminError(err)) {
      return Response.json({ error: 'This is the last active admin — you cannot delete it.' }, { status: 400 });
    }
    return Response.json({ error: err.message || 'Could not delete admin account.' }, { status: 500 });
  }
}
