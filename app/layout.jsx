import './globals.css';

export const metadata = {
  title: 'Human Clarity',
  description: 'Human Clarity is a React app for rewriting, summarizing, and refining text.',
  icons: {
    icon: '/HumanClarity AI icon.png',
    shortcut: '/HumanClarity AI icon.png',
    apple: '/HumanClarity AI icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
