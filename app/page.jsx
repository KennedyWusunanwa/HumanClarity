'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/App'), {
  ssr: false,
  loading: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-900 dark:bg-[#0b1117] dark:text-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d3e3fd] border-t-[#0b57d0] dark:border-[#263850] dark:border-t-[#a8c7fa]" />
        <p className="text-sm font-medium text-[#5f6368] dark:text-[#c4c7c5]">Loading Human Clarity...</p>
      </div>
    </main>
  ),
});

export default function HomePage() {
  return <App />;
}
