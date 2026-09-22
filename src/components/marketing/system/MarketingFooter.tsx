'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Facebook, Linkedin, Youtube } from 'lucide-react';
import { MarketingContainer } from './LayoutPrimitives';
import { SOCIAL_PROFILES, formatCopyrightLine } from '@/lib/seo/siteEntity';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { PrimaryCTA } from '@/components/marketing/system/CtaButtons';
import PublicStatusPill from '@/components/status/PublicStatusPill';
import { useLanguage } from '@/contexts/LanguageContext';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      ['Platform overview', '/services'],
      ['How it works', '/how-it-works'],
      ['CRM & pipeline', '/crm'],
      ['Project management', '/project-management'],
      ['Bonnie AI', '/ai-agents'],
      ['Pricing', '/pricing'],
    ],
  },
  {
    title: 'Solutions',
    links: [
      ['Who we serve', '/who-we-serve'],
      ['Agencies', '/solutions/agencies'],
      ['Consultants', '/solutions/consultants'],
      ['Solo founders', '/solutions/solo-founders'],
      ['Results & workflows', '/results'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Documentation', '/docs'],
      ['Getting started', '/guide'],
      ['Blog', '/blog'],
      ['Recorded demo', '/demo'],
      ['Integrations', '/ecosystem'],
      ['Execution session', '/execution-session'],
      ['FAQ', '/faq'],
    ],
  },
  {
    title: 'Company & legal',
    links: [
      ['About AlphaClone', '/about'],
      ['Contact', '/contact'],
      ['Security', '/security-policy'],
      ['Compliance', '/compliance'],
      ['Reliability', '/reliability'],
      ['Legal hub', '/legal'],
    ],
  },
] as const;

export default function MarketingFooter() {
  const { t } = useLanguage();
  return (
    <footer className="mkt-footer mkt-footer-redesign">
      <MarketingContainer className="py-12 sm:py-16">
        <div className="mkt-footer-grid-redesign">
          <div className="mkt-footer-brand-redesign">
            <Link href="/" className="mkt-brand mkt-brand-redesign" aria-label="AlphaClone home">
              <span className="mkt-brand-mark" aria-hidden="true"><Image src="/logo.png" alt="" width={34} height={34} className="h-[34px] w-[34px] object-contain" /></span>
              <span className="mkt-brand-copy"><span className="mkt-brand-word">AlphaClone</span><span className="mkt-brand-system">SYSTEMS</span></span>
            </Link>
            <p>{t('Approved AI instructions become accountable work across the systems your business already uses.')}</p>
            <PrimaryCTA href={DEMO_HREF} className="mkt-btn-compact">{t('Book a demo')}</PrimaryCTA>
            <div className="mkt-footer-social-redesign">
              <a href={SOCIAL_PROFILES.linkedin} target="_blank" rel="me noopener noreferrer" aria-label="AlphaClone on LinkedIn"><Linkedin aria-hidden="true" /></a>
              <a href={SOCIAL_PROFILES.facebook} target="_blank" rel="me noopener noreferrer" aria-label="AlphaClone on Facebook"><Facebook aria-hidden="true" /></a>
              <a href="https://www.youtube.com/@AlphaCloneSystems" target="_blank" rel="me noopener noreferrer" aria-label="AlphaClone on YouTube"><Youtube aria-hidden="true" /></a>
            </div>
          </div>
          <div className="mkt-footer-columns-redesign">
            {COLUMNS.map((column) => (
              <details key={column.title}>
                <summary>{t(column.title)}<ChevronDown aria-hidden="true" /></summary>
                <ul>
                  {column.links.map(([label, href]) => <li key={href}><Link href={href}>{t(label)}</Link></li>)}
                </ul>
              </details>
            ))}
          </div>
        </div>
        <div className="mkt-footer-bottom-redesign">
          <p suppressHydrationWarning>{formatCopyrightLine()}</p>
          <div>
            <PublicStatusPill />
            <Link href="/privacy-policy">{t('Privacy')}</Link>
            <Link href="/terms-of-service">{t('Terms')}</Link>
            <Link href="/security-policy">{t('Security')}</Link>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'))}>{t('Cookie preferences')}</button>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
