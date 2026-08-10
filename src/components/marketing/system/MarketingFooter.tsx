import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Linkedin, Twitter } from 'lucide-react';
import { MarketingContainer } from './LayoutPrimitives';
import { SOCIAL_PROFILES, formatCopyrightLine } from '@/lib/seo/siteEntity';
import { CTA_LABELS, DEMO_HREF, LOGIN_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import PublicStatusPill from '@/components/status/PublicStatusPill';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'CRM', path: '/crm' },
      { label: 'Projects', path: '/project-management' },
      { label: 'Bonnie AI', path: '/ai-agents' },
      { label: 'Pricing', path: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', path: '/about' },
      { label: 'Contact', path: '/contact' },
      { label: 'Security', path: '/security-policy' },
      { label: 'Docs', path: '/docs' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', path: '/privacy-policy' },
      { label: 'Terms', path: '/terms-of-service' },
      { label: 'Cookies', path: '/cookie-policy' },
      { label: 'Data deletion', path: '/data-deletion' },
      { label: 'Privacy choices', path: '/privacy-choices' },
      { label: 'DPA', path: '/dpa' },
      { label: 'Status', path: '/platform-status' },
    ],
  },
] as const;

const SOCIAL_LINKS = [
  { label: 'AlphaClone on LinkedIn', href: SOCIAL_PROFILES.linkedin, Icon: Linkedin },
  { label: 'AlphaClone on Facebook', href: SOCIAL_PROFILES.facebook, Icon: Facebook },
  { label: 'AlphaClone on X', href: SOCIAL_PROFILES.x, Icon: Twitter },
];

export default function MarketingFooter() {
  return (
    <footer className="mkt-footer">
      <MarketingContainer className="py-10 sm:py-12">
        <div className="mkt-footer-slim">
          <div>
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
                {CTA_LABELS.primary}
              </Link>
              <Link href={LOGIN_HREF} data-login-trigger className="mkt-btn mkt-btn-secondary mkt-btn-compact">
                Log in
              </Link>
              <Link href={DEMO_HREF} className="mkt-btn mkt-btn-ghost mkt-btn-compact">
                {CTA_LABELS.secondary}
              </Link>
            </div>
          </div>

          <div className="mkt-footer-columns mkt-footer-columns-slim">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="mkt-footer-col-title">{column.title}</p>
                <ul className="mkt-footer-col-list">
                  {column.links.map((item) => (
                    <li key={`${column.title}-${item.path}`}>
                      <Link href={item.path} className="mkt-footer-link">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mkt-footer-bottom">
          <p>{formatCopyrightLine()}</p>
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
          </div>
        </div>
      </MarketingContainer>
    </footer>
  );
}
