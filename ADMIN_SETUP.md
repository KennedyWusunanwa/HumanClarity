# Admin Dashboard — Setup

The admin dashboard lives at **`/admin`** (e.g. `https://human-clarity.vercel.app/admin`).
It lets you view every user account and subscription, change subscription prices,
enable/disable Premium, and ban/unban accounts — with role-based logins
(**Admin**, **Editor**, **Guest**).

It is a separate area from the main app, with its own username/password logins
(stored in Supabase, **not** your end-user accounts). The page is `noindex`.

---

## One-time setup (3 steps)

### 1. Create the database tables

In the **Supabase dashboard → SQL Editor → New query**, paste the contents of
[`supabase/admin-schema.sql`](supabase/admin-schema.sql) and click **Run**.

This creates two tables (`admin_users`, `app_config`) with Row-Level Security on
and **no public policies**, so only the server (service-role key) can read them.
It also seeds the current pricing (50 GHS/month, 500 free words/day).

### 2. Add two environment variables

Add these to **`.env.local`** (local dev) **and** to **Vercel → Project →
Settings → Environment Variables** (production):

| Variable | Where to get it |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → **API** → `service_role` secret. |
| `ADMIN_SESSION_SECRET` | Any long random string. One was generated into your local `.env.local` already. |

> ⚠️ **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or commit it.
> It bypasses all database security. It is only read by server routes under
> `app/api/admin/*` and `app/api/paystack/*`.

To generate a fresh session secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Deploy, then create the first admin

Redeploy so the new env vars take effect:

```bash
npx vercel --prod --yes
```

Then open **`/admin`**. On first run it shows a **"Create the first admin
account"** screen — pick a username and password. That first account is a full
**Admin**. Once it exists, the setup screen disappears and everyone signs in
normally. From the **Admins** tab you can create more accounts at any level.

---

## Roles

| Role | Can do |
| --- | --- |
| **Admin** | Everything: view users, enable/disable Premium, ban/unban, edit prices, manage admin accounts. |
| **Editor** | View everything **+ edit prices**. Cannot change Premium/ban or manage admins. |
| **Guest** | **View only.** No changes of any kind. |

Permissions are enforced **server-side** on every action, not just hidden in the
UI. A role change or a disabled account takes effect on the user's next request.

---

## What each tab does

- **Users** — search/filter all accounts; see plan, words used today, status, and
  join date. Admins can **Make/Remove Premium** and **Ban/Unban** each user.
- **Pricing** — edit the Premium monthly price and the free daily word limit.
  Saving updates new checkouts (Paystack is charged the new amount) and the
  price shown across the app within ~1 minute. Currency is fixed to your Paystack
  currency (GHS) to avoid breaking payments.
- **Admins** — create dashboard logins, assign roles, reset passwords, enable/
  disable, or delete. You can't delete/disable the **last** active admin or your
  own account (prevents lockout).

---

## Notes & safety

- **Manual Premium vs. Paystack:** When you turn Premium on/off from the
  dashboard, the app records an override so the automatic Paystack "restore"
  won't silently undo it. A user who later pays again is upgraded normally.
- **Banning** blocks sign-in entirely (the strongest lever). Removing Premium
  only moves the user to Free.
- If you open `/admin` before finishing setup, it shows a clear banner telling
  you which step is missing rather than erroring.

## Forgot the admin password / locked out?

Reset it directly in Supabase. Generate a hash locally (the lib is ESM):

```bash
node --input-type=module -e "import('./src/lib/admin/passwords.js').then(m => console.log(m.hashPassword('YOUR_NEW_PASSWORD')))"
```

then in the Supabase SQL editor:

```sql
update public.admin_users set password_hash = '<paste-hash>', disabled = false
where lower(username) = lower('your-username');
```

To start completely over, `delete from public.admin_users;` and reload `/admin`
to re-run first-time setup.
