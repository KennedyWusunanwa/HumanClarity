import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { getEmailPolicy, saveEmailPolicy } from '@/lib/admin/email-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → current sign-up email policy (view access).
export async function GET(request) {
  const { response } = await guard(request, PERMISSIONS.VIEW);
  if (response) return response;
  try {
    const policy = await getEmailPolicy();
    return Response.json({ policy });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not load email policy.' }, { status: 500 });
  }
}

// PUT → update the policy. Controls who can sign up, so admin-only (manage_users).
export async function PUT(request) {
  const { admin, response } = await guard(request, PERMISSIONS.MANAGE_USERS);
  if (response) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const policy = await saveEmailPolicy(body, admin.username);
    return Response.json({ ok: true, policy });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not save email policy.' }, { status: 500 });
  }
}
