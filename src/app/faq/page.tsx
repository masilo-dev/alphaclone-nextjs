import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/siteUrl';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import { FAQ_BUYER_ITEMS, FAQ_ITEMS, FAQ_PRODUCT_ITEMS } from '@/config/faqItems';

export const metadata: Metadata = {
  title: 'FAQ | AlphaClone Systems',
  description:
    'Answers about outcomes, fit, and trust for service businesses — plus features, integrations, and comparisons to HubSpot, QuickBooks, and Salesforce.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'FAQ | AlphaClone Systems',
    description:
      'Why teams use AlphaClone to connect leads, delivery, and billing — and how it compares to fragmented SaaS stacks.',
    url: `${SITE_URL}/faq`,
    type: 'website',
  },
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <MarketingLandingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-14">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold font-marketing-heading text-[#07152f] mb-3 tracking-tight">
            Frequently asked questions
          </h1>
          <p className="text-[#52627b] text-base sm:text-lg leading-relaxed">
            Start with why teams switch — then drill into features and comparisons if you are evaluating tools.
          </p>
        </div>

        <section id="outcomes" className="scroll-mt-24">
          <h2 className="text-xl font-bold font-marketing-heading text-[#07152f] mb-1.5 tracking-tight">
            Why teams use AlphaClone
          </h2>
          <p className="text-sm text-[#76849a] mb-6">
            Outcomes, fit, setup, and trust — the questions buyers ask first.
          </p>
          <MarketingFaqAccordion items={FAQ_BUYER_ITEMS} />
          <p className="mt-6 text-sm text-[#52627b]">
            See workflow stories by team type on{' '}
            <Link href="/results" className="text-[#075fc7] hover:text-[#0878f9] font-semibold underline underline-offset-2">
              /results
            </Link>
            .
          </p>
        </section>

        <section id="features" className="scroll-mt-24 pt-8 border-t border-[#dfe6ef]">
          <h2 className="text-xl font-bold font-marketing-heading text-[#07152f] mb-1.5 tracking-tight">
            Features &amp; comparisons
          </h2>
          <p className="text-sm text-[#76849a] mb-6">
            Integrations, modules, and how AlphaClone maps to tools you may already use.
          </p>
          <MarketingFaqAccordion items={FAQ_PRODUCT_ITEMS} />
        </section>

        <div className="rounded-2xl border border-[#dfe6ef] bg-[#f7f9fc] p-8 text-center">
          <p className="text-sm text-[#33445e] mb-5 font-medium">
            Still deciding? Review the plans or book a demo using a real lead-to-invoice workflow.
          </p>
          <Link
            href="/auth/login?register=true&type=business&plan=starter"
            className="inline-flex px-6 py-3 rounded-xl bg-[#07152f] hover:bg-[#0c2f61] text-white font-semibold transition-colors shadow-sm text-sm"
          >
            Get started
          </Link>
        </div>
      </main>
    </MarketingLandingShell>
  );
}
