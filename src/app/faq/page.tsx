import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

const faqItems = [
  {
    question: 'What tools does Alphaclone replace?',
    answer:
      'Alphaclone replaces your CRM, invoicing software, contract and e-signature tool, social media scheduler, AI writing assistant, and video meeting platform in one place for 15 USD per month.',
  },
  {
    question: 'Is Alphaclone good for solopreneurs and one-person businesses?',
    answer:
      'Yes. Alphaclone is designed specifically for solo founders and small teams who need enterprise-level capabilities without enterprise-level pricing or complexity.',
  },
  {
    question: 'How is Alphaclone different from HubSpot or QuickBooks?',
    answer:
      'HubSpot and QuickBooks are single-function tools. Alphaclone is a complete business operating system with CRM, finance, contracts, social media, meetings, and AI in one platform.',
  },
  {
    question: 'Do I need to know how to use AI to use Alphaclone?',
    answer: 'No. You describe what you need in plain language and Alphaclone executes it.',
  },
  {
    question: 'What is the best affordable alternative to HubSpot for small businesses?',
    answer:
      'Alphaclone offers CRM, pipeline management, contact tracking, and AI-powered follow-ups starting at 15 USD per month with broader built-in functionality.',
  },
];

export const metadata: Metadata = {
  title: 'FAQ | Alphaclone',
  description:
    'Frequently asked questions about Alphaclone pricing, features, and how it replaces CRM, invoicing, contracts, social media, and meetings.',
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
