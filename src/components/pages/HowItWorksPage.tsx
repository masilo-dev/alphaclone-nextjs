'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, Play, Shield } from 'lucide-react';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';

const MECHANISM = [
  {
    step: 'Decide',
    icon: Eye,
    title: 'You state the outcome',
    body: 'Describe what should happen in business language — follow up on a lead, send an invoice, publish a post.',
  },
  {
    step: 'Approve',
    icon: Shield,
    title: 'You control what runs',
    body: 'Important client-facing actions can require your review. Risk policies determine what auto-runs vs what waits for you.',
  },
  {
    step: 'Execute',
    icon: Play,
    title: 'AlphaClone coordinates action',
    body: 'Connected modules and integrations run the steps on your workspace record — not in a detached chat window.',
  },
  {
    step: 'Verify',
    icon: CheckCircle2,
    title: 'You see the result',
    body: 'Send receipts, publish verification, and execution history show what completed — or what failed and needs attention.',
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
      <div className="max-w-4xl mx-auto px-4 py-20 pt-32">
        <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>

        <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-3">{EXECUTION_LAYER.category}</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-marketing-heading mb-6 leading-tight">
          How execution works
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed mb-10">{EXECUTION_LAYER.explanatoryLine}</p>

        <div className="grid sm:grid-cols-2 gap-5 mb-14">
          {MECHANISM.map(({ step, icon: Icon, title, body }, i) => (
            <div key={step} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-black text-teal-400/80">0{i + 1}</span>
                <Icon className="h-5 w-5 text-teal-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{step}</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <section className="mb-14 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-3">{EXECUTION_LAYER.differentiationLine}</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            AlphaClone connects CRM, billing, documents, outreach, and scheduling on shared client records. Bonnie and MCP tools
            can propose and run steps inside that context — with approvals where your business requires them.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <PrimaryCTA href={TRIAL_HREF}>{EXECUTION_LAYER.primaryCta}</PrimaryCTA>
          <SecondaryCTA href={DEMO_HREF}>{EXECUTION_LAYER.secondaryCta}</SecondaryCTA>
          <Link href="/reliability" className="text-sm text-slate-400 hover:text-teal-300 self-center sm:ml-2">
            Reliability & limitations →
          </Link>
        </div>
      </div>
    </div>
  );
}
