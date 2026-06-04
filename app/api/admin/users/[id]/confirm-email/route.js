import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { confirmUserEmail } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/users/:id/confirm-email
// Manually confirm an end user's email. Requires manage_users (admin only).
export async function POST(request, { params }) {
  const { admin, response } = await guard(request, PERMISSIONS.MANAGE_USERS);
  if (response) return response;

  try {
    const { id } = await params;
    if (!id) return Response.json({ error: 'Missing user id.' }, { status: 400 });

    const user = await confirmUserEmail(id);
    return Response.json({ ok: true, user });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not confirm email.' }, { status: 500 });
  }
}
