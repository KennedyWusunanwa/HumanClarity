import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'HumanClarity AI – Beat the World\'s Top AI Detectors';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: '#0b0d12',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background glow blobs */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            left: '30%',
            width: 680,
            height: 680,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(73,104,255,0.22) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            right: -100,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,60,255,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent 0%, #4968ff 30%, #7c3cff 60%, transparent 100%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(168,199,250,0.07) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: '56px 72px',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 56 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #4968ff 0%, #7c3cff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 32px rgba(73,104,255,0.5)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                HumanClarity AI
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6d87ff', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 3 }}>
                Natural Writing, Fast
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                fontSize: 62,
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                marginBottom: 28,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span>Beat the World&apos;s</span>
              <span style={{ background: 'linear-gradient(135deg, #a8c7fa 0%, #7c9fff 40%, #a78bff 100%)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                Top AI Detectors.
              </span>
            </div>
            <p style={{ fontSize: 26, color: '#8e9dc2', lineHeight: 1.5, margin: 0, maxWidth: 680 }}>
              Humanize AI text instantly. Bypass Turnitin, GPTZero, Originality.ai and more — in seconds.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 40 }}>
            {['✓  Undetectable rewrites', '✓  Turnitin bypass', '✓  GPTZero bypass', '✓  Free to start'].map(label => (
              <div
                key={label}
                style={{
                  padding: '10px 20px',
                  borderRadius: 50,
                  border: '1px solid rgba(168,199,250,0.2)',
                  background: 'rgba(168,199,250,0.07)',
                  color: '#a8c7fa',
                  fontSize: 17,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 64,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 300,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(168,199,250,0.15)',
            borderRadius: 20,
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                border: '7px solid rgba(168,199,250,0.12)',
                borderTop: '7px solid #22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 900, color: '#22c55e' }}>97%</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 15, color: '#a8c7fa', fontWeight: 600 }}>Human Score</span>
            <span style={{ marginLeft: 'auto', fontSize: 15, color: '#22c55e', fontWeight: 800 }}>Passed ✓</span>
          </div>
          {[100, 82, 91, 70].map((w, i) => (
            <div key={i} style={{ height: 9, width: `${w}%`, borderRadius: 6, background: 'rgba(168,199,250,0.22)', display: 'flex' }} />
          ))}
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.28)',
              color: '#4ade80',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ✦ Looks natural — passes all checks
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
