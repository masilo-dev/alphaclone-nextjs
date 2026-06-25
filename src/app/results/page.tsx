import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';
import { OUTCOME_CASE_STUDIES } from '@/config/marketingOutcomes';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Results & Workflow Stories | Alphaclone',
  description:
    'See how service businesses connect leads, delivery, contracts, and billing in one workspace — representative workflow stories by team type.',
  alternates: { canonical: `${SITE_URL}/results` },
  openGraph: {
    title: 'Results & Workflow Stories | Alphaclone',
    description: 'Before-and-after workflows for consultants, agencies, and founders replacing fragmented SaaS stacks.',
    url: `${SITE_URL}/results`,
    type: 'website',
  },
};

const SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';

export default function ResultsPage() {
  return (
    <MarketingLandingShell>
      <main className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.28em] font-bold text-teal-400 mb-3">Workflow stories</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
            What changes when your tools stop fighting each other
          </h1>
          <p className="text-slate-400 leading-relaxed mb-2">
            Each story follows the same structure: the problem, what changed in the workflow, and the business outcome.
          </p>
          <p className="text-xs text-slate-500 border border-slate-800 rounded-lg px-4 py-3 bg-slate-900/40">
            Stories on this page are representative workflow composites — not verified customer metrics. Request a live demo for audited outcomes from your segment.
          </p>
        </div>

        <div className="space-y-8">
          {OUTCOME_CASE_STUDIES.map((study) => (
            <article
              key={study.id}
              id={study.id}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 sm:p-8 scroll-mt-24"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{study.persona}</h2>
                  <p className="text-sm text-slate-500">{study.industry}</p>
                </div>
                {study.representative && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Representative scenario
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Stack replaced</p>
              <p className="text-sm text-teal-300 font-medium mb-6">{study.stackReplaced}</p>

              <div className="grid gap-6 sm:grid-cols-3 mb-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-red-400/90 mb-2">Problem</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{study.problem}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">What changed</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{study.whatChanged}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400 mb-2">Outcome</p>
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">&ldquo;{study.outcome}&rdquo;</p>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Capabilities used</p>
              <div className="flex flex-wrap gap-2">
                {study.modulesUsed.map((mod) => (
                  <span
                    key={mod}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-xs text-slate-400"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Have a story to share?</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Named case studies with metrics build trust faster than any feature list. Email us if Alphaclone changed how you run clients.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={SIGNUP_HREF}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-colors"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@alphaclonesystems.com?subject=Customer%20story"
              className="inline-flex px-6 py-3 rounded-xl border border-slate-700 text-slate-200 font-semibold hover:border-teal-500/40 transition-colors"
            >
              Share your outcome
            </a>
          </div>
        </div>
      </main>
    </MarketingLandingShell>
  );
}
