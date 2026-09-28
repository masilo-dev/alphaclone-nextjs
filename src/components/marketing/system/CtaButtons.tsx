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
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const destination = useAttributedHref(href);
  const external = isExternalHref(destination);
  const classes = `mkt-btn mkt-btn-primary ${className}`.trim();
  const translatedChildren = typeof children === 'string' ? t(children) : children;
  const label = ariaLabel || (typeof translatedChildren === 'string' ? translatedChildren : undefined);
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
        {translatedChildren}
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
      {translatedChildren}
    </Link>
  );
}

/**
 * SecondaryCTA — used for lower-commitment navigation actions.
 */
export function SecondaryCTA({
  href = DEMO_HREF,
  className = '',
  children = CTA_LABELS.secondary,
  onClick,
  'aria-label': ariaLabel,
}: CtaProps) {
  const { t } = useLanguage();
  const destination = useAttributedHref(href);
  const external = isExternalHref(destination);
  const classes = `mkt-btn mkt-btn-demo ${className}`.trim();
  // A fallback label must not override a JSX child's visible text with the
  // unrelated default destination (for example, the homepage workflow link).
  const translatedChildren = typeof children === 'string' ? t(children) : children;
  const label = ariaLabel || (typeof translatedChildren === 'string' ? translatedChildren : undefined);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
    // Intentionally no preventDefault() and no internal-modal redirect.
    // Keep attribution handling and native navigation behavior intact.
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
        {translatedChildren}
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
      {translatedChildren}
    </Link>
  );
}

export function CtaPair({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 ${className}`.trim()}>
      <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">Book a demo</PrimaryCTA>
      <SecondaryCTA href={EXECUTION_LAYER.workflowPath} className="w-full sm:w-auto mkt-btn-large">See a 30-second workflow</SecondaryCTA>
    </div>
  );
}
