-- ============================================================================
-- HumanClarity — Admin dashboard schema
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase dashboard:  SQL Editor → New query → paste → Run.
--
-- It creates two tables:
--   • admin_users  — the dashboard's own username/password accounts + roles
--   • app_config   — editable key/value settings (e.g. subscription pricing)
--
-- Both tables have RLS enabled with NO public policies, so the anon /
-- publishable key can never read or write them. Only the service-role key
-- (used by the /api/admin/* server routes) bypasses RLS and can touch them.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Admin accounts ─────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  password_hash text not null,                 -- scrypt: "scrypt$N$saltHex$hashHex"
  role          text not null default 'guest'  -- 'admin' | 'editor' | 'guest' | 'accountant'
                check (role in ('admin', 'editor', 'guest', 'accountant')),
  disabled      boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    text,
  last_login_at timestamptz
);

-- Usernames are case-insensitive unique.
create unique index if not exists admin_users_username_lower_idx
  on public.admin_users (lower(username));

-- Only ONE bootstrap (first-admin) row can ever exist. This closes a race where
-- two concurrent first-run POSTs (different usernames) both pass the app-level
-- "no admins yet" check and each insert a full admin. The first-admin route sets
-- created_by = 'bootstrap'; this partial unique index lets at most one succeed.
create unique index if not exists admin_users_single_bootstrap_idx
  on public.admin_users ((created_by = 'bootstrap'))
  where created_by = 'bootstrap';

-- Atomic backstop against locking everyone out of the dashboard: never let a
-- delete/disable/demote drop the number of active admins (role='admin' AND not
-- disabled) below 1. The advisory lock serializes concurrent admin mutations so
-- two simultaneous requests can't each see "2 admins" and both remove one.
create or replace function public.admin_users_prevent_last_admin()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
  perform pg_advisory_xact_lock(hashtext('admin_users_last_admin_guard'));

  select count(*) into remaining
  from public.admin_users
  where role = 'admin' and disabled = false and id <> old.id;

  if tg_op = 'UPDATE' and new.role = 'admin' and new.disabled = false then
    remaining := remaining + 1;
  end if;

  if remaining < 1 then
    raise exception 'last_active_admin' using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists admin_users_prevent_last_admin_trg on public.admin_users;
create trigger admin_users_prevent_last_admin_trg
  before update or delete on public.admin_users
  for each row
  when (old.role = 'admin' and old.disabled = false)
  execute function public.admin_users_prevent_last_admin();

alter table public.admin_users enable row level security;
-- Intentionally no policies → only the service role can access this table.

-- ── App config (pricing, limits, …) ────────────────────────────────────────
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_config enable row level security;
-- Intentionally no policies → only the service role can access this table.

-- ── Ban appeals ────────────────────────────────────────────────────────────
-- Submitted by banned end users from the "you're banned" screen; reviewed in the
-- admin dashboard's Appeals tab.
create table if not exists public.ban_appeals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  email       text not null,
  message     text not null,
  status      text not null default 'open'
              check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists ban_appeals_status_idx
  on public.ban_appeals (status, created_at desc);

alter table public.ban_appeals enable row level security;
-- Intentionally no policies → only the service role can access this table.

-- Seed the pricing row with the current hard-coded defaults so nothing breaks
-- before an admin edits it. (Pro = 50 GHS / month, free tier = 500 words/day.)
insert into public.app_config (key, value)
values (
  'pricing',
  jsonb_build_object(
    'proPriceGhs', 50,
    'proPriceUsdEstimate', 4.44,
    'currency', 'GHS',
    'freeWordLimit', 500,
    'billingPeriod', 'month'
  )
)
on conflict (key) do nothing;

-- Sign-up email policy. 'allowlist' restricts new sign-ups to the listed major
-- providers (blocks fake addresses on random real domains); editable in the
-- admin dashboard's Users tab. Falls back to these defaults if absent.
insert into public.app_config (key, value)
values (
  'email_policy',
  jsonb_build_object(
    'mode', 'allowlist',
    'allowedDomains', jsonb_build_array(
      'gmail.com', 'googlemail.com',
      'yahoo.com', 'ymail.com', 'rocketmail.com',
      'yahoo.co.uk', 'yahoo.ca', 'yahoo.com.au', 'yahoo.in',
      'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.com.br', 'yahoo.com.mx',
      'icloud.com', 'me.com', 'mac.com'
    )
  )
)
on conflict (key) do nothing;
