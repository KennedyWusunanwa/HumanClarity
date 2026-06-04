import { guard } from '@/lib/admin/guard';
import { PERMISSIONS } from '@/lib/admin/roles';
import { listAllUsers } from '@/lib/admin/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/users?search=&filter=&sort=&page=&perPage=
// Lists end-user accounts with their subscription info. View-only access.
export async function GET(request) {
  const { admin, response } = await guard(request, PERMISSIONS.VIEW);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const filter = url.searchParams.get('filter') || 'all'; // all | premium | free | banned
    const sort = url.searchParams.get('sort') || 'created_desc';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(5, Number(url.searchParams.get('perPage')) || 25));

    let users = await listAllUsers();

    if (search) {
      users = users.filter(
        (u) => u.email.toLowerCase().includes(search) || u.name.toLowerCase().includes(search),
      );
    }
    if (filter === 'premium') users = users.filter((u) => u.isPremium);
    else if (filter === 'free') users = users.filter((u) => !u.isPremium);
    else if (filter === 'banned') users = users.filter((u) => u.isBanned);

    const byDate = (a, b, key) => new Date(b[key] || 0) - new Date(a[key] || 0);
    if (sort === 'created_asc') users.sort((a, b) => -byDate(a, b, 'createdAt'));
    else if (sort === 'recent_signin') users.sort((a, b) => byDate(a, b, 'lastSignInAt'));
    else if (sort === 'email') users.sort((a, b) => a.email.localeCompare(b.email));
    else users.sort((a, b) => byDate(a, b, 'createdAt')); // created_desc default

    const total = users.length;
    const stats = {
      total,
      premium: users.filter((u) => u.isPremium).length,
      banned: users.filter((u) => u.isBanned).length,
    };
    const start = (page - 1) * perPage;
    const pageUsers = users.slice(start, start + perPage);

    return Response.json({
      users: pageUsers,
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      stats,
      viewerRole: admin.role,
    });
  } catch (err) {
    const setupHint = /service_role|SUPABASE_SERVICE_ROLE_KEY/i.test(err?.message || '');
    return Response.json(
      { error: err.message || 'Could not load users.', setupError: setupHint },
      { status: 500 },
    );
  }
}
