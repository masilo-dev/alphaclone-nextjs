'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ClipboardList, Map, Shield, Zap } from 'lucide-react';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF, TRIAL_HREF } from '@/lib/marketing/cta';
import { ANCHOR_WORKFLOW, EXECUTION_LAYER } from '@/config/marketingPositioning';
import { MARKETING_PRICING } from '@/config/pricingPlans';

const SESSION_STEPS = [
  { icon: ClipboardList, title: 'Workflow diagnosis', body: 'You describe one repetitive process that slows your business down today.' },
  { icon: Map, title: 'Process mapping', body: 'We map tools, handoffs, and where work gets stuck or duplicated.' },
  { icon: Shield, title: 'Fit & approval assessment', body: 'We identify what AlphaClone can support reliably and what requires your approval.' },
  { icon: Zap, title: 'Controlled demonstration', body: 'We run or configure the safest path from instruction to verified result — starting with quote-to-cash when it fits.' },
  { icon: CheckCircle2, title: 'Clear recommendation', body: 'You leave with a fit score, next steps, and no pressure to migrate everything at once.' },
] as const;

export default function ExecutionSessionPage() {
  return (
    <div className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
      <div className="max-w-4xl mx-auto px-4 py-20 pt-32">
        <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>

        <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-3">The AlphaClone Execution Session</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-marketing-heading mb-6 leading-tight">
          Map one workflow. See whether AlphaClone can execute it reliably.
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed mb-8">
          {EXECUTION_LAYER.explanatoryLine} This session focuses on one process — not a full platform migration.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-14">
          <PrimaryCTA href={DEMO_HREF}>{EXECUTION_LAYER.secondaryCta}</PrimaryCTA>
          <SecondaryCTA href={TRIAL_HREF}>Start free trial</SecondaryCTA>
        </div>

        <section className="mb-14 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-2">What we cover (45–60 minutes)</h2>
          <p className="text-slate-400 text-sm mb-6">Free diagnostic available for a shorter fit check on request.</p>
          <ul className="space-y-5">
            {SESSION_STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <Icon className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="text-xl font-bold mb-4">Example anchor workflow: {ANCHOR_WORKFLOW.title}</h2>
          <p className="text-slate-300 mb-4">{ANCHOR_WORKFLOW.summary}</p>
          <ol className="list-decimal list-inside space-y-2 text-slate-400 text-sm">
            {ANCHOR_WORKFLOW.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-14 grid sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h3 className="font-semibold text-emerald-300 mb-2">Good fit when</h3>
            <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
              <li>You coordinate leads, delivery, and billing across several tools</li>
              <li>You can connect at least one email or payment integration</li>
              <li>You want control — approvals before client-facing actions</li>
            </ul>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="font-semibold text-amber-300 mb-2">We may defer when</h3>
            <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
              <li>You need channels we mark as coming soon (e.g. WhatsApp-primary ops)</li>
              <li>You require guaranteed revenue, leads, or full unattended automation</li>
              <li>No repeating workflow exists yet to map</li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6 text-center">
          <p className="text-slate-400 text-sm mb-4">{MARKETING_PRICING.startingPriceLine} · 14-day trial · no card required to start</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <PrimaryCTA href={DEMO_HREF}>Book execution session</PrimaryCTA>
            <SecondaryCTA href="/how-it-works">See how execution works</SecondaryCTA>
          </div>
        </section>
      </div>
    </div>
  );
}
