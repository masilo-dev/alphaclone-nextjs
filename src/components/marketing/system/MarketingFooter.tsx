'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Facebook, Linkedin, Mail, Twitter } from 'lucide-react';
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
import { DEMO_HREF, TRIAL_HREF } from '@/lib/marketing/cta';

type FooterColumn = {
  title: string;
  links: MarketingNavLink[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [...PRODUCT_NAV_GROUP.items.slice(0, 6), { label: 'Pricing', path: '/pricing' }],
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
    links: [...COMPANY_NAV_GROUP.items, ...FOOTER_LEGAL_LINKS.slice(0, 4)],
  },
];

const BOTTOM_LEGAL = [
  { label: 'Privacy', path: '/privacy-policy' },
  { label: 'Terms', path: '/terms-of-service' },
  { label: 'Cookies', path: '/cookie-policy' },
  { label: 'Security', path: '/security-policy' },
  { label: 'Legal hub', path: '/legal' },
];

const SOCIAL_LINKS = [
  { label: 'AlphaClone on LinkedIn', href: SOCIAL_PROFILES.linkedin, Icon: Linkedin },
  { label: 'AlphaClone on Facebook', href: SOCIAL_PROFILES.facebook, Icon: Facebook },
  { label: 'AlphaClone on X', href: SOCIAL_PROFILES.x, Icon: Twitter },
];

function FooterLink({ item }: { item: MarketingNavLink }) {
  return (
    <Link href={item.path} className="mkt-footer-link">
      {item.label}
    </Link>
  );
}

export default function MarketingFooter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done'>('idle');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus('done');
    setEmail('');
  };

  return (
    <footer className="mkt-footer">
      <MarketingContainer className="py-14 sm:py-16">
        <div className="mkt-footer-top">
          <div className="mkt-footer-brand-block">
            <Link href="/" className="mkt-brand" aria-label="AlphaClone home">
              <span className="mkt-brand-mark" aria-hidden="true">
                <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              </span>
              <span className="mkt-brand-word">AlphaClone</span>
            </Link>
            <p className="mkt-footer-blurb">
              The all-in-one operating system for service businesses — CRM, projects, invoices,
              documents, and AI in one connected workspace.
            </p>
            <div className="mkt-footer-social">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="me noopener noreferrer"
                  aria-label={label}
                  className="mkt-footer-social-btn"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
            <div className="mkt-footer-cta-row">
              <Link href={TRIAL_HREF} className="mkt-btn mkt-btn-primary mkt-btn-compact">
                Start free for 14 days
              </Link>
              <Link href={DEMO_HREF} className="mkt-btn mkt-btn-secondary mkt-btn-compact">
                Book a demo
              </Link>
            </div>
          </div>

          <div className="mkt-footer-columns">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="mkt-footer-col-title">{column.title}</p>
                <ul className="mkt-footer-col-list">
                  {column.links.map((item) => (
                    <li key={`${column.title}-${item.path}-${item.label}`}>
                      <FooterLink item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mkt-footer-newsletter">
            <p className="mkt-footer-col-title">Stay in the loop</p>
            <p className="mkt-footer-newsletter-copy">
              Product updates and workflow tips for service teams. No spam.
            </p>
            {status === 'done' ? (
              <p className="mkt-footer-newsletter-done" role="status">
                Thanks — you&apos;re on the list.
              </p>
            ) : (
              <form className="mkt-footer-form" onSubmit={onSubmit}>
                <label className="sr-only" htmlFor="mkt-footer-email">
                  Email address
                </label>
                <div className="mkt-footer-input-wrap">
                  <Mail className="mkt-footer-input-icon" aria-hidden="true" />
                  <input
                    id="mkt-footer-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="mkt-footer-input"
                  />
                </div>
                <button type="submit" className="mkt-btn mkt-btn-primary mkt-btn-compact w-full">
                  Subscribe
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mkt-footer-bottom">
          <p>{formatCopyrightLine()}</p>
          <div className="mkt-footer-legal">
            {BOTTOM_LEGAL.map((item) => (
              <Link key={item.path} href={item.path} className="mkt-footer-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
