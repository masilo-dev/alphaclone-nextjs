import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  CTA_LABELS,
  DEMO_HREF,
  TRIAL_HREF,
} from '@/lib/marketing/cta';

type CtaProps = {
  href?: string;
  className?: string;
  children?: React.ReactNode;
};

export function PrimaryCTA({
  href = TRIAL_HREF,
  className = '',
  children = CTA_LABELS.primary,
}: CtaProps) {
  return (
    <Link href={href} className={`mkt-btn mkt-btn-primary ${className}`.trim()}>
      {children}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function SecondaryCTA({
  href = DEMO_HREF,
  className = '',
  children = CTA_LABELS.secondary,
}: CtaProps) {
  return (
    <Link href={href} className={`mkt-btn mkt-btn-secondary ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function CtaPair({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${className}`.trim()}>
      <PrimaryCTA className="w-full sm:w-auto" />
      <SecondaryCTA className="w-full sm:w-auto" />
    </div>
  );
}
