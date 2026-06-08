'use client';

import { useEffect, useId, useState } from 'react';

// Reads/writes the theme on the documentElement (`.dark` class) so it stays in sync
// with the anti-FOUC script in app/layout.jsx and with every other toggle on the page.
// Self-contained: drop <ThemeToggle /> anywhere (landing, app shell, admin).

const STORAGE_KEY = 'hc-theme';

function currentIsDark() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('dark');
}

export function applyTheme(theme) {
  const el = document.documentElement;
  const dark = theme === 'dark';
  el.classList.toggle('dark', dark);
  el.style.colorScheme = dark ? 'dark' : 'light';
}

export default function ThemeToggle({ size = 38, style }) {
  const [isDark, setIsDark] = useState(true);
  const maskId = useId().replace(/[:]/g, '');

  // Sync to whatever the FOUC script already applied.
  useEffect(() => { setIsDark(currentIsDark()); }, []);

  function toggle() {
    const next = isDark ? 'light' : 'dark';
    const el = document.documentElement;
    // Briefly enable a global colour transition so the whole UI eases between modes,
    // then remove it so normal interactions aren't slowed.
    el.classList.add('theme-transition');
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    window.setTimeout(() => el.classList.remove('theme-transition'), 560);
    setIsDark(next === 'dark');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={!isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`hc-theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
      style={{ width: size, height: size, ...style }}
    >
      <svg className="hc-tt-svg" viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} aria-hidden="true">
        <mask id={`tt-${maskId}`}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle className="hc-tt-cut" cx="12" cy="12" r="6.2" fill="black" />
        </mask>
        <circle className="hc-tt-body" cx="12" cy="12" r="6" fill="currentColor" mask={`url(#tt-${maskId})`} />
        <g className="hc-tt-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="4.5" x2="12" y2="2" />
          <line x1="19.5" y1="12" x2="22" y2="12" />
          <line x1="12" y1="19.5" x2="12" y2="22" />
          <line x1="4.5" y1="12" x2="2" y2="12" />
          <line x1="17.3" y1="6.7" x2="19.1" y2="4.9" />
          <line x1="17.3" y1="17.3" x2="19.1" y2="19.1" />
          <line x1="6.7" y1="17.3" x2="4.9" y2="19.1" />
          <line x1="6.7" y1="6.7" x2="4.9" y2="4.9" />
        </g>
      </svg>
    </button>
  );
}
