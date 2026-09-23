'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, Play, Shield } from 'lucide-react';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';
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
    <div className="min-h-screen bg-white text-[#07152f]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/" className="inline-flex items-center text-[#52627b] hover:text-[#0878f9] mb-8 type-ui font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>

        <p className="type-caption font-bold uppercase tracking-caps text-[#075fc7] mb-3">{EXECUTION_LAYER.category}</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-marketing-heading text-[#07152f] mb-5 tracking-tight leading-tight">
          How execution works
        </h1>
        <p className="text-lg text-[#52627b] leading-relaxed mb-10">{EXECUTION_LAYER.explanatoryLine}</p>

        <div className="grid sm:grid-cols-2 gap-5 mb-12">
          {MECHANISM.map(({ step, icon: Icon, title, body }, i) => (
            <div key={step} className="rounded-2xl border border-[#dfe6ef] bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="type-caption font-bold text-[#0878f9]">0{i + 1}</span>
                <Icon className="h-5 w-5 text-[#0878f9]" />
                <span className="type-caption font-bold uppercase tracking-wider text-[#76849a]">{step}</span>
              </div>
              <h2 className="text-lg font-bold font-marketing-heading text-[#07152f] mb-2">{title}</h2>
              <p className="type-card-description text-[#52627b] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <section className="mb-12 rounded-2xl border border-[#dfe6ef] bg-[#f7f9fc] p-6 sm:p-8">
          <h2 className="text-xl font-bold font-marketing-heading text-[#07152f] mb-3">{EXECUTION_LAYER.differentiationLine}</h2>
          <p className="text-[#33445e] type-card-description leading-relaxed">
            AlphaClone connects CRM, billing, documents, outreach, and scheduling on shared client records. Bonnie and MCP tools
            can propose and run steps inside that context — with approvals where your business requires them.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <PrimaryCTA href={DEMO_HREF}>{EXECUTION_LAYER.primaryCta}</PrimaryCTA>
          <SecondaryCTA href={EXECUTION_LAYER.workflowPath}>{EXECUTION_LAYER.secondaryCta}</SecondaryCTA>
          <Link href="/reliability" className="type-ui text-[#52627b] hover:text-[#0878f9] self-center sm:ml-2 font-medium transition-colors">
            Reliability & limitations →
          </Link>
        </div>
      </div>
    </div>
  );
}
