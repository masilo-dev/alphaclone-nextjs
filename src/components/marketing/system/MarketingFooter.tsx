'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Linkedin, Twitter } from 'lucide-react';
import { MarketingContainer } from './LayoutPrimitives';
import { SOCIAL_PROFILES, formatCopyrightLine } from '@/lib/seo/siteEntity';
import { CTA_LABELS, DEMO_HREF, LOGIN_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import PublicStatusPill from '@/components/status/PublicStatusPill';
import ChatGptExecutionPreview from '@/components/marketing/system/ChatGptExecutionPreview';

type FooterLink = {
  label: string;
  path: string;
  external?: boolean;
};

type FooterColumn = {
  title: string;
  links: readonly FooterLink[];
};

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Platform overview', path: '/services' },
      { label: 'Book a demo', path: '/book-demo' },
      { label: 'CRM', path: '/crm' },
      { label: 'Project management', path: '/project-management' },
      { label: 'Bonnie AI', path: '/ai-agents' },
      { label: 'Pricing', path: '/pricing' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Who we serve', path: '/who-we-serve' },
      { label: 'Solo founders', path: '/solutions/solo-founders' },
      { label: 'Agencies', path: '/solutions/agencies' },
      { label: 'Consultants', path: '/solutions/consultants' },
      { label: 'Customer workflows', path: '/results' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', path: '/docs' },
      { label: 'Getting started', path: '/guide' },
      { label: 'Blog', path: '/blog' },
      { label: 'Integrations', path: '/ecosystem' },
      { label: 'Claude & Manus MCP', path: '/claude-manus-integrations' },
      { label: 'How it works', path: '/how-it-works' },
      { label: 'Execution session', path: '/execution-session' },
      { label: 'FAQ', path: '/faq' },
    ],
  },
  {
    title: 'Company & Legal',
    links: [
      { label: 'About AlphaClone', path: '/about' },
      { label: 'Contact us', path: '/contact' },
      { label: 'Legal hub', path: '/legal' },
      { label: 'Compliance', path: '/compliance' },
      { label: 'Privacy Policy', path: '/privacy-policy' },
      { label: 'Terms of Service', path: '/terms-of-service' },
      { label: 'Security Policy', path: '/security-policy' },
      { label: 'Privacy Choices', path: '/privacy-choices' },
      { label: 'Data Deletion', path: '/data-deletion' },
      { label: 'Reliability', path: '/reliability' },
      { label: 'Platform status', path: '/platform-status' },
    ],
  },
] as const satisfies readonly FooterColumn[];

const SOCIAL_LINKS = [
  { label: 'AlphaClone on LinkedIn', href: SOCIAL_PROFILES.linkedin, Icon: Linkedin },
  { label: 'AlphaClone on Facebook', href: SOCIAL_PROFILES.facebook, Icon: Facebook },
  { label: 'AlphaClone on X', href: SOCIAL_PROFILES.x, Icon: Twitter },
];

export default function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <MarketingContainer className="pt-10 sm:pt-12 pb-6">
        <div className="mx-auto mb-10 max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">
                See the business, not another collection of apps
              </p>
              <h2 className="mt-3 font-marketing-heading text-xl font-extrabold leading-tight text-white sm:text-2xl">
                Direct work from ChatGPT. AlphaClone executes across your connected systems.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {EXECUTION_LAYER.primaryLine} Use the AI interface you already know — with CRM, outreach,
                documents, and billing running underneath with approval and audit.
              </p>
            </div>
            <ChatGptExecutionPreview compact />
          </div>
        </div>
      </MarketingContainer>
      <MarketingContainer className="py-6 sm:py-8 border-t border-white/10">
        <div className="mkt-footer-slim">
          <div>
            <Link href="/" className="mkt-brand" aria-label="AlphaClone home">
              <span className="mkt-brand-mark" aria-hidden="true">
                <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
              </span>
              <span className="mkt-brand-word">AlphaClone</span>
            </Link>
            <p className="mkt-footer-blurb">
              {EXECUTION_LAYER.primaryLine} Business execution layer for service teams.
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
                {CTA_LABELS.primary}
              </Link>
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-btn mkt-btn-secondary mkt-btn-compact">
                Log in
              </Link>
              <SecondaryCTA href={DEMO_HREF} className="mkt-btn-compact">
                {CTA_LABELS.secondary}
              </SecondaryCTA>
            </div>
          </div>

          <div className="mkt-footer-columns mkt-footer-columns-slim">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="mkt-footer-col-title">{column.title}</p>
                <ul className="mkt-footer-col-list">
                  {column.links.map((item) => (
                    <li key={`${column.title}-${item.path}`}>
                      {'external' in item && item.external ? (
                        <a
                          href={item.path}
                          target="_blank"
                          rel="me noopener noreferrer"
                          className="mkt-footer-link"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.path} className="mkt-footer-link">
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mkt-footer-bottom">
          <p suppressHydrationWarning>{formatCopyrightLine()}</p>
          <div className="mkt-footer-legal flex items-center gap-4 flex-wrap">
            <PublicStatusPill />
            <Link href="/privacy-policy" className="mkt-footer-link">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="mkt-footer-link">
              Terms
            </Link>
            <Link href="/security-policy" className="mkt-footer-link">
              Security
            </Link>
            <Link href="/data-deletion" className="mkt-footer-link">
              Data deletion
            </Link>
            <Link href="/privacy-choices" className="mkt-footer-link">
              Privacy choices
            </Link>
            <Link href="/legal" className="mkt-footer-link">
              Legal
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
