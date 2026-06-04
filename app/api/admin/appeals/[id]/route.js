import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { getAppealById, updateAppeal, setUserBan } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/appeals/:id  { status?: 'resolved'|'dismissed', unban?: boolean }
// Resolve or dismiss an appeal, optionally unbanning the user. Requires manage_users.
export async function PATCH(request, { params }) {
  const { admin, response } = await guard(request, PERMISSIONS.MANAGE_USERS);
  if (response) return response;

  try {
    const { id } = await params;
    const appeal = await getAppealById(id);
    if (!appeal) return Response.json({ error: 'Appeal not found.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const status = body.status === 'dismissed' ? 'dismissed' : 'resolved';
    const unban = Boolean(body.unban);

    let unbanned = false;
    if (unban && appeal.user_id) {
      await setUserBan(appeal.user_id, false);
      unbanned = true;
    }

    const updated = await updateAppeal(id, {
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: admin.username,
    });

    return Response.json({ ok: true, appeal: updated, unbanned });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not update appeal.' }, { status: 500 });
  }
}
