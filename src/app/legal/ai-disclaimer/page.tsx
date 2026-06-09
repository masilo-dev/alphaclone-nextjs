import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'AI Disclaimer | AlphaClone Systems',
  description: 'AI disclaimer for Bonnie AI and all AI-generated outputs within AlphaClone Systems.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/ai-disclaimer' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'what-is-bonnie', title: 'What Bonnie AI is' },
  { id: 'no-advice', title: 'No professional advice' },
  { id: 'accuracy', title: 'Accuracy is not guaranteed' },
  { id: 'responsibility', title: 'User responsibility' },
  { id: 'liability', title: 'No liability' },
  { id: 'data', title: 'Data sent to AI' },
  { id: 'prohibited', title: 'Prohibited AI uses' },
  { id: 'feedback', title: 'Feedback' },
];

export default function Page() {
  return (
    <LegalPageShell
      title="AI Disclaimer"
      lastUpdated="June 9, 2025"
      intro="This disclaimer explains what Bonnie AI is, how it uses data, and what you must review before relying on AI output."
      sections={sections}
      badge="AI"
    >
      <section id="what-is-bonnie" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">What Bonnie AI is</h2>
        <p className="text-sm leading-7 text-slate-300">
          Bonnie AI is an automation assistant built on Anthropic's Claude API. It helps draft, summarize, and
          automate work, but it is not a professional advisor.
        </p>
      </section>

      <section id="no-advice" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">No professional advice</h2>
        <p className="text-sm leading-7 text-slate-300">
          Bonnie AI does not provide legal, financial, medical, tax, or regulatory advice. You must use your own
          professional judgment and seek expert review where required.
        </p>
      </section>

      <section id="accuracy" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Accuracy is not guaranteed</h2>
        <p className="text-sm leading-7 text-slate-300">
          AI systems can make mistakes, hallucinate facts, or generate outdated content. Always verify important
          outputs before using them.
        </p>
      </section>

      <section id="responsibility" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">User responsibility</h2>
        <p className="text-sm leading-7 text-slate-300">
          You are responsible for reviewing all AI-generated emails, contracts, invoices, and social posts before
          sending or publishing them.
        </p>
      </section>

      <section id="liability" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">No liability</h2>
        <p className="text-sm leading-7 text-slate-300">
          AlphaClone Systems LLC is not liable for decisions made based on Bonnie AI output or for losses caused by
          reliance on unverified AI content.
        </p>
      </section>

      <section id="data" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Data sent to AI</h2>
        <p className="text-sm leading-7 text-slate-300">
          User inputs are sent to Anthropic's API and are subject to Anthropic's privacy policy at{' '}
          <a href="https://anthropic.com/privacy" className="text-teal-300 hover:underline" target="_blank" rel="noreferrer">
            anthropic.com/privacy
          </a>.
        </p>
      </section>

      <section id="prohibited" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Prohibited AI uses</h2>
        <p className="text-sm leading-7 text-slate-300">
          You may not use Bonnie AI to generate spam, illegal content, deceptive content, or content that violates any
          third-party terms of service.
        </p>
      </section>

      <section id="feedback" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Feedback</h2>
        <p className="text-sm leading-7 text-slate-300">
          If Bonnie AI generates an error or something looks wrong, please report it to{' '}
          <a href="mailto:support@alphaclonesystems.com" className="text-teal-300 hover:underline">support@alphaclonesystems.com</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
