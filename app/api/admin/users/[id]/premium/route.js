import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { setUserPremium } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/users/:id/premium  { enable: boolean }
// Enable/disable premium on an end user. Requires manage_users (admin only).
export async function POST(request, { params }) {
  const { admin, response } = await guard(request, PERMISSIONS.MANAGE_USERS);
  if (response) return response;

  try {
    const { id } = await params;
    if (!id) return Response.json({ error: 'Missing user id.' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const enable = Boolean(body.enable);

    const user = await setUserPremium(id, enable, admin.username);
    return Response.json({ ok: true, user });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not update premium status.' }, { status: 500 });
  }
}
