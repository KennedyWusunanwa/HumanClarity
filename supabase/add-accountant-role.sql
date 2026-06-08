-- Migration: allow the new 'accountant' admin role.
--
-- The income feature works without this migration (it reads auth users + pricing).
-- You ONLY need to run this if you want to create or assign the **accountant** role
-- to an admin-dashboard account — the admin_users.role column has a CHECK constraint
-- that otherwise rejects 'accountant'.
--
-- How to run: Supabase dashboard → SQL Editor → paste → Run.

alter table public.admin_users
  drop constraint if exists admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('admin', 'editor', 'guest', 'accountant'));
