import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Linkedin, Twitter } from 'lucide-react';
import { MarketingContainer } from './LayoutPrimitives';
import {
  COMPANY_NAV_GROUP,
  FOOTER_LEGAL_LINKS,
  PRODUCT_NAV_GROUP,
  RESOURCES_NAV_GROUP,
  SOLUTIONS_NAV_GROUP,
  type MarketingNavLink,
} from '@/lib/marketing/siteNavigation';
import { SOCIAL_PROFILES, formatCopyrightLine } from '@/lib/seo/siteEntity';

type FooterColumn = {
  title: string;
  links: MarketingNavLink[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [...PRODUCT_NAV_GROUP.items, { label: 'Pricing', path: '/pricing' }],
  },
  {
    title: 'Solutions',
    links: SOLUTIONS_NAV_GROUP.items,
  },
  {
    title: 'Resources',
    links: RESOURCES_NAV_GROUP.items,
  },
  {
    title: 'Company',
    links: COMPANY_NAV_GROUP.items,
  },
  {
    title: 'Legal',
    links: FOOTER_LEGAL_LINKS,
  },
];

const SOCIAL_LINKS = [
  {
    label: 'AlphaClone on LinkedIn',
    href: SOCIAL_PROFILES.linkedin,
    Icon: Linkedin,
  },
  {
    label: 'AlphaClone on Facebook',
    href: SOCIAL_PROFILES.facebook,
    Icon: Facebook,
  },
  {
    label: 'AlphaClone on X',
    href: SOCIAL_PROFILES.x,
    Icon: Twitter,
  },
];

function FooterLink({ item }: { item: MarketingNavLink }) {
  return (
    <Link
      href={item.path}
      className="text-sm text-[var(--marketing-text-muted)] transition-colors hover:text-[var(--marketing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
    >
      {item.label}
    </Link>
  );
}

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)]">
      <MarketingContainer className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--marketing-focus)]"
              aria-label="AlphaClone home"
            >
              <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="font-marketing-heading text-xl font-bold tracking-tight text-[var(--marketing-text-primary)]">
                AlphaClone
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--marketing-text-secondary)]">
              AlphaClone connects customers, projects, invoices, documents, and AI assistance in one
              workspace for service businesses.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--marketing-radius-sm)] border border-[var(--marketing-border)] text-[var(--marketing-text-muted)] transition-colors hover:border-[var(--marketing-accent)] hover:text-[var(--marketing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-text-primary)]">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {column.links.map((item) => (
                    <li key={`${column.title}-${item.path}-${item.label}`}>
                      <FooterLink item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--marketing-border)] pt-6 text-sm text-[var(--marketing-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{formatCopyrightLine()}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/security-policy" className="hover:text-[var(--marketing-accent-hover)]">
              Security policy
            </Link>
            <Link href="/privacy-policy" className="hover:text-[var(--marketing-accent-hover)]">
              Privacy policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-[var(--marketing-accent-hover)]">
              Terms
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
