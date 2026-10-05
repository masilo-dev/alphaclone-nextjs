'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--background-app)] text-[var(--text-primary)] flex items-center justify-center px-6">
      <div className="max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-6 text-center shadow-xl">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The page failed to load correctly. Please try again.
        </p>
        <button
          type="button"
          onClick={unstable_retry}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-[var(--brand-blue-500)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
