'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase';

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
function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length === 0) return { score: 0, label: 'Enter a password', color: '#64748b' };
  if (score <= 1) return { score: 1, label: 'Weak', color: '#f87171' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#fbbf24' };
  if (score === 3) return { score: 3, label: 'Good', color: '#60a5fa' };
  return { score: 4, label: 'Strong', color: '#34d399' };
}
function wordsRemaining(subscription) {
  if (subscription.tier === 'pro') return Infinity;
  return Math.max(0, FREE_WORD_LIMIT - Number(subscription.wordsUsed || 0));
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
    },
  };
}

const UPLOAD_ACCEPT =
  '.txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ─── icon ─────────────────────────────────────────────────────────────────────

function Ic({ d, s = 20 }) {
  return (
    <svg width={s} height={s} fill="none" stroke="currentColor" viewBox="0 0 24 24"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const P = {
  pen:      'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931z',
  grid:     'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z',
  clock:    'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  bookmark: 'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z',
  gear:     'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  sun:      'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z',
  moon:     'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998z',
  upload:   'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5',
  copy:     'M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9z',
  check:    'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  signout:  'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  doc:      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z',
  search:   'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z',
  arrow:    'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  trash:    'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
  star:     'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z',
  save:     'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  menu:     'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  spark:    'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z',
  check2:   'M4.5 12.75l6 6 9-13.5',
  zap:      'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  shield:   'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  user:     'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  mail:     'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  close:    'M6 18 18 6M6 6l12 12',
  eye:      'M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5s8.577 3.01 9.964 7.178c.07.21.07.434 0 .644C20.577 16.49 16.64 19.5 12 19.5s-8.577-3.01-9.964-7.178zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  eyeOff:   'M3 3l18 18M10.477 10.482A3 3 0 0 0 13.5 13.5m2.121 2.121A9.77 9.77 0 0 1 12 16.5c-4.64 0-8.577-3.01-9.964-7.178a1.01 1.01 0 0 1 0-.644 10.96 10.96 0 0 1 3.043-4.568M9.88 5.084A10.935 10.935 0 0 1 12 4.5c4.64 0 8.577 3.01 9.964 7.178.07.21.07.434 0 .644a10.956 10.956 0 0 1-1.678 3.043M6.228 6.228A3 3 0 0 0 10.5 10.5',
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

    const lineRGB = '99,102,241';
    const dotRGB  = isDark ? '139,92,246' : '99,102,241';
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
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: compact ? 26 : 30,
        border: '1px solid rgba(99,102,241,0.18)',
        background: 'linear-gradient(180deg, rgba(8,12,24,0.96), rgba(7,10,20,0.92))',
        boxShadow: compact
          ? '0 24px 90px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.14)'
          : '0 28px 110px rgba(0,0,0,0.55), 0 0 50px rgba(99,102,241,0.16)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 16%, rgba(99,102,241,0.22), transparent 36%), radial-gradient(circle at 82% 24%, rgba(139,92,246,0.18), transparent 30%), radial-gradient(circle at 50% 100%, rgba(56,189,248,0.12), transparent 36%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.1) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.24, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: compact ? '24px 24px 22px' : '26px 26px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.7)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd' }}>Deep Scan</span>
          </div>
          <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)', color: '#4ade80', fontSize: 11, fontWeight: 700 }}>
            Human
          </div>
        </div>

        <div style={{ borderRadius: 20, border: '1px solid rgba(99,102,241,0.14)', background: 'rgba(255,255,255,0.02)', padding: compact ? 18 : 20, marginBottom: 20 }}>
          {[
            'Regular movement helps your brain stay sharp over time.',
            'It strengthens memory, supports focus, and lowers the strain caused by long sedentary stretches.',
            'Even light exercise can improve mood, while consistent weekly cardio supports stronger long-term cognitive health.',
          ].map((line) => (
            <div key={line} style={{ display: 'inline', lineHeight: 1.9 }}>
              <span style={{ background: 'rgba(52,211,153,0.14)', color: '#86efac', borderRadius: 7, padding: '2px 5px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', fontSize: compact ? 13 : 14 }}>
                {line}
              </span>{' '}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '100px 1fr' : '110px 1fr', gap: 18, alignItems: 'center' }}>
          <div style={{ width: compact ? 88 : 96, height: compact ? 88 : 96, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center', background: 'conic-gradient(#22c55e 0deg 340deg, rgba(255,255,255,0.08) 340deg 360deg)', boxShadow: '0 0 28px rgba(34,197,94,0.16)' }}>
            <div style={{ width: compact ? 62 : 68, height: compact ? 62 : 68, borderRadius: '50%', background: '#08101b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontWeight: 800, fontSize: compact ? 22 : 24 }}>
              97%
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', color: '#4ade80', fontSize: compact ? 26 : 30, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', lineHeight: 1 }}>
              97% Human
            </p>
            <p style={{ margin: '0 0 10px', color: '#94a3b8', fontSize: compact ? 13 : 14, lineHeight: 1.6 }}>
              HumanClarity highlights natural phrasing while preserving meaning and tone.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 999, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)', color: '#c4b5fd', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
          background: 'linear-gradient(90deg, rgba(99,102,241,0), rgba(129,140,248,0.95), rgba(192,132,252,0.95), rgba(99,102,241,0))',
          boxShadow: '0 0 18px rgba(99,102,241,0.65)',
        }}
      />
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
          border: '1px solid rgba(99,102,241,0.24)',
          color: '#f8fafc',
          boxShadow: '0 0 40px rgba(99,102,241,0.18)',
        }}
      >
        <span
          className="spin-soft"
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid rgba(129,140,248,0.18)',
            borderTopColor: '#a5b4fc',
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
  const strength = useMemo(() => passwordStrength(password), [password]);

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
      setLocalError(err.message || 'Could not resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  }

  const inp = {
    width: '100%', padding: '13px 14px', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.18)',
    color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  };
  const eyeBtn = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(99,102,241,0.14)',
    background: 'rgba(255,255,255,0.03)', color: '#a5b4fc', cursor: 'pointer',
  };
  const showStrengthMeter = mode === 'signup';
  const fullSpan = mode === 'signup' ? { gridColumn: '1 / -1' } : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="page-fade surface-fade" style={{ width: 'min(1120px, 100%)', background: 'linear-gradient(160deg, #0a0e22, #07091a)', border: '1px solid rgba(99,102,241,0.24)', borderRadius: 30, position: 'relative', boxShadow: '0 0 100px rgba(99,102,241,0.22), 0 35px 70px rgba(0,0,0,0.62)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, left: '18%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.28), transparent 70%)', filter: 'blur(48px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -110, right: '10%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.22), transparent 72%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 30, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.09) 1px, transparent 1px)', backgroundSize: '30px 30px', pointerEvents: 'none', opacity: 0.75 }} />

        <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#64748b', cursor: 'pointer', zIndex: 2 }}>
          <Ic d={P.close} s={14} />
        </button>

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
          <div style={{ padding: '32px 30px 28px', borderRight: '1px solid rgba(99,102,241,0.12)', minWidth: 0 }}>
            <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22, padding: 0, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Ic d={P.arrow} s={14} /> Back to home
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <img src="/HumanClarity AI icon.png" alt="" style={{ width: 42, height: 42, objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(99,102,241,0.8)) drop-shadow(0 0 30px rgba(139,92,246,0.35))' }} />
              <div>
                <p style={{ margin: 0, color: '#f8fafc', fontWeight: 700, fontSize: 16, fontFamily: '"Space Grotesk", sans-serif' }}>HumanClarity AI</p>
                <p style={{ margin: '2px 0 0', color: '#818cf8', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Natural writing, fast</p>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 'clamp(30px, 4.3vw, 40px)', fontWeight: 700, color: '#f1f5f9', fontFamily: '"Space Grotesk", sans-serif', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.02 }}>
                {mode === 'signup' ? 'Create your HumanClarity space' : 'Sign in to your account'}
              </h2>
              <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6, maxWidth: 480 }}>
                {mode === 'signup'
                  ? 'Create an account to save documents, track usage, and unlock upgrades from the dashboard.'
                  : 'Sign in to continue reviewing, saving, and refining your writing.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, gridTemplateColumns: mode === 'signup' ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr' }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <Ic d={P.user} s={12} /> Full Name
                  </label>
                  <input
                    value={name}
                    onChange={e => { setName(e.target.value); setLocalError(''); }}
                    placeholder="Full name"
                    style={inp}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.18)'; e.target.style.boxShadow = 'none'; }}
                    autoFocus
                  />
                </div>
              )}

              <div style={mode === 'signup' ? null : fullSpan}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <Ic d={P.mail} s={12} /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLocalError(''); }}
                  placeholder="m@example.com"
                  style={inp}
                  onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.18)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  <Ic d={P.shield} s={12} /> Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setLocalError(''); }}
                    placeholder="At least 6 characters"
                    style={{ ...inp, paddingRight: 52 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.18)'; e.target.style.boxShadow = 'none'; }}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 7, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    <Ic d={P.check2} s={12} /> Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setLocalError(''); }}
                      placeholder="Repeat your password"
                      style={{ ...inp, paddingRight: 52 }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.56)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(99,102,241,0.18)'; e.target.style.boxShadow = 'none'; }}
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
                  style={{ ...fullSpan, padding: 0, background: 'transparent', border: 'none', color: '#a5b4fc', textAlign: 'left', fontSize: 12, cursor: resendLoading ? 'wait' : 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                >
                  {resendLoading ? 'Resending confirmation email…' : 'Resend confirmation email'}
                </button>
              )}

              <button type="submit" disabled={loading} style={{ ...fullSpan, width: '100%', padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'wait' : 'pointer', boxShadow: '0 0 30px rgba(99,102,241,0.46)', fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '0.01em', animation: loading ? 'none' : 'pulse-glow 3s ease-in-out infinite', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Working…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>

              <div style={{ ...fullSpan, display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 4px', color: '#475569' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.14)' }} />
                <span style={{ fontSize: 12 }}>{mode === 'signup' ? 'Already have an account?' : 'Need an account?'}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(99,102,241,0.14)' }} />
              </div>

              <button
                type="button"
                onClick={() => onModeChange(mode === 'signup' ? 'signin' : 'signup')}
                style={{ ...fullSpan, width: '100%', padding: '13px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.02)', color: '#f8fafc', fontWeight: 600, fontSize: 14, border: '1px solid rgba(99,102,241,0.14)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {mode === 'signup' ? 'Go to Sign In' : 'Create Account'}
              </button>
            </form>
          </div>

          <div style={{ padding: '24px', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
            <div style={{ width: '100%', maxWidth: 520 }}>
              <DetectionPreview compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing({ onStart, onSignIn }) {
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

  const heroBg  = isDark ? 'radial-gradient(ellipse at 50% 70%, rgba(79,70,229,0.14) 0%, transparent 65%), #050814' : 'radial-gradient(ellipse at 50% 70%, rgba(99,102,241,0.08) 0%, transparent 65%), #f0f4ff';
  const bodyBg  = isDark ? '#050814' : '#f0f4ff';
  const featBg  = isDark ? '#07091c' : '#ffffff';
  const stepsBg = isDark ? '#060916' : '#f8fafc';
  const text1   = isDark ? '#f8fafc' : '#0f172a';
  const text2   = isDark ? '#94a3b8' : '#475569';
  const text3   = isDark ? '#64748b' : '#94a3b8';
  const cardBg  = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.04)';
  const cardBdr = isDark ? 'rgba(99,102,241,0.22)'   : 'rgba(99,102,241,0.18)';
  const navBg   = isDark ? 'rgba(5,8,20,0.82)' : 'rgba(255,255,255,0.82)';
  const navBdr  = isDark ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.2)';

  return (
    <div className="page-fade" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: bodyBg, color: text1 }}>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: navBg, backdropFilter: 'blur(22px)', borderBottom: `1px solid ${navBdr}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/HumanClarity AI icon.png" alt="HumanClarity AI" style={{ height: 38, filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.7))' }} />
          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 17, background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.01em' }}>HumanClarity AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onSignIn} style={{ padding: '9px 16px', borderRadius: 10, background: 'transparent', color: '#cbd5e1', fontWeight: 600, fontSize: 13, border: '1px solid rgba(99,102,241,0.16)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign In
          </button>
          <button onClick={onStart} style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 0 22px rgba(99,102,241,0.38)' }}>
            Get Started Free
          </button>
        </div>
      </nav>

      <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '96px 24px 120px', background: heroBg }}>
        <ParticleCanvas count={80} isDark={isDark} />
        <div style={{ position: 'absolute', top: '4%', left: '-8%', width: 640, height: 640, borderRadius: '50%', background: isDark ? 'radial-gradient(circle,rgba(99,102,241,0.24) 0%,transparent 70%)' : 'radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)', filter: 'blur(80px)', animation: 'drift1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '22%', right: '-10%', width: 720, height: 720, borderRadius: '50%', background: isDark ? 'radial-gradient(circle,rgba(139,92,246,0.2) 0%,transparent 70%)' : 'radial-gradient(circle,rgba(139,92,246,0.08) 0%,transparent 70%)', filter: 'blur(100px)', animation: 'drift2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '12%', left: '22%', width: 420, height: 420, borderRadius: '50%', background: isDark ? 'radial-gradient(circle,rgba(56,189,248,0.14) 0%,transparent 70%)' : 'radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 70%)', filter: 'blur(60px)', animation: 'drift3 11s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.18) 1px, transparent 1px)', backgroundSize: '46px 46px', pointerEvents: 'none', opacity: isDark ? 0.7 : 0.5 }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1180, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 44, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid rgba(99,102,241,0.42)', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)', padding: '6px 18px', marginBottom: 28, backdropFilter: 'blur(12px)', animation: 'float-y 3.5s ease-in-out infinite' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 10px rgba(99,102,241,0.9), 0 0 22px rgba(99,102,241,0.5)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isDark ? '#a5b4fc' : '#4f46e5', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Natural writing, faster</span>
            </div>

            <h1 style={{ fontSize: 'clamp(42px, 6.4vw, 78px)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.04em', margin: '0 0 20px', fontFamily: '"Space Grotesk", sans-serif', maxWidth: 620 }}>
              <span style={{ display: 'block', color: text1 }}>Make Your AI Text</span>
              <span style={{ display: 'block', background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 52%, #67e8f9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: isDark ? 'drop-shadow(0 0 30px rgba(129,140,248,0.65))' : 'none' }}>
                Sound Fully Human
              </span>
            </h1>

            <p style={{ fontSize: 17, color: text2, lineHeight: 1.8, maxWidth: 520, margin: '0 0 34px' }}>
              Beat Turnitin, GPTZero, ZeroGPT, Originality.ai, and other detectors.
            </p>

            <p style={{ fontSize: 14, color: text3, lineHeight: 1.7, maxWidth: 520, margin: '-10px 0 34px', letterSpacing: '0.01em' }}>
              Perfect for assignments, theses, reports, and professional documents.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
              <button onClick={onStart} style={{ padding: '16px 34px', borderRadius: 14, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', animation: 'pulse-glow 3s ease-in-out infinite', letterSpacing: '0.01em', fontFamily: '"Space Grotesk", sans-serif' }}>
                Start for Free
              </button>
              <button onClick={onSignIn} style={{ padding: '15px 24px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontWeight: 600, fontSize: 15, border: '1px solid rgba(99,102,241,0.18)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign In
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {previewFeatures.map((item) => (
                <span key={item} style={{ fontSize: 12, color: text3, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Ic d={P.check2} s={12} /> {item}
                </span>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-8% -6% auto 12%', height: 120, background: 'radial-gradient(circle, rgba(99,102,241,0.28), transparent 68%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <DetectionPreview />
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 130, background: `linear-gradient(to top, ${isDark ? '#050814' : '#f0f4ff'}, transparent)`, pointerEvents: 'none' }} />
      </section>

      <section style={{ padding: '100px 24px', position: 'relative', background: featBg }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 700, height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.45), transparent)' }} />
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 58 }}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 700, color: text1, marginBottom: 12, fontFamily: '"Space Grotesk", sans-serif' }}>Everything you need</h2>
            <p style={{ color: text2, fontSize: 16 }}>Professional writing tools powered by Claude AI</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} style={{ position: 'relative', background: cardBg, backdropFilter: 'blur(14px)', border: `1px solid ${cardBdr}`, borderRadius: 20, padding: 28, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 110, height: 110, background: 'radial-gradient(circle at top right, rgba(99,102,241,0.28), transparent 68%)', borderRadius: '0 20px 0 0', pointerEvents: 'none' }} />
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#818cf8', boxShadow: '0 0 18px rgba(99,102,241,0.28)' }}>
                  <Ic d={f.icon} s={22} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: text1, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: text2 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '100px 24px', background: stepsBg, borderTop: `1px solid ${isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)'}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 350, background: 'radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 700, color: text1, marginBottom: 64, fontFamily: '"Space Grotesk", sans-serif' }}>Three steps to better writing</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 44 }}>
            {steps.map((s) => (
              <div key={s.n} style={{ textAlign: 'center' }}>
                <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 19, fontWeight: 800, color: '#fff', boxShadow: '0 0 26px rgba(99,102,241,0.55), 0 0 65px rgba(99,102,241,0.22)', fontFamily: '"Space Grotesk", sans-serif' }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: text1, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.68, color: text2 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '130px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden', background: bodyBg }}>
        <ParticleCanvas count={45} isDark={isDark} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 900, height: 400, background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)', filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.16) 1px, transparent 1px)', backgroundSize: '38px 38px', pointerEvents: 'none', opacity: isDark ? 0.75 : 0.5 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 58px)', fontWeight: 700, color: text1, marginBottom: 16, fontFamily: '"Space Grotesk", sans-serif' }}>Ready to get started?</h2>
          <p style={{ color: text2, marginBottom: 40, fontSize: 17, maxWidth: 400, margin: '0 auto 42px' }}>Join writers and students who use HumanClarity every day.</p>
          <button onClick={onStart} style={{ padding: '18px 52px', borderRadius: 16, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 18, border: 'none', cursor: 'pointer', animation: 'pulse-glow 3s ease-in-out infinite', letterSpacing: '0.01em', fontFamily: '"Space Grotesk", sans-serif' }}>
            Launch the App
          </button>
        </div>
      </section>

      <footer style={{ padding: '22px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, borderTop: `1px solid ${isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)'}`, background: bodyBg, fontSize: 13, color: text3 }}>
        <button onClick={onStart} style={{ color: text3, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
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

function Sidebar({ page, onNav, open, onClose, subscription }) {
  function NavBtn({ id, label, icon }) {
    const active = page === id;
    return (
      <button
        onClick={() => onNav(id)}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 11, marginBottom: 3,
          background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
          color: active ? '#a5b4fc' : 'rgba(148,163,184,0.65)',
          border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 600 : 400,
          borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
          paddingLeft: active ? '10px' : '12px',
          boxShadow: active ? 'inset 0 0 20px rgba(99,102,241,0.07), 0 0 12px rgba(99,102,241,0.1)' : 'none',
          transition: 'all 0.18s', textAlign: 'left', fontFamily: 'inherit',
          transform: active ? 'translateX(0)' : 'translateX(0)',
        }}
        title={label}
        onMouseEnter={e => {
          if (!active) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = '#cbd5e1';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.boxShadow = '0 0 16px rgba(99,102,241,0.08)';
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(148,163,184,0.65)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
      >
        <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>
          <Ic d={P[icon]} s={17} />
        </span>
        <span style={{ flex: 1 }}>{label}</span>
        {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.9)', flexShrink: 0 }} />}
      </button>
    );
  }

  return (
    <>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
          className="lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-52 flex-col transition-transform duration-200 lg:relative lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#06090f', borderRight: '1px solid rgba(99,102,241,0.12)', width: 210 }}
      >
        {/* subtle grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

        {/* ambient glow at top */}
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

        {/* logo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src="/HumanClarity AI icon.png" alt="" style={{ width: 38, height: 38, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.7))' }} />
          </div>
          <div>
            <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 13.5, fontFamily: '"Space Grotesk", sans-serif', margin: 0, lineHeight: 1.2 }}>HumanClarity</p>
            <p style={{ color: '#4f46e5', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.07em', margin: 0, marginTop: 2 }}>AI WRITING TOOL</p>
          </div>
        </div>

        {/* nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', position: 'relative', zIndex: 1 }}>
          {NAV.map(({ id, label, icon }) => (
            <NavBtn key={id} id={id} label={label} icon={icon} />
          ))}
        </nav>

        {/* bottom */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(99,102,241,0.1)', position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => onNav('pricing')}
            style={{
              width: '100%',
              padding: '12px 12px',
              borderRadius: 14,
              marginBottom: 10,
              background: subscription.tier === 'pro'
                ? 'rgba(52,211,153,0.1)'
                : 'linear-gradient(135deg, rgba(79,70,229,0.98), rgba(124,58,237,0.98))',
              color: '#fff',
              border: subscription.tier === 'pro'
                ? '1px solid rgba(52,211,153,0.24)'
                : '1px solid rgba(99,102,241,0.28)',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: subscription.tier === 'pro'
                ? '0 0 18px rgba(52,211,153,0.14)'
                : '0 0 22px rgba(99,102,241,0.28)',
              fontFamily: 'inherit',
            }}
            title={subscription.tier === 'pro' ? 'View pricing' : 'Upgrade to Premium'}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {subscription.tier === 'pro' ? 'Premium Active' : 'Upgrade to Premium'}
              </span>
              <Ic d={P.zap} s={14} />
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: subscription.tier === 'pro' ? '#86efac' : 'rgba(255,255,255,0.82)' }}>
              Unlock unlimited use and more
            </div>
          </button>
          <NavBtn id="settings" label="Settings" icon="gear" />
        </div>
      </aside>
    </>
  );
}

// ─── header ───────────────────────────────────────────────────────────────────

function Header({ profile, onSignOut, onSignIn, onMenuOpen }) {
  const isSignedIn = Boolean(profile.name.trim() || profile.email.trim());

  return (
    <header style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 0 20px', background: 'rgba(6,9,15,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(99,102,241,0.12)', position: 'relative', zIndex: 10 }}>
      <button className="lg:hidden" onClick={onMenuOpen} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', marginRight: 8 }}>
        <Ic d={P.menu} s={22} />
      </button>
      <div className="block" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isSignedIn ? (
          <>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: '0 0 14px rgba(99,102,241,0.5)', cursor: 'default', userSelect: 'none' }}>
              {initials(profile.name)}
            </div>
            <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 500, color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name || profile.email}</span>
            <button onClick={onSignOut}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.2)', color: '#64748b', background: 'transparent', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.color = '#64748b'; }}>
              <Ic d={P.signout} s={15} /> Sign Out
            </button>
          </>
        ) : (
          <button onClick={onSignIn}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 0 18px rgba(99,102,241,0.38)' }}>
            <Ic d={P.user} s={14} /> Sign In
          </button>
        )}
      </div>
    </header>
  );
}

// ─── app background ───────────────────────────────────────────────────────────

function AppBg() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <div style={{ position: 'absolute', top: '8%', right: '-8%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)', filter: 'blur(90px)', animation: 'drift1 25s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '5%', left: '-5%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)', filter: 'blur(80px)', animation: 'drift3 32s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.055) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
    </div>
  );
}

// ─── humanizer tool ───────────────────────────────────────────────────────────

function HumanizerTool({ history, setHistory, subscription, isSignedIn, onRequireAuth, onUsageAdd }) {
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
  const fileRef   = useRef(null);
  const wordCount = useMemo(() => wc(input), [input]);
  const remaining = wordsRemaining(subscription);
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
            ? `Your free plan limit of ${FREE_WORD_LIMIT} words is used up. Upgrade to Pro for unlimited processing.`
            : `Guest access is limited to ${FREE_WORD_LIMIT} words. Sign in or upgrade to keep going.`,
        );
        return;
      }
      if (wordCount > remaining) {
        setError(`This document uses ${wordCount} words, but your free plan has ${remaining} words left.`);
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
            ? `Your free plan limit of ${FREE_WORD_LIMIT} words is used up. Upgrade to Pro for unlimited processing.`
            : `Guest access is limited to ${FREE_WORD_LIMIT} words. Sign in or upgrade to keep going.`,
        );
        return;
      }
      if (wordCount > remaining) {
        setError(`This document uses ${wordCount} words, but your free plan has ${remaining} words left.`);
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
        body: JSON.stringify({ text: firstData.result, action: 'humanize' }),
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

  const glass = { background: 'var(--glass)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-b)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', minHeight: '100%' }}>

      {/* header */}
      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 600 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <img src="/HumanClarity AI icon.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.7))' }} />
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 4vw, 38px)', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', margin: '0 0 10px' }}>
          <span style={{ color: 'var(--text1)' }}>Humanize Your </span>
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>AI Text</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 15, margin: 0 }}>Make AI-generated content undetectable.</p>
      </div>

      <div style={{ width: '100%', maxWidth: 740 }}>
        <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 16, background: subscription.tier === 'pro' ? 'rgba(52,211,153,0.08)' : 'rgba(99,102,241,0.08)', border: subscription.tier === 'pro' ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(99,102,241,0.18)', color: subscription.tier === 'pro' ? '#86efac' : '#c4b5fd', fontSize: 13 }}>
          {subscription.tier === 'pro'
            ? `Pro plan active. Unlimited processing unlocked.`
            : isSignedIn
              ? `Free plan: ${remaining} of ${FREE_WORD_LIMIT} words remaining.`
              : `Guest mode: ${remaining} of ${FREE_WORD_LIMIT} free words remaining. Sign in to save your usage and unlock upgrades.`}
        </div>

        {/* input card */}
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(99,102,241,0.05), 0 20px 50px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--glass-b)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>Input</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{wordCount} words</span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your AI text here or upload a document to begin..."
            style={{ minHeight: 200, width: '100%', resize: 'none', background: 'transparent', padding: '16px 18px', color: 'var(--text1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', lineHeight: 1.7, fontFamily: 'inherit' }}
            disabled={loading || uploading}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--glass-b)' }}>
            <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} style={{ display: 'none' }} onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()}
              disabled={loading || uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--glass-b)', color: 'var(--text2)', background: 'transparent', cursor: (loading || uploading) ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'border-color 0.15s', opacity: (loading || uploading) ? 0.5 : 1 }}>
              <Ic d={P.upload} s={13} /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>PDF, DOCX, TXT</span>
            <div style={{ flex: 1 }} />
            {toolActions.map(action => (
              <button key={action.id} onClick={() => toggleAction(action.id)}
                disabled={loading || uploading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: selectedAction === action.id ? '1px solid rgba(129,140,248,0.55)' : '1px solid var(--glass-b)', color: selectedAction === action.id ? '#e9d5ff' : 'var(--text2)', background: selectedAction === action.id ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.06)', cursor: 'pointer', fontSize: 12, opacity: (loading || uploading) ? 0.4 : 1, fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: selectedAction === action.id ? '0 0 16px rgba(99,102,241,0.2)' : 'none' }}>
                <Ic d={action.icon} s={13} />
                {action.label}
              </button>
            ))}
            <button onClick={runHumanizeFlow}
              disabled={!input.trim() || loading || uploading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: (!input.trim() || loading || uploading) ? 'none' : '0 0 22px rgba(99,102,241,0.45)', opacity: (!input.trim() || loading || uploading) ? 0.5 : 1, animation: (!input.trim() || loading || uploading) ? 'none' : 'pulse-glow 3s ease-in-out infinite', fontFamily: 'inherit' }}>
              <Ic d={P.spark} s={14} />
              {loading ? 'Processing…' : 'Humanize Now'}
            </button>
          </div>
        </div>

        {/* error */}
        {error && (
          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* output */}
        {output && (
          <div style={{ marginTop: 18, ...glass, borderRadius: 20, overflow: 'hidden', borderColor: 'rgba(52,211,153,0.25)', boxShadow: '0 0 30px rgba(52,211,153,0.07), 0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(52,211,153,0.15)', background: 'linear-gradient(90deg, rgba(52,211,153,0.07), transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399' }}>
                <Ic d={P.check} s={16} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Generation Complete</span>
              </div>
              <button onClick={copyOutput}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: copied ? '#34d399' : '#818cf8', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                <Ic d={P.copy} s={13} />{copied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
            <div style={{ padding: '18px', color: 'var(--text1)', fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {output.text}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid rgba(52,211,153,0.12)' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{output.wordCount} words</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{ACTION_LABEL[output.action]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── dashboard ────────────────────────────────────────────────────────────────

const STAT_META = [
  { bg: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(79,70,229,0.08))',  bdr: 'rgba(99,102,241,0.28)',  glow: 'rgba(99,102,241,0.15)',  ic: '#818cf8' },
  { bg: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.08))', bdr: 'rgba(139,92,246,0.28)', glow: 'rgba(139,92,246,0.12)', ic: '#a78bfa' },
  { bg: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.06))', bdr: 'rgba(52,211,153,0.25)', glow: 'rgba(52,211,153,0.1)',  ic: '#34d399' },
];

function PlanComparison({ subscription, onUpgrade, upgradeLoading, upgradeMessage }) {
  const cardStyle = {
    background: 'var(--glass)',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--glass-b)',
    borderRadius: 20,
    padding: '22px',
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div style={{ ...cardStyle, boxShadow: subscription.tier !== 'pro' ? '0 0 26px rgba(99,102,241,0.12)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#a5b4fc' }}>Free</span>
            {subscription.tier !== 'pro' && <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '2px 9px' }}>Current</span>}
          </div>
          <p style={{ fontSize: 30, fontWeight: 700, margin: '0 0 6px', color: 'var(--text1)', fontFamily: '"Space Grotesk", sans-serif' }}>0 GHS</p>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 14px' }}>Signed-in access to the Humanizer with a limited quota.</p>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
            <span>• {wordsRemaining(subscription)} of {FREE_WORD_LIMIT} words remaining</span>
            <span>• Humanizer access only</span>
            <span>• Dashboard, Profile, History, and Saved Docs locked</span>
            <span>• Account required before processing text</span>
          </div>
        </div>

        <div style={{ ...cardStyle, border: '1px solid rgba(99,102,241,0.28)', boxShadow: '0 0 34px rgba(99,102,241,0.16)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#c4b5fd' }}>Premium</span>
            {subscription.tier === 'pro' && <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '2px 9px' }}>Active</span>}
          </div>
          <p style={{ fontSize: 30, fontWeight: 700, margin: '0 0 6px', color: 'var(--text1)', fontFamily: '"Space Grotesk", sans-serif' }}>
            {PRO_PRICE_GHS} GHS
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text2)', marginLeft: 8 }}>~ ${PRO_PRICE_USD_ESTIMATE.toFixed(2)} / month</span>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 14px' }}>Full workspace access and unlimited processing, paid through Paystack.</p>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            <span>• Unlimited words</span>
            <span>• Full Dashboard access</span>
            <span>• Profile, History, and Saved Docs unlocked</span>
            <span>• Payment status saved to your account</span>
          </div>
          {subscription.tier === 'pro' ? (
            <button disabled style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(52,211,153,0.24)', color: '#86efac', background: 'rgba(52,211,153,0.08)', cursor: 'default', fontSize: 13, fontFamily: 'inherit', width: '100%' }}>
              Premium Active
            </button>
          ) : (
            <button onClick={onUpgrade} disabled={upgradeLoading} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', color: '#fff', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', cursor: upgradeLoading ? 'wait' : 'pointer', fontSize: 13, fontFamily: 'inherit', width: '100%', boxShadow: '0 0 20px rgba(99,102,241,0.34)', opacity: upgradeLoading ? 0.72 : 1 }}>
              {upgradeLoading ? 'Redirecting to Paystack…' : 'Pay with Paystack'}
            </button>
          )}
        </div>
      </div>

      {upgradeMessage && (
        <p style={{ fontSize: 12, color: upgradeMessage.toLowerCase().includes('verified') ? '#34d399' : '#94a3b8', margin: 0 }}>
          {upgradeMessage}
        </p>
      )}
    </div>
  );
}

function PricingPage({ subscription, onUpgrade, upgradeLoading, upgradeMessage, isSignedIn, onSignIn, notice = '' }) {
  return (
    <div style={{ padding: '32px 24px 40px', maxWidth: 1040 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', margin: '0 0 6px' }}>Plans & Pricing</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>
            {isSignedIn
              ? `Current plan: ${planLabel(subscription)}.`
              : 'Sign in to connect a plan to your account and unlock the full workspace.'}
          </p>
        </div>
        {!isSignedIn ? (
          <button onClick={onSignIn} style={{ padding: '10px 18px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(99,102,241,0.35)', fontFamily: 'inherit' }}>
            Sign In to Continue
          </button>
        ) : subscription.tier !== 'pro' ? (
          <button onClick={onUpgrade} disabled={upgradeLoading} style={{ padding: '10px 18px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: upgradeLoading ? 'wait' : 'pointer', boxShadow: '0 0 20px rgba(99,102,241,0.35)', fontFamily: 'inherit', opacity: upgradeLoading ? 0.72 : 1 }}>
            {upgradeLoading ? 'Opening Paystack...' : 'Upgrade to Premium'}
          </button>
        ) : null}
      </div>

      {notice && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 16, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#c4b5fd', fontSize: 13 }}>
          {notice}
        </div>
      )}

      <PlanComparison
        subscription={subscription}
        onUpgrade={onUpgrade}
        upgradeLoading={upgradeLoading}
        upgradeMessage={upgradeMessage}
      />
    </div>
  );
}

function Dashboard({ history, saved, onNav, subscription, profile, onUpgrade, upgradeLoading, upgradeMessage }) {
  const today      = new Date().toDateString();
  const totalWords = useMemo(() => history.reduce((s, h) => s + (h.wordCount || 0), 0), [history]);
  const todayItems = useMemo(() => history.filter(h => new Date(h.timestamp).toDateString() === today).length, [history]);
  const savedToday = useMemo(() => saved.filter(d => new Date(d.savedAt).toDateString() === today).length, [saved]);
  const recent     = history.slice(0, 5);
  const remaining = wordsRemaining(subscription);

  const stats = [
    { label: 'Words Processed', value: fmtNum(totalWords), sub: `${todayItems} today`, icon: P.pen },
    { label: 'Saved Documents', value: String(saved.length), sub: `${savedToday} today`, icon: P.bookmark },
    {
      label: 'Current Plan',
      value: planLabel(subscription),
      sub: subscription.tier === 'pro' ? 'Unlimited processing' : `${remaining} words remaining`,
      icon: P.zap,
      special: true,
    },
  ];

  return (
    <div style={{ padding: '32px 24px 40px' }}>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', margin: '0 0 6px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>
            {profile.name ? `Welcome back, ${profile.name}. ` : ''}Here's your activity.
          </p>
        </div>
        <button onClick={() => onNav('tool')}
          style={{ padding: '10px 20px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(99,102,241,0.38)', fontFamily: 'inherit' }}>
          + New Document
        </button>
      </div>

      {subscription.tier !== 'pro' && (
        <div style={{ marginBottom: 24, background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '20px 22px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>Free plan active</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
                {remaining} of {FREE_WORD_LIMIT} words left. Upgrade to Premium for unlimited use and more.
              </p>
            </div>
            <button onClick={() => onNav('pricing')} style={{ padding: '10px 18px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(99,102,241,0.32)', fontFamily: 'inherit' }}>
              View Premium Pricing
            </button>
          </div>
          {upgradeMessage && (
            <p style={{ fontSize: 12, color: upgradeMessage.toLowerCase().includes('verified') ? '#34d399' : '#94a3b8', margin: 0 }}>
              {upgradeMessage}
            </p>
          )}
        </div>
      )}

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => {
          const m = STAT_META[i];
          return (
            <div key={s.label} style={{ background: m.bg, border: `1px solid ${m.bdr}`, borderRadius: 18, padding: '22px 20px', boxShadow: `0 0 24px ${m.glow}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${m.glow}, transparent)`, borderRadius: '0 18px 0 0', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>{s.label}</span>
                <span style={{ color: m.ic }}><Ic d={s.icon} s={16} /></span>
              </div>
              <p style={{ fontSize: 28, fontWeight: 700, color: s.special ? m.ic : 'var(--text1)', margin: '0 0 4px', fontFamily: '"Space Grotesk", sans-serif' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{s.sub}</p>
              {s.special && <span style={{ position: 'absolute', top: 20, right: 18, width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.8)', display: 'inline-block' }} />}
            </div>
          );
        })}
      </div>

      {/* recent activity */}
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 14 }}>Recent Activity</h2>
      {recent.length === 0 ? (
        <Empty icon={P.clock} text="No activity yet. Start by humanizing some text." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : (
        <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 18, overflow: 'hidden' }}>
          {recent.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < recent.length - 1 ? '1px solid var(--glass-b)' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                <Ic d={P.doc} s={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.inputText.slice(0, 65)}{item.inputText.length > 65 ? '…' : ''}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>
                  {ACTION_LABEL[item.action]} · {item.wordCount} words
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{reltime(item.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PremiumLockedPage({ title, description, subscription, onUpgrade, upgradeLoading, upgradeMessage }) {
  return (
    <div style={{ padding: '32px 24px 40px', maxWidth: 980 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', margin: '0 0 6px' }}>{title}</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>{description}</p>
      </div>

      <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '22px 24px', marginBottom: 18 }}>
        <p style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text1)', fontWeight: 600 }}>Premium required</p>
        <p style={{ margin: '0 0 4px', fontSize: 24, color: '#c4b5fd', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>Upgrade to unlock this page</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
          Current plan: {planLabel(subscription)}. {subscription.tier === 'pro' ? 'Your access is already active.' : `${wordsRemaining(subscription)} free words remain in Humanizer.`}
        </p>
      </div>

      <PlanComparison
        subscription={subscription}
        onUpgrade={onUpgrade}
        upgradeLoading={upgradeLoading}
        upgradeMessage={upgradeMessage}
      />
    </div>
  );
}

function ProfilePage({ profile, subscription, history, saved, onSaveProfile }) {
  const [form, setForm] = useState({ name: profile.name, email: profile.email });
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    setForm({ name: profile.name, email: profile.email });
  }, [profile.name, profile.email]);

  function handleSave() {
    onSaveProfile({ ...form, name: form.name.trim() });
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--glass)',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-b)',
    color: 'var(--text1)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const cards = [
    { label: 'Plan', value: planLabel(subscription), sub: subscription.tier === 'pro' ? 'Unlimited words' : `${wordsRemaining(subscription)} words left`, icon: P.zap },
    { label: 'Processed', value: fmtNum(history.reduce((sum, item) => sum + (item.wordCount || 0), 0)), sub: 'Total words processed', icon: P.pen },
    { label: 'Saved Docs', value: String(saved.length), sub: 'Files saved in dashboard', icon: P.bookmark },
  ];

  return (
    <div style={{ padding: '32px 24px 40px', maxWidth: 940 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', margin: '0 0 6px' }}>Profile</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>Manage your account details and usage overview.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 22 }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 18, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)' }}>{card.label}</span>
              <span style={{ color: '#a5b4fc' }}><Ic d={card.icon} s={15} /></span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text1)', margin: '0 0 4px', fontFamily: '"Space Grotesk", sans-serif' }}>{card.value}</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{card.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '24px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 16 }}>Account Form</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Full Name</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Email Address</label>
            <input
              value={form.email}
              readOnly
              placeholder="your@email.com"
              style={{ ...inputStyle, opacity: 0.72, cursor: 'not-allowed' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Current Plan</label>
            <input
              value={subscription.tier === 'pro' ? 'Pro - Unlimited' : `Free - ${wordsRemaining(subscription)} words left`}
              readOnly
              style={{ ...inputStyle, opacity: 0.72, cursor: 'default' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Processed Sessions</label>
            <input
              value={String(history.length)}
              readOnly
              style={{ ...inputStyle, opacity: 0.72, cursor: 'default' }}
            />
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text3)' }}>
          Your email and billing state come from your signed-in account.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} style={{ padding: '11px 28px', borderRadius: 12, background: saveOk ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: saveOk ? '0 0 20px rgba(16,185,129,0.4)' : '0 0 20px rgba(99,102,241,0.35)', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {saveOk ? 'Saved' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

// ─── history ──────────────────────────────────────────────────────────────────

function HistoryPage({ history, setHistory, onNav }) {
  const [expanded, setExpanded] = useState(null);
  const DOTS = ['#6366f1', '#38bdf8', '#a78bfa', '#34d399'];

  function remove(id) {
    setHistory(prev => prev.filter(h => h.id !== id));
    if (expanded === id) setExpanded(null);
  }

  return (
    <div style={{ padding: '32px 24px 40px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', marginBottom: 28 }}>Processing History</h1>
      {history.length === 0 ? (
        <Empty icon={P.clock} text="No history yet. Start processing text to see results here." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: 'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(99,102,241,0.1))' }} />
          {history.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', gap: 18, paddingLeft: 28, position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 0, top: 16, width: 11, height: 11, borderRadius: '50%', background: DOTS[i % DOTS.length], boxShadow: `0 0 10px ${DOTS[i % DOTS.length]}90` }} />
              <div style={{ flex: 1, background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--glass-b)' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', margin: '0 0 3px' }}>{ACTION_LABEL[item.action]}</p>
                    <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{reltime(item.timestamp)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.wordCount} words</span>
                    <button onClick={() => remove(item.id)} style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                      <Ic d={P.trash} s={15} />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text2)', margin: 0 }}>
                    "{item.outputText.slice(0, 120)}{item.outputText.length > 120 ? '…' : ''}"
                  </p>
                </div>
                <div style={{ padding: '0 16px 14px' }}>
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {expanded === item.id ? 'Collapse' : 'View full result'}
                    <Ic d={P.arrow} s={12} />
                  </button>
                  {expanded === item.id && (
                    <div style={{ marginTop: 10, padding: 14, background: 'rgba(99,102,241,0.05)', border: '1px solid var(--glass-b)', borderRadius: 12, fontSize: 13, lineHeight: 1.7, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>
                      {item.outputText}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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

  const filtered = useMemo(() =>
    saved.filter(d => !query ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.content.toLowerCase().includes(query.toLowerCase())
    ), [saved, query]);

  function saveFromHistory(item) {
    const name = saveName.trim() || `${ACTION_LABEL[item.action]} – ${new Date(item.timestamp).toLocaleDateString()}`;
    setSaved(prev => [{
      id: `d_${Date.now()}`, name, content: item.outputText,
      wordCount: item.wordCount,
      sizeBytes: new TextEncoder().encode(item.outputText).length,
      savedAt: new Date().toISOString(),
    }, ...prev]);
    setSavingId(null); setSaveName('');
  }

  function remove(id) { setSaved(prev => prev.filter(d => d.id !== id)); }

  return (
    <div style={{ padding: '32px 24px 40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', margin: 0 }}>Saved Documents</h1>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
            <Ic d={P.search} s={15} />
          </span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            style={{ paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, borderRadius: 11, background: 'var(--glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-b)', color: 'var(--text1)', fontSize: 13, outline: 'none', width: 200, fontFamily: 'inherit' }} />
        </div>
      </div>

      {saved.length === 0 ? (
        <Empty icon={P.bookmark} text="No saved documents yet. Process text and save the result." action="Go to Humanizer" onAction={() => onNav('tool')} />
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No documents match "{query}".</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(doc => (
            <div key={doc.id} style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 70, height: 70, background: 'radial-gradient(circle at top right, rgba(99,102,241,0.18), transparent 70%)', borderRadius: '0 18px 0 0', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>
                  <Ic d={P.doc} s={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{reltime(doc.savedAt)} · {fmtBytes(doc.sizeBytes)}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, flex: 1, marginBottom: 14, color: 'var(--text2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {doc.content.slice(0, 120)}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => navigator.clipboard.writeText(doc.content)}
                  style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>Copy</button>
                <button onClick={() => remove(doc.id)}
                  style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 14 }}>Save from History</h2>
          <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 18, overflow: 'hidden' }}>
            {history.slice(0, 10).map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < Math.min(history.length, 10) - 1 ? '1px solid var(--glass-b)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ACTION_LABEL[item.action]} · {reltime(item.timestamp)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.outputText.slice(0, 60)}…
                  </p>
                </div>
                {savingId === item.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input value={saveName} onChange={e => setSaveName(e.target.value)}
                      placeholder="Document name…" autoFocus
                      style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid var(--glass-b)', color: 'var(--text1)', fontSize: 12, outline: 'none', width: 140, fontFamily: 'inherit' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveFromHistory(item);
                        if (e.key === 'Escape') { setSavingId(null); setSaveName(''); }
                      }} />
                    <button onClick={() => saveFromHistory(item)} style={{ fontSize: 12, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button onClick={() => { setSavingId(null); setSaveName(''); }} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setSavingId(item.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
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

function SettingsPage({
  profile,
  subscription,
  onSignIn,
  onSaveProfile,
  onUpgrade,
  upgradeLoading,
  upgradeMessage,
}) {
  const [form,   setForm]   = useState({ name: profile.name, email: profile.email });
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    setForm({ name: profile.name, email: profile.email });
  }, [profile.name, profile.email]);

  function handleSave() {
    onSaveProfile({ ...form, name: form.name.trim() });
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  }

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 11, background: 'var(--glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-b)', color: 'var(--text1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' };

  return (
    <div style={{ padding: '32px 24px 40px', maxWidth: 620 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: 'var(--text1)', marginBottom: 28 }}>Account Settings</h1>

      <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '20px 24px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 12 }}>Quick Status</h2>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text1)' }}>
          Signed in as {profile.name || profile.email || 'Guest'}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)' }}>
          Use the new `Profile` page for the full account form and overview cards.
        </p>
      </div>

      {/* profile section */}
      <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '24px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 16 }}>Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" style={inp}
              onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
              onBlur={e => e.target.style.borderColor = 'var(--glass-b)'} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Email</label>
            <input type="email" value={form.email} readOnly placeholder="your@email.com" style={{ ...inp, opacity: 0.72, cursor: 'not-allowed' }} />
          </div>
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', marginBottom: 0 }}>
          Email is managed by your login account.
        </p>
        {profile.email.trim() === '' && (
          <p style={{ marginTop: 12, fontSize: 12, color: '#818cf8', margin: '12px 0 0' }}>
            <button onClick={onSignIn} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline', fontFamily: 'inherit' }}>Sign in</button> to set your profile.
          </p>
        )}
      </div>

      {/* subscription */}
      <div style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-b)', borderRadius: 20, padding: '20px 24px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 14 }}>Subscription</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{subscription.tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</span>
              <span style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '2px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#34d399' }}>Active</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
              {subscription.tier === 'pro'
                ? `${PRO_PRICE_GHS} GHS / month · Unlimited processing`
                : `${wordsRemaining(subscription)} of ${FREE_WORD_LIMIT} free words remaining`}
            </p>
          </div>
          {subscription.tier === 'pro' ? (
            <button disabled style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(52,211,153,0.24)', color: '#86efac', background: 'rgba(52,211,153,0.08)', cursor: 'default', fontSize: 13, fontFamily: 'inherit' }}>
              Pro Active
            </button>
          ) : (
            <button onClick={onUpgrade} disabled={upgradeLoading} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--glass-b)', color: '#f8fafc', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', cursor: upgradeLoading ? 'wait' : 'pointer', fontSize: 13, fontFamily: 'inherit', boxShadow: '0 0 18px rgba(99,102,241,0.28)', opacity: upgradeLoading ? 0.72 : 1 }}>
              {upgradeLoading ? 'Redirecting…' : `Upgrade to Pro · ${PRO_PRICE_GHS} GHS`}
            </button>
          )}
        </div>
        {upgradeMessage && (
          <p style={{ fontSize: 12, color: upgradeMessage.toLowerCase().includes('verified') ? '#34d399' : '#94a3b8', margin: '12px 0 0' }}>
            {upgradeMessage}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave}
          style={{ padding: '11px 28px', borderRadius: 12, background: saveOk ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: saveOk ? '0 0 20px rgba(16,185,129,0.4)' : '0 0 20px rgba(99,102,241,0.35)', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {saveOk ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── empty state ──────────────────────────────────────────────────────────────

function Empty({ icon, text, action, onAction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', marginBottom: 18, boxShadow: '0 0 16px rgba(99,102,241,0.08)' }}>
        <Ic d={icon} s={22} />
      </div>
      <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20, maxWidth: 280 }}>{text}</p>
      {action && (
        <button onClick={onAction}
          style={{ padding: '10px 22px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', boxShadow: '0 0 18px rgba(99,102,241,0.35)', fontFamily: 'inherit' }}>
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
  const [menuOpen, setMenuOpen] = useState(false);
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
  const toolSubscription = isSignedIn
    ? subscription
    : { ...DEFAULT_SUBSCRIPTION, wordsUsed: guestWordsUsed };

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
    } catch {}
  }, [guestWordsUsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('hc-active-view', view);
    } catch {}
  }, [view]);

  useEffect(() => {
    if (!authReady || !session?.user || subscription.tier === 'pro') return;

    const email = (profile.email || session.user.email || '').trim().toLowerCase();
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

    const url = new URL(window.location.href);
    const reference = url.searchParams.get('reference');
    const paystackStatus = url.searchParams.get('paystack');
    const targetView = url.searchParams.get('view');

    if (!reference || paystackStatus !== 'success' || handledPaymentRef.current === reference) {
      return;
    }

    handledPaymentRef.current = reference;

    if (!session?.user) {
      setPaymentMessage('Sign in again to finish applying your upgrade.');
      return;
    }

    setPaymentLoading(true);
    setPaymentMessage('');

    (async () => {
      try {
        const startedAt = beginBusy('Verifying payment...');
        const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not verify payment.');
        if (data.status !== 'success') throw new Error('Payment was not completed.');

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
  }, [session?.user, profile, history, saved, subscription]);

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
        } else {
          setAuthMode('signin');
          setAuthMessage('Account created. Check your email for the confirmation link, then sign in. If it does not arrive, use "Resend confirmation email".');
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
      const msg = error.message || 'Authentication failed.';
      if (/confirm|verified|verification/i.test(msg)) {
        setAuthError('Your email is not confirmed yet. Use "Resend confirmation email" if needed.');
      } else {
        setAuthError(msg);
      }
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
    setMenuOpen(false);

    if (nextView === 'landing') {
      setView('landing');
      return;
    }

    if (nextView === 'pricing') {
      setPricingNotice('');
      setView('pricing');
      return;
    }

    if (nextView === 'tool') {
      setView('tool');
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

    setView(nextView);
  }

  function handleEnterDashboard(mode = 'signup') {
    requestNavigation('dashboard', mode);
  }

  function handleLandingTool() {
    triggerPulse();
    setMenuOpen(false);
    setShowSignIn(false);
    setView('tool');
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
    setSubscription(prev => ({
      ...prev,
      wordsUsed: Number(prev.wordsUsed || 0) + Number(words || 0),
    }));
  }

  function handleGuestUsageAdd(words) {
    setGuestWordsUsed(prev => Number(prev || 0) + Number(words || 0));
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
        />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text1)' }}>
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

      <Sidebar page={view} onNav={requestNavigation} open={menuOpen} onClose={() => setMenuOpen(false)} subscription={subscription} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        <AppBg />

        <Header
          profile={profile}
          onSignOut={handleSignOut}
          onSignIn={() => openAuth('signin', view)}
          onMenuOpen={() => setMenuOpen(true)}
        />

        <main style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          <div key={`${view}-${isSignedIn ? 'auth' : 'guest'}`} className="page-fade surface-fade">
            {view === 'tool'      && <HumanizerTool history={history} setHistory={setHistory} subscription={toolSubscription} isSignedIn={Boolean(session?.user)} onRequireAuth={openAuth} onUsageAdd={isSignedIn ? handleUsageAdd : handleGuestUsageAdd} />}
            {view === 'pricing'   && <PricingPage subscription={subscription} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} isSignedIn={isSignedIn} onSignIn={() => openAuth('signin', 'pricing')} notice={pricingNotice} />}
            {view === 'dashboard' && <Dashboard history={history} saved={saved} onNav={requestNavigation} subscription={subscription} profile={profile} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} />}
            {view === 'profile'   && <ProfilePage profile={profile} subscription={subscription} history={history} saved={saved} onSaveProfile={handleSaveProfile} />}
            {view === 'history'   && <HistoryPage history={history} setHistory={setHistory} onNav={requestNavigation} />}
            {view === 'saved'     && <SavedDocsPage history={history} saved={saved} setSaved={setSaved} onNav={requestNavigation} />}
            {view === 'settings'  && <SettingsPage profile={profile} subscription={subscription} onSignIn={() => openAuth('signin', 'settings')} onSaveProfile={handleSaveProfile} onUpgrade={handleUpgrade} upgradeLoading={paymentLoading} upgradeMessage={paymentMessage} />}
          </div>
        </main>

        <footer style={{ flexShrink: 0, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(6,9,15,0.6)', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 2 }}>
          <button onClick={() => setView(isSignedIn ? 'tool' : 'landing')} style={{ color: 'var(--text3)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', fontFamily: 'inherit' }}>
            ← Home
          </button>
        </footer>
      </div>
    </div>
  );
}
