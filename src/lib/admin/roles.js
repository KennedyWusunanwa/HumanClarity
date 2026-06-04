// Role → permission matrix for the admin dashboard.
//
//   admin  — can do everything (view, change prices, premium/ban, manage admins)
//   editor — can view everything and edit prices, but no premium/ban/admin mgmt
//   guest  — can view only, no changes at all

export const ROLES = ['admin', 'editor', 'guest'];

export const PERMISSIONS = {
  VIEW: 'view', // see users, subscriptions, pricing, admin list
  EDIT_PRICING: 'edit_pricing', // change subscription prices / limits
  MANAGE_USERS: 'manage_users', // enable/disable premium, ban/unban end users
  MANAGE_ADMINS: 'manage_admins', // create/edit/delete admin dashboard accounts
};

const ROLE_PERMISSIONS = {
  admin: [PERMISSIONS.VIEW, PERMISSIONS.EDIT_PRICING, PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_ADMINS],
  editor: [PERMISSIONS.VIEW, PERMISSIONS.EDIT_PRICING],
  guest: [PERMISSIONS.VIEW],
};

export function roleHasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  return Array.isArray(perms) && perms.includes(permission);
}

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

export const ROLE_LABELS = {
  admin: 'Admin',
  editor: 'Editor',
  guest: 'Guest',
};

export const ROLE_DESCRIPTIONS = {
  admin: 'Full access — manage users, prices, and admin accounts.',
  editor: 'Can view everything and change prices only.',
  guest: 'View-only. Cannot make any changes.',
};
