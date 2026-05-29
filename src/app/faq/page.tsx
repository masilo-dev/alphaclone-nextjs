import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

const faqItems = [
  {
    question: 'What tools does Alphaclone replace?',
    answer:
      'Alphaclone brings CRM, invoicing, contracts, social media workflows, AI assistance, and video meeting operations into one workspace. Starter plans begin at 15 USD per month.',
  },
  {
    question: 'Is Alphaclone good for solopreneurs and one-person businesses?',
    answer:
      'Yes. Alphaclone is designed for solo founders and small teams that need CRM, billing, contracts, meetings, and automation in one workspace.',
  },
  {
    question: 'How is Alphaclone different from HubSpot or QuickBooks?',
    answer:
      'HubSpot and QuickBooks focus on specific business functions. Alphaclone combines CRM, finance, contracts, social media workflows, meetings, and AI-assisted operations in one platform.',
  },
  {
    question: 'Do I need to know how to use AI to use Alphaclone?',
    answer: 'No. You can describe operational tasks in plain language and use the dashboard controls for review and execution.',
  },
  {
    question: 'How does Alphaclone compare with HubSpot for small businesses?',
    answer:
      'Alphaclone includes CRM, pipeline management, contact tracking, and AI-assisted follow-up workflows starting at 15 USD per month, alongside finance, contracts, meetings, and social workflows.',
  },
];

export const metadata: Metadata = {
  title: 'FAQ | Alphaclone',
  description:
    'Frequently asked questions about Alphaclone pricing, features, CRM, invoicing, contracts, social media workflows, and meetings.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'FAQ | Alphaclone',
    description:
      'Answers about Alphaclone as an AI business operating system for founders and small teams.',
    url: `${SITE_URL}/faq`,
    type: 'website',
  },
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6">Frequently Asked Questions</h1>
        <p className="text-slate-300 mb-10 text-base md:text-lg">
          Everything you need to know about Alphaclone as an AI business operating system.
        </p>
        <div className="space-y-6">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-xl font-bold text-white mb-2">{item.question}</h2>
              <p className="text-slate-300 leading-relaxed">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
