'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── theme ──────────────────────────────────────────────────────────────────
const T = {
  bg: '#0b0d12',
  panel: 'rgba(255,255,255,0.04)',
  panel2: 'rgba(255,255,255,0.025)',
  border: 'rgba(168,199,250,0.12)',
  borderStrong: 'rgba(168,199,250,0.22)',
  t1: '#e7ebf5',
  t2: '#8e9dc2',
  t3: '#6b7a94',
  accent: '#7c9fff',
  accent2: '#8f5cff',
  green: '#4ade80',
  red: '#f87171',
  amber: '#fbbf24',
};

const PERM = {
  VIEW: 'view',
  EDIT_PRICING: 'edit_pricing',
  MANAGE_USERS: 'manage_users',
  MANAGE_ADMINS: 'manage_admins',
};

const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', guest: 'Guest' };
const ROLE_DESC = {
  admin: 'Full access — users, prices, and admin accounts.',
  editor: 'Can view everything and change prices only.',
  guest: 'View-only. Cannot make changes.',
};

// ─── api helper ─────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.setupError = data.setupError;
    throw err;
  }
  return data;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── primitives ─────────────────────────────────────────────────────────────
function Btn({ children, variant = 'default', size = 'md', style, ...props }) {
  const base = {
    fontFamily: 'inherit',
    fontWeight: 600,
    borderRadius: 10,
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'all .15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    opacity: props.disabled ? 0.55 : 1,
  };
  const sizes = {
    sm: { fontSize: 12, padding: '6px 10px' },
    md: { fontSize: 13, padding: '9px 14px' },
    lg: { fontSize: 14, padding: '12px 18px' },
  };
  const variants = {
    default: { background: 'rgba(255,255,255,0.06)', borderColor: T.border, color: T.t1 },
    primary: { background: 'linear-gradient(135deg,#5b76ff,#7c9fff)', color: '#fff', borderColor: 'rgba(124,159,255,0.5)' },
    ghost: { background: 'transparent', borderColor: T.border, color: T.t2 },
    danger: { background: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.35)', color: '#fca5a5' },
    success: { background: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.35)', color: '#86efac' },
  };
  return (
    <button className="hc-btn" style={{ ...base, ...sizes[size], ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.t2, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11, color: T.t3, marginTop: 5 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.25)',
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: '11px 13px',
  color: T.t1,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function Badge({ children, color = T.t2, bg, border }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        color,
        background: bg || 'rgba(255,255,255,0.05)',
        border: `1px solid ${border || T.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  const isErr = notice.type === 'error';
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        maxWidth: 'min(92vw, 460px)',
        background: isErr ? 'rgba(60,18,18,0.96)' : 'rgba(16,40,24,0.96)',
        border: `1px solid ${isErr ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)'}`,
        color: isErr ? '#fecaca' : '#bbf7d0',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18, lineHeight: 1, opacity: 0.7 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hc-modal"
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#12151d',
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: T.t1 }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ─── root page ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [phase, setPhase] = useState('loading'); // loading | bootstrap | login | ready | setup-error
  const [me, setMe] = useState(null);
  const [setupMsg, setSetupMsg] = useState('');
  const [notice, setNotice] = useState(null);

  const flash = useCallback((text, type = 'success') => {
    setNotice({ text, type });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const refreshSession = useCallback(async () => {
    try {
      const s = await api('/api/admin/session');
      setMe(s.admin);
      setPhase('ready');
      return true;
    } catch (e) {
      try {
        const b = await api('/api/admin/bootstrap');
        setPhase(b.needsBootstrap ? 'bootstrap' : 'login');
      } catch (be) {
        if (be.setupError) {
          setSetupMsg(be.message);
          setPhase('setup-error');
        } else {
          setPhase('login');
        }
      }
      return false;
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const onSignedIn = useCallback((admin) => {
    setMe(admin);
    setPhase('ready');
  }, []);

  const onSignOut = useCallback(async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch {}
    setMe(null);
    setPhase('login');
  }, []);

  // Treat a 401 from any data call as "session expired" → bounce to login.
  const onAuthLost = useCallback(() => {
    setMe(null);
    setPhase('login');
    flash('Your session expired. Please sign in again.', 'error');
  }, [flash]);

  return (
    <div className="hc-admin" style={{ minHeight: '100dvh', background: T.bg, color: T.t1, fontFamily: '"Roboto", Arial, sans-serif' }}>
      <style>{STYLES}</style>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {phase === 'loading' && <CenteredSpinner />}
      {phase === 'setup-error' && <SetupError message={setupMsg} onRetry={refreshSession} />}
      {phase === 'bootstrap' && <AuthCard mode="bootstrap" onSignedIn={onSignedIn} flash={flash} />}
      {phase === 'login' && <AuthCard mode="login" onSignedIn={onSignedIn} flash={flash} />}
      {phase === 'ready' && me && (
        <Dashboard me={me} onSignOut={onSignOut} flash={flash} onAuthLost={onAuthLost} />
      )}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div className="hc-spin" style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.accent }} />
    </div>
  );
}

function Brand({ subtitle }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <img src="/hc-icon.png" alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
        <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg,#e9edf7,#7fb1ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          HumanClarity
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: T.t2 }}>{subtitle}</p>
    </div>
  );
}

// ─── setup error screen ─────────────────────────────────────────────────────
function SetupError({ message, onRetry }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div style={{ width: '100%', maxWidth: 520, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 26 }}>
        <Brand subtitle="Admin dashboard setup" />
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#fde68a', fontWeight: 600 }}>Backend not configured yet</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: T.t2, lineHeight: 1.6 }}>{message || 'The admin backend can’t reach Supabase.'}</p>
        </div>
        <ol style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: T.t2, lineHeight: 1.8 }}>
          <li>Run <code style={codeStyle}>supabase/admin-schema.sql</code> in the Supabase SQL editor.</li>
          <li>Add <code style={codeStyle}>SUPABASE_SERVICE_ROLE_KEY</code> and <code style={codeStyle}>ADMIN_SESSION_SECRET</code> to your environment.</li>
          <li>Redeploy, then reload this page.</li>
        </ol>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: T.t3 }}>Full steps are in <code style={codeStyle}>ADMIN_SETUP.md</code>.</p>
        <Btn variant="primary" size="lg" style={{ width: '100%' }} onClick={onRetry}>Retry</Btn>
      </div>
    </div>
  );
}
const codeStyle = { background: 'rgba(124,159,255,0.12)', border: '1px solid rgba(124,159,255,0.2)', borderRadius: 5, padding: '1px 5px', fontSize: 11.5, color: '#bcd0ff' };

// ─── login / bootstrap ──────────────────────────────────────────────────────
function AuthCard({ mode, onSignedIn, flash }) {
  const isBootstrap = mode === 'bootstrap';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (isBootstrap && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const path = isBootstrap ? '/api/admin/bootstrap' : '/api/admin/login';
      const data = await api(path, { method: 'POST', body: JSON.stringify({ username, password }) });
      flash(isBootstrap ? 'Admin account created. Welcome!' : 'Signed in.');
      onSignedIn(data.admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div style={{ width: '100%', maxWidth: 400, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 26 }}>
        <Brand subtitle={isBootstrap ? 'Create the first admin account' : 'Sign in to the admin dashboard'} />
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <Field label="Username">
            <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. owner" />
          </Field>
          <Field label="Password" hint={isBootstrap ? 'At least 8 characters.' : undefined}>
            <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isBootstrap ? 'new-password' : 'current-password'} />
          </Field>
          {isBootstrap && (
            <Field label="Confirm password">
              <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
          )}
          {error && <p style={{ margin: 0, fontSize: 12.5, color: '#fca5a5' }}>{error}</p>}
          <Btn type="submit" variant="primary" size="lg" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'Please wait…' : isBootstrap ? 'Create admin & continue' : 'Sign in'}
          </Btn>
        </form>
        {isBootstrap && (
          <p style={{ margin: '16px 0 0', fontSize: 11.5, color: T.t3, lineHeight: 1.6, textAlign: 'center' }}>
            This is a one-time setup. The first account is a full admin and can create more accounts afterward.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── dashboard shell ────────────────────────────────────────────────────────
function Dashboard({ me, onSignOut, flash, onAuthLost }) {
  const [tab, setTab] = useState('users');
  const [openAppeals, setOpenAppeals] = useState(0);
  const can = (perm) => Array.isArray(me.permissions) && me.permissions.includes(perm);

  const loadAppealCount = useCallback(async () => {
    try {
      const res = await api('/api/admin/appeals');
      setOpenAppeals(res.counts?.open || 0);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadAppealCount();
  }, [loadAppealCount]);

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'admins', label: 'Admins' },
    { key: 'appeals', label: 'Appeals', badge: openAppeals },
  ];

  return (
    <div>
      <header className="hc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src="/hc-icon.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: T.t1 }}>Admin</span>
          <span className="hc-hide-sm" style={{ fontSize: 12, color: T.t3 }}>· HumanClarity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{me.username}</div>
            <div style={{ fontSize: 11, color: T.accent, fontWeight: 600 }}>{me.roleLabel || ROLE_LABELS[me.role]}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={onSignOut}>Sign out</Btn>
        </div>
      </header>

      <nav className="hc-tabs">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`hc-tab ${tab === t.key ? 'hc-tab-active' : ''}`}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 800, color: '#fff', background: T.red, borderRadius: 999, padding: '1px 7px' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="hc-main">
        {tab === 'users' && <UsersTab can={can} flash={flash} onAuthLost={onAuthLost} />}
        {tab === 'pricing' && <PricingTab can={can} flash={flash} onAuthLost={onAuthLost} />}
        {tab === 'admins' && <AdminsTab me={me} can={can} flash={flash} onAuthLost={onAuthLost} />}
        {tab === 'appeals' && <AppealsTab can={can} flash={flash} onAuthLost={onAuthLost} onChange={loadAppealCount} />}
      </main>
    </div>
  );
}

function handleErr(err, flash, onAuthLost) {
  if (err.status === 401) {
    onAuthLost();
    return;
  }
  flash(err.message || 'Something went wrong.', 'error');
}

// ─── stat cards ─────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ flex: '1 1 120px', background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || T.t1, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.t2, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─── users tab ──────────────────────────────────────────────────────────────
function UsersTab({ can, flash, onAuthLost }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('created_desc');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const canManage = can(PERM.MANAGE_USERS);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, filter, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: debounced, filter, sort, page: String(page), perPage: '25' });
      const res = await api(`/api/admin/users?${params}`);
      setData(res);
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setLoading(false);
    }
  }, [debounced, filter, sort, page, flash, onAuthLost]);

  useEffect(() => {
    load();
  }, [load]);

  async function doAction(user, kind) {
    setBusyId(user.id);
    try {
      if (kind === 'premium') {
        await api(`/api/admin/users/${user.id}/premium`, { method: 'POST', body: JSON.stringify({ enable: !user.isPremium }) });
        flash(`${user.email} is now ${!user.isPremium ? 'Premium' : 'Free'}.`);
      } else if (kind === 'ban') {
        await api(`/api/admin/users/${user.id}/ban`, { method: 'POST', body: JSON.stringify({ banned: !user.isBanned }) });
        flash(`${user.email} has been ${!user.isBanned ? 'banned' : 'unbanned'}.`);
      } else if (kind === 'confirm') {
        await api(`/api/admin/users/${user.id}/confirm-email`, { method: 'POST', body: JSON.stringify({}) });
        flash(`${user.email}'s email is now confirmed.`);
      }
      await load();
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setBusyId(null);
      setConfirmAction(null);
    }
  }

  const stats = data?.stats || { total: 0, premium: 0, banned: 0 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Total users" value={stats.total} />
        <Stat label="Premium" value={stats.premium} color={T.green} />
        <Stat label="Banned" value={stats.banned} color={T.red} />
      </div>

      <div className="hc-toolbar">
        <input
          style={{ ...inputStyle, flex: '2 1 200px' }}
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, flex: '1 1 120px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All plans</option>
          <option value="premium">Premium</option>
          <option value="free">Free</option>
          <option value="banned">Banned</option>
        </select>
        <select style={{ ...inputStyle, flex: '1 1 120px' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="recent_signin">Recent sign-in</option>
          <option value="email">Email A–Z</option>
        </select>
      </div>

      {!canManage && (
        <p style={{ fontSize: 12, color: T.t3, margin: '0 0 12px' }}>
          You have view-only access. Premium and ban controls require an Admin role.
        </p>
      )}

      {loading && !data ? (
        <SkeletonRows />
      ) : data && data.users.length === 0 ? (
        <Empty text="No users match your filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hc-table-wrap hc-hide-sm">
            <table className="hc-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Words today</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id} style={{ opacity: busyId === u.id ? 0.5 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: T.t1 }}>{u.email || '—'}</div>
                      {u.name && <div style={{ fontSize: 12, color: T.t3 }}>{u.name}</div>}
                    </td>
                    <td><PlanBadge user={u} /></td>
                    <td style={{ color: T.t2 }}>{u.isPremium ? '∞' : u.wordsUsed}</td>
                    <td><StatusBadge user={u} /></td>
                    <td style={{ color: T.t3, fontSize: 12.5 }}>{fmtDate(u.createdAt)}</td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <UserActions u={u} busy={busyId === u.id} onAction={(kind) => maybeConfirm(kind, u, setConfirmAction, doAction)} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="hc-cards hc-show-sm">
            {data?.users.map((u) => (
              <div key={u.id} className="hc-card" style={{ opacity: busyId === u.id ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: T.t1, wordBreak: 'break-word' }}>{u.email || '—'}</div>
                    {u.name && <div style={{ fontSize: 12, color: T.t3 }}>{u.name}</div>}
                  </div>
                  <PlanBadge user={u} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: T.t2 }}>
                  <StatusBadge user={u} />
                  <span>Words: {u.isPremium ? '∞' : u.wordsUsed}</span>
                  <span>Joined {fmtDate(u.createdAt)}</span>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <UserActions u={u} busy={busyId === u.id} onAction={(kind) => maybeConfirm(kind, u, setConfirmAction, doAction)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} onPage={setPage} total={data?.total || 0} />
        </>
      )}

      {confirmAction && (
        <Modal title={confirmAction.title} onClose={() => setConfirmAction(null)}>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: T.t2, lineHeight: 1.6 }}>{confirmAction.body}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" disabled={busyId === confirmAction.user.id} onClick={() => setConfirmAction(null)}>Cancel</Btn>
            <Btn
              variant={confirmAction.danger ? 'danger' : 'primary'}
              disabled={busyId === confirmAction.user.id}
              onClick={() => doAction(confirmAction.user, confirmAction.kind)}
            >
              {busyId === confirmAction.user.id ? 'Working…' : confirmAction.confirmLabel}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Ban + premium-disable get a confirm step; premium-enable is immediate.
function maybeConfirm(kind, u, setConfirmAction, doAction) {
  if (kind === 'ban' && !u.isBanned) {
    setConfirmAction({ kind, user: u, danger: true, title: 'Ban this user?', confirmLabel: 'Ban user', body: `${u.email} will be blocked from signing in until you unban them.` });
  } else if (kind === 'premium' && u.isPremium) {
    setConfirmAction({ kind, user: u, danger: true, title: 'Remove premium?', confirmLabel: 'Remove premium', body: `${u.email} will be moved back to the Free plan.` });
  } else {
    doAction(u, kind);
  }
}

function UserActions({ u, busy, onAction }) {
  return (
    <>
      <Btn size="sm" variant={u.isPremium ? 'default' : 'success'} disabled={busy} onClick={() => onAction('premium')}>
        {u.isPremium ? 'Remove Premium' : 'Make Premium'}
      </Btn>
      {!u.emailConfirmed && (
        <Btn size="sm" variant="default" disabled={busy} onClick={() => onAction('confirm')}>
          Confirm email
        </Btn>
      )}
      <Btn size="sm" variant={u.isBanned ? 'default' : 'danger'} disabled={busy} onClick={() => onAction('ban')}>
        {u.isBanned ? 'Unban' : 'Ban'}
      </Btn>
    </>
  );
}

function PlanBadge({ user }) {
  return user.isPremium ? (
    <Badge color="#c4b5fd" bg="rgba(143,92,255,0.12)" border="rgba(143,92,255,0.35)">★ Premium</Badge>
  ) : (
    <Badge>Free</Badge>
  );
}

function StatusBadge({ user }) {
  if (user.isBanned) return <Badge color="#fca5a5" bg="rgba(248,113,113,0.12)" border="rgba(248,113,113,0.35)">Banned</Badge>;
  if (!user.emailConfirmed) return <Badge color="#fde68a" bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.3)">Unconfirmed</Badge>;
  return <Badge color="#86efac" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.3)">Active</Badge>;
}

function Pagination({ page, totalPages, onPage, total }) {
  if (totalPages <= 1) return <p style={{ fontSize: 12, color: T.t3, marginTop: 14 }}>{total} {total === 1 ? 'user' : 'users'}</p>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: T.t3 }}>{total} users · page {page} of {totalPages}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</Btn>
        <Btn size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next ›</Btn>
      </div>
    </div>
  );
}

// ─── pricing tab ────────────────────────────────────────────────────────────
function PricingTab({ can, flash, onAuthLost }) {
  const [pricing, setPricing] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = can(PERM.EDIT_PRICING);

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/admin/pricing');
        setPricing(res.pricing);
        setForm(res.pricing);
      } catch (err) {
        handleErr(err, flash, onAuthLost);
      } finally {
        setLoading(false);
      }
    })();
  }, [flash, onAuthLost]);

  const dirty = useMemo(() => form && pricing && JSON.stringify(form) !== JSON.stringify(pricing), [form, pricing]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api('/api/admin/pricing', { method: 'PUT', body: JSON.stringify(form) });
      setPricing(res.pricing);
      setForm(res.pricing);
      flash('Pricing updated. New checkouts use the new price.');
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonRows />;
  if (!form) return <Empty text="Could not load pricing." />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionHead title="Subscription pricing" subtitle="Controls the Premium price shown in the app and charged at checkout." />
      {!canEdit && <p style={{ fontSize: 12, color: T.t3, margin: '0 0 12px' }}>You have view-only access to pricing.</p>}

      <form onSubmit={save} style={{ display: 'grid', gap: 16, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
        <Field label={`Premium price (${form.currency})`} hint="Monthly price charged via Paystack.">
          <input style={inputStyle} type="number" min="0" step="0.01" disabled={!canEdit} value={form.proPriceGhs} onChange={(e) => set('proPriceGhs', e.target.value)} />
        </Field>
        <Field label="Approx. USD price" hint="Shown as a reference only — does not affect billing.">
          <input style={inputStyle} type="number" min="0" step="0.01" disabled={!canEdit} value={form.proPriceUsdEstimate} onChange={(e) => set('proPriceUsdEstimate', e.target.value)} />
        </Field>
        <Field label="Free daily word limit" hint="Words a free user can humanize per day.">
          <input style={inputStyle} type="number" min="0" step="1" disabled={!canEdit} value={form.freeWordLimit} onChange={(e) => set('freeWordLimit', e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <Field label="Billing period">
              <input style={inputStyle} disabled={!canEdit} value={form.billingPeriod} onChange={(e) => set('billingPeriod', e.target.value)} />
            </Field>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <Field label="Currency" hint="Must match your Paystack account.">
              <input style={{ ...inputStyle, opacity: 0.6 }} value={form.currency} readOnly />
            </Field>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn type="submit" variant="primary" size="lg" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save pricing'}</Btn>
            {dirty && <span style={{ fontSize: 12, color: T.amber }}>Unsaved changes</span>}
          </div>
        )}
      </form>

      <div style={{ marginTop: 16, background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: T.t2, lineHeight: 1.6 }}>
          <strong style={{ color: T.t1 }}>Live preview:</strong> Premium shows as{' '}
          <strong style={{ color: T.accent }}>{Number(form.proPriceGhs).toLocaleString()} {form.currency}/{form.billingPeriod}</strong>
          {' '}and free users get <strong style={{ color: T.accent }}>{Number(form.freeWordLimit).toLocaleString()}</strong> words/day.
        </p>
      </div>
    </div>
  );
}

// ─── admins tab ─────────────────────────────────────────────────────────────
function AdminsTab({ me, can, flash, onAuthLost }) {
  const [admins, setAdmins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const canManage = can(PERM.MANAGE_ADMINS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/admin/admins');
      setAdmins(res.admins);
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setLoading(false);
    }
  }, [flash, onAuthLost]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(admin) {
    try {
      await api(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });
      flash(`Removed ${admin.username}.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <SectionHead title="Admin accounts" subtitle="Dashboard logins and their access levels." noMargin />
        {canManage && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ New admin</Btn>}
      </div>

      <RoleLegend />

      {loading ? (
        <SkeletonRows />
      ) : (
        <div className="hc-cards" style={{ marginTop: 14 }}>
          {admins?.map((a) => (
            <div key={a.id} className="hc-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: T.t1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {a.username}
                    {a.id === me.id && <Badge color={T.accent}>You</Badge>}
                    {a.disabled && <Badge color="#fca5a5" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.3)">Disabled</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
                    Created {fmtDate(a.created_at)} · Last login {fmtDateTime(a.last_login_at)}
                  </div>
                </div>
                <RoleBadge role={a.role} />
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => setEditing(a)}>Edit</Btn>
                  {a.id !== me.id && (
                    <Btn size="sm" variant="danger" onClick={() => setConfirmDelete(a)}>Delete</Btn>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <AdminFormModal
          title="New admin account"
          onClose={() => setShowCreate(false)}
          onSubmit={async (payload) => {
            await api('/api/admin/admins', { method: 'POST', body: JSON.stringify(payload) });
            flash(`Created ${payload.username}.`);
            setShowCreate(false);
            await load();
          }}
          flash={flash}
          onAuthLost={onAuthLost}
        />
      )}

      {editing && (
        <AdminFormModal
          title={`Edit ${editing.username}`}
          editing={editing}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            await api(`/api/admin/admins/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
            flash(`Updated ${editing.username}.`);
            setEditing(null);
            await load();
          }}
          flash={flash}
          onAuthLost={onAuthLost}
        />
      )}

      {confirmDelete && (
        <Modal title={`Delete ${confirmDelete.username}?`} onClose={() => setConfirmDelete(null)}>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: T.t2, lineHeight: 1.6 }}>
            This permanently removes the admin login <strong>{confirmDelete.username}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => remove(confirmDelete)}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminFormModal({ title, editing, isSelf, onClose, onSubmit, flash, onAuthLost }) {
  const [username, setUsername] = useState(editing?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(editing?.role || 'guest');
  const [disabled, setDisabled] = useState(editing?.disabled || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(editing);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = isEdit
        ? { role, disabled, ...(password ? { password } : {}) }
        : { username, password, role };
      await onSubmit(payload);
    } catch (err) {
      if (err.status === 401) {
        onAuthLost();
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        {!isEdit && (
          <Field label="Username">
            <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} />
          </Field>
        )}
        <Field label={isEdit ? 'New password' : 'Password'} hint={isEdit ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Role" hint={ROLE_DESC[role]}>
          <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="guest">Guest</option>
          </select>
        </Field>
        {isSelf && <p style={{ margin: 0, fontSize: 11.5, color: T.t3 }}>You can’t change your own role or disable yourself.</p>}
        {isEdit && !isSelf && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: T.t2, cursor: 'pointer' }}>
            <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} style={{ width: 16, height: 16 }} />
            Disable this account (blocks sign-in)
          </label>
        )}
        {error && <p style={{ margin: 0, fontSize: 12.5, color: '#fca5a5' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create admin'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function RoleBadge({ role }) {
  const map = {
    admin: { color: '#c4b5fd', bg: 'rgba(143,92,255,0.12)', border: 'rgba(143,92,255,0.35)' },
    editor: { color: '#7fb1ff', bg: 'rgba(124,159,255,0.12)', border: 'rgba(124,159,255,0.35)' },
    guest: { color: T.t2, bg: 'rgba(255,255,255,0.05)', border: T.border },
  };
  const s = map[role] || map.guest;
  return <Badge color={s.color} bg={s.bg} border={s.border}>{ROLE_LABELS[role] || role}</Badge>;
}

function RoleLegend() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {['admin', 'editor', 'guest'].map((r) => (
        <div key={r} style={{ flex: '1 1 180px', background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px' }}>
          <RoleBadge role={r} />
          <p style={{ margin: '7px 0 0', fontSize: 11.5, color: T.t3, lineHeight: 1.5 }}>{ROLE_DESC[r]}</p>
        </div>
      ))}
    </div>
  );
}

// ─── appeals tab ────────────────────────────────────────────────────────────
function AppealStatusBadge({ status }) {
  if (status === 'resolved') return <Badge color="#86efac" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.3)">Resolved</Badge>;
  if (status === 'dismissed') return <Badge color={T.t2}>Dismissed</Badge>;
  return <Badge color="#fde68a" bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.3)">Open</Badge>;
}

function AppealsTab({ can, flash, onAuthLost, onChange }) {
  const [appeals, setAppeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open'); // open | all
  const [busyId, setBusyId] = useState(null);
  const canManage = can(PERM.MANAGE_USERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/admin/appeals');
      setAppeals(res.appeals || []);
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setLoading(false);
    }
  }, [flash, onAuthLost]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(appeal, unban) {
    setBusyId(appeal.id);
    try {
      await api(`/api/admin/appeals/${appeal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: unban ? 'resolved' : 'dismissed', unban }),
      });
      flash(unban ? `Unbanned ${appeal.email} and resolved the appeal.` : `Dismissed appeal from ${appeal.email}.`);
      await load();
      onChange?.();
    } catch (err) {
      handleErr(err, flash, onAuthLost);
    } finally {
      setBusyId(null);
    }
  }

  const all = appeals || [];
  const openCount = all.filter((a) => a.status === 'open').length;
  const shown = all.filter((a) => (filter === 'all' ? true : a.status === 'open'));

  return (
    <div style={{ maxWidth: 760 }}>
      <SectionHead title="Ban appeals" subtitle="Requests from banned users asking to be reinstated." />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Open appeals" value={openCount} color={openCount ? T.amber : T.t1} />
        <Stat label="Total" value={all.length} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['open', 'Open'], ['all', 'All']].map(([key, label]) => (
          <Btn key={key} size="sm" variant={filter === key ? 'primary' : 'ghost'} onClick={() => setFilter(key)}>{label}</Btn>
        ))}
      </div>

      {!canManage && (
        <p style={{ fontSize: 12, color: T.t3, margin: '0 0 12px' }}>View-only. Unban/dismiss requires an Admin role.</p>
      )}

      {loading ? (
        <SkeletonRows />
      ) : shown.length === 0 ? (
        <Empty text={filter === 'open' ? 'No open appeals.' : 'No appeals yet.'} />
      ) : (
        <div className="hc-cards">
          {shown.map((a) => (
            <div key={a.id} className="hc-card" style={{ opacity: busyId === a.id ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: T.t1, wordBreak: 'break-word' }}>{a.email}</div>
                  <div style={{ fontSize: 12, color: T.t3, marginTop: 3 }}>{fmtDateTime(a.created_at)}</div>
                </div>
                <AppealStatusBadge status={a.status} />
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: T.t2, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.message}</p>
              {a.status !== 'open' && (
                <p style={{ margin: '8px 0 0', fontSize: 11.5, color: T.t3 }}>
                  {a.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                  {a.resolved_by ? ` by ${a.resolved_by}` : ''}
                  {a.resolved_at ? ` · ${fmtDateTime(a.resolved_at)}` : ''}
                </p>
              )}
              {canManage && a.status === 'open' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <Btn size="sm" variant="success" disabled={busyId === a.id} onClick={() => act(a, true)}>Unban &amp; resolve</Btn>
                  <Btn size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a, false)}>Dismiss</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── small shared ───────────────────────────────────────────────────────────
function SectionHead({ title, subtitle, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.t1 }}>{title}</h2>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: T.t2 }}>{subtitle}</p>}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: T.t3, fontSize: 14, background: T.panel2, border: `1px dashed ${T.border}`, borderRadius: 14 }}>
      {text}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="hc-skel" style={{ height: 64, borderRadius: 12 }} />
      ))}
    </div>
  );
}

// ─── styles (responsive) ────────────────────────────────────────────────────
const STYLES = `
.hc-admin * { box-sizing: border-box; }
.hc-admin select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e9dc2' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
.hc-btn:hover:not(:disabled) { filter: brightness(1.12); }
.hc-btn:active:not(:disabled) { transform: translateY(1px); }
.hc-admin input:focus, .hc-admin select:focus { border-color: ${T.accent}; box-shadow: 0 0 0 3px rgba(124,159,255,0.15); }

.hc-header { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; background: rgba(11,13,18,0.9); backdrop-filter: blur(10px); border-bottom: 1px solid ${T.border}; }
.hc-tabs { position: sticky; top: 53px; z-index: 20; display: flex; gap: 4px; padding: 8px 14px; background: rgba(11,13,18,0.88); backdrop-filter: blur(10px); border-bottom: 1px solid ${T.border}; overflow-x: auto; }
.hc-tab { flex: 0 0 auto; background: transparent; border: none; color: ${T.t2}; font-family: inherit; font-size: 14px; font-weight: 600; padding: 9px 16px; border-radius: 9px; cursor: pointer; transition: all .15s; }
.hc-tab:hover { color: ${T.t1}; background: rgba(255,255,255,0.04); }
.hc-tab-active { color: #fff; background: rgba(124,159,255,0.16); }
.hc-main { max-width: 1080px; margin: 0 auto; padding: 20px 18px 64px; }

.hc-toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }

.hc-table-wrap { overflow-x: auto; border: 1px solid ${T.border}; border-radius: 14px; background: ${T.panel}; }
.hc-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.hc-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${T.t3}; font-weight: 700; padding: 12px 14px; border-bottom: 1px solid ${T.border}; white-space: nowrap; }
.hc-table td { padding: 12px 14px; border-bottom: 1px solid rgba(168,199,250,0.06); vertical-align: middle; }
.hc-table tr:last-child td { border-bottom: none; }
.hc-table tbody tr:hover { background: rgba(255,255,255,0.02); }

.hc-cards { display: grid; gap: 10px; }
.hc-card { background: ${T.panel}; border: 1px solid ${T.border}; border-radius: 12px; padding: 14px; }

.hc-skel { background: linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.07), rgba(255,255,255,0.03)); background-size: 200% 100%; animation: hc-shimmer 1.3s infinite; }
@keyframes hc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.hc-spin { animation: hc-rot 0.7s linear infinite; }
@keyframes hc-rot { to { transform: rotate(360deg); } }

.hc-show-sm { display: none; }
@media (max-width: 720px) {
  .hc-hide-sm { display: none !important; }
  .hc-show-sm { display: grid !important; }
  .hc-main { padding: 16px 12px 56px; }
  .hc-header { padding: 11px 14px; }
}
`;
