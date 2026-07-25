'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Facebook, Linkedin, Mail, Twitter } from 'lucide-react';
import { MarketingContainer } from './LayoutPrimitives';
import {
  COMPANY_NAV_GROUP,
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
    links: [
      ...PRODUCT_NAV_GROUP.items.filter((item) =>
        ['/crm', '/docs', '/project-management', '/ai-agents', '/ecosystem'].some((path) =>
          item.path.startsWith(path)
        )
      ),
      { label: 'Pricing', path: '/pricing' },
    ].slice(0, 7),
  },
  {
    title: 'Solutions',
    links: SOLUTIONS_NAV_GROUP.items,
  },
  {
    title: 'Resources',
    links: RESOURCES_NAV_GROUP.items.slice(0, 6),
  },
  {
    title: 'Company',
    links: COMPANY_NAV_GROUP.items,
  },
];

const BOTTOM_LEGAL = [
  { label: 'Privacy Policy', path: '/privacy-policy' },
  { label: 'Terms of Service', path: '/terms-of-service' },
  { label: 'Cookie Policy', path: '/cookie-policy' },
  { label: 'Security', path: '/security-policy' },
  { label: 'Status', path: '/platform-status' },
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
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'loading') return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus('error');
      setError('Enter a valid email address.');
      return;
    }

    setStatus('loading');
    setError('');

    // No newsletter backend is wired on the marketing site yet — do not fake success.
    setStatus('error');
    setError('Newsletter signup is not available yet. Email hello@alphaclonesystems.com instead.');
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
              The connected business platform for service businesses.
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
              Get product updates delivered to your inbox.
            </p>
            <form className="mkt-footer-form" onSubmit={onSubmit} noValidate>
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
                  aria-invalid={status === 'error'}
                  aria-describedby={status === 'error' ? 'mkt-footer-email-error' : 'mkt-footer-email-note'}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (status === 'error') setStatus('idle');
                  }}
                  placeholder="you@company.com"
                  className="mkt-footer-input"
                />
              </div>
              <button
                type="submit"
                className="mkt-btn mkt-btn-primary mkt-btn-compact w-full"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Sending…' : 'Subscribe'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p id="mkt-footer-email-note" className="mkt-footer-privacy-note">
                By subscribing you agree to our{' '}
                <Link href="/privacy-policy" className="mkt-footer-link">
                  Privacy Policy
                </Link>
                .
              </p>
              {status === 'error' ? (
                <p id="mkt-footer-email-error" className="mkt-footer-newsletter-error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
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
