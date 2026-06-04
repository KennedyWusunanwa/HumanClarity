import { readSession } from './session.js';
import { getAdminById } from './service.js';
import { roleHasPermission } from './roles.js';

// Thrown by requireAdmin; the route's catch turns it into a JSON response.
export class AdminAuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

// Verifies the signed session cookie AND re-checks the live admin_users row, so
// a disabled/deleted account or a role downgrade takes effect immediately (the
// cookie alone isn't trusted for role — only for identity).
//
// Pass a required permission (from PERMISSIONS) to also enforce authorization.
// Returns the fresh admin row on success; throws AdminAuthError otherwise.
export async function requireAdmin(request, permission) {
  const session = readSession(request);
  if (!session?.sub) {
    throw new AdminAuthError('Not signed in.', 401);
  }

  let admin;
  try {
    admin = await getAdminById(session.sub);
  } catch (err) {
    throw new AdminAuthError('Could not verify session.', 500);
  }

  if (!admin || admin.disabled) {
    throw new AdminAuthError('Your admin account is no longer active.', 401);
  }

  if (permission && !roleHasPermission(admin.role, permission)) {
    throw new AdminAuthError('You do not have permission to do that.', 403);
  }

  return admin;
}

// Convenience wrapper: returns a Response on failure, or { admin } on success.
export async function guard(request, permission) {
  try {
    const admin = await requireAdmin(request, permission);
    return { admin, response: null };
  } catch (err) {
    const status = err instanceof AdminAuthError ? err.status : 500;
    return {
      admin: null,
      response: Response.json({ error: err.message || 'Unauthorized.' }, { status }),
    };
  }
}
