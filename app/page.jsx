'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-900 dark:bg-[#0b1117] dark:text-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500 dark:border-sky-950 dark:border-t-sky-400" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Human Clarity...</p>
      </div>
    </main>
  ),
});

export default function HomePage() {
  return <App />;
}
