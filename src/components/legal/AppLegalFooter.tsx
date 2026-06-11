'use client';

import Link from 'next/link';

export default function AppLegalFooter() {
  return (
    <footer className="w-full border-t border-slate-800 bg-slate-950/70 px-4 py-6 text-xs text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-slate-500">
          © {new Date().getFullYear()} AlphaClone Systems LLC
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-slate-200" href="/legal/privacy">Privacy</Link>
          <Link className="hover:text-slate-200" href="/legal/terms">Terms</Link>
          <Link className="hover:text-slate-200" href="/legal/cookies">Cookies</Link>
          <Link className="hover:text-slate-200" href="/legal/refund">Refund</Link>
          <Link className="hover:text-slate-200" href="/legal/acceptable-use">Acceptable Use</Link>
        </nav>
      </div>
    </footer>
  );
}

