'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0d12',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(73,104,255,0.18), transparent 70%)',
          filter: 'blur(48px)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="page-fade"
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}
      >
        <div style={{ position: 'relative', width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
          <span
            className="spin-soft"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid rgba(126,151,255,0.16)',
              borderTopColor: '#7c9fff',
            }}
          />
          <img
            src="/HumanClarity AI icon.png"
            alt="HumanClarity AI"
            className="float-y"
            style={{ width: 54, height: 54, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(124,82,255,0.45))' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 19,
              fontWeight: 800,
              fontFamily: '"Roboto", Arial, sans-serif',
              letterSpacing: 0.2,
              background: 'linear-gradient(135deg, #e9edf7 0%, #7fb1ff 62%, #6f8cff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            HumanClarity AI
          </p>
          <p style={{ margin: '7px 0 0', fontSize: 13, color: '#8e9dc2' }}>Loading your workspace…</p>
        </div>
      </div>
    </main>
  ),
});

export default function HomePage() {
  return <App />;
}
