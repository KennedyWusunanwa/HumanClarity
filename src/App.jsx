'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';
import { quickEmailCheck, emailErrorMessage } from '@/lib/email-validation';

// ─── helpers ──────────────────────────────────────────────────────────────────

const ACTION_LABEL = {
  humanize:    'Humanized Text',
  summarize:   'Summarized Article',
  expand:      'Expanded Draft',
  fix_grammar: 'Grammar Fixed',
};

const FREE_WORD_LIMIT = 500;
const PRO_PRICE_GHS = 50;
const PRO_PRICE_USD_ESTIMATE = 4.44;
const DEFAULT_PROFILE = { name: '', email: '' };
const DEFAULT_SUBSCRIPTION = {
  tier: 'free',
  wordsUsed: 0,
  usageDate: '',
  lastPaymentReference: '',
  upgradedAt: '',
  paymentStatus: 'inactive',
};
const EMPTY_APP_STATE = {
  profile: DEFAULT_PROFILE,
  history: [],
  saved: [],
  subscription: DEFAULT_SUBSCRIPTION,
};

function wc(t) { return t ? t.trim().split(/\s+/).filter(Boolean).length : 0; }
function initials(n) { return n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'HC'; }

function reltime(iso) {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diff < 172800000) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function fmtNum(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function normalizeAuthErrorMessage(error) {
  const msg = error?.message || 'Authentication failed.';
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || error?.error_code || '').toLowerCase();
  const full = `${code} ${msg}`.toLowerCase();

  if (/confirm|verified|verification/i.test(msg)) {
    return 'Your email is not confirmed yet. Use "Resend confirmation email" if needed.';
  }

  if (
    status === 429 ||
    /rate.limit|too many|limit reached|over_email_send_rate_limit|email rate limit|email link is invalid or has expired/.test(full)
  ) {
    return 'Signup email limit reached. Please wait and try again shortly. If this keeps happening, the Supabase project email rate limit needs to be increased or moved to custom SMTP.';
  }

  return msg;
}
function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length === 0) return { score: 0, label: 'Enter a password', color: '#8e918f' };
  if (score <= 1) return { score: 1, label: 'Weak', color: '#f87171' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#fbbf24' };
  if (score === 3) return { score: 3, label: 'Good', color: '#60a5fa' };
  return { score: 4, label: 'Strong', color: '#34d399' };
}
// Local-date key (YYYY-MM-DD) used to scope the free quota to a single day.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Words counted toward today's free quota. Usage from a previous day doesn't count —
// the free tier is 500 words per day, not a one-time cap.
function usageToday(subscription) {
  if (!subscription || subscription.usageDate !== todayKey()) return 0;
  return Number(subscription.wordsUsed || 0);
}

function wordsRemaining(subscription) {
  if (subscription.tier === 'pro') return Infinity;
  return Math.max(0, FREE_WORD_LIMIT - usageToday(subscription));
}
function planLabel(subscription) {
  if (subscription.tier === 'pro') return 'Premium';
  return 'Free';
}
function buildPersistedState(profile, history, saved, subscription) {
  return {
    profile: {
      name: profile.name || '',
      email: profile.email || '',
    },
    history: Array.isArray(history) ? history.slice(0, 40) : [],
    saved: Array.isArray(saved) ? saved.slice(0, 40) : [],
    subscription: {
      ...DEFAULT_SUBSCRIPTION,
      ...subscription,
      wordsUsed: Number(subscription?.wordsUsed || 0),
      usageDate: subscription?.usageDate || '',
    },
  };
}
function normalizeUserState(user) {
  if (!user) return EMPTY_APP_STATE;

  const metadata = user.user_metadata || {};
  const appState = metadata.app_state || {};
  const rawProfile = appState.profile || {};
  const rawSubscription = appState.subscription || {};

  return {
    profile: {
      name:
        rawProfile.name ||
        metadata.display_name ||
        metadata.name ||
        '',
      email: user.email || rawProfile.email || '',
    },
    history: Array.isArray(appState.history) ? appState.history : [],
    saved: Array.isArray(appState.saved) ? appState.saved : [],
    subscription: {
      ...DEFAULT_SUBSCRIPTION,
      ...rawSubscription,
      tier: rawSubscription.tier || metadata.plan || 'free',
      wordsUsed: Number(rawSubscription.wordsUsed ?? metadata.usage_words ?? 0),
      usageDate: rawSubscription.usageDate || '',
    },
  };
}

const UPLOAD_ACCEPT =
  '.txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ─── icon ─────────────────────────────────────────────────────────────────────

function Ic({ d, s = 20, fill = false }) {
  if (typeof d === 'string' && !d.startsWith('M')) {
    return (
      <span
        className="material-symbols-outlined"
        style={{ fontSize: s, fontVariationSettings: `"FILL" ${fill ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" ${Math.max(20, Math.min(48, s))}` }}
        aria-hidden="true"
      >
        {d}
      </span>
    );
  }

  return (
    <svg width={s} height={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const P = {
  pen:      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  grid:     'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  clock:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  gear:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM12 15a3 3 0 100-6 3 3 0 000 6z',
  sun:      'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z',
  moon:     'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  upload:   'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  copy:     'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  check:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  signout:  'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  doc:      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  arrow:    'M17 8l4 4m0 0l-4 4m4-4H3',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  star:     'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  save:     'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  menu:     'M4 6h16M4 12h16M4 18h16',
  spark:    'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z',
  check2:   'M5 13l4 4L19 7',
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  shield:   'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  user:     'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  mail:     'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  close:    'M6 18L18 6M6 6l12 12',
  eye:      'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff:   'M13.875 18.825A10.05 10.05 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22',
  premium:  'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  swap:     'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  thumbUp:  'M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3',
  thumbDown:'M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17',
  add:      'M12 5v14m-7-7h14',
};
// ─── particle canvas ──────────────────────────────────────────────────────────

function ParticleCanvas({ count = 70, isDark = true, speed = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, raf;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W;
      canvas.height = H;
    };
    resize();

    const pts = Array.from({ length: count }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.38 * speed,
      vy: (Math.random() - 0.5) * 0.38 * speed,
      r:  Math.random() * 1.4 + 0.4,
      o:  Math.random() * 0.45 + 0.18,
    }));

    const lineRGB = '168,199,250';
    const dotRGB  = isDark ? '66,133,244' : '168,199,250';
    const lineA   = isDark ? 0.22 : 0.1;
    const dotA    = isDark ? 1    : 0.5;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(${lineRGB},${(1 - d / 140) * lineA})`;
            ctx.lineWidth   = 0.6;
            ctx.stroke();
          }
        }
      }
      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotRGB},${p.o * dotA})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [count, isDark, speed]);

  return (
    <canvas ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
  );
}

function DetectionPreview({ compact = false }) {
  const [progress, setProgress] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    let raf;
    const duration = 1800;
    let startTime = null;

    const tick = (now) => {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2.8);
      setProgress(Math.round(eased * 97));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const delay = setTimeout(() => { raf = requestAnimationFrame(tick); }, 350);
    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (progress >= 20) setVisibleLines(v => Math.max(v, 1));
    if (progress >= 52) setVisibleLines(v => Math.max(v, 2));
    if (progress >= 78) setVisibleLines(v => Math.max(v, 3));
  }, [progress]);

  const deg = (progress / 100) * 360;
  const sz = compact ? 84 : 92;
  const innerSz = compact ? 60 : 66;
  const hl = (text) => (
    <span style={{ background: 'rgba(52,211,153,0.18)', color: '#6ee7b7', borderRadius: 4, padding: '1px 5px' }}>{text}</span>
  );

  const lines = [
    <span>Regular movement helps your brain <b style={{ fontWeight: 500 }}>{hl('stay sharp')}</b> over time.</span>,
    <span>It {hl('strengthens memory')}, {hl('supports focus')}, and reduces strain from long sedentary stretches.</span>,
    <span>Light exercise {hl('improves mood')} and weekly cardio boosts {hl('long-term cognitive health')}.</span>,
  ];

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: compact ? 18 : 22,
      border: '1px solid rgba(168,199,250,0.12)',
      background: 'linear-gradient(155deg, rgba(13,17,32,0.99), rgba(8,10,18,0.99))',
    }}>
      <div style={{ position: 'absolute', top: -50, left: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,199,250,0.1), transparent 70%)', filter: 'blur(28px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: compact ? '18px 18px 16px' : '20px 20px 18px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px rgba(34,197,94,0.45)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#7eb8f7' }}>Deep Scan</span>
          </div>
          <div style={{
            padding: '3px 9px', borderRadius: 999,
            background: 'rgba(52,211,153,0.09)', border: '1px solid rgba(52,211,153,0.2)',
            color: '#4ade80', fontSize: 10, fontWeight: 700,
            opacity: progress >= 88 ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}>
            Human ✓
          </div>
        </div>

        <div style={{
          borderRadius: 12, border: '1px solid rgba(168,199,250,0.08)',
          background: 'rgba(255,255,255,0.02)', padding: compact ? 12 : 14, marginBottom: 16,
          fontSize: compact ? 12.5 : 13, lineHeight: 1.8, color: '#b8c8e0',
        }}>
          {lines.map((line, i) => (
            <span key={i} style={{
              display: 'block',
              marginBottom: i < lines.length - 1 ? 5 : 0,
              opacity: visibleLines > i ? 1 : 0,
              transform: visibleLines > i ? 'translateY(0)' : 'translateY(5px)',
              transition: 'opacity 0.55s ease, transform 0.55s ease',
            }}>
              {line}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `${sz + 10}px 1fr`, gap: 14, alignItems: 'center' }}>
          <div style={{
            width: sz, height: sz, borderRadius: '50%', margin: '0 auto',
            display: 'grid', placeItems: 'center',
            background: `conic-gradient(#22c55e 0deg ${deg}deg, rgba(255,255,255,0.05) ${deg}deg 360deg)`,
          }}>
            <div style={{
              width: innerSz, height: innerSz, borderRadius: '50%',
              background: 'rgba(9,11,19,0.98)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4ade80', fontWeight: 800,
              fontSize: compact ? 18 : 20,
              fontFamily: '"Roboto", Arial, sans-serif',
              letterSpacing: '-0.02em',
            }}>
              {progress}%
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 4px', color: '#4ade80', fontSize: compact ? 20 : 24, fontWeight: 800, fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1 }}>
              {progress}% Human
            </p>
            <p style={{ margin: '0 0 10px', color: '#6b7a94', fontSize: compact ? 11.5 : 12.5, lineHeight: 1.55 }}>
              Natural phrasing preserved. Meaning intact.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 9px', borderRadius: 999,
              background: 'rgba(168,199,250,0.06)', border: '1px solid rgba(168,199,250,0.14)',
              color: '#7eb8f7', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: progress >= 88 ? 1 : 0,
              transition: 'opacity 0.5s ease 0.15s',
            }}>
              Looks natural
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function TopProgress({ active = false }) {
  if (!active) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 260, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        className="top-progress-bar"
        style={{
          width: '38%',
          height: '100%',
          background: 'linear-gradient(90deg, rgba(168,199,250,0), rgba(168,199,250,0.95), rgba(211,227,253,0.95), rgba(168,199,250,0))',
          boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
        }}
      />
    </div>
  );
}

const HUMANIZER_STATUS_PHRASES = [
  'Thinking',
  'Reading your text',
  'Reasoning through it',
  'Putting things together',
  'Polishing the prose',
  'Smoothing rough edges',
  'Adding a human touch',
  'Refining word choices',
  'Reviewing the result',
  'Almost there',
];

function HumanizerOutputLoader({ isPhone = false }) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex(i => (i + 1) % HUMANIZER_STATUS_PHRASES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const widths = [92, 78, 96, 64, 88, 72, 84, 56];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#cdd9ff' }}>
        <span
          className="spin-soft"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid rgba(126,151,255,0.25)',
            borderTopColor: '#9ec1ff',
            flexShrink: 0,
          }}
        />
        <span
          key={phraseIndex}
          className="hc-status-phrase"
          style={{ fontSize: isPhone ? 14 : 15, fontWeight: 700, letterSpacing: 0.1 }}
        >
          {HUMANIZER_STATUS_PHRASES[phraseIndex]}…
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.95 }}>
        {widths.map((w, i) => (
          <span
            key={i}
            className="hc-skeleton-bar"
            style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingOverlay({ open = false, message = 'Loading...' }) {
  if (!open) return null;

  return (
    <div
      className="page-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,7,18,0.48)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="surface-fade"
        style={{
          minWidth: 220,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          borderRadius: 18,
          background: 'rgba(10,14,34,0.88)',
          border: '1px solid rgba(168,199,250,0.24)',
          color: '#e3e3e3',
          boxShadow: '0 12px 28px rgba(0,0,0,0.32)',
        }}
      >
        <span
          className="spin-soft"
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid rgba(168,199,250,0.18)',
            borderTopColor: '#d3e3fd',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{message}</span>
      </div>
    </div>
  );
}

// ─── sign-in modal ────────────────────────────────────────────────────────────

function SignInModal({
  onClose,
  onAuth,
  mode = 'signin',
  onModeChange,
  loading = false,
  error = '',
  message = '',
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight));
  const strength = useMemo(() => passwordStrength(password), [password]);
  const isTablet = viewportWidth <= 920;
  const isPhone = viewportWidth <= 640;
  const isNarrowPhone = viewportWidth <= 380;
  const isCompactHeight = viewportHeight <= 520;
  const showPreview = !isPhone && !isCompactHeight;
  const isStacked = isTablet || !showPreview;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setLocalError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');

    if (mode === 'signup' && !name.trim()) {
      setLocalError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email.');
      return;
    }
    if (!password.trim()) {
      setLocalError('Please enter your password.');
      return;
    }
    if (password.trim().length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    onAuth({
      mode,
      name: name.trim(),
      email: email.trim(),
      password,
    });
  }

  async function handleResendConfirmation() {
    if (!email.trim()) {
      setLocalError('Enter your email first so the confirmation can be resent.');
      return;
    }

    setResendLoading(true);
    setLocalError('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (resendError) throw resendError;
      onModeChange('signin');
    } catch (err) {
      setLocalError(normalizeAuthErrorMessage(err));
    } finally {
      setResendLoading(false);
    }
  }

  const inp = {
    width: '100%', padding: '13px 14px', borderRadius: 12,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(168,199,250,0.2)',
    color: '#e3e3e3', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  };
  const eyeBtn = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(168,199,250,0.16)',
    background: 'rgba(255,255,255,0.06)', color: '#d3e3fd', cursor: 'pointer',
  };
  const showStrengthMeter = mode === 'signup';
  const fullSpan = mode === 'signup' ? { gridColumn: '1 / -1' } : null;
  const overlayPadding = isNarrowPhone ? 8 : isTablet ? 12 : 16;
  const shellRadius = isNarrowPhone ? 20 : isPhone ? 22 : isTablet ? 24 : 30;
  const mainPadding = isNarrowPhone ? '18px 14px 16px' : isPhone ? '22px 16px 18px' : isTablet ? '26px 22px 22px' : '32px 30px 28px';
  const previewPadding = isTablet ? '18px 18px 22px' : '24px';
  const formColumns = mode === 'signup' ? (isPhone ? '1fr' : 'repeat(2, minmax(0, 1fr))') : '1fr';
  const titleSize = isNarrowPhone ? 'clamp(1.8rem, 10vw, 2.15rem)' : isPhone ? 'clamp(2rem, 9vw, 2.4rem)' : 'clamp(30px, 4.3vw, 40px)';
  const subtitleSize = isPhone ? 13 : 14;
  const shellHeight = isTablet || isCompactHeight ? `calc(100dvh - ${overlayPadding * 2}px)` : 'auto';

  return (
    <div
      className="auth-modal-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: isTablet ? 'flex-start' : 'center', justifyContent: 'center', background: 'rgba(5,7,16,0.82)', backdropFilter: 'blur(18px)', padding: overlayPadding, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="page-fade surface-fade auth-modal-shell" style={{ width: `min(1120px, calc(100vw - ${overlayPadding * 2}px))`, maxHeight: `calc(100dvh - ${overlayPadding * 2}px)`, height: shellHeight, background: 'linear-gradient(145deg, rgba(15,19,38,0.97) 0%, rgba(10,11,15,0.98) 100%)', border: '1px solid rgba(168,199,250,0.22)', borderRadius: shellRadius, position: 'relative', boxShadow: '0 30px 70px rgba(0,0,0,0.62)', overflow: 'hidden' }}>
        <div className="auth-modal-glow auth-modal-glow-top" style={{ position: 'absolute', top: -80, left: isPhone ? -40 : '18%', width: isPhone ? 220 : 340, height: isPhone ? 220 : 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,199,250,0.28), transparent 70%)', filter: 'blur(48px)', pointerEvents: 'none', opacity: isPhone ? 0.7 : 1 }} />
        <div className="auth-modal-glow auth-modal-glow-bottom" style={{ position: 'absolute', bottom: -110, right: isPhone ? -60 : '10%', width: isPhone ? 240 : 360, height: isPhone ? 240 : 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(66,133,244,0.22), transparent 72%)', filter: 'blur(60px)', pointerEvents: 'none', opacity: isPhone ? 0.7 : 1 }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: shellRadius, backgroundImage: 'radial-gradient(circle, rgba(168,199,250,0.09) 1px, transparent 1px)', backgroundSize: '30px 30px', pointerEvents: 'none', opacity: 0.75 }} />

        <button onClick={onClose} className="auth-modal-close" style={{ position: 'absolute', top: isPhone ? 12 : 18, right: isPhone ? 12 : 18, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#8e918f', cursor: 'pointer', zIndex: 2 }}>
          <Ic d={P.close} s={14} />
        </button>

        <div className="auth-modal-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: isStacked ? 'minmax(0, 1fr)' : 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', alignItems: 'stretch', minHeight: 0, height: '100%' }}>
          <div className="auth-modal-main" style={{ padding: mainPadding, borderRight: isStacked ? 'none' : '1px solid rgba(168,199,250,0.12)', minWidth: 0, overflowY: 'auto', minHeight: 0, height: '100%' }}>
            {!isPhone && (
              <button onClick={onClose} className="auth-modal-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22, padding: 0, background: 'transparent', border: 'none', color: '#8e918f', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Ic d={P.arrow} s={14} /> Back to home
              </button>
            )}

            <div className="auth-modal-brand" style={{ display: 'flex', alignItems: 'center', gap: isPhone ? 10 : 12, marginBottom: isPhone ? 12 : 14 }}>
              <img src="/hc-icon.png" alt="" className="auth-modal-brand-icon" style={{ width: isPhone ? 36 : 42, height: isPhone ? 36 : 42, objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(168,199,250,0.3))' }} />
              <div>
                <p style={{ margin: 0, color: '#e3e3e3', fontWeight: 700, fontSize: 16, fontFamily: '"Roboto", Arial, sans-serif' }}>HumanClarity AI</p>
                <p style={{ margin: '2px 0 0', color: '#a8c7fa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Natural writing, fast</p>
              </div>
            </div>

            <div className="auth-modal-copy" style={{ marginBottom: isPhone ? 16 : 18 }}>
              <h2 className="auth-modal-title" style={{ fontSize: titleSize, fontWeight: 700, color: '#e3e3e3', fontFamily: '"Roboto", Arial, sans-serif', margin: '0 0 8px', letterSpacing: 0, lineHeight: isPhone ? 0.98 : 1.02 }}>
                {mode === 'signup' ? 'Create your HumanClarity space' : 'Sign in to your account'}
              </h2>
              <p className="auth-modal-subtitle" style={{ fontSize: subtitleSize, color: '#8e918f', margin: 0, lineHeight: isPhone ? 1.55 : 1.6, maxWidth: 480 }}>
                {mode === 'signup'
                  ? 'Create an account to save documents, track usage, and unlock upgrades from the dashboard.'
                  : 'Sign in to continue reviewing, saving, and refining your writing.'}
              </p>
            </div>

            <form className={`auth-modal-form ${mode === 'signup' ? 'is-signup' : 'is-signin'}`} onSubmit={handleSubmit} style={{ display: 'grid', gap: isPhone ? 12 : 10, gridTemplateColumns: formColumns }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#8e918f', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <Ic d={P.user} s={12} /> Full Name
                  </label>
                  <input
                    value={name}
                    onChange={e => { setName(e.target.value); setLocalError(''); }}
                    placeholder="Full name"
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = 'rgba(168,199,250,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,199,250,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(168,199,250,0.18)'; e.target.style.boxShadow = 'none'; }}
                    autoFocus
                  />
                </div>
              )}

              <div style={mode === 'signup' ? null : fullSpan}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#8e918f', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <Ic d={P.mail} s={12} /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLocalError(''); }}
                  placeholder="m@example.com"
                  style={inp}
                  onFocus={e => { e.target.style.borderColor = 'rgba(168,199,250,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,199,250,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(168,199,250,0.18)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#8e918f', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <Ic d={P.shield} s={12} /> Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setLocalError(''); }}
                    placeholder="At least 6 characters"
                    style={{ ...inp, paddingRight: 52 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(168,199,250,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,199,250,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(168,199,250,0.18)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeBtn}>
                    <Ic d={showPassword ? P.eyeOff : P.eye} s={15} />
                  </button>
                </div>
                {showStrengthMeter && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 7 }}>
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: index < strength.score ? strength.color : 'rgba(255,255,255,0.08)',
                            boxShadow: index < strength.score ? `0 0 12px ${strength.color}40` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: strength.color }}>
                      Password strength: {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#8e918f', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <Ic d={P.check2} s={12} /> Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setLocalError(''); }}
                      placeholder="Repeat your password"
                      style={{ ...inp, paddingRight: 52 }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(168,199,250,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,199,250,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(168,199,250,0.18)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={eyeBtn}>
                      <Ic d={showConfirmPassword ? P.eyeOff : P.eye} s={15} />
                    </button>
                  </div>
                </div>
              )}

              {(localError || error) && <p style={{ ...fullSpan, color: '#f87171', fontSize: 13, margin: '0' }}>{localError || error}</p>}
              {message && <p style={{ ...fullSpan, color: '#34d399', fontSize: 13, margin: '0' }}>{message}</p>}
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendLoading}
                  style={{ ...fullSpan, padding: 0, background: 'transparent', border: 'none', color: '#d3e3fd', textAlign: 'left', fontSize: 12, cursor: resendLoading ? 'wait' : 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  {resendLoading ? 'Resending confirmation email…' : 'Resend confirmation email'}
                </button>
              )}

              <button type="submit" disabled={loading} style={{ ...fullSpan, width: '100%', padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'wait' : 'pointer', boxShadow: '0 14px 28px rgba(73,104,255,0.24)', fontFamily: '"Roboto", Arial, sans-serif', letterSpacing: '0.01em', animation: 'none', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Working…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>

              <div style={{ ...fullSpan, display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 4px', color: '#5f6368' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(168,199,250,0.14)' }} />
                <span style={{ fontSize: 12 }}>{mode === 'signup' ? 'Already have an account?' : 'Need an account?'}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(168,199,250,0.14)' }} />
              </div>

              <button
                type="button"
                onClick={() => onModeChange(mode === 'signup' ? 'signin' : 'signup')}
                style={{ ...fullSpan, width: '100%', padding: '13px 14px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(30,43,80,0.72), rgba(17,24,39,0.72))', color: '#e8edff', fontWeight: 600, fontSize: 14, border: '1px solid rgba(126,151,255,0.32)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {mode === 'signup' ? 'Go to Sign In' : 'Create Account'}
              </button>
            </form>
          </div>

          {showPreview && (
            <div className="auth-modal-preview" style={{ padding: previewPadding, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, overflowY: 'auto', borderTop: isStacked ? '1px solid rgba(168,199,250,0.12)' : 'none', height: '100%' }}>
            <div style={{ width: '100%', maxWidth: 520 }}>
              <DetectionPreview compact />
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Landing({ onStart, onSignIn, isSignedIn = false, profile = { name: '', email: '' }, onSignOut }) {
  const isDark = true;

  const features = [
    { icon: P.spark,  title: 'Humanize',   desc: 'Strip robotic AI patterns and rewrite text to flow naturally, just like a real person wrote it.' },
    { icon: P.doc,    title: 'Summarize',   desc: 'Condense long articles, reports, or essays into clear, concise summaries in seconds.' },
    { icon: P.zap,    title: 'Expand',      desc: 'Turn bullet points or short drafts into fully developed, detailed paragraphs.' },
    { icon: P.shield, title: 'Fix Grammar', desc: 'Correct spelling, punctuation, and grammar while preserving your original voice.' },
  ];

  const previewFeatures = [
    'Human-sounding rewrites',
    'Built-in document uploads',
    'Fast save and history flow',
  ];

  const steps = [
    { n: '01', title: 'Paste your text',  desc: 'Drop in any AI-generated content or upload a PDF, DOCX, or TXT file.' },
    { n: '02', title: 'Choose an action', desc: 'Humanize, Summarize, Expand, or Fix Grammar with one click.' },
    { n: '03', title: 'Copy and use',     desc: 'Get your polished result instantly and copy it anywhere.' },
  ];

  const heroBg  = isDark ? 'radial-gradient(ellipse at 50% 60%, rgba(66,133,244,0.12) 0%, transparent 60%), #0e0f11' : 'radial-gradient(ellipse at 50% 60%, rgba(168,199,250,0.08) 0%, transparent 60%), #f0f4ff';
  const bodyBg  = isDark ? '#0e0f11' : '#f0f4ff';
  const featBg  = bodyBg;
  const stepsBg = bodyBg;
  const text1   = isDark ? '#e3e3e3' : '#1f1f1f';
  const text2   = isDark ? '#8e918f' : '#5f6368';
  const text3   = isDark ? '#8e918f' : '#8e918f';
  const cardBg  = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(168,199,250,0.04)';
  const cardBdr = isDark ? 'rgba(168,199,250,0.22)'   : 'rgba(168,199,250,0.18)';
  const navBg   = isDark ? 'rgba(5,8,20,0.82)' : 'rgba(255,255,255,0.82)';
  const navBdr  = isDark ? 'rgba(168,199,250,0.16)' : 'rgba(168,199,250,0.2)';

  return (
    <div className="page-fade" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: bodyBg, color: text1 }}>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'clamp(8px, 2vw, 14px)', flexWrap: 'nowrap', padding: '12px clamp(14px, 3vw, 32px)', background: 'transparent', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 1.8vw, 10px)', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          <img src="/hc-icon.png" alt="HumanClarity AI" style={{ height: 'clamp(24px, 6.2vw, 34px)', flexShrink: 0, filter: 'drop-shadow(0 0 5px rgba(168,199,250,0.28))' }} />
          <span style={{ fontFamily: '"Roboto", Arial, sans-serif', fontWeight: 700, fontSize: 'clamp(11px, 3.7vw, 17px)', background: 'linear-gradient(135deg, #a8c7fa 0%, #d3e3fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: 0, lineHeight: 1.1, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>HumanClarity AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'clamp(8px, 1.6vw, 10px)', flex: '0 0 auto', flexShrink: 0 }}>
          {isSignedIn ? (
            <>
              <span title={profile.name || profile.email} style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, userSelect: 'none' }}>
                {initials(profile.name || profile.email)}
              </span>
              <button onClick={onSignOut} aria-label="Sign out" title="Sign out" style={{ width: 34, height: 34, padding: 0, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic d={P.signout} s={16} />
              </button>
              <button onClick={onStart} style={{ padding: '9px clamp(12px, 3.2vw, 18px)', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 'clamp(11px, 3.2vw, 14px)', border: 'none', cursor: 'pointer', boxShadow: '0 14px 26px rgba(73,104,255,0.24)', whiteSpace: 'nowrap' }}>
                Open App
              </button>
            </>
          ) : (
            <>
              <button onClick={onSignIn} style={{ padding: '8px clamp(10px, 2.8vw, 14px)', borderRadius: 10, background: 'linear-gradient(135deg, rgba(30,43,80,0.7), rgba(17,24,39,0.72))', color: '#e8edff', fontWeight: 700, fontSize: 'clamp(11px, 3vw, 13px)', border: '1px solid rgba(126,151,255,0.32)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 10px 22px rgba(0,0,0,0.18)' }}>
                Sign In
              </button>
              <button onClick={onStart} style={{ padding: '9px clamp(12px, 3.2vw, 18px)', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 'clamp(11px, 3.2vw, 14px)', border: 'none', cursor: 'pointer', boxShadow: '0 14px 26px rgba(73,104,255,0.24)', whiteSpace: 'nowrap' }}>
                Get Started Free
              </button>
            </>
          )}
        </div>
      </nav>

      <section style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '72px 20px 96px', background: heroBg }}>
        <ParticleCanvas count={46} isDark={isDark} speed={0.55} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 47%, rgba(66,133,244,0.2) 0%, rgba(66,133,244,0.08) 34%, transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(14,15,17,0.25), #0e0f11 96%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 780, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 52px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 14px', maxWidth: 700 }}>
            Your humanizer to turn AI content into{' '}
            <span style={{ background: 'linear-gradient(135deg, #a8c7fa 0%, #d3e3fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>undetectable, human</span>{' '}text.
          </h1>
          <p style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', color: text2, margin: '0 0 36px', maxWidth: 560, lineHeight: 1.65 }}>
            Bypass AI detectors like Turnitin and convince your readers — in seconds.
          </p>

          <button onClick={onStart} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px clamp(24px, 4vw, 44px)', borderRadius: 12, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 'clamp(14px, 1.8vw, 16px)', border: 'none', cursor: 'pointer', boxShadow: '0 12px 28px rgba(73,104,255,0.28)', marginBottom: 28, viewTransitionName: 'humanizer-composer' }}>
            Go to Main App <Ic d={P.arrow} s={18} />
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {features.map((f) => (
              <button key={f.title} onClick={onStart} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, borderRadius: 999, border: '1px solid rgba(168,199,250,0.16)', background: 'rgba(168,199,250,0.06)', color: '#c4c7c5', padding: '0 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Ic d={f.icon} s={16} /> {f.title}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
            {previewFeatures.map((item) => (
              <span key={item} style={{ fontSize: 12, color: text3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Ic d={P.check2} s={13} /> {item}
              </span>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 96, background: `linear-gradient(to top, ${bodyBg}, transparent)`, pointerEvents: 'none' }} />
      </section>
      <section style={{ padding: 'clamp(70px, 11vh, 120px) clamp(16px, 4vw, 32px)', position: 'relative', background: featBg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 640, height: 1, background: 'linear-gradient(90deg, transparent, rgba(126,151,255,0.4), transparent)' }} />
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 720, height: 380, background: 'radial-gradient(ellipse, rgba(73,104,255,0.09), transparent 65%)', pointerEvents: 'none', filter: 'blur(60px)' }} />
        <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vh, 58px)' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7e97ff', background: 'rgba(73,104,255,0.1)', border: '1px solid rgba(73,104,255,0.28)', marginBottom: 18 }}>
              Features
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: text1, margin: '0 0 14px', fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
              Everything you need,{' '}
              <span style={{ background: 'linear-gradient(135deg,#e9edf7 0%, #7fb1ff 55%, #8f5cff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>in one place</span>
            </h2>
            <p style={{ color: text2, fontSize: 'clamp(14px, 1.7vw, 16px)', maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
              Professional writing tools powered by Claude AI — every action just a click away.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {features.map((f) => (
              <div key={f.title} style={{
                position: 'relative',
                background: 'linear-gradient(145deg, rgba(19,29,48,0.74), rgba(8,13,24,0.78))',
                border: '1px solid rgba(70,103,178,0.45)',
                borderRadius: 18,
                padding: '28px 24px',
                overflow: 'hidden',
                boxShadow: '0 18px 40px rgba(0,0,0,0.32), 0 0 50px rgba(37,99,235,0.06)',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: 'radial-gradient(circle, rgba(126,151,255,0.2), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(73,104,255,0.34), rgba(124,82,255,0.24))', border: '1px solid rgba(126,151,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#cdd9ff', boxShadow: '0 8px 18px rgba(73,104,255,0.2)' }}>
                  <Ic d={f.icon} s={22} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: text1, margin: '0 0 10px' }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: text2, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'clamp(70px, 11vh, 120px) clamp(16px, 4vw, 32px)', background: stepsBg, borderTop: '1px solid rgba(70,103,178,0.18)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 820, height: 380, background: 'radial-gradient(ellipse, rgba(124,82,255,0.08), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vh, 58px)' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a78bff', background: 'rgba(124,82,255,0.1)', border: '1px solid rgba(124,82,255,0.28)', marginBottom: 18 }}>
              How it works
            </span>
            <h2 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: text1, margin: 0, fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
              Three steps to{' '}
              <span style={{ background: 'linear-gradient(135deg,#e9edf7 0%, #7fb1ff 55%, #8f5cff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>better writing</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            {steps.map((s) => (
              <div key={s.n} style={{
                position: 'relative',
                background: 'linear-gradient(145deg, rgba(19,29,48,0.74), rgba(8,13,24,0.78))',
                border: '1px solid rgba(70,103,178,0.45)',
                borderRadius: 18,
                padding: '28px 24px 24px',
                overflow: 'hidden',
                boxShadow: '0 18px 40px rgba(0,0,0,0.32), 0 0 50px rgba(37,99,235,0.06)',
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, background: 'radial-gradient(circle, rgba(126,151,255,0.2), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ width: 54, height: 54, borderRadius: 14, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 17, fontWeight: 900, color: '#fff', boxShadow: '0 12px 24px rgba(73,104,255,0.32)', fontFamily: '"Roboto", Arial, sans-serif' }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: text1, margin: '0 0 10px' }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.68, color: text2, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '130px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: bodyBg }}>
        <ParticleCanvas count={45} isDark={isDark} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 400, background: 'radial-gradient(ellipse, rgba(168,199,250,0.2) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(168,199,250,0.16) 1px, transparent 1px)', backgroundSize: '38px 38px', pointerEvents: 'none', opacity: isDark ? 0.75 : 0.5 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 58px)', fontWeight: 700, color: text1, marginBottom: 16, fontFamily: '"Roboto", Arial, sans-serif' }}>Ready to get started?</h2>
          <p style={{ color: text2, marginBottom: 40, fontSize: 17, maxWidth: 400, margin: '0 auto 42px' }}>Join writers and students who use HumanClarity every day.</p>
          <button onClick={onStart} style={{ padding: '18px 52px', borderRadius: 16, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', cursor: 'pointer', animation: 'none', letterSpacing: '0.01em', fontFamily: '"Roboto", Arial, sans-serif', boxShadow: '0 16px 34px rgba(73,104,255,0.24)' }}>
            Launch the App
          </button>
        </div>
      </section>

      <footer style={{ padding: '14px clamp(16px, 4vw, 32px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: `1px solid ${isDark ? 'rgba(168,199,250,0.1)' : 'rgba(168,199,250,0.15)'}`, background: bodyBg, fontSize: 13, color: text3 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          Made in Ghana © {new Date().getFullYear()}
          <a href="https://kennedyabubakar.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#c7d3ff', fontWeight: 600, textDecoration: 'none', textShadow: '0 0 10px rgba(126,151,255,0.55), 0 0 22px rgba(124,82,255,0.35)' }}>
            Kennedy Abubakar
          </a>
        </span>
        <button onClick={onStart} style={{ color: text3, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          Enter App
        </button>
      </footer>
    </div>
  );
}

const NAV = [
  { id: 'tool',      label: 'Humanizer',  icon: 'spark' },
  { id: 'dashboard', label: 'Dashboard',  icon: 'grid' },
  { id: 'profile',   label: 'Profile',    icon: 'user' },
  { id: 'history',   label: 'History',    icon: 'clock' },
  { id: 'saved',     label: 'Saved Docs', icon: 'bookmark' },
];
const SIGNIN_VIEWS = new Set(['dashboard', 'profile', 'history', 'saved', 'settings']);


// ─── shared app shell ─────────────────────────────────────────────────────────

function AppShell({ page, onNav, isSignedIn, subscription, profile = { name: '', email: '' }, onPrimaryClick, onSecondaryClick, onSignOut, scroll = false, mainPadding, children }) {
  const isPro = subscription?.tier === 'pro';
  const [railOpen, setRailOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));

  useEffect(() => {
    function handleResize() { setViewportWidth(window.innerWidth); }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPhone = viewportWidth <= 560;
  const showRailLabels = railOpen && viewportWidth > 760;
  const railWidth = showRailLabels ? 292 : isPhone ? 54 : 76;

  function RailItem({ id, label, icon, onClick }) {
    const active = id === page;
    return (
      <button
        onClick={() => {
          if (onClick) { onClick(); return; }
          if (id === page) { setRailOpen(false); return; }
          onNav?.(id);
        }}
        title={label}
        style={{
          width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 14,
          borderRadius: 13, padding: showRailLabels ? '0 14px' : 0,
          justifyContent: showRailLabels ? 'flex-start' : 'center',
          border: active ? '1px solid rgba(113,131,255,0.55)' : '1px solid transparent',
          background: active ? 'rgba(76,88,180,0.2)' : 'transparent',
          color: active ? '#eef2ff' : '#9ca8bd',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 15, fontWeight: active ? 800 : 600,
        }}
      >
        <span style={{ color: active ? '#8f7cff' : '#9ca8bd', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Ic d={P[icon]} s={22} />
        </span>
        {showRailLabels && <span>{label}</span>}
        {showRailLabels && active && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#8f5cff' }} />}
      </button>
    );
  }

  return (
    <div style={{ height: '100dvh', position: 'relative', overflow: 'hidden', background: '#0e0f11', color: '#f8fafc', viewTransitionName: page === 'tool' ? 'humanizer-page' : undefined }}>
      <ParticleCanvas count={48} isDark speed={0.52} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 22%, rgba(66,133,244,0.2), transparent 35%), radial-gradient(ellipse at 50% 46%, rgba(37,99,235,0.12), transparent 48%), linear-gradient(180deg, rgba(14,15,17,0.7), #0e0f11 96%)', pointerEvents: 'none' }} />

      <aside style={{ position: 'absolute', zIndex: 5, top: 0, left: 0, bottom: 0, width: railWidth, transition: 'width 0.22s cubic-bezier(0.22, 1, 0.36, 1)', borderRight: '1px solid rgba(145,158,191,0.14)', background: 'rgba(5,10,18,0.72)', backdropFilter: 'blur(18px)', display: 'flex', flexDirection: 'column', padding: isPhone ? 8 : 12, boxSizing: 'border-box' }}>
        <button onClick={() => setRailOpen(v => !v)} aria-label={railOpen ? 'Collapse navigation' : 'Expand navigation'} style={{ minHeight: 50, border: 'none', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: showRailLabels ? 'flex-start' : 'center', gap: 12, padding: showRailLabels ? '0 8px' : 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          <img src="/hc-icon.png" alt="" style={{ width: 31, height: 31, objectFit: 'contain' }} />
          {showRailLabels && (
            <span style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 900 }}>HumanClarity</span>
              <span style={{ display: 'block', marginTop: 4, color: '#6d87ff', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Natural Writing, Fast</span>
            </span>
          )}
        </button>
        <nav style={{ display: 'grid', gap: 8, marginTop: 18 }}>
          {NAV.map(item => <RailItem key={item.id} {...item} />)}
        </nav>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          {!isPro && (
            <button
              onClick={() => onNav?.('pricing')}
              title="Upgrade to Premium"
              style={{ width: '100%', minHeight: showRailLabels ? 172 : 50, borderRadius: 15, border: '1px solid rgba(113,131,255,0.25)', background: showRailLabels ? 'linear-gradient(145deg, rgba(23,30,58,0.92), rgba(13,18,32,0.92))' : 'transparent', color: '#fff', padding: showRailLabels ? 16 : 0, display: 'flex', flexDirection: showRailLabels ? 'column' : 'row', alignItems: showRailLabels ? 'flex-start' : 'center', justifyContent: showRailLabels ? 'flex-start' : 'center', gap: showRailLabels ? 8 : 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span style={{ color: '#8f5cff', display: 'grid', placeItems: 'center' }}><Ic d={P.premium} s={showRailLabels ? 25 : 22} /></span>
              {showRailLabels && (
                <>
                  <span style={{ fontSize: 15, fontWeight: 900 }}>Upgrade to Premium</span>
                  <span style={{ color: '#aeb8ce', fontSize: 12.5, lineHeight: 1.45 }}>Unlock unlimited use and powerful capabilities.</span>
                  <span style={{ width: '100%', minHeight: 40, marginTop: 8, borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 900 }}>
                    Upgrade Now <Ic d={P.zap} s={16} />
                  </span>
                </>
              )}
            </button>
          )}
          <RailItem id="settings" label="Settings" icon="gear" />
        </div>
      </aside>

      <header style={{ position: 'relative', zIndex: 3, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: isPhone ? '12px 12px' : '12px clamp(16px, 3vw, 32px)', paddingLeft: `calc(${railWidth}px + ${isPhone ? '12px' : 'clamp(16px, 3vw, 32px)'})`, transition: 'padding-left 0.22s cubic-bezier(0.22, 1, 0.36, 1)', borderBottom: 'none', background: 'transparent', boxSizing: 'border-box' }}>
        <div style={{ color: '#fff', fontSize: 'clamp(13px, 3.6vw, 18px)', fontWeight: 800, whiteSpace: 'nowrap' }}>
          {viewportWidth <= 520 ? 'HC AI' : 'HumanClarity AI'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSignedIn ? (
            <>
              <span title={profile.name || profile.email} style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, userSelect: 'none' }}>
                {initials(profile.name || profile.email)}
              </span>
              {onSignOut && (
                <button onClick={onSignOut} aria-label="Sign out" title="Sign out" style={{ width: 34, height: 34, padding: 0, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ic d={P.signout} s={16} />
                </button>
              )}
              {onPrimaryClick && (
                <button onClick={onPrimaryClick} style={{ minHeight: 38, padding: '0 clamp(12px, 2.8vw, 22px)', borderRadius: 9, border: 'none', color: '#fff', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', boxShadow: '0 14px 26px rgba(73,104,255,0.24)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {page === 'dashboard' ? 'Humanize' : 'Dashboard'}
                </button>
              )}
            </>
          ) : (
            <>
              {viewportWidth > 520 && onSecondaryClick && (
                <button onClick={onSecondaryClick} style={{ minHeight: 38, padding: '0 clamp(10px, 2.4vw, 18px)', borderRadius: 9, border: '1px solid rgba(126,151,255,0.34)', color: '#e8edff', background: 'linear-gradient(135deg, rgba(30,43,80,0.78), rgba(17,24,39,0.74))', boxShadow: '0 10px 22px rgba(0,0,0,0.18)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Sign In
                </button>
              )}
              {onPrimaryClick && (
                <button onClick={onPrimaryClick} style={{ minHeight: 38, padding: '0 clamp(12px, 2.8vw, 22px)', borderRadius: 9, border: 'none', color: '#fff', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', boxShadow: '0 14px 26px rgba(73,104,255,0.24)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {viewportWidth <= 520 ? 'Start' : 'Get Started Free'}
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 2, height: 'calc(100dvh - 62px - 36px)', marginLeft: railWidth, transition: 'margin-left 0.22s cubic-bezier(0.22, 1, 0.36, 1)', padding: mainPadding ?? (scroll ? 0 : (isPhone ? '10px 10px 8px' : 'clamp(12px, 2vh, 22px) clamp(18px, 4vw, 44px)')), boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: scroll ? 'auto' : 'hidden' }}>
        {children}
      </main>

      <footer style={{ position: 'relative', zIndex: 3, height: 36, marginLeft: railWidth, transition: 'margin-left 0.22s cubic-bezier(0.22, 1, 0.36, 1)', padding: isPhone ? '0 12px' : '0 clamp(18px, 4vw, 44px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid rgba(70,103,178,0.18)', background: 'transparent', boxSizing: 'border-box', color: '#8e918f', fontSize: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {!isPhone && <>Made in Ghana © {new Date().getFullYear()}</>}
          {isPhone && <>© {new Date().getFullYear()}</>}
          <a href="https://kennedyabubakar.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#c7d3ff', fontWeight: 600, textDecoration: 'none', textShadow: '0 0 10px rgba(126,151,255,0.55), 0 0 22px rgba(124,82,255,0.35)' }}>
            Kennedy Abubakar
          </a>
        </span>
        <button onClick={() => onNav?.('landing')} style={{ color: '#8e918f', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'inherit', padding: 0, flexShrink: 0 }}>
          Enter Home
        </button>
      </footer>
    </div>
  );
}

// ─── humanizer tool ───────────────────────────────────────────────────────────

function HumanizerTool({ history, setHistory, subscription, isSignedIn, onRequireAuth, onUsageAdd, onNav }) {
  const [input,   setInput]   = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('hc-humanizer-input') || '';
    } catch {
      return '';
    }
  });
  const [output,  setOutput]  = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('hc-humanizer-output');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState(false);
  const [selectedAction, setSelectedAction] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('hc-humanizer-selected-action') || '';
    } catch {
      return '';
    }
  });
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  const fileRef     = useRef(null);
  const textareaRef = useRef(null);
  const wordCount = useMemo(() => wc(input), [input]);
  const remaining = wordsRemaining(subscription);
  const isNarrowWorkbench = viewportWidth <= 860;
  const isPhone = viewportWidth <= 560;
  const toolActions = [
    { id: 'summarize', label: 'Summarize', icon: P.doc },
    { id: 'expand', label: 'Expand', icon: P.zap },
    { id: 'fix_grammar', label: 'Fix Grammar', icon: P.shield },
  ];

  async function run(action) {
    const text = input.trim();
    if (!text || loading || uploading) return;

    if (subscription.tier !== 'pro') {
      if (remaining <= 0) {
        setError(
          isSignedIn
            ? `You've used your ${FREE_WORD_LIMIT} free words for today. Your quota resets tomorrow — upgrade to Pro for unlimited processing.`
            : `Guest access is limited to ${FREE_WORD_LIMIT} words per day. Sign in or upgrade to keep going.`,
        );
        return;
      }
      if (wordCount > remaining) {
        setError(`This document uses ${wordCount} words, but your free plan has ${remaining} words left today.`);
        return;
      }
    }

    setLoading(true); setError(''); setOutput(null);
    try {
      const res  = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Processing failed.');
      setOutput({ text: data.result, action, wordCount: data.wordCount });
      setHistory(prev => [{
        id: `h_${Date.now()}`, action,
        inputText: text, outputText: data.result,
        wordCount: data.wordCount, timestamp: new Date().toISOString(),
      }, ...prev]);
      if (subscription.tier !== 'pro') {
        onUsageAdd(wordCount);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleAction(actionId) {
    setSelectedAction(prev => (prev === actionId ? '' : actionId));
  }

  async function runHumanizeFlow() {
    const text = input.trim();
    if (!text || loading || uploading) return;

    if (subscription.tier !== 'pro') {
      if (remaining <= 0) {
        setError(
          isSignedIn
            ? `You've used your ${FREE_WORD_LIMIT} free words for today. Your quota resets tomorrow — upgrade to Pro for unlimited processing.`
            : `Guest access is limited to ${FREE_WORD_LIMIT} words per day. Sign in or upgrade to keep going.`,
        );
        return;
      }
      if (wordCount > remaining) {
        setError(`This document uses ${wordCount} words, but your free plan has ${remaining} words left today.`);
        return;
      }
    }

    if (!selectedAction) {
      await run('humanize');
      return;
    }

    setLoading(true);
    setError('');
    setOutput(null);

    try {
      const firstRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action: selectedAction }),
      });
      const firstData = await firstRes.json();
      if (!firstRes.ok) throw new Error(firstData.error || 'Processing failed.');

      const secondRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: firstData.result, action: 'humanize', humanizeOptions: { level: 'aggressive' } }),
      });
      const secondData = await secondRes.json();
      if (!secondRes.ok) throw new Error(secondData.error || 'Processing failed.');

      setOutput({ text: secondData.result, action: 'humanize', wordCount: secondData.wordCount });
      setHistory(prev => [{
        id: `h_${Date.now()}`,
        action: `humanize_after_${selectedAction}`,
        inputText: text,
        outputText: secondData.result,
        wordCount: secondData.wordCount,
        timestamp: new Date().toISOString(),
      }, ...prev]);

      if (subscription.tier !== 'pro') {
        onUsageAdd(wordCount);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    setUploading(true);
    setError('');
    setOutput(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setInput(data.text);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('hc-humanizer-input', input);
    } catch {}
  }, [input]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (output) {
        window.localStorage.setItem('hc-humanizer-output', JSON.stringify(output));
      } else {
        window.localStorage.removeItem('hc-humanizer-output');
      }
    } catch {}
  }, [output]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('hc-humanizer-selected-action', selectedAction);
    } catch {}
  }, [selectedAction]);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Restore textarea focus after loading/uploading finishes so Ctrl+V keeps working
  useEffect(() => {
    if (!loading && !uploading) {
      textareaRef.current?.focus();
    }
  }, [loading, uploading]);

  const outputPlaceholder = 'Your humanized text will appear here once processing is complete.';
  const outputText = output?.text || outputPlaceholder;
  const outputWords = output?.wordCount || 0;
  const panelStyle = {
    borderRadius: 15,
    border: '1px solid rgba(145,158,191,0.22)',
    background: 'linear-gradient(145deg, rgba(15,23,38,0.84), rgba(8,13,24,0.72))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  };
  const actionButton = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 52, padding: '0 22px', borderRadius: 12,
    border: '1px solid rgba(145,158,191,0.24)', background: 'rgba(17,24,39,0.78)',
    color: '#d8deef', cursor: 'pointer', fontSize: 15, fontWeight: 500,
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  };

  return (
    <>
      <section style={{ textAlign: 'center', maxWidth: 900, margin: isPhone ? '0 auto 10px' : '0 auto clamp(14px, 2.4vh, 24px)', flex: '0 0 auto' }}>
          {!isPhone && (
            <img src="/hc-icon.png" alt="" style={{ width: isNarrowWorkbench ? 30 : 'clamp(32px, 5vh, 48px)', height: isNarrowWorkbench ? 30 : 'clamp(32px, 5vh, 48px)', objectFit: 'contain', margin: '0 auto clamp(8px, 1.4vh, 14px)', display: 'block', filter: 'drop-shadow(0 0 6px rgba(124,82,255,0.28))' }} />
          )}
          <h1 style={{ margin: isPhone ? '0 0 4px' : '0 0 clamp(6px, 1vh, 10px)', fontSize: isPhone ? 22 : isNarrowWorkbench ? 'clamp(28px, 8vw, 38px)' : 'clamp(30px, 5.2vh, 52px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: 0 }}>
            Your writing, <span style={{ background: 'linear-gradient(135deg,#e9edf7 0%, #7fb1ff 62%, #6f8cff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>clearer.</span>
          </h1>
          {!isPhone && (
            <p style={{ margin: 0, color: '#b8c2d8', fontSize: isNarrowWorkbench ? 13 : 'clamp(14px, 2vh, 18px)', lineHeight: 1.45 }}>AI that makes your ideas sound natural, authentic, and undetectable.</p>
          )}
        </section>

        <section style={{ width: 'min(100%, 1120px)', margin: '0 auto', borderRadius: isPhone ? 14 : 20, border: '1px solid rgba(70,103,178,0.55)', background: 'linear-gradient(145deg, rgba(19,29,48,0.74), rgba(8,13,24,0.78))', boxShadow: '0 24px 70px rgba(0,0,0,0.35), 0 0 70px rgba(37,99,235,0.12)', overflow: 'hidden', viewTransitionName: 'humanizer-composer', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className={`humanizer-workbench-grid${isNarrowWorkbench && !output?.text && !loading ? ' is-input-only' : ''}`} style={{ display: 'grid', gridTemplateColumns: isNarrowWorkbench ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 1px minmax(0, 1fr)', gap: 0, flex: '1 1 auto', minHeight: 0 }}>
            <div style={{ padding: isPhone ? '12px 12px 10px' : 'clamp(12px, 1.8vh, 20px) 20px clamp(10px, 1.5vh, 16px)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isPhone ? 10 : 'clamp(10px, 1.4vh, 16px)', flex: '0 0 auto' }}>
                <span style={{ color: '#a9c5ff', display: 'grid', placeItems: 'center' }}><Ic d={P.doc} s={isPhone ? 18 : 21} /></span>
                <span style={{ fontSize: isPhone ? 14 : 15, fontWeight: 800 }}>Input</span>
                <span style={{ marginLeft: 'auto', color: '#aeb8ce', fontSize: isPhone ? 12 : 13 }}>{wordCount} words</span>
                <button onClick={() => { setInput(''); setOutput(null); setError(''); }} style={{ minHeight: isPhone ? 28 : 30, padding: isPhone ? '0 10px' : '0 13px', borderRadius: 8, border: '1px solid rgba(145,158,191,0.18)', background: 'rgba(15,23,42,0.55)', color: '#aeb8ce', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
              </div>
              <div style={{ ...panelStyle, minHeight: 0, flex: '1 1 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={isPhone ? 'Paste your AI text here...' : 'Paste your AI text here or upload a document to begin...'}
                    aria-label="Input text"
                    style={{ width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: '#eef2ff', padding: isPhone ? '14px 14px 12px' : '24px 28px 18px 24px', fontFamily: 'inherit', fontSize: isPhone ? 15 : 16, lineHeight: 1.6, boxSizing: 'border-box', overflow: 'auto' }}
                    disabled={loading || uploading}
                  />
                  {!input.trim() && !isNarrowWorkbench && (
                    <div style={{ position: 'absolute', inset: '88px 0 auto 0', display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 6, color: '#d7def0' }}>
                        <Ic d={P.upload} s={28} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Upload a file</span>
                        <span style={{ fontSize: 12, color: '#98a4bb' }}>or drag and drop here</span>
                      </div>
                      <div style={{ height: 96, background: 'rgba(145,158,191,0.12)' }} />
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 6, color: '#d7def0' }}>
                        <Ic d={P.pen} s={28} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Start writing</span>
                        <span style={{ fontSize: 12, color: '#98a4bb' }}>Begin with a blank canvas</span>
                      </div>
                    </div>
                  )}
                </div>
                {!isNarrowWorkbench && (
                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 20px 16px', color: '#94a0b7', fontSize: 12, pointerEvents: 'none' }}>
                    <span>{wordCount} words</span>
                    <span>Max 25,000 words</span>
                  </div>
                )}
              </div>
            </div>

            <div className="humanizer-workbench-divider" style={{ display: isNarrowWorkbench && !output?.text && !loading ? 'none' : 'block', background: 'rgba(145,158,191,0.13)', margin: 'clamp(12px, 1.8vh, 20px) 0', height: 'auto', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 38, height: 38, borderRadius: '50%', background: 'rgba(17,24,39,0.92)', border: '1px solid rgba(145,158,191,0.18)', display: 'grid', placeItems: 'center', color: '#a9c5ff' }}><Ic d={P.swap} s={21} /></div>
            </div>

            <div style={{ padding: isPhone ? '12px 12px 10px' : 'clamp(12px, 1.8vh, 20px) 20px clamp(10px, 1.5vh, 16px)', minHeight: 0, display: isNarrowWorkbench && !output?.text && !loading ? 'none' : 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isPhone ? 10 : 'clamp(10px, 1.4vh, 16px)', flex: '0 0 auto' }}>
                <span style={{ color: '#a9c5ff', display: 'grid', placeItems: 'center' }}><Ic d={P.shield} s={isPhone ? 18 : 22} /></span>
                <span style={{ fontSize: isPhone ? 14 : 15, fontWeight: 800 }}>Output</span>
                <span style={{ marginLeft: 'auto', color: '#aeb8ce', fontSize: isPhone ? 12 : 13 }}>{outputWords} words</span>
                <button onClick={() => {
                  navigator.clipboard.writeText(outputText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }} style={{ minHeight: isPhone ? 28 : 30, padding: isPhone ? '0 10px' : '0 13px', borderRadius: 8, border: '1px solid rgba(145,158,191,0.18)', background: 'rgba(15,23,42,0.55)', color: '#aeb8ce', fontSize: 12, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'inherit' }}><Ic d={P.copy} s={15} />{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div style={{ ...panelStyle, minHeight: 0, flex: '1 1 auto', padding: isPhone ? 14 : 'clamp(16px, 2vh, 24px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {loading ? (
                  <HumanizerOutputLoader isPhone={isPhone} />
                ) : (
                  <p style={{ margin: 0, color: output?.text ? '#f4f7fb' : '#98a4bb', fontSize: isPhone ? 14 : 'clamp(13px, 1.8vh, 16px)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflow: 'auto', flex: '1 1 auto' }}>{outputText}</p>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 28, padding: '0 12px', borderRadius: 7, border: '1px solid rgba(145,158,191,0.18)', background: loading ? 'rgba(126,151,255,0.1)' : 'rgba(148,163,184,0.08)', color: '#b9c4da', fontSize: 13 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#9ec1ff' : output?.text ? '#6ee7b7' : '#70809e', boxShadow: loading ? '0 0 10px rgba(158,193,255,0.55)' : output?.text ? '0 0 10px rgba(110,231,183,0.5)' : 'none', animation: loading ? 'pulse-glow 1.4s ease-in-out infinite' : 'none' }} /> {loading ? 'Humanizing' : output?.text ? 'AI-Humanized' : 'Ready for output'}</span>
                  {output?.text && !loading && (
                    <>
                      <span style={{ marginLeft: 'auto', color: '#b2bdd2', fontSize: 12 }}>Rate this result</span>
                      <button style={{ color: '#c9d3e8', background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Ic d={P.thumbUp} s={20} /></button>
                      <button style={{ color: '#c9d3e8', background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Ic d={P.thumbDown} s={20} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isPhone ? 6 : isNarrowWorkbench ? 8 : 'clamp(8px, 1.4vw, 16px)', padding: isPhone ? '8px 10px 10px' : isNarrowWorkbench ? '10px 20px 12px' : 'clamp(10px, 1.4vh, 14px) 20px clamp(10px, 1.8vh, 18px)', borderTop: '1px solid rgba(145,158,191,0.14)', background: 'rgba(5,10,18,0.22)', flex: '0 0 auto' }}>
            <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} style={{ display: 'none' }} onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} disabled={loading || uploading} aria-label={uploading ? 'Uploading' : 'Upload file'} style={{ ...actionButton, minHeight: isPhone ? 42 : 52, minWidth: isPhone ? 42 : 132, padding: isPhone ? 0 : '0 22px', background: 'rgba(35,45,65,0.88)', opacity: (loading || uploading) ? 0.55 : 1 }}><Ic d={P.upload} s={isPhone ? 20 : 24} /> {!isPhone && (uploading ? 'Uploading...' : 'Upload')}</button>
            {!isPhone && <span style={{ color: '#b2bdd2', fontSize: 13, marginRight: isNarrowWorkbench ? 0 : 'auto' }}>PDF, DOCX, TXT</span>}
            {toolActions.map(action => (
              <button key={action.id} onClick={() => toggleAction(action.id)} disabled={loading || uploading} style={{ ...actionButton, minHeight: isPhone ? 42 : 52, padding: isPhone ? '0 12px' : '0 22px', fontSize: isPhone ? 13 : 15, gap: isPhone ? 6 : 10, background: selectedAction === action.id ? 'rgba(77,100,190,0.28)' : actionButton.background, border: selectedAction === action.id ? '1px solid rgba(126,151,255,0.54)' : actionButton.border, opacity: (loading || uploading) ? 0.5 : 1 }}><Ic d={action.icon} s={isPhone ? 16 : 19} /> {action.label}</button>
            ))}
            <button
              className={`hc-loading-button${loading ? ' is-loading' : ''}`}
              onClick={runHumanizeFlow}
              disabled={!input.trim() || loading || uploading}
              aria-busy={loading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 11, minHeight: isPhone ? 48 : 52, width: isPhone ? '100%' : 'auto', minWidth: isPhone ? 0 : 196, padding: isPhone ? '0 18px' : '0 25px', borderRadius: 12, background: 'linear-gradient(135deg,#0b64f4,#0874ff)', color: '#fff', fontWeight: 900, fontSize: isPhone ? 15 : 16, border: 'none', cursor: (!input.trim() || loading || uploading) ? 'not-allowed' : 'pointer', opacity: (!input.trim() || loading || uploading) && !loading ? 0.84 : 1, boxShadow: loading ? '0 18px 36px rgba(73,104,255,0.28)' : (!input.trim() || loading || uploading) ? 'none' : '0 16px 30px rgba(8,116,255,0.24)', fontFamily: 'inherit', marginLeft: isPhone ? 0 : undefined, order: isPhone ? 99 : 0 }}
            >
              {loading ? <span className="spin-soft" style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.38)', borderTopColor: '#fff', flexShrink: 0 }} /> : <Ic d={P.spark} s={20} />}
              {loading ? 'Humanizing...' : 'Humanize Now'}
            </button>
          </div>
        </section>

        {error && <div style={{ width: 'min(100%, 1120px)', margin: '16px auto 0', padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {!isPhone && (
        <div style={{ margin: 'clamp(8px, 1.4vh, 14px) auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: '#9ca8bd', fontSize: 13, flex: '0 0 auto' }}>
          <Ic d={P.shield} s={18} /> Your content is encrypted and never stored.
        </div>
      )}
    </>
  );
}
// ─── dashboard ────────────────────────────────────────────────────────────────

const STAT_META = [
  { bg: 'linear-gradient(135deg, rgba(168,199,250,0.18), rgba(66,133,244,0.08))',  bdr: 'rgba(168,199,250,0.28)',  glow: 'rgba(168,199,250,0.15)',  ic: '#a8c7fa' },
  { bg: 'linear-gradient(135deg, rgba(66,133,244,0.18), rgba(109,40,217,0.08))', bdr: 'rgba(66,133,244,0.28)', glow: 'rgba(66,133,244,0.12)', ic: '#a78bfa' },
  { bg: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.06))', bdr: 'rgba(52,211,153,0.25)', glow: 'rgba(52,211,153,0.1)',  ic: '#34d399' },
];

const PAYMENT_METHODS = [
  { label: 'MTN MoMo',     bg: '#ffcc00', color: '#1a1a1a' },
  { label: 'Telecel Cash', bg: '#e2231a', color: '#ffffff' },
  { label: 'AT Money',     bg: '#0a3d91', color: '#ffffff' },
  { label: 'Card',         bg: 'rgba(255,255,255,0.1)', color: '#e8edff' },
  { label: 'Bank',         bg: 'rgba(255,255,255,0.1)', color: '#e8edff' },
];

function PaymentMethods({ align = 'center' }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: align }}>
        {PAYMENT_METHODS.map(m => (
          <span
            key={m.label}
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 9px',
              borderRadius: 6,
              background: m.bg,
              color: m.color,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#6b7a94', textAlign: align, letterSpacing: 0.2 }}>
        Secured by Paystack
      </p>
    </div>
  );
}

function PlanComparison({ subscription, onUpgrade, upgradeLoading, upgradeMessage }) {
  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94' };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.t3 }}>Free</span>
            {subscription.tier !== 'pro' && <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 999, padding: '2px 8px' }}>Current</span>}
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px', color: C.t1, fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1 }}>0 GHS</p>
          <p style={{ fontSize: 12, color: C.t2, margin: '0 0 14px', lineHeight: 1.5 }}>{FREE_WORD_LIMIT} words per day for the Humanizer.</p>
          <div style={{ display: 'grid', gap: 8, fontSize: 12, color: C.t2 }}>
            <span>· {wordsRemaining(subscription)} of {FREE_WORD_LIMIT} words remaining today</span>
            <span>· Humanizer access only</span>
            <span>· Dashboard and workspace locked</span>
          </div>
        </div>

        <div style={{ background: 'rgba(73,104,255,0.07)', border: '1px solid rgba(73,104,255,0.24)', borderRadius: 14, padding: '20px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a8c7fa' }}>Premium</span>
            {subscription.tier === 'pro' && <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 999, padding: '2px 8px' }}>Active</span>}
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 4px', color: C.t1, fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1 }}>
            {PRO_PRICE_GHS} GHS
            <span style={{ fontSize: 13, fontWeight: 500, color: C.t2, marginLeft: 6 }}>/ month</span>
          </p>
          <p style={{ fontSize: 12, color: C.t2, margin: '0 0 14px', lineHeight: 1.5 }}>Pay by mobile money, card, or bank.</p>
          <div style={{ display: 'grid', gap: 8, fontSize: 12, color: C.t2, marginBottom: 16 }}>
            <span>· Unlimited words</span>
            <span>· Full dashboard and all pages</span>
            <span>· History, saved docs, profile</span>
          </div>
          {subscription.tier === 'pro' ? (
            <div style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(74,222,128,0.22)', color: '#4ade80', background: 'rgba(74,222,128,0.07)', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Premium Active</div>
          ) : (
            <>
              <button onClick={onUpgrade} disabled={upgradeLoading} style={{ width: '100%', padding: '11px 16px', borderRadius: 9, border: 'none', color: '#fff', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', cursor: upgradeLoading ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 8px 20px rgba(73,104,255,0.24)', opacity: upgradeLoading ? 0.72 : 1, lineHeight: 1.3 }}>
                {upgradeLoading ? 'Redirecting to checkout…' : 'Pay with Card, Bank or Mobile Money'}
              </button>
              <PaymentMethods />
            </>
          )}
        </div>
      </div>
      {upgradeMessage && <p style={{ fontSize: 12, color: upgradeMessage.toLowerCase().includes('verified') ? '#4ade80' : '#8e918f', margin: 0 }}>{upgradeMessage}</p>}
    </div>
  );
}

function PricingPage({ subscription, onUpgrade, upgradeLoading, upgradeMessage, isSignedIn, onSignIn, notice = '' }) {
  const C = { t1: '#e3e3e3', t2: '#8e918f', accent: '#a8c7fa' };
  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px', maxWidth: 760 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>Plans & Pricing</h1>
          <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>
            {isSignedIn ? `Current plan: ${planLabel(subscription)}.` : 'Sign in to connect a plan to your account.'}
          </p>
        </div>
        {!isSignedIn ? (
          <button onClick={onSignIn} style={{ padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px rgba(73,104,255,0.24)', fontFamily: 'inherit' }}>
            Sign In
          </button>
        ) : subscription.tier !== 'pro' ? (
          <button onClick={onUpgrade} disabled={upgradeLoading} style={{ padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: upgradeLoading ? 'wait' : 'pointer', boxShadow: '0 8px 20px rgba(73,104,255,0.24)', fontFamily: 'inherit', opacity: upgradeLoading ? 0.72 : 1 }}>
            {upgradeLoading ? 'Opening checkout…' : 'Upgrade to Premium'}
          </button>
        ) : null}
      </div>
      {notice && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(168,199,250,0.06)', border: '1px solid rgba(168,199,250,0.14)', color: C.accent, fontSize: 13 }}>
          {notice}
        </div>
      )}
      <PlanComparison subscription={subscription} onUpgrade={onUpgrade} upgradeLoading={upgradeLoading} upgradeMessage={upgradeMessage} />
    </div>
  );
}

function Dashboard({ history, saved, onNav, subscription, profile, onUpgrade, upgradeLoading, upgradeMessage }) {
  const today      = new Date().toDateString();
  const totalWords = useMemo(() => history.reduce((s, h) => s + (h.wordCount || 0), 0), [history]);
  const todayItems = useMemo(() => history.filter(h => new Date(h.timestamp).toDateString() === today).length, [history]);
  const savedToday = useMemo(() => saved.filter(d => new Date(d.savedAt).toDateString() === today).length, [saved]);
  const recent     = history.slice(0, 5);
  const remaining  = wordsRemaining(subscription);

  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94', accent: '#a8c7fa' };

  const stats = [
    { label: 'Words Processed', value: fmtNum(totalWords), sub: `${todayItems} session${todayItems !== 1 ? 's' : ''} today`, icon: P.pen, color: '#a8c7fa' },
    { label: 'Saved Documents', value: String(saved.length), sub: `${savedToday} saved today`, icon: P.bookmark, color: '#c4b5fd' },
    { label: 'Plan', value: planLabel(subscription), sub: subscription.tier === 'pro' ? 'Unlimited words' : `${remaining} words left`, icon: P.zap, color: '#4ade80' },
  ];

  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>
            {profile.name ? `Hey, ${profile.name.split(' ')[0]} 👋` : 'Dashboard'}
          </h1>
          <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>Here's an overview of your activity.</p>
        </div>
        <button onClick={() => onNav('tool')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 8px 20px rgba(73,104,255,0.24)', fontFamily: 'inherit' }}>
          <Ic d={P.add} s={17} /> New Document
        </button>
      </div>

      {subscription.tier !== 'pro' && (
        <div style={{ marginBottom: 22, background: 'rgba(73,104,255,0.07)', border: '1px solid rgba(73,104,255,0.2)', borderRadius: 14, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: C.t1 }}>Free plan — {remaining} words remaining</p>
            <p style={{ margin: 0, fontSize: 12, color: C.t2 }}>Upgrade to Premium for unlimited processing.</p>
          </div>
          <button onClick={() => onNav('pricing')} style={{ padding: '8px 16px', borderRadius: 9, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Upgrade
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 18px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3 }}>{s.label}</span>
              <span style={{ color: s.color, opacity: 0.8 }}><Ic d={s.icon} s={15} /></span>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '0 0 3px', fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: C.t2, margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Recent Activity</h2>
        {history.length > 5 && (
          <button onClick={() => onNav('history')} style={{ fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>
        )}
      </div>
      {recent.length === 0 ? (
        <Empty icon={P.clock} text="No activity yet. Start by humanizing some text." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {recent.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(168,199,250,0.08)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}>
                <Ic d={P.doc} s={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.t1, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.inputText.slice(0, 65)}{item.inputText.length > 65 ? '…' : ''}
                </p>
                <p style={{ fontSize: 11, color: C.t3, margin: 0 }}>{ACTION_LABEL[item.action]} · {item.wordCount} words</p>
              </div>
              <span style={{ fontSize: 11, color: C.t3, flexShrink: 0, whiteSpace: 'nowrap' }}>{reltime(item.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PremiumLockedPage({ title, description, subscription, onUpgrade, upgradeLoading, upgradeMessage }) {
  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f' };
  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px', maxWidth: 760 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>{title}</h1>
        <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>{description}</p>
      </div>
      <div style={{ background: 'rgba(73,104,255,0.07)', border: '1px solid rgba(73,104,255,0.22)', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: C.t1 }}>Premium required</p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: C.t2 }}>
          {subscription.tier === 'pro' ? 'Your access is already active.' : `${wordsRemaining(subscription)} of ${FREE_WORD_LIMIT} free words remain today in the Humanizer.`}
        </p>
      </div>
      <PlanComparison subscription={subscription} onUpgrade={onUpgrade} upgradeLoading={upgradeLoading} upgradeMessage={upgradeMessage} />
    </div>
  );
}

function ProfilePage({ profile, subscription, history, saved, onSaveProfile }) {
  const [form, setForm] = useState({ name: profile.name, email: profile.email });
  const [saveOk, setSaveOk] = useState(false);
  useEffect(() => { setForm({ name: profile.name, email: profile.email }); }, [profile.name, profile.email]);

  function handleSave() {
    onSaveProfile({ ...form, name: form.name.trim() });
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  }

  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94', accent: '#a8c7fa' };
  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,199,250,0.14)', color: C.t1, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' };

  const totalWords = history.reduce((s, h) => s + (h.wordCount || 0), 0);
  const remaining = wordsRemaining(subscription);
  const stats = [
    { label: 'Plan', value: planLabel(subscription), sub: subscription.tier === 'pro' ? 'Unlimited words' : `${remaining} words left`, color: '#4ade80' },
    { label: 'Processed', value: fmtNum(totalWords), sub: 'Total words', color: '#a8c7fa' },
    { label: 'Saved', value: String(saved.length), sub: 'Documents saved', color: '#c4b5fd' },
  ];

  const initials = profile.name ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'HC';

  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px', maxWidth: 860 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>Profile</h1>
        <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>Your account details and usage overview.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 24, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#4968ff,#7c3cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: '#fff', flexShrink: 0 }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 15, color: C.t1 }}>{profile.name || 'No name set'}</p>
          <p style={{ margin: 0, fontSize: 12, color: C.t2 }}>{profile.email}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: subscription.tier === 'pro' ? 'rgba(74,222,128,0.1)' : 'rgba(168,199,250,0.08)', border: `1px solid ${subscription.tier === 'pro' ? 'rgba(74,222,128,0.22)' : 'rgba(168,199,250,0.16)'}`, color: subscription.tier === 'pro' ? '#4ade80' : C.accent, fontSize: 11, fontWeight: 700 }}>
          {planLabel(subscription)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, margin: '0 0 8px' }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: '0 0 2px', fontFamily: '"Roboto", Arial, sans-serif', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: C.t2, margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 18px', marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, margin: '0 0 14px' }}>Account Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" style={inp}
              onFocus={e => e.target.style.borderColor = 'rgba(168,199,250,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(168,199,250,0.14)'} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Email</label>
            <input value={form.email} readOnly placeholder="your@email.com" style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Plan</label>
            <input value={subscription.tier === 'pro' ? 'Pro — Unlimited' : `Free — ${remaining} words left`} readOnly style={{ ...inp, opacity: 0.6, cursor: 'default' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Sessions</label>
            <input value={String(history.length)} readOnly style={{ ...inp, opacity: 0.6, cursor: 'default' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} style={{ padding: '10px 26px', borderRadius: 10, background: saveOk ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 8px 18px rgba(73,104,255,0.22)', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {saveOk ? '✓ Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── history ──────────────────────────────────────────────────────────────────

function HistoryPage({ history, setHistory, onNav }) {
  const [expanded, setExpanded] = useState(null);
  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94', accent: '#a8c7fa' };
  const actionColors = { humanize: '#a8c7fa', summarize: '#c4b5fd', expand: '#6ee7b7', fix_grammar: '#fcd34d' };

  function remove(id) {
    setHistory(prev => prev.filter(h => h.id !== id));
    if (expanded === id) setExpanded(null);
  }

  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>Processing History</h1>
        <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>{history.length} session{history.length !== 1 ? 's' : ''} total</p>
      </div>
      {history.length === 0 ? (
        <Empty icon={P.clock} text="No history yet. Start processing text to see results here." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((item) => {
            const color = actionColors[item.action] || C.accent;
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}80`, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ACTION_LABEL[item.action]}</span>
                      <span style={{ fontSize: 11, color: C.t3 }}>·</span>
                      <span style={{ fontSize: 11, color: C.t3 }}>{item.wordCount} words</span>
                      <span style={{ fontSize: 11, color: C.t3 }}>·</span>
                      <span style={{ fontSize: 11, color: C.t3 }}>{reltime(item.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.t2, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{item.outputText.slice(0, 90)}{item.outputText.length > 90 ? '…' : ''}"
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setExpanded(isOpen ? null : item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.accent, background: 'rgba(168,199,250,0.07)', border: `1px solid rgba(168,199,250,0.14)`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {isOpen ? 'Collapse' : 'View'}
                    </button>
                    <button onClick={() => remove(item.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 7, color: '#f87171', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.14)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}>
                      <Ic d={P.trash} s={14} />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: C.t1, margin: 0, whiteSpace: 'pre-wrap' }}>{item.outputText}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── saved docs ───────────────────────────────────────────────────────────────

function SavedDocsPage({ history, saved, setSaved, onNav }) {
  const [query,    setQuery]    = useState('');
  const [saveName, setSaveName] = useState('');
  const [savingId, setSavingId] = useState(null);
  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94', accent: '#a8c7fa' };

  const filtered = useMemo(() =>
    saved.filter(d => !query || d.name.toLowerCase().includes(query.toLowerCase()) || d.content.toLowerCase().includes(query.toLowerCase())),
    [saved, query]
  );

  function saveFromHistory(item) {
    const name = saveName.trim() || `${ACTION_LABEL[item.action]} – ${new Date(item.timestamp).toLocaleDateString()}`;
    setSaved(prev => [{ id: `d_${Date.now()}`, name, content: item.outputText, wordCount: item.wordCount, sizeBytes: new TextEncoder().encode(item.outputText).length, savedAt: new Date().toISOString() }, ...prev]);
    setSavingId(null); setSaveName('');
  }

  function remove(id) { setSaved(prev => prev.filter(d => d.id !== id)); }

  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>Saved Documents</h1>
          <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>{saved.length} document{saved.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.t3 }}><Ic d={P.search} s={14} /></span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.t1, fontSize: 13, outline: 'none', width: 'clamp(140px,25vw,200px)', fontFamily: 'inherit' }} />
        </div>
      </div>

      {saved.length === 0 ? (
        <Empty icon={P.bookmark} text="No saved documents yet. Process text and save the result." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: C.t3 }}>No documents match "{query}".</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px,30vw,280px), 1fr))', gap: 14, marginBottom: 32 }}>
          {filtered.map(doc => (
            <div key={doc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(168,199,250,0.08)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}>
                  <Ic d={P.doc} s={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.t1, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                  <p style={{ fontSize: 11, color: C.t3, margin: 0 }}>{reltime(doc.savedAt)} · {fmtBytes(doc.sizeBytes)}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, flex: 1, marginBottom: 12, color: C.t2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {doc.content.slice(0, 120)}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => navigator.clipboard.writeText(doc.content)}
                  style={{ fontSize: 12, color: C.accent, background: 'rgba(168,199,250,0.07)', border: `1px solid rgba(168,199,250,0.14)`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Copy</button>
                <button onClick={() => remove(doc.id)}
                  style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, margin: '0 0 12px' }}>Save from History</p>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {history.slice(0, 8).map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < Math.min(history.length, 8) - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.t1, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ACTION_LABEL[item.action]} · {reltime(item.timestamp)}
                  </p>
                  <p style={{ fontSize: 11, color: C.t3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.outputText.slice(0, 60)}…
                  </p>
                </div>
                {savingId === item.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                    <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Document name…" autoFocus
                      style={{ padding: '5px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.t1, fontSize: 12, outline: 'none', width: 130, fontFamily: 'inherit' }}
                      onKeyDown={e => { if (e.key === 'Enter') saveFromHistory(item); if (e.key === 'Escape') { setSavingId(null); setSaveName(''); } }} />
                    <button onClick={() => saveFromHistory(item)} style={{ fontSize: 12, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button onClick={() => { setSavingId(null); setSaveName(''); }} style={{ fontSize: 12, color: C.t3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setSavingId(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.accent, background: 'rgba(168,199,250,0.07)', border: `1px solid rgba(168,199,250,0.14)`, borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    <Ic d={P.save} s={13} /> Save
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── settings ─────────────────────────────────────────────────────────────────

function SettingsPage({ profile, subscription, onSignIn, onSignOut, onSaveProfile, onUpgrade, upgradeLoading, upgradeMessage }) {
  const [form,   setForm]   = useState({ name: profile.name, email: profile.email });
  const [saveOk, setSaveOk] = useState(false);
  useEffect(() => { setForm({ name: profile.name, email: profile.email }); }, [profile.name, profile.email]);

  function handleSave() {
    onSaveProfile({ ...form, name: form.name.trim() });
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  }

  const C = { card: 'rgba(255,255,255,0.04)', border: 'rgba(168,199,250,0.1)', t1: '#e3e3e3', t2: '#8e918f', t3: '#6b7a94', accent: '#a8c7fa' };
  const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,199,250,0.14)', color: C.t1, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' };
  const sectionLabel = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.t3, margin: '0 0 14px' };

  return (
    <div style={{ padding: 'clamp(20px,3vw,36px) clamp(16px,3vw,32px) 48px', maxWidth: 680 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: C.t1, margin: '0 0 5px' }}>Settings</h1>
        <p style={{ color: C.t2, fontSize: 13, margin: 0 }}>Manage your account and subscription.</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 18px', marginBottom: 14 }}>
        <p style={sectionLabel}>Profile</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" style={inp}
              onFocus={e => e.target.style.borderColor = 'rgba(168,199,250,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(168,199,250,0.14)'} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.t2, marginBottom: 5 }}>Email</label>
            <input type="email" value={form.email} readOnly placeholder="your@email.com" style={{ ...inp, opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
        </div>
        {profile.email.trim() === '' && (
          <p style={{ fontSize: 12, color: C.accent, margin: 0 }}>
            <button onClick={onSignIn} style={{ color: C.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline', fontFamily: 'inherit' }}>Sign in</button> to set your profile.
          </p>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 18px', marginBottom: 14 }}>
        <p style={sectionLabel}>Subscription</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{subscription.tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</span>
              <span style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#4ade80' }}>Active</span>
            </div>
            <p style={{ fontSize: 12, color: C.t2, margin: 0 }}>
              {subscription.tier === 'pro' ? `${PRO_PRICE_GHS} GHS / month · Unlimited processing` : `${wordsRemaining(subscription)} of ${FREE_WORD_LIMIT} free words remaining today`}
            </p>
          </div>
          {subscription.tier === 'pro' ? (
            <div style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(74,222,128,0.22)', color: '#4ade80', background: 'rgba(74,222,128,0.07)', fontSize: 12, fontWeight: 700 }}>Pro Active</div>
          ) : (
            <button onClick={onUpgrade} disabled={upgradeLoading} style={{ padding: '8px 16px', borderRadius: 9, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: upgradeLoading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: upgradeLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {upgradeLoading ? 'Redirecting…' : `Upgrade · ${PRO_PRICE_GHS} GHS`}
            </button>
          )}
        </div>
        {upgradeMessage && <p style={{ fontSize: 12, color: upgradeMessage.toLowerCase().includes('verified') ? '#4ade80' : C.t2, margin: '10px 0 0' }}>{upgradeMessage}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        {onSignOut && profile.email.trim() ? (
          <button onClick={onSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Ic d={P.signout} s={17} /> Sign Out
          </button>
        ) : <span />}
        <button onClick={handleSave} style={{ padding: '10px 26px', borderRadius: 10, background: saveOk ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 8px 18px rgba(73,104,255,0.22)', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {saveOk ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── auth wall ────────────────────────────────────────────────────────────────

function AuthWall({ onSignIn, pageName = 'this page' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(73,104,255,0.12)', border: '1px solid rgba(73,104,255,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8c7fa', marginBottom: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 26, fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}>lock</span>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e3e3e3', margin: '0 0 8px' }}>Sign in required</h2>
      <p style={{ fontSize: 14, color: '#8e918f', margin: '0 0 28px', maxWidth: 300, lineHeight: 1.6 }}>
        You need to be signed in to access {pageName}.
      </p>
      <button onClick={onSignIn} style={{ padding: '12px 32px', borderRadius: 12, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 12px 28px rgba(73,104,255,0.28)', fontFamily: 'inherit' }}>
        Sign In
      </button>
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────────────────

function Empty({ icon, text, action, onAction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(168,199,250,0.06)', border: '1px solid rgba(168,199,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7a94', marginBottom: 16 }}>
        <Ic d={icon} s={22} />
      </div>
      <p style={{ fontSize: 14, color: '#8e918f', marginBottom: 22, maxWidth: 280, lineHeight: 1.6 }}>{text}</p>
      {action && (
        <button onClick={onAction} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,#4968ff,#7c3cff)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 10px 22px rgba(73,104,255,0.24)', fontFamily: 'inherit' }}>
          {action}
        </button>
      )}
    </div>
  );
}

// ─── app ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'landing';
    try {
      return window.localStorage.getItem('hc-active-view') || 'landing';
    } catch {
      return 'landing';
    }
  });
  const [showSignIn, setShowSignIn] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [pendingView, setPendingView] = useState('tool');
  const [busyMessage, setBusyMessage] = useState('');
  const [pulseActive, setPulseActive] = useState(false);
  const [pricingNotice, setPricingNotice] = useState('');
  const [guestWordsUsed, setGuestWordsUsed] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      return Number(window.localStorage.getItem('hc-guest-words-used') || 0);
    } catch {
      return 0;
    }
  });
  const [guestUsageDate, setGuestUsageDate] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.localStorage.getItem('hc-guest-words-date') || '';
    } catch {
      return '';
    }
  });
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [subscription, setSubscription] = useState(DEFAULT_SUBSCRIPTION);
  const persistSignatureRef = useRef('');
  const handledPaymentRef = useRef('');
  const restoreAttemptRef = useRef('');
  const pulseTimeoutRef = useRef(null);
  const isSignedIn = Boolean(session?.user);
  const isPremium = subscription.tier === 'pro';
  const guestUsedToday = guestUsageDate === todayKey() ? guestWordsUsed : 0;
  const toolSubscription = isSignedIn
    ? subscription
    : { ...DEFAULT_SUBSCRIPTION, wordsUsed: guestUsedToday, usageDate: todayKey() };

  function beginBusy(message) {
    const startedAt = Date.now();
    setBusyMessage(message);
    return startedAt;
  }

  function triggerPulse() {
    setPulseActive(true);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => {
      setPulseActive(false);
    }, 260);
  }

  async function endBusy(startedAt) {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 320 - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    setBusyMessage('');
  }

  function navigateWithMorph(nextView) {
    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        setView(nextView);
      });
      return;
    }

    setView(nextView);
  }

  function applyUserState(user) {
    const nextState = normalizeUserState(user);
    persistSignatureRef.current = JSON.stringify(
      buildPersistedState(
        nextState.profile,
        nextState.history,
        nextState.saved,
        nextState.subscription,
      ),
    );
    setProfile(nextState.profile);
    setHistory(nextState.history);
    setSaved(nextState.saved);
    setSubscription(nextState.subscription);
  }

  function resetAppState() {
    persistSignatureRef.current = '';
    setProfile(DEFAULT_PROFILE);
    setHistory([]);
    setSaved([]);
    setSubscription(DEFAULT_SUBSCRIPTION);
  }

  async function persistUserState(nextProfile, nextHistory, nextSaved, nextSubscription, extraMetadata = {}) {
    if (!session?.user) {
      return null;
    }

    const nextState = buildPersistedState(nextProfile, nextHistory, nextSaved, nextSubscription);
    const signature = JSON.stringify(nextState);
    persistSignatureRef.current = signature;

    const supabase = getSupabaseBrowserClient();
    const payload = {
      ...session.user.user_metadata,
      ...extraMetadata,
      display_name: nextState.profile.name,
      plan: nextState.subscription.tier,
      usage_words: nextState.subscription.wordsUsed,
      app_state: nextState,
    };

    const { data, error } = await supabase.auth.updateUser({ data: payload });

    if (error) {
      persistSignatureRef.current = '';
      throw error;
    }

    if (data?.user) {
      applyUserState(data.user);
      setSession(prev => (prev ? { ...prev, user: data.user } : prev));
      return data.user;
    }

    setProfile(nextState.profile);
    setHistory(nextState.history);
    setSaved(nextState.saved);
    setSubscription(nextState.subscription);
    return null;
  }

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let authSubscription = null;
    let supabase;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      setAuthError(error.message);
      setAuthReady(true);
      return undefined;
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) setAuthError(error.message);

      const nextSession = data.session || null;
      setSession(nextSession);
      if (nextSession?.user) {
        applyUserState(nextSession.user);
      } else {
        resetAppState();
      }
      setAuthReady(true);
    }

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession?.user) {
        applyUserState(nextSession.user);
        setShowSignIn(false);
      } else {
        resetAppState();
      }
      setAuthReady(true);
    });

    authSubscription = data.subscription;

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !session?.user) return;

    const nextState = buildPersistedState(profile, history, saved, subscription);
    const signature = JSON.stringify(nextState);
    if (signature === persistSignatureRef.current) return;

    persistSignatureRef.current = signature;

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    (async () => {
      const { error } = await supabase.auth.updateUser({
        data: {
          ...session.user.user_metadata,
          display_name: nextState.profile.name,
          plan: nextState.subscription.tier,
          usage_words: nextState.subscription.wordsUsed,
          app_state: nextState,
        },
      });

      if (error && !cancelled) {
        setAuthError(error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user, profile, history, saved, subscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('hc-guest-words-used', String(guestWordsUsed));
      window.localStorage.setItem('hc-guest-words-date', guestUsageDate);
    } catch {}
  }, [guestWordsUsed, guestUsageDate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('hc-active-view', view);
    } catch {}
  }, [view]);

  useEffect(() => {
    if (!authReady || !session?.user || subscription.tier === 'pro') return;

    // Use the verified account email — never the editable profile email — so a user
    // can't restore Premium by typing in an address that paid on another account.
    const email = (session.user.email || profile.email || '').trim().toLowerCase();
    if (!email || restoreAttemptRef.current === email) return;

    restoreAttemptRef.current = email;

    (async () => {
      try {
        const res = await fetch('/api/paystack/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not check your Premium status.');
        if (!data.restored) return;

        const nextSubscription = {
          ...subscription,
          tier: 'pro',
          paymentStatus: 'active',
          lastPaymentReference: data.reference || subscription.lastPaymentReference,
          upgradedAt: data.paid_at || subscription.upgradedAt || new Date().toISOString(),
        };

        await persistUserState(profile, history, saved, nextSubscription, {
          plan: 'pro',
          paystack_reference: nextSubscription.lastPaymentReference,
          upgraded_at: nextSubscription.upgradedAt,
          payment_status: 'active',
        });

        setPaymentMessage('Premium restored on this account.');
      } catch (error) {
        restoreAttemptRef.current = '';
        setAuthError(error.message);
      }
    })();
  }, [authReady, session?.user, profile, history, saved, subscription]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Wait until auth has resolved. On a fresh redirect back from Paystack the session
    // loads asynchronously, so acting before authReady would mark the payment "handled"
    // before there is ever a user to apply the upgrade to — leaving a paid user on Free.
    if (!authReady) return;

    const url = new URL(window.location.href);
    const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
    const paystackStatus = url.searchParams.get('paystack');
    const targetView = url.searchParams.get('view');

    if (!reference || paystackStatus !== 'success' || handledPaymentRef.current === reference) {
      return;
    }

    // Don't mark as handled yet — once the user signs in, this effect re-runs with a
    // session and finishes applying the upgrade.
    if (!session?.user) {
      setPaymentMessage('Sign in again to finish applying your upgrade.');
      return;
    }

    handledPaymentRef.current = reference;
    setPaymentLoading(true);
    setPaymentMessage('');

    (async () => {
      try {
        const startedAt = beginBusy('Verifying payment...');
        const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not verify payment.');
        if (data.status !== 'success') throw new Error('Payment was not completed.');
        // Confirm the transaction actually paid for Pro (50 GHS = 5000 pesewas) so a
        // smaller/unrelated successful charge can't unlock Premium.
        if (Number(data.amount) < 5000 || data.currency !== 'GHS') {
          throw new Error('This payment did not match the Pro plan amount.');
        }

        const nextSubscription = {
          ...subscription,
          tier: 'pro',
          paymentStatus: 'active',
          lastPaymentReference: reference,
          upgradedAt: data.paid_at || new Date().toISOString(),
        };

        await persistUserState(profile, history, saved, nextSubscription, {
          plan: 'pro',
          paystack_reference: reference,
          upgraded_at: nextSubscription.upgradedAt,
          payment_status: 'active',
        });

        setPaymentMessage('Payment verified. Pro is now active.');
        if (targetView) {
          setView(targetView);
        }
        await endBusy(startedAt);
      } catch (error) {
        setPaymentMessage(error.message);
        setBusyMessage('');
      } finally {
        setPaymentLoading(false);
        url.searchParams.delete('reference');
        url.searchParams.delete('trxref');
        url.searchParams.delete('paystack');
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.pathname);
      }
    })();
  }, [authReady, session?.user, profile, history, saved, subscription]);

  function openAuth(mode = 'signin', nextView = 'tool', nextMessage = '') {
    triggerPulse();
    setAuthMode(mode);
    setAuthError('');
    setAuthMessage(nextMessage);
    setPendingView(nextView);
    setShowSignIn(true);
  }

  async function handleAuth(payload) {
    const startedAt = beginBusy(payload.mode === 'signup' ? 'Creating account...' : 'Signing in...');
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    try {
      const supabase = getSupabaseBrowserClient();

      if (payload.mode === 'signup') {
        // Validate the email before paying the cost of a Supabase signup.
        // Server-side check does format, disposable-domain, and DNS MX lookup.
        const quick = quickEmailCheck(payload.email);
        if (!quick.ok) throw new Error(emailErrorMessage(quick.reason));

        try {
          const validateRes = await fetch('/api/validate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: payload.email }),
          });
          const validateData = await validateRes.json().catch(() => ({}));
          if (!validateRes.ok || validateData?.ok === false) {
            throw new Error(emailErrorMessage(validateData?.reason || 'unknown'));
          }
        } catch (validateErr) {
          if (validateErr instanceof Error && validateErr.message) throw validateErr;
          throw new Error(emailErrorMessage('lookup-failed'));
        }

        const initialProfile = { name: payload.name, email: payload.email };
        const initialState = buildPersistedState(
          initialProfile,
          [],
          [],
          DEFAULT_SUBSCRIPTION,
        );

        const { data, error } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: payload.name,
              plan: 'free',
              usage_words: 0,
              app_state: initialState,
            },
          },
        });

        if (error) throw error;

        if (data.session?.user) {
          setSession(data.session);
          applyUserState(data.session.user);
          setShowSignIn(false);
          setView(pendingView || 'tool');
          // fire-and-forget welcome email
          fetch('/api/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: payload.name, email: payload.email }),
          }).catch(() => {});
        } else {
          // email confirmation still enabled in Supabase — ask user to confirm
          setAuthMode('signin');
          setAuthMessage('Account created! Check your inbox for a confirmation link, then sign in.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password: payload.password,
        });

        if (error) throw error;

        setSession(data.session);
        applyUserState(data.user);
        setShowSignIn(false);
        setView(pendingView || 'tool');
      }
    } catch (error) {
      setAuthError(normalizeAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
      await endBusy(startedAt);
    }
  }

  async function handleSignOut() {
    const startedAt = beginBusy('Signing out...');
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      setAuthError(error.message || 'Could not sign out.');
    } finally {
      resetAppState();
      setSession(null);
      setShowSignIn(false);
      setView('landing');
      await endBusy(startedAt);
    }
  }

  function requestNavigation(nextView, mode = 'signin') {
    triggerPulse();

    if (nextView === 'landing') {
      navigateWithMorph('landing');
      return;
    }

    if (nextView === 'pricing') {
      setPricingNotice('');
      navigateWithMorph('pricing');
      return;
    }

    if (nextView === 'tool') {
      navigateWithMorph('tool');
      return;
    }

    if (SIGNIN_VIEWS.has(nextView) && !isSignedIn) {
      openAuth('signin', nextView, 'Sign in to open this section.');
      return;
    }

    if (!isSignedIn) {
      openAuth(mode, nextView, 'Sign in to access this workspace section.');
      return;
    }

    navigateWithMorph(nextView);
  }

  function handleEnterDashboard(mode = 'signup') {
    requestNavigation('dashboard', mode);
  }

  function handleLandingTool() {
    triggerPulse();
    setShowSignIn(false);
    navigateWithMorph('tool');
  }

  function handleEnterTool(mode = 'signup') {
    requestNavigation('tool', mode);
  }

  function handleSaveProfile(nextProfile) {
    setProfile(prev => ({
      ...prev,
      name: nextProfile.name || prev.name,
      email: session?.user?.email || prev.email,
    }));
  }

  function handleUsageAdd(words) {
    setSubscription(prev => {
      const today = todayKey();
      const base = prev.usageDate === today ? Number(prev.wordsUsed || 0) : 0;
      return { ...prev, usageDate: today, wordsUsed: base + Number(words || 0) };
    });
  }

  function handleGuestUsageAdd(words) {
    const today = todayKey();
    const carried = guestUsageDate === today ? guestWordsUsed : 0;
    setGuestUsageDate(today);
    setGuestWordsUsed(carried + Number(words || 0));
  }

  async function handleUpgrade() {
    if (!session?.user) {
      openAuth('signup');
      setPaymentMessage('Create an account before upgrading to Pro.');
      return;
    }

    const startedAt = beginBusy('Preparing checkout...');
    setPaymentLoading(true);
    setPaymentMessage('');

    try {
      const callbackUrl = `${window.location.origin}/?paystack=success&view=dashboard`;
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email || session.user.email,
          name: profile.name,
          callbackUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start checkout.');
      if (!data.authorization_url) throw new Error('Could not start checkout.');
      await endBusy(startedAt);
      window.location.href = data.authorization_url;
    } catch (error) {
      setPaymentLoading(false);
      setPaymentMessage(error.message || 'Could not start checkout.');
      await endBusy(startedAt);
    }
  }

  if (view === 'landing') {
    return (
      <>
        <TopProgress active={pulseActive || Boolean(busyMessage)} />
        <LoadingOverlay open={Boolean(busyMessage)} message={busyMessage} />
        {showSignIn && (
          <SignInModal
            onClose={() => setShowSignIn(false)}
            onAuth={handleAuth}
            mode={authMode}
            onModeChange={setAuthMode}
            loading={authLoading}
            error={authError}
            message={authMessage}
          />
        )}
        <Landing
          onStart={handleLandingTool}
          onSignIn={() => handleEnterDashboard('signin')}
          isSignedIn={isSignedIn}
          profile={profile}
          onSignOut={handleSignOut}
        />
      </>
    );
  }

  const shellPrimaryClick = () => {
    if (isSignedIn) {
      requestNavigation(view === 'dashboard' ? 'tool' : 'dashboard');
    } else {
      openAuth('signup', view === 'landing' ? 'tool' : view);
    }
  };
  const shellSecondaryClick = () => openAuth('signin', view === 'landing' ? 'tool' : view);

  if (view === 'tool') {
    return (
      <>
        <TopProgress active={pulseActive || Boolean(busyMessage)} />
        <LoadingOverlay open={Boolean(busyMessage)} message={busyMessage} />
        {showSignIn && (
          <SignInModal
            onClose={() => setShowSignIn(false)}
            onAuth={handleAuth}
            mode={authMode}
            onModeChange={setAuthMode}
            loading={authLoading}
            error={authError}
            message={authMessage}
          />
        )}
        <AppShell
          page="tool"
          onNav={requestNavigation}
          isSignedIn={Boolean(session?.user)}
          subscription={subscription}
          profile={profile}
          onPrimaryClick={shellPrimaryClick}
          onSecondaryClick={shellSecondaryClick}
          onSignOut={isSignedIn ? handleSignOut : undefined}
        >
          <HumanizerTool
            history={history}
            setHistory={setHistory}
            subscription={toolSubscription}
            isSignedIn={Boolean(session?.user)}
            onRequireAuth={openAuth}
            onUsageAdd={isSignedIn ? handleUsageAdd : handleGuestUsageAdd}
            onNav={requestNavigation}
          />
        </AppShell>
      </>
    );
  }

  return (
    <>
      <TopProgress active={pulseActive || Boolean(busyMessage)} />
      <LoadingOverlay open={Boolean(busyMessage)} message={busyMessage} />

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onAuth={handleAuth}
          mode={authMode}
          onModeChange={setAuthMode}
          loading={authLoading}
          error={authError}
          message={authMessage}
        />
      )}

      <AppShell
        page={view}
        onNav={requestNavigation}
        isSignedIn={isSignedIn}
        subscription={subscription}
        profile={profile}
        onPrimaryClick={shellPrimaryClick}
        onSecondaryClick={shellSecondaryClick}
        onSignOut={isSignedIn ? handleSignOut : undefined}
        scroll
      >
        <div key={`${view}-${isSignedIn ? 'auth' : 'guest'}`} className="page-fade surface-fade" style={{ flex: '1 1 auto', minHeight: 0 }}>
          {view === 'pricing'   && <PricingPage subscription={subscription} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} isSignedIn={isSignedIn} onSignIn={() => openAuth('signin', 'pricing')} notice={pricingNotice} />}
          {view === 'dashboard' && (!isSignedIn ? <AuthWall onSignIn={() => openAuth('signin', 'dashboard')} pageName="the Dashboard" /> : <Dashboard history={history} saved={saved} onNav={requestNavigation} subscription={subscription} profile={profile} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} />)}
          {view === 'profile'   && (!isSignedIn ? <AuthWall onSignIn={() => openAuth('signin', 'profile')} pageName="your Profile" /> : <ProfilePage profile={profile} subscription={subscription} history={history} saved={saved} onSaveProfile={handleSaveProfile} />)}
          {view === 'history'   && (!isSignedIn ? <AuthWall onSignIn={() => openAuth('signin', 'history')} pageName="your History" /> : <HistoryPage history={history} setHistory={setHistory} onNav={requestNavigation} />)}
          {view === 'saved'     && (!isSignedIn ? <AuthWall onSignIn={() => openAuth('signin', 'saved')} pageName="Saved Documents" /> : <SavedDocsPage history={history} saved={saved} setSaved={setSaved} onNav={requestNavigation} />)}
          {view === 'settings'  && (!isSignedIn ? <AuthWall onSignIn={() => openAuth('signin', 'settings')} pageName="Settings" onSignOut={handleSignOut} /> : <SettingsPage profile={profile} subscription={subscription} onSignIn={() => openAuth('signin', 'settings')} onSignOut={handleSignOut} onSaveProfile={handleSaveProfile} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} />)}
        </div>
      </AppShell>
    </>
  );
}
