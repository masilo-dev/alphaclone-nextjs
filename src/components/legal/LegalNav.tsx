'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/legal/acceptable-use', label: 'Acceptable Use' },
  { href: '/legal/data-request', label: 'Data Requests' },
  { href: '/legal/refund', label: 'Refund Policy' },
  { href: '/sla', label: 'SLA' },
  { href: '/dpa', label: 'DPA' },
  { href: '/legal/ai-disclaimer', label: 'AI Disclaimer' },
];

/** Desktop-only legal sub-nav — mobile uses the main site hamburger menu. */
export default function LegalNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-20 z-30 hidden border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/legal" className="text-sm font-semibold text-white shrink-0">
          AlphaClone Legal
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/25'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
