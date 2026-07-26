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

/** Desktop legal sub-nav — mobile uses the main site menu. */
export default function LegalNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-20 z-30 hidden border-b border-[var(--marketing-border)] bg-[rgba(2,13,26,0.92)] backdrop-blur-md md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/legal" className="text-sm font-semibold text-[var(--marketing-text-primary)] shrink-0">
          AlphaClone Legal
        </Link>

        <nav aria-label="Legal documents" className="flex flex-wrap items-center justify-end gap-2">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)] ${
                  active
                    ? 'bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent-hover)] ring-1 ring-[rgba(20,184,166,0.35)]'
                    : 'text-[var(--marketing-text-muted)] hover:bg-[var(--marketing-surface)] hover:text-[var(--marketing-text-primary)]'
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
