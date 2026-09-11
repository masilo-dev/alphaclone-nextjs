'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { VERIFIED_PARTNERS, type VerifiedPartner } from '@/config/verifiedPartners';

function PartnerChip({ partner }: { partner: VerifiedPartner }) {
  const { Icon } = partner;

  return (
    <div
      className="mx-3 flex flex-shrink-0 items-center gap-3 rounded-2xl border px-5 py-3"
      style={{
        background: partner.chipBg,
        borderColor: `${partner.brandColor}35`,
        boxShadow: `0 0 20px ${partner.brandColor}12`,
      }}
      title={`${partner.name} verified integration`}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${partner.brandColor}22` }}
      >
        <Icon aria-hidden className="h-5 w-5" style={{ color: partner.brandColor }} />
      </span>
      <span className="whitespace-nowrap text-sm font-semibold text-slate-200">{partner.name}</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Verified
      </span>
    </div>
  );
}

export default function VerifiedPartnersMarquee() {
  const items = [...VERIFIED_PARTNERS, ...VERIFIED_PARTNERS, ...VERIFIED_PARTNERS];

  return (
    <div className="relative w-full overflow-hidden" aria-label="Verified partner integrations">
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24"
        style={{ background: 'linear-gradient(to right, #020D1A, transparent)' }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24"
        style={{ background: 'linear-gradient(to left, #020D1A, transparent)' }}
      />
      <div className="flex w-max" style={{ animation: 'marquee-scroll 48s linear infinite' }}>
        {items.map((partner, index) => (
          <PartnerChip key={`${partner.id}-${index}`} partner={partner} />
        ))}
      </div>
    </div>
  );
}
