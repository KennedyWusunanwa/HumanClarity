import { ROLES } from './roles.js';

export function usernameIssue(username) {
  if (typeof username !== 'string') return 'Username is required.';
  const u = username.trim();
  if (u.length < 3) return 'Username must be at least 3 characters.';
  if (u.length > 40) return 'Username is too long.';
  if (!/^[a-zA-Z0-9._-]+$/.test(u)) {
    return 'Username may only contain letters, numbers, dots, dashes, and underscores.';
  }
  return null;
}

export function roleIssue(role) {
  if (!ROLES.includes(role)) return 'Role must be admin, editor, or guest.';
  return null;
}
