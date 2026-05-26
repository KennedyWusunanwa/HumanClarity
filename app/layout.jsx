import './globals.css';

// metadataBase. Resolution order:
// 1. NEXT_PUBLIC_SITE_URL — set this to the canonical production URL.
// 2. VERCEL_PROJECT_PRODUCTION_URL — auto-set by Vercel to the prod alias.
// 3. VERCEL_URL — the per-deployment URL (preview deploys, fallback).
// 4. The actual Vercel project URL as a final fallback so OG scrapers never hit a dead host.
const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  'https://human-clarity.vercel.app';

export const metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: 'HumanClarity AI – Beat the World\'s Top AI Detectors',
    template: '%s | HumanClarity AI',
  },
  description:
    'Turn AI-written text into undetectable, human-sounding content. Bypass Turnitin, GPTZero, Originality.ai and more — instantly. Free to start.',

  keywords: [
    'AI humanizer',
    'bypass AI detector',
    'undetectable AI text',
    'Turnitin bypass',
    'GPTZero bypass',
    'AI to human text',
    'humanize AI writing',
    'Originality.ai bypass',
    'AI text rewriter',
    'human writing AI',
  ],

  authors: [{ name: 'HumanClarity AI' }],
  creator: 'HumanClarity AI',
  publisher: 'HumanClarity AI',

  icons: {
    icon: '/HumanClarity AI icon.png',
    shortcut: '/HumanClarity AI icon.png',
    apple: '/HumanClarity AI icon.png',
  },

  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: 'HumanClarity AI',
    title: 'HumanClarity AI – Beat the World\'s Top AI Detectors',
    description:
      'Turn AI-written text into undetectable, human-sounding content. Bypass Turnitin, GPTZero, Originality.ai and more — instantly. Free to start.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'HumanClarity AI – Beat the World\'s Top AI Detectors',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
  },

  twitter: {
    card: 'summary_large_image',
    site: '@HumanClarityAI',
    creator: '@HumanClarityAI',
    title: 'HumanClarity AI – Beat the World\'s Top AI Detectors',
    description:
      'Humanize AI text in seconds. Bypass Turnitin, GPTZero, Originality.ai and more — free to start.',
    images: ['/twitter-image'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
