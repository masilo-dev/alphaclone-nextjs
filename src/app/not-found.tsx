import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { MarketingContainer } from '@/components/marketing/system/LayoutPrimitives';
import MarketingShell from '@/components/marketing/system/MarketingShell';

export default function NotFound() {
  return (
    <MarketingShell>
      <section className="mkt-section flex min-h-[72vh] items-center px-4 py-16" data-atmosphere="quiet">
        <MarketingContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mkt-label mb-5">404</p>
            <h1>We could not find that page</h1>
            <p className="mx-auto mt-4 max-w-xl text-[var(--marketing-text-secondary)]">
              The link may have moved, or the page may no longer be available. Explore the
              AlphaClone platform or contact the team if you need help finding something.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PrimaryCTA href="/">Go to homepage</PrimaryCTA>
              <SecondaryCTA href="/crm">Explore the product</SecondaryCTA>
              <SecondaryCTA href="/contact">Contact us</SecondaryCTA>
            </div>
          </div>
        </MarketingContainer>
      </section>
    </MarketingShell>
  );
}
