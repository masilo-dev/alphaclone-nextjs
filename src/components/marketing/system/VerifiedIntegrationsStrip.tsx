import type { CSSProperties } from 'react';
import { VERIFIED_PARTNERS, type VerifiedPartner } from '@/config/verifiedPartners';

const FEATURED_PARTNER_IDS = [
  'facebook',
  'linkedin',
  'linkedin-organization',
  'calendly',
  'zoho',
  'brevo',
  'resend',
  'stripe',
  'microsoft',
  'gmail',
  'supabase',
  'cloudflare',
] as const;

function PartnerChip({ partner }: { partner: VerifiedPartner }) {
  const { Icon } = partner;

  return (
    <li>
      <a
        href="/ecosystem"
        className="mkt-partner-chip"
        style={
          {
            '--partner-color': partner.brandColor,
            '--partner-chip-bg': partner.chipBg,
          } as CSSProperties
        }
        aria-label={`${partner.name} integration — view ecosystem`}
      >
        <span className="mkt-partner-chip-icon" aria-hidden="true">
          <Icon className="mkt-partner-brand-icon" />
        </span>
        <span className="mkt-partner-chip-name">{partner.name}</span>
      </a>
    </li>
  );
}

/** Featured verified integrations — branded icon + name. */
export default function VerifiedIntegrationsStrip() {
  const partners = FEATURED_PARTNER_IDS.map((id) =>
    VERIFIED_PARTNERS.find((partner) => partner.id === id),
  ).filter((partner): partner is VerifiedPartner => Boolean(partner));

  return (
    <ul className="mkt-partner-grid" aria-label="Verified integrations">
      {partners.map((partner) => (
        <PartnerChip key={partner.id} partner={partner} />
      ))}
    </ul>
  );
}
