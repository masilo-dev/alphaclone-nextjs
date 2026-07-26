import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { MarketingContainer } from '@/components/marketing/system/LayoutPrimitives';

export default function NotFound() {
  return (
    <main className="marketing-theme flex min-h-screen items-center bg-[var(--marketing-bg-primary)] px-4 py-16">
      <MarketingContainer>
        <div className="mx-auto max-w-2xl text-center">
          <p className="mkt-label mb-5">404</p>
          <h1>We could not find that page</h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--marketing-text-secondary)]">
            The link may have moved, or the page may no longer be available. You can return to
            the AlphaClone homepage or contact the team if you need help finding something.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCTA href="/">Go to homepage</PrimaryCTA>
            <SecondaryCTA href="/contact">Contact us</SecondaryCTA>
          </div>
        </div>
      </MarketingContainer>
    </main>
  );
}
