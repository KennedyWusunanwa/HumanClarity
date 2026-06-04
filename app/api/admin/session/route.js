import { guard } from '@/lib/admin/guard';
import { permissionsForRole, ROLE_LABELS } from '@/lib/admin/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns the current admin (or 401). The frontend uses role/permissions to gate
// the UI, but every mutating route re-checks permission server-side regardless.
export async function GET(request) {
  const { admin, response } = await guard(request);
  if (response) return response;

  return Response.json({
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      roleLabel: ROLE_LABELS[admin.role] || admin.role,
      permissions: permissionsForRole(admin.role),
    },
  });
}
