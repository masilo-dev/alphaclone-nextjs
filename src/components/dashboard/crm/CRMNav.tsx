'use client';

import Link from 'next/link';

const CRM_NAV_LINKS: { href: string; label: string }[] = [
  { href: '/dashboard/crm', label: 'Overview' },
  { href: '/dashboard/crm/workspace', label: 'Workspace' },
  { href: '/dashboard/deals', label: 'Deals' },
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/contacts', label: 'Contacts' },
];

function isCrmNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard/contacts') {
    return (
      pathname === '/dashboard/contacts' ||
      pathname === '/dashboard/business/clients' ||
      pathname === '/dashboard/clients' ||
      pathname === '/dashboard/crm/unified-contacts'
    );
  }
  if (href === '/dashboard/crm/workspace') {
    return pathname === '/dashboard/crm/workspace';
  }
  return pathname === href;
}

export function CRMNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="CRM sections"
      className="flex flex-nowrap gap-1.5 sm:gap-2 mb-3 p-1 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
    >
      {CRM_NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            isCrmNavActive(pathname, link.href)
              ? 'bg-teal-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
