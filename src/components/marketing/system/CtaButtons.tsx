'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  CTA_LABELS,
  DEMO_HREF,
  TRIAL_HREF,
  withPreservedQuery,
} from '@/lib/marketing/cta';
import { useBookingModal } from '@/contexts/BookingModalContext';

type CtaProps = {
  href?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

function useAttributedHref(href: string): string {
  const [destination, setDestination] = useState(href);

  useEffect(() => {
    setDestination(withPreservedQuery(href, window.location.search));
  }, [href]);

  return destination;
}

export function PrimaryCTA({
  href = TRIAL_HREF,
  className = '',
  children = CTA_LABELS.primary,
  onClick,
}: CtaProps) {
  const destination = useAttributedHref(href);
  return (
    <Link
      href={destination}
      onClick={onClick}
      className={`mkt-btn mkt-btn-primary ${className}`.trim()}
    >
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function SecondaryCTA({
  href = DEMO_HREF,
  className = '',
  children = CTA_LABELS.secondary,
  onClick,
}: CtaProps) {
  const destination = useAttributedHref(href);
  let bookingModal: ReturnType<typeof useBookingModal> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    bookingModal = useBookingModal();
  } catch {
    bookingModal = null;
  }

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
    if (bookingModal && (href === DEMO_HREF || href === '/book-demo' || !href)) {
      e.preventDefault();
      bookingModal.openBookingModal('demo');
    }
  };

  return (
    <Link
      href={destination}
      onClick={handleClick}
      className={`mkt-btn mkt-btn-secondary ${className}`.trim()}
    >
      {children}
    </Link>
  );
}

export function CtaPair({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${className}`.trim()}>
      <PrimaryCTA className="w-full sm:w-auto mkt-btn-large" />
      <SecondaryCTA className="w-full sm:w-auto mkt-btn-large" />
    </div>
  );
}
