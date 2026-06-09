'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
  { href: '/legal/acceptable-use', label: 'Acceptable Use' },
  { href: '/legal/data-request', label: 'Data Requests' },
];

export default function LegalNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/legal" className="text-sm font-semibold text-white">
          AlphaClone Legal
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <label className="md:hidden flex items-center gap-2 text-xs text-slate-400">
          <span className="sr-only">Navigate legal pages</span>
          <select
            value={LINKS.find((link) => pathname?.startsWith(link.href))?.href ?? '/legal'}
            onChange={(event) => router.push(event.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="/legal">Overview</option>
            {LINKS.map((link) => (
              <option key={link.href} value={link.href}>
                {link.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
