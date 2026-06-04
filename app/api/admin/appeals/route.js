import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { listAppeals } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET → all ban appeals (view access), newest first, with open/total counts.
export async function GET(request) {
  const { response } = await guard(request, PERMISSIONS.VIEW);
  if (response) return response;

  try {
    const appeals = await listAppeals();
    const counts = {
      open: appeals.filter((a) => a.status === 'open').length,
      total: appeals.length,
    };
    return Response.json({ appeals, counts });
  } catch (err) {
    return Response.json({ error: err.message || 'Could not load appeals.' }, { status: 500 });
  }
}
