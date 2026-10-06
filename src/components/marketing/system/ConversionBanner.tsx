'use client';

import { PrimaryCTA, SecondaryCTA } from './CtaButtons';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';

export function ConversionBanner({
  title = 'Ready to run your business from one workspace?',
  description = 'Get started with AlphaClone or book a demo to see a real workflow.',
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="mkt-mid-cta">
      <div>
        <h2 className="font-marketing-heading text-xl sm:text-2xl text-white">{t(title)}</h2>
        <p className="mt-3 text-[var(--text-secondary)]">{t(description)}</p>
      </div>
      <div className="mkt-mid-cta-actions">
        <PrimaryCTA href={DEMO_HREF} className="mkt-btn-large" />
        <SecondaryCTA href={EXECUTION_LAYER.workflowPath} className="mkt-btn-large" />
      </div>
    </div>
  );
}
