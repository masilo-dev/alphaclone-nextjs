'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  CTA_LABELS,
  DEMO_HREF,
  TRIAL_HREF,
  isExternalHref,
  withPreservedQuery,
} from '@/lib/marketing/cta';

type CtaProps = {
  href?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  /** Accessible label for the CTA (overrides default when provided) */
  'aria-label'?: string;
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
  'aria-label': ariaLabel,
}: CtaProps) {
  const destination = useAttributedHref(href);
  const external = isExternalHref(destination);
  const classes = `mkt-btn mkt-btn-primary ${className}`.trim();
  const label = ariaLabel || (typeof children === 'string' ? (children as string) : undefined);
  if (external) {
    return (
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={classes}
        aria-label={label}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={destination}
      onClick={onClick}
      className={classes}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

/**
 * SecondaryCTA — used for "Book a demo" marketing CTAs.
 *
 * Intentional behaviour (per public-landing-page rules):
 *  1. Always opens the EXTERNAL calendar booking page in a new tab.
 *  2. Never opens an internal modal or broken internal form.
 *  3. Targets the same single source of truth: PUBLIC_DEMO_BOOKING_URL.
 *  4. Preserves marketing attribution (UTM / gclid / fbclid / ref).
 *  5. Works identically on desktop and mobile with a real <a> link.
 */
export function SecondaryCTA({
  href = DEMO_HREF,
  className = '',
  children = CTA_LABELS.secondary,
  onClick,
  'aria-label': ariaLabel,
}: CtaProps) {
  const destination = useAttributedHref(href);
  const external = isExternalHref(destination);
  const classes = `mkt-btn mkt-btn-secondary ${className}`.trim();
  const label = ariaLabel || (typeof children === 'string' ? (children as string) : 'Book a demo');

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
    // Intentionally no preventDefault() and no internal-modal redirect.
    // SecondaryCTA must be a plain navigation link to the external calendar.
  };

  if (external) {
    return (
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={classes}
        aria-label={label}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={destination}
      onClick={handleClick}
      className={classes}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

export function CtaPair({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 ${className}`.trim()}>
      <PrimaryCTA className="w-full sm:w-auto mkt-btn-large" />
      <SecondaryCTA className="w-full sm:w-auto mkt-btn-large" />
    </div>
  );
}
